# Install SofaPad from the zip ｜ 用 zip 安裝 SofaPad

[README](../README.md) · [繁體中文 README](../README.zh-TW.md)

> This app is **not signed with an Apple Developer ID and not notarized** (it has an ad-hoc signature only). macOS
> will block it the first time; the steps below are how to open it anyway. If you would rather not, build it yourself
> (README, step 1A): an app you build on your own Mac is not blocked.
>
> 這個 App **沒有 Apple Developer ID 簽章，也沒有經過 Apple 公證**（只有臨時簽章 ad-hoc）。第一次打開會被 macOS 擋下，下面是照樣打開的方法。不想這樣的話，自己 build（README 第 1 步 A）：在自己的 Mac 上 build 的 App 不會被擋。

## English

1. **Check the download** (optional): in Terminal, in the folder with the zip, run
   `shasum -a 256 -c SofaPad-4.2.0-macOS.zip.sha256`. **You'll see** `SofaPad-4.2.0-macOS.zip: OK`.
2. Double-click the zip. Drag `SofaPad.app` from the folder that appears into **Applications**.
3. Double-click **SofaPad** in Applications. If you get "**"SofaPad" Not Opened** / Apple could not verify…":
   1. Click **Done** (not Move to Trash).
   2. Open **System Settings > Privacy & Security** and scroll to **Security** at the bottom.
   3. **You'll see** "SofaPad was blocked to protect your Mac." Click **Open Anyway**, then enter your password or use
      Touch ID.
   4. Double-click SofaPad again and click **Open**. You only do this once per version.
   - On recent macOS, right-click > Open no longer skips this check.
4. **Accessibility**: System Settings > Privacy & Security > Accessibility. If an older SofaPad is in the list, select
   it and click **-** first; then click **+** and add `/Applications/SofaPad.app`, and turn it on. (macOS knows the app
   by its signature, and each build has a new one.)
5. **Firewall** (only if it is on): when macOS asks whether SofaPad may accept incoming connections, click **Allow**.
6. `⌨︎🖱` appears in the menu bar. Click it → **Scan with iPhone (用 iPhone 掃描)**, scan the QR code with the iPhone's
   camera, and pair with the code on the Mac's screen. Then follow README step 6.
7. **Check the version**: the menu's first line reads "SofaPad 4.2.0 (build …)"; on the phone, ⚙︎ shows
   "Web page 4.2.0 · Mac app 4.2.0".

## 繁體中文

1. **核對下載的檔案**（可選）：在終端機切到 zip 所在的資料夾，執行
   `shasum -a 256 -c SofaPad-4.2.0-macOS.zip.sha256`，**會看到** `SofaPad-4.2.0-macOS.zip: OK`。
2. 雙擊 zip 解壓縮，把資料夾裡的 `SofaPad.app` 拖到「**應用程式**」。
3. 在「應用程式」雙擊 **SofaPad**。如果出現「**無法打開「SofaPad」**／Apple 無法驗證…」：
   1. 按「**完成**」（不要按「丟到垃圾桶」）。
   2. 打開 **系統設定 → 隱私權與安全性**，捲到最下面的「**安全性**」。
   3. **會看到**「已阻擋「SofaPad」以保護你的 Mac」，按「**強制打開**」，再輸入密碼或用 Touch ID。
   4. 再雙擊一次 SofaPad，在跳出的視窗按「**打開**」。每個版本只要做一次。
   - 新版 macOS 用右鍵 →「打開」已經不能略過這個檢查。
4. **輔助使用權限**：系統設定 → 隱私權與安全性 → 輔助使用。清單裡如果有舊的 SofaPad，先選它按「**－**」移除；再按「**＋**」加入 `/應用程式/SofaPad.app` 並打開開關。（macOS 用簽章認 App，每次 build 的簽章都不一樣。）
5. **防火牆**（有開才會問）：問 SofaPad 能不能接受連入的連線時，按「**允許**」。
6. 選單列出現 `⌨︎🖱`：點它 →「**用 iPhone 掃描**」，用 iPhone 相機掃 QR code，輸入 Mac 螢幕上的配對碼。之後照 README 第 6 步。
7. **確認版本**：選單第一行是「SofaPad 4.2.0（建置 …）」；手機 ⚙︎ 最上面是「網頁 4.2.0・Mac App 4.2.0」。
