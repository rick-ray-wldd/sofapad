# DISPATCH SOFA-451: SofaPad 4.5.1, signed with a Developer ID and notarized (local, up to publishing)

Coordinator: Claude. Dispatched 2026-11-02. Publishing waits for the owner's yes.

## Owner's words (11/02, verbatim)
> 我要如何用開發者帳號拿到憑證讓正式發佈的時候所有人一下載就可以直接使用

> 憑證建好了 我新增developer ID application在xcode中

and the end of the owner's `xcrun notarytool store-credentials` run: "Success. Credentials validated. Credentials saved to
Keychain. To use them, specify --keychain-profile "sofapad-notary"".

## Ready (read back by the coordinator)
- Keychain: `Developer ID Application: <name> (9B5Z3H3KLW)`, with its private key, valid until 2027-02-02. (The
  certificate holder's name is written `<name>` in this repository; the signature itself carries it.)
- Notarization: `xcrun notarytool history --keychain-profile sofapad-notary` works; no submissions yet.

## To do
1. Version 4.5.1: only the signature changes, no features. Release notes in English and Chinese:
   - the first version signed with a Developer ID and notarized by Apple: a download opens with a double-click, no
     more "Open Anyway" in System Settings;
   - people who have it installed give the Accessibility permission once more after this update, and then it stays;
   - update the README and INSTALL passages about "not notarized, Open Anyway".
2. Follow `docs/RELEASING.md` section 3 (phase 2):
   `tools/release.sh 4.5.1 --identity "Developer ID Application: <name> (9B5Z3H3KLW)" --notary-profile sofapad-notary`.
   Stop after notarization, stapling and spctl: no GitHub release, no appcast pushed, no push. If the script has no
   "build without publishing" option, stop before the publishing step and report.
3. Verify and attach the output:
   - `codesign -dv --verbose=4`: Authority is the Developer ID, TeamIdentifier 9B5Z3H3KLW, hardened runtime, secure
     timestamp; each of Sparkle's helpers too;
   - `spctl -a -vv`: accepted, source=Notarized Developer ID;
   - `xcrun stapler validate`;
   - the EdDSA signatures of the zip and the appcast;
   - a brand-new user: after unzipping, a double-click is not blocked (for example: add the quarantine attribute, then
     spctl).
4. The public check (PUBLIC-CHECK): the repository is public; no private paths, no internal addresses like 100.64/10,
   no keys.

## Delivery
To the coordinator's mailbox: the version, the zip's sha256, the notarization submission id, the output of every
check, the full release notes, and where it stopped. The coordinator checks it, then asks the owner whether to
publish.

## Limits (the writer and its sub-agents)
- No push, no GitHub release, no change to the public appcast; no account settings touched other than the Sparkle key.
- Never print or copy a password or a private key.
- New terminals 0, sub-agents at most 1, NT$0; report the own station when done.
