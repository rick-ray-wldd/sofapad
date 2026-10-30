# SofaPad demo video script

**English** | [繁體中文](DEMO-SCRIPT.zh-TW.md)

This script goes with the playground, `demo/playground.html`, for recording a demo video of SofaPad 4.3. The order is
the same as the playground's stages:

1 Trackpad → 2 Typing → 3 Box empties after sending → 4 Cursor pad → 5 Shortcuts → 6 Zoom and desktops → 7 The 4.3
layout → Summary

Each stage of the playground checks by itself whether you did it, and lights a green tick when you have. When a whole
stage is done, it shows 「✓ 完成：○○」 (Done: …) and a 「下一關 →」 (Next stage) button. You click that yourself with
the phone's trackpad; the page never moves on by itself.

The page's text is in Traditional Chinese. This script quotes it as it appears on screen, with the English meaning in
brackets.

---

## Opening the playground

In the repo's folder:

```bash
open demo/playground.html
```

The release zip (`SofaPad-4.3.0-macOS.zip`) has a copy too: unzip it and double-click `playground.html` in the folder.

- Open it in a browser on the Mac (Safari or Chrome). No network and no server needed.
- **Recording mode**: click 「錄影模式」 (Recording mode) at the top right, or add `?rec=1` to the end of the address,
  for example `file:///…/demo/playground.html?rec=1`. Recording mode:
  - hides each stage's small how-to text and the footer;
  - makes the headline, the ticks and the "done" banner bigger;
  - shows 「SofaPad 示範 · 第 N 關」 (SofaPad demo · stage N) at the top left.
- **Jump to a stage**: add `#stage=3` to the address (1–7, or `#stage=summary` for the summary), or click 1–7 at the
  top.
- 「重來」 (Restart) clears all progress and goes back to stage 1. Once there is progress you click it twice (the first
  click turns it into 「確定重來？」, "Restart for sure?").
- The playground collects nothing: no network, nothing saved, all gone when you close it.
- Make the window at least 1280×800. Full screen (⌃⌘F) is best, with the browser zoom at 100% (⌘0).

---

## What 4.3 looks like on the phone

Narration and captions should describe it this way.

### Portrait

- The text box is about half the phone's width.
- The right half holds 「◀ 游標 ▶」 (the cursor pad) and ⏎ (Enter). By default ⏎ is fixed to the right of the cursor
  pad.
  - Cursor pad: hold for about 0.3 s (the phone gives a short buzz), then drag; the Mac's text cursor follows with the
    arrow keys. A quick flick jumps one word.
- Below it is the key row:
  - first 「即時／整段」 (Live / Whole) and 「⌘ 快捷鍵」 (⌘ Shortcuts);
  - then 「⇧ 選取」 (⇧ Select), now an ordinary key that can be moved or removed;
  - then esc, tab, ⌫, the arrows, ⌘ ⌥ ⌃ ⇧, space, ⌦;
  - last, 「✎ 編輯」 (✎ Edit).
- 「✎ 編輯」 opens an editor with three tabs, 「輸入列｜按鍵列｜橫拿側欄」 (Input row | Key row | Landscape panel):
  - drag ≡ to reorder;
  - ✕ to remove;
  - tap an item in the list below to add it;
  - 「全部恢復預設」 (Restore all defaults: all three rows).
- Even with 「⇧ 選取」 removed, a second finger tapping during a cursor-pad drag still selects.

### Landscape

- A side panel on one side that can collapse. Right-handed, it is on the left; in 「左手模式」 (left-hand mode) it is on
  the right.
- In the panel:
  - a slim top row: connection status, keyboard, drag lock 「鎖」 (Lock), settings ⚙, collapse ‹;
  - the text box + cursor pad + ⏎;
  - below, a grid of keys: the key row's keys, plus shortcuts only shown in landscape, such as ⌘C ⌘V ⌘X ⌘Z ⌘A ⌘Tab,
    Mission Control, ⌃← ⌃→.
- The trackpad takes the other side, full height.
- Collapsing the panel gives a full-screen trackpad; the › among the floating buttons opens the panel again.

### Other features to show

- **Live mode**: the text appears on the Mac as you type; Zhuyin is sent only after you pick the characters; dictation
  does not double the text.
- **Whole mode + 送出 (Send)**: type and fix it on the phone first, then press 「送出」 to send it in one go.
- **The box empties after sending** (since 4.2): when a piece ends (a trackpad click, a key, a gesture, the cursor pad,
  closing the keyboard), the text box empties, so old text is never sent again.
- **Gestures**:
  - two-finger tap = right click; two-finger swipe up/down = scroll; two-finger spread / pinch = ⌘= / ⌘−;
  - three fingers left/right = switch desktop; up/down = Mission Control / App Exposé;
  - long-press then drag = drag; 「鎖」 = drag lock;
  - the thin strip on the right edge = one-thumb scroll.
- **Shortcuts panel**: including the screenshot-to-clipboard shortcut ⌃⇧⌘4.

---

## Recording setup

Two ways to film it; pick one.

**A. One camera over the shoulder**: the phone and the Mac's screen both in frame. You can see the fingers, which is
the most natural.

- Focus on the phone; set the Mac's screen brightness so it does not blow out.
- Watch for reflections. Filming a screen directly can show moiré; shoot at a slight angle or from a bit further back.

**B. Split screen** (the clearest picture):

- **Mac**: ⌘⇧5 → "Record Entire Screen" or "Record Selected Portion" (frame the browser) → "Record". To stop, click the
  stop button in the menu bar.
- **iPhone**: Control Center → "Screen Recording".
- **Combine**: put them side by side in a video editor, for example the Mac on the left and the phone on the right.
- **Syncing the two recordings**:
  - clap once at the start (when both recordings have sound); or
  - at the start, click the playground's 「重來」 with the phone's trackpad: the Mac's screen goes dark for a moment and
    shows 「開始」 (Start); at that same moment the phone's recording shows the trackpad tap.
- An iPhone screen recording does not show your fingers. For long-press, two-finger and three-finger moves, film the
  hand with a camera as well, or say what you do in the narration.
- When you turn the phone to landscape, the phone's recording turns too; rotate it back or change the layout when
  editing.

---

## Checklist before recording

- [ ] Mac: Do Not Disturb on, notifications off.
- [ ] iPhone: Do Not Disturb on, silent mode on.
- [ ] A clean desktop: only the playground open; private windows, chats and mail closed; files on the desktop put
      away.
- [ ] A second desktop ready (the "+" at the top of Mission Control), so the three-finger swipe has somewhere to go.
- [ ] System Settings → Keyboard → Keyboard Shortcuts… → Mission Control: tick "Mission Control", "Application
      windows", "Move left a space" and "Move right a space".
- [ ] Phone brightness up; Auto-Lock set longer (Settings → Display & Brightness → Auto-Lock).
- [ ] Enough battery on both, or both plugged in.
- [ ] Phone and Mac on the same Wi-Fi.
- [ ] Mac unlocked (while it is locked, the phone's input is paused).
- [ ] SofaPad has the Accessibility permission; the phone shows a green dot at the top left.
- [ ] Phone and Mac both on 4.3.0 (the top line of ⚙︎ on the phone).
- [ ] Suggested: the Mac on the English (ABC) input source; type Chinese with the phone's Zhuyin.
- [ ] The screenshot step uses the clipboard: do not include anything private in the area you select.
- [ ] Click 「重來」 in the playground to start at stage 1; turn on 「錄影模式」 if you want it.

---

## Full version (about 2 min 50 s)

After each stage, click 「下一關 →」 (with the phone's trackpad).

### Scene 0: Opening

| | |
|---|---|
| Time | 0:00–0:08 (8 s) |
| What the phone does | Open SofaPad from the Home Screen; green dot at the top left. Click the playground's 「重來」 with the trackpad. |
| What the Mac shows | The screen goes dark for a moment with 「開始」 (Start), then stage 1, 「現在示範：觸控板」 (Now showing: Trackpad). |
| Narration | "SofaPad turns your iPhone into the Mac's keyboard and trackpad. No app to install, and it only uses your home Wi-Fi." |

### Scene 1: Trackpad

| | |
|---|---|
| Time | 0:08–0:33 (25 s) |
| What the phone does | Slide one finger; tap 「點我」 (Click me); two-finger tap on 「在這裡按右鍵」 (Right-click here), then tap 「👍 讚」 (Like); move the pointer onto the list and swipe down with two fingers to the end; long-press about half a second until 「拖曳中」 (Dragging) shows, and drag the blue block into the blue box; press 「鎖」 (Lock), drag the orange block into the orange box (in several strokes if you like), and press 「鎖」 again to let go. |
| What the Mac shows | The bar fills to 600 px; the button turns green, 「點到了 ✓」 (Got it); a custom menu pops up; the list scrolls to 「第 40 項：到底了」 (Item 40: the end); both blocks land in their boxes. Six green ticks on the right, and 「✓ 完成：觸控板」 (Done: Trackpad) at the bottom. |
| Narration | "Move, click, right-click, scroll, drag: whatever the Mac's trackpad does, the phone does." |

### Scene 2: Typing

| | |
|---|---|
| Time | 0:33–1:00 (27 s) |
| What the phone does | Click box ①, and in Live mode type 「SofaPad 讓 iPhone 變成 Mac 的鍵盤」 (SofaPad turns the iPhone into the Mac's keyboard). Click box ②, switch to 「整段」 (Whole), type 「整段打好再一次送出」 (type it all, then send once) and press 「送出」 (Send). Switch back to 「即時」 (Live), click box ③ and type 「沙發上也能打中文」 (you can type Chinese from the sofa too) with Zhuyin. Click box ④, press the keyboard's 🎤 and say 「今天天氣很好，我們去公園散步」 (the weather is nice today, let's walk in the park), then pause. |
| What the Mac shows | The target sentences turn green character by character; ② shows 「半秒內送進 9 個字 ✓」 (9 characters within half a second); ③ shows 「沒有出現注音符號」 (no Zhuyin symbols showed up); ④ shows 「沒有疊字 ✓」 (no doubled text). |
| Narration | "Type with the phone's own keyboard: Zhuyin sends only the characters you pick, and dictation does not double up." |

### Scene 3: The box empties after sending

| | |
|---|---|
| Time | 1:00–1:18 (18 s) |
| What the phone does | Click the chat's input box and type 「早安，今天開會」 (Morning, meeting today). Do not press Enter; click 「傳送」 (Send) with the trackpad. Then type 「收到，馬上到」 (Got it, on my way) and click 「傳送」 again. |
| What the Mac shows | Two messages; the second is only 「收到，馬上到」. On the right: 「前一句沒有殘留 ✓」 (nothing left over from the first sentence). |
| Narration | "Click Send, and the phone's text box empties, so the next sentence never carries the last one with it." |

### Scene 4: Cursor pad

| | |
|---|---|
| Time | 1:18–1:38 (20 s) |
| What the phone does | Click into the sentence with the trackpad. Hold 「◀ 游標 ▶」 about 0.3 s (short buzz), then drag left to the typo 「觸空板」; flick once to jump a word. Press 「⇧ 選取」 and drag one step to select 「空」 (or tap with a second finger while dragging). Type 「控」. |
| What the Mac shows | The bottom right shows the keys sent: ←, ⌥←, ⇧←; below the text, 「選取中：空」 (Selected: 空); the typo becomes 「觸控板」 (trackpad), four green ticks. |
| Narration | "The cursor pad moves the Mac's text cursor directly; fixing a typo needs no mouse." |

### Scene 5: Shortcuts

| | |
|---|---|
| Time | 1:38–1:58 (20 s) |
| What the phone does | Click the top sentence, 「SofaPad 很好用」 (SofaPad is handy). Open the panel with 「⌘ 快捷鍵」: ⌘A, ⌘C. Click the empty box below: ⌘V. Then ⌘Z. Then press the panel's ⌃⇧⌘4, select an area of the screen with a long-press drag, and press ⌘V. |
| What the Mac shows | The bottom right shows ⌘A, ⌘C, ⌘V, ⌘Z; the text is pasted into the box below and undone again; the screenshot appears in 「截圖貼上區」 (screenshot paste area). |
| Narration | "Everyday shortcuts are one tap away, and a screenshot pastes straight in." |

### Scene 6: Zoom and desktops

| | |
|---|---|
| Time | 1:58–2:18 (20 s) |
| What the phone does | Spread two fingers, then pinch. Swipe three fingers left to go to another desktop, then right to come back. Swipe three fingers up for Mission Control, then down to come back. Click 「Mission Control 有出現（手動打勾）」 (Mission Control appeared (tick by hand)) with the trackpad. |
| What the Mac shows | The sofa picture zooms in and out, and the percentage at its top right follows; the whole desktop slides away and back, and the page shows 「離開了 … 秒，又回來了 ✓」 (left for … s, came back); Mission Control opens and closes. |
| Narration | "Pinch to zoom, three fingers to switch desktops, Mission Control: the gestures are the same as on the Mac's trackpad." |

### Scene 7: The 4.3 layout

| | |
|---|---|
| Time | 2:18–2:42 (24 s) |
| What the phone does | Hold the phone upright, screen to the camera: the half-width text box on the left, the cursor pad and ⏎ on the right. Click the playground's box, type a line, press the ⏎ next to the cursor pad. Press 「✎ 編輯」, drag a key by its ≡ to another place, close it. Turn the phone sideways: side panel on the left, full-height trackpad on the right; press ‹ to collapse it into a full-screen trackpad, then › to open it. Finally click the playground's three manual ticks on the right with the trackpad. |
| What the Mac shows | The line appears in the chat box and 「⏎ 送出」 (⏎ send) is ticked; the three manual items turn green and 「✓ 完成：4.3 新排版」 (Done: the 4.3 layout) appears. |
| Narration | "The 4.3 layout: upright, type and move the cursor with one hand; sideways, a side panel with more shortcuts." |

### Scene 8: Summary

| | |
|---|---|
| Time | 2:42–2:50 (8 s) |
| What the phone does | Click 「看總表 →」 (See summary). |
| What the Mac shows | A big 「30 / 30 完成」 (30 / 30 done), and the time each item was done, automatic and manual marked apart. |
| Narration | "All done. SofaPad is open source; the link is in the description." |

---

## 60-second highlights

You do not need to finish every stage: jump with 1–7 at the top. You can also cut it from the full version.

| Time | What the phone does | What the Mac shows | Narration |
|---|---|---|---|
| 0:00–0:05 | Open SofaPad, green dot; click 「重來」 | 「開始」, stage 1 | "The iPhone becomes the Mac's keyboard and trackpad." |
| 0:05–0:15 | Slide one finger, tap 「點我」, two-finger tap for a right click, long-press and drag the blue block into its box | Green ticks light up one by one | "Whatever the Mac's trackpad does, the phone does." |
| 0:15–0:27 | Stage 2: type a sentence in Live mode; dictate one with 🎤 | The text appears as you type; 「沒有疊字 ✓」 | "The phone's own keyboard: Zhuyin and dictation both work." |
| 0:27–0:35 | Stage 3: type a sentence, click 「傳送」; type another, click 「傳送」 | 「前一句沒有殘留 ✓」 | "The text box empties after sending." |
| 0:35–0:43 | Stage 4: drag the cursor pad to the typo, 「⇧ 選取」, type 「控」 | 「觸空板」 becomes 「觸控板」 | "The cursor pad moves the Mac's text cursor directly." |
| 0:43–0:50 | Stage 6: pinch; three fingers to another desktop and back | The picture zooms; the desktop slides away and back | "Pinch, three fingers: the same gestures." |
| 0:50–0:57 | Show the cursor pad and ⏎ upright, then the side panel sideways | Stage 7 | "The 4.3 layout works upright and sideways." |
| 0:57–1:00 | Click 「總表」 (Summary) | The count and the times | "SofaPad: use your Mac from the sofa." |

---

## Tips while recording

- The three-finger swipe does nothing: make sure there is a second desktop and that the shortcuts in the checklist
  are on.
- The browser zoomed the whole page: press ⌘0 to undo. The playground still counts the zoom in / zoom out.
- Stuck on a stage: click a number at the top to skip it, or come back later; 「重來」 clears all progress.
- Stage 3 shows red 「有殘留」 (left over): click 「清空重試」 (Clear and retry) to redo just that stage.
- After ⌃⇧⌘4 the pointer becomes a crosshair: select with a long-press drag; press esc to cancel.
- Recording mode hides the small how-to text; turn recording mode off when you need it.
