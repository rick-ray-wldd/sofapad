# 派工 PKM-4：拿掉語音鍵、修舊文字重送和卡頓、穩定連線、網址精簡成 QR、第一次使用手冊、準備公開 repo（Ray 10/28）

> 公開版本：為了隱私，電腦名稱、使用者名稱、區網 IP（改成 192.168.x.x）、本機路徑、個人助理系統的 id、他人姓名和 email 已遮蔽，P-22 和他人對話有關的原文改成概述（見 docs/PUBLIC-CHECK.md）；其餘逐字未改。

- **派工者**：Claude 總控（S-…），2026-10-28 02:01。
- **writer**：你，仍是唯一 writer。專案資料夾 `phone-keymouse`。
- **任務**：T-…（沿用）。

## 1. Ray 的需求
- 原文在 `process/USER-PROMPTS.md` P-23，是語音輸入，「Hsin-Kai Mouse」就是 Phone KeyMouse。
- 總控解讀成五件事：
  1. **拿掉 🎤 語音鍵**。Ray 說這個功能沒有用，要退回原本的做法：打開鍵盤，用鍵盤自己的麥克風或直接打字。
  2. **舊文字又跳出來，而且卡頓**。打完字送出，切到下一個視窗後，上一段話又被送進新視窗。P-22／I-24 修過，但 Ray 說還在發生。要深入分析、實際測試、修到好；連線也要更穩定。
  3. **網址只留一兩個，以掃 QR code 為主**。Ray 不懂為什麼要給那麼多網址。
  4. **第一次使用手冊**寫在 README：從安裝到系統設定，讓 App 能正常打開。
  5. **推到 GitHub 公開 repo**。這一步由總控把關，見 §2-5。

## 2. 成功條件

### 2-1 拿掉語音鍵（P1）
- 移除 🎤 鍵、預覽框、`voice.js`，以及只為語音鍵存在的 https 監聽、本機 CA、描述檔下載、相關 QR 和 `--no-https`、`--https-port` 選項。
  - 用「移除功能」的方式改，不要用 git revert 整批退回：PKM-3 的按鍵列自訂、選單列 QR、I-21 疊字修正、I-24 防重送都要保留，除非 §2-2 的分析證明它們本身就是問題。
- 按鍵列的自訂設定如果存過 🎤 鍵，讀取時自動略過，不能出錯。
- README 寫明：
  - 舊版裝過「Phone KeyMouse local CA」描述檔的話，到 iPhone **設定 → 一般 → VPN 與裝置管理** 移除。
  - Mac 上 `~/Library/Application Support/PhoneKeyMouse/tls/` 可以刪掉。
  - 這兩件都由 Ray 自己做，你不要動。

### 2-2 舊文字重送和卡頓（P0，重點）
1. **先確認 Ray 用的是哪一版**。手機畫面和選單列都要顯示版本和建置時間。目前不知道 Neo 上是不是 PKM-3 那版；如果 Ray 還在用 v2，I-24 的修正根本沒裝到。README 的手冊要寫怎麼看版本。
2. **深入分析**。從手機輸入框、送出、清空、鍵盤收起、WebSocket 佇列、斷線重連、Mac 端注入、剪貼簿貼上，一路查到「切到下一個視窗」。至少驗證下面這些假設，每個都寫成「重現了／排除了＋證據」：
   - (a) 斷線或 Safari 背景暫停後重連，把佇列裡**已經送過**的訊息再補送一次，剛好落到新的前景視窗。
   - (b) 剪貼簿貼上：`ClipboardKeeper` 還原的時機和下一次 ⌘V 互相交錯，把上一段貼進新視窗。
   - (c) iOS 輸入框在 blur／focus、切換 App 或收鍵盤時，把舊字放回來（I-24 的 `ClearedTextGuard` 漏掉的情況，例如 5 字以下或分好幾次放回）。
   - (d) 0.7 秒的聽寫等待（D-22）造成延遲：Ray 已經切窗了，字才送出去。這可能就是 Ray 說的「卡頓」。
   - (e) 你自己找到的其他路徑。
3. **實際測試**。一定要有真的注入，不能只跑單元測試：
   - 手機端用 Xcode 的 iOS Simulator（本機已有 iPhone 18 Pro）開 Safari，連到 Mac mini 上跑的 App。要測的情況：
     - 一般打字；
     - 注音輸入；Simulator 自己的設定可以加注音鍵盤，這不算改 Ray 的系統設定；
     - 送出後立刻切換；
     - Safari 進背景再回來；
     - 斷線重連：用 App 的測試開關或暫停伺服器模擬，不要動 Mac 的 Wi-Fi 或系統網路設定。
   - Mac 端只注入到你自己開的**兩個未命名 TextEdit 視窗**，用 AppleScript 或測試腳本切換前景，模擬「Orca → LINE」的切換。
     - 前景檢查保留：前景不是測試視窗就中止。
     - 每輪 ≤ 2 分鐘；測完關閉、不存檔。
     - 不碰 Orca、LINE 和其他 App；Mac 鎖定時不測。
   - **修好的標準**：
     - 連續 50 輪「送出 → 切窗 → 在新視窗打一個字」，新視窗出現舊文字 0 次；
     - 打字到 Mac 出現字的延遲，p95 要寫出數字，目標 ≤ 150 ms（一般打字）；
     - 沒修以前的版本，用同一套腳本跑一次，證明測得出問題。
     - 結果放進 `design/evidence/pkm4/`。
4. **連線穩定度**：
   - 心跳、斷線偵測、自動重連（退避）要確實運作；重連後**不補送舊文字**，只補送滑鼠移動之類無害的事件，或乾脆丟掉，由你判斷並寫進 DECISIONS。
   - 量測：模擬斷線 20 次，重連成功率、平均重連時間、重連後重複送字 0 次。
   - 手機畫面要清楚顯示「已連線／重連中」。

### 2-3 網址精簡
- 選單列和配對視窗只給 **一個 QR code＋最多兩個網址**。建議：
  - QR 用 IP 網址，掃了一定開得到；
  - 「加入主畫面」用 `.local` 網址，IP 變了也不用重加。
  - 你可以依測試結果改，但要寫進 DECISIONS。
- 其他網址收進「進階／疑難排解」，或直接刪掉。
- 配對流程：掃 QR → 輸入或確認配對碼 → 完成，畫面上不要出現第二種選擇。
- I-20（Neo 配對視窗沒有 QR）仍未解：這次一併處理，至少讓選單列「用 iPhone 掃描」一定有 QR。

### 2-4 第一次使用手冊（README 開頭）
- 給第一次拿到的人看，Ray 以外的人也看得懂。步驟要有編號，每一步寫「會看到什麼」：
  1. 下載與建置（或直接用 dist 的 App）；
  2. 第一次打開被 Gatekeeper 擋時：系統設定 → 隱私權與安全性 →「仍要打開」；
  3. 輔助使用權限；
  4. 防火牆或「本機網路」詢問要按允許（依實際 macOS 版本的畫面寫）；
  5. 可選：開機自動啟動；
  6. iPhone 掃 QR、配對、加入主畫面；
  7. 怎麼看版本；
  8. 常見問題。
- 可以放截圖，但截圖裡不能有 Ray 的名字、Mac 名稱、IP、檔案路徑；**不要為了截圖去改系統設定**，沒有的畫面用文字描述。
- 現有 README 的開發者內容移到後面或 `docs/`。

### 2-5 準備公開（push 由總控做，你不做）
- **先不要建遠端、不要 push**。總控正在向 Ray 確認 repo 名稱和公開範圍：
  - sofapad 是另一個公開專案，不能推到那裡；
  - `process/` 裡有 Ray 的語音原話。
- **你要準備**：
  - 一份「公開版」檢查報告 `design/PUBLIC-CHECK.md`：掃描整個工作區和**全部 git 歷史**，列出所有會洩漏私人資訊的內容。例如：
    - `user`、`<desktop>.local`、`<laptop>`；
    - IP 位址；
    - `/Users/...` 路徑；
    - `（本機私人設定檔）`；
    - （個人助理系統） 的 station／task id；
    - 他人姓名；
    - token 和金鑰。
  - 建議做法：用一個沒有歷史的乾淨 commit，只放清理過的檔案，或其他方案，寫出取捨。
  - 授權：建議 MIT，和 sofapad 一致。
  - 準備好之後在報告最後寫「等總控確認」。

## 3. 範圍與禁止（適用：writer 和你的子代理）
- **可寫範圍**：只能寫 `phone-keymouse`。
- **對外動作**：不建 GitHub 遠端、不 push、不公開分享，不寄信、不送件、不付款、不建帳號。
- **系統設定**：不改 Mac 或 iPhone 的系統設定、網路、防火牆、隱私權設定。需要 Ray 改的，寫成手冊步驟。
- **sofapad**：照舊不讀程式碼。
- **安全設計**：配對碼、HMAC、區網限制都不能拿掉。拿掉 https 後，README §5 的安全說明要同步更新。
- **真實注入**：只能照 §2-2 第 3 點的規則做。

## 4. 資源（適用：writer）
- terminal：不開新 terminal／worktree。
- 子代理：最多同時 2 個，例行查找用 Sonnet。
- 套件：不安裝新套件；Xcode 和 iOS Simulator 是本機已有的，可以用。
- 費用：NT$0。

## 5. 交付和回報
- **開工**：先回約 5 行的計畫和時程，然後直接開工。
- **交付內容**：
  - 改了什麼；
  - §2-2 每個假設的結論和證據；
  - 50 輪切窗測試和 20 次斷線測試的數字；
  - 延遲 p95；
  - 截圖位置；
  - 還沒驗證的部分，例如真 iPhone、Neo、Vision Pro。
- **給 Ray 的真機測試**：在 README 寫一段 3 分鐘的流程，Ray 照著做就能確認問題消失。
- **問 Ray 的問題**：寫在最後，標「問 Ray：」。
- **紀錄**：process/ 的檔案照 PROTOCOL v1.1 加「v4（PKM-4）」一節。
- **完成後**：
  - commit；
  - 回報自己的 station（review）；
  - 再傳 `orca orchestration send --run run_… --to run:run_… --subject "PKM-4 可以驗收" --body "<一句摘要＋證據路徑>" --json`。

## 6. 補充 PKM-4-1：新版併入 sofapad，改名 SofaPad（Ray P-25，2026-10-28 02:06）
- **Ray 原文**：「幫我新建到sofa-pad中進行迭代 因為那版我已經沒再用並且我想要融合成現在這版 只不過差異紀錄請你一樣保存 而且我喜歡吧sofa pad這個名稱」
- **總控解讀**：
  - 公開 repo 就用 Ray 現有的 `rick-ray-wldd/sofapad`。舊的 Python 版 Ray 已經不用了，以後在 sofapad 裡迭代這一版。
  - 產品改名 **SofaPad**。
  - 兩版的差異紀錄都要保留。
- **解除限制**：§3「不讀 sofapad」解除，可以讀 sofapad 的程式和紀錄。

### 6-1 要做的事
1. **建本機 clone**：`git clone https://github.com/rick-ray-wldd/sofapad ~/Workspace/sofapad`，只讀 clone，不 push。這個資料夾加進你的可寫範圍。
2. **保留舊版**：
   - 不改寫 sofapad 的 git 歷史，也不 force push。
   - 總控 push 時，會在現在的 main（40dc24c）打 tag `v0.2-python`。
   - 舊版檔案和舊的 process 紀錄一起搬到 `legacy/v0.2-python/`，main 上仍然看得到。
3. **放入新版**：把 PKM-4 完成後的程式和網頁放進 sofapad，**只做一個匯入 commit**，不帶 phone-keymouse 的 git 歷史，因為裡面有私人資訊。完整歷史留在本機的 phone-keymouse，當作私人存檔。
4. **改名 SofaPad**：App 名稱、選單列、網頁標題、主畫面名稱、README、記錄檔路徑都改。
   - bundle id 改了以後，macOS 的輔助使用權限要重新給一次。手冊要寫：
     - 舊的 PhoneKeyMouse 怎麼關掉、從輔助使用清單移除；
     - 新的怎麼加入。
   - 已配對的手機要不要搬過去，由你決定並寫進 DECISIONS。
5. **差異紀錄**：
   - `process/` 放 Phone KeyMouse v1–v4 的紀錄（清理過的）。
   - 新增 `docs/COMPARISON.md`：整理 sofapad v0.2 和 Phone KeyMouse v1–v4 的差異。內容包括：
     - 功能；
     - 架構：Python 和 Swift、網頁端；
     - 遇到的問題；
     - 花費的時間和成本；
     - 這次怎麼融合，以及保留了 sofapad 的哪些優點（例如 Ray 說過的原生快捷鍵）。
   - 依據兩邊的 process 紀錄，不要編數字。
6. **README 照 sofapad 的慣例**：`README.md` 英文為主，`README.zh-TW.md` 中文。§2-4 的第一次使用手冊兩個語言都要有。
7. **公開版檢查**：§2-5 的 `PUBLIC-CHECK.md` 改成檢查**要推到 sofapad 的內容**，也就是匯入 commit 加上 legacy。
   - `process/USER-PROMPTS.md` 保留 Ray 的原話，sofapad 原本就這樣公開。
   - 但要拿掉以下內容，並列出每一處改了什麼：
     - 他人姓名、私人對話內容（例如 P-22 提到傳 LINE 給別人的那段，改成概述）；
     - Mac 名稱、IP、`/Users/...` 路徑；
     - （個人助理系統） 的 station／task id；
     - token。

### 6-2 交付
- `~/Workspace/sofapad` 準備好的 commit，**不 push**。
- 加上 `PUBLIC-CHECK.md`、`COMPARISON.md`。
- 回報時寫清楚：哪個 commit 要推、推上去以後 main 長什麼樣子（目錄樹）。
- push、打 tag、之後在 Orca 登記 sofapad 專案，都由總控來做。

## 7. 總控驗收 PKM-4（2026-10-28 03:34）：功能通過；推 sofapad 前要再修 3 處隱私問題

### 已核對通過
- sofapad 的 export（cc05af4）重新建置並跑測試：Swift 65/65，網頁 node --test 81/81；phone-keymouse 一樣 81/81。
- runs.json 有新舊兩版對照：切窗、還原、背景、重連、注音都分開跑。
- PUBLIC-CHECK 用的 grep 範圍裡，找不到使用者名稱、/Users 路徑、station／task id、email。

### 要修（改 export_sofapad.py 的規則，重新匯出，**修改原匯入 commit**，不要多加一個 commit）
1. **Tailscale IP 外洩**：design/evidence/pkm4/ 有 22 個 JSON 含 `100.x.x.x`（utun5）。改成 `100.x.x.x`，並把 100.64.0.0/10 加進 grep 規則。
2. **測試配對碼**：evidence JSON 裡的「配對碼：NNNNNN」雖然已經過期，也統一改成 `******`，和 PUBLIC-CHECK 說的「記錄只印 ******」一致。
3. **總控紀錄提到其他工作**：process/COORDINATOR-LOG.md 第 9、21 行提到總控當時的其他工作，改成「總控當時在處理其他工作」。

### 第 4 節的決定
1. Ray 的名字和原話：保留。GitHub 帳號本來就公開，Ray 也要求保留差異紀錄。
2. 「Mac mini」「MacBook Neo」機型名稱：保留，它們不是網路名稱。
3. 總控、station、Orca 的工作方式描述：保留，id 已經拿掉。
4. COORDINATOR-LOG：照上面第 3 點清理後公開，它是兩版差異紀錄（架構成本）的一部分。
5. P-24 的分享計畫：保留。
6. pid、視窗編號：保留；配對碼照上面第 2 點改。

### 修完後
- 在 sofapad 跑一次完整 grep，結果寫進 PUBLIC-CHECK.md，包括新加的 100.64/10 和配對碼規則。
- 回 orchestration「PKM-4 修正可以推」，附新 commit id。push、打 tag、Orca 登記由總控做。
