# DISPATCH SOFA-12: SofaPad 4.5 (in-app auto-update, release script, phone page follows the Mac version)

Coordinator: Claude. Dispatched 2026-11-01.

## Owner's request (verbatim)
> 然後我要如何讓sofa pad 像是orca這樣可以下載後自動更新以及同步手機網頁版以及未來預計使用的app版（如果推廣效果好的話

> 做 4.5

The coordinator proposed this plan and the owner approved it with "做 4.5":
- **Phase 1 (now, no cost):**
  - a versioned Mac ↔ phone protocol;
  - the phone page reloads itself when the Mac's version changes;
  - in-app auto-update on the Mac;
  - a one-command release script.

  Run all of it end to end with test signing.
- **Phase 2 (after the owner sets up signing on this Mac):** Developer ID signing and Apple notarization, wired into the
  same release script.
- A native iPhone app may come later. Design the protocol so a native client can use it next to the web page.

## Success conditions
1. **Versioned protocol**
   - A protocol version (an integer, separate from the app version) is announced by the Mac in the WebSocket handshake.
   - The phone page states which protocol versions it supports.
   - The Mac accepts the current version and the previous one.
   - When they don't match, the phone shows a clear message in both languages, not a silent failure.
   - Document it in `docs/PROTOCOL.md`, written so a future native client can implement it.
2. **Phone page follows the Mac**
   - When the Mac's app version changes, an open phone page detects it and reloads itself. This includes the Home Screen
     web app; check for cached assets.
   - No reload loops.
   - The version shown on the phone matches the Mac.
3. **Auto-update on the Mac**
   - Use the Sparkle framework (official project, MIT; add it with SwiftPM) unless it cannot work with the current
     SwiftPM + `tools/package.sh` build. In that case, stop and report the options instead of writing a custom updater.
   - Behavior:
     - checks on launch and daily;
     - a "Check for Updates…" item in the menu-bar menu;
     - shows release notes;
     - downloads, verifies, replaces, relaunches.
   - Updates are signed with an EdDSA key.
     - Generate it with Sparkle's own tool, which stores the private key in the login Keychain.
     - **Never commit or print the private key.**
     - Write backup instructions for the owner in `docs/RELEASING.md`.
   - Feed: an `appcast.xml` attached to each GitHub release. The app reads
     `https://github.com/rick-ray-wldd/sofapad/releases/latest/download/appcast.xml`, so no extra hosting is needed.
   - Update the README: SofaPad now has one dependency (Sparkle, for updates). Say why.
4. **Release script** (`tools/release.sh`)
   - One command from a version number: bump `VERSION` / `BuildInfo` / `web/js/version.js` → test → build → sign → zip →
     generate the appcast entry → write release notes (English and Chinese) → print the exact `gh release create`
     command for the coordinator.
   - The script itself must **not** push, tag or publish.
   - Signing:
     - Takes an identity argument. Without it, it uses ad-hoc signing and says so.
     - With a Developer ID identity and a notarytool Keychain profile name, it signs with the hardened runtime,
       notarizes, and staples.
     - Never ask for, read or store any Apple password; the owner sets up the Keychain profile.
5. **End-to-end test with test signing**
   - Build 4.5.0 and a fake 4.5.1 locally.
   - Serve the 4.5.1 appcast and zip from a local `http://127.0.0.1` test server, using a debug-only feed override
     that is not in release builds.
   - Prove that 4.5.0 finds, downloads, verifies, installs and relaunches as 4.5.1.
   - Then show that a tampered zip is rejected.
   - Record a short screen video of the update prompt and relaunch, and screenshots of the phone auto-reload.
6. **Known limit, written plainly**
   - With ad-hoc signing, macOS can still block the first launch, and the Accessibility permission may reset after an
     update.
   - Developer ID signing (phase 2) fixes this.
   - Put it in the README and the release notes.
7. **Public check**: same as earlier dispatches. Add a 4.5.0 row to `docs/PUBLIC-CHECK.md`.

## Limits (for the writer and its sub-agents)
- **Publishing**: do not push, tag, or create a GitHub release. Commit locally only. The coordinator reviews, then
  pushes and publishes.
- **Accounts and money**: no new accounts, no payments, no messages to anyone, no uploads anywhere.
- **Apple credentials**: do not open, read or change any Apple ID, signing certificate or notarization credential. If
  a step needs the owner (certificate, Keychain profile, permission prompt), stop and list it.
- **Security model**: do not change the pairing or security model, except to add the protocol version.
- **Resources**: new terminals: 0. Sub-agents: at most 2 at a time.

## Delivery
- Local commit(s) on `main`: tests green, the 4.5.0 package built with test signing, and the end-to-end update proof.
- Report to the coordinator with:
  - the commit SHA and test counts;
  - the video and screenshot paths;
  - the package path and sha256;
  - the printed release command;
  - the public-check result;
  - the exact steps left for the owner for phase 2.
