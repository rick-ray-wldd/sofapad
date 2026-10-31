# DISPATCH SOFA-10: phone web UI in English and Chinese, light and dark theme (4.4.0)

Coordinator: Claude. Dispatched 2026-10-31.

## Owner's request (verbatim)
> 然後我剛剛才發現收發Pad的瀏覽器沒有英文版的介面，請幫我完整的執行讓使用者可以切換中英文介面還有也可以選擇切換深色與淺色的主題完整做好之後打包Push到github

In short: the phone web UI (`web/`, opened in the iPhone browser) is Chinese only. Add an English UI with a
Chinese/English switch, and a light/dark theme switch. Finish it completely, package it, and it gets pushed to GitHub.

## Success conditions
1. **Language**
   - Every user-visible string in `web/` has English and Traditional Chinese versions. This covers:
     - all text, buttons and labels: the key row, the text row and the landscape panel;
     - the ✎ editor and its three tabs, settings ⚙, the pairing / connection states, toasts and errors;
     - the shortcuts panel, empty states, and the `title` / `aria-label` / `placeholder` texts.
   - Default: the browser's language (`zh*` → Chinese, otherwise English). The user can switch in settings ⚙.
   - The choice is remembered on the phone (localStorage, wrapped in try/catch) and applies immediately, without a
     reload and without dropping the connection.
   - `<html lang>` follows the choice.
   - Strings live in one dictionary per language; no hard-coded UI text left in markup or JS.
   - A test fails if a key is missing in either language, or if Chinese characters remain on screen in English mode.
2. **Theme**
   - Options: System (default, follows `prefers-color-scheme`), Light, Dark. Switch in settings ⚙. Remembered and
     applied immediately; no flash of the wrong theme on load.
   - Colors are tokens (CSS custom properties) on `:root`, overridden for dark.
   - Both themes are legible: WCAG AA contrast for text and key labels. The trackpad, cursor pad, sidebar and editor
     all look intentional in both themes.
   - `theme-color` / status-bar color follows the theme.
3. **Nothing else changes**: layouts, gestures, typing, dictation, send-and-clear, the cursor pad and key-row
   behavior stay exactly as in 4.3.0. All existing tests keep passing (Swift, JS, self-test, e2e).
4. **Evidence**
   - Screenshots for every combination: English / Chinese × light / dark × portrait / landscape, plus the settings
     sheet open, in an iPhone-size viewport.
   - Test counts before and after.
   - A short screen recording of switching language and theme on a live connection, ≥ 50 fps.
5. **Release 4.4.0**
   - Bump `VERSION`, `web/js/version.js` and `BuildInfo.swift`. Update `CHANGELOG.md`, `README.md`,
     `README.zh-TW.md` and `docs/INSTALL.md` where the UI is described.
   - Build the package with the existing `tools/package.sh` → `dist/release/SofaPad-4.4.0-macOS.zip` + `.sha256`.
   - Release notes in English and Chinese.
6. **Public check** (this repo is public)
   - Before committing, scan the diff and the package for:
     - local paths and user names; hostnames; LAN / VPN addresses (including 100.64.0.0/10);
     - emails; tokens; pairing codes;
     - IDs from the owner's assistant system.
   - Record the scan in `docs/PUBLIC-CHECK.md` (add a 4.4.0 row).

## Limits (for the writer and its sub-agents)
- **Do not push, tag, or create a GitHub release.** Commit locally only. The coordinator reviews, then pushes and
  publishes the release.
- No new accounts, no payments, no messages to anyone, no uploads anywhere.
- New terminals: 0. Sub-agents: at most 2 at a time.
- Do not change the Mac app's pairing protocol or security model.

## Delivery
- Local commit(s) on `main` with the work above, tests green, the package built.
- `process/` records updated as in earlier dispatches.
- Report to the coordinator with: the commit SHA, test counts, screenshot paths, package path + sha256, and the
  public-check result.
