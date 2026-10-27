# 總控紀錄（Orca 架構成本）

> 公開版本：為了隱私，電腦名稱、使用者名稱、區網 IP（改成 192.168.x.x）、本機路徑、個人助理系統的 id、他人姓名和 email 已遮蔽，P-22 和他人對話有關的原文改成概述（見 docs/PUBLIC-CHECK.md）；其餘逐字未改。

照 process/PROTOCOL.md 第 6 節：總控派工、審查和溝通的時間與動作。時間是台北時間。

| 時間 | 動作 | 證據 |
|---|---|---|
| 2026-10-23 約 11:41 | M0：Ray 在總控聊天室下指令（總控當時在處理其他工作，11:42 看到） | PROMPT.md |
| 11:42:49 | 建立專案資料夾、執行 git init | — |
| 11:42:56–11:44:21 | 寫 PROMPT.md（11:42:56）、process/PROTOCOL.md（11:43:33，兩邊共用的記錄規則，含給 Claude Desktop 的貼上訊息）、DISPATCH-PKM-1.md（11:44:21） | 檔案修改時間 |
| 11:44:28 | git commit af06831 | git log |
| 11:44:28 | 新增 routing domain personal_tools（primary claude，routing v79）；orca repo add | routing.json changelog |
| 約 11:44:35 | orca agent launch：writer term_…（Claude Code，Opus 5.5 xhigh），送出 PKM-1 | launch receipt（在 v79 和 v80 之間） |
| 11:44:54–11:44:58 | assistant sync 登記專案 P-…，set-project → personal_tools（v80）；建立任務 T-… 並指派（v81）；記錄 triage ⑤ | routing changelog、任務 created_at |
| 約 11:45 | 回覆 Ray：記錄規則的位置，以及給 Claude Desktop 的貼上訊息 | 總控聊天室 |

**更正（11:46 補記）**：這張表原本的 11:51、11:52、11:54、11:55 是總控估計的，偏晚約 7–10 分鐘，已依檔案時間和 routing changelog 改成實際時間。DISPATCH-PKM-1.md 標頭寫的「約 11:50」也偏晚，實際寫入時間是 11:44:21；為了保留 writer 收到的 md5，該檔不改。
| 11:46 | Ray P-02 問記錄規則有沒有逐字記錄每則 prompt → PROTOCOL 改成 v1.1，新增 USER-PROMPTS.md（P-01、P-02）；writer 等到 M2 里程碑時再通知（避免打斷） | PROTOCOL.md、USER-PROMPTS.md |
| 12:04 | 讀進度（Ray 問）：看到 I-02、I-03（Mac mini 的 Orca 已有輔助使用權限）→ 送 PKM-1-1，限制真實注入：要有前景檢查，13:00–13:45 不測，每次 2 分鐘內，不碰其他 App | 終端機訊息 |
| 12:40–13:47 | writer 交付 M7（12:40），13:45 確認 Mac mini 仍鎖定、真實注入不做（13:46 commit 9f16ce2）。**總控當時沒有注意到交付**（總控當時在處理其他工作），直到 Ray 14:07 問才讀；延遲約 1.5 小時算進架構成本 | git log、DELIVERY.md |
| 14:07–14:12 | Ray P-04 問進度 → 總控審查：讀 DELIVERY、TIMELINE、SUMMARY、README §1–2；獨立重跑 Swift 36/36、JS 27/27、`--self-test` SELF-TEST OK（螢幕鎖定＝true）；RESEARCH-LOG 82 列；git 工作區乾淨 | 本表 |
| 14:50–14:52 | Ray P-05：解鎖 Mac mini，要求繼續驗證 → 14:51 總控查 ioreg（沒有 CGSSessionScreenIsLocked、OnConsole=Yes、port 8765 未監聽）、讀 writer 畫面（閒置）→ 14:52:14 送 PKM-1-2（訊息內寫「14:53」是估計，實際送出 14:52:14） | 終端機訊息 |
| 14:56:31–14:56:45 | 讀 writer run2 結果（e7f828f：打字和游標移動真的打進 Mac；點擊、捲動被測試保護誤擋，I-11）→ 14:56:45 送 PKM-1-3：核准 I-11、I-12 修法，run3 只跑一次；兩條保護都保留 | 終端機訊息 |
| 15:02–15:05 | 讀 run3 結果（ee6a158，14:59:19–14:59:30）→ 總控獨立核對：result.json checks 全 true、final_text 正確、前景前後都是 Orca、port 已關；重跑 Swift 39/39、JS 27/27、self-test OK（重跑前用 tools/build-app.sh 重建了 dist/，不進 git）；沒有殘留 pkm 程序。總控驗收 M4、M5（Mac mini＋headless Chrome＋127.0.0.1）；M6 待 Ray | design/evidence/e2e-run3/ |

## 18:22 P-07：Neo 建置失敗
- Ray 在 MacBook Neo 跑 `./tools/build-app.sh`，`swift build` 在 dyld 階段就中止（swift-package 找不到 BuildServerProtocol 符號）。兩個檔案都在 /Library/Developer/CommandLineTools 裡，是 Neo 的 Command Line Tools 安裝不一致，專案程式沒有被編譯到。
- 查 Mac mini 的 dist/PhoneKeyMouse.app：arm64、minos 13.0、ad-hoc、建置時間 15:02:22，晚於最後一次程式 commit ee6a158（15:01）。dist/ 在 .gitignore，但 Finder 壓縮整個資料夾會一起帶過去。
- 回覆 Ray：先用帶過去的 dist/PhoneKeyMouse.app（隔離屬性要在「隱私權與安全性 → 仍要打開」放行），重建需要時再重裝 Command Line Tools。M6 仍未達成。

## v2（PKM-2）總控紀錄
| 時間 | 動作 | 證據 |
|---|---|---|
| 14:45 | 看到 dot-20261024-1445-9dad（Ray 試用回饋和 v2 四項需求，P-11），確認督導是 Claude（personal_tools） | （個人助理系統） outbox |
| 14:46 | 寫 DISPATCH-PKM-2.md 並 commit（45c4a54），USER-PROMPTS 加 P-10、P-11；14:46–14:47 修正估計時間的錯誤，改成實際時間（70408a4） | git log |
| 14:47 | 確認 writer 閒置、輸入框是空的，送出 PKM-2，turn_started | orca send receipt |
| 約 14:48 | writer 回報計畫：3.5–4 小時；開 2 個 Sonnet 子代理 | writer 畫面 |
| 14:49 | dot-20261024-1449-eebb（P-12：Ray 回答 Q1–Q3，加直向和橫向全螢幕）→ DISPATCH §6（5e5ff63），趁 writer 工作中排入佇列 | git log、writer 畫面 |
| 約 14:50 | writer 重新估計：約 4.5 小時，預計 19:15 前交付 | writer 畫面 |
| 14:53 | dot-20261024-1452-c6e5（P-13：紀錄要求）→ DISPATCH §7（5751f62），排入佇列 | git log |
| 15:19 | 總控核對 v2 交付（1ada0c6）：重跑 JS 49/49、Swift 42/42（DEVELOPER_DIR=Xcode）都通過；看過 after-portrait-keyboard-safari、v2-05-landscape-fullscreen 截圖，和 I-13、D-14 的描述相符。run4 等解鎖，M6 等 Ray。writer 畫面停在 autocompact 提示，總控沒有操作 | 本表 |
| 19:18 | 總控核對 PKM-2-3（2dadfc6、69a5626）：重跑 JS 52/52、Swift 49/49；I-18 根因（旗標被覆蓋，Fn/NumericPad 被洗掉）和總控的推測相符；pad 高度 463→535（390 寬）。M6 等 Ray 在 Neo 換新版 App | 本表 |

## v4（PKM-4）總控紀錄
| 時間 | 動作 | 證據 |
|---|---|---|
| 01:57 | Ray 在總控聊天室提出 P-23：拿掉語音鍵；切窗後舊文字又送出並卡頓；連線穩定；網址精簡；第一次使用手冊；公開 repo | USER-PROMPTS P-23 |
| 01:58 | 查 GitHub（rick-ray-wldd）：這個專案沒有遠端。公開 repo 只有 sofapad，而它是另一個專案。結論：公開前要先跟 Ray 確認 repo 名稱和要公開的範圍 | gh repo list |
| 02:01 | 寫 DISPATCH-PKM-4.md，commit 38a727e | git log |
| 02:02:00 | writer_send 送進 term_…，回傳 queued；02:03 看到 writer 開始讀派工單 | writer_send 回執、writer 畫面 |
