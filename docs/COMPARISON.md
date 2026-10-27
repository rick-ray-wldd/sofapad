# SofaPad v0.2 (Python) and Phone KeyMouse v1–v4 (Swift): what changed

Two attempts at the same idea, from the same original prompt: use the iPhone's own keyboard and a one-handed trackpad
to control a Mac from the sofa (Vision Pro + Mac Virtual Display).

- **SofaPad v0.1–v0.2** (2026-10-23): built in one day in a cloud container, a single Python script plus one web page.
  It is in [`legacy/v0.2-python/`](../legacy/v0.2-python/) with its own records.
- **Phone KeyMouse v1–v4** (2026-10-23 to 10-28): built on the Mac itself as a Swift menu-bar app plus a web page.
  From 4.0 it is called **SofaPad** and replaces the Python version, which the owner no longer uses (P-25).

Everything below comes from the two sets of records (`legacy/v0.2-python/process/` and `process/`). "Not recorded"
means the records do not say; nothing is estimated here.

## Features

| | SofaPad v0.2 (Python) | Phone KeyMouse v1 | v2 | v3 | 4.0 (SofaPad) |
|---|---|---|---|---|---|
| Move, tap, right click, scroll with momentum, drag | yes | yes (plus drag lock) | yes | yes | yes |
| Three-finger swipe: desktops, Mission Control, App Exposé | yes, never confirmed on a real Mac | no | yes (fixed after the first real test, I-18) | yes | yes |
| Three-finger tap = Look Up (⌃⌘D) | yes | no | no | no | no |
| Pinch zoom (⌘+ / ⌘−) | yes | no | yes | yes | yes |
| Four-finger gestures (desktops, Show Desktop, Launchpad) | yes | no | no | no | no |
| Landscape | MacBook-like layout, ⤢ full-screen pad | no | full-screen pad, floating buttons | same | same |
| Shortcut panel | 40+ shortcuts | basic keys | groups + custom shortcuts, JSON export/import | + editable key row | same |
| Typing | live diff or draft + Send; IME composition not sent | live or batch; Zhuyin composition not sent | same; pad keeps its size while typing | + dictation without double typing (I-21), sent text never sent again (I-24), 🎤 voice key | voice key removed; text waits for the Mac and goes before clicks; no undo in the box; version shown |
| Mac app | `python3 sofapad.py` in Terminal (or `start.command`) | menu-bar `PhoneKeyMouse.app` | same + checks the Mac's shortcut settings | + "Scan with iPhone" QR | `SofaPad.app`: one QR, version in the menu |
| Permission to grant | Accessibility for Terminal | Accessibility for the app | same | same | same (again, after the rename) |
| Paused while the Mac is locked | no | yes | yes | yes | yes |

## Architecture

| | SofaPad v0.2 | Phone KeyMouse / SofaPad 4.0 |
|---|---|---|
| Mac side | one Python file (693 lines), standard library only; CoreGraphics through `ctypes` | Swift package: `PKMCore` (protocol, pairing, server, sessions) and the app (CGEvent injection, menu bar, self-test); no third-party packages |
| Server | hand-written asyncio HTTP + WebSocket on 0.0.0.0:8765 | Network.framework listener on 8765 (v3 also had https on 8766 for the voice key; removed in 4.0); own HTTP and WebSocket parser; LAN peers only |
| Text into the Mac | Unicode key events | key events, or clipboard + ⌘V when a Mac input method is active; 4.0 types on its own queue and keeps the phone in step |
| Phone side | one HTML file (775 lines), inline script | `web/index.html` + modules in `web/js/` (gestures, live typing, connection, key row, shortcuts, SHA-256) |
| Start | double-click `start.command` (blocked by Gatekeeper on recent macOS) or Terminal | open the app; build it with `tools/build-app.sh` (Swift toolchain) |

## Security

| | SofaPad v0.2 | Phone KeyMouse / SofaPad 4.0 |
|---|---|---|
| Pairing | one 6-digit PIN, reused every run (`--new-pin` to change), kept on the phone | a pairing code shown on the Mac (QR in the pairing window); after that a token, proven with HMAC over a fresh challenge, so it never crosses the Wi-Fi again |
| Guessing | 8 wrong PINs per minute per address | 5 wrong codes → 30 s, doubling; too many in total → new code, pairing closed |
| Who may connect | any address that reaches port 8765 | private network addresses only |
| Encryption | none (plain http/ws) | none (plain http/ws); v3's https for the voice key is gone in 4.0 |
| Extra | permission self-check, red banner on the phone | no input while the Mac is locked; one controlling phone; 4.0: text that arrives more than 3 s late is not typed |

## Problems met

SofaPad (Python): most problems were about reaching a real Mac at all — the injector was written and tested in a
cloud Linux container and first ran on a Mac in the owner's hands; that first test failed because Terminal had no
Accessibility permission and macOS drops the events silently (I-15, fixed in v0.1.1 with a self-check and a banner).
Gatekeeper later blocked `start.command` (I-25). The v0.2 gestures were never verified on a real Mac (I-20, I-22).

Phone KeyMouse: built and tested on the Mac, with real injection into test windows behind a guard. The problems came
from real use: the touch area shrinking while typing (I-13), the first three-finger swipe sending arrow keys without
the Fn/keypad flags so macOS ignored them (I-18), the key row not scrolling (I-19), iOS dictation typed twice on the
Mac (I-21), sent text going out again into the next app (I-24), and in 4.0 the Mac falling behind while pasting and
old text landing in the next window (I-29). The full lists are in each `process/ISSUES.md`.

## Time and cost

| Version | Date | Time (as recorded) | Writer's tool calls | Helpers | Money |
|---|---|---|---|---|---|
| SofaPad v0.1 | 10-23 | research about 3 min (estimated in its records), report 11:42; prototype 12:03–12:11 (about 9 min) | 56 up to 12:11 | not recorded | not recorded |
| SofaPad v0.1.1 / v0.1.2 / v0.2 | 10-23 | about 2 / 1–3 / 4 min each | not totalled | not recorded | not recorded |
| Phone KeyMouse v1 | 10-23 | 59 min to delivery; real injection passed 3 h 18 min after the prompt (the Mac was locked in between) | 139 | 3 research | NT$0 |
| v2 | 10-24 | 31 min | 111 | 2 | NT$0 |
| v2 fixes (PKM-2-3) | 10-24 | 19 min | 81 | 0 | NT$0 |
| v3 | 10-27 | 61 min | 174 | 2 | NT$0 |
| 4.0 | 10-28 | see `process/TIMELINE.md` v4 | see `process/TOOL-LOG.md` v4 | 3 | NT$0 |

Tokens: SofaPad did not record them; Phone KeyMouse records them per version in `process/SUMMARY.md`.

## How 4.0 brings them together

- **One product, one repo.** The Swift version is now SofaPad and lives here; the Python version is kept unchanged in
  `legacy/v0.2-python/`, and its last commit (40dc24c) is tagged `v0.2-python`. Both sets of records stay.
- **Kept from SofaPad v0.2.** The owner said the old version's native shortcuts were nicer to use (relayed feedback,
  P-11 in `process/USER-PROMPTS.md`). Phone KeyMouse took that up from v2: three-finger swipes to switch desktops and
  open Mission Control / App Exposé, pinch zoom, a shortcut panel with copy, paste and screenshot-to-clipboard, and
  custom shortcuts. Landscape as a full-screen trackpad also follows the same request.
- **Not (yet) carried over.** Four-finger gestures (Show Desktop, Launchpad), three-finger tap for Look Up, and
  double-tap to lock a modifier key. They are candidates for the next iteration here.
- **What the Swift version adds.** It runs as a normal Mac app (no Terminal permission), pairs with a code and an HMAC
  proof instead of a fixed PIN, accepts only LAN peers, pauses while the Mac is locked, handles Zhuyin and dictation
  without double typing, and is tested with real injection on a Mac — in 4.0 with the iPhone Simulator typing through
  the real iOS keyboard.
