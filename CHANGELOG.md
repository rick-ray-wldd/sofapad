# Changelog

[README](README.md) · [繁體中文 README](README.zh-TW.md) · Development records (Chinese): [`process/`](process/)

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
