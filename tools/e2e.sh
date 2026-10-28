#!/bin/bash
# Real-injection end-to-end test on this Mac, inside the PKM-1-1 rules:
#  - events reach the system only while the probe window is front-most (and, for clicks/scrolls, under the cursor);
#  - optional quiet hours (PKM_QUIET_HOURS=1300-1345); each run stays well under 2 minutes;
#  - the server listens on 127.0.0.1 only and is stopped at the end; cursor and front app are restored by the probe;
#  - it does not start while the screen is locked, or when someone used this Mac's mouse or keyboard in the last
#    30 s (PKM_E2E_MIN_IDLE; I-17, approved in PKM-2-3). PKM_E2E_PREFLIGHT_ONLY=1 runs only these checks.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/tools/out/e2e-$(date +%H%M%S)}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"   # absolute: the probe is started by LaunchServices with cwd /
# Optional quiet hours, e.g. PKM_QUIET_HOURS=1300-1345 (used on the shared Mac mini per PKM-1-1).
if [ -n "${PKM_QUIET_HOURS:-}" ]; then
  HM=$(date +%H%M); FROM=${PKM_QUIET_HOURS%-*}; TO=${PKM_QUIET_HOURS#*-}
  if [ "$HM" -ge "$FROM" ] && [ "$HM" -lt "$TO" ]; then echo "quiet hours $PKM_QUIET_HOURS：不做真實注入"; exit 3; fi
fi
# Lock screen and recent use (I-17): never compete with a person at the Mac for the front app or the cursor.
LOCKED=$(/usr/sbin/ioreg -n Root -d1 -a | python3 -c "import sys,plistlib; d=plistlib.loads(sys.stdin.buffer.read()); print(any(s.get('CGSSessionScreenIsLocked') for s in d.get('IOConsoleUsers',[])))")
if [ "$LOCKED" != "False" ]; then echo "螢幕鎖定中（$LOCKED）：不做真實注入"; exit 5; fi
IDLE=$(/usr/sbin/ioreg -c IOHIDSystem -d4 | awk '/HIDIdleTime/ {printf "%d", $NF/1000000000; exit}')
MIN_IDLE=${PKM_E2E_MIN_IDLE:-30}
if [ -z "$IDLE" ] || [ "$IDLE" -lt "$MIN_IDLE" ]; then
  echo "最近 ${MIN_IDLE} 秒內有人用這台 Mac（滑鼠／鍵盤閒置 ${IDLE:-?} 秒）：不做真實注入"; exit 6
fi
if [ -n "${PKM_E2E_PREFLIGHT_ONLY:-}" ]; then echo "preflight OK：未鎖定，閒置 ${IDLE} 秒（≥ ${MIN_IDLE}）"; exit 0; fi
BIN="$ROOT/mac/.build/debug"
STOP="$OUT/stop"; rm -f "$STOP"
echo "start $(date '+%H:%M:%S')" > "$OUT/times.txt"
# The app in front before the test (I-12): `open` makes the probe front before it can look, so record it here.
front_pid() { lsappinfo info -only pid "$(lsappinfo front)" | sed -n 's/.*pid = \([0-9][0-9]*\).*/\1/p' | head -1; }
FRONT_BEFORE=$(front_pid)
echo "front before $FRONT_BEFORE" >> "$OUT/times.txt"

# Wrap the probe in a tiny .app and start it through LaunchServices (`open`), which brings it to the
# front reliably; a process started from a shell may be refused activation (macOS 14+ cooperative activation).
PAPP="$OUT/PKMProbe.app"
mkdir -p "$PAPP/Contents/MacOS"
cp "$BIN/pkm-probe" "$PAPP/Contents/MacOS/pkm-probe"
cat > "$PAPP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>local.ray.phonekeymouse.probe</string>
<key>CFBundleExecutable</key><string>pkm-probe</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleName</key><string>PKM Probe</string>
</dict></plist>
PLIST
codesign --force --sign - "$PAPP" 2>/dev/null
: > "$OUT/probe.jsonl"
open -n --stdout "$OUT/probe.jsonl" --stderr "$OUT/probe.err" "$PAPP" --args --seconds 90 --stop-file "$STOP" ${FRONT_BEFORE:+--restore-pid "$FRONT_BEFORE"}
for i in $(seq 1 40); do grep -q '"ready"' "$OUT/probe.jsonl" 2>/dev/null && break; sleep 0.1; done
READY=$(grep '"ready"' "$OUT/probe.jsonl")
echo "$READY"
if ! echo "$READY" | grep -q '"front":true'; then
  echo "probe 沒有成為前景 App，取消測試（不送任何事件）"; touch "$STOP"; sleep 1; exit 4
fi
PID=$(echo "$READY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["pid"])')
PORT=$(python3 -c 'import random; print(random.randint(30000,40000))')
"$BIN/pkm-server" --no-ui --bind 127.0.0.1 --port "$PORT" --state-dir "$OUT/state" --e2e-guard-pid "$PID" \
  --web-root "$ROOT/web" > "$OUT/server.log" 2>&1 &
SERVER=$!
for i in $(seq 1 50); do grep -q '配對碼：[0-9]' "$OUT/server.log" 2>/dev/null && break; sleep 0.1; done
CODE=$(grep -o '配對碼：[0-9]\{6\}' "$OUT/server.log" | head -1 | grep -o '[0-9]\{6\}')
node "$ROOT/tools/e2e.mjs" --url "http://127.0.0.1:$PORT/" --code "$CODE" ${PKM_E2E_V2:+--v2 1} > "$OUT/driver.json" 2>"$OUT/driver.err"
DRIVER=$?
sleep 0.5
touch "$STOP"
for i in $(seq 1 30); do grep -q '"restored"' "$OUT/probe.jsonl" && break; sleep 0.1; done
kill $SERVER 2>/dev/null; wait $SERVER 2>/dev/null
sleep 0.3   # let the re-activation of the previous app settle
echo "front after $(front_pid)" >> "$OUT/times.txt"
echo "end $(date '+%H:%M:%S')" >> "$OUT/times.txt"
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "port $PORT still open!"; else echo "port $PORT closed" >> "$OUT/times.txt"; fi
echo "driver exit $DRIVER"
python3 "$ROOT/tools/e2e_check.py" "$OUT"
