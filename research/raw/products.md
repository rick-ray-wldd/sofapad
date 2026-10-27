# 現成產品與 Apple 內建方案調查（PKM-1 / research/raw/products.md）

- 調查日期：2026-10-23（台北時間 11:49–12:01）
- 調查者：research sub-agent（Claude Code）；只用網路（WebSearch / WebFetch），沒有讀本機其他產出，沒有安裝或執行任何東西
- 情境：Ray 坐在沙發上戴 Apple Vision Pro，用 Mac Virtual Display 操作 MacBook（"MacBook Neo"，macOS 當前版本）。沒有桌子放鍵盤，手臂會累。
- 需求 A：手機當鍵盤，用手機**原生鍵盤**（含注音／拼音）打字，文字出現在 Mac 上
- 需求 B：用單支手機當順暢的滑鼠／觸控板

## 0. 方法與可信度說明（先讀這段）

1. 下表每一列都至少用 WebFetch 開過一個頁面（官網、App Store、Apple Support、開發者文件）。沒開成功的會寫明。「僅搜尋摘要」的項目只當背景資訊，不當事實。
2. **WebFetch 給的不是逐字全文**，而是一個小模型按我的提示從頁面萃取的內容。引號內的文字是萃取結果標成原文引用的部分。所以「讀了多少」欄寫的「App Store 頁（萃取）」表示整頁都送進去了，但我看到的是萃取摘要。
3. App Store 版本日期常常只顯示「Oct 5」這種沒有年份的格式，或「2d ago」這種相對時間。我照原樣記下來，不自己補年份。抓取日是 2026-10-23。
4. 判斷是否支援中文輸入的關鍵，是 app 傳的東西屬於哪一種：
   - **組字後文字（composed text）**：手機用注音打完、選好字，把「你好」這個字串傳給 Mac 上的 helper，再由 helper 注入。這樣才能真正用手機的輸入法。
   - **原始按鍵（HID keycode / keystroke）**：手機假裝成藍牙鍵盤，只送「按了 ㄋ 那顆鍵（N）」。中文要靠 Mac 端的注音輸入法組字，手機只是一塊 QWERTY 鍵盤，**用不到手機的輸入法和選字列**。HID 協定本身沒辦法直接送任意 Unicode 字元。QMK 文件說，macOS 上要送 Unicode 必須先在 Mac 加「Unicode Hex Input」輸入來源，而且可能讓部分 Option 快捷鍵失效（來源見 §3-16）。
5. 判定欄只有三種：**滿足／部分滿足／不滿足**，依據是 Ray 的 A、B 兩項需求，加上安全、隱私和沙發場景。

## 1. 總表

| 名稱 | 類型 | 平台（手機端／Mac 端） | 價格 | 連線 | 中文輸入法 | 滑鼠功能 | 安全／隱私 | 最後更新 | 判定 | 來源網址 | 讀了多少 | 怎麼找到 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Remote Mouse | 手機 app＋Mac server | iOS（另有 Android，官網提及）／Mac 需裝 Remote Mouse for desktop | 免費＋IAP：Pro 月 $1.49、年 $13.99；Remove Ads $0.99；Media Remote $1.99 等 | App Store 寫 Wi-Fi 或 Bluetooth；官網只寫同一個 Wi-Fi | 宣稱「Remote typing in any language」，可用系統鍵盤語音輸入；**沒說明傳的是文字還是按鍵** | 模擬 Magic Trackpad 多指手勢、陀螺儀滑鼠；捲動和拖曳沒有明寫 | 隱私標籤：**Usage Data 用於跨 app 追蹤**；第三方廣告用 Usage／Advertising Data；有廣告。官網沒提密碼或加密 | 5.332，「Oct 5」 | 部分滿足 | https://apps.apple.com/us/app/remote-mouse/id385894596 ；https://www.remotemouse.net/ | App Store 頁（萃取）；官網首頁（萃取） | WebSearch「Remote Mouse app iPhone Mac App Store」 |
| Unified Remote | 手機 app＋server | iOS、Android／Mac server 免費（另支援 Win、Linux、RPi） | 免費（18 個 remote）；Full Version $4.99 一次買斷 | 頁面沒寫傳輸方式（評論提到 LAN），可自動找到電腦，支援 WOL | 官網：「Supports standard, 3rd party, and custom keyboards」；changelog 修過「Japanese and other language input」。**沒明寫中文** | 多點觸控、捲動、右鍵、拖曳（2.2.0 修過拖曳；有評論說長按拖曳放手會斷） | 「can be password-protected and encrypted」；隱私標籤 **Data Not Collected** | 2.4.0，「2d ago」 | 部分滿足 | https://apps.apple.com/us/app/unified-remote/id825534179 ；https://www.unifiedremote.com/ | App Store 頁（萃取）；官網首頁（萃取） | WebSearch「Unified Remote iOS App Store Mac server」 |
| Mobile Mouse WIFI Remote（舊稱 Mobile Mouse／Pro）＋Mobile Mouse Server | 手機 app＋Mac server | iOS／Watch；Mac server（macOS 10.14+） | App $9.99＋IAP：Advanced Communications $0.99、Pro Presentation $1.99、Cloud 月 $1.99／年 $7.99；server 免費 | Wi-Fi（需要路由器）；Mac 上也能用 Bluetooth 或 USB；Cloud 訂閱可走網際網路 | 「international keyboard support」，**沒提中文或 IME** | 多點觸控板、Air mouse、haptic click；手勢和拖曳沒細寫 | 加密＋密碼；server 已 sandbox；兩邊標籤都是 **Data Not Collected**。Cloud 功能代表可能經過雲端中轉 | App 4.0.3「2d ago」；Server 4.0.2「Sep 12」 | 部分滿足 | https://apps.apple.com/us/app/mobile-mouse/id289616509 ；https://apps.apple.com/us/app/mobile-mouse-server/id412814284?mt=12 | 兩個 App Store 頁（萃取） | WebSearch「Mobile Mouse Pro RPA Tech Mac server Wi-Fi App Store」 |
| Mobile Mouse Bluetooth Remote | 手機 app（藍牙 HID 類），**Mac 不用裝東西** | iOS 17.6+、iPadOS、Watch／Mac、Win、Linux、iPad | 免費試用，之後要訂閱：月 $4.99、年 $29.99、Lifetime $39.99 | 直接走 Bluetooth，不用 Wi-Fi；選購 USB-C dongle | 2.0.0 加入「可選鍵盤配置」，**沒提 IME**。這是原始按鍵型，中文要靠 Mac 端輸入法（依 §0-4 推論） | 多點觸控板（移動、捲動、滑動、點擊）、Air Mouse；拖曳沒提 | 「Keyboard input is encrypted over the Bluetooth connection」；**Data Not Collected** | 2.1.0「2d ago」；2.0.2「Oct 14」 | 部分滿足 | https://apps.apple.com/us/app/-/id6749246683 | App Store 頁（萃取） | WebSearch「Bluetouch iPhone app bluetooth keyboard touchpad Mac no server App Store」；「mobilemouse.com Bluetooth Remote …」 |
| Bluetouch™ | 手機 app（藍牙類），宣稱不用額外軟體 | iOS 15.5+、visionOS／**App Store 頁沒列 macOS，評論只提到 Windows** | 免費＋IAP：訂閱月 $1.99、年 $19.99；Lifetime $6.99；Remove Ads $7.99 等 | Bluetooth | 有「dozens of」鍵盤配置，release notes 提到 **Zhuyin Traditional、Simplified Chinese layouts**。這是鍵位層，中文還是 Mac 端組字（推論）；也可以貼上文字送出 | 捲動、左／中／右鍵；多指手勢要 PRO／ELITE；release notes 有雙擊和拖曳 | 隱私標籤：**Identifiers、Usage Data、Other Data 用於追蹤**；有廣告 | 1.0.108「Oct 13」 | 不滿足 | https://apps.apple.com/us/app/id1622635358 | App Store 頁（萃取） | 同上；也在 Apple Developer Forums 725238 討論串裡被提到 |
| Tracepad – Mouse & Trackpad（＋Tracepad Lite Mac 版） | 手機 app；兩種模式：Mac Trackpad Mode（要裝 Mac companion app）／Universal Keyboard & Mouse Mode（藍牙 HID，不用 helper） | iOS 13+、iPadOS、visionOS／Mac companion（從官網或 Mac App Store 下載；Lite 版「no longer maintained」） | 免費＋IAP：解鎖全手勢 $3.99、Plus $0.99、Pro Plus $1.99；Lite 免費 | Mac 模式走 **Bluetooth 或 USB，不用 Wi-Fi**；Universal 模式走藍牙 HID | **2.1.0：「Remote Input: Type on your iPhone with any input method, send to your Mac.」**，另有「Direct mode for real-time keystroke input」。介面有繁中和簡中 | 捲動、點擊、**拖曳**、3／4 指捏合和左右滑等進階手勢 | iOS 標籤 Data Not Linked：Purchases、Usage Data、Crash Data（analytics）；Lite 是 Data Not Collected；2.0.0「New device pairing for better security」。官網 tracepad.site 是 JS 頁面，**讀不到隱私政策** | 4.0.5「Sep 2」；Lite 2.0.0「Jan 19」 | 部分滿足（最接近，需要實測） | https://apps.apple.com/us/app/id1658454999 ；https://apps.apple.com/app/id1665418821 ；https://www.tracepad.site/（只讀到標題） | App Store 頁兩次（萃取）＋Lite 頁；官網和 /privacy 只有標題 | WebSearch「Bluetouch iPhone app …」（出現在結果中）；「Tracepad Mac trackpad iPhone app companion Mac app Shen YuTao official site」 |
| Mouse · Keyboard（"Input"，Remote Sunrise LTD／Evgeny Cherpak 系） | 手機 app＋Mac helper | iOS 17+、iPadOS、visionOS／helper：macOS 10.10+（rs.ltd/get） | 免費，頁面沒列 IAP | 同一個 Wi-Fi 或 Personal Hotspot，「Everything stays on your local network」 | 全螢幕鍵盤、emoji、F 鍵；「Better support for different keyboard layouts」。**沒寫原生鍵盤或 IME，中文不明** | 多點觸控、捲動、滑動、手勢，「just like a real trackpad」；拖曳沒明寫 | **HTTPS**；配對前要在裝置上核准；**Data Not Collected** | 2026.53「Oct 15」 | 部分滿足 | https://apps.apple.com/us/app/input-mouse-keyboard/id1515294700 | App Store 頁（萃取） | WebSearch「"Remote Control for Mac" Cherpak App Store keyboard trackpad helper」 |
| Remote KeyPad and NumPad Pro（Remote Sunrise LTD） | 手機 app＋helper | iOS 17+、visionOS／macOS 10.10+ | $9.99 | Wi-Fi／Personal Hotspot | 只有數字鍵、導航鍵和自訂 keypad，不是全鍵盤 | 頁面沒提觸控板 | Data Not Linked：Identifiers、Usage、Diagnostics（analytics） | 2026.53「Oct 15」 | 不滿足 | https://apps.apple.com/us/app/remote-keypad-and-numpad-pro/id1135300319 | App Store 頁（萃取） | WebSearch「Remote KeyPad iPhone app Mac keyboard」 |
| Remote Keyboard & Mouse（JIE WANG） | 手機 app＋Remote Keyboard Desktop | iOS 15+、visionOS／Mac、Win | 免費＋IAP $1.99–$12.99（另有自動續訂，細節沒寫） | 本地 Wi-Fi＋QR 配對；有「Premium remote connection」 | 2.1.0 加入「Native Keyboard」（iOS 原生鍵盤），**沒提中文或 IME**。App 介面有繁中和簡中 | 游標、點擊、右鍵、捲動、**拖曳**、雙擊拖曳多選、捲軸、靈敏度調整 | 3.0.4「Encrypted text support」；**Identifiers 用於追蹤**；Linked：Email、User ID；第三方廣告用 Device ID | 3.4.1「October 11」 | 部分滿足 | https://apps.apple.com/us/app/-/id6745342030 | App Store 頁（萃取） | WebSearch「Remote KeyPad iPhone app Mac keyboard」 |
| KDE Connect（開源） | 手機 app＋桌面端 | iOS 15+、Android（Google Play、F-Droid）／macOS 有 stable 版 | 免費 | 區網，「End-to-end TLS encryption」 | iOS 端有 Remote Input 虛擬觸控板和鍵盤；**macOS 端能不能接收遠端輸入未證實** | 虛擬觸控板、簡報雷射筆 | TLS；**Data Not Collected**；開源 | iOS 0.5.7「Oct 9」 | 部分滿足（需要驗證） | https://apps.apple.com/us/app/kde-connect/id1580245991 ；https://kdeconnect.kde.org/download.html | App Store 頁和下載頁（萃取） | WebSearch「KDE Connect macOS iOS remote input mouse keyboard」 |
| WiFi Mouse (keyboard trackpad)（Necta） | 手機 app＋mouse server | iOS 8+／Win、macOS、Linux server | 免費＋IAP 各 $1.99（含去廣告） | 區網；有 Cloud ID | 系統鍵盤輸入＋語音；模擬鍵盤有俄、英、韓、法 layout；**沒提 IME** | Magic touchpad、多指手勢、雙指捲動 | 密碼可選；隱私「**No Details Provided**」；評論說 server 走 HTTP 下載、沒簽章（使用者說法，未證實） | **1.5.9，04/26/2018** | 不滿足 | https://apps.apple.com/us/app/-/id629552573 | App Store 頁（萃取） | WebSearch「WiFi Mouse Necta iPhone Mac MouseServer App Store」 |
| Remote for Mac（Aexol Studio） | 手機 app＋Mac client | iOS 10+／Mac client（remotemouse.aexol.com） | $2.99 | Wi-Fi | 「Functional Keyboard」，**沒提中文** | 模擬滑鼠、多指手勢（評論說手勢不能用） | 密碼配對；隱私「No Details Provided」；**CVE-2025-34089：Mac 端 ≤2025.7 版開了「Allow unknown devices」時，/api/executeScript 沒有存取控制，未授權的人能執行任意 AppleScript 和 shell，CVSS v3 9.8，已有 Metasploit 模組** | App 4.0，01/31/2019 | 不滿足 | https://apps.apple.com/us/app/remote-for-mac/id1086962925 ；https://www.tenable.com/cve/CVE-2025-34089 （NVD 頁抓取失敗） | App Store 頁和 Tenable CVE 頁（萃取） | WebSearch「Remote for Mac Aexol App Store Remote Helper」；「"Remote for Mac" Aexol CVE unauthenticated remote code execution」 |
| Bluetooth Keyboard & Mouse（AppGround；舊名 Serverless Bluetooth Keyboard & Mouse） | Android app（藍牙 HID），目標端不用裝東西 | **只有 Android**／目標端官網只寫「any Bluetooth-enabled device」，**沒明列 macOS** | 免費＋Pro（官網沒標價） | Bluetooth（HID，依搜尋摘要和 Android API 推論） | Pro 有「full PC keyboard and 100+ languages」layout；**沒提中文、IME 或 Unicode**。這是原始按鍵型 | 官網只提 Air Mouse；觸控板和捲動來自搜尋摘要 | 官網沒有隱私說明；Google Play「Data safety」**兩次都抓取失敗** | 搜尋摘要：APKMirror 6.22.0（2026-06-18）、6.20.0（2026-05），未證實 | 部分滿足（只限 Android；中文不行） | https://appground.io/ （Play 和 APKMirror 都失敗） | 官網首頁（萃取）；其他只有搜尋摘要 | WebSearch「Serverless Bluetooth Keyboard & Mouse for PC/Phone Google Play appground」 |
| Keymote（Iced Cocoa） | 手機 app＋Mac receiver | iOS（2009 年代）／Mac | 上市時 $3.99（搜尋摘要） | Wi-Fi（搜尋摘要） | 只有快捷鍵按鈕組（keyset） | — | — | **App Store 搜尋「Keymote」只找到同名的 Tesla app，推定已下架** | 不滿足 | （沒開任何官方頁）| 僅搜尋摘要 | WebSearch「Keymote app iPhone Mac keyboard shortcuts remote」；「Keymote」（限 apps.apple.com） |

> Logitech：沒找到 Logitech 有任何「手機當鍵盤滑鼠」的軟體產品（沒專門開頁面查證），所以不列入。Logitech 只出現在 §4 硬體。

## 2. 個別產品筆記

### 2.1 Remote Mouse
- App Store 標的相容性涵蓋 iPhone、iPad、Mac（Apple silicon）、Apple Vision（visionOS 1.0+）、Watch。iOS 版有 25 種語言介面（含繁中）。評分 4.6，1.9 萬則。
- 鍵盤的宣傳是「Remote typing in any language」「voice input (if your soft keyboard supports it)」。這暗示它送的是文字而不是按鍵，但**頁面沒寫實作方式**，注音能不能正常打需要實測。
- 隱私最差的一群之一：Usage Data 被標成「used to track you」，還有第三方廣告。官網首頁沒有任何加密、密碼或隱私說明。
- 判定「部分滿足」：功能很可能涵蓋 A 和 B，但追蹤、廣告和訂閱，加上安全說明空白，不適合當長期鍵盤（鍵盤會經手所有打的字，包括密碼）。

### 2.2 Unified Remote
- 手機端 iOS 和 Android 都有，server 免費。$4.99 一次買斷就能解鎖全部 remote 和延伸鍵盤，沒有訂閱。
- 隱私標籤是「Data Not Collected」。App Store 寫「can be password-protected and encrypted」，但沒說明加密方式。
- 輸入：官網寫支援「standard, 3rd party, and custom keyboards」，changelog 修過日文和其他語言輸入，表示它處理的是 IME 組字後的文字。**中文沒有被明寫**。
- 有評論指出拖曳和水平移動會頓（2.2.0 修過拖曳，開發者回覆修正中）。
- 判定「部分滿足」：是目前看到最可能「直接拿來用」的老牌選項之一，前提是注音實測正常。

### 2.3 Mobile Mouse WIFI Remote＋Mobile Mouse Server（R.P.A. Tech）
- App 本體 $9.99，Cloud 功能另外訂閱，能跨網路連線，代表有雲端中轉的選項。不開就是區網。
- Server 4.0.x 加了 sandbox，有加密和密碼。兩邊都標 Data Not Collected。
- 鍵盤只寫「international keyboard support」。Server 評論提到 Wi-Fi 會延遲、只有 USB 穩定（2020 年評論）。
- 判定「部分滿足」。

### 2.4 Mobile Mouse Bluetooth Remote（同一家公司的新產品）
- 主打「Nothing to install on the computer you control」，直接走藍牙。頁面還寫「Apple devices don't require Bluetooth pairing」，**機制沒有說明**。
- 只有英文介面，評分只有 5 則。要訂閱（$4.99／月、$29.99／年、$39.99 終身）。
- 判定「部分滿足」：Mac 不用裝東西、Data Not Collected、藍牙有加密，是 B（滑鼠）最省事的選項。但鍵盤屬於按鍵型，**用不到手機的注音**，只能把手機當 QWERTY，再用 Mac 的注音輸入法打（推論，待實測）。

### 2.5 Bluetouch™
- Apple Developer Forums 725238 有人用 BLE 分析儀看到 Bluetouch 對外提供 HID service 0x1812，鍵盤和滑鼠都能用。但一般 app 用 CoreBluetooth 加 0x1812 會被拒（見 §3-11），**它怎麼做到的沒有公開**。
- App Store 頁沒列 macOS，評論只提到 Windows。有追蹤型廣告。
- release notes 有「Zhuyin Traditional」layout，應該是讓手機鍵面顯示注音符號、送出對應按鍵，由 Mac 的注音輸入法組字（推論）。
- 判定「不滿足」：Mac 相容沒證實、有追蹤，中文用不到手機的 IME。

### 2.6 Tracepad（＋Tracepad Lite）
- 這次調查中**唯一明文寫「Type on your iPhone with any input method, send to your Mac」**的產品（2.1.0）。另有「Direct mode for real-time keystroke input」。看起來同時有「送組好的文字」和「即時按鍵」兩種模式，符合需求 A 的關鍵點。
- Mac 模式走 Bluetooth 或 USB，不用 Wi-Fi，不會在區網開 port（這點依官方描述，待實測）。3.0 加了 Universal 模式，可以當藍牙 HID 鍵盤滑鼠，不用 helper。
- 觸控板功能最完整：明寫拖曳，還有 3／4 指捏合和滑動手勢。
- 風險：個人開發者（Shen YuTao），評分只有 16 則。Mac companion app 要從官網下載（Mac App Store 的 Lite 版已不維護），**Mac 端權限、加密和隱私政策都讀不到**（官網是 JS 頁面，WebFetch 只拿到標題）。iOS 端會蒐集 analytics（Not Linked）。Lite 評論有「點擊失效、要登出才恢復」的 bug（2024-05）。
- 判定「部分滿足（最接近）」：如果實測注音、拖曳和延遲都 OK，可能就是「現成能用」的答案。但 Mac 端是從網站下載的個人開發者軟體，會拿到輔助使用權限（推論：Mac 上注入輸入通常需要 Accessibility 權限），信任成本高。

### 2.7 Mouse · Keyboard（Remote Sunrise LTD）
- 免費、Data Not Collected、HTTPS、配對要在裝置上核准、只走區網。評分 4.7，2,500 則。版本 2026.53（Oct 15），持續在更新。
- 鍵盤和中文輸入的說明不足，只寫「Better support for different keyboard layouts」。
- 判定「部分滿足」：安全和隱私描述是第三方裡最好的之一。值得和 Unified Remote、Tracepad 一起實測注音。

### 2.8 Remote KeyPad and NumPad Pro
- 同一家公司，只做數字和導航鍵盤，沒有觸控板。$9.99。判定「不滿足」（功能不對題）。

### 2.9 Remote Keyboard & Mouse（JIE WANG）
- 功能清單完整：原生 iOS 鍵盤、拖曳、多選、檔案傳輸。但隱私標籤有 **Identifiers 用於追蹤**，還會連結 Email。判定「部分滿足」。

### 2.10 KDE Connect
- 開源、TLS、Data Not Collected，手機端 iOS 和 Android 都有，macOS 有 stable 版。
- **沒查證到 macOS 端能接收「遠端輸入」**。2019 年 OMG Ubuntu 的報導（只有搜尋摘要）說 Mac port 當時能用手機當觸控板和鍵盤，而且會跳 accessibility 提示；但社群 macOS port 的 README 暗示 mouse receiver 不支援。判定「部分滿足（需要驗證）」。

### 2.11 WiFi Mouse（Necta）
- 2018 年後沒更新，隱私標籤空白，評論質疑 server 下載和簽章。判定「不滿足」。

### 2.12 Remote for Mac（Aexol）
- **CVE-2025-34089**（Tenable 頁：2025-07-03 公布、2026-04-15 更新）：Mac 端 ≤2025.7 版開啟「Allow unknown devices」時，/api/executeScript 沒有存取控制，能透過 X-Script header 注入 AppleScript，經 `do shell script` 執行。CVSS v3 9.8，v4 9.3，已有 Metasploit 模組 `remote_for_mac_rce.rb`。
- 這是「Wi-Fi server 型遙控 app 在區網開一個 HTTP API」的最壞例子，也直接說明為什麼安全是自建方案的理由之一。判定「不滿足」。

### 2.13 Bluetooth Keyboard & Mouse（AppGround，Android）
- 用的是 Android 的 BluetoothHidDevice API。官方文件頁太長，WebFetch 4 次都只讀到導覽列；搜尋摘要說是 API 28 加入，有 `registerApp`、`sendReport`，Android 12+ 需要 `BLUETOOTH_CONNECT`。**這部分只是搜尋摘要**。
- 官網只寫「any Bluetooth-enabled device」。判定「部分滿足」：如果 Ray 用 Android 可以當滑鼠，但中文一樣只能靠 Mac 端輸入法。

### 2.14 Keymote
- 2009 年的快捷鍵遙控 app。App Store 現在找不到，推定已下架。只當歷史參考。

## 3. Apple 內建方案（每條都附 Apple 網址）

1. **Mac Virtual Display 的輸入裝置**：https://support.apple.com/en-us/118521 （Published 2026-09-14，萃取）
   - 「Use your Mac computer's built-in keyboard and trackpad — or its connected Bluetooth keyboard, trackpad, or mouse — to control your Mac within Apple Vision Pro.」也就是說，**能用的是 Mac 本機的鍵盤和觸控板，或「連在 Mac 上」的藍牙鍵盤、觸控板、滑鼠**。
   - 這些 Mac 輸入裝置也能控制 visionOS app：看哪裡，圓形指標就出現在哪裡，可以捲動、點選、進入文字欄位，用 Mac 鍵盤打字。
   - 要在 Mac 的 Displays > Advanced 打開「Allow your pointer and keyboard to move between any nearby Mac or iPad」。這個設定名稱來自同一頁的搜尋摘要，WebFetch 萃取沒有逐字重現。
   - 需求：macOS 14+；Wide／Ultrawide 需要 Apple silicon、macOS 15.2+、visionOS 2.2+；兩台都開 Wi-Fi 和 Bluetooth；同一個 Apple Account 並開雙重認證。
   - **全文沒有提到 iPhone，也沒有提到 visionOS 虛擬鍵盤**。
2. **Use Mac Virtual Display（Vision Pro 使用手冊）**：https://support.apple.com/guide/apple-vision-pro/tan357ede966/visionos （萃取；連結指向 visionOS 27）
   - 「use your Mac trackpad or mouse to share the pointer between your Mac and Apple Vision Pro」；共用指標要兩台都開 Handoff；距離 10 公尺內。
   - 「**When you're using Mac Virtual Display, you can't use iPhone Mirroring with your Mac.**」
   - 鍵盤、虛擬鍵盤、配對到 Vision Pro 的藍牙配件都沒提到。
3. **Vision Pro 的藍牙配件**：https://support.apple.com/guide/apple-vision-pro/tanaa651a58d/visionos （萃取）
   - 可以連「game controller, keyboard, trackpad or mouse」，但「Not all Bluetooth accessories can be connected」。
   - **沒說配對到 Vision Pro 的鍵盤或滑鼠能不能操作 Mac Virtual Display 裡的 Mac**。依 #1，官方只保證連在 Mac 上的裝置能用。
4. **visionOS 虛擬鍵盤**：https://support.apple.com/guide/apple-vision-pro/tana14220eef/visionos （萃取）
   - 點文字欄位（例如 Notes、Freeform）就會出現；可以看著按鍵捏合，或直接用手指點；有聽寫；也能連 Magic Keyboard、Magic Trackpad、Magic Mouse。
   - **沒提到能打進 Mac Virtual Display 裡的 Mac**，也沒列出支援的輸入語言（注音、拼音沒提）。另一次 WebSearch（限 Apple 網域）也沒找到任何說可以的官方文字。
5. **visionOS 27 的新功能**：https://support.apple.com/en-us/149067 （Published 2026-09-28，萃取）
   - 和 Mac 有關的只有「Mac Virtual Display widget connects to your Mac with a tap」和 Spatial Preview（把 3D 模型從 Mac Virtual Display 拉出來）。
   - **沒有鍵盤、觸控板、滑鼠或 iPhone 輸入方面的新功能**。27.0.1 只有安全修補。
   - 背景：visionOS 2 時代就加入了滑鼠支援和 Keyboard Breakthrough。這來自 Macworld 等搜尋摘要，沒開官方頁。
6. **Universal Control**：https://support.apple.com/en-us/102459 （Published 2026-07-15，萃取）
   - 只支援 **Mac 和 iPad**（macOS 12.4+、iPadOS 15.4+），需要同一個 Apple Account 加雙重認證，距離 10 公尺內，開 Bluetooth、Wi-Fi 和 Handoff。
   - **iPhone 和 Vision Pro 都不在支援清單**。頁面另外指向 iPhone Mirroring 和 Mac Virtual Display。
7. **iPhone Mirroring**：https://support.apple.com/en-us/120421 （Published 2026-10-14，萃取）
   - 方向是 **Mac 控制 iPhone**，跟需求相反。需要 macOS 15+、iOS 18+；歐盟不能用；而且依 #2，用 Mac Virtual Display 時不能同時用。
8. **Sidecar**：https://support.apple.com/en-us/102597 （Published 2026-09-14，萃取）
   - 只有 iPad 能當 Mac 的第二螢幕，iPhone 不支援。頁面說「beginning with iPadOS 27 and macOS 27」觸控支援「greatly expanded」。和 Ray 的情境不合，他沒有 iPad，而且畫面在 Vision Pro 裡。
9. **Switch Control 的「Use Other Devices」**：https://support.apple.com/en-us/118667 （Published 2026-05-01，萃取）
   - iPhone 可以用開關（switch）控制 Mac。Mac 要先開「Allow platform switching to control your computer」，兩台在同一個 Wi-Fi，用同一個 Apple Account。
   - 頁面沒說明遠端時能不能打字，也沒說指標能不能順暢移動。Switch Control 本質上是用開關做掃描式操作（推論），不是觸控板或鍵盤，**不適合打字和順暢指標**。
10. **「Continuity Keyboard」只限 Apple TV**：https://support.apple.com/guide/tv/atvb827791d6/tvos （萃取，tvOS 27）
    - Apple TV 出現文字欄位時，iPhone 會跳通知，點開就用 iOS 鍵盤打，「Text you enter on the device automatically appears in the text field on Apple TV 4K」。
    - **頁面沒提到 Mac**。Mac 沒有這種「用 iPhone 鍵盤打字」的內建功能（我沒找到）。
11. **iPhone 能不能當 Mac 的藍牙 HID 鍵盤或滑鼠（CoreBluetooth 限制）**：沒找到 Apple 正式文件明講。
    - Apple Developer Forums https://developer.apple.com/forums/thread/725238 （2023-02 到 2024-01，沒有 Apple 員工回覆）：`CBPeripheralManager` 加入 HID service 0x1812 會回「CBErrorDomain Code=8 "The specified UUID is not allowed for this operation."」。Classic Bluetooth HID 一般 app 用不到（回覆者自稱約 85% 確定）。但同一串有人用 BLE 分析儀看到 Bluetouch 確實提供 0x1812，而且能用。
    - https://developer.apple.com/forums/thread/695844 （2021-12，零回覆）引用更舊的討論串：「HID profiles are directly consumed by the system in iOS and not passed on to the apps」。
    - `CBError.Code.uuidNotAllowed` 的官方文件頁 https://developer.apple.com/documentation/corebluetooth/cberror-swift.struct/code/uuidnotallowed 只讀到標題，沒有內文。
    - 結論：標準 API 擋 0x1812，但 App Store 上確實有宣稱能當藍牙鍵盤滑鼠、不用 helper 的 iOS app（Bluetouch、Tracepad 的 Universal 模式、Mobile Mouse Bluetooth Remote），**機制不明**。不能當成 Apple 正式支援的路徑。
12. **Mac 聽寫（Dictation）**：https://support.apple.com/guide/mac-help/mh40584/mac （萃取，版本選單是 macOS 27）
    - 可以用 Microphone 鍵、快捷鍵，或選單「Edit > Start Dictation」啟動。**選單方式不需要鍵盤，用指標就能點**。
    - Apple silicon 上「you can still use the keyboard while you speak」；設定裡可以看是否在裝置上處理；可以選麥克風來源。
    - 語言：https://www.apple.com/macos/feature-availability/ （萃取）列出 Dictation 支援「**Mandarin (Taiwan)**」「Mandarin Chinese (China mainland)」和粵語。
    - 這是用 Mac 內建、不打字輸入中文的替代路徑，但不是打字。在 Vision Pro 裡麥克風從哪裡收音，沒有查證。
13. **Voice Control**：語言來自 https://www.apple.com/macos/feature-availability/ （萃取），支援「Mandarin Chinese (Taiwan)」。Voice Control 的使用手冊頁（mh40719）**只有搜尋摘要**，沒有開。
14. **輔助使用鍵盤（Accessibility Keyboard）**：https://support.apple.com/guide/mac-help/mchlc74c1c9f/mac （萃取，macOS 27）
    - 「an onscreen keyboard that lets you use your Mac without a physical keyboard」，可以用指標點按，也有 Dwell。
    - 頁面沒提和中文輸入法搭配的細節，只說可以當 Keyboard Viewer，切換輸入來源後能打不同語言。如果只有「手機當觸控板」，這是能在 Mac 上打字的內建備案，但很慢。
15. **Magic Trackpad 相容 Vision Pro**：https://support.apple.com/en-us/121932 （萃取）列出「Apple Vision Pro with the latest version of visionOS」、macOS 15.1+、iPadOS 18.1+。
16. **HID 送中文的技術限制（非 Apple 文件，作為 §0-4 的佐證）**：https://docs.qmk.fm/features/unicode （萃取）
    - macOS 要先加「Unicode Hex Input」輸入來源，才能用按鍵序列送 Unicode。
    - 「may disable some Option-based shortcuts such as Option+Left and Option+Right」。
    - 所以 HID 型 app 要送「組好的中文字」，要嘛改 Mac 的輸入來源，要嘛只能送按鍵、交給 Mac 的注音輸入法組字。

## 4. 硬體替代（只當背景）

| 名稱 | 重點 | 來源 | 讀了多少 |
|---|---|---|---|
| Logitech K400 Plus 無線觸控鍵盤 | $29.99（特價，原價 $34.99）；USB Unifying 接收器（頁面沒提 Bluetooth）；官方相容清單只有 Windows、Android 7+、ChromeOS，**沒有 macOS**（搜尋摘要說 Mac 上能基本使用）；電池最長 18 個月 | https://www.logitech.com/en-us/products/keyboards/k400-plus-touchpad-keyboard.920-007119.html | 官方產品頁（萃取） |
| Apple Magic Trackpad（USB-C，2024） | 16.0 × 11.49 cm，230 g，一次充電約可用一個月；相容 Mac（macOS 15.1+）和 Vision Pro。放在大腿或沙發扶手上，用 Mac Virtual Display 是官方支援的路徑。價格（黑色 $149）**只來自搜尋摘要** | https://support.apple.com/en-us/121932 | Tech Specs 頁（萃取）；價格只有搜尋摘要 |
| Twiddler 4（單手和弦鍵盤＋光學觸控板） | Bluetooth 或 USB-C，單手握持就能打字和移動指標；要學和弦打法 | https://mytwiddler.com （**403，沒讀到**） | 僅搜尋摘要 |
| Logitech K830（客廳背光鍵盤＋觸控板） | 只有 K830 TV 版有 Bluetooth，Mac 相容說法不一，多家零售商顯示已停產 | （沒開官方頁） | 僅搜尋摘要 |

硬體結論：要做到「沙發上，雙手不懸空」，最穩的官方路徑是 Magic Trackpad 放大腿上，加上 Mac Virtual Display，再配一把小藍牙鍵盤。但這等於又多帶兩個東西，而且一樣要找地方放。K400 一類的客廳鍵盤是「一個裝置搞定鍵盤和觸控板」，可是 Mac 不在官方支援清單裡。

## 5. 結論：有沒有現成的可以直接用？

**短答：滑鼠和觸控板（需求 B）有現成的，很可能可以直接用。「用手機原生注音或拼音打字，文字送到 Mac」（需求 A）沒有任何產品在官方文件裡明確保證支援中文。只有 Tracepad 明寫「any input method」，Unified Remote 和 Remote Mouse 是間接暗示。所以目前是「部分滿足」，值得先花大約 30 分鐘實測 2–3 款，再決定要不要自己做。**

Apple 內建的部分很明確：
- Apple **沒有**讓 iPhone 當 Mac 鍵盤或觸控板的內建功能。Universal Control 只支援 Mac 和 iPad；iPhone Mirroring 方向相反；用鍵盤打字的 Continuity 功能只給 Apple TV；Switch Control 不是拿來打字或順暢移動指標的。
- Mac Virtual Display 官方只保證 **Mac 本機或連在 Mac 上** 的鍵盤、觸控板、滑鼠可以用。iPhone 和 visionOS 虛擬鍵盤都沒被提到。visionOS 27 也沒有新增這方面的功能。
- 推論（未實測）：第三方 app 不論是用 Mac helper 注入事件，還是把手機當藍牙 HID 連在 Mac 上，對 Mac Virtual Display 來說都算「Mac 的輸入」，理論上能用。指標能不能跨到 visionOS app 就不確定了。

建議實測順序（不構成購買建議）：
1. **Tracepad**：唯一明寫可以「用任何輸入法打字、送到 Mac」的產品，走 Bluetooth 或 USB，觸控板手勢最完整。代價是 Mac 端 helper 由個人開發者從網站發布，權限和隱私不透明。
2. **Mouse · Keyboard（Remote Sunrise）**：免費、Data Not Collected、HTTPS、配對要核准、更新頻繁。注音行為不明。
3. **Unified Remote**：老牌，iOS 和 Android 都有，$4.99 買斷，Data Not Collected，有密碼和加密，支援第三方鍵盤。注音行為不明。
4. 如果只要滑鼠、不想在 Mac 裝東西：**Mobile Mouse Bluetooth Remote**（訂閱制），但中文要靠 Mac 端注音輸入法，手機當 QWERTY 用。

自己做的理由（現成產品的缺口）：
1. **中文 IME 沒保證**：多數產品只寫「any language」或「keyboard layouts」。HID 型（不用裝 helper 的那類）技術上就沒辦法直接送組好的中文（見 §3-16），只能退回「手機當 QWERTY、Mac 端組字」，用不到手機的注音選字。要真正支援，Mac 端得注入組好的文字（例如 CGEvent Unicode 字串或貼上），還要處理組字中（marked text）、刪除語意和選字列。這些都沒有任何產品文件說明。
2. **安全**：Wi-Fi server 型 app 會在區網開服務。Remote for Mac 的 CVE-2025-34089（未授權 RCE，CVSS 9.8）是實例；WiFi Mouse 有未簽章、HTTP 下載的質疑，而且 2018 年後停更。鍵盤 app 會經手所有打的字，包括密碼，但多數產品沒有公開加密和配對設計，只有 Mouse · Keyboard（HTTPS 加核准）和 KDE Connect（TLS）說得比較清楚。
3. **隱私和廣告**：Remote Mouse、Bluetouch、Remote Keyboard & Mouse 的隱私標籤都有「用於追蹤」的資料；多數還有廣告或訂閱。
4. **手機端免安裝**：這次調查的產品手機端全都是原生 app，沒看到用手機瀏覽器開網頁就能用的方案。不過我沒有專門搜尋這一類，不能排除有。
5. **沙發、單手和 Vision Pro 場景**：沒有任何產品是為「戴 Vision Pro、透過 passthrough 看手機、單手拇指同時打字和操作觸控板」設計的。沒看到單手模式、大熱區、觸覺回饋、低頭不看也能用之類的設計（Remote Mouse 有左手模式）。延遲、拖曳斷掉和重連問題在多款的評論中都出現過（Unified Remote、Mobile Mouse Server、Tracepad Lite）。
6. **成本**：好用的選項多半是訂閱制，或有多項 IAP（Mobile Mouse Bluetooth 每年 $29.99；Remote Mouse Pro 每年 $13.99）。

## 6. 工具使用統計

- 開始：11:49（台北）；結束：12:01（台北）。用 `TZ=Asia/Taipei date '+%H:%M'` 取得。
- WebSearch ×41
- WebFetch ×52，其中 13 次失敗或沒拿到正文：
  - Google Play ×2（內容被截斷）
  - NVD ×1（只有標題）
  - APKMirror ×1（403）
  - Android BluetoothHidDevice 文件 ×4（只讀到導覽列）
  - tracepad.site ×2（只有標題）
  - mytwiddler.com ×1（403）
  - apple.com shop 列表頁 ×1（沒有商品）
  - CBError 文件 ×1（只有標題）
- Bash ×3（取時間、查目錄）
- ToolSearch ×1（載入 WebSearch 和 WebFetch）
- Write ×1（本檔）
