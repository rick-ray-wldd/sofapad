# DELIVERY：PKM-1 手機鍵盤滑鼠

> 公開版本：為了隱私，電腦名稱、使用者名稱、區網 IP（改成 192.168.x.x）、本機路徑、個人助理系統的 id、他人姓名和 email 已遮蔽，P-22 和他人對話有關的原文改成概述（見 docs/PUBLIC-CHECK.md）；其餘逐字未改。

- writer：Claude Code（Opus 5.5），Orca station S-…，Mac mini。
- 交付時間：2026-10-23 12:40（M7）。§3「真實注入」：Ray 解鎖 Mac mini 後（總控 14:51 確認），14:52 照 PKM-1-2 跑了 run2（只跑一次）：打字和游標移動通過，點擊、捲動被測試保護誤擋（I-11）。14:59 照 PKM-1-3 修好測試保護後跑 run3（只跑一次）：**16 項檢查全部通過**，打字、移動、點擊、雙擊、右鍵、捲動、拖曳都真的在 Mac 畫面上發生（見 §3）。
- 怎麼用：見 `README.md`。

## 1. 成功條件逐項對照（DISPATCH-PKM-1 §2）

| # | 條件 | 狀態 | 證據 |
|---|---|---|---|
| 1 | **研究（M2）** `research/REPORT.md`，繁體中文 | ✅ | `research/REPORT.md`；來源表 `process/RESEARCH-LOG.md`（S-01～S-100，共 82 筆） |
| 1a | 學術文獻至少 8 篇，實際打開；讀不到全文就標「僅摘要」 | ✅ 23 篇有內容（12 篇全文或部分全文、11 篇僅摘要）＋2 篇只有書目 | REPORT §2；`research/raw/papers.md` |
| 1b | Phonaze 自己核對 | ✅ writer 用 curl 抓 ISMAR 2026 官方論文頁，paper 1557 的題名、作者、摘要都相符；全文沒有公開，所以標「僅摘要」 | RESEARCH-LOG S-01、S-02 |
| 1c | GitHub 至少 8 個，每個記星數、最後更新、授權、平台、做法、能借什麼 | ✅ 21 個；4 個 clone 到 `~/third-party/` 唯讀深讀（不安裝、不執行），並登記在該處 README | REPORT §3；`research/raw/github.md` |
| 1d | 現成產品＋Apple 內建（Universal Control、Mac Virtual Display、iPhone 當藍牙鍵盤…），每個寫清楚滿不滿足 | ✅ 13 個 App＋Apple 內建 15 項＋硬體 3 項 | REPORT §4 |
| 1e | 結論：有沒有現成可用的；為什麼還要做 | ✅ 有接近的（Tracepad、sofatap），但沒有一個在文件裡同時保證「手機注音直打」、「戴頭顯也能配對」、「沒有追蹤」；建議 Ray 可以先試；自己做的 6 個理由 | REPORT §0、§5 |
| 2 | **設計（M3）** `design/SPEC.md`：架構、鍵盤、滑鼠、安全、延遲、失敗處理 | ✅ | `design/SPEC.md`；`process/DECISIONS.md` D-01～D-13 |
| 3 | **原型（M4、M5）**：可以執行 | ✅ `dist/PhoneKeyMouse.app`（`tools/build-app.sh`），或 `swift run --package-path mac pkm-server` | §2 |
| 3a | 手機打中文、英文，Mac 收到正確文字 | ✅ **14:52 真實注入通過**：手機網頁（注音組字＋選字）→ Mac 上真的 NSTextView，最後內容正好是「你好， Hello」換行「整段送出測試 OK」（含 emoji 再 ⌫ 刪掉、Enter、整段模式）；13 個 ack 全部 ok | §3 run2；`design/evidence/e2e-run2/` |
| 3b | 滑鼠移動、點擊、右鍵、捲動都能用 | ✅ **14:59 真實注入通過（run3）**：probe 收到點擊 clickCount 1、雙擊 1→2、右鍵、6 次精確捲動、6 次左鍵拖曳；22 個點擊、捲動、拖曳事件全部落在 probe 視窗內，測試保護擋下 0 個。run2 時這部分被測試保護誤擋（I-11），修好後才驗證到 | §3 run3；`design/evidence/e2e-run3/` |
| 4a | 單元測試 | ✅ Swift 39 個、JS 27 個，全部通過 | `design/evidence/swift-tests.txt`、`js-tests.txt` |
| 4b | 手機尺寸（390 寬，直拿和橫拿）截圖 | ✅ 10 張（390×844、844×390，3x） | `design/screenshots/`（說明在 `index.json`） |
| 4c | 本機延遲 | ✅ 見 §2 的 E5 | `design/evidence/bench-loopback.json`、`bench-lan-ip.json` |
| 4d | 配對碼錯誤會被拒絕 | ✅ 實際 socket 測試：錯的碼回 `auth_fail bad_code`，之後送的 move 被拒絕並斷線，注入器收到 0 個事件；錯 5 次鎖 30 秒；全部累計錯 20 次就換碼並關閉配對；舊的 proof 不能重放 | `ServerTests.testEndToEndOverSocket`、`SessionTests.testWrongPairingCodeIsRejected`、`PairingTests.*` |
| 4e | 輔助使用權限：做不到的部分寫清楚，附開權限步驟 | ✅ README §2；Mac mini 的狀況見 §3 | README |
| 5 | **交付（M7）** README、DELIVERY | ✅ | 本文件、`README.md` |
| — | 記錄規則：process/ 六個檔、里程碑當下記、子代理記錄 | ✅ | `process/` |

## 2. 自測證據

| 編號 | 測試 | 結果 | 怎麼重跑 |
|---|---|---|---|
| E1 | **CGEvent self-test**：用真正的 `CGInjector` 建立事件，攔截下來檢查（不送進系統）。內容：中文、全形標點、英文、emoji、ZWJ emoji 各成一組 Unicode keyDown/keyUp；換行送 Return（36）；⌘C 和 ⇧⌘Z 的修飾鍵順序；雙擊 clickState 1→2；右鍵；拖曳是 leftMouseDragged、delta 10；捲動 30.6＋0.6 px → 30、1 px 且 continuous；迷你地圖跳到螢幕中央；游標不會超出螢幕；250 字自動改用貼上，並還原剪貼簿（用私有剪貼簿，標成 transient／concealed）；e2e 測試保護 6 項（I-11 後新增：在通知中心和 Dock 透明層底下的真視窗，hit test 判斷正確；前景和目標視窗兩條規則都要符合；不接點擊的視窗會被略過；拿不到視窗就擋。測試時會在螢幕中央顯示一個小橘色視窗約半秒，不會搶前景） | **25/25 PASS** | `dist/PhoneKeyMouse.app/Contents/MacOS/PhoneKeyMouse --self-test` → `design/evidence/self-test.txt` |
| E2 | Swift 單元測試和整合測試（HTTP、WebSocket、Host／Origin、區網過濾、配對與鎖定、HMAC proof、跨語言測試向量、Session 去重、斷線放開按鍵、鎖定畫面不注入、在 127.0.0.1 上用真的 socket 跑整個流程、e2e 測試保護的判斷規則） | **39/39 PASS** | `swift test --package-path mac` |
| E3 | 手機網頁驅動（headless Chrome，iPhone 尺寸，CDP 觸控和輸入法事件）→ 真的 pkm-server（`--dry-run`）：配對 → 迷你地圖跳躍 → 單指移動 → 點擊、雙擊 → 雙指右鍵 → 雙指捲動 → 長按拖曳（down→move→up）→ 注音組字（組字中送出 0 筆）→「你好，」＋「 Hello」＋😀 → ⌫ → Enter → 整段模式送出 | **全部指令正確送到伺服器**；在這個過程中抓到並修好 I-08（長按拖曳在瀏覽器裡壞掉） | `tools/e2e.mjs`（流程）；dry-run 指令見 TOOL-LOG 12:24–12:25 |
| E4 | JS 單元測試：手勢狀態機（點擊、長按、雙指右鍵、捲動慣性、殘留手指）、加速度、注音組字流程、中英混打、autocorrect 刪改、emoji grapheme、修飾鍵＋字母快捷鍵、SHA-256／HMAC 和 node:crypto 比對、連線（proof 不含 token、補送、去重複、bad_token） | **27/27 PASS** | `cd web && node --test test/*.test.mjs` |
| E5 | 延遲（Mac mini 本機，headless Chrome 頁面裡量，`--no-post`：會建立 CGEvent 但不送出） | ping 往返 p50 0.1／p95 0.2–0.3 ms；「你好」送出到確認 p95 0.4 ms（伺服器處理 p95 0.18–0.21 ms）；⌘C 33 ms（設計上修飾鍵各等 12 ms）；連續 1000 次移動處理速度約 1.4–1.6 萬次／秒 | `tools/bench.mjs`（README §8） |
| E6 | `.app` 冒煙測試：網頁從 bundle 的 Resources 提供；`/test/*` 回 404；假 Host 回 421；port 關閉 | PASS | TOOL-LOG 約 12:32–12:33 |
| E7 | 截圖 10 張：配對、直拿主畫面、長按拖曳、注音組字＋快捷鍵、鍵盤打開、設定、橫拿、橫拿左手、斷線、沒有權限 | 已存 | `design/screenshots/` |

## 3. 真實注入端對端（M4、M5 的最後一步）

- 做法（D-10＋總控 PKM-1-1 的四條限制）：
  - `tools/e2e.sh` 啟動測試視窗 `pkm-probe`，讓它成為前景。
  - 伺服器只綁 127.0.0.1，並開啟 `--e2e-guard-pid`：只有前景是 probe 時才送事件；點擊和捲動還要確認游標底下的視窗屬於 probe。
  - 整個流程約 10 秒；結束後關 port，恢復游標位置和原本的前景 App。
- **12:25 run1**：probe 沒有成為前景，前景是 `com.apple.loginwindow`。唯讀檢查確認 `CGSSessionScreenIsLocked=True`，也就是 **Mac mini 在鎖定畫面**。腳本照設計中止，**沒有送出任何事件**（`design/evidence/e2e-run1-aborted/`）。
- 因為這樣，產品加了「Mac 鎖定時不注入任何東西」的保護（有單元測試），手機上會顯示提示。
- **待補**：13:45 之後，如果 Mac mini 已經解鎖，在 PKM-1-1 的限制內重跑 run2，結果寫在下方。如果一直鎖著，這一步就交給 Ray：在 MacBook Neo 開好權限後，執行 `tools/e2e.sh`（README §8），或直接照 README §3–4 用手機試。

- **13:45：沒有執行。** 背景程式從 12:37 起每 20 秒用 `ioreg` 唯讀檢查一次。13:45:18 時仍然 `CGSSessionScreenIsLocked=True`，13:45:25 再查一次還是鎖定。
  - 照 PKM-1-1：13:00–13:45 完全沒有做任何注入，也沒有把測試視窗拉到前面。13:45 之後也沒有做，因為螢幕還鎖著。
  - 這一次沒有啟動 probe，也沒有啟動伺服器。port 8765 沒有在監聽。
- **14:52 run2（總控 PKM-1-2：Ray 已解鎖，只跑一次）**
  - 跑之前：14:52:20 和 14:52:41 各查一次，都沒有 `CGSSessionScreenIsLocked`。debug 版是最新的，前景是 Orca。
  - 過程：14:52:41 開始，14:52:55 結束，**共 14 秒**。伺服器只綁 127.0.0.1（隨機 port 36946），結束後確認 port 已關閉，pkm-server 和 pkm-probe 都沒有殘留。
  - 恢復狀態：游標回到測試前的位置 (2177, 0)，前景回到 Orca。
  - 證據：`design/evidence/e2e-run2/`（配對碼和 QR 已移除）。

  | 檢查 | 結果 |
  |---|---|
  | probe 成為前景，事件只進 probe | PASS |
  | 迷你地圖跳到螢幕中央（游標進入 probe 視窗） | PASS |
  | 單指滑動 → 游標往右移 | PASS（x 1279 → 1332） |
  | 注音組字中沒有送出任何東西 | PASS（0 筆） |
  | 整段模式：按送出前不送 | PASS |
  | **Mac 文字框內容 = 「你好， Hello\n整段送出測試 OK」** | **PASS**：probe 收到 21 個按鍵，包含 😀、⌫（51）、Return（36） |
  | 所有 ack ok | PASS（13 個；從手機網頁送出到收到確認 7–21 ms，伺服器處理 0.7–19 ms） |
  | 游標與前景 App 已恢復 | PASS |
  | 點一下、點兩下、雙指右鍵、雙指捲動、長按拖曳 | **FAIL**：伺服器日誌 16 行 `e2e guard: target is not the probe`。按下、放開、右鍵、捲動全部被擋，**沒有送進系統** |
  | 前景檢查沒有擋到任何事件 | FAIL（同上） |

  - **失敗原因（I-11）**：測試保護 `E2EGuard.windowOwner(at:)` 把「包含游標的最上層視窗」當成點擊目標。14:53 唯讀列出視窗後發現，螢幕中央最上面是**通知中心（layer 21）和 Dock（layer 20）的全螢幕透明視窗**，它們不接點擊，但保護程式不知道，所以把每個點擊和捲動都判成「目標是通知中心」。
  - 這是**測試工具太嚴格**，不是產品的程式。產品本身（沒有 `--e2e-guard-pid`）不會經過這段檢查。錯誤是往安全的方向：沒有任何點擊或捲動送到其他 App。
  - 照 PKM-1-2 第 2 點，當時沒有重跑，也沒有改程式，先等總控同意修法。
- **14:57–14:59 修正（總控 PKM-1-3 核准）**
  - I-11：`E2EGuard.windowOwner(at:)` 改用 AppKit 的 hit test `NSWindow.windowNumber(at:belowWindowWithWindowNumber: 0)`，也就是「真的按下滑鼠會打到哪個視窗」，再查這個視窗屬於哪個程式。
    - 「probe 在前景」和「目標視窗屬於 probe」兩條規則都保留。拿不到視窗號碼或擁有者，一律當成不是 probe，照樣擋。
    - 判斷規則抽成 `PKMCore/E2EGuardPolicy`，加了 3 個單元測試；self-test 加了 6 項。
  - I-12：`tools/e2e.sh` 在 `open` 之前，用 `lsappinfo` 記下原本的前景 App，傳給 probe（`--restore-pid`）。檢查程式比對測試前後的前景 App。
  - 跑 run3 之前三組測試全過：Swift 39/39、JS 27/27、self-test 25/25（14:59:05–14:59:09）。
- **14:59 run3（只跑一次）**
  - 跑之前：14:59:14 和 14:59:19 各查一次，都沒有鎖定；前景是 Orca。
  - 過程：14:59:19 開始，14:59:30 結束，**共 11 秒**。伺服器只綁 127.0.0.1（隨機 port 33371），結束後確認 port 已關閉，pkm-server 和 pkm-probe 都沒有殘留。
  - 恢復狀態：游標回到測試前的位置 (2177, 0)；前景 App 測試前是 pid 81665（Orca），測試後也是 81665。
  - 證據：`design/evidence/e2e-run3/`（配對碼和 QR 已移除）。

  | 檢查 | 結果 |
  |---|---|
  | probe 成為前景，事件只進 probe | PASS |
  | 迷你地圖跳到螢幕中央（游標進入 probe 視窗） | PASS |
  | 單指滑動 → 游標往右移 | PASS |
  | **點一下 → 左鍵（clickCount 1）** | **PASS** |
  | **點兩下 → 雙擊（clickCount 2）** | **PASS**（左鍵按下的 clickCount 依序是 1、1、2、1：單擊、雙擊、長按拖曳） |
  | **雙指點 → 右鍵** | **PASS** |
  | **雙指往下滑 → 捲動（dy>0、精確捲動）** | **PASS**（6 次，每次 dy 15） |
  | **長按再拖 → 左鍵拖曳** | **PASS**（6 個 leftMouseDragged） |
  | 注音組字中沒有送出任何東西 | PASS |
  | 整段模式：按送出前不送 | PASS |
  | Mac 文字框內容 = 「你好， Hello\n整段送出測試 OK」 | PASS |
  | 所有 ack ok | PASS（13 個；送出到確認 5.7–20.3 ms） |
  | 前景檢查沒有擋到任何事件（全部在 probe 上） | PASS（server.log 0 行 dropped；22 個點擊、捲動、拖曳事件的位置全部在 probe 視窗內） |
  | 游標與前景 App 已恢復 | PASS |
  | 原本的前景 App 有記下來（不是 probe 自己） | PASS（`previous: com.stablyai.orca`） |
  | 結束後前景回到原本的 App | PASS（81665 → 81665） |

- **結論**：在這台 Mac mini 上，手機網頁的打字、移動、點擊、雙擊、右鍵、捲動、拖曳，都已經真的注入進 macOS 並送達 App。
  - 還沒驗證的是：真的 iPhone（這次是用 headless Chrome 模擬手機）、經過 Wi-Fi（這次是 127.0.0.1），以及 MacBook Neo＋Vision Pro 的實際使用情境（M6，需要 Ray）。

## 4. 需要 Ray 做的事

1. **在 MacBook Neo 上建置並打開 App**（README §1，約 5 分鐘）。
2. **開「輔助使用」權限**（README §2，約 1 分鐘）。只有 Ray 能開，writer 沒有、也不會改任何系統設定。
3. **手機配對並實際試用**（README §3–4）：打一段中文和英文、拖曳一次、捲動一次。這就是 M6「Vision Pro＋沙發情境實際用過」，需要 Ray 確認。
4. 有興趣的話，比較一下現成的 Tracepad 或 sofatap（REPORT §5）。

## 5. 已知限制

| 限制 | 影響 | 之後怎麼改 |
|---|---|---|
| 真實注入只在 Mac mini 上、用 headless Chrome 模擬手機、經過 127.0.0.1 驗證過（run3 全部通過） | MacBook Neo、真的 iPhone、經過 Wi-Fi 的情況還沒有實測 | Ray 在 MacBook Neo 上用手機試（M6），也可以跑 `tools/e2e.sh` |
| 沒有在真的 iPhone 上測過 | iOS Safari 的輸入法事件順序、空欄位按 ⌫ 的 keydown、觸覺回饋（iOS 18 switch 技巧）、加入主畫面的行為，都還要實機確認 | Ray 試用後回報 |
| v1 沒有 TLS | 同一個 Wi-Fi 上正在主動攻擊的人可以劫持已建立的連線；配對那一刻 token 會以明文傳一次 | v2：本機 CA＋iPhone 描述檔（D-12） |
| http 網頁沒有 Wake Lock 和陀螺儀 | 手機會照系統設定自動鎖定 | 調長 iPhone 自動鎖定時間；v2 加 TLS 後可以用 Wake Lock |
| 少數 App 會忽略 Unicode 按鍵 | 那些 App 打不出字 | 長文字會自動改用貼上；也可以 `--text-mode paste` |
| 快捷鍵用 ANSI 鍵碼 | 用 Dvorak、AZERTY 配置時，⌘Z 這類快捷鍵的位置可能不對 | v2 用 UCKeyTranslate（S-33） |
| 能不能控制 visionOS 的 App 未知 | Mac Virtual Display 共用指標時，指標從 Mac 移到 visionOS 視窗的那段，可能只有實體裝置才能觸發 | Ray 實測 |
| ad-hoc 簽章 | 每次重新建置後，要重新給輔助使用權限 | 用 Apple Developer ID 簽章（Ray 決定） |
| 一組配對碼只能配對一支手機 | 第二支手機要另外要新碼 | 這是設計選擇，為了安全 |
| Mac 鎖定時不能用手機輸入 | 不能用手機輸入 Mac 的開機或鎖定密碼 | 用 Touch ID、Apple Watch 或 Mac 鍵盤解鎖（這是安全選擇） |

## 6. 位置

- 專案：`phone-keymouse`（本機 git，沒有遠端）。
- App：`dist/PhoneKeyMouse.app`（build 產物，不進 git；用 `tools/build-app.sh` 重建）。
- 第三方參考程式碼：`~/third-party/{MacPilot,remote-touchpad,VibeCast,opencouchpad}`（唯讀，沒有安裝、沒有執行）。

---

# v2（PKM-2：Ray 試用回饋）

- 派工：DISPATCH-PKM-2.md（含 §6 PKM-2-1、§7 PKM-2-2），2026-10-24 14:47 收到。
- writer：同 v1（Claude Code，Opus 5.5），子代理 2 個（Sonnet）。
- 交付時間：見 process/TIMELINE.md 的 v2-M7。§V3「真實注入 run4」的結果在下方。

## V1. 成功條件逐項對照（DISPATCH-PKM-2 §2、§6）

| # | 條件 | 狀態 | 證據 |
|---|---|---|---|
| 1 | 先查清楚 macOS 能不能用程式注入真的多指手勢，結論和來源寫進 DECISIONS；只能私有 API 就不用 | ✅ **不能用公開 API**：公開的 CGEventType 沒有手勢類型；現有工具（SensibleSideButtons、Mac Mouse Fix、yabai、Hammerspoon）都靠私有欄位、私有 HIDEvent 或注入 Dock，macOS 27 起舊的私有欄位已失效。所以不用私有 API，改送系統快捷鍵 | DECISIONS D-15；RESEARCH-LOG S-114～S-122；research/raw/v2-gestures.md |
| 1a | 三指左右滑 ⌃←／⌃→ 切換桌面，三指上滑 ⌃↑ Mission Control，三指下滑 ⌃↓ App Exposé | ✅ 方向和 Mac 觸控板一致（往左滑＝右邊的桌面）；Mac 端唯讀檢查這些快速鍵有沒有被關掉，關掉時手機會提醒 Ray 去哪裡開 | web/js/pointer.js、shortcuts.js `gestureShortcut`；SystemShortcutCheck |
| 1b | 評估雙指左右滑上一頁／下一頁、雙指捏合縮放 | ✅ 捏合 → ⌘＝／⌘−，預設開。雙指快滑 → ⌘[／⌘]，做了，但**預設關**（會和左右捲動搶，誤觸會離開網頁）。評估寫在 D-15 | D-15 |
| 1c | 手勢不能和雙指捲動、長按拖曳衝突；要有單元測試和瀏覽器層級測試 | ✅ JS 單元測試 13 項（四個方向、對角線不觸發、捲動中加第三指不變成滑動、捏合和捲動分開、雙指點右鍵、長按拖曳不變、快滑預設關）；瀏覽器（CDP 多點觸控）10 項 | web/test/gestures-v2.test.mjs；design/evidence/v2-browser.json |
| 2 | 快捷鍵面板：內建 ⌘C、⌘V、⌘X、⌘Z、⇧⌘Z、⌘A、⌘Tab、Spotlight、⇧⌘3／4／5、⌃⇧⌘3／4 | ✅ 全部都有，另外有 Mission Control、App Exposé、左右桌面、⌘S／F／T／W、⌘[／]、⌘＝／−、⌘←／→、⌥⌫ | web/js/shortcuts.js `BUILTIN_GROUPS`；單元測試逐一比對 |
| 2a | 自訂：新增、編輯、刪除、排序；組合鍵用選的，有預覽；存在手機，換頁、重開還在 | ✅ 修飾鍵四個切換鈕＋按鍵分組選單＋即時預覽（例如 ⌃⇧⌘4）；↑↓ 排序；存 localStorage；瀏覽器測試重新整理後還在 | DECISIONS D-17；v2-browser.json；截圖 v2-04 |
| 2b | 匯出、匯入（JSON） | ✅ 匯出／匯入（加在後面，或取代全部要按兩次確認）；壞掉的 JSON 會顯示錯誤，清單不變；匯入到另一支（空的）手機的瀏覽器測試通過 | shortcuts.test.mjs；v2-browser.json |
| 3 | 觸控區變小：先重現（headless Chrome、iPhone 尺寸、模擬鍵盤和 visualViewport 變小） | ✅ tools/touch-area.mjs：layout viewport 保持 390×844、只縮 visualViewport（和 iOS 一樣），加上 iPhone 的 safe-area | design/evidence/v2-touch-area-before.json |
| 3a | 根本原因寫進 ISSUES，再修 | ✅ I-13：直拿是單欄，只有觸控板會伸縮；鍵盤吃掉的 336–380 px **全部**由觸控板吸收；下方 safe-area 34 px 在鍵盤後面白白浪費；快捷鍵面板和多行文字框往下推。修法 D-14（鍵盤模式） | process/ISSUES.md I-13；DECISIONS D-14 |
| 3b | 修好後附前後截圖 | ✅ 前後各 5 張，同一支腳本、同樣條件（「前」用 git 匯出的 v1 程式碼跑） | design/screenshots/v2/before-*.png、after-*.png |
| 6 | 同時支援直向和橫向；橫向觸控板全螢幕 | ✅ 橫向時觸控板 844×390 滿版，其他控制項收成浮動按鈕列（連線、Aa 鍵盤、⌘ 快捷鍵、鎖、⚙︎） | 截圖 v2-05～v2-08；v2-browser.json |
| 6a | 手勢不能誤觸；能叫出鍵盤或快捷鍵面板再回到全螢幕 | ✅ 浮動按鈕上的觸控不算觸控板觸控；「Aa」叫出文字列＋鍵盤，再點一次回全螢幕；「⌘」叫出面板 | v2-browser.json（轉向 11 項） |
| 6b | 轉向時狀態不遺失（拖曳鎖定、整段模式的字） | ✅ 直 → 橫 → 直，拖曳鎖定一直保持（沒有多送放開或按下），整段文字還在，轉回來按送出才送 | v2-browser.json |
| 6c | Fullscreen API 先查 iOS 支援，結論寫進 DECISIONS | ✅ iPhone 的 Safari 不支援非影片元素全螢幕，也不能鎖方向；真正滿版要「加入主畫面」。支援 Fullscreen API 的裝置（Android、iPad）才顯示「⛶」按鈕 | DECISIONS D-16；RESEARCH-LOG S-109～S-113 |
| 5 | 自測：Swift、JS、self-test 全過；真實注入只跑一次、照 PKM-1-1／1-3；切桌面、Mission Control 不做真實注入 | ⚠️ 單元測試全過；self-test 25 PASS＋2 SKIP（Mac 鎖定，見 I-14）。真實注入 run4（16:55，只跑一次）：probe 沒有成為前景（有人正在用 Mac），安全中止，0 個事件（I-17）；v2 新功能的真實注入還沒驗證，見 §V3 | design/evidence/*.txt |

## V2. 自測證據（v2）

| 編號 | 測試 | 結果 | 怎麼重跑 |
|---|---|---|---|
| V-E1 | JS 單元測試（v1 27 項＋手勢 13 項＋快捷鍵 9 項，含「手機能送的每個鍵都在 KeyMap.swift 裡」的跨語言比對） | **49/49 PASS** | `cd web && node --test test/*.test.mjs` |
| V-E2 | Swift 單元測試（v1 39 項＋全系統快捷鍵辨識 2 項＋快速鍵設定解析 1 項） | **42/42 PASS** | `swift test --package-path mac` |
| V-E3 | self-test（v1 25 項＋e2e 保護擋全系統快捷鍵 2 項） | **25 PASS、2 SKIP**（15:11 Mac mini 鎖定，「自己的視窗在游標下」量不到；解鎖時 PKM-1-3 已驗證過這兩項） | `pkm-server --self-test` |
| V-E4 | 瀏覽器層級（headless Chrome，iPhone 尺寸，CDP 多點觸控，safe-area，dry-run 伺服器）：三指四方向、捏合、雙指捲動、雙指點、長按拖曳、面板、自訂（新增／排序／編輯／刪除／重新整理後還在／匯出／匯入到另一支手機／壞 JSON）、直拿打字版面、直 ↔ 橫轉向和狀態 | **41/41 PASS** | `node tools/v2-browser.mjs` → design/evidence/v2-browser.json |
| V-E5 | 觸控區前後量測（Safari 分頁可視 464 px／主畫面 App 508 px） | 直拿打字時觸控板 **155 → 305 px**（主畫面 App 199 → 349）；開快捷鍵面板 120 → 305（v1 面板還會被切掉）；三行字 120 → 285 | `node tools/touch-area.mjs --label after`；`--label before --web <v1 web>` |
| V-E6 | run4 驅動程式先對 dry-run 伺服器跑一次（不操作 Mac） | 14 個步驟都完成；22 個 ack 全 ok；送出的全系統快捷鍵 0 個 | TOOL-LOG 15:13 |

## V3. 真實注入 run4（只跑一次）

- 範圍：v1 的整套流程＋v2 新增的捏合縮放（⌘＝／⌘−）、快捷鍵面板 ⌘A、編輯器建立的自訂 ⌥⌘K、橫拿全螢幕觸控板點擊。
- **不送**：三指滑動、⌃方向鍵、⌘Tab、Spotlight、截圖（全系統動作，PKM-2 §2-5）。e2e 保護另外加了一層：就算前景是 probe，這類快捷鍵也一律不送（Swift 和 self-test 都有測）。
- probe 會吞掉 ⌘A 以外的 ⌘ 組合，避免測試視窗發出提示音或執行選單。
- 狀態：見下方「run4 結果」。

### run4 結果（2026-10-24 16:55，只跑一次）：安全中止，沒有送出任何事件

- 開跑前：15:10 起 Mac mini 鎖定（I-14），背景程式每 20 秒用 ioreg 唯讀檢查，16:54:30 偵測到解鎖。16:55:06 writer 再查一次：未鎖定；不在 13:00–13:45；沒有殘留的 pkm 程序和監聽埠；前景是 Finder。
- 16:55:06 開跑 → 16:55:08 結束（約 2 秒）。probe 啟動 0.8 秒後檢查，**前景不是 probe**（還是 Finder），e2e.sh 照設計取消測試（exit 4）。pkm-server 沒有啟動，手機驅動程式沒有執行，所以**沒有注入任何鍵盤或滑鼠事件**。
- 收尾：probe 自己結束，前景還給 Finder；16:55:17 查過沒有殘留程序和監聽埠。probe 把游標放回開始位置（728, 445）；當時有人在動滑鼠，所以游標被拉回約 35 px。
- 現象：伺服器還沒啟動，probe 就收到 8 個游標移動事件（位置在 probe 視窗外，是實體滑鼠）；16:55:59 唯讀查 HIDIdleTime 是 46.9 秒，也就是 16:55:12 還有人在操作。推測是 Ray（或其他人）剛解鎖、正在用 Mac，前景沒有交給 probe；沒有進一步驗證（I-17）。
- 結論：**run4 真實注入沒有完成**。這不是功能失敗，是開跑條件不成立，安全檢查擋下。照派工只跑一次，不重跑，也不改程式。v2 新增的捏合、面板 ⌘A、自訂 ⌥⌘K、橫拿點擊還沒在真的 Mac 上注入過；送出的內容已由 dry-run（V-E6）和瀏覽器測試（V-E4）涵蓋。
- 補跑：要總控／Ray 重新同意一次，而且跑的那 1 分鐘內不要動 Mac 的滑鼠和鍵盤（`PKM_QUIET_HOURS=1300-1345 PKM_E2E_V2=1 tools/e2e.sh`，README §8）；或在 MacBook Neo 上跑 `PKM_E2E_V2=1 tools/e2e.sh`。
- 證據：design/evidence/e2e-run4/（probe.jsonl、times.txt）。伺服器沒啟動，所以沒有 server.log、driver.json、result.json。

## V4. 還沒驗證的部分

| 項目 | 為什麼還沒驗證 | 怎麼驗證 |
|---|---|---|
| v2 新功能的真實注入（捏合、面板 ⌘A、自訂 ⌥⌘K、橫拿點擊） | run4 安全中止，沒有送出事件（I-17）；只驗證到 dry-run 和瀏覽器層級 | 總控／Ray 同意後再跑一次，跑的時候不要動 Mac；或在 MacBook Neo 上跑 |
| 真的 iPhone | 沒有實機；鍵盤高度（336／380 px）是估計值，找不到新機型的可靠數字（S-106） | Ray 在手機上看打字時觸控板夠不夠大 |
| iOS 自己的三指手勢會不會搶走三指 | iOS 的三指編輯手勢（左滑＝還原）是系統層，網頁沒有已證實的關閉方法（S-107、S-108） | Ray 在鍵盤收起和打開時各試一次三指滑動 |
| 三指切桌面在 Mac 上真的切換 | 照派工不在 Mac mini 上真實注入（會切走 Ray 的畫面）；只在單元測試、瀏覽器測試和 dry-run 驗證送出的是 ⌃→ 等快捷鍵 | Ray 在 MacBook Neo 上試；手機會提醒快速鍵是否被關掉 |
| 截圖快捷鍵 | 同上（會在 Mac mini 上真的截圖） | Ray 試 ⌃⇧⌘4 → 長按拖曳拉範圍 → 貼到任何地方 |
| Vision Pro＋沙發情境 | 需要 Ray | Ray 試用 |
| 主畫面 App 在橫向是否完全滿版 | 沒有來源直接證實 iPhone 橫向時狀態列一定隱藏 | Ray 用「加入主畫面」打開後橫拿看看 |

## V5. 需要 Ray 做的事（v2）

1. 在 MacBook Neo 上重新建置 App（`./tools/build-app.sh`），或用 Mac mini 上新建好的 `dist/PhoneKeyMouse.app`。重新建置後要在「輔助使用」把舊的移除再加一次（README §2）。
2. 確認 Mac 的快速鍵有開：系統設定 → 鍵盤 → 鍵盤快速鍵… → Mission Control（README §4）。
3. 手機重新整理網頁（或從主畫面重開），試：直拿打字時的觸控板大小、三指左右上下滑、捏合、快捷鍵面板、自訂一個 ⌃⇧⌘4、橫拿全螢幕。

# v2 補充 PKM-2-3（Ray 第一次真機實測後的修正）

- 派工：DISPATCH-PKM-2.md §8（commit 7552b51），2026-10-24 18:57 收到。Ray 在 MacBook Neo＋iPhone 上用 Mac mini 建好的 App：配對、點擊、打字正常。
- 程式 commit：2dadfc6。App 已重新建置：`dist/PhoneKeyMouse.app`（19:12，bundle self-test OK）。
- run4 照指示**沒有再跑**。Mac mini 上沒有真實送出任何 ⌃方向鍵或其他全系統快捷鍵。

## P1. 三件事和兩件附帶的事

| # | 項目 | 根本原因 | 修正 | 證據 |
|---|---|---|---|---|
| 1 | 三指滑動沒有切換桌面 | **I-18**：送按鍵時把事件旗標整個換成修飾鍵，蓋掉方向鍵本身帶的 Fn（0x800000）和數字鍵盤（0x200000）旗標。實體鍵盤的 ⌃← 是 0xA40000，第一版送的是 0x40000，Mac 的切換空間快速鍵不認。總控猜的 (a) 是對的；(b)(c)(d) 見 ISSUES I-18 | 主鍵按下／放開都補上「這個鍵本身帶的旗標」（方向鍵 Fn＋數字鍵盤；Home／End／PgUp／PgDn／⌦／F 鍵 Fn），和 CoreGraphics 自己建立該鍵時一樣（D-18） | self-test「⌃←→↑↓ 和實體鍵盤一樣」：keycode 123／124／126／125、旗標 0xA40000 都 PASS；「一般鍵不多帶旗標」PASS；Swift 單元測試 6 項 |
| 1a | 手機明確告訴 Ray 怎麼開 | 第一版只在連線時讀一次，而且只講「被關掉」 | ⌃方向鍵每次的 ack 都帶 Mac 當下的狀態：快速鍵開／關、空間數（唯讀）。手機直接顯示原因，例如「⌃← 在 Mac 上是關閉的，所以沒有反應。請在 Mac 打開：系統設定 → 鍵盤 → 鍵盤快速鍵… → Mission Control，勾選「移到左邊的空間」（⌃←）。」或「Mac 目前只有 1 個桌面，沒有地方可以切換。三指往上滑打開 Mission Control，在畫面最上方按「＋」新增桌面。」⚙︎ 設定裡有一段 Mac 狀態 | 瀏覽器測試（dry-run 假裝 ⌃← 關閉、1 個空間）：三指右滑、左滑的提示和設定頁文字都正確（design/evidence/pkm23-layout-after.json `hints`；截圖 pkm23-after-hint.png）；JS 單元測試 3 項 |
| 2 | 下方按鍵列超出畫面，滑不到後面的按鈕 | **I-19**：列本身可以橫向捲動，但每顆按鈕在 touchstart 就取消事件（為了按下就送、不搶焦點），手指從按鈕上開始滑時瀏覽器不會捲動，反而按到按鈕；捲軸隱藏，看不出還有 10 顆 | 改成橫向捲動（D-19）：按鈕放開才送、移動超過 10 px 算捲動；按住 420 ms 開始連續重複；兩端漸層＋‹ › 提示 | 前後量測（pkm23-layout）：修改前從「⌘ 快捷鍵」往左滑 → 沒捲動、反而打開面板；修改後 → 捲動 225～318 px、什麼都沒送；捲動後點一下看得到的鍵只送那一個鍵。390 和 375 寬都通過 |
| 3 | 拿掉迷你地圖 | — | 畫面、設定、CSS 都拿掉（D-20）；Mac 端 `jump` 訊息保留給端對端測試 | 觸控板：直 390 寬 370×463 → **370×535**；直 375 寬（iPhone SE）355×347 → **355×419**；橫 844×390 → 844×390（橫向本來就沒有迷你地圖） |
| 4 | 配對視窗沒有 QR code | **I-20**：Mac mini 上重現不出來（同一段程式在螢幕外畫出來是正常的 QR）；Neo 上失敗在哪一步不知道，App 也沒記錄 | 小修：QR 改用即時繪製（不用 macOS 14 起不建議的 lockFocus）；沒有 QR 時，視窗裡寫出原因，記錄檔也記一行 | ISSUES I-20 |
| 5 | e2e「最近 30 秒有人用 Mac 就不啟動」 | I-17 的建議，總控核准 | e2e.sh 開跑前查螢幕鎖定和 HIDIdleTime（D-21）；`PKM_E2E_PREFLIGHT_ONLY=1` 只做檢查 | 只跑檢查：閒置 726 秒 → OK；門檻調高 → 正確拒絕（exit 6），都沒有啟動 probe |

## P2. 測試

| 測試 | 結果 |
|---|---|
| JS 單元測試 | **52/52**（新增手機提示 3 項） |
| Swift 單元測試 | **49/49**（新增：方向鍵旗標、導覽鍵和 F 鍵、一般鍵不多帶、e2e 保護仍擋 ⌃方向鍵、hotkeyName、空間數解析、ack 帶狀態） |
| self-test | **29/29 PASS**（新增 2 項；這次 Mac 沒鎖，所以先前 SKIP 的 2 項也 PASS） |
| v2 瀏覽器回歸測試 | **41/41** |
| PKM-2-3 前後量測（tools/pkm23-layout.mjs） | 見 P1；JSON：design/evidence/pkm23-layout-{before,after}.json |
| 真實注入 | 沒有跑（run4 照指示不跑；⌃方向鍵屬全系統動作，派工不做真實注入） |

## P3. 截圖（design/screenshots/v2/）
- `pkm23-before-portrait-390.png`、`pkm23-after-portrait-390.png`：直 390 寬，修改前（有迷你地圖）／後。
- `pkm23-before-portrait-375.png`、`pkm23-after-portrait-375.png`：直 375 寬（iPhone SE）。
- `pkm23-*-portrait-390-swiped.png`、`pkm23-*-portrait-375-swiped.png`：從按鈕上往左滑之後（修改前：沒動、面板打開；修改後：捲動了，兩端出現 ‹ ›）。
- `pkm23-before-landscape-844.png`、`pkm23-after-landscape-844.png`：橫向（不變）。
- `pkm23-after-hint.png`：三指滑了但 Mac 只有 1 個桌面時的提示。

## P4. 還沒驗證的部分
| 項目 | 為什麼 | 怎麼驗證 |
|---|---|---|
| 新 App 在 Neo 上三指真的會切桌面 | Mac mini 上照派工不真實送 ⌃方向鍵；只證明送出的事件和實體鍵盤一樣（keycode、旗標） | Ray 換新 App 後試三指左右滑；如果還是沒反應，手機上方會說原因 |
| Neo 有幾個桌面、快速鍵有沒有開 | 只能在 Neo 上讀；這台 Mac mini 只有 1 個空間 | 手機 ⚙︎ 設定裡會顯示 |
| QR code 在 Neo 上為什麼沒有 | Mac mini 重現不出來 | 新 App 的配對視窗會寫出原因，或看 ~/Library/Logs 裡的記錄 |
| 按鍵列在真的 iPhone 上滑起來的手感、放開才送的延遲感 | 只有 headless Chrome | Ray 試 |
| Vision Pro＋沙發 | 需要 Ray | Ray 試用 |

## P5. 需要 Ray 做的事
1. 用新 App：把 Mac mini 的 `dist/PhoneKeyMouse.app` 再搬一次到 Neo（或在 Neo 上跑 `./tools/build-app.sh`）。換 App 後要在「系統設定 → 隱私權與安全性 → 輔助使用」把舊的移除、再加新的（README §2）。
2. 手機重新整理網頁。⚙︎ 設定裡看「Mac 快速鍵」那段：有關掉的就照文字去開；只有 1 個桌面就先新增一個。
3. 試三指左右滑、上滑；試按鍵列左右滑。

# v3（PKM-3）

## ① 聽寫送到 Mac 疊字（PKM-3-1，P0）——先交付（2026-10-27 00:46）

| # | 項目 | 結果 | 證據 |
|---|---|---|---|
| Q1 | 根本原因 | 手機每次聽寫改字都馬上送「⌫×N＋文字」；Mac mini 輸入來源是注音，文字走剪貼簿＋⌘V，⌘V 只比 ⌫ 晚約 14 ms，接收端把 ⌫ 吃掉 → 舊詞留下。用這個模型逐字重現 P-19「然後然後現在需要按按步驟，步驟，先按鍵盤鍵盤鍵盤打開來，」和 P-20 結尾整句重複 | process/ISSUES.md I-21 |
| Q2 | 手機端修正 | 一般打字照舊馬上送；聽寫／預測字等 0.7 秒停頓送一次淨差異；同一刻的刪＋插先抵消；輸入框只在收鍵盤時清空 | web/js/textsync.js `LiveTyping`、D-22 |
| Q3 | Mac 端修正 | ⌫ 之後的文字／貼上至少等 50 ms；貼上後的按鍵 50 ms；連續貼上至少隔 150 ms；連續貼上後剪貼簿還原成第一次之前的內容 | mac/Sources/PKMCore/Pacing.swift、D-23 |
| Q4 | 除錯紀錄 | ⚙︎ 設定 →「輸入紀錄」：只存在手機記憶體，不上傳 | D-24、design/screenshots/v3/pkm31-input-log.png |
| Q5 | 重播測試（前後對照） | JS：P-19、P-20 舊版重現、新版正確（9 項新測試）；瀏覽器真頁面：v2 網頁 5/5 重現、新網頁 7/7；Mac self-test 新 3 項：v2 全 FAIL（14.3 ms、28.8 ms、剪貼簿剩「二」），新版全 PASS | web/test/dictation-replay.test.mjs、design/evidence/pkm31-dictation-{before,after}.json、design/evidence/pkm31-selftest-{before,after}.txt |
| Q6 | 全部測試 | JS 64/64、Swift 55/55、self-test 32 PASS（`SELF-TEST OK`）、v2 瀏覽器回歸 41/41；dist/PhoneKeyMouse.app 已重建，bundle self-test OK | 本表 |
| Q7 | 還沒驗證 | 真 iPhone 聽寫的事件順序（模型是假設，但逐字重現兩個樣本）；Orca／Claude Code 為什麼吃掉 ⌫（照規則不對其他 App 真實注入）；Ray 在 Mac mini／Neo 上用新 App 念 README 的測試句 | README §6「疊字」那列 |

Ray 要做的：把新的 dist/PhoneKeyMouse.app 換上（Mac mini 和 Neo 都要；換 App 後到「輔助使用」移除舊的再加新的），手機重新整理頁面，照 README §6 念測試句。

## PKM-3-3 送出後舊字又被送到下一個 App（P0）——先交付（2026-10-27 約 01:01）

| # | 項目 | 結果 | 證據 |
|---|---|---|---|
| G1 | 根本原因 | 送出後只把輸入框清空，沒有記住送了什麼；iOS 把字放回輸入框後，下一個字、再按送出、切換即時／整段都會把整段再送一次（切模式是 v2 自己的設計）。v2 網頁四種情境都重現 | process/ISSUES.md I-24 |
| G2 | 修正 | 記住剛送出的字，跑回輸入框就拿掉（有沒有事件都抓得到，0.4 秒內清掉），提示「已擋下」；切換模式永遠不送；畫面上的「送出」先收鍵盤 | web/js/textsync.js `ClearedTextGuard`、web/js/app.js、D-25 |
| G3 | 重播測試 | 「聽寫 → 送出 → 放回 → 再打字／切模式／再送出」：v2 8/8 重現外洩，新版 13/13 不外洩（含「好的」再打一次照送） | tools/pkm33-send-clear.mjs、design/evidence/pkm33-send-clear-{before,after}.json、web/test/cleared-guard.test.mjs |
| G4 | 全部測試 | JS 69/69、v2 瀏覽器 41/41、pkm31 7/7、pkm33 13/13；Swift 59/59、self-test 33（含 PKM-3-2）| 本表 |
| G5 | Ray 的真機測試 | README §6「送出後切到別的 App…」那列：Orca 說一句 → 送出 → LINE（自己的 Keep 筆記）打「好」，LINE 只能出現「好」 | README |
| G6 | 還沒驗證 | iPhone 真的是怎麼把字放回去的（有沒有事件）；手機輸入紀錄會記 `ghost` | — |

## PKM-3-2 選單列「用 iPhone 掃描」QR code（2026-10-27 約 01:03）

| # | 項目 | 結果 | 證據 |
|---|---|---|---|
| R1 | 選單列新項目 | 「用 iPhone 掃描（QR code）…」→ 浮動視窗：含 IP 網址的 QR code，好幾個網路時可以換；網址文字；說明 | design/screenshots/v3/pkm32-scan-window.png、pkm32-scan-window-two-networks.png |
| R2 | 配對碼 | 不放進這個 QR（D-26）：已配對手機掃了就能用，新手機照原流程要求配對碼 | process/DECISIONS.md D-26 |
| R3 | 網址列表 | 每次打開選單／視窗都重新掃描；區網 IPv4（en0 優先）＋ .local；不能用的介面寫原因 | mac/Sources/PKMCore/LANURLs.swift、design/screenshots/v3/pkm32-scan-window-no-lan-ip.png |
| R4 | I-20 | 找到「選單只有 .local」的可能原因（網址只在啟動時算一次），已改；QR 沒顯示的原因仍未查明，記錄檔現在每次啟動都寫網路介面，配對視窗沒 QR 時也寫 | process/ISSUES.md I-25 |
| R5 | 測試 | Swift 59/59（LANURLs 4 項：排序、排除和原因、去重、QR 內容不含配對碼）；self-test 33（新增：產生 QR → 用 CoreImage 讀回 → 等於 IP 網址、沒有配對碼） | 本表 |
| R6 | 還沒驗證 | Neo 上的實際畫面和 I-20 的原因 | — |

## PKM-3 語音鍵（2026-10-27 01:14）

| # | 項目 | 結果 | 證據 |
|---|---|---|---|
| V1 | 研究（寫進 DECISIONS，附來源） | Web Speech 要 https（WebKit `[SecureContext]`），主畫面 App 不支援（WebKit bug 225298）；手機錄音一樣要 https；網頁不能叫出鍵盤的聽寫 | process/DECISIONS.md D-27、RESEARCH-LOG S-130～S-139 |
| V2 | 🎤 鍵 | 直拿：文字框右邊；橫拿全螢幕：左側浮動列。點一下開始（理由見 D-27），錄音中紅點閃、可停止、可取消 | design/screenshots/v3/pkm3-voice-listening.png、pkm3-voice-landscape-pad.png、pkm3-voice-landscape-listening.png |
| V3 | 預覽＋送出 | 先進預覽框（可改字），按「送出到 Mac」走原本的文字通道送一則；⚙︎「辨識完直接送出」；中文／English 切換 | pkm3-voice-preview.png |
| V4 | 兩種模式 | https＋Safari：按一下就說（語音辨識）；http 或主畫面：預覽框＋鍵盤聽寫，寫明原因和第一次設定的連結 | pkm3-voice-http-keyboard.png |
| V5 | 做不到時 | 麥克風被拒、聽寫沒開、沒聲音、網路、語言不支援：各自的原因和去哪裡設定 | pkm3-voice-error-mic.png、web/js/voice.js |
| V6 | https（免費、不改 Mac 設定） | App 自己做本機 CA（只准 .local 和區網 IP）＋伺服器憑證；port＋1；http 網頁提供描述檔；Ray 在 iPhone 自己安裝和信任（README 步驟）。配對、HMAC、區網限制不變 | mac/Sources/pkm-server/LocalTLS.swift、README「🎤 語音鍵」 |
| V7 | 測試 | JS 74/74（voice 5 項）；pkm3-voice 13/13（假的語音辨識器：http、https、主畫面、橫拿、錯誤、自動送出、取消、語言）；pkm3-https 8/8（curl 用本機 CA 驗證、沒裝 CA 不被信任、描述檔下載、https＋wss 配對）；self-test 37（新 4 項：Apple 的驗證認得自己的名字和 IP、不認 www.example.com、描述檔內容、私鑰 0600）；Swift 59/59；v2 回歸 41/41；dist 重建 | design/evidence/pkm3-*.json |
| V8 | 還沒驗證 | 真 iPhone 的語音辨識（中文／英文、自動結束的時間）；iPhone 安裝描述檔和信任的實際畫面；iOS 是否同樣遵守名稱限制（Mac 上實測遵守）；主畫面 App 在 iOS 26 是否仍不能用 Web Speech；Vision Pro | — |

## PKM-3-1 ② 下方按鍵列自訂（2026-10-27 01:18）

| # | 項目 | 結果 | 證據 |
|---|---|---|---|
| K1 | 編輯畫面 | 按鍵列最後的「✎ 編輯」（或 ⚙︎ 設定）打開；上面是現在的按鍵列，下面是參考清單（像自訂工具列） | design/screenshots/v3/pkm31-keyrow-editor-portrait.png |
| K2 | 清單內容 | esc、tab、⌫、⏎、方向和翻頁、⌘⌥⌃⇧、⌘C／⌘V 等編輯、截圖、切換、其他內建快捷鍵、Ray 的自訂快捷鍵、F1–F12 | pkm31-keyrow-editor-edited.png |
| K3 | 編輯功能 | 拖曳 ≡ 排序（含自動捲動）、↑↓、✕ 移除、點清單加入／拿掉、「＋ 新增自訂按鈕」（沿用自訂快捷鍵資料，存好直接加到列上）、一鍵恢復預設；存在手機 | web/js/keyrow.js、D-28 |
| K4 | 版型 | 直拿清單、橫拿寬版；改過的按鍵列高度不變，橫拿打字時仍在觸控板下面；直拿觸控板大小不變 | pkm31-keyrow-editor-landscape.png、pkm31-keyrow-row-edited.png |
| K5 | 測試 | JS 單元 4 項；瀏覽器 pkm31-keyrow 14/14（真的觸控拖曳、點新鍵送出 cmd+c／opt+cmd+k、重新整理後還在、恢復預設） | design/evidence/pkm31-keyrow.json |
| K6 | 還沒驗證 | 真 iPhone 上拖曳的手感 | — |

## v3 總表（2026-10-27 01:22）

| 項目 | 結果 |
|---|---|
| commit | 21f74c2（① 疊字）、27b33ee（PKM-3-3 送出後不重送）、1e4bc90（PKM-3-2 選單列 QR）、4567fd7（PKM-3 語音鍵＋https）、d820207（② 按鍵列＋紀錄＋還原 v2 證據） |
| 自測 | JS 78/78、Swift 59/59、self-test 37 項全過（螢幕鎖定時 35＋2 SKIP）、v2 回歸 41/41、pkm31-dictation 7/7（v2 5/5 重現）、pkm33-send-clear 13/13（v2 8/8 重現）、pkm3-voice 13/13、pkm3-https 8/8、pkm31-keyrow 14/14 |
| 真實注入 | 沒有（照規則；PKM-3 不需要） |
| dist | dist/PhoneKeyMouse.app 01:20 重建，bundle self-test OK |
| 截圖 | design/screenshots/v3/（14 張，index.json） |
| 還沒驗證 | 真 iPhone：聽寫疊字（README §6 測試句）、送出後不外洩（README §6 LINE 測試）、語音鍵兩種模式、https 憑證安裝、按鍵列拖曳；Neo：選單列 QR、I-20；Vision Pro |

**Ray 要做的（照順序）：**
1. 把新的 `dist/PhoneKeyMouse.app` 換到 Mac mini 和 MacBook Neo（換完到「系統設定 → 隱私權與安全性 → 輔助使用」移除舊的再加新的）。手機重新整理頁面。
2. 疊字：在即時模式用 iPhone 聽寫念 README §6 的測試句，看 Mac 上是不是一字不差。
3. 外洩：照 README §6「送出後切到別的 App」那列，Orca 說一句 → 送出 → LINE（自己的 Keep 筆記）打「好」。
4. 選單列 `⌨︎🖱` →「用 iPhone 掃描（QR code）…」。
5. 想要「按一下就說」：照 README「🎤 語音鍵」第一次設定（裝描述檔、打開信任、Safari 開 https 網址）。不設定也能用 🎤（鍵盤聽寫）。
6. 按鍵列最後的「✎ 編輯」改成你要的樣子。

# v4（PKM-4＋PKM-4-1）：SofaPad 4.0

- 交付：2026-10-28 約 03:36（02:02 收到）。phone-keymouse commit 3b00778（程式、測試、證據、文件）＋紀錄 commit；sofapad 本機一個匯入 commit（40dc24c 之後，**沒有 push**），推上去後的目錄見下面「sofapad」。

## 改了什麼
| 項目 | 內容 | 證據 |
|---|---|---|
| 拿掉 🎤 語音鍵（D-29） | 🎤、預覽框、voice.js、https 監聽、本機 CA、描述檔、相關選項和測試都拿掉；按鍵列存過的未知鍵自動略過 | pkm4-browser「沒有 🎤」；flow.test.mjs |
| 舊字切窗＋卡頓（I-29，P0） | 手機等 Mac 打完上一段（期間的字合成一段）；點擊／按鍵／手勢前先送字；輸入框不能還原／重做；Mac 注入改到自己的佇列 | design/evidence/pkm4/runs.json |
| 連線穩定（D-30） | 心跳 1.5 秒、4.5 秒判斷斷線、0.3–2 秒重連；重連後不補送，告訴 Ray 哪些沒送到；Mac 不打晚 3 秒以上的字和點擊；手機顯示「重新連線中…（第 N 次）」「已重新連上 Mac」 | reconnect-*.json、pkm4-browser |
| 網址精簡（D-31） | 一個 QR（IP）＋選單列只多一個 .local；其他收進「進階」；QR 一定有、加軟體繪製備援（I-20） | design/screenshots/v4/pkm4-scan-*.png |
| 版本 | 選單列第一行、手機 ⚙︎ 第一行：版本＋建置時間；版本不同時手機提示 | design/screenshots/v4/pkm4-settings-version.png |
| 改名 SofaPad（D-33） | App、選單、網頁、主畫面名稱、記錄檔、資料夾、bundle id；第一次啟動把 Phone KeyMouse 的已配對手機搬過來 | dist/SofaPad.app |
| 手冊 | README.md（英文）、README.zh-TW.md：第一次使用 1–8 步（每步「會看到什麼」）、從 Phone KeyMouse 換過來、3 分鐘真機確認；開發內容移到 docs/DEVELOPMENT.md | README* |
| 公開版（D-35） | design/PUBLIC-CHECK.md（私人版）、docs/PUBLIC-CHECK.md（公開版）、docs/COMPARISON.md、tools/export-sofapad.py（私人，不匯出）；sofapad 本機一個 commit，不 push | ~/Workspace/sofapad |

## §2-2 每個假設的結論（同一套腳本，3.x＝ec89c07，真實注入到 TextEdit）
| 假設 | 結論 | 3.x | 4.0 |
|---|---|---|---|
| (a) 重連後補送 | **重現（晚到的形式）**：沒有心跳，卡住的連線恢復後，這段時間打的字打進當時在前面的視窗。已打的字被補送：沒重現（依頁面＋編號去重） | 4/4 | 0/22 |
| (b) 剪貼簿還原交錯 | **排除（TextEdit）**：自己的貼上不會交錯；300 多次貼上後剪貼簿是原本的內容。慢讀剪貼簿（> 0.6 秒）的 App 理論上仍可能，沒有測 Orca／LINE | 0 | 0 |
| (c) iOS 把舊字放回 | **重現（還原／重做）**：搖一搖、三指滑／點兩下、⌘Z 把送過的字放回，再送一次。切主畫面再回來：沒重現。聽寫放回：模擬器做不到，靠 I-24 重播測試 | 還原 6/6、主畫面 0/6 | 0/6、0/6 |
| (d) 0.7 秒聽寫等待 | **部分**：等待中的字可能晚於後來的點擊；4.0 點擊前先送字 | 見 (e) | 0 |
| (e) 其他：Mac 逐字貼上積壓 | **重現，主因**（也是卡頓）：打一行在 Mac 積好幾秒，切窗後剩下的字＋Enter 打進新視窗，斷在字中間 | 13/15、6/8 | 0/64 |

## 數字
- 50 輪「送出 → 切窗 → 新視窗打一個字」：新版 **64 輪，新視窗出現舊文字 0 次**（即時 44 輪、整段 20 輪；另有還原 6 輪、切主畫面 6 輪也是 0）；重複 0、遺失 0。3.x 同腳本：即時 19/23 輪外洩。
- 20 次斷線：新版 **22 次**（Mac App 暫停 6 秒 12 次、結束再開 10 次）**全部連回**；Mac 恢復後重新連上：暫停約 0.02 秒、重開平均 0.68 秒（最多 0.84 秒）；斷線時打的字晚到被打出 0 次、重複 0 次。3.x：暫停 4 次，4 次把斷線時打的字打進新視窗。
- 延遲：一般打字（一次一個鍵，手機輸入事件 → Mac 送出事件）**p50 34 ms、p95 37 ms**、最大 81 ms（176 鍵；Mac 是注音，所以都走貼上）。目標 ≤ 150 ms。
- 注音（手機鍵盤 ㄋㄧˇ → 你、ㄏㄠˇ → 好）：TextEdit 得到「你好」，組字中什麼都沒送。

## 自測
JS 81/81、Swift 65/65、self-test 33（沒有 SKIP）、瀏覽器 v2 41/41、pkm33 13/13、pkm31 7/7、keyrow 14/14、pkm4-browser 10/10；dist/SofaPad.app 重建（bundle self-test OK）。

## 截圖
`design/screenshots/v4/`：pkm4-settings-version.png（⚙︎ 版本）、pkm4-reconnecting.png、pkm4-reconnected-not-sent.png、pkm4-scan-one-qr.png、pkm4-scan-no-ip.png（範例位址）。

## 還沒驗證
- 真 iPhone（真的 Wi-Fi、睡眠、iOS 聽寫、三指手勢觸發還原的實際情況）。
- MacBook Neo（QR、I-20、改名後的輔助使用權限和配對搬家）。
- Vision Pro（用 Vision Pro 切窗：聽寫完不按 Enter、0.7 秒內切窗，最後一段仍可能進新視窗；整段模式不會）。
- Orca、LINE 本身（測試只打 TextEdit）；慢讀剪貼簿的 App。

## Ray 要做的事
1. 照 README「從 Phone KeyMouse 換成 SofaPad」：結束舊的、輔助使用移除舊的、打開 dist/SofaPad.app 給權限（Mac mini 和 Neo 都要）。
2. 照 README「3 分鐘真機確認」做一次。
3. 不用了的話自己清：iPhone 的「Phone KeyMouse」描述檔、Mac 的 ~/Library/Application Support/PhoneKeyMouse/。

## sofapad（PKM-4-1）
- 本機 `~/Workspace/sofapad`：40dc24c 之後一個匯入 commit（作者 Claude <noreply@anthropic.com>，和原本的 commit 一樣），沒有 push、沒有新增遠端。
- 推上去以後 main 的最上層：`README.md`（英文）、`README.zh-TW.md`、`LICENSE`（MIT，原本的）、`VERSION`、`mac/`、`web/`、`tools/`（含 `pkm4/` 測試台）、`design/`（SPEC、截圖、證據）、`research/`、`docs/`（COMPARISON、DEVELOPMENT、PUBLIC-CHECK）、`process/`（Phone KeyMouse v1–v4 紀錄公開版，`dispatch/` 是四份派工單）、`legacy/v0.2-python/`（舊 Python 版和它的紀錄，原樣搬過去）。
- 公開版檢查：design/PUBLIC-CHECK.md（私人版）第 4 節有要總控確認的保留項目，最後寫「等總控確認」。

## 總控驗收後的隱私補修（DISPATCH-PKM-4 §7，2026-10-28 03:34–約 03:47）
- 證據 JSON 的 Tailscale 位址（23 處）→ `100.x.x.x`；測試配對碼（23 處）→ `******`；COORDINATOR-LOG 和 DISPATCH-PKM-4 提到總控的其他工作（3 處）→「總控當時在處理其他工作」。規則在 tools/export-sofapad.py。
- 第 4 節的決定寫進 PUBLIC-CHECK（私人版第 4 節、公開版）。
- 最後的 grep（含 100.64/10 和配對碼）：sofapad 匯出的樹只剩 5 行測試假值和網段名稱（加上 PUBLIC-CHECK 本身引用它們）；legacy/ 0 筆。用 `git grep -P` 在 commit 本身再跑一次，結果相同。
- 修改原匯入 commit（不是多加一個），沒有 push；新的 commit id 寫在 orchestration 回覆和 station。
