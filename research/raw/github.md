# PKM-1 GitHub 開源專案調查（手機遙控電腦鍵盤／滑鼠，重點 macOS）

- 調查者：Claude 研究子代理（由 PKM-1 父 session 派出）
- 日期：2026-10-23（台北），開始 11:49，結束見文末「工具使用統計」
- 星數、最後 commit、release、授權：全部在 2026-10-23 用 `gh api repos/OWNER/REPO`（唯讀、已登入的 GitHub API）＋ `/releases/latest`＋`/commits?per_page=1` 取得，原始輸出存在 scratchpad `meta.tsv`。「最後更新」= 預設分支最後一次 commit 的日期；release 另外標註。
- 「讀了多少」的定義：
  - **程式碼（clone 唯讀）**：shallow clone 到 `~/third-party/`，逐檔讀碼，**未安裝依賴、未建置、未執行**。
  - **README＋部分檔案（gh api）**：讀了 README，另外用 `gh api .../contents/...` 抓幾個原始檔來讀（未 clone）。
  - **README**：只讀了 README（用 `gh api .../readme` 抓的原文）。
  - **只看 API metadata**：只有 repo metadata，沒讀內容。
- 規則：只列實際打開過的 repo；沒有讀這台機器上任何其他代理對同一任務的產出。

---

## 1. 總表

> 平台欄格式：手機端 → 電腦端。「Mac✓」= README 或程式碼明確支援 macOS。

| 名稱 | 網址 | 星數 | 最後更新（commit／release） | 授權 | 平台 | 做法 | 能借什麼 | 讀了多少 | 怎麼找到 |
|---|---|---|---|---|---|---|---|---|---|
| Remote Touchpad | https://github.com/Unrud/remote-touchpad | 692 | 2026-10-11／v1.5.5（2026-09-13） | GPL-3.0 | 任意瀏覽器 → Linux（portal/uinput/X11）、Windows、Mac✓ | Go 伺服器內嵌網頁；WebSocket 文字指令；macOS 用 cgo 呼叫 CGEvent | 密鑰放 URL `#fragment`＋HMAC challenge-response；分段線性加速度表；小數累積 | 程式碼（clone 唯讀） | GitHub API 搜尋 `remote-touchpad`；WebSearch 1 也有 |
| MacPilot | https://github.com/joonlab/MacPilot | 25 | 2026-08-03 commit（API pushed_at 2026-08-02）／沒有 release | MIT | 任意瀏覽器 → Mac✓ 13+（另有 Windows C# helper） | Swift 選單列 App，NWListener 自己寫 HTTP＋WS，CGEvent 注入；vanilla JS 網頁 | **架構跟我們幾乎一樣**；1€ 濾波、120Hz 伺服器端插值、真修飾鍵 down/up、IME 差異演算法 | 程式碼（clone 唯讀） | GitHub API 搜尋 `phone trackpad in:description`；WebSearch 1 |
| VibeCast | https://github.com/Pls-1q43/VibeCast | 54 | 2026-06-24／v0.4.0（2026-06-24） | MIT | 任意瀏覽器 → Mac✓ 13+ | Swift 選單列 App＋TS 網頁；**用手機輸入法（含中文／語音）打字**，Mac 以 AXValue 直寫或剪貼簿貼上同步到目標 App | 中文輸入法 composition 節流／防抖、剪貼簿備份還原、24-byte 隨機配對 token、每連線限流 | 程式碼（clone 唯讀） | GitHub API 搜尋 `remote keyboard phone in:description` |
| OpenCouchpad | https://github.com/maros-o/opencouchpad | 43 | 2026-10-12／v0.3.0（2026-10-11） | MIT | 任意瀏覽器 → Linux、Windows、Mac（README 標 experimental） | Go 單一執行檔；**移動用 5-byte 二進位 WS 幀**；macOS 用 purego 呼叫 CGEvent | 速度式加速度＋EMA、慣性捲動、PIN 錯誤升級鎖定、DNS-rebinding Host 白名單、捲動 continuous 旗標、依鍵盤配置找鍵碼 | 程式碼（clone 唯讀） | GitHub API 搜尋 `remote-touchpad` |
| Sofatap | https://github.com/chekusu/sofatap | 132 | 2026-10-22／只有 prerelease（v0.8.1-beta.1 2026-10-19 等） | MIT | 原生 iPhone（iOS 17+）／Android App → Windows、Mac✓ 15+、Linux（.NET 10 receiver） | QR 配對＝host+port+32-byte token+憑證 SHA-256 指紋；`wss://` 憑證釘選；Bearer token；Quartz 注入；Mac 用 AX 做「即時文字編輯」 | **Unicode 文字每段 ≤20 UTF-16 單位且不切開 surrogate pair**；嚴格協定（數值上限、未知欄位拒絕、`input_partial` 不重送）；斷線釋放按鍵 | README＋部分檔案（gh api：`PROTOCOL.md`、`host/MacInput.cs`、`host/PairingUri.cs` @`8e6dd91`） | GitHub API 搜尋 `remote mouse iphone mac` |
| CmdPalm | https://github.com/rahatsagor/CmdPalm | 93 | 2026-10-19／v0.3.2（2026-10-19） | AGPL-3.0 | 任意瀏覽器（可加到主畫面）→ Mac✓ 15+ Apple silicon | 選單列 App；QR／六位數 PIN／Mac 端按允許三選一配對；可選「Encrypted Connection」需在手機裝憑證 | 配對 UX（QR＋PIN＋Mac 端核准）、單拇指捲動條、Mac 端存每台裝置設定 | README | GitHub API 搜尋 `phone trackpad in:description` |
| FingerFly | https://github.com/narendraio/fingerfly | 17 | 2026-05-25／沒有 release | MIT | 任意瀏覽器 → Mac✓ | Python 伺服器（HTTP 8080＋WS 8081）＋Quartz；單檔 index.html，60fps＋EMA 平滑 | 手勢表（3 指 Mission Control 等）、靈敏度 0.5–5×、捲動倍率設定 | README | GitHub API 搜尋 `phone trackpad in:description` |
| Phone Web Remote | https://github.com/hello-claude/phone-web-remote | 1 | 2026-06-06／沒有 release | MIT | 任意瀏覽器 → Mac✓、Windows | Node＋`@nut-tree-fork/nut-js`；每次啟動換 4 位數 PIN；**非 ASCII（中文／emoji）用 `pbcopy`＋⌘V 貼上** | 剪貼簿貼上當 CJK 備援的例子；橫向版面（左鍵盤右觸控板） | README | GitHub API 搜尋 `remote trackpad web macos` |
| Glasspad | https://github.com/Soham109/glasspad | 4 | 2026-10-22／v0.6.1（2026-10-22） | MIT | 原生 iOS 18+／Android 10+ App → Mac✓ 14+、Windows 10+ | 掃 QR 後電腦端按「Allow」核准；11 種模式 | 「電腦端按允許」核准流程；剪貼簿雙向 | README | GitHub API 搜尋 `remote mouse iphone mac` |
| iController | https://github.com/Mehver/iController | 12 | 2026-10-17／v0.8.3（2026-10-13） | BSD-3-Clause（LICENSE 檔），README 寫 "All rights reserved" | 任意瀏覽器 → Windows；Mac 只到舊版 v0.5.1 | Python Quart＋PyAutoGUI＋React 網頁 | 「文字貼上」功能（README 只列功能，沒細節） | README | GitHub API 搜尋 `touchpad phone macos` |
| Axon | https://github.com/Kaia-Alenia/Axon | 40 | 2026-08-23／v1.6.6（2026-08-23） | GPL-3.0 | 原生 Android App → Linux、Windows、Mac✓ | Go 伺服器；TCP/WS 6969＋**UDP 6970 快速輸入**＋藍牙 RFCOMM；終端機 QR 配對 | 移動走 UDP 降延遲的想法 | README | GitHub API 搜尋 `remote-touchpad` |
| webbymouse | https://github.com/gasolin/webbymouse | 80 | 2016-05-17／0.4.1（2015-08-04） | MIT | 瀏覽器 → Mac（當時只支援 Mac） | NW.js＋RobotJS＋socket.io；陀螺儀 Air Mouse；可選 passcode | 歷史參考；**已停更約 10 年** | README | GitHub API 搜尋 `web touchpad` |
| KDE Connect（kdeconnect-kde） | https://github.com/KDE/kdeconnect-kde （KDE invent 的 GitHub 鏡像） | 4071 | 2026-10-23／GitHub 上沒有 release；`plugins/mousepad/macosremoteinput.mm` 最後 commit 2026-09-25（`1c02590`） | API 顯示 none；README 寫 GPL v2 與 v3；該檔 SPDX：`GPL-2.0-only OR GPL-3.0-only OR LicenseRef-KDE-Accepted-GPL` | Android／iOS App → Linux（官方）；README 說 macOS／Windows 尚無官方 release | TLS 配對；mousepad 外掛；macOS 用 CGEvent＋`QCursor::setPos` | 「按住鍵時移動要改送 Dragged 事件」的註解；成熟協定 | README＋部分檔案（gh api：`macosremoteinput.mm`） | 任務指定名單；WebSearch 2 也找到 lxr.kde.org 上同一檔案 |
| lan-mouse | https://github.com/feschber/lan-mouse | 5405 | 2026-09-26／v0.11.0（2026-06-12） | GPL-3.0 | 電腦 ↔ 電腦（Linux、Windows、Mac✓） | Rust；**DTLS（WebRTC.rs）加密**；遠端要按 Authorize 並比對憑證指紋 | 憑證指紋授權模型；macOS 移動事件同時設 delta 欄位 | README＋部分檔案（gh api：`input-emulation/src/macos.rs`，最後 commit `2789a46` 2026-09-23） | 任務指定名單 |
| Deskflow | https://github.com/deskflow/deskflow | 30039 | 2026-10-21／v1.27.0（2026-10-01） | GPL-2.0（附 OpenSSL 例外） | 電腦 ↔ 電腦（Windows、Mac✓ 13+、Linux 含 Wayland、BSD） | Synergy 系 KVM；預設 TLS；剪貼簿共享 | macOS 要同時授權 App 與 `deskflow` 行程的 Accessibility（README 提醒），升級後要先移除舊授權 | README | 任務指定名單 |
| Input Leap | https://github.com/input-leap/input-leap | 8320 | 2025-11-27／v3.0.3（2025-06-13）；**API 顯示 archived=true** | API 顯示 NOASSERTION | 電腦 ↔ 電腦（Mac✓） | Barrier 的 fork | 只當紅旗：已封存 | README＋API | 任務指定名單 |
| Barrier | https://github.com/debauchee/barrier | 30946 | 2022-02-04／v2.4.0（2021-11-01） | API 顯示 NOASSERTION | 電腦 ↔ 電腦（Mac✓） | Synergy 1.x 系 KVM | 只當紅旗：Input Leap README 說 "barrier is considered unmaintained" | README | 任務指定名單 |
| robotgo | https://github.com/go-vgo/robotgo | 10878 | 2026-10-22／v1.3.7（2026-10-22） | Apache-2.0 | 函式庫（Go）：Mac✓、Windows、Linux | macOS 走 purego 呼叫 CGEvent；`PasteStr` 走剪貼簿 | 逐字元 Unicode 事件＋剪貼簿兩條路 | README＋部分檔案（gh api：`darwin/cg.go`、`darwin/keyboard.go` @`c0b5fa8`） | 任務指定名單 |
| nut.js（＋libnut-core） | https://github.com/nut-tree/nut.js ／ https://github.com/nut-tree/libnut-core | 2857／56 | nut.js 2024-05-01／v4.2.0（2024-04-10）；libnut-core 2024-05-31 | nut.js：API 顯示 none；libnut-core：Apache-2.0 | 函式庫（Node）：Mac✓、Windows、Linux（不支援 Wayland） | C 原生模組；Unicode 用 CGEventKeyboardSetUnicodeString | README 說預建套件要訂閱（"The Price of Open Source"）；**公開 repo 自 2024 年中無 commit** | README＋部分檔案（gh api：libnut-core `src/macos/keypress.c` @`6bbe582`） | 任務指定名單 |
| cliclick | https://github.com/BlueM/cliclick | 2031 | 2025-08-23／5.1（2022-08-14） | API 顯示 NOASSERTION | CLI：Mac✓ 10.15+ | Objective-C 命令列工具：`m:` 移動、`c:` 點擊、`dd:/du:` 拖曳、`t:` 打字、`-e` 移動 easing | 只適合當測試腳本；每個事件開一個行程太慢，不適合即時觸控板 | README | 任務指定名單 |
| RemoteMouse-3.008-Exploit | https://github.com/p0dalirius/RemoteMouse-3.008-Exploit | 65 | 2025-02-11 | API 顯示 none | （攻擊工具，針對商業 App「RemoteMouse」3.008） | README：連到 RemoteMouse 服務就能「virtually press arbitrary keys and execute code」 | **安全教訓：沒認證的按鍵注入＝遠端執行程式碼** | README | GitHub API 搜尋 `remote mouse in:name` |

### 看過但排除（不算進上表）
- `cyd3r/remote-touchpad`（1★，最後 commit 2024-05-27，hammer.js＋RobotJS 原型）：只看 API metadata，加上 WebSearch 摘要。
- `nweii/trickpad`（5★）：用 Magic Mouse／觸控板手勢觸發快捷鍵，跟手機遙控無關。只看 API metadata。
- `mattsilber/gome`（1★，最後 commit 2020-03-01）：只看 API metadata。
- WebSearch 摘要提到的 MouseController（slon3studio）、Darwin BT Remote（jqssun）、Type Away（npm）、plodb Remote Keyboard：**沒打開 repo，不列入、不下結論**。

---

## 2. 逐專案筆記

### 2.1 Unrud/remote-touchpad（GPL-3.0，clone `792cd0f`）
- **傳輸**：Go `net/http`＋`golang.org/x/net/websocket`，指令是短文字協定（例如 `m{dx};{dy}`），見 `webdata/app/inputcontroller.mjs:47,79`。
- **認證**：啟動時產生 12 byte 隨機密鑰（`crypto/rand`），印成 `http://host/#<secret>` 和 QR 碼（`main.go:165-172, 281-284`）。**密鑰在 URL fragment**，瀏覽器不會把它送到伺服器，也不會出現在伺服器 log 或 Referer。WS 連上後伺服器送 challenge，客戶端回 `HMAC-SHA256(key=challenge, msg=secret)`（`main.go:146-163, 252-262`；`webdata/app/socket.mjs:22-26, 45`）。challenge 的產生頻率限制在每秒 10 個、突發 10 個（`main.go:47-48, 228-229`）。可選 TLS（`--cert/--key`），沒開會印警告（`main.go:288-289`）。
- **macOS 注入**：cgo 呼叫 CGEvent；用 `kCGEventSourceStatePrivate` 建 event source（`controller_darwin.go:60`）；文字逐 rune 用 Unicode string 送（`:144-152`）。
- **UX**：1 指移動、2 指捲動、1/2/3 指點擊＝左／右／中鍵；點一下後 250ms 內再按住＝拖曳（`touchpad.mjs:140-185`）；加速度表（`:27-32`）。
- **紅旗**：challenge 用 `math/rand`（非密碼學亂數），比對也不是常數時間（`main.go:142-151`）。不過 challenge 只是 nonce，密鑰本身用的是 `crypto/rand`，風險不高。沒開 TLS 時，主動中間人仍能劫持連線。

### 2.2 joonlab/MacPilot（MIT，clone `9333dc2`）
- **架構**：Swift 選單列 App，`NWListener` 聽 8765 埠（`HelperServer.swift:25`），自己寫 HTTP＋WebSocket framing（`HTTPWebSocketConnection.swift`）；網頁是無框架的 vanilla JS，由 Mac 直接提供。README 說可用 launchd 常駐，也可經 Tailscale 從外網連。**這是最接近我們目標架構的專案。**
- **注入**：所有事件都在一條 serial queue 上依序注入（`EventInjector.swift:9-21`）。
- **認證**：PIN 配對是**選用功能，預設關閉**（`Pairing.swift:4-7, 60-65`）。開啟後是 6 位數 PIN，`GET /pair?pin=` 驗證通過就發 HttpOnly、SameSite=Lax、一年效期的 cookie（`HTTPWebSocketConnection.swift:170-188`）。
- **紅旗**：(1) 預設任何同網段裝置都能控制；(2) token 是 `SHA256("macpilot-pair-v1:"+PIN)`，可以從 PIN 推算出來，只有 10⁶ 種（`Pairing.swift:47-50`）；(3) `/pair` 沒有嘗試次數限制，也沒檢查 Origin／Host；(4) 全程走 HTTP 明文；(5) PIN 放在 GET query 裡。
- **UX 亮點**：1€ 濾波、依網路狀況調頻率的送出佇列、捲動慣性、3 指滑動、捏合縮放；鍵盤用 textarea 比對差異＋處理 composition（細節見第 3 節）。

### 2.3 Pls-1q43/VibeCast（MIT，clone `374e37b`）
- **定位**：手機當 Mac 的「輸入法面板」，用系統輸入法、微信輸入法或語音打字，Mac 把整段文字「鏡像」到指定 App（Codex、Notion、Obsidian…）的輸入框，確認同步完成後再送出 Enter。**跟我們「手機輸入法打好的中文送到 Mac」需求最接近。**
- **文字寫入**：優先用 Accessibility 的 `AXValue` 直寫並讀回驗證；失敗才改用剪貼簿（先備份→寫入→⌘V→驗證→還原）（`TextWriter.swift:50-85, 240-287`）。另有 editor 模式：只替換本輪插入的那一段。
- **認證**：用 `SecRandomCopyBytes` 產生 24 byte 長期 token，存在 UserDefaults，常數時間比對（`Session/Pairing.swift:27-44`）；WS 的 `hello` 必須帶 token（`SessionManager.swift:278-282`）；每條連線限流 40 則／秒（`MessageRateLimiter.swift:9`）。
- **紅旗**：token 放在 **URL query**（`?token=`，`SessionManager.swift:1266`；網頁端 `web/src/app.ts:68-73` 讀出後存進 localStorage），會進瀏覽器歷史、也可能進 log。HTTP 回應帶 `Access-Control-Allow-Origin: *`（`Server/HTTPRequest.swift:57`）。走 HTTP 明文。

### 2.4 maros-o/opencouchpad（MIT，clone `c506385`）
- **傳輸**：移動和捲動用 5 byte 的二進位 WS 幀（type u8＋dx i16＋dy i16，little-endian），直接在 touch handler 裡送出；只有 socket 積壓超過 512 byte 才合併（`web/js/conn.js:8, 114-141`）。其他指令用 JSON。單則訊息上限 64 KiB（`internal/server/ws.go:76`）。
- **認證**：可選 PIN。cookie 值是 `HMAC(key="opencouchpad-session-v1", PIN)`，用常數時間比對（`server.go:76-80, 201-206`）。錯 5 次後，每多錯一次多鎖 30 秒，且以 IP 計算（`server.go:301-341`）。檢查 Host header 擋 DNS rebinding（`server.go:94-125`）。WS 用 gorilla `Upgrader` 且沒自訂 `CheckOrigin`，所以套用 gorilla 預設的同源檢查（`server.go:71-74`）。README 建議「家用網路可不設 PIN，共用網路要設」。
- **macOS**：用 purego 載入 CoreGraphics，不需要 cgo。注入前先確認 Accessibility 權限，每 3 秒重查一次，沒權限就回報給手機（`cgevent_darwin.go:398-407`）。
- **紅旗**：PIN 預設不設，且 token 由 PIN 推出（跟 MacPilot 同類問題，但它有鎖定機制）；README 把 macOS 標為 experimental。

### 2.5 chekusu/sofatap（MIT，gh api 讀 `8e6dd91`）
- 原生 iPhone App，**不是網頁**，但它的 Mac receiver 做法和協定設計很值得參考。
- **配對**：QR 內容是 `sofatap://pair?host=&port=&token=<32 byte base64url>&fingerprint=<伺服器葉憑證 SHA-256>`；之後連 `wss://host:port/control`，帶 `Authorization: Bearer`，手機比對憑證指紋（釘選）；伺服器拒絕瀏覽器 Origin（`PROTOCOL.md` Pairing／Connection 段）。
- **協定**：每個 frame 都有 UUID `id`，伺服器回 ack；`move` 每個數值限 ±500、`scroll` 限 ±1200；未知欄位或型別一律拒絕；`text` 上限 16,000 個 UTF-16 單位。如果文字可能只送出一部分，回 `input_partial:`，客戶端不能自動重送。斷線、逾時或關閉時釋放所有按住的鍵。
- **Mac 文字注入**：見第 3 節 (b)（每段 ≤20 UTF-16 單位）。另外有 AX「即時編輯」：讀取目標欄位全文和選取範圍，再精準替換。
- **紅旗**：iOS 版還在 TestFlight beta；README 自己寫明很多實機驗收還沒做。

### 2.6 其他（只讀 README）
- **CmdPalm**（AGPL-3.0）：網頁 PWA＋Mac 選單列。配對可以用 QR、六位數 PIN 或在 Mac 端核准；可選加密連線，但手機要另外安裝憑證。**AGPL：只借概念，不複製程式碼。**
- **FingerFly**：Python Quartz；單檔網頁 60fps＋EMA；設定有靈敏度 0.5–5×、捲動 0.1–3×、點擊開關。README 沒提到任何認證機制（紅旗：看起來同網段誰都能連；**只讀了 README，沒有讀碼確認**）。
- **Phone Web Remote**：nut.js fork＋每次啟動換的 4 位數 PIN；非 ASCII 用 `pbcopy`＋⌘V。4 位數 PIN 太弱（README 沒提限流）。
- **Glasspad**：原生 App；掃 QR 後要在電腦端按 Allow（第二道人工核准）。
- **iController**：Mac 支援停在 v0.5.1，目前不適合我們。
- **Axon**：UDP 快速通道、藍牙 RFCOMM；安裝方式是 `curl | bash`。
- **webbymouse**：2016 年就停更，只有歷史參考價值。
- **KDE Connect**：成熟的 TLS 配對協定；但 README 說 macOS 沒有官方 release。
- **lan-mouse／Deskflow／Input Leap／Barrier**：都是「電腦對電腦」的 KVM，不支援手機端；可借的是加密與授權模型（DTLS＋指紋、預設 TLS）。Input Leap 已封存，Barrier 已停止維護。
- **robotgo／nut.js／cliclick**：函式庫或 CLI。我們的 Mac 端是 Swift，直接呼叫 CGEvent 就好，不需要它們；可對照它們處理 Unicode 的方式（第 3 節）。nut.js 預建套件要付費訂閱，公開 repo 自 2024 年中無 commit。

---

## 3. 程式碼深讀（file:line 引用）

> 路徑都相對於 `~/third-party/`（clone）；gh api 讀的檔案會註明 commit。

### (a) macOS 上怎麼注入滑鼠移動／點擊／捲動

**MacPilot `MacHelper/Sources/EventInjector.swift`**
- 建立並送出滑鼠事件（`:255-262`）：
  ```swift
  guard let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: button) else { return }
  event.flags = []  // 清掉殘留修飾鍵，避免點擊變成 Control+點擊（＝右鍵）
  if clickState > 1 { event.setIntegerValueField(.mouseEventClickState, value: Int64(clickState)) }
  event.post(tap: .cghidEventTap)
  ```
- 按住按鍵時移動改送 `.leftMouseDragged`／`.rightMouseDragged`（`:165-173`）。
- **平滑移動**：收到的 delta 先累加到小數精度的虛擬目標點，再用 120Hz 的 DispatchSourceTimer 依「封包到達間隔的 EMA」插值追上目標（`:99-163`）；如果實體滑鼠移動超過 8px，就重新同步位置（`:119-123`）；限制游標在螢幕範圍內（`:130, 410`）。
- 捲動（`:264-275`）：`CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: -dy, wheel2: -dx, wheel3: 0)`，再 `.post(tap: .cghidEventTap)`。
- 斷線時放開按住的滑鼠鍵（`:24-35`）。

**Unrud `inputcontrol/controller_darwin.go`**
- 用私有 event source（`:60`）：`CGEventSourceCreate(kCGEventSourceStatePrivate)`。
- 點擊（`:202-246`）：自己記錄雙擊時序，`kCGMouseEventClickState` 最多設到 2（`:237, 239`），送到 `kCGHIDEventTap`。
- 移動（`:248-271`）：先 `CGEventGetLocation` 取目前位置再加上 delta；按住按鍵時改成 `kCGEventLeftMouseDragged`。**沒有限制在螢幕範圍內。**
- 捲動（`:273-281`）：`CGEventCreateScrollWheelEvent2(src, kCGScrollEventUnitPixel, 2, dy, dx, 0)`。

**opencouchpad `internal/input/cgevent_darwin.go`**
- 常數（`:83-87`）：`fieldClickState=1`、`fieldDeltaX=4`、`fieldDeltaY=5`、`fieldScrollContinue=88`。
- 移動（`:456-484`）：先限制在螢幕內（`clamp`，`:429-454`，每 2 秒重查一次 `CGGetActiveDisplayList`），再設 delta 欄位：
  ```go
  cgEventSetIntegerValueField(ev, fieldDeltaX, int64(dx))
  cgEventSetIntegerValueField(ev, fieldDeltaY, int64(dy))
  ```
- 捲動（`:486-509`）：保留 1/120 刻度的餘數讓慢速捲動也平滑，並設 `fieldScrollContinue=1`（連續捲動，像觸控板）。
- 點擊（`:511-550`）：同一個鍵、距離在 5px 內、且在雙擊間隔內，就把 clickCount 加 1。

**KDE Connect `plugins/mousepad/macosremoteinput.mm`（gh api，檔案最後 commit `1c02590`）**
- 移動用 `QCursor::setPos`；但註解寫明按住左鍵時這樣**不會產生 dragged 事件**，所以要改送 `kCGEventLeftMouseDragged`（`:230-243`）。
- 捲動（`:135-137`）：`CGEventCreateScrollWheelEvent(NULL, kCGScrollEventUnitPixel, 2, dy, -dx)`。

**lan-mouse `input-emulation/src/macos.rs`（gh api，`2789a46`）**：移動也設 `MOUSE_EVENT_DELTA_X/Y`，送到 HID tap（`:299-336`）。

**sofatap `host/MacInput.cs`（gh api，`8e6dd91`）**：`CGEventSourceCreate(-1)`（private）；移動同時設 field 4/5（delta）；**送到 session tap**（`CGEventPost(1, …)`，註解寫 "Session tap stays within the logged-in user's GUI session"）（`:389-414`）；限制游標在最近的螢幕上（`ClampToDisplays`，`:273-289`）。

### (b) Unicode／CJK 文字怎麼注入

| 專案 | 做法 | 位置 |
|---|---|---|
| MacPilot | **整串字一次塞進一個** keyDown＋keyUp 事件（`virtualKey: 0`＋`keyboardSetUnicodeString`），不經過 Mac 的輸入法 | `EventInjector.swift:322-334` |
| Unrud | 逐 rune，每個 rune 一組 down/up，各自設 Unicode string | `controller_darwin.go:76-91, 144-152` |
| opencouchpad | 逐 rune；`\n`→Return 鍵、`\t`→Tab、`\b`→Backspace；其他字元用 Unicode string，flags 設 0 | `cgevent_darwin.go:646-687` |
| **sofatap** | **每段 ≤20 個 UTF-16 單位，不切開 surrogate pair**，拒絕孤立 surrogate 和 NUL；換行改送 Return（keyCode 0x24） | `host/MacInput.cs:245-271`（`8e6dd91`） |
| KDE Connect | 逐 **UTF-16 code unit** 各送一個 keyDown（**沒有 keyUp**），送到 `kCGSessionEventTap` | `macosremoteinput.mm:180-188` |
| robotgo | 逐 rune 用 `utf16.Encode` 後設 Unicode string；另有 `PasteStr` 走剪貼簿 | `darwin/keyboard.go:203-207`、`robotgo_pub.go:363-366`（`c0b5fa8`） |
| libnut（nut.js） | 逐字元；大於 0xFFFF 時自己算 surrogate pair | `src/macos/keypress.c:110-136`（`6bbe582`） |
| VibeCast | 不用 Unicode 鍵盤事件；改用 **AXValue 直寫並驗證 → 剪貼簿備份＋⌘V＋還原** | `TextWriter.swift:50-85, 240-287` |
| Phone Web Remote | 非 ASCII 一律 `pbcopy`＋⌘V（README 說明，未讀碼） | README |

sofatap 的分段核心（`MacInput.cs:257-267`）：
```csharp
while (index < normalized.Length && normalized[index] != '\n' && index - start < 20) {
    var units = char.IsHighSurrogate(normalized[index]) ? 2 : 1;
    ...
    if (index - start + units > 20) break;
    index += units;
}
```
VibeCast 剪貼簿路徑（`TextWriter.swift:241-252`）：
```swift
let savedItems = backupPasteboard(pasteboard)
defer { restorePasteboard(pasteboard, items: savedItems) }
pasteboard.clearContents(); pasteboard.setString(text, forType: .string)
Thread.sleep(forTimeInterval: 0.03)
guard KeyboardSynth.press(KeyShortcut(modifiers: ["command"], key: "v")) else { ... }
Thread.sleep(forTimeInterval: 0.12)
```
- **Apple 官方文件**（用 sosumi 查 `CGEvent.keyboardSetUnicodeString`）**沒有寫長度上限**，但寫了："application frameworks may ignore the Unicode string in a keyboard event and do their own translation based on the virtual keycode"。所以 Unicode 事件路徑在某些 App 可能沒反應，需要剪貼簿當備援。20 單位上限是 sofatap 的實作選擇，**我們要自己實測**（MacPilot 那種整串一次送的做法，長字串在某些 App 可能被截斷，**本次未驗證**）。
- 修飾鍵快捷鍵：MacPilot 會先送真的修飾鍵 keyDown，等 15ms 後送主鍵，再反序放開修飾鍵（`EventInjector.swift:282-313`）。註解說只設 flags 的話 WindowServer 熱鍵不會觸發，而且修飾鍵狀態會殘留。opencouchpad 用 `UCKeyTranslate` 依目前鍵盤配置建「字元→鍵碼」對照表，讓 ⌘Z 在 QWERTZ／AZERTY 配置下也按到對的鍵（`cgevent_darwin.go:259-300`）。

### (c) 手機怎麼認證

| 專案 | 機制 | 位置 | 評語 |
|---|---|---|---|
| **Unrud** | 12 byte `crypto/rand` 密鑰放 **URL `#fragment`**，用 QR 傳給手機；WS 走 HMAC-SHA256 challenge-response；challenge 每秒限 10 個 | `main.go:46-49, 146-172, 252-262, 281`；`webdata/app/main.mjs:27`；`socket.mjs:22-26` | 密鑰從不以明文出現在網路上；**最值得借用** |
| opencouchpad | 選用 PIN → POST `/login` → HMAC 衍生的 HttpOnly cookie；IP 錯誤鎖定；Host 白名單；gorilla 預設同源檢查；訊息 64 KiB 上限 | `server.go:76-80, 94-125, 201-206, 270-341`；`ws.go:47-51, 76` | 防護完整，但 PIN 預設不設 |
| VibeCast | 24 byte `SecRandomCopyBytes` 長期 token；`hello.pairingToken` 常數時間比對；每連線 40 則／秒限流 | `Session/Pairing.swift:27-44`；`SessionManager.swift:278-290`；`MessageRateLimiter.swift:9` | token 在 query string、CORS `*` |
| MacPilot | 選用 6 位數 PIN（預設關）→ cookie＝SHA256(常數+PIN) | `Pairing.swift:4-7, 43-65`；`HTTPWebSocketConnection.swift:150-188` | 預設開放、沒限流、token 可由 PIN 推出 |
| sofatap | QR：host+port+32 byte token+憑證 SHA-256 指紋；`wss`＋憑證釘選＋Bearer；拒絕瀏覽器 Origin；同時只允許一條控制連線 | `PROTOCOL.md`（Pairing／Connection） | 最嚴謹，但需要原生 App 才能釘憑證 |
| RemoteMouse 3.008（商業 App） | 被公開攻擊工具利用，可以無認證按任意鍵並執行程式 | exploit README | 反面教材 |

Unrud 伺服器端（`main.go:154-161`）：
```go
message := base64.StdEncoding.EncodeToString(b[:])
mac := hmac.New(sha256.New, []byte(message))
mac.Write([]byte(secret))
challenges <- challenge{ message: message, expectedResponse: base64.StdEncoding.EncodeToString(mac.Sum(nil)) }
time.Sleep(authenticationRateLimit)
```

### (d) 網頁／手機端的觸控板手勢與加速度

**閾值對照**

| 參數 | MacPilot `app.js:761-764` | Unrud `touchpad.mjs:22-25` | opencouchpad `touchpad.js:15-21` |
|---|---|---|---|
| 點擊最長時間 | 250ms | 250ms | 240ms（多指 +80ms，`:171-172`） |
| 點擊最大移動 | 8px | 10/15/15px（1/2/3 指） | 10px；起始 3px 死區 |
| 點後再按住＝拖曳的時間窗 | 300ms（`DOUBLE_MS`） | 250ms | 300ms＋距離 48px |
| 捲動／捏合判定 | 12px | — | 捲動 6px／捏合 36px |

**加速度**
- opencouchpad `pointer()`（`touchpad.js:204-217`），速度先做 EMA 平滑，增益 = speed × (1 + accel × boost)，並保留小數：
  ```js
  const v = dist / Math.max(dt, 4);
  this.vel = this.vel * 0.55 + v * 0.45;
  const boost = Math.min(Math.max((this.vel - 0.25) * 0.9, 0), 3);
  const gain = settings.speed * (1 + settings.accel * boost);
  const fx = dx * gain + this.rem.x; ... const ix = Math.trunc(fx); this.rem.x = fx - ix;
  ```
- Unrud：分段線性表 `[[0,0],[87,1],[173,1],[553,2]]`（px/s → 倍率）（`touchpad.mjs:27-32, 43-61`）；x、y 軸分開算（`:212-213`）；小數用 `Math.trunc` 保留到下一次（`inputcontroller.mjs:76-81`）。
- MacPilot：`f = moveSpeed * (1 + min(speed, 30) * accel)`（`app.js:917`），之後經過 1€ 濾波（`:774-787`），再依 `pointerHz` 打包送出（`:810-835`）。

**點擊、右鍵、拖曳**
- 三者都用「放開時的最大手指數」決定按鍵：1 指＝左鍵、2 指＝右鍵、3 指＝中鍵（MacPilot `app.js:935`；Unrud `touchpad.mjs:166-181`；opencouchpad `touchpad.js:177-193`）。
- 拖曳：MacPilot 是「點一下再按住移動」才送 `down`（`app.js:880, 914`）；Unrud 點擊後延遲 250ms 才放開左鍵，期間再按下就變拖曳（`touchpad.mjs:132-136, 175-178`）；opencouchpad 有 "clean drag" 模式，把第一下點擊暫緩（`touchpad.js:67-77, 116-118, 182-183`）。

**捲動與慣性**
- opencouchpad 慣性：取最後 100ms 的樣本估速度，每毫秒乘上 0.9965 衰減，速度低於 0.03 就停（`touchpad.js:261-271, 287-307`）。
- MacPilot：每幀乘 0.92 摩擦（`app.js:852-865`）。

**鍵盤與輸入法（CJK 的關鍵）**
- MacPilot（`app.js:224-250`）：比對 textarea 新舊值，找出共同前綴後，刪掉的部分送 Backspace（keyCode 51），新增的部分送 `text`；`compositionstart` 到 `compositionend` 之間**完全不送**，`compositionend` 時才 flush；超過 80 字清空 textarea。
- opencouchpad（`keyboard.js:9, 65-69, 87-101`）：textarea 預先塞零寬字元當哨兵，讓空欄位按 Backspace 也能偵測到；但 `onInput` **在 composition 期間也會比對差異並送出**（composing 旗標只用來阻止 reset）。對注音、拼音來說，組字中的符號會先被打到 Mac 上再被 Backspace 掉，**不適合我們**。
- VibeCast（`imeController.ts:5-7, 103-125`）：一般輸入 120ms 防抖；composition 期間 250ms 節流送「預覽快照」；`compositionend` 立即同步。協定允許 `isComposing:true` 時寫入預覽（`shared/protocol.md:121`）。
- Unrud：實體鍵盤用 keydown，遇到 `event.isComposing` 就略過（`keyboard.mjs:38-40`）；另外有 textarea＋送出鍵整段送出（`webdata/index.html:28-31`、`ui.mjs:116-120`）。這正符合我們「打好再送」的需求。

---

## 4. 建議借用清單（給我們的 Swift server＋web client）

### Swift 伺服器
1. **滑鼠事件**：`CGEvent(mouseEventSource:mouseType:mouseCursorPosition:mouseButton:)`＋`.post(tap: .cghidEventTap)`；**每個滑鼠事件都明確設 `flags = []`**（MacPilot `:257`）；按住按鍵時改送 `*MouseDragged`（MacPilot `:165-173`、KDE 的註解）；同時設 `mouseEventDeltaX/Y`（opencouchpad `:480-481`、lan-mouse、sofatap）。
2. **雙擊**：伺服器端依時間窗與距離自己計算 `mouseEventClickState`（opencouchpad `:529-537`）。
3. **限制游標範圍**：用 `CGGetActiveDisplayList`＋`CGDisplayBounds` 做多螢幕 clamp，並定期刷新（opencouchpad `:429-454`）。**Vision Pro 的 Mac Virtual Display 也是一塊顯示器，clamp 必須把它算進去，連線、斷線時也要重抓。**（推論，需實測）
4. **捲動**：`scrollWheelEvent2Source`、`.pixel`、2 軸，並設 `.scrollWheelEventIsContinuous = 1`（opencouchpad `:486-509`）；伺服器端累積小數或餘數。
5. **平滑（選用）**：伺服器端用 120Hz 插值，並依封包到達間隔 EMA 調整（MacPilot `:99-163`），吸收 Wi-Fi 抖動；實體滑鼠介入時重新同步。
6. **文字**：主路徑用 `keyboardSetUnicodeString`，**每段 ≤20 個 UTF-16 單位、不切開 surrogate pair、keyDown 與 keyUp 都設字串、flags 設 0、`\n`→Return 鍵**（sofatap `:245-271`）；不要學 MacPilot 整串一次送，也不要學 KDE 逐 code unit 送卻沒有 keyUp。
7. **文字備援**：剪貼簿「備份→寫入→⌘V→（可選）AX 讀回驗證→還原」（VibeCast `:240-287`），用在長文或 Unicode 事件無效的 App。之後可考慮 AX `kAXSelectedText` 直接寫入（VibeCast、sofatap）。
8. **快捷鍵**：送真的修飾鍵 down/up，加約 15ms 延遲（MacPilot `:282-313`）；之後可加 `UCKeyTranslate` 支援不同鍵盤配置（opencouchpad `:259-300`）。
9. **權限**：定期檢查 `AXIsProcessTrusted()`（sofatap 另用 `CGPreflightPostEventAccess`），結果回報給手機 UI（opencouchpad `:398-407`）。
10. **安全**：
    - 用 `SecRandomCopyBytes` 產生 ≥128 bit 的配對密鑰，放在 **URL `#fragment`** 用 QR 給手機（Unrud）；WS 上做 **HMAC challenge-response**（Unrud），**不要**用可由 PIN 推出的 token，也不要把密鑰放在 query。
    - 如果另外提供 PIN：常數時間比對＋IP 錯誤升級鎖定（opencouchpad `server.go:301-341`）；cookie 設 HttpOnly＋SameSite。
    - **Host header 白名單擋 DNS rebinding**＋**WS 檢查 Origin**（opencouchpad `server.go:94-125`；sofatap）。
    - 單則訊息上限（64 KiB）、每連線限流（VibeCast 40/s）、數值範圍檢查、拒絕未知欄位（sofatap）；同時只允許一條控制連線（sofatap）。
    - 斷線或逾時時放開所有按住的鍵（MacPilot `:24-35`、sofatap）。
    - 不要設 CORS `*`；預設就要求配對（MacPilot 預設開放是反例；RemoteMouse exploit 證明沒認證＝遠端執行程式碼）。
    - TLS：網頁加自簽憑證會跳警告，取捨要記錄成決策；至少做到「密鑰不以明文出現在網路上」（Unrud 方案）。

### 網頁客戶端
1. touch 事件用 `{passive:false}`＋`preventDefault`，用 `identifier` 追蹤每根手指（Unrud `touchpad.mjs:91-98`）。
2. 手勢閾值直接參考第 3 節 (d) 的表：點擊約 250ms／10px，拖曳時間窗 300ms。
3. 1／2／3 指點擊＝左／右／中鍵；2 指移動＝捲動，先過判定閾值再決定是捲動還是捏合。
4. 拖曳兩條路都要做：「點一下再按住」手勢，以及**畫面上的「按住左鍵」大按鈕**（MacPilot README 有提；沙發上單手操作時很有用）。
5. 加速度：opencouchpad 的「速度 EMA＋boost 上限 3」公式，搭配 speed、accel 兩個滑桿；**保留小數到下一次**。
6. 低延遲：在 touch handler 裡直接送，不要等 rAF；只有 `bufferedAmount` 積壓時才合併（opencouchpad）；移動和捲動用 5-byte 二進位幀。
7. 捲動慣性：取最後 100ms 樣本，用 `0.9965^dt` 指數衰減（opencouchpad），提供自然捲動方向開關。
8. **中文輸入**：(i) 預設「打好再送」：textarea 加送出鍵，送出時整段當 `text`（Unrud、sofatap 的 review-and-send）；(ii) 可選「即時」模式：用 MacPilot 的差異演算法，composition 期間**不送**，`compositionend` 才 flush；加零寬哨兵偵測空欄位的 Backspace（opencouchpad）；**避免**在 composition 期間比對差異（opencouchpad 的缺點）。
9. 設定項目：靈敏度、加速度、捲動速度、自然捲動、左手模式（opencouchpad README）；設定存在 localStorage。

---

## 5. 未驗證或限制
- 只有 4 個 repo 有 clone 讀碼；其餘是 README 或部分檔案，相關結論已標明深度。
- 沒有建置或執行任何專案，所有行為都是**從原始碼推讀**，不是實測結果。
- CGEvent Unicode 字串的實際長度上限、哪些 App 會忽略 Unicode 字串、Vision Pro Virtual Display 的座標與 clamp 行為，都需要我們自己實測。
- 星數、日期是 2026-10-23 的 API 快照。

---

## 6. 工具使用統計
- 開始時間：11:49（台北）；結束時間：12:03（台北，最後一次 `date` 量測）。
- WebSearch ×3
- WebFetch ×0
- Bash ×72，細分如下：
  - curl（GitHub search／rate_limit API，未認證）：3 次 Bash 呼叫，含 9 個 search 查詢＋1 次 rate_limit（其中 1 次同時跑了 `gh auth status`）
  - gh api／gh search code（唯讀 GitHub API）：16 次 Bash 呼叫（metadata、README、單檔內容、tree、commit、release）
  - git clone：1 次 Bash 呼叫（`--depth 1` 共 4 個 repo）
  - 本地讀檔與核對（grep／sed／cat／wc／ls／date）：約 52 次，另有 1 次用 perl 就地修正本檔的行號引用；其中 4 次因 zsh glob、路徑或 sed 參數錯誤而重跑
- Read ×2、Edit ×3（third-party README 加 4 列 ×1、本檔修正 ×2）、Write ×1（本檔）
- ToolSearch ×2（載入 WebSearch／WebFetch、sosumi）
- MCP sosumi `fetchAppleDocumentation` ×1（查 `CGEvent.keyboardSetUnicodeString` 文件）
