# Development

[README](../README.md) · [繁體中文 README](../README.zh-TW.md)

## Layout

| Path | What |
|---|---|
| `mac/` | Swift package. `PKMCore`: protocol, pairing, LAN server, sessions, pacing, addresses. `pkm-server`: CGEvent injection, menu bar, self-test (built into `SofaPad.app`). `pkm-probe`: window for the older end-to-end test |
| `web/` | The phone page. `js/pointer.js` gestures, `textsync.js` live typing (IME, dictation, flow control), `connection.js` link (heartbeat, reconnect, nothing resent), `keyrow.js` the editable key row, `shortcuts.js`, `sha256.js` login proof, `version.js` |
| `tools/` | `build-app.sh` (builds `dist/SofaPad.app`), browser tests (Playwright + headless Chrome, dry-run Mac), `pkm4/` the iOS Simulator + TextEdit real-injection bench |
| `design/` | `SPEC.md`, screenshots, test evidence |
| `research/` | The research report from v1 (papers, GitHub projects, products, Apple's own features) |
| `process/` | Development records, in Chinese (timeline, decisions, issues, research log, tool log, summaries) |
| `legacy/v0.2-python/` | The earlier Python SofaPad, kept as it was |

Internal names stay as they were before the rename (the `pkm-server` target, the `PKMCore` module, `pkm.` keys in the phone's storage), so saved settings and paired phones keep working.

## Run from Terminal

```bash
swift run --package-path mac pkm-server            # menu bar + QR code in Terminal; Enter = new pairing code
swift run --package-path mac pkm-server -- --help  # all options
```

Options: `--port 8765`, `--text-mode auto|type|paste`, `--forget-devices`, `--no-ui`, `--dry-run` (print events, touch nothing), `--no-post`, `--self-test`, `--state-dir DIR`, `--snapshot-scan PNG`.

Run this way, the Accessibility permission belongs to Terminal (or whatever runs it), which lets everything in that terminal control the Mac. Use `SofaPad.app` for everyday use.

## Tests

```bash
swift test --package-path mac                      # Swift unit tests
(cd web && node --test test/*.test.mjs)            # JS unit tests
dist/SofaPad.app/Contents/MacOS/SofaPad --self-test  # real CGEvents built but not posted; 2 items skip while the screen is locked

(cd tools && npm install)                          # once: playwright-core (uses the installed Google Chrome)
node tools/v2-browser.mjs                          # gestures, shortcut panel, landscape (dry-run Mac)
node tools/pkm31-dictation.mjs --label after       # iOS dictation replay (I-21)
node tools/pkm33-send-clear.mjs --label after      # sent text put back by iOS is not sent again (I-24)
node tools/pkm31-keyrow.mjs                        # key row editor
node tools/pkm4-browser.mjs                        # 4.0: version line, undo blocked, silent connection, nothing resent
tools/e2e.sh                                       # older real-injection test into a probe window
```

### The iOS Simulator + TextEdit bench (`tools/pkm4/`)

Real typing through the iOS keyboard in Simulator Safari, real injection on the Mac — but only into two untitled TextEdit windows the bench opens itself:

- `SimDriver/` is an XCUITest that drives Safari in the simulated iPhone (typeText, keyboard keys, Home and back). It reads commands from files, so it never touches the Mac's own keyboard or windows.
- `tewin.swift` opens TextEdit with two untitled documents, brings one to the front, reads their text, and closes them without saving — through the Accessibility API only.
- `run.mjs` runs a scenario. The Mac app runs with an e2e guard: an event is posted only while TextEdit is in front and its front window is one of the two test windows. The bench does not start while the Mac is locked or someone used it in the last 60 s, stops when the front app or the mouse changes, stops each run after 2 minutes, and gives the front back to the app that had it.

```bash
node tools/pkm4/run.mjs switch --mode live --rounds 15      # send → switch window → type one character
node tools/pkm4/run.mjs switch --mode buffer --rounds 15
node tools/pkm4/run.mjs reconnect --kind stop --rounds 10   # the Mac stops answering (half-open), Ray moves on
node tools/pkm4/run.mjs reconnect --kind restart --rounds 10
node tools/pkm4/run.mjs latency                             # input event on the phone → event posted on the Mac
PKM_OLD_SRC=<folder with an older mac/ and web/> node tools/pkm4/run.mjs switch --build old   # same bench, older build
```

Results go to `design/evidence/pkm4/`.

## 4.0: stale text and lag

The report (P-23): after sending text and switching to the next window, the previous text showed up again in the new
window, and typing lagged. Tested with the bench above on 2026-10-28, the same script against 3.x (commit ec89c07)
and 4.0. Every run injected for real into TextEdit; the Mac's input source was Zhuyin, so every piece of text went in
as clipboard + ⌘V, as on the owner's Macs. Results: `design/evidence/pkm4/runs.json`.

| Hypothesis | Result | Evidence |
|---|---|---|
| (a) After a reconnect, queued text is sent again into the new window | **Reproduced, as late delivery.** 3.x keeps sending into a connection that went quiet (no heartbeat); when it comes back, everything typed meanwhile is typed into whatever window is in front: 4 of 4 stalls. A plain resend of already-typed text was not seen (the Mac drops duplicates by page and id, unless the Mac app restarted) | `reconnect-old-*`: the "lost" text of every round is in window B |
| (b) The clipboard restore races the next ⌘V | **Not reproduced.** A restore only happens if nothing wrote the clipboard since our paste, so our own pastes never interleave; after 300+ pastes the user's clipboard was back. Still possible: an app that reads the clipboard more than 0.6 s after ⌘V would paste the restored item. TextEdit never did | all runs; clipboard checked after the last run |
| (c) iOS puts old text back on blur / focus / app switch | **Reproduced through undo/redo.** After the box is cleared, iOS undo (⌘Z here; on an iPhone also shake, three-finger swipe or double tap) brings the sent text back and 3.x sends it again: 6 of 6. Going to the Home Screen and back: 0 of 6 in both versions. Dictation putting text back cannot run in the Simulator; it is covered by the replay tests (I-24) | `undo-old-*`, `background-*`, `tools/pkm33-send-clear.mjs` |
| (d) The 0.7 s dictation wait sends text after the switch | **Part of it.** Text waiting on the phone was sent after a click or key that came later. 4.0 sends waiting text first, before any click, key or gesture | `tools/pkm4-browser.mjs`, `web/test/flow.test.mjs` |
| (e) The Mac falls behind | **Reproduced — the main cause of both symptoms.** With an input method active, 3.x pasted every character separately, at least 150 ms apart. A typed line built a backlog of seconds on the Mac (the lag), and what was left of it, plus the Enter, landed in the next window: 13 of 15 and 6 of 8 rounds, cut mid-word ("ine 1⏎") | `switch-old-live-*`: window B |

What 4.0 changes:

- **The phone waits for the Mac** (flow control): while the Mac is still typing the previous piece, what you type collects on the phone and goes as one piece when the Mac answers. Nothing piles up on the Mac.
- **Text before clicks**: text still waiting on the phone is sent before any click, key, gesture or scroll, so it always lands in the window it was typed for.
- **No undo/redo in the box**: it put sent text back. Text arriving while the box has no focus is ignored.
- **Connection**: the phone pings every 1.5 s and drops a connection it has not heard from for 4.5 s; it reconnects after 0.3 s, then up to every 2 s. Pings are answered at once, even while the Mac is typing (injection runs on its own queue). After a reconnect nothing is sent again: the Mac says which ids it typed (`last`, `skipped`, `boot`), and the phone shows what did not arrive. The Mac does not type text or clicks that arrive more than 3 s late (measured against the phone's own pings, so the two clocks need not agree).

4.0 on the same bench:

| Run | Result |
|---|---|
| Send → switch window → type one character (live and batch, 64 rounds) | 0 rounds with old text in the new window, 0 duplicates, 0 missing |
| Undo / redo after sending (6), Home Screen and back (6) | 0 |
| Disconnects: Mac app paused for 6 s (12), quit and restarted (10) | 22 of 22 reconnected; after the Mac came back: about 0.02 s (paused) and 0.68 s on average, 0.84 s at most (restarted); 0 late text typed, 0 typed twice |
| Typing latency, one key at a time (phone input event → event posted on the Mac) | p50 34 ms, p95 37 ms, max 81 ms (176 keys) |
| Zhuyin on the phone keyboard (ㄋㄧˇ → 你, ㄏㄠˇ → 好) | 「你好」, nothing sent while composing |

Not covered by the bench: real iPhone hardware and Wi-Fi, iOS dictation, apps other than TextEdit (a terminal, LINE), and
switching windows by other means than the phone within 0.7 s of dictating without pressing Enter (the last piece can
still land in the new window then; batch mode avoids it).
