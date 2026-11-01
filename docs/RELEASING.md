# Releasing SofaPad ｜ 發布 SofaPad

[README](../README.md) · [Protocol](PROTOCOL.md) · [Install](INSTALL.md)

A release is three files on a GitHub release: `SofaPad-<version>-macOS.zip`, its `.sha256`, and `appcast.xml`.
SofaPad on people's Macs reads
`https://github.com/rick-ray-wldd/sofapad/releases/latest/download/appcast.xml` (the newest release that is not a
pre-release), so publishing the release is all it takes to offer the update. Sparkle checks every update twice
before installing it: the zip's EdDSA signature and the feed's own signature, both against the public key built into
the app.

## 1. The signing key (once per Mac)

- SofaPad's EdDSA key was made with Sparkle's own tool and lives in the **login Keychain** of the Mac that makes
  releases: item "Private key for signing Sparkle updates", account `sofapad`. Its public half is
  `tools/sparkle-public-key.txt`; `tools/build-app.sh` puts it in every app (`SUPublicEDKey`).
- `tools/release.sh` takes the private key out of the Keychain only to sign, through a file in a private temporary
  folder that is deleted at once. It is never printed, never committed, never uploaded.
- **Losing it** means the apps already out there can never update automatically again: they accept only updates
  signed with this key (until SofaPad is signed with a Developer ID, which allows a key change). So back it up:

**Back up the key (owner, once)**

```bash
cd mac && swift package resolve && cd ..           # gets Sparkle's tools, if mac/.build is not there yet
mac/.build/artifacts/sparkle/Sparkle/bin/generate_keys --account sofapad -x ~/Desktop/sofapad-sparkle-key.txt
```

1. Copy the one line in that file into your password manager (a secure note named "SofaPad Sparkle EdDSA key"), or
   onto an encrypted USB drive. Not into email, chat, iCloud Drive, a cloud folder or this repository.
2. Delete the file: `rm ~/Desktop/sofapad-sparkle-key.txt`.
3. Check: `mac/.build/artifacts/sparkle/Sparkle/bin/generate_keys --account sofapad -p` prints the same line as
   `tools/sparkle-public-key.txt`.

**On another Mac**: save the line to a file, run `generate_keys --account sofapad -f <file>`, delete the file.

**備份簽章金鑰（Ray，只要做一次）**：在 repo 資料夾執行上面兩行指令，會在桌面產生 `sofapad-sparkle-key.txt`。把裡面那一行存進密碼管理器（安全備忘「SofaPad Sparkle EdDSA key」）或加密的隨身碟；不要寄信、不要傳訊息、不要放 iCloud Drive 或任何雲端資料夾、不要放進 repo。存好後刪掉桌面的檔案，再用 `generate_keys --account sofapad -p` 確認印出來的和 `tools/sparkle-public-key.txt` 一樣。金鑰掉了，已經裝好的 SofaPad 就再也不能自動更新（要等 Developer ID 簽章之後才能換金鑰）。換電腦時：把那一行存成檔案，執行 `generate_keys --account sofapad -f <檔案>`，再刪掉檔案。

## 2. Making a release

1. Write `docs/release/<version>.md`: English, then a line with `---`, then Chinese (the update window shows the half
   in the Mac's language, without its "Download and install" part). Add `## <version> (date)` to `CHANGELOG.md`.
   Update the README and `docs/INSTALL.md`. Commit.
2. Run, from the repository folder:

   ```bash
   tools/release.sh 4.5.0
   ```

   It: (1) sets the version in `VERSION`, `BuildInfo.swift` and `web/js/version.js`; (2) runs `swift test`, the JS
   unit tests and two browser suites (`tools/v2-browser.mjs`, `tools/sofa12-follow.mjs`; they need
   `(cd tools && npm ci)` once); (3) builds and signs `dist/SofaPad.app`; (4) notarizes it (phase 2 only);
   (5) packages `dist/release/SofaPad-<version>-macOS.zip` and its `.sha256`; (6) signs the zip with the Keychain key,
   writes `dist/release/appcast.xml` with the release notes in both languages, signs it, and checks both signatures
   against `tools/sparkle-public-key.txt`; (7) writes `dist/release/RELEASE-NOTES-<version>.md` and prints the
   `gh release create` command.
3. If it says there are uncommitted changes (the version bump), commit them and run it again, so the printed
   `--target` is the commit the zip was built from.
4. **It never pushes, tags or publishes.** The coordinator reviews, pushes, and runs the printed command, which
   creates the tag and the release with the three files.

Without `--identity` the app is signed ad-hoc, and the script says so. Then macOS blocks the first launch of a
downloaded copy (Open Anyway, see `docs/INSTALL.md`), and the Accessibility permission may have to be given again
after each update (macOS knows an ad-hoc app by the hash of its code, which every build changes). Updates
themselves work: Sparkle takes the quarantine flag off what it installs.

## 3. Phase 2: Developer ID and notarization (owner)

With a Developer ID, macOS opens SofaPad without "Open Anyway", and the Accessibility permission stays across updates
(macOS then knows the app by its team, not its hash). The script is ready for it; these steps need the owner,
because they involve Apple's account and certificates:

1. Join the Apple Developer Program (paid, yearly).
2. Make a **Developer ID Application** certificate: Xcode → Settings → Accounts → (your team) → Manage
   Certificates → + → Developer ID Application. It goes into the login Keychain.
3. Its full name: `security find-identity -v -p codesigning` → `Developer ID Application: <Name> (<TEAMID>)`.
4. Store notarization credentials in the Keychain, under a profile name. With an app-specific password
   (appleid.apple.com → Sign-In and Security → App-Specific Passwords):
   `xcrun notarytool store-credentials sofapad-notary --apple-id <Apple ID> --team-id <TEAMID>` (it asks for the
   password and keeps it in the Keychain; the script only passes the profile name and never sees the password).
5. Release with both:

   ```bash
   tools/release.sh 4.5.1 --identity "Developer ID Application: <Name> (<TEAMID>)" --notary-profile sofapad-notary
   ```

   It signs every part (Sparkle's helpers first) with the hardened runtime and a secure timestamp, sends the app to
   Apple's notary service, waits, staples the ticket, checks it with `spctl`, then packages and signs the update as
   before. The EdDSA key stays the same, so apps signed ad-hoc update to the Developer ID one normally.
6. After that first Developer ID update, people give the Accessibility permission one last time; from then on it
   stays.

**第二階段（Ray 要做的事）**：(1) 加入 Apple Developer Program（付費、每年）。(2) 在 Xcode → 設定 → Accounts → Manage Certificates 按 ＋ 建立「Developer ID Application」憑證（會存進登入鑰匙圈）。(3) 用 `security find-identity -v -p codesigning` 看憑證全名。(4) 在 appleid.apple.com 建一組 App 專用密碼，執行 `xcrun notarytool store-credentials sofapad-notary --apple-id <Apple ID> --team-id <TEAMID>`，照提示輸入密碼（存在鑰匙圈，發布腳本只用設定檔名稱，看不到密碼）。(5) 之後發布改用 `tools/release.sh <版本> --identity "Developer ID Application: <名字> (<TEAMID>)" --notary-profile sofapad-notary`。做完以後，下載的 SofaPad 第一次打開不會被擋，更新後輔助使用權限也不會再跑掉（換成 Developer ID 的那一次更新後要再開一次）。

## 4. Testing updates without publishing

`node tools/sofa12-update-e2e.mjs [--video]` builds 4.5.0 and a fake 4.5.1 with their own bundle id and a throwaway
key, serves the feed on 127.0.0.1, installs 4.5.0 in `dist/update-test/` and lets it update itself, through
Sparkle's real windows (pressed through Accessibility). It also checks that a tampered zip and an edited feed are
refused. It needs the Mac unlocked and the Accessibility permission for the terminal that runs it. The feed address
it uses exists only in debug builds (`SofaPadTestFeedURL`); `tools/build-app.sh` refuses to finish a release build
that contains any of the test switches.
