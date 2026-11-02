# Install SofaPad from the zip ｜ 用 zip 安裝 SofaPad

[README](../README.md) · [繁體中文 README](../README.zh-TW.md)

> From 4.5.1, the app in the zip is **signed with an Apple Developer ID and notarized by Apple**: it opens with a
> double-click, after one "Open" click. Older zips (4.5.0 and before) had an ad-hoc signature only, and macOS blocked
> them the first time (step 3 says what to do then).
>
> 從 4.5.1 起，zip 裡的 App **有 Apple Developer ID 簽章，也經過 Apple 公證**：雙擊就能打開，只要按一次「打開」。舊的 zip（4.5.0 和更早）只有臨時簽章（ad-hoc），第一次打開會被 macOS 擋下（第 3 步有被擋時的做法）。

## English

1. **Check the download** (optional): in Terminal, in the folder with the zip, run
   `shasum -a 256 -c SofaPad-4.5.1-macOS.zip.sha256`. **You'll see** `SofaPad-4.5.1-macOS.zip: OK`.
2. Double-click the zip. Drag `SofaPad.app` from the folder that appears into **Applications**.
3. Double-click **SofaPad** in Applications. **You'll see** macOS ask whether you want to open an app downloaded from
   the internet: click **Open**. It asks this once.
   - Only with a zip older than 4.5.1 (ad-hoc signed), or an app someone built for you: if you get "**"SofaPad" Not
     Opened** / Apple could not verify…", click **Done** (not Move to Trash), open **System Settings > Privacy &
     Security**, scroll to **Security** at the bottom, click **Open Anyway** next to "SofaPad was blocked to protect
     your Mac", enter your password or use Touch ID, then double-click SofaPad again and click **Open**. On recent
     macOS, right-click > Open no longer skips this check.
4. **Accessibility**: System Settings > Privacy & Security > Accessibility. If an older SofaPad is in the list, select
   it and click **-** first; then click **+** and add `/Applications/SofaPad.app`, and turn it on. (macOS knows the app
   by its signature. From 4.5.1 the signature is the developer's, the same for every version, so updates keep the
   permission; after the update from 4.5.0 or older you do this step once more.)
5. **Firewall** (only if it is on): when macOS asks whether SofaPad may accept incoming connections, click **Allow**.
6. `⌨︎🖱` appears in the menu bar. Click it → **Scan with iPhone (用 iPhone 掃描)**, scan the QR code with the iPhone's
   camera, and pair with the code on the Mac's screen. Then follow README step 6.
7. **Check the version**: the menu's first line reads "SofaPad 4.5.1 (build …)"; on the phone, ⚙︎ shows
   "Web page 4.5.1 (build …) · Mac app 4.5.1 (build …)".
8. **Language and theme** (4.4): the phone page is in English, or in Chinese when the phone's language is Chinese.
   ⚙︎ → **Language** (Auto, English, 中文) and **Theme** (System, Light, Dark) change it at once; the phone remembers.
9. **Updates** (4.5): SofaPad checks for a new version when it opens and once a day; `⌨︎🖱` → **檢查更新…** (Check for
   Updates) checks now. **You'll see** a window with what's new: click **Install Update**, then **Install and
   Relaunch**. SofaPad opens again as the new version, and the phone page reloads itself to match. After the update
   from 4.5.0 to 4.5.1 the phone says the Accessibility permission isn't on: do step 4 once more. Later updates keep
   it. While a phone is connected, a new version waits in the
   menu ("⬆︎ 安裝新版本 …") instead of opening a window.

## 繁體中文

1. **核對下載的檔案**（可選）：在終端機切到 zip 所在的資料夾，執行
   `shasum -a 256 -c SofaPad-4.5.1-macOS.zip.sha256`，**會看到** `SofaPad-4.5.1-macOS.zip: OK`。
2. 雙擊 zip 解壓縮，把資料夾裡的 `SofaPad.app` 拖到「**應用程式**」。
3. 在「應用程式」雙擊 **SofaPad**。**會看到** macOS 問「SofaPad」是從網路下載的 App，確定要打開嗎？按「**打開**」。只會問這一次。
   - 只有 4.5.1 以前的 zip（臨時簽章）或別人幫你 build 的 App 才會這樣：出現「**無法打開「SofaPad」**／Apple 無法驗證…」時，按「**完成**」（不要按「丟到垃圾桶」），打開 **系統設定 → 隱私權與安全性**，捲到最下面的「**安全性**」，在「已阻擋「SofaPad」以保護你的 Mac」旁邊按「**強制打開**」，輸入密碼或用 Touch ID，再雙擊一次 SofaPad 按「**打開**」。新版 macOS 用右鍵 →「打開」已經不能略過這個檢查。
4. **輔助使用權限**：系統設定 → 隱私權與安全性 → 輔助使用。清單裡如果有舊的 SofaPad，先選它按「**－**」移除；再按「**＋**」加入 `/應用程式/SofaPad.app` 並打開開關。（macOS 用簽章認 App。從 4.5.1 起是開發者的簽章，每個版本都一樣，所以更新後權限會保留；從 4.5.0 或更早的版本更新到 4.5.1 後，要再做一次這一步。）
5. **防火牆**（有開才會問）：問 SofaPad 能不能接受連入的連線時，按「**允許**」。
6. 選單列出現 `⌨︎🖱`：點它 →「**用 iPhone 掃描**」，用 iPhone 相機掃 QR code，輸入 Mac 螢幕上的配對碼。之後照 README 第 6 步。
7. **確認版本**：選單第一行是「SofaPad 4.5.1（建置 …）」；手機 ⚙︎ 最上面是「網頁 4.5.1（建置 …）・Mac App 4.5.1（建置 …）」。
8. **語言和主題**（4.4）：手機的語言是中文時，網頁是中文，否則是英文。⚙︎ →「**語言**」（自動、English、中文）和「**主題**」（系統、淺色、深色）可以馬上切換，手機會記住。
9. **更新**（4.5）：SofaPad 打開時和每天會檢查有沒有新版；`⌨︎🖱` →「**檢查更新…**」可以馬上檢查。**會看到**新版說明的視窗：按「**安裝更新項目**」，再按「**安裝並重新啟動**」。SofaPad 會以新版重新打開，手機網頁也會自己重新載入。從 4.5.0 更新到 4.5.1 後，手機會說「輔助使用」沒開：再做一次第 4 步。之後的更新都會保留權限。手機連線中時，新版會放在選單裡（「⬆︎ 安裝新版本 …」），不跳出視窗。
