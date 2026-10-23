# SofaPad prototype v0.2

**English** | [繁體中文](README.zh-TW.md)

Control a Mac with your iPhone's own keyboard (any IME works: Zhuyin, Pinyin, handwriting, dictation) and a one-handed trackpad. It's built for working from the sofa with Apple Vision Pro and Mac Virtual Display, when there's no good place to put a real keyboard.

- `sofapad.py`: the Mac helper. Python standard library only, nothing to install.
- `web/index.html`: the phone client, served by the helper.
- `start.command`: double-click in Finder to start the helper.
- `macos/`: builds a signed SofaPad.app menu bar app (v0.3).
- `tests/`: automated tests that emulate an iPhone with Playwright, plus their results.
- `docs/research-report.html`: the research and design report (existing apps, papers, architecture, UI design).
- `process/`: the development log (timeline, sources, decisions, tool use, issues, user prompts). It's written in Chinese.

## How it works

iOS doesn't let apps act as a Bluetooth keyboard, so SofaPad uses a small helper on the Mac instead. The phone opens a web page served by the helper and talks to it over a WebSocket on your home Wi-Fi. The helper turns those messages into real mouse and keyboard events with macOS CoreGraphics.

Text is sent only after the iPhone IME finishes composing, so you pick characters on the phone and the Mac receives the final text.

## First-time setup (about 5 minutes)

1. **Put the whole `sofapad` folder on your Mac**, for example in Documents.
2. **Check that python3 is available.** Open Terminal and run `python3 --version`. If macOS offers to install the command line developer tools, accept and wait for it to finish.
3. **Start the helper.** Double-click `start.command` in Finder. If macOS says it "could not verify start.command is free of malware", press Done, then go to System Settings > Privacy & Security and click Open Anyway next to start.command (right-click > Open no longer works on recent macOS). Or skip that check by running it from Terminal:
   ```
   cd ~/Documents/sofapad
   python3 sofapad.py
   ```
4. **Grant Accessibility permission.** Go to System Settings > Privacy & Security > Accessibility and turn on Terminal (or iTerm, if that's what you use). Then quit the helper (Ctrl+C) and start it again. Without this permission, the mouse and keyboard won't move.
5. If macOS asks whether Python may accept incoming connections, choose Allow.
6. **Connect the phone.** Put the iPhone and the Mac on the same Wi-Fi. In Safari, open the URL the helper prints (for example `http://your-mac-name.local:8765`) and enter the 6-digit PIN it shows.
7. **Add it to the Home Screen** (recommended). In Safari, tap Share, then Add to Home Screen, so it opens full screen like an app.

## If the phone responds but the Mac doesn't move

This is almost always the Accessibility permission. At startup, the helper nudges the pointer by 1 point and back to check whether macOS is blocking events. If it's blocked, the helper prints a warning and the phone shows a red banner. To fix it:

1. Go to System Settings > Privacy & Security > Accessibility and turn on Terminal. If Terminal isn't listed, click + and add Applications > Utilities > Terminal.
2. Quit Terminal completely with ⌘Q, then double-click `start.command` again. The permission only takes effect after a restart.
3. On the phone, tap the recheck button in the red banner (重新檢查), or reload the page.

Every 3 seconds the helper prints a `received: ...` line that counts the events it got. That tells you whether a problem is on the phone, the network, or the Mac.

## Before typing Chinese (or any IME language)

**Switch the Mac's input source to English (ABC).** Composition happens on the phone, and the Mac only receives finished text. If a Chinese input method is still active on the Mac, it may try to compose the text a second time.

## Using it

The on-screen labels are in Traditional Chinese. The tables below give the label in parentheses where it helps.

### Trackpad gestures (modeled on the Mac trackpad)

| Gesture | What it does |
|---|---|
| One-finger slide | Move the pointer (faster swipes travel farther) |
| One-finger tap | Left click |
| Long press, about 0.5 s | Right click |
| Tap twice, then hold and slide | Drag (select text, move windows) |
| Two-finger tap | Right click |
| Two-finger slide | Scroll, with momentum after you lift, like a Mac |
| Two-finger pinch / spread | Zoom out / in (sends ⌘− / ⌘+) |
| Three-finger swipe left/right | Switch desktop or full-screen app |
| Three-finger swipe up/down | Mission Control / App Exposé |
| Three-finger tap | Look Up (⌃⌘D) |
| Four-finger swipe left/right | Same as three fingers: switch desktop |
| Four-finger spread | Show Desktop (F11) |
| Four-finger pinch | Launchpad (called Apps in macOS 26) |
| ⇅ strip on the right edge | One-handed scrolling |

### Buttons and modes

| Button | What it does |
|---|---|
| ⌘ ⌥ ⌃ ⇧ | Tap once to apply to the next key (cyan). Double-tap to lock (white outline). Tap again to release. |
| Drag lock (拖曳鎖) | Holds the left button down so you can drag across several strokes |
| ◀ Mission ▶ | Desktop to the left, Mission Control, desktop to the right |
| Screenshot (截圖) | ⌃⌘⇧4: capture a selection to the clipboard |
| ⌘ Shortcuts (⌘ 快捷) | Opens a panel of 40+ shortcuts: copy, paste, undo, redo, tabs, back, windows, Spotlight, emoji, lock screen, screenshots, and more |
| ⤢ | Full-screen trackpad: the whole screen becomes a trackpad. Tap ✕ in the top-left corner to leave. |
| Turn the phone sideways | Switches to a MacBook-like layout: a large trackpad on the left, buttons on the right. Tap ⤢ for an edge-to-edge landscape trackpad. Turn off the iPhone's portrait lock first. |
| Type (打字) | Brings up the iPhone keyboard; text goes to the Mac as you type |
| Live / Draft (即時 / 草稿) | In draft mode you finish and review the text on the phone, then tap Send |
| Settings (設定) | Pointer speed, scroll speed, natural scrolling (on by default like macOS; turn it off for classic direction), left-handed layout, haptics |

### What it can't do

- A web page can't generate real Mac trackpad gesture events. Pinch zoom is sent as ⌘+ / ⌘− instead, and Smart Zoom (two-finger double-tap), swiping in from the right edge for Notification Center, and Force Touch aren't possible.
- A two-finger horizontal swipe scrolls sideways in Safari; it won't go back a page the way a real trackpad does. Use ⌘[ in the shortcut panel to go back.

Switching desktops uses the macOS ⌃← / ⌃→ shortcuts. If it does nothing, go to System Settings > Keyboard > Keyboard Shortcuts > Mission Control and make sure "Move left a space" and "Move right a space" are turned on.

## SofaPad.app (v0.3, signed menu bar app)

`macos/` builds SofaPad as a small menu bar app, so you don't need Terminal or `start.command`. macOS gives the Accessibility permission to SofaPad itself, and with a Developer ID certificate the app opens without the malware warning.

Build it on your Mac (needs only the Command Line Tools, not Xcode):
```
./macos/build-app.sh              # build and sign (ad-hoc if you have no Developer ID)
./macos/build-app.sh --notarize   # also notarize and staple
```
For `--notarize`, store your notarization login once (it asks for an app-specific password from appleid.apple.com):
```
xcrun notarytool store-credentials sofapad-notary --apple-id YOUR_APPLE_ID --team-id YOUR_TEAM_ID
```
The result is `dist/SofaPad.app` and a zip. Open it, turn on SofaPad in System Settings > Privacy & Security > Accessibility, and reopen it. The ⌨︎ menu bar icon shows the address and PIN, copies the address, opens the log (`~/Library/Logs/SofaPad.log`), and quits.

## Commands

```
python3 sofapad.py              # start
python3 sofapad.py --new-pin    # generate a new PIN (phones must pair again)
python3 sofapad.py --port 9000  # use a different port
python3 sofapad.py --dry-run    # print events without controlling the Mac (for debugging)
```

The PIN is stored in `~/.sofapad.json`.

## Known limitations

- **The v0.2 gestures haven't been verified on a real Mac yet.** Typing and the mouse from v0.1 have been tested on a real Mac. The v0.2 desktop switching (⌃← / ⌃→), Show Desktop (F11), Launchpad, and the pinch-zoom step have only been tested in dry-run mode on Linux. If you see errors, please open an issue with the Terminal output.
- The connection isn't encrypted. It's meant for your home Wi-Fi, with the PIN keeping others out. Don't expose port 8765 to the internet.
- The page is served over plain http, so iOS won't keep the screen awake. If that bothers you, raise Settings > Display & Brightness > Auto-Lock.
- The pointer can only move within the Mac's screen. It can't reach visionOS apps next to the Mac Virtual Display.
- While typing, the text cursor stays at the end. The iOS space-bar cursor drag doesn't work here; use the arrow keys instead.
- Haptics rely on an iOS 18 Safari switch trick, so whether you feel them depends on your iOS version.

## License

MIT. See [LICENSE](LICENSE).
