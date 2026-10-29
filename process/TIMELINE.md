# TIMELINE（台北時間）

> 公開版本：為了隱私，電腦名稱、使用者名稱、區網 IP（改成 192.168.x.x）、本機路徑、個人助理系統的 id、他人姓名和 email 已遮蔽，P-22 和他人對話有關的原文改成概述（見 docs/PUBLIC-CHECK.md）；其餘逐字未改。

| # | 里程碑 | 時間 | 證據 |
|---|---|---|---|
| M0 | 收到指令 | 2026-10-23 約 11:41（Ray 下指令）；writer 11:44 收到派工 | process/PROMPT.md、DISPATCH-PKM-1.md |
| M1 | 開始研究 | 2026-10-23 11:48 | process/TOOL-LOG.md（派 3 個研究子代理＋自己核對 Phonaze） |
| M2 | 研究完成（有報告） | 2026-10-23 12:17 | research/REPORT.md；process/RESEARCH-LOG.md（S-01～S-99 共 81 筆）；research/raw/*.md |
| M3 | 設計定案（有規格） | 2026-10-23 12:21 | design/SPEC.md；process/DECISIONS.md D-01～D-13 |
| M4 | 第一次能動的原型：手機打字，Mac 出現文字 | **2026-10-23 14:52（達成）**：run2 14:52:41–14:52:55 真實注入，手機網頁（注音組字＋選字）打的字真的出現在 Mac 上的文字框，內容正好是「你好， Hello」換行「整段送出測試 OK」。之前：12:12 原型可以執行；12:24 dry-run 流程正確；12:28 CGEvent self-test 19/19；12:25–13:45 Mac mini 鎖定（I-07），Ray 解鎖後由總控 PKM-1-2 指示跑 run2 | design/evidence/e2e-run2/、DELIVERY §3 |
| M5 | 滑鼠功能能用：移動、點擊、右鍵、捲動 | **2026-10-23 14:59（達成）**：run3 14:59:19–14:59:30 真實注入，移動、迷你地圖跳躍、點擊（clickCount 1）、雙擊（1→2）、右鍵、精確捲動、長按拖曳都真的送到 Mac 上的測試視窗，16 項檢查全部 PASS，測試保護擋下 0 個。之前：14:52 run2 只有移動通過，點擊和捲動被測試保護誤擋（I-11）；14:57 照 PKM-1-3 修好後跑 run3（只跑一次） | design/evidence/e2e-run3/、DELIVERY §3 |
| M6 | Ray 在 Vision Pro＋沙發情境真的用過（Ray 確認） | 未達成（需要 Ray） | |
| M7 | 交付完成 | 2026-10-23 12:40。13:45:18 確認 Mac mini 仍鎖定，真實注入不補做，交給 Ray（DELIVERY §3 已更新，13:46） | README.md、DELIVERY.md、process/SUMMARY.md |

## 細項流水（非固定里程碑）
- 11:44 讀 DISPATCH（md5 核對相符）、PROMPT.md、process/PROTOCOL.md、COORDINATOR-LOG.md。
- 11:45 讀個人助理契約 ASSISTANT.md，brief → join（sha256 9345bb3c…），station S-…。
- 11:47 查環境：Swift 6.0.3、Xcode.app 存在但 xcode-select 指向 CLT、Node 26、系統 Chrome、Mac mini LAN IP 192.168.x.x。
- 12:00 Mac 端 Swift 套件核心（HTTP、WebSocket、配對、協定、Session、Server）和執行檔（CGInjector、選單列、配對浮動視窗、QR）第一次編譯通過。研究還沒完成就先寫，因為架構幾乎確定；D-01～D-04 先記成暫定，M2 後再確認。
- 12:05 收到總控補充 PKM-1-1（端對端測試限制），記成 D-10、I-04。
- 12:04 子代理 A2（GitHub）、A3（產品）完成；12:06 writer 抽查。
- 12:11 子代理 A1（文獻）完成；12:14 writer 抽查 3 篇。
- 12:12 Swift 測試 35 個、JS 測試 25 個全部通過；本機 commit 9c4adfb。
- 12:15 讀到總控的 PROTOCOL v1.1（新增 USER-PROMPTS.md，由總控維護）。
- 12:17 M2：research/REPORT.md 完成。
- 12:18 依研究結果改程式：滑鼠事件 flags=[]、修飾鍵延遲 12 ms（S-31）、迷你地圖 jump（S-13、S-08）；Swift 35 個、JS 25 個測試全過。
- 12:19 DECISIONS D-01～D-13 寫完。
- 12:21 M3：design/SPEC.md 完成。
- 12:25 真實注入 e2e run1 中止：Mac mini 是鎖定畫面（I-07），沒有送出任何事件。
- 12:28 `pkm-server --self-test` 19/19：真正的 CGEvent 內容正確（中文、emoji、Return、⌘C、雙擊、右鍵、拖曳、捲動、跳躍、邊界、貼上與還原剪貼簿）。
- 約 12:30 截圖 10 張（design/screenshots/）。
- 12:31 延遲量測（tools/out/bench-*.json）：本機往返 p95 0.2–0.3 ms；文字到確認 p95 0.4 ms。
- 約 12:33 dist/PhoneKeyMouse.app 打包並做冒煙測試（原本寫 12:36 是估計值，偏晚，已更正）。
- 12:33 git commit ae4aeea。
- 12:38 修正 iOS 回到前景時「舊連線其實已斷」的問題（JS 測試變 27 個）；README 補充加入主畫面的注意事項。
- 12:39 重新建置 App，所有測試重跑：Swift 36/36、JS 27/27、self-test 19/19。
- 12:40 M7：交付（README、DELIVERY、SUMMARY）；station 改成 review。
- 13:45 背景等待結束：Mac mini 仍鎖定，run2 不做（commit 9f16ce2）。
- 14:52 收到總控 PKM-1-2（Ray 已解鎖，跑 run2 一次）。14:52:20、14:52:41 查鎖定：已解鎖。
- 14:52:41–14:52:55 run2：打字全部通過、游標移動通過；點擊、捲動、拖曳被測試保護誤擋（I-11）。port 關閉、游標和前景 App 恢復。
- 14:53–14:55 唯讀診斷：螢幕中央最上層是通知中心（layer 21）和 Dock（layer 20）的全螢幕透明視窗；AppKit 的 hit test 會跳過它們（I-11 的修法，還沒改程式）。
- 14:56 收到總控 PKM-1-3：核准 I-11、I-12 的修法，run3 核准一次。
- 14:57–14:59 修改：E2EGuard 改用 AppKit hit test，判斷規則抽成 PKMCore/E2EGuardPolicy（3 個單元測試）、self-test 加 6 項；probe 加 `--restore-pid`，e2e.sh 用 lsappinfo 先記下前景 App。
- 14:59:05–14:59:09 三組測試全過：Swift 39/39、JS 27/27、self-test 25/25。
- 14:59:14、14:59:19 查鎖定：沒有鎖定。
- 14:59:19–14:59:30 run3：16 項全部 PASS（M5 達成）。port 關閉、游標回到 (2177, 0)、前景回到 Orca（pid 81665）。
- 約 15:00 重新建置 dist/PhoneKeyMouse.app，bundle 的 self-test 也是 SELF-TEST OK。

## v2（PKM-2）

時間都是先跑 `date` 再記（PKM-2-2）。

### 四項任務起訖
| 任務 | 開始 | 結束 | 分鐘 | commit |
|---|---|---|---|---|
| T1 觸控區變小（找根本原因＋修） | 14:50（開始寫重現腳本） | 15:08（修好、前後截圖、瀏覽器測試通過、commit） | 18 | b9a7d91（重現＋根本原因）、db6ec1d（修正） |
| T2 原生手勢（三指、捏合、雙指左右） | 14:57（pointer.js） | 15:11（手勢對應、系統快速鍵檢查、e2e 擋全域快捷鍵、測試全過、commit） | 14 | ca9c91b（手勢辨識）、db6ec1d（接到 UI）、302b37c（Mac 端檢查和保護） |
| T3 快捷鍵（內建＋截圖＋自訂、匯出入） | 14:58（shortcuts.js） | 15:08（面板、編輯器、匯出入、瀏覽器測試通過、commit） | 10 | da1865a（邏輯）、db6ec1d（面板和編輯器） |
| T4 直向和橫向（橫向全螢幕觸控板） | 15:00（寫 CSS 橫向版面） | 15:08（轉向測試、截圖、commit） | 8 | db6ec1d（和 T1 同一個 commit：同樣改 index.html／style.css／app.js） |

### PKM-2-3（Ray 第一次真機實測後）任務起訖
| 任務 | 開始 | 結束 | 分鐘 | commit |
|---|---|---|---|---|
| T5 三指沒切桌面（根本原因＋修＋手機提示） | 18:58（讀 §8、唯讀查 symbolichotkeys、讀 CGInjector） | 19:11（Swift 49/49、self-test 新項目、瀏覽器測試手機提示） | 13 | 2dadfc6 |
| T6 下方按鍵列超出畫面 | 19:05（匯出修改前的 web） | 19:10（前後量測：從按鈕上滑可以捲動、不會按到；390／375 截圖） | 5 | 2dadfc6 |
| T7 拿掉迷你地圖 | 19:05 | 19:09（觸控板 +72 px） | 4 | 2dadfc6 |
| QR code 沒顯示（查原因、小修） | 19:03 | 19:07 | 4 | 2dadfc6 |
| e2e 30 秒閒置檢查 | 19:07 | 19:08 | 1 | 2dadfc6 |

### 里程碑

| # | 里程碑 | 時間 | 證據 |
|---|---|---|---|
| v2-M0 | 收到派工 PKM-2 | 2026-10-24 14:47（writer 讀 DISPATCH-PKM-2.md，md5 7d7e8a39…）；14:49 收到補充 PKM-2-1（直拿、三指照預設、加橫向全螢幕） | DISPATCH-PKM-2.md、USER-PROMPTS P-11、P-12 |
| v2-M1 | 開始研究 | 2026-10-24 14:49（2 個 Sonnet 子代理：手勢注入、iOS 鍵盤／全螢幕） | TOOL-LOG v2 |
| v2-M2 | 研究完成（手勢注入、iOS 鍵盤、Fullscreen 結論） | 2026-10-24 14:56（B2 14:53、B1 14:55 完成；writer 抽查 5 筆；D-14、D-15、D-16 寫完） | research/raw/v2-*.md、RESEARCH-LOG S-101～S-122、DECISIONS D-14～D-16 |
| v2-M3 | 觸控區變小：根本原因找到 | 2026-10-24 14:52（headless Chrome 重現，I-13） | tools/touch-area.mjs、design/evidence/v2-touch-area-before.json、design/screenshots/v2/before-*.png |
| v2-M4 | 觸控區修好＋橫向全螢幕（前後截圖） | 2026-10-24 15:08（直拿打字時觸控板 155 → 305 px；橫向觸控板 844×390 全螢幕；瀏覽器測試 41/41） | design/evidence/v2-touch-area-{before,after}.json、v2-browser.json、design/screenshots/v2/、commit db6ec1d |
| v2-M5 | 手勢＋快捷鍵面板完成（單元測試、瀏覽器測試） | 2026-10-24 15:11（JS 49/49、Swift 42/42、self-test 25 PASS＋2 SKIP、瀏覽器 41/41） | design/evidence/*、commit 302b37c |
| v2-M6 | 自測全過＋真實注入 run4 | **部分達成**：15:11 自測全過（JS 49/49、Swift 42/42、self-test 25 PASS＋2 SKIP、瀏覽器 41/41）；15:13 run4 驅動程式 dry-run 通過。**run4 真實注入沒有完成**：Mac mini 15:10 起鎖定（I-14），16:54:30 解鎖；2026-10-24 16:55 只跑一次，probe 沒有成為前景（有人正在用 Mac），安全中止，0 個事件（I-17）。不重跑，交給總控／Ray | design/evidence/、DELIVERY v2 §V3 |
| v2-M7 | v2 交付 | 2026-10-24 15:18（README、DELIVERY v2、SPEC v2、SUMMARY v2 卡；station 改 review）。run4 結果之後追加到 DELIVERY §V3 | README.md、DELIVERY.md、process/SUMMARY.md |
| — | Ray 在 MacBook Neo＋Vision Pro 用 v2 | 2026-10-24 約 17:33 第一次真機實測（P-14，總控 18:56 轉達）：配對、點擊、打字正常；三指沒切桌面、按鍵列超出、要拿掉迷你地圖、QR 沒顯示 | USER-PROMPTS P-14、DISPATCH §8 |
| v2-M8 | 收到 PKM-2-3 | 2026-10-24 18:57 | DISPATCH-PKM-2.md §8（7552b51） |
| v2-M9 | PKM-2-3 交付 | 2026-10-24 19:16（station review） | DELIVERY「v2 補充 PKM-2-3」、commit 2dadfc6 |

## v2 細項流水
- 14:47 讀 DISPATCH-PKM-2.md（commit 70408a4）、USER-PROMPTS P-07～P-11；回報 station（working，revision 8）。
- 14:49 派 2 個 Sonnet 子代理（B1 手勢注入、B2 iOS 鍵盤）；收到 PKM-2-1，把 Fullscreen／方向問題追加給 B2。
- 14:50 確認 Chrome 156 的 CDP 可以模擬 safe-area（Emulation.setSafeAreaInsetsOverride）。
- 14:51 tools/touch-area.mjs 重現：直拿、鍵盤彈出時觸控板高度 463 → 155 px（Safari）／199 px（主畫面 App），開快捷鍵面板後只剩 120 px，面板被切掉。
- 14:52 根本原因寫進 ISSUES I-13。
- 14:53 B2 完成；writer 抽查 S-101、S-102、S-104（相符）。讀 DISPATCH §7（PKM-2-2）：每個檔加 v2 節、每步時間戳、四項任務起訖、commit、決策選項。
- 14:54 process/ 六個檔加「v2（PKM-2）」節；I-13 移到 v2 節；D-14（鍵盤模式）、D-16（橫向全螢幕）。
- 14:55 B1 完成；writer 用 sosumi 和 curl 抽查（相符）；唯讀查這台 Mac 的 ⌃←／⌃→ 快速鍵設定。
- 14:56 D-15（手勢走鍵盤快捷鍵）；v2-M2。
- 14:57 T2 開始：pointer.js 加三指滑動、捏合、雙指快滑（選用）；14:58 JS 40/40；commit ca9c91b（14:59）。
- 14:58 T3 開始：shortcuts.js（內建、截圖、自訂、匯出入、手勢對應）；JS 49/49；commit da1865a（14:59）。
- 15:00 T1 修正＋T4：index.html、style.css、app.js 改成鍵盤模式和橫向全螢幕；快捷鍵面板改成蓋在觸控板上；自訂編輯器。
- 15:02 「after」量測：直拿打字（Safari 可視 464）觸控板 305 px（v1 155）；主畫面 App 349 px（v1 199）；開快捷鍵面板仍 305 px（v1 120，而且面板被切掉）；三行字 285 px（v1 120）。
- 15:03 重現腳本加上模擬鍵盤的灰色區塊；「before」改用 git archive 匯出 v1（ee6a158）的 web 重跑，數字和 14:51 相同。
- 15:05 tools/v2-browser.mjs 第 1 輪：17 項通過後，測試腳本自己的錯（匯出按鈕在收合的 details 裡）中止。
- 15:06 第 2 輪：第二支手機用同一組配對碼配不上（v1 設計：一組碼只配一支），測試改成沿用第一支的 token。
- 15:07 第 3 輪：41/41。看截圖發現橫拿打字時浮動按鈕超出觸控板、⌨︎ 字形在 Chrome 顯示成橫槓 → 改成橫排、改用「Aa」；第 4 輪 41/41。
- 15:08 commit db6ec1d；v2-M4。
- 15:09 Mac 端：E2EGuardPolicy 加「全系統快捷鍵」清單（e2e 模式一律不送）；SystemShortcutCheck 唯讀讀 ⌃←→↑↓ 設定，auth_ok 帶 hotkeysOff，手機在手勢用到被關掉的快速鍵時提示 Ray 去哪裡開。
- 15:10 Swift 42/42。self-test：發現 Mac mini 又鎖定（I-14），兩項需要真桌面的檢查 FAIL → 改成鎖定時 SKIP。
- 15:11 self-test 25 PASS＋2 SKIP；JS 49/49；commit 302b37c；v2-M5。
- 15:12–15:13 run4 工具（v2 步驟、檢查項、probe 吞 ⌘ 組合）；dry-run 通過；Mac 仍鎖定 → 背景唯讀等待（到 18:45）；commit afa376a。
- 15:14–15:16 README、DELIVERY v2、SPEC v2；commit 9457d7c；SUMMARY v2 卡；station working（revision 9）。
- 15:17 重新建置 dist/PhoneKeyMouse.app（bundle self-test OK，2 項因鎖定 SKIP）；v2 截圖索引；ISSUES I-15、I-16；commit 70645a6。
- 15:18 v2-M7 交付。
- 16:54 背景程式偵測到解鎖（16:54:30）。讀 git log：總控 e6bbad5 只改 COORDINATOR-LOG（核對 v2），沒有新指示。再查鎖定：未鎖定；沒有殘留的 pkm 程序和監聽埠；debug 建置（已是最新）。
- 16:55 run4（只跑一次）：16:55:06–16:55:08，probe 沒有成為前景 → e2e.sh 取消（exit 4），pkm-server 沒有啟動，0 個事件；收尾正常（前景 Finder、游標放回）。probe 在開跑前就收到實體滑鼠的移動，16:55:59 HIDIdleTime 46.9 秒 → 有人正在用 Mac（I-17）。
- 16:56–16:59 證據複製到 design/evidence/e2e-run4/；DELIVERY §V3、ISSUES I-14／I-17、TOOL-LOG、SUMMARY；commit；station 回報。

- 18:57 收到 PKM-2-3；讀 DISPATCH §8（7552b51）、USER-PROMPTS P-14；回覆時程估計約 50 分鐘；station working（revision 12）。
- 18:58 唯讀讀這台 Mac 的 symbolichotkeys：79–82 開著、沒有 parameters（用系統預設）；32、33 沒有項目（預設開）。讀 CGInjector：`e?.flags = CGEventFlags(rawValue: flags)` 會覆蓋整個旗標。
- 18:59 只建立、不送的 CoreGraphics 事件：方向鍵預設 0x20A00000、導覽鍵和 F 鍵 0x20800000、一般鍵 0x20000000（S-127）→ I-18 根本原因成立。
- 19:00 查來源：Apple 論壇 766200（帶 Fn 的 ⌃→ 會切空間）、Keyboard Maestro 2018、Apple numericPad 文件（S-123～S-126）。唯讀讀 com.apple.spaces：這台 Mac mini 只有 1 個空間。
- 19:02 KeyMap.intrinsicFlags、KeyStroke.eventFlags、CGInjector 改用；ack 帶 hotkey／hotkeyOff／spaces；SystemShortcutCheck 加 spaceCount、hotkeyName。
- 19:03 Swift 49/49；self-test 29 項全過（新增 2 項）。開始查 QR：在螢幕外畫配對視窗內容，QR 正常（Mac mini 重現不出來）。
- 19:05 匯出修改前的 web；拿掉迷你地圖；按鍵列加 ‹ › 提示和 Mac 狀態列。
- 19:06–19:07 按鍵列按鈕改成放開才送；手機提示（hotkeyHint、macStatusText）；JS 52/52。e2e.sh 加鎖定和 30 秒閒置檢查（只跑檢查：OK／門檻調高時正確拒絕，沒有啟動 probe）；e2e 驅動程式改直接送 jump；QR 改用 drawingHandler，沒有 QR 時寫出原因。
- 19:08–19:10 tools/pkm23-layout.mjs 前後量測：觸控板 463 → 535（390 寬）、347 → 419（375 寬）、橫向 844×390 不變；修改前從按鈕上滑 scrollLeft 0 而且打開了面板，修改後捲動 225～318 px、沒送任何東西。v2 瀏覽器回歸測試 41/41。
- 19:11 dry-run 假裝「⌃← 關閉、1 個空間」：三指右滑 → 手機說 ⌃← 關閉和要勾的設定；三指左滑 → 說只有 1 個桌面；設定頁兩行狀態都對。
- 19:12 重新建置 dist/PhoneKeyMouse.app（bundle self-test OK，網頁不含迷你地圖）；README 更新。
- 19:13 commit 2dadfc6（程式、測試、證據、截圖、README）。
- 19:14 DELIVERY、SPEC、process 紀錄。
- 19:16 commit 紀錄；station review；v2-M9。

## v3（PKM-3）

時間先跑 `date` 再記；中途的時間點從 Claude Code session 工作紀錄（jsonl）的時間戳換算成台北時間。

### 任務起訖
| 任務 | 開始 | 結束 | 分鐘 | commit |
|---|---|---|---|---|
| ① 聽寫疊字（P0：重現、根本原因、修、重播測試） | 00:23（讀 textsync.js／CGInjector） | 00:46（JS 64/64、Swift 55/55、self-test 32、瀏覽器 41/41＋重播 7/7、dist 重建、commit） | 約 23 | 見下方 v3-M4 |

### 里程碑
| # | 里程碑 | 時間 | 證據 |
|---|---|---|---|
| v3-M0 | 收到派工 PKM-3 | 2026-10-27 00:20:57（00:21 讀 DISPATCH-PKM-3.md） | PROMPT v3 |
| v3-M1 | 開始研究（語音鍵） | 00:23:12、00:23:25 兩個 Sonnet 子代理 | TOOL-LOG v3 |
| v3-M2 | 研究完成 | 約 00:25（兩個子代理各約 1、1.5 分鐘） | RESEARCH-LOG S-130～S-138 |
| — | 收到 PKM-3-1（疊字 P0、按鍵列自訂）、PKM-3-2（選單列 QR） | 約 00:22、約 00:24（工作中收到） | PROMPT v3、DISPATCH §6、§7 |
| v3-M3 | ① 根本原因找到並重現 | 00:28 查到 Mac 輸入來源是注音（每段都用貼上）；00:33:40 重播測試逐字重現 P-19 和 P-20 的疊字 | ISSUES I-21、web/test/dictation-replay.test.mjs |
| v3-M4 | ① 修好、測試全過、先 commit 回報 | 00:42 瀏覽器重播 before 5/5（重現）、after 7/7；00:43 dist 重建（bundle self-test OK）；00:46 commit 21f74c2，station revision 14 | design/evidence/pkm31-*、design/screenshots/v3/pkm31-input-log.png |

## v3 細項流水
- 00:21 讀 DISPATCH-PKM-3、P-18、P-19；00:22 brief（station revision 13）；00:22:40 讀 §6（PKM-3-1），00:24:09 讀 §7（PKM-3-2）。
- 00:23 回 5 行計畫（① → 語音鍵 → ②），派 2 個研究子代理。
- 00:23–00:25 讀 textsync.js、app.js 打字段、Session.swift、CGInjector.type／paste、connection.js 的補送。
- 00:28 唯讀查：KeyMouse 伺服器沒在跑、沒有記錄檔；輸入來源＝注音 → 每段文字都走貼上（S-128）。
- 00:30–00:31 LiveTyping、InputLog；app.js 改接；⚙︎ 加輸入紀錄。
- 00:32–00:33 重播測試：P-19 第二句、P-20 結尾句都逐字重現；量到 P-20 當時輸入框約 172 字（沒到 200 清空門檻），排除 (a) 是這次的原因。
- 00:34–00:36 Mac 端 InjectionPacer、ClipboardKeeper、self-test 3 項、單元測試 6 項；Swift 55/55（xcode-select 是 CLT，照 I-01 用 DEVELOPER_DIR）。
- 00:36 v2 程式加新 self-test 在 scratchpad 跑：3 項都 FAIL（S-129）。
- 00:36–00:40 v2 瀏覽器回歸：class 撞名（I-23）、Illegal invocation（I-22），修好 41/41。
- 00:41–00:42 tools/pkm31-dictation.mjs：v2 網頁 5/5 重現，新網頁 7/7；輸入紀錄截圖。
- 00:43 重建 dist（bundle self-test OK）；00:43–00:46 ISSUES、DECISIONS、README、PROMPT、RESEARCH-LOG、TIMELINE、TOOL-LOG。

### PKM-3-3（P-22 送出後舊字又送出）
| 任務 | 開始 | 結束 | 分鐘 | commit |
|---|---|---|---|---|
| I-24 送出後不重送（重現、根因、修、重播、README 真機步驟） | 00:52:55（讀 §8、P-22） | 00:59（重播 before 8/8、after 13/13，全部回歸通過） | 約 7（紀錄和 commit 另計） | 見下方 v3-M6 |

- 00:52 收到 PKM-3-3（P0）；00:53–00:55 讀 app.js 送出／清空／切模式的路徑，找到三條重送路徑；00:55 ClearedTextGuard；00:56 接到 app.js；00:57 單元測試 5 項；00:57–00:58 tools/pkm33-send-clear.mjs：v2 8/8 重現、新版 12/12；00:58 加每 0.4 秒檢查（悄悄放回的字也清掉）→ 13/13；回歸 JS 69/69、v2 瀏覽器 41/41、pkm31 7/7；00:59 README 真機步驟。
- ① 的 commit：21f74c2（00:46），station revision 14。
- 00:47–00:52 期間（PKM-3-3 之前）：選單列「用 iPhone 掃描」QR（PKM-3-2）程式、單元測試 4 項、self-test 1 項、截圖 3 張，見 PKM-3-2 的紀錄。

| # | 里程碑 | 時間 | 證據 |
|---|---|---|---|
| v3-M5 | 收到 PKM-3-3（P0） | 00:52 | DISPATCH-PKM-3.md §8（4d02cc3） |
| v3-M6 | I-24 修好、先 commit 回報 | 約 01:01（見 git log） | design/evidence/pkm33-send-clear-{before,after}.json |

### PKM-3-2（選單列 QR）
| 任務 | 開始 | 結束 | 分鐘 | commit |
|---|---|---|---|---|
| 選單列「用 iPhone 掃描」QR＋I-20 追查 | 00:47（讀 NetInfo／UI／main） | 00:52（Swift 59/59、self-test 33、截圖 3 張、dry-run 記錄確認） | 約 5（紀錄和 commit 另計，01:01–01:03） | 見 git log（PKM-3-2） |

### PKM-3 語音鍵
| 任務 | 開始 | 結束 | 分鐘 | commit |
|---|---|---|---|---|
| 研究（2 個子代理） | 00:23 | 約 00:25 | 約 2 | — |
| 語音鍵（網頁：voice.js、預覽框、直拿／橫拿 🎤、錯誤提示、設定） | 01:02（voice.js） | 01:07（pkm3-voice 13/13） | 約 5 | 見 v3-M7 |
| https（本機 CA、TLS listener、描述檔、self-test 4 項、pkm3-https 8/8） | 01:06（Server TLS） | 01:11（README 步驟） | 約 5 | 見 v3-M7 |
| 重建 dist、紀錄、commit | 01:11 | 約 01:14 | 約 3 | 見 v3-M7 |

- 01:01 commit 1e4bc90（PKM-3-2）；01:02 voice.js；01:03 index.html／CSS／app.js；01:04 voice 單元測試 5 項（JS 74/74）；01:05 pkm3-voice 11/13（I-26 兩處）→ 修好 13/13；01:06 Server TLS、LocalTLS、main；01:08 self-test HTTPS 4 項；01:08–01:10 名稱限制對照實驗（I-27、S-139）；01:10 pkm3-https 8/8；01:10 預覽框加第一次設定的連結；01:11 全部回歸（JS 74/74、Swift 59/59、瀏覽器 41/41、voice 13/13、pkm33 13/13、pkm31 7/7）；README；01:12 dist 重建（bundle self-test OK，2 項因螢幕鎖定 SKIP）。

| # | 里程碑 | 時間 | 證據 |
|---|---|---|---|
| v3-M7 | 語音鍵＋https 完成（測試全過、dist 重建） | 01:12 | design/evidence/pkm3-voice.json、pkm3-https.json、design/screenshots/v3/pkm3-voice-*.png |

### PKM-3-1 ② 按鍵列自訂
| 任務 | 開始 | 結束 | 分鐘 | commit |
|---|---|---|---|---|
| ② 按鍵列自訂（keyrow.js、編輯畫面、拖曳、新增自訂、恢復預設） | 01:13（讀 shortcuts.js、按鍵列程式） | 01:18（JS 78/78、pkm31-keyrow 14/14） | 約 5 | 見 v3-M9 |

- 01:13 keyrow.js；01:14 markup／CSS／app.js（按鍵列改成照存的清單畫）；01:15 單元測試 4 項（JS 78/78）；v2 回歸 41/41；發現 v2 證據被覆寫，從 69a5626 還原（I-28）；01:16 pkm31-keyrow 10/14（拖曳的起點在畫面外、⌘ 預設已選）→ 加自動捲動、修測試 → 14/14；01:19 全部回歸；01:20 dist 重建、統計。

| # | 里程碑 | 時間 | 證據 |
|---|---|---|---|
| v3-M8 | ② 按鍵列自訂完成 | 01:18 | design/evidence/pkm31-keyrow.json、design/screenshots/v3/pkm31-keyrow-*.png |
| v3-M9 | v3 全部交付（station review） | 01:22（commit d820207；station review） | DELIVERY v3、SUMMARY v3 |

## v4 細項流水（PKM-4＋PKM-4-1，2026-10-28，台北時間）

| 任務 | 開始 | 結束 | 分鐘 | commit |
|---|---|---|---|---|
| 讀派工、5 行計畫、station working（revision 18） | 02:02 | 02:05 | 3 | — |
| 公開版掃描（子代理）、sofapad clone、比較事實（子代理） | 02:07 | 02:20（兩個子代理都完成） | 13（背景） | — |
| 拿掉語音鍵＋https（網頁、Mac、測試工具） | 02:08 | 02:12 | 4 | 見 v4-M7 |
| 模擬器測試台（XCUITest 專案、sim.mjs、乾跑探測） | 02:12 | 02:21（Safari 配對、iOS 鍵盤打字送到伺服器） | 9 | 見 v4-M7 |
| 修正：注入佇列、版本、心跳／不補送、晚到不打、流量控制、字先於點擊、不能還原、網址精簡、改名、手冊 | 02:19 | 02:40 | 21 | 見 v4-M7 |
| 等解鎖＋等沒人在用（02:13 鎖定 → 02:40:53 解鎖 → Ray 在用 → 02:42 閒置 90 秒） | 02:13 | 02:42 | 29（同時做上一列） | — |
| 真實注入測試（3.x 對照＋新版，23 輪次檔案） | 02:43 | 03:19 | 36 | — |
| 收尾：模擬器關機、證據整理、全部回歸、dist、紀錄、公開版、sofapad 匯入 | 03:21 | 03:36 | 15 | 3b00778；sofapad 匯入 commit |

- 02:13 發現 Mac mini 鎖定（loginwindow 在前面），先做不用注入的部分；02:27 乾跑就重現 3.x 的「還原把舊字送進新視窗」；02:29–02:31 乾跑重現 3.x 卡住連線後把字打進新視窗；02:34 Swift 65/65；02:36 改名、dist 第一次建置；02:38 中文手冊；02:39 英文翻譯（子代理）。
- 02:40:53 解鎖；02:41 Ray 正在用 Mac（閒置 3 秒、Chrome 在前面），不搶前景；02:42 閒置 90 秒後開始。
- 02:43 第一輪真實注入（3.x 即時＋貼上）：B 視窗出現上一行的行尾＋Enter 13/15；02:45 TextEdit 沒關好（I-31）、閒置判斷誤擋（I-32），02:46 修好；02:46 新版 0/15；之後依序：整段、自動、還原、切主畫面、斷線（暫停、重開）、延遲、注音。
- 02:51 收到總控磁碟提醒（剩 34 GB）：只用 iPhone 18 Pro；03:21 模擬器關機；剩 33 GB。
- 03:23 全部回歸（JS 81/81、Swift 65/65、self-test 33、瀏覽器 41＋13＋7＋14＋10）、dist 重建。

| # | 里程碑 | 時間 | 證據 |
|---|---|---|---|
| v4-M0 | 收到 PKM-4 | 02:02 | process/PROMPT.md v4 |
| v4-M1 | 語音鍵拿掉、可以建置 | 02:12 | swift build、JS 測試 |
| v4-M2 | 模擬器測試台能用（XCUITest 在 Safari 用 iOS 鍵盤打字） | 02:21 | tools/pkm4/、scratchpad simprobe |
| v4-M3 | 3.x 的外洩在乾跑重現（還原、卡住連線） | 02:31 | tools/pkm4/run.mjs --dry |
| v4-M4 | 修正完成（單元測試、瀏覽器測試全過） | 02:40 | web/test/flow.test.mjs、mac/Tests/PKMCoreTests/PKM4Tests.swift、tools/pkm4-browser.mjs |
| v4-M5 | 真實注入重現 3.x 的問題 | 02:45 | design/evidence/pkm4/switch-old-live-paste.json |
| v4-M6 | 新版通過：64 輪 0 次、斷線 22 次、延遲 p95 37 ms | 03:19 | design/evidence/pkm4/runs.json |
| v4-M7 | phone-keymouse commit（PKM-4 程式＋紀錄） | 03:31（3b00778） | git log |
| v4-M8 | sofapad 匯入 commit 準備好（不 push；40dc24c 之後的唯一一個 commit，Swift 65/65、JS 81/81 在匯出的樹上重跑過）、紀錄 commit、station review | 03:32（匯入 commit）；約 03:36（紀錄、station） | ~/Workspace/sofapad git log |
| v4-M9 | 總控驗收功能通過；§7 三處隱私補修（Tailscale IP、測試配對碼、總控的其他工作），修改 sofapad 原匯入 commit（不 push），新 id 見 orchestration 回覆 | 03:34 收到 → 約 03:47 | design/PUBLIC-CHECK.md 2b、docs/PUBLIC-CHECK.md |

## SOFA-5（SofaPad 4.1，2026-10-28）

| 里程碑 | 內容 | 時間 | 證據 |
|---|---|---|---|
| S5-M0 | 收到派工（Safari 黑屏：拒絕要說明、同網段 IPv6、換網路自動更新、README 排查表） | 15:53 | — |
| S5-M1 | 補充：手機開著 Tailscale → 加「允許 Tailscale 裝置」開關 | 約 15:58 | — |
| S5-M2 | 程式＋單元測試（Swift 75/75、JS 81/81） | 16:05 | `swift test`、`node --test` |
| S5-M3 | `tools/build-app.sh` → dist/SofaPad.app 4.1.0；`--self-test` OK；`--dry-run` 實機檢查；截圖 | 16:04–16:09 | design/evidence/sofa5/ |

## SOFA-6（SofaPad 4.2，2026-10-29）

| 里程碑 | 內容 | 時間 | 證據 |
|---|---|---|---|
| S6-M0 | 收到派工（輸入框殘字／卡住、游標板、4.2 打包） | 15:24 | — |
| S6-M1 | 在 4.1 的網頁重現：15/29 項通過（舊字再送、組字卡住、送出注音符號）；加到 35 項後 4.1 是 16/35 | 15:34；15:56 | design/evidence/sofa6/commit-before.json |
| S6-M2 | 修正後 35/35；回歸 pkm33 抓到 I-41，修好 13/13 | 15:36–15:40 | commit-after.json |
| S6-M3 | 游標板：手機（caret.js、單元測試 7）、Mac（caret 訊息、白名單、單元測試 5）、瀏覽器 15/15 | 15:29–15:44 | caret-browser.json、SOFA6Tests |
| S6-M4 | 真實注入：15:45 Mac 鎖定沒跑；16:00–16:11 被 Siri 浮層擋 4 次（I-45）；16:11 5/6（第 6 項預期寫錯）；16:14 6/6 | 15:45–16:14 | — |
| S6-M5 | 4.2.0：CHANGELOG、README、INSTALL、release notes、package.sh | 15:46–15:48 | dist/release（不提交） |
| S6-M6 | 總控推之前發現 zip 的執行檔還有本機路徑（I-47）：build-app.sh 加 dSYM＋strip＋路徑檢查（D-46），重新打包；`--self-test` 33/33；zip 逐位元組掃 0 筆；新的 SHA-256 `4fc968ee…3f0b` | 17:17–17:25 | design/evidence/sofa6/release-zip-scan.txt |
