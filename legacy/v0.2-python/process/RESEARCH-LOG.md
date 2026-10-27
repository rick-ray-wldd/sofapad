# RESEARCH-LOG

說明：本環境的 WebFetch 會抓網頁再由小模型依我的提問轉述，我看到的是轉述而非原文，因此「讀了多少」一律標「僅摘要（WebFetch 轉述）」。只在搜尋結果出現、沒打開的標「未開啟」。所有搜尋都在 11:38–11:41 之間（約，補記）。

| 編號 | 類型 | 標題 / 作者 / 年份 | 實際打開的網址 | 怎麼找到（搜尋詞） | 讀了多少 | 重點 | 用在哪個決定 |
|---|---|---|---|---|---|---|---|
| S-01 | 官方文件 | Apple Vision Pro User Guide：Mac Virtual Display，Apple，年份未標 | https://support.apple.com/guide/apple-vision-pro/tan357ede966/visionos | "Vision Pro Mac Virtual Display iPhone as keyboard trackpad input workaround" | 僅摘要（WebFetch 轉述） | Mac 觸控板/滑鼠照常使用；指標可跨到 visionOS（需 Handoff）；使用虛擬顯示器時不能用 iPhone 鏡像；需藍牙與 Wi-Fi、10 公尺內 | D-02、D-03（確定 Mac 端注入即可） |
| S-02 | 文章（開發者論壇） | Does iOS support to work as a HID device via bluetooth?，Apple Developer Forums，2023–2024 | https://developer.apple.com/forums/thread/725238 | "iOS CoreBluetooth cannot advertise HID service peripheral keyboard limitation" | 僅摘要（WebFetch 轉述） | 註冊 0x1812 回傳 CBErrorDomain Code 8「UUID not allowed」；Classic HID 不可行；無 Apple 工程師回覆 | D-02（不用藍牙 HID） |
| S-03 | 論文 | Pointing at a Distance with Everyday Smart Devices，Siddhpuria et al.，CHI 2018 | https://www.cs.virginia.edu/~bjc8c/class/cs6501-f18/papers/siddhpuria18pointing.pdf | "smartphone as touchpad for remote display pointing study CHI paper transfer function" | 僅摘要（WebFetch 轉述 PDF） | 相對優於絕對；單手拇指觸控板 P1TR 約 2169 ms、錯誤 4–7%；IMU 最快但錯誤約 23%；S 形增益；250 ms 點擊防抖 | D-05 |
| S-04 | GitHub | MacPilot，joonlab，年份未知 | https://github.com/joonlab/MacPilot/wiki | "github iPhone web trackpad websocket control mac mouse keyboard open source" | 僅摘要（WebFetch 轉述 wiki 頁） | Swift 選單列 helper + 純 HTML/JS；port 8765 HTTP+WebSocket；CGEvent 注入；Unicode 文字含韓文；選用 6 位數 PIN；建議 Tailscale | D-01、D-03、D-04、D-07 |
| S-05 | GitHub | webbymouse，gasolin，年份未知 | https://github.com/gasolin/webbymouse | 同 S-04 | 僅摘要（WebFetch 轉述 README 頁） | Node/Express + socket.io + RobotJS + NW.js；觸控板/空中滑鼠/簡報模式；未說明鍵盤處理 | D-05（手勢參考）、D-07 |
| S-06 | 文章（程式碼審查） | Fix and improve unicode input on macOS and Windows，KDE Connect MR 467 | https://invent.kde.org/network/kdeconnect-kde/-/merge_requests/467 | "macOS CGEventKeyboardSetUnicodeString inject unicode text Chinese remote typing accessibility permission" | 僅摘要（WebFetch 轉述） | 以 16-bit UniChar 為單位用 CGEventKeyboardSetUnicodeString 注入；未提長度限制或 IME | D-03、D-06 |
| S-07 | App | Remote Mouse（App Store id403195710） | https://apps.apple.com/app/remote-mouse/id403195710 | "Remote Mouse app Mac latency review keyboard input Chinese pinyin" | 僅摘要（WebFetch 轉述商店頁） | Wi-Fi/藍牙；需桌面端；「任何語言」打字；免費；有 iOS 18 連線失敗評論 | 比較表、D-07 |
| S-08 | App | BT Keys: Keyboard & Trackpad（mwm.ai 鏡像頁） | https://mwm.ai/apps/bt-keys-keyboard-trackpad/6778806487 | "iOS app iPhone as Bluetooth HID keyboard mouse for Mac (no helper) App Store" | 僅摘要（WebFetch 轉述第三方頁面，不是 App Store 原頁） | 宣稱藍牙直連、同 Apple 帳號免配對、不行時裝接收端；中文送拼音由目標裝置選字；每天免費 10 分鐘 | 比較表、D-02、D-06 |
| S-09 | 論文 | PointerPhone，INTERACT 2013 | 未開啟（搜尋結果 https://dl.ifip.org/hal-01504904v1） | 同 S-03 | 未開啟 | 無 | 無（v1 報告曾誤引，已在 v2 移除，見 ISSUES I-01） |
| S-10 | GitHub/原始碼 | Chromium remoting input_injector_mac.cc | 未開啟（搜尋結果） | 同 S-06 | 未開啟 | 無 | 報告資料來源列出但未讀，僅作參考連結 |
| S-11 | App | Mobile Mouse Server（Mac App Store） | 未開啟（搜尋結果） | "Mobile Mouse Pro Mac app features mobile mouse server latency" | 未開啟 | 無；比較表中「支援系統鍵盤、付費」為既有知識，未查證 | 比較表 |
| S-12 | App/官方文件 | Unified Remote：Basic Input | 未開啟（搜尋結果） | "Unified Remote basic input keyboard latency iOS Mac server 2025" | 未開啟 | 無；比較表內容為既有知識，未查證 | 比較表 |
| S-13 | 其他搜尋結果 | alternativeto.net 列表、macstories、9to5mac、howtogeek、Apple 社群等 | 未開啟 | 多個搜尋 | 未開啟 | 無 | 無 |
| S-14 | App | KDE Connect（作為比較對象） | 只開過 S-06 | — | 僅 S-06 | 比較表的延遲為推估 | 比較表 |

## GitHub 額外欄位
| 編號 | 星數 | 最後更新 | 授權 | 平台 | clone/執行 |
|---|---|---|---|---|---|
| S-04 MacPilot | 未取得 | 未取得 | 頁面稱開源，授權未確認 | macOS（Windows 實驗中）＋手機瀏覽器 | 否 |
| S-05 webbymouse | 80（轉述，另 17 forks） | 頁面未顯示 | 未取得 | macOS（RobotJS）＋手機瀏覽器 | 否 |

## 實作階段（12:02 之後）
- 沒有新增或開啟任何來源。CGEvent 函式簽名、macOS 按鍵碼、iOS 18 觸覺回饋技巧都是憑既有知識寫的，未查證（見 ISSUES I-12）。

## 統計
- 實際打開（皆僅摘要）：8（論文 1、GitHub 2、官方文件 1、開發者論壇 1、程式碼審查 1、App 頁 2）
- 全文閱讀或試跑：0

## 18:13–18:19 游標為何進不了 visionOS App（P-17）
- 已讀：Apple〈Use Mac Virtual Display on Apple Vision Pro〉https://support.apple.com/guide/apple-vision-pro/tan357ede966/visionos（「you can use your trackpad or mouse with your Mac as you normally would, as well as for visionOS apps」；分享游標要開 Handoff；沒寫支援哪些裝置）
- 已讀：Eclectic Light〈Inside Universal Control〉https://eclecticlight.co/2022/06/06/inside-universal-control/（輸入在控制端擷取後以 EVNT 事件轉送；沒寫軟體注入的事件會不會轉）
- 已讀：Synergy 論壇 https://forums.symless.com/topic/6696-synergy-and-universal-control-on-mac/（用 Synergy 時游標移不到 iPad，實體滑鼠可以）
- 已讀：Apple Community https://discussions.apple.com/thread/255460248（游標分享不穩；有人說只有觸控板可以，屬個人說法）
- 已讀：Apple〈visionOS 26 連接藍牙配件〉https://support.apple.com/ur-in/guide/apple-vision-pro/connect-bluetooth-accessories-tanaa651a58d/26/visionos/26（列出鍵盤、觸控板、滑鼠）
- 搜尋但沒開：Karabiner 與通用控制相容性（結果不相關）
- 結論：「軟體注入事件不會被轉給 Vision Pro」是推論，Apple 沒寫明；依據是使用者實測（真滑鼠可以、SofaPad 不行）和 Synergy 的類似回報。
