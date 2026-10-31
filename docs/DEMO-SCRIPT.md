# SofaPad demo video script

**English** | [繁體中文](DEMO-SCRIPT.zh-TW.md)

This script goes with the playground, `demo/playground.html`, for recording a demo video of SofaPad 4.3. The order is
the same as the playground's stages:

1 Trackpad → 2 Typing → 3 Box empties after sending → 4 Cursor pad → 5 Shortcuts → 6 Zoom and desktops → 7 The 4.3
layout → Summary

Each stage of the playground checks by itself whether you did it, and lights a green tick when you have. When a whole
stage is done, it shows "✓ Done: …" and a "Next stage →" button. You click that yourself with the phone's trackpad;
the page never moves on by itself.

The page is in English by default. Add `?lang=zh` to the address, or click 「中文」 at the top right, for the
Traditional Chinese page (「EN」 switches back, and progress is kept). This script quotes the English page as it
appears on screen. The phone's SofaPad page is in Chinese: its labels are quoted as they appear, with the English
meaning in brackets.

---

## Opening the playground

In the repo's folder:

```bash
open demo/playground.html
```

The release zip (`SofaPad-4.3.0-macOS.zip`) has a copy too: unzip it and double-click `playground.html` in the folder.

- Open it in a browser on the Mac (Safari or Chrome). No network and no server needed.
- **Language**: English by default; `?lang=zh`, or the 「中文」 button at the top right, gives the Chinese page.
  The phone page follows the phone's language (4.4); for the English video, set the phone to English or pick
  English in ⚙︎ → Language, so the labels on the phone match the ones quoted here.
- **Recording mode**: click "Recording mode" at the top right, or add `?rec=1` to the end of the address,
  for example `file:///…/demo/playground.html?rec=1`. Recording mode:
  - hides each stage's small how-to text and the footer;
  - makes the headline, the ticks and the "done" banner bigger;
  - shows "SofaPad demo · Stage N" at the top left.
- **Recording version**: `?video=1` gives a shorter run with five stages; see "Recording version" below.
- The settings combine, for example `playground.html?lang=zh&rec=1#stage=3`, and the buttons keep the others in the
  address.
- **Jump to a stage**: add `#stage=3` to the address (1–7, or `#stage=summary` for the summary), or click 1–7 at the
  top.
- "Restart" clears all progress and goes back to stage 1. Once there is progress you click it twice (the first
  click turns it into "Really restart?").
- The playground collects nothing: no network, nothing saved, all gone when you close it.
- Make the window at least 1280×800. Full screen (⌃⌘F) is best, with the browser zoom at 100% (⌘0).

---

## What 4.3 looks like on the phone

Narration and captions should describe it this way.

### Portrait

- The text box is about half the phone's width.
- The right half holds "◀ Cursor ▶" (the cursor pad) and ⏎ (Enter). By default ⏎ is fixed to the right of the cursor
  pad.
  - Cursor pad: hold for about 0.3 s (the phone gives a short buzz), then drag; the Mac's text cursor follows with the
    arrow keys. A quick flick jumps one word.
- Below it is the key row:
  - first "Live / Batch" and "⌘ Shortcuts";
  - then "⇧ Select", now an ordinary key that can be moved or removed;
  - then esc, tab, ⌫, the arrows, ⌘ ⌥ ⌃ ⇧, space, ⌦;
  - last, "✎ Edit".
- "✎ Edit" opens an editor with three tabs, "Text row | Key row | Landscape panel":
  - drag ≡ to reorder;
  - ✕ to remove;
  - tap an item in the list below to add it;
  - "Restore all defaults" (all three rows).
- Even with "⇧ Select" removed, a second finger tapping during a cursor-pad drag still selects.

### Landscape

- A side panel on one side that can collapse. Right-handed, it is on the left; in "Left-handed mode" it is on
  the right.
- In the panel:
  - a slim top row: connection status, keyboard, drag lock "Lock", settings ⚙, collapse ‹;
  - the text box + cursor pad + ⏎;
  - below, a grid of keys: the key row's keys, plus shortcuts only shown in landscape, such as ⌘C ⌘V ⌘X ⌘Z ⌘A ⌘Tab,
    Mission Control, ⌃← ⌃→.
- The trackpad takes the other side, full height.
- Collapsing the panel gives a full-screen trackpad; the › among the floating buttons opens the panel again.

### Other features to show

- **Live mode**: the text appears on the Mac as you type; the iPhone's English keyboard can swipe (slide to type);
  Zhuyin is sent only after you pick the characters; dictation does not double the text.
- **Batch mode + Send**: type and fix it on the phone first, then press "Send" to send it in one go.
- **The box empties after sending** (since 4.2): when a piece ends (a trackpad click, a key, a gesture, the cursor pad,
  closing the keyboard), the text box empties, so old text is never sent again.
- **Gestures**:
  - two-finger tap = right click; two-finger swipe up/down = scroll; two-finger spread / pinch = ⌘= / ⌘−;
  - three fingers left/right = switch desktop; up/down = Mission Control / App Exposé;
  - long-press then drag = drag; "Drag lock" ("Lock" in landscape) = drag lock;
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
  - at the start, click the playground's "Restart" with the phone's trackpad: the Mac's screen goes dark for a moment
    and shows "Start"; at that same moment the phone's recording shows the trackpad tap.
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
- [ ] Click "Restart" in the playground to start at stage 1; turn on "Recording mode" if you want it.

---

## Full version (about 2 min 50 s)

After each stage, click "Next stage →" (with the phone's trackpad).

### Scene 0: Opening

| | |
|---|---|
| Time | 0:00–0:08 (8 s) |
| What the phone does | Open SofaPad from the Home Screen; green dot at the top left. Click the playground's "Restart" with the trackpad. |
| What the Mac shows | The screen goes dark for a moment with "Start", then stage 1, "Now showing: Trackpad". |
| Narration | "SofaPad turns your iPhone into the Mac's keyboard and trackpad. No app to install, and it only uses your home Wi-Fi." |

### Scene 1: Trackpad

| | |
|---|---|
| Time | 0:08–0:33 (25 s) |
| What the phone does | Slide one finger; tap "Click me"; two-finger tap on "Right-click here", then tap "👍 Like"; move the pointer onto the list and swipe down with two fingers to the end; long-press about half a second until "Dragging" shows, and drag the blue block into the blue box; press "Drag lock", drag the orange block into the orange box (in several strokes if you like), and press it again to let go. |
| What the Mac shows | The bar fills to 600 px; the button turns green, "Got it ✓"; a custom menu pops up; the list scrolls to "Item 40: the end"; both blocks land in their boxes. Six green ticks on the right, and "✓ Done: Trackpad" at the bottom. |
| Narration | "Move, click, right-click, scroll, drag: whatever the Mac's trackpad does, the phone does." |

### Scene 2: Typing

| | |
|---|---|
| Time | 0:33–1:00 (27 s) |
| What the phone does | Click box ①, and in Live mode type "I can type from the sofa with my phone" with the iPhone's English keyboard; you can swipe each word. Click box ②, switch to "Batch", type "Type it all, then send it at once" and press "Send". Switch back to "Live", click box ③ and type 「沙發上也能打中文」 (you can type Chinese from the sofa too) with Zhuyin. Click box ④, press the keyboard's 🎤 and say "It is a nice day, let's go for a walk in the park", then pause. |
| What the Mac shows | ① turns green word by word; a word swiped wrong turns red and the page names it (for example word 3 is "tyre", should be "type"): delete it and swipe again. ② shows "… characters arrived within half a second ✓"; ③ shows "Correct ✓ no Zhuyin symbols showed up"; ④ shows "Nothing doubled ✓". |
| Narration | "Type with the phone's own keyboard: swipe in English, Zhuyin sends only the characters you pick, and dictation does not double up." |

On the Chinese page (`?lang=zh`), ① asks for 「SofaPad 讓 iPhone 變成 Mac 的鍵盤」, checked character by character,
and ② for 「整段打好再一次送出」.

### Scene 3: The box empties after sending

| | |
|---|---|
| Time | 1:00–1:18 (18 s) |
| What the phone does | Click the chat's input box and type "Good morning, meeting today". Do not press Enter; click "Send" with the trackpad. Then type "Got it, on my way" and click "Send" again. |
| What the Mac shows | Two messages; the second is only "Got it, on my way". On the right: "Nothing left over from the first message ✓". |
| Narration | "Click Send, and the phone's text box empties, so the next sentence never carries the last one with it." |

### Scene 4: Cursor pad

| | |
|---|---|
| Time | 1:18–1:38 (20 s) |
| What the phone does | Click into the sentence "SofaPad turns your iPhone into a keyboard and trackpda." with the trackpad. Hold "◀ Cursor ▶" (the cursor pad) about 0.3 s (short buzz), then drag left to the typo "trackpda"; flick once to jump a word. Press "⇧ Select" and drag two steps to select "da" (or tap with a second finger while dragging). Type "ad". |
| What the Mac shows | The bottom right shows the keys sent: ←, ⌥←, ⇧←; below the text, "Selected: da"; the typo becomes "trackpad", four green ticks. The ⇧ Select tick needs exactly "da" selected. |
| Narration | "The cursor pad moves the Mac's text cursor directly; fixing a typo needs no mouse." |

### Scene 5: Shortcuts

| | |
|---|---|
| Time | 1:38–1:58 (20 s) |
| What the phone does | Click the top sentence, "SofaPad is handy". Open the panel with "⌘ Shortcuts": ⌘A, ⌘C. Click the empty box below: ⌘V. Then ⌘Z. Then press the panel's ⌃⇧⌘4, select an area of the screen with a long-press drag, and press ⌘V. |
| What the Mac shows | The bottom right shows ⌘A, ⌘C, ⌘V, ⌘Z; the text is pasted into the box below and undone again; the screenshot appears in "Screenshot paste area". |
| Narration | "Everyday shortcuts are one tap away, and a screenshot pastes straight in." |

### Scene 6: Zoom and desktops

| | |
|---|---|
| Time | 1:58–2:18 (20 s) |
| What the phone does | Spread two fingers, then pinch. Swipe three fingers left to go to another desktop, then right to come back. Swipe three fingers up for Mission Control, then down to come back. Click "Mission Control appeared (tick by hand)" with the trackpad. |
| What the Mac shows | The sofa picture zooms in and out, and the percentage at its top right follows; the whole desktop slides away and back, and the page shows "Away for … s, then back ✓"; Mission Control opens and closes. |
| Narration | "Pinch to zoom, three fingers to switch desktops, Mission Control: the gestures are the same as on the Mac's trackpad." |

### Scene 7: The 4.3 layout

| | |
|---|---|
| Time | 2:18–2:42 (24 s) |
| What the phone does | Hold the phone upright, screen to the camera: the half-width text box on the left, the cursor pad and ⏎ on the right. Click the playground's box, type a line, press the ⏎ next to the cursor pad. Press "✎ Edit", drag a key by its ≡ to another place, close it. Turn the phone sideways: side panel on the left, full-height trackpad on the right; press ‹ to collapse it into a full-screen trackpad, then › to open it. Finally click the playground's three manual ticks on the right with the trackpad. |
| What the Mac shows | The line appears in the chat box and "Type a line, press the ⏎ next to the cursor pad" is ticked; the three manual items turn green and "✓ Done: The 4.3 layout" appears. |
| Narration | "The 4.3 layout: upright, type and move the cursor with one hand; sideways, a side panel with more shortcuts." |

### Scene 8: Summary

| | |
|---|---|
| Time | 2:42–2:50 (8 s) |
| What the phone does | Click "See summary →". |
| What the Mac shows | A big "30 / 30 done", and the time each item was done, automatic and manual marked apart. |
| Narration | "All done. SofaPad is open source; the link is in the description." |

---

## Recording version (`?video=1`)

A shorter run of the playground for a short video, made for recording on Vision Pro. Turn it on with `?video=1`
(it combines with the other settings, for example `playground.html?video=1&rec=1`), or open a copy of the page whose
`<meta name="playground-mode">` says `video`, which opens in this version with a double-click; `?video=0` goes back
to the full version.

- Five stages, numbered 1–5 on screen (the top bar, the recording badge "SofaPad demo · Stage N" and the summary):
  1 Trackpad → 2 Typing → 3 Shortcuts → 4 Zoom and desktops → 5 The 4.3 layout → Summary. "Box empties after sending"
  and "Cursor pad" are left out.
- Stage 2 has two boxes: ① Live, with "I can type from the sofa with my phone" (on the Chinese page too), and
  ② dictation.
- The summary counts only these stages: 21 items.
- `#stage=` still takes the full version's numbers: `#stage=5` opens Shortcuts, shown as stage 3.

Do each stage as in the full version's scene of the same name.

| Time | Stage on screen | Scene to follow | What the Mac shows at the end |
|---|---|---|---|
| 0:00–0:08 | Opening | Scene 0 | "Start", then stage 1 |
| 0:08–0:33 | 1 Trackpad | Scene 1 | "✓ Done: Trackpad" |
| 0:33–0:51 | 2 Typing | Scene 2, boxes ① and ② only: swipe "I can type from the sofa with my phone", then dictate a sentence | "✓ Done: Typing" |
| 0:51–1:11 | 3 Shortcuts | Scene 5 | "✓ Done: Shortcuts" |
| 1:11–1:31 | 4 Zoom and desktops | Scene 6 | "✓ Done: Zoom and desktops" |
| 1:31–1:55 | 5 The 4.3 layout | Scene 7 | "✓ Done: The 4.3 layout", then "See summary →" |
| 1:55–2:03 | Summary | Scene 8 | "21 / 21 done" |

---

## 60-second highlights

You do not need to finish every stage: jump with 1–7 at the top. You can also cut it from the full version. (The
recording version above leaves out stages 3 and 4, which this cut uses.)

| Time | What the phone does | What the Mac shows | Narration |
|---|---|---|---|
| 0:00–0:05 | Open SofaPad, green dot; click "Restart" | "Start", stage 1 | "The iPhone becomes the Mac's keyboard and trackpad." |
| 0:05–0:15 | Slide one finger, tap "Click me", two-finger tap for a right click, long-press and drag the blue block into its box | Green ticks light up one by one | "Whatever the Mac's trackpad does, the phone does." |
| 0:15–0:27 | Stage 2: swipe the sentence in Live mode; dictate one with 🎤 | The text appears as you type; "Nothing doubled ✓" | "The phone's own keyboard: swiping and dictation both work." |
| 0:27–0:35 | Stage 3: type a sentence, click "Send"; type another, click "Send" | "Nothing left over from the first message ✓" | "The text box empties after sending." |
| 0:35–0:43 | Stage 4: drag the cursor pad to the typo, "⇧ Select", type "ad" | "trackpda" becomes "trackpad" | "The cursor pad moves the Mac's text cursor directly." |
| 0:43–0:50 | Stage 6: pinch; three fingers to another desktop and back | The picture zooms; the desktop slides away and back | "Pinch, three fingers: the same gestures." |
| 0:50–0:57 | Show the cursor pad and ⏎ upright, then the side panel sideways | Stage 7 | "The 4.3 layout works upright and sideways." |
| 0:57–1:00 | Click "Summary" | The count and the times | "SofaPad: use your Mac from the sofa." |

---

## Tips while recording

- The three-finger swipe does nothing: make sure there is a second desktop and that the shortcuts in the checklist
  are on.
- The browser zoomed the whole page: press ⌘0 to undo. The playground still counts the zoom in / zoom out.
- Stuck on a stage: click a number at the top to skip it, or come back later; "Restart" clears all progress.
- Stage 3 shows red "Leftover found": click "Clear and retry" to redo just that stage.
- After ⌃⇧⌘4 the pointer becomes a crosshair: select with a long-press drag; press esc to cancel.
- Recording mode hides the small how-to text; turn recording mode off when you need it.
