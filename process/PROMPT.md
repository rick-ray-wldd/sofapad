# PROMPT

## 原始指令（逐字）
- 發送者：使用者
- 收到時間：2026-10-23 11:38（台北時間，訊息時間戳 03:38:18 UTC；本 thread 於 11:38:26 收到）（補記）

> 我現在的問題是帶著visionpro工作的時候常常找不到適合的地方放鍵盤 手常常會酸 因為visionpro可以讓我很好的在沙發上工作 但是我沒有合適高度的桌子放我的電腦鍵盤 所以我想要如果我可以用手機的鍵盤連接到我的 Macbook neo 這樣我就可以很舒服的坐姿透過按手機的鍵盤以及某種方式操控滑鼠 讓我可以自由的透過visionpro連我的macbook neo 進行工作。 所以目標是設計手機app或是website 讓我可以以平時最方便的輸入的手機鍵盤在手機上使用但是文字輸入到我連上的macbook neo 以及設計一個使用者介面方便的滑鼠功能讓我能在一隻手機上順暢的操控我的macmini 幫我深度學習與搜尋有沒有相關的文獻或github project 並且設計一款符合我需求的手幾鍵盤滑鼠

## 協調者附加的任務說明（補記，非使用者原文，摘要）
專案協調者（另一個 Claude session）約 11:38 建立此 thread，交代：用繁體中文回覆；先研究現有 App、GitHub 專案與論文（Remote Mouse、Mobile Mouse、Unified Remote、藍牙 HID、WebSocket 網頁、Vision Pro Mac 虛擬顯示器輸入限制），比較延遲、設定、能否用 iOS 系統鍵盤（含中文輸入法）；再提出架構與單手 UI 設計；以 HTML 報告用 Artifact 發布；寫完整實作或推送程式碼前先詢問。

## 流程記錄指令
- 收到時間：2026-10-23 11:46（台北，訊息時間戳 03:46:38 UTC）
- 內容：要求維持 process/ 下 7 個檔案（本資料夾）。原文見 USER-PROMPTS.md 的 P-02。

## 執行環境
- App：claude.ai 專案（project「phone mouse」）中的 thread，由 Claude Code 遠端執行環境驅動（雲端容器，非使用者電腦）
- 模型：Claude Opus 5.5（1M context）（依 session 設定；實際服務模型可能因備援不同）
- 電腦：雲端 Linux 容器（x86_64，kernel 6.18），無法存取使用者的 Mac / iPhone / Vision Pro
- 可用工具：WebSearch、WebFetch（抓網頁後由小模型依提示轉述，不是逐字全文）、Bash、檔案讀寫、Artifact 發布、thread 訊息/清單工具；GitHub 工具可用但本 session 未接任何 repo；沒有使用者裝置的資料夾或 Remote Control
- 專案記憶：關閉
