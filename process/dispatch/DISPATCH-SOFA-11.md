# DISPATCH SOFA-11: the SofaPad logo in the README

Coordinator: Claude. Dispatched 2026-10-31.

## Owner's request (verbatim)
> 然後把這個Logo Push上red me顯眼的位置然後做得好看一點融合到GitHub red me當中

The owner chose logo direction **01 "Sofa Mode On"** (the sofa's seat cushion is a pill switch turned ON). Put it in a
prominent place in the GitHub README, make it look good and blend in with the page, then it gets pushed.

## Source files
The finished logo is in a private folder outside this repo. The launch prompt gives its path; never write that path
into this repo. It has `svg/` (icon, mark and horizontal lockup in light / dark / mono / reverse) and `png/`.

## Success conditions
1. **Brand assets in the repo**
   - Copy only what the README needs, into `design/brand/`: the horizontal lockup for light and dark backgrounds,
     the icon, and a 1024 px PNG of the icon.
   - Strip any metadata, comments, ids or paths from the SVGs.
   - Add a short `design/brand/README.md`: what each file is, the font name and its OFL license, and the colors.
2. **README header** (`README.md` and `README.zh-TW.md`)
   - A centered hero at the very top: the logo lockup, switching between light and dark versions with GitHub's
     `<picture>` + `prefers-color-scheme`, at a size that reads well on desktop and on the GitHub mobile view.
   - Then a one-line tagline in that language, a small row of badges (latest release, macOS, license), and the
     existing language switch.
   - Use plain GitHub-supported HTML/Markdown only (no scripts, no external CSS). Keep the existing title text for
     search and screen readers: put it in the image alt text, or keep an `<h1>`.
   - The rest of the README stays as it is. All links and images still work.
3. **Social preview image** (optional but recommended)
   - `design/brand/social-preview.png`, 1280×640: the logo plus the tagline, for the repository's social preview.
   - Setting it on GitHub is a repository setting. The owner does that; just say how in the report.
4. **Check the rendering**
   - Render both READMEs as GitHub would: the GitHub markdown API, or a local renderer with GitHub's styles.
   - Screenshot light and dark, desktop and mobile width.
   - Confirm both `<picture>` variants load.
5. **Public check**
   - Scan the diff and every new file (including SVG contents) for local paths, user names, emails, hostnames,
     LAN / VPN addresses and internal IDs.
   - Add a line to `docs/PUBLIC-CHECK.md`.

## Limits (for the writer and its sub-agents)
- Do not push, tag, or change repository settings. Commit locally; the coordinator reviews and pushes.
- No messages, uploads, accounts or payments. New terminals: 0. Sub-agents: at most 1.
- Do not change the app or web icons in this task. That is a separate decision.

## Delivery
- A local commit on `main`.
- Report to the coordinator with: the SHA, screenshot paths, the files added, and the public-check result.
