#!/usr/bin/env python3
"""Checks an e2e run directory (probe.jsonl, driver.json, server.log) and writes result.json."""
import json, sys, pathlib

out = pathlib.Path(sys.argv[1])
probe = [json.loads(l) for l in (out / "probe.jsonl").read_text().splitlines() if l.strip().startswith("{")]
try:
    driver = json.loads((out / "driver.json").read_text() or "{}")
except json.JSONDecodeError:
    driver = {}
server = (out / "server.log").read_text()
ready = next((p for p in probe if p.get("ready")), {})
final = next((p for p in probe if "final" in p), {})
events = [p for p in probe if "e" in p]
w = ready.get("window", {})

def inside(e):
    return w and w["x"] <= e["x"] <= w["x"] + w["w"] and w["y"] <= e["y"] <= w["y"] + w["h"]

moved = [e for e in events if e["e"] == "moved"]
ldown = [e for e in events if e["e"] == "ldown"]
times = (out / "times.txt").read_text()
front = dict(l.split(" ", 2)[1:] for l in times.splitlines() if l.startswith("front "))
v2 = bool(driver.get("v2"))
keys = [e for e in events if e["e"] == "key"]
CMD, OPT = 0x100000, 0x80000
plain = "".join(k["chars"] for k in keys if not k.get("flags", 0) & CMD)
# v2 ends with ⌘A + "v2 OK", which replaces everything typed before (PKM-2 run4)
expected_text = "v2 OK" if v2 else "你好， Hello\n整段送出測試 OK"
checks = {
    "probe 成為前景、事件只進 probe": ready.get("front") is True,
    "迷你地圖跳到螢幕中央（游標進入 probe 視窗）": any(inside(e) for e in moved),
    "單指滑動 → 游標往右移": len(moved) >= 3 and max(e["x"] for e in moved) - min(e["x"] for e in moved) > 30,
    "點一下 → 左鍵（clickCount 1）": any(e["n"] == 1 for e in ldown),
    "點兩下 → 雙擊（clickCount 2）": any(e["n"] == 2 for e in ldown),
    "雙指點 → 右鍵": any(e["e"] == "rdown" for e in events),
    "雙指往下滑 → 捲動（dy>0、精確捲動）": any(e["e"] == "scroll" and e["dy"] > 0 and e.get("precise") for e in events),
    "長按再拖 → 左鍵拖曳": any(e["e"] == "drag" for e in events),
    "注音組字中沒有送出任何東西": driver.get("sentWhileComposing") == 0,
    "整段模式：按送出前不送": driver.get("ackAfterSend", 0) - driver.get("ackBeforeSend", 0) == 1,
    f"Mac 文字框內容 = {expected_text!r}": final.get("final") == expected_text,
    "所有 ack ok": bool(driver.get("acks")) and all(a.get("ok") for a in driver["acks"]),
    "前景檢查沒有擋到任何事件（全部在 probe 上）": "event" not in server or "dropped" not in server,
    "游標與前景 App 已恢復": any("restored" in p for p in probe),
    "原本的前景 App 有記下來（不是 probe 自己）": ready.get("previous") not in ("", None, "local.ray.phonekeymouse.probe"),
    "結束後前景回到原本的 App": bool(front.get("before")) and front.get("before") == front.get("after"),
}
if v2:
    checks.update({
        "v1 的打字內容在 ⌘A 之前都打進去了（你好， Hello／整段送出測試 OK）": "你好， Hello" in plain and "整段送出測試 OK" in plain,
        "捏合放大 → probe 收到 ⌘=": any(k["chars"] == "=" and k["flags"] & CMD for k in keys),
        "捏合縮小 → probe 收到 ⌘-": any(k["chars"] == "-" and k["flags"] & CMD for k in keys),
        "快捷鍵面板 ⌘A 全選 → probe 收到 ⌘A，接著打的字取代全部": any(k["code"] == 0 and k["flags"] & CMD for k in keys) and final.get("final") == "v2 OK",
        "自訂快捷鍵 ⌥⌘K（在編輯器建立）→ probe 收到 ⌥⌘K": any(k["code"] == 40 and k["flags"] & CMD and k["flags"] & OPT for k in keys),
        "橫拿全螢幕觸控板（844×390）點一下 → 左鍵": any(s.get("step") == "landscape" and round(s["pad"]["w"]) == 844 and round(s["pad"]["h"]) == 390 for s in driver.get("steps", [])) and len(ldown) >= 5,
        "全系統快捷鍵（切桌面、Mission Control、截圖、⌘Tab…）一個都沒有送": driver.get("systemWideSent") == 0,
    })
result = {"checks": checks, "final_text": final.get("final"), "acks": driver.get("acks"), "driver_ms": driver.get("ms"),
          "times": times, "events": len(events), "ready": ready}
(out / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
for k, v in checks.items():
    print(("PASS " if v else "FAIL ") + k)
print(times.strip())
print("final text:", repr(final.get("final")))
sys.exit(0 if all(checks.values()) else 1)
