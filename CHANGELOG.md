# Changelog

[README](README.md) · [繁體中文 README](README.zh-TW.md) · Development records (Chinese): [`process/`](process/)

## 4.5.0 (2026-11-01)

**SofaPad updates itself**, with Sparkle 2.10.0 (MIT, the one dependency, built in by SwiftPM and pinned in
`mac/Package.swift`). It checks at every launch and once a day; 檢查更新… (Check for Updates) in the menu checks now.
Sparkle's window shows the release notes (the English or Chinese half of `docs/release/<version>.md`, by the Mac's
language), downloads, checks the update and installs it, and SofaPad opens again. The feed is `appcast.xml` on the
latest GitHub release; the zip and the feed are both signed with SofaPad's EdDSA key, made with Sparkle's
`generate_keys` and kept in the login Keychain (public half: `tools/sparkle-public-key.txt`), and the app verifies the
zip before unpacking it and refuses a feed changed after signing. Updates are never installed without a click
(`SUAllowsAutomaticUpdates` off: with ad-hoc signing a silent update would also silently drop the Accessibility
permission). While a phone is connected, an update found by a check opens no window, which would take what the phone
types; the menu-bar icon gets a ↑ and the menu offers ⬆︎ 安裝新版本 …. The command-line runs (tests, `--no-ui`) have no
updater.

**The phone page follows the Mac app.** On every connection the Mac's `hello` carries its version and build; when they
differ from the page's, the page reloads itself (`web/js/follow.js`), keeping a Batch draft, and says it was updated.
At most two reloads for the same Mac version (a mark in the address, `?follow=n~version`, so it needs no storage);
then it stops and tells the user to close and reopen the page. The Mac now serves every page file with
`Cache-Control: no-store`, so neither Safari nor a Home Screen web app can keep an old one.

**A versioned protocol** (`docs/PROTOCOL.md`, written for a native iPhone app next to the page). Protocol version 2:
`hello` has `v` and `vmin`, clients send `v` in `pair_request` and `auth`, and the Mac accepts its version and the
previous one (a client without `v` speaks 1, like the 4.4 page). Any other version gets `auth_fail` "protocol" and
close code 4426. The page shows a clear message in English or Chinese, saying whether the Mac or the page needs
updating, logs in only when the versions fit, and looks again every 5 s. The pairing and the security model are
unchanged.

**Releases**: `tools/release.sh <version> [--identity "Developer ID Application: …" --notary-profile NAME]` bumps the
version, runs the tests, builds, signs (ad-hoc unless an identity is given; with one: hardened runtime, notarization,
stapling), packages, signs the zip and writes and signs `appcast.xml`, writes the release notes and prints the
`gh release create` command. It never pushes, tags or publishes. `tools/build-app.sh` embeds and signs Sparkle, takes
`--identity`, and refuses a release build that carries a test switch. The build number (`CFBundleVersion`) is now to
the second. `docs/RELEASING.md`: the release steps, backing up the key, and phase 2 (Developer ID) for the owner.

Tests: Swift `SOFA12Tests` (versions, refusal, no-store, the protocol document names every message); JS
`web/test/follow.test.mjs`; `tools/sofa12-follow.mjs` (the page follows a restarted Mac of another version, nothing from
a cache, the reload limit, both protocol mismatches in both languages, a client speaking 9 turned away, the real 4.4.0
page pairs with 4.5); `tools/sofa12-update-e2e.mjs` (4.5.0 updates itself to a test 4.5.1 through Sparkle's windows on
this Mac, the phone follows, a phone connected keeps the update in the menu, a tampered zip and an edited feed are
refused).

## 4.4.0 (2026-10-31)

**The phone page in English and Chinese.** Every text on the phone, from the key row to the settings, the editors,
pairing, the banners and the screen-reader labels, is in both languages. It opens in the phone's language (Chinese
when the browser's first language is Chinese, English otherwise); ⚙︎ → Language (Auto, English, 中文) changes it at
once, without a reload and without dropping the connection, and the phone remembers it. `<html lang>` follows. The
texts live in two dictionaries, `web/js/lang/en.js` and `web/js/lang/zh.js` (the Chinese one is 4.3.0's wording); a
test fails if a key is missing in either, and another if anything Chinese is left on screen in English.

**Light and dark theme.** ⚙︎ → Theme: System (the default, follows the phone's appearance, also while the page is
open), Light or Dark; applied at once and remembered. The page is drawn in the right theme from its first frame
(`web/js/boot.js` runs before the stylesheet), and the browser bar colour follows; on a Home Screen app the iPhone's
status bar takes the theme the next time the app opens. Colours are CSS custom properties: the light theme on `:root`,
the dark one (4.3.0's colours) under `[data-theme="dark"]`. Every text meets WCAG AA in both themes; the one change
to the dark colours is the filled blue (Send, the selected tab, drag lock on, an armed modifier), a little deeper
(`#2f6fe4`), because white on 4.3.0's `#4f8cff` was 3.2:1.

Nothing else changed: layouts, gestures, typing, dictation, emptying the box after each piece, the cursor pad and the
rows behave as in 4.3.0. The 4.3 suites run as before, with the page in Chinese and dark as they were written for.

Tests: `web/test/i18n.test.mjs` (the dictionaries, no text left in the markup or code, the start-up language and
theme); `tools/sofa10-i18n-theme.mjs` (switching on a live connection, every screen in English with no Chinese left,
the first frame's theme, contrast of every visible text in both themes and languages, screenshots in
`design/screenshots/sofa10/`). The English demo page and recording script quote the phone's English labels now
("Batch" instead of "Whole").

## 4.3.0 (2026-10-30)

**New layout in portrait: the text box takes half the width.** The other half has the cursor pad "◀ 游標 ▶" (wider
than in 4.2, and nearer the middle, so it can be dragged further to the right) and ⏎ to its right. ⏎ sends what is
still waiting, then presses Enter, and the keyboard stays up.

**Everything next to the text box and on the key row can be edited.** "✎ 編輯" has three tabs: the text row (next to
the box, up to 6 cells), the key row, and the landscape panel. Drag ≡ to reorder, ✕ to remove, tap the list to add.
"⇧ 選取" is an ordinary key now: move it or take it out (a second finger tapping during a cursor drag still selects).
The cursor pad is a cell too, so it can go to the key row. "全部恢復預設" restores all three rows. A key row customized
in 4.2 is kept as it was, with ⇧ 選取 in front where 4.2 had it fixed; 4.2's own saved row is left untouched.

**New in landscape: trackpad and side panel.** The trackpad keeps the full height on one side (at least as wide as in
portrait); the side panel has the status, keyboard, drag-lock and settings buttons, the text box with the cursor pad and
⏎, and a grid of keys: the key row plus landscape-only shortcuts (⌘C ⌘V ⌘X ⌘Z ⇧⌘Z ⌘A ⌘Tab, Mission Control, the
desktop to the left / right, screenshot to the clipboard, ⌘S). While typing, the trackpad keeps all the height above
the keyboard (190 px with a 200 px keyboard, 128 px in 4.2). "‹" closes the panel for 4.2's full-screen trackpad; it
comes back while typing. In left-handed mode the panel is on the right.

**New: demo page and recording script.** [`demo/playground.html`](demo/playground.html) is a page for the Mac with
one stage per feature that ticks itself when it sees the feature work, a recording mode and a summary.
[`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md) ([中文](docs/DEMO-SCRIPT.zh-TW.md)) has a 2–3 minute and a 60-second
script. The page is in English by default; `?lang=zh` or its 中文 button switches to Chinese. On the English page the
live-mode sentence is English, made for swipe typing (a word picked wrong is named); dictation counts in Chinese or
English. `?video=1` is a shorter recording version: stages 1, 2, 5, 6 and 7, with only English live typing and
dictation in stage 2.

Tests: `tools/sofa8-layout.mjs` (portrait, editor, conversion from 4.2, landscape, other phone sizes),
`tools/sofa8-playground.mjs` (every stage of the demo page from the phone page through a dry-run Mac), and the 4.2
suites, with the checks about the old landscape layout and the old default key row updated.

**Defaults settled after trying 4.3.0 on an iPhone:** the key row has no ⏎ of its own (it is next to the cursor pad;
add one in "✎ 編輯" if you want it); in portrait, live mode keeps the text box to one line while typing so the trackpad
keeps at least 290 px (batch mode still gets two lines); the landscape panel is on the left, on the right in
left-handed mode. The release zip also has the demo page (`playground.html`) and the recording scripts.

## 4.2.0 (2026-10-29)

**Fixed: old text left in the text box (live mode).** If you finished typing without pressing Enter — clicked a
Mac app's own Send button with the trackpad, tapped elsewhere, switched apps — the words stayed in the phone's box.
The next edit in that box (a tap in the middle of it, iOS's space-bar cursor, a candidate replacing a word) sent
Backspaces and part of the old text again, into whatever window was in front by then. Now a click, a key or shortcut,
a gesture, the cursor pad, closing the keyboard or switching apps ends the piece: what is still waiting goes to the
Mac first, then the box empties. Never in the middle of a Zhuyin / Pinyin composition: then the box empties once the
chosen characters are sent.

**Fixed: typing stuck after Zhuyin was interrupted.** Closing the keyboard in the middle of a composition could leave
the page waiting for a composition end that never came, and nothing more was sent. The page now notices (an input
that is not part of a composition, or 0.3 s after the keyboard closed) and goes on. An acknowledgement that never
arrives no longer holds the typing either: after 3 s the next piece goes anyway.

**Fixed: "Send (送出)" in batch mode while Zhuyin was composing** sent the marked bopomofo (ㄋㄧˇ) and lost the
character. It now waits for the input method to commit, then sends the whole text once.

**New: cursor pad.** "◀ 游標 ▶" next to the text box: hold it for 0.3 s, then drag (the finger may leave it) to move
the Mac's text cursor with the arrow keys (at most 30 presses a second, stops the moment the finger lifts; a quick
flick jumps a word with ⌥←→). "⇧ 選取" on the key row, or a second finger tapping while dragging, selects with
Shift + arrows. It sits in the text box's row, so the trackpad keeps its size while typing. The Mac accepts only
the four arrow keys with Shift and Option from it. iOS's own space-bar cursor only moves inside the phone's text box,
which the Mac never sees.

Tests: `tools/sofa6-commit.mjs` (the same 35 checks: 4.1 passes 16, 4.2 all 35), `tools/sofa6-caret.mjs`,
`web/test/caret.test.mjs`, `mac/Tests/PKMCoreTests/SOFA6Tests.swift`, and `tools/sofa6-textedit.mjs` with real
injection into a TextEdit test window (6 of 6: move, select, replace, word jump, line up).

## 4.1.0 (2026-10-28)

- A phone outside the Mac's local network gets a short page saying why (403, Chinese and English) instead of a blank
  Safari; the menu bar shows the last refused address.
- IPv6 addresses in the Mac's own /64 count as the local network.
- Menu bar switch "允許 Tailscale 裝置" (allow Tailscale devices, 100.64.0.0/10 and fd7a:115c:a1e0::/48), off by
  default; such phones still have to pair.
- When the Mac's IP changes, the QR codes, the menu and the pairing window follow by themselves.

## 4.0.0 (2026-10-28)

First version under the SofaPad name in this repository (was Phone KeyMouse v1–v3, Swift). The voice key is gone;
stale text jumping into the next window and typing lag fixed; one QR code. See [`docs/COMPARISON.md`](docs/COMPARISON.md)
for how it relates to the earlier Python SofaPad (v0.2, in `legacy/`).
