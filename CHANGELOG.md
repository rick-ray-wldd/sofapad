# Changelog

[README](README.md) · [繁體中文 README](README.zh-TW.md) · Development records (Chinese): [`process/`](process/)

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
script.

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
