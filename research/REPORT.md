# 手機當 Mac 的鍵盤和滑鼠：研究報告（PKM-1 / M2）

- 撰寫：PKM-1 writer（Claude Code，Opus 5.5，Orca 架構），2026-10-23 12:15–12:17（台北；以子代理 11:49–12:11 的原始筆記為基礎）。
- 來源編號（S-xx）對應 `process/RESEARCH-LOG.md`。原始筆記在 `research/raw/papers.md`、`github.md`、`products.md`，由 3 個研究子代理寫成；writer 抽查後才採用，抽查結果寫在 RESEARCH-LOG。
- 標記說明：**全文**＝讀了正文；**僅摘要**＝只讀到摘要或書目；**README**＝只讀了 README；**程式碼**＝clone 下來唯讀深讀，不安裝、不執行。➕ 表示我方推論，不是來源原文。

---

## 0. 先講結論

1. **Apple 沒有內建方案。** Mac Virtual Display 官方只保證「Mac 本機的鍵盤、觸控板，或連在 Mac 上的藍牙鍵盤、滑鼠」可以用（S-80）。iPhone 和 visionOS 虛擬鍵盤都沒有被提到。Universal Control 只支援 Mac 和 iPad（S-85）。用 iPhone 鍵盤打字的 Continuity 功能只給 Apple TV（S-89）。iPhone Mirroring 方向相反，而且不能和 Mac Virtual Display 同時用（S-81、S-86）。
2. **觸控板的部分已經有現成的；「用手機注音打字、Mac 收到選好的中文」沒有任何產品在官方文件裡明確保證。** 最接近的三個：
   - **Tracepad**（S-65）：App Store 寫「Type on your iPhone with any input method, send to your Mac」，Mac 端要裝個人開發者發布的 helper。
   - **sofatap**（S-34）：開源，原生 iPhone App 目前是 TestFlight beta。Mac receiver 有公證，用 TLS 加 QR 配對，有「即時文字編輯」，但沒有提到中文輸入法。
   - **Mouse · Keyboard**（S-66）：免費、Data Not Collected、配對要核准，中文行為不明。

   誠實的說法是：**有接近可用的現成方案，值得 Ray 花 30 分鐘實測 Tracepad 或 sofatap**。
3. **為什麼還是自己做**（細節見 §5）：
   - 手機端完全免安裝，打開網頁就能用。
   - 明確處理中文輸入法：只送已經選定的字，組字中的注音不送。
   - 戴著 Vision Pro 也能配對：手機要求配對，Mac 螢幕跳出配對碼。這是因為戴著頭顯沒辦法用 iPhone 相機掃虛擬螢幕上的 QR code。
   - 只走區網，沒有雲端、追蹤或訂閱。
   - 程式碼全部在 Ray 自己手上，可以審查。這點很重要，因為鍵盤程式會經手所有打的字，包括密碼。
   - 介面專門為「仰躺、手機放在胸口、單手拇指」設計。
4. **學術文獻支持的設計方向**：
   - 手臂要有支撐，只動拇指（S-01、S-14、S-16）。
   - 用相對觸控板加速度曲線，不用固定倍率（S-03、S-11、S-12）。
   - 不要用傾斜或空中滑鼠當主要指向方式（S-14）。
   - 用手機原生鍵盤和輸入法打字（S-10、S-20）。
   - 按鈕放在拇指範圍內，要能左右鏡像（S-15、S-22）。
   - 介面盡量不需要低頭看（S-07、S-21）。

---

## 1. 需求拆解：Ray 的情境

| 情境要素 | 對設計的意思 |
|---|---|
| 戴 Vision Pro，用 Mac Virtual Display 操作 MacBook Neo | 輸入要送到「Mac 本身」，而 Mac 只認 Mac 端的輸入（S-80）。所以要有 Mac 端程式把事件注入系統。Mac 的畫面在虛擬螢幕上，人不在 Mac 前面。 |
| 沙發、沒有桌子、手會酸 | 手臂不能懸空，手機放在胸口、腹部或大腿，只用拇指（S-01、S-05、S-16、S-24）。 |
| 想用手機平常的鍵盤，包括中文輸入法 | 送「選好的字」，不送按鍵。藍牙 HID 型方案只能送按鍵，用不到手機的注音選字（S-95、S-63、S-64）。 |
| 一隻手機就能順暢操控 | 觸控板、按鈕、捲動、拖曳要能單手完成；要能橫拿、躺著用（S-15、S-22）。 |
| 戴著頭顯看手機 | Vision Pro 有 passthrough，看得到手機，但視線主要在 Mac 畫面上。按鈕要大、位置固定，不用看也能按（S-07、S-09）。 |

---

## 2. 學術文獻（23 篇有內容：12 篇全文或部分全文、11 篇僅摘要；另 2 篇只看到書目）

### 2.1 手機當頭戴顯示器的輸入裝置

| 編號 | 論文 | 讀了多少 | 重點 | 對我們的意思 |
|---|---|---|---|---|
| S-01 | Kang et al., **Phonaze**, ISMAR 2026 | 僅摘要（官方論文頁；writer 自己核對） | 躺姿 XR 時，用頭顯原生的 gaze hover 指目標，用放在軀幹上的手機點擊確認。兩支原生 App 走本地 Wi-Fi，tap 到回饋平均 52 ms。Vision Pro 上 N=18，和 Direct Touch 比，手臂疲勞降 75%（Borg CR-10 1.9 vs 7.6）、選取快 31%、SUS 85.2（以上都是摘要所載） | 「手機靠在身上、只動拇指」的方向有直接證據。52 ms 當延遲參考。和 Phonaze 不同的是，我們拿不到 Vision Pro 的視線資料，指向改由手機觸控板負責。 |
| S-03 | Darbar et al., GI 2021，手機在 AR 頭顯中選取文字 | 全文 | 四種方法裡，「手機當連續觸控板」最快（5.16 s vs 8.78 s）、錯誤最少、體力負擔最低。受試者反映 700 ms 長按切模式很難掌握 | 主要游標模式採相對觸控板加速度曲線；不要用長時間的長按切模式 |
| S-04 | Unlu & Xiao, PAIR, VRST 2021 | 全文 | 觸控和文字走可靠的 TCP，WiFi 單向延遲最高約 25 ms | WebSocket（TCP）可行；要盯延遲預算 |
| S-05 | Henderson et al., STAT, MobileHCI 2020 | 僅摘要 | 手機放在大腿上當頭顯的打字面 | 手機靠在身上打字可行 |
| S-06 | Zhu & Grossman, BISHARE, CHI 2020 | 僅摘要 | 手機和 AR 頭顯雙向互動的設計空間 | v2：手機顯示 Mac 狀態 |
| S-07 | Matulic et al., Phonetroller, CHI 2021 | 僅摘要 | VR 裡看不到手機和手，精準觸控就變難 | 按鈕要大、位置固定、不用看也能按 |
| S-08 | Biener et al., Breaking the Screen, TVCG 2020 | 部分全文 | 平板當觸控板控制多個虛擬螢幕；按住邊框切到「粗調 gain」跨螢幕 | 長距離移動需要額外機制：加速度，或另設一個絕對跳躍區 |
| S-09 | Sasaki et al., APMAR 2026 | 部分全文 | 手機 Pointer 和 Quest 控制器的主觀評分沒有顯著差異；單手拇指操作，加上震動回饋 | 單手拇指觸控板可行；狀態變化給不需視覺的回饋 |
| S-10 | Li et al., SwEYEpinch, CHI 2026 | 部分全文 | Vision Pro 式的看加捏逐鍵打字約 10 WPM，空中點擊約 18 WPM（Varjo 設置，不是 Vision Pro 實機） | 打字交給手機原生鍵盤和輸入法 |

### 2.2 手機當觸控板、間接指向、單手拇指

| 編號 | 論文 | 讀了多少 | 重點 | 對我們的意思 |
|---|---|---|---|---|
| S-11 | Casiez et al., CD gain, HCI 2008 | 部分全文 | 有加速度比固定 gain 快；gain 太低會因為 clutch 拖慢 | ➕ 以拇指滑 40 mm、5120 px 寬的虛擬螢幕推算：固定 gain 不可能同時兼顧「一次滑過全螢幕」和「點得準」，所以一定要用加速度 |
| S-12 | Casiez & Roussel, UIST 2011 | 僅摘要 | 作業系統的加速度曲線比固定 gain 最多好 24% | 我們用 CGEvent 設絕對位置，macOS 的加速度不會套用，要自己在手機端實作曲線 |
| S-13 | McCallum & Irani, ARC-Pad, UIST 2009（另附 2012 碩士論文） | UIST 僅摘要；碩士論文部分全文 | 點一下就絕對跳到對應位置，滑動是相對移動。tap 的判斷是 300 ms 內、移動 < 0.35 cm | 單手時「點一下 = 左鍵」會和「點一下 = 跳躍」衝突，所以絕對跳躍做成獨立的迷你地圖 |
| S-14 | Boring et al., OZCHI 2009 | 全文 | 用手機移動或傾斜控制游標時，按鍵的瞬間手機晃動會造成高錯誤率；手臂靠在身上比較準 | 不做空中滑鼠或傾斜；按下和放開時凍結游標 |
| S-15 | Bergström-Lehtovirta & Oulasvirta, CHI 2014 | 僅摘要 | 單手握持時拇指能碰到的範圍，可以用模型預測 | 按鈕放在拇指範圍內；要有左手鏡像 |

### 2.3 躺姿、沙發和手臂疲勞

| 編號 | 論文 | 讀了多少 | 重點 | 對我們的意思 |
|---|---|---|---|---|
| S-16 | Hincapié-Ramos et al., Consumed Endurance, CHI 2014 | 僅摘要 | 用肩關節力矩量化 gorilla arm | 手臂不懸空，疲勞就接近零 |
| S-17 | Jang et al., CHI 2017 | 僅摘要 | 手臂疲勞會隨時間累積 | 長時間使用要以整段時間評估 |
| S-18 | Li et al., NICER, TOG 2024 | 部分全文 | 手臂高於肩膀最累；休息會恢復 | 不要求把手機舉到眼前 |
| S-19 | Pfeuffer, Gaze+Pinch 設計原則, 2024 | 全文 | 看加捏對手臂友善，但遠距拖曳需要放大 transfer function | 看加捏控制的是 visionOS 視窗；Mac 畫面裡的游標仍要靠我們的方案 |
| S-20 | Biener et al., 在 VR 工作一週, ISMAR 2022 | 部分全文 | 用熟悉的實體鍵盤加觸控板，打字速度只小幅下降（43 vs 47 WPM） | 熟悉的輸入方式最好；手機原生鍵盤就是 Ray 最熟悉的 |
| S-21 | Tominaga et al., AsianCHI 2021 | 全文 | 鍵盤越高，上臂越累；越低，脖子越累 | 介面盡量不用低頭看 |
| S-22 | Jeong et al., CHI 2026 EA，躺姿 MR | 僅摘要 | 仰躺、左側躺、右側躺的表現和舒適度有顯著差異 | 要能切換左右手；要能鎖定方向 |
| S-23 | Luo et al., UIST 2022／2023 | 僅摘要 | 45° 半躺時感官衝突最嚴重 | 寫進使用指南：虛擬螢幕的擺放要配合仰角 |
| S-24 | Ahn et al., 2022 | 僅摘要 | 用手機時，仰躺的頸部肌肉負擔最低 | 主要情境設定為「仰躺，手機放在胸口或腹部」 |

另外打開過、但只看到書目，所以沒有納入結論的：S-25 Arnold et al.（HFES 2025，Vision Pro 實機打字研究，頁面沒有摘要）、S-26 TrackCap（只有書目）。

**文獻缺口**：沒有找到「用手機中文輸入法替頭顯或遠端電腦打字」的學術論文（A1 的搜尋只找到專利）。

---

## 3. GitHub 開源專案（21 個；4 個 clone 下來唯讀深讀）

| 編號 | 專案 | 星數 | 最後更新 | 授權 | 做法 | 讀了多少 | 能借什麼 |
|---|---|---|---|---|---|---|---|
| S-30 | Unrud/remote-touchpad | 692 | 2026-10-11 | GPL-3.0 | Go 伺服器＋網頁；macOS 用 CGEvent | 程式碼 | **密鑰放在 URL #fragment，用 HMAC challenge-response 登入**，因為 http 網頁沒有 crypto.subtle，所以附了純 JS 的 SHA |
| S-31 | joonlab/MacPilot | 25 | 2026-08-03 | MIT | Swift 選單列 App＋NWListener 自寫 HTTP/WS＋CGEvent＋vanilla JS | 程式碼 | 架構和我們最像；滑鼠事件 `flags = []`；修飾鍵真的按下、等約 15 ms 再按主鍵。反面教材：PIN 預設關閉、token 可以從 PIN 推出來 |
| S-32 | Pls-1q43/VibeCast | 54 | 2026-06-24 | MIT | 手機輸入法當 Mac 的「輸入面板」；AXValue 直寫，或剪貼簿貼上 | 程式碼 | 剪貼簿「先備份、⌘V、再還原」；token 放 query string 是反例 |
| S-33 | maros-o/opencouchpad | 43 | 2026-10-12 | MIT | Go＋網頁；移動用 5 byte 二進位幀 | 程式碼 | 速度 EMA 加速度、慣性捲動、PIN 錯誤升級鎖定、Host 白名單；捲動設 continuous 旗標。它在組字中也送差異，**不適合注音** |
| S-34 | chekusu/sofatap | 132 | 2026-10-22 | MIT | 原生 iPhone App＋.NET receiver；wss＋憑證釘選 | README＋3 個檔（另外 writer 自己讀了 README） | Unicode 每段 ≤20 個 UTF-16 單位且不切開 surrogate；斷線就放開按鍵；同時只允許一條控制連線 |
| S-35 | rahatsagor/CmdPalm | 93 | 2026-10-19 | AGPL-3.0 | 網頁 PWA＋Mac 選單列 | README | QR、PIN、Mac 端核准三種配對；單拇指捲動條（只借概念，不碰程式碼） |
| S-36 | narendraio/fingerfly | 17 | 2026-05-25 | MIT | Python＋Quartz | README | 靈敏度和捲動倍率設定；README 沒提到任何認證 |
| S-37 | hello-claude/phone-web-remote | 1 | 2026-06-06 | MIT | Node＋nut.js | README | 非 ASCII 字元用剪貼簿貼上；4 位數 PIN 太弱 |
| S-38 | Soham109/glasspad | 4 | 2026-10-22 | MIT | 原生 App | README | 電腦端按 Allow 核准 |
| S-39 | Mehver/iController | 12 | 2026-10-17 | BSD-3 | Python＋React | README | Mac 版已停更 |
| S-40 | Kaia-Alenia/Axon | 40 | 2026-08-23 | GPL-3.0 | Go＋Android；移動走 UDP | README | UDP 快速通道的想法（我們沒採用） |
| S-41 | gasolin/webbymouse | 80 | 2016-05-17 | MIT | NW.js＋RobotJS | README | 停更 10 年，只有歷史參考價值 |
| S-42 | KDE/kdeconnect-kde | 4071 | 2026-10-23 | GPL | 成熟的 TLS 配對；macOS 沒有官方版 | README＋1 個檔 | 「按住鍵時要送 Dragged 事件」的註解 |
| S-43 | feschber/lan-mouse | 5405 | 2026-09-26 | GPL-3.0 | 電腦對電腦；DTLS 加憑證指紋 | README＋1 個檔 | 授權模型；移動時同時設 delta 欄位 |
| S-44 | deskflow/deskflow | 30039 | 2026-10-21 | GPL-2.0 | Synergy 系 KVM | README | macOS 輔助使用授權的提醒（升級後要重新授權） |
| S-45 | input-leap/input-leap | 8320 | 2025-11-27（已封存） | — | Barrier 的 fork | README | 紅旗：已封存 |
| S-46 | debauchee/barrier | 30946 | 2022-02-04 | — | KVM | README | 紅旗：已停止維護 |
| S-47 | go-vgo/robotgo | 10878 | 2026-10-22 | Apache-2.0 | Go 函式庫 | README＋2 個檔 | 逐字 Unicode＋剪貼簿兩條路 |
| S-48 | nut-tree/nut.js＋libnut-core | 2857／56 | 2024-05 | 無／Apache-2.0 | Node 原生模組 | README＋1 個檔 | 預建套件要付費訂閱 |
| S-49 | BlueM/cliclick | 2031 | 2025-08-23 | — | Objective-C 命令列工具 | README | 只適合寫測試腳本 |
| S-50 | p0dalirius/RemoteMouse-3.008-Exploit | 65 | 2025-02-11 | — | 攻擊工具 | README | **沒有認證的按鍵注入，等於遠端執行程式碼** |

**深讀程式碼得到的重點**（file:line 都在 `raw/github.md` §3，writer 抽查過 MacPilot `EventInjector.swift:250-264` 和 remote-touchpad `socket.mjs:20-28`，內容相符）：

- **滑鼠**：用 `CGEvent(mouseEventSource:…)` 加 `.post(tap: .cghidEventTap)`；按住按鍵時移動要改送 Dragged 事件；同時設 delta 欄位；雙擊的 clickState 由伺服器自己計算；游標要限制在所有螢幕範圍內。捲動用 `.pixel` 單位，並設 continuous 旗標。
- **Unicode 文字**：各家做法差很多。MacPilot 整串一次送；KDE 逐個 code unit 送而且沒有 keyUp；sofatap 每段 ≤20 個 UTF-16 單位；VibeCast 用 AX 或剪貼簿。Apple 文件寫「application frameworks may ignore the Unicode string」（S-96），所以**剪貼簿備援是必要的**。
- **認證**：Unrud 的 HMAC challenge 讓密鑰不用明文出現在網路上；opencouchpad 有 Host 白名單和 IP 鎖定；MacPilot 預設開放，是反面教材。
- **中文輸入**：MacPilot 的做法是組字期間不送、`compositionend` 才比對差異，這是正確的；opencouchpad 在組字中就送，注音會先打到 Mac 上再被刪掉。

---

## 4. 現成產品與 Apple 內建方案

### 4.1 第三方 App（13 個）

| 編號 | 產品 | 判定 | 主要理由 |
|---|---|---|---|
| S-65 | Tracepad | **部分滿足（最接近）** | 明寫「Type on your iPhone with any input method, send to your Mac」；走 Bluetooth 或 USB；拖曳和多指手勢都有。代價是 Mac helper 由個人開發者從網站發布，權限和隱私政策讀不到 |
| S-66 | Mouse · Keyboard（Remote Sunrise） | 部分滿足 | 免費、Data Not Collected、HTTPS、配對要核准；中文行為不明 |
| S-61 | Unified Remote | 部分滿足 | $4.99 買斷、Data Not Collected、有密碼和加密；支援第三方鍵盤，但沒明寫中文 |
| S-60 | Remote Mouse | 部分滿足 | 宣稱「any language」；隱私標籤有「用於追蹤」，還有廣告 |
| S-62 | Mobile Mouse WIFI＋Server | 部分滿足 | $9.99；Cloud 訂閱可能經過雲端中轉 |
| S-63 | Mobile Mouse Bluetooth | 部分滿足 | Mac 不用裝東西，但只能送按鍵，**用不到手機的注音**；訂閱每年 $29.99 |
| S-68 | Remote Keyboard & Mouse（JIE WANG） | 部分滿足 | 有原生鍵盤；有追蹤 |
| S-69 | KDE Connect | 部分滿足（待驗證） | 開源、TLS；macOS 能不能接收遠端輸入沒有證實 |
| S-72 | AppGround（Android） | 部分滿足 | 只有 Android，只能送按鍵 |
| S-64 | Bluetouch | 不滿足 | Mac 相容沒有證實；有追蹤 |
| S-67 | Remote KeyPad | 不滿足 | 只有數字鍵 |
| S-70 | WiFi Mouse（Necta） | 不滿足 | 2018 年後停更 |
| S-71 | Remote for Mac（Aexol） | 不滿足 | **CVE-2025-34089：未授權就能遠端執行程式，CVSS 9.8** |
| S-73 | Keymote | 不滿足 | 推定已下架（僅搜尋摘要） |

另外，sofatap（S-34）雖然列在 GitHub 段落，實際上也是「現成可試」的產品，判定同樣是部分滿足：手機端要從 TestFlight 安裝，配對要掃 Mac 視窗上的 QR code，沒有提到中文輸入法。

### 4.2 Apple 內建（逐項）

| 編號 | 方案 | 能不能滿足 Ray | 根據 |
|---|---|---|---|
| S-80、S-81 | Mac Virtual Display 的輸入 | 只認 Mac 本機的鍵盤和觸控板，或連在 Mac 上的藍牙裝置；沒有提到 iPhone 和虛擬鍵盤 | Apple Support 118521、Vision Pro 使用手冊 |
| S-82 | 配對到 Vision Pro 的藍牙鍵盤和滑鼠 | 文件沒說能操作 Mac Virtual Display | Vision Pro 使用手冊 |
| S-83 | visionOS 虛擬鍵盤 | 沒提到能打進 Mac | 使用手冊 |
| S-84 | visionOS 27 新功能 | 沒有新增輸入相關功能 | Apple Support 149067 |
| S-85 | Universal Control | 只支援 Mac 和 iPad，iPhone 不支援 | 102459 |
| S-86 | iPhone Mirroring | 方向相反（Mac 控制 iPhone），而且不能和 Mac Virtual Display 同時用 | 120421、使用手冊 |
| S-87 | Sidecar | 只支援 iPad | 102597 |
| S-88 | 切換控制「使用其他裝置」 | 是掃描式操作，不是鍵盤或觸控板 | 118667 |
| S-89 | 用 iPhone 鍵盤幫別的裝置打字 | 只支援 Apple TV | tvOS 使用手冊 |
| S-90 | iPhone 當藍牙 HID 鍵盤 | CoreBluetooth 擋 HID service 0x1812（開發者論壇，Apple 沒有回覆）；有 App 做得到，但機制不明 | 開發者論壇 725238 |
| S-91、S-92 | Mac 聽寫 | 支援華語（台灣），可以從選單啟動、不用鍵盤；但這是語音，不是打字 | Mac 使用手冊、功能支援頁 |
| S-93 | 輔助使用鍵盤 | 螢幕小鍵盤，可以當最後備案，但很慢 | Mac 使用手冊 |
| S-94 | Magic Trackpad | 相容 Vision Pro 和 Mac；放在大腿上是官方支援的路徑，但又多一個裝置 | 121932 |

### 4.3 硬體替代（背景參考）
- Magic Trackpad（S-94）放大腿上，再加一把小藍牙鍵盤：官方支援，但又多帶兩個東西。
- Logitech K400 Plus（S-97）：官方相容清單沒有 macOS。
- Twiddler（S-98）、K830（S-99）：只有搜尋摘要。

---

## 5. 結論：有沒有現成的可以直接用？

**有接近可用的，但沒有一個在官方文件裡同時保證「手機注音直接打出 Mac 中文」加上「戴著 Vision Pro 也能配對」加上「沒有追蹤和雲端」。** 建議分兩步走：

1. **(選擇性) 先試現成的**：用 Tracepad（S-65）或 sofatap（S-34），各試 10–15 分鐘，打一段注音、做一次拖曳。如果 Ray 覺得夠用，也是一個正當的答案。風險是要裝個人開發者的 Mac helper 並給它輔助使用權限，信任成本要 Ray 自己判斷。
2. **自己做的版本（本專案）**，和現成方案的差異：

| 缺口 | 現成方案 | 本專案 |
|---|---|---|
| 手機端安裝 | 全部是原生 App（多數要 App Store；sofatap 走 TestFlight） | **網頁**，Safari 打開就能用，可以加到主畫面 |
| 中文輸入法 | 文件沒有保證；藍牙 HID 型技術上做不到（S-95） | 只送「已選定的文字」，組字中的注音不送，有單元測試覆蓋 |
| 戴著頭顯配對 | 多數要掃 QR（看不到虛擬螢幕上的 QR）或在 Mac 前操作 | 手機按「請 Mac 顯示配對碼」，碼會出現在 Mac 畫面上（也就是 Vision Pro 裡）的浮動視窗 |
| 安全 | 有 CVE（S-71）和沒有認證的 exploit（S-50）；開源專案多數預設開放（S-31、S-36） | 預設要配對；之後用 HMAC 證明身分，token 不在網路上出現；只接受區網、檢查 Host 和 Origin、IP 錯誤鎖定、同時只允許一支手機控制 |
| 隱私和費用 | 有追蹤、廣告、訂閱 | 沒有第三方、沒有雲端、免費、開源、可審查 |
| 沙發單手 | 沒有專門設計 | 大按鈕、單手捲動條、拖曳鎖定、左手模式、橫拿或直拿都可以 |

自己做的限制要誠實說明（細節見 SPEC 和 DELIVERY）：
- v1 沒有 TLS，同一個 Wi-Fi 上主動攻擊的人仍可能劫持已建立的連線。
- 網頁在 http 下拿不到螢幕常亮（Wake Lock）和陀螺儀。
- 能不能控制 visionOS App（指標從 Mac 畫面移到 visionOS 視窗）未知，要 Ray 實測。

---

## 6. 研究發現 → 設計決定

| 研究發現 | 設計決定（見 process/DECISIONS.md、design/SPEC.md） |
|---|---|
| Apple 只認 Mac 端的輸入（S-80）；iPhone 不能當 HID 鍵盤（S-90） | D-02、D-03：Mac 端程式用 CGEvent 注入，手機透過 Wi-Fi WebSocket 連過去 |
| 手機端免安裝最快能試用；現成方案全是原生 App | D-01：手機端做網頁 |
| 組字中不送、只送選好的字（S-31 對、S-33 錯）；HID 型送不了中文（S-95） | D-06：文字鏡像（即時）和整段送出兩種模式 |
| Unicode 事件可能被某些 App 忽略（S-96）；剪貼簿備援（S-32） | D-07：預設逐字 Unicode；文字很長或 Mac 正在用輸入法時，自動改用貼上，貼完還原剪貼簿 |
| 加速度比固定 gain 好（S-11、S-12、S-03）；超寬螢幕需要絕對跳躍（S-08、S-13） | D-05：速度相關的加速度曲線；另加迷你地圖做絕對跳躍 |
| 按壓時晃動造成誤差（S-14）；不要長時間長按（S-03） | D-05：點擊判斷前先凍結游標；長按 450 ms 才開始拖曳，另有拖曳鎖定按鈕和「按住左鍵」按鈕 |
| 不用看也能操作（S-07、S-21）；單手拇指（S-09、S-15） | D-05：大按鈕、固定位置、單手捲動條、左手鏡像 |
| HMAC challenge（S-30）；Host 白名單（S-33）；CVE 和 exploit（S-71、S-50） | D-04：配對碼加 HMAC 證明、區網限定、Host 和 Origin 檢查、IP 鎖定 |
| 戴頭顯時掃不到虛擬螢幕上的 QR code（➕ writer 推論） | D-11：手機要求配對，Mac 螢幕跳出配對碼 |
| WiFi 單向約 25 ms（S-04）；Phonaze 52 ms（S-01） | D-08：延遲目標是區網 p95 < 30 ms（手機到 Mac 收到並注入） |

---

## 7. 研究方法與可信度

- **分工**：3 個子代理平行查（文獻 A1、GitHub A2、產品 A3，11:49 開始，12:04–12:11 結束），writer 自己核對 Phonaze（S-01）和 sofatap README，並自己讀 Apple 118521。
- **抽查**（記在 RESEARCH-LOG「讀了多少」欄）：
  - GitHub：4 個 repo 的星數、日期、授權用 API 重查，和子代理寫的相符；2 段程式碼行號也相符。
  - 產品：Apple 118521 頁的內容相符；sofatap README 由 writer 自己讀過。
  - 文獻：PAIR 的 PDF、SwEYEpinch 的 arXiv 頁、STAT 的 Crossref 書目都確認存在，題名和作者都相符。
- **限制**：
  - 子代理用 WebFetch 讀到的是頁面摘要，不是逐字全文。
  - 很多付費牆頁面只拿到摘要，例如 Consumed Endurance 全文的鏡像站都連不上。
  - App 的實際中文行為都沒有實測，因為不可以安裝 App。
  - 開源專案都只讀程式碼、沒有執行，因為派工規定不執行別人的程式。
- **發現的錯誤**：Ray 另一份研究的 SOURCES_v2（S-02）比較保守，寫「全文未取得，不引用 n 或效果數值」；其實 Phonaze 的 N=18 和疲勞數字都在官方摘要裡。這不算錯，本報告引用時標「摘要所載」。
