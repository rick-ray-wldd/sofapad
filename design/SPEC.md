# Phone KeyMouse 規格（PKM-1 / M3）

- 版本：v1，2026-10-23 12:20（台北）。決定的理由見 `process/DECISIONS.md`（D-xx），研究見 `research/REPORT.md`（S-xx）。
- 一句話：Mac 上跑一個小程式，手機用 Safari 打開它提供的網頁，就能用手機的鍵盤（包括注音）打字、用手機當觸控板，讓 Ray 在沙發上透過 Vision Pro 的 Mac Virtual Display 操作 MacBook Neo。

---

## 1. 架構

```
┌──────────── iPhone（Safari／加到主畫面） ────────────┐        ┌──────────── MacBook Neo ─────────────┐
│ index.html＋js/*.js（不用安裝 App）                   │  同一個 │ pkm-server（Swift，沒有第三方套件）     │
│  ├ pointer.js   觸控板手勢、加速度、慣性               │  Wi-Fi  │  ├ PKMCore/Server   HTTP＋WebSocket    │
│  ├ textsync.js  文字鏡像（注音組字中不送）             │ ──────▶ │  ├ PKMCore/Session  認證、指令、去重複 │
│  ├ sha256.js    HMAC 登入證明（http 沒有 subtle）      │  ws://  │  ├ PKMCore/Pairing  配對碼、token     │
│  ├ connection.js 重連、等 Mac 確認、補送               │ :8765   │  ├ CGInjector       CGEvent 注入       │
│  └ app.js       介面                                  │  /ws    │  └ UI               選單列＋配對視窗   │
└──────────────────────────────────────────────────────┘        └───────────────┬──────────────────────┘
                                                                                │ CGEvent → .cghidEventTap
                                                                     macOS（前景 App；Mac Virtual Display）
```

- **Mac 端**：`mac/`，Swift Package。
  - `PKMCore` 是純邏輯，可以測試。
  - `pkm-server` 是執行檔，可以從終端機跑，也可以包成 `PhoneKeyMouse.app`，讓輔助使用權限綁在這個 App 上，而不是整個「終端機」。
  - `pkm-probe` 是端對端測試用的事件探針，只在測試時用。
- **手機端**：`web/`，純 HTML、CSS、ES modules，不需要建置。由 Mac 端直接提供，手機不用另外下載任何東西。
- **連線**：同一個 Wi-Fi，`http://<Mac IP 或 名稱.local>:8765/` 取得網頁，`ws://…/ws` 傳送指令（D-02）。沒有雲端、沒有第三方。

## 2. 鍵盤

### 2.1 打字（D-06、D-07）
- 手機下方有一個文字框，點一下就會跳出手機原生鍵盤（任何輸入法都可以）。
- **即時模式**（預設）：
  - 組字期間（`compositionstart` 到 `compositionend`）不送任何東西，所以注音的 ㄋㄧˇ 不會出現在 Mac 上。
  - 選好字之後，把文字框的變化算成「刪 N 個 grapheme＋插入字串」送出，autocorrect 換字、刪字都能正確反映。
  - 手機上按 Return：送 Mac 的 Return，並清空手機文字框（Mac 上的字留著）。文字框超過 200 字且停手 1.5 秒，會自動清空（Mac 不受影響）。
  - 文字框空的時候按 ⌫：送一個 Backspace 到 Mac。
- **整段模式**：在手機上打完、改好，按「送出」整段送出，可以設定送出後自動按 Enter。適合長段落或聊天軟體。
- **Mac 端注入**（auto）：
  - 平常每個 grapheme 一組 keyDown＋keyUp，帶 Unicode 字串（flags=0）；`\n` 改送 Return 鍵、`\t` 改送 Tab 鍵。
  - 超過 200 字，或 Mac 目前的輸入來源是輸入法（例如 Mac 上也開著注音），改用剪貼簿加 ⌘V，0.6 秒後還原原本的剪貼簿，暫存項目標成 transient／concealed。
  - 可以用 `--text-mode type|paste|auto` 指定。

### 2.2 特殊鍵與快捷鍵
- 橫向鍵列：esc、tab、⌫、⏎、← ↑ ↓ →、⌘、⌥、⌃、⇧、space、⌦、「快捷鍵」。⌫、方向鍵、⌦ 按住會自動重複（420 ms 後每 70 ms 一次）。
- ⌘、⌥、⌃、⇧ 是「黏著」修飾鍵：點一下亮起，作用在下一個按鍵上。也可以亮起 ⌘ 之後，在手機鍵盤打一個英文字母（例如 c），就變成 ⌘C。
- 快捷鍵面板：⌘C、⌘V、⌘X、⌘Z、⇧⌘Z、⌘A、⌘S、⌘F、⌘T、⌘W、⌘Tab、⌘Space、⌃↑（指揮中心）、⌘← ⌘→、⌥⌫、⌃← ⌃→（切換桌面）。
- Mac 端：先送真的修飾鍵按下（flagsChanged），等 12 ms，再送主鍵 down/up，再等 12 ms，最後依相反順序放開修飾鍵（S-31）。鍵碼用 ANSI 配置。
- 所有點按都用 touchstart 加 preventDefault，所以按特殊鍵時手機鍵盤不會收起來。

## 3. 滑鼠（D-05）

| 動作 | 手勢 | 送出的指令 |
|---|---|---|
| 移動游標 | 觸控板上單指滑動 | `move{dx,dy}`。增益 g(v) = 靈敏度 ×（0.7＋4×加速度×smoothstep((v−0.04)/(1.16))），v 是速度（px/ms，EMA 平滑） |
| 左鍵 | 點一下（≤220 ms、≤9 px；判斷期間游標凍結） | `click{b:left}`。Mac 端依雙擊間隔和距離自動算 clickState，所以點兩下就是雙擊 |
| 右鍵 | 雙指點一下（≤300 ms） | `click{b:right}` |
| 捲動 | 雙指滑動，或右側捲動條單指滑；放手有慣性 | `scroll{dx,dy}`（pixel、continuous；手指往下＝內容跟著往下，可以設定反向） |
| 拖曳 | 長按 450 ms 再滑；或按「拖曳鎖定」後滑（可以分好幾次滑）；或一指按住「左鍵」、另一指滑 | `down` → `move`（Mac 端改送 Dragged 事件）→ `up` |
| 長距離跳躍 | 迷你地圖上點或滑 | `jump{x,y}`，0…1 對應游標所在的螢幕 |
| 靈敏度 | 設定：游標速度 0.5–4、加速度 0–1、捲動速度 0.3–3 | 只在手機端計算 |

- **版面**：
  - 直拿（390×844）：上面是觸控板（右側有捲動條），下面依序是迷你地圖、三顆大按鈕（左鍵／拖曳鎖定／右鍵，58 px 高）、文字框、鍵列。手機鍵盤跳出來時，版面跟著 visualViewport 縮小，觸控板仍然可以用；迷你地圖暫時隱藏。
  - 橫拿：左邊是控制區（最寬 340 px），右邊是觸控板。左手模式會左右對調，捲動條也換邊。
- **躺姿考量**：主要情境是仰躺、手機放在胸口或腹部（S-24）。按鈕大、位置固定，不用看也能按（S-07）。不用陀螺儀（S-14）。
- **Mac 端**：
  - 用自己的累加器保留小數精度；如果實體滑鼠或觸控板移動了游標，就重新同步。
  - 游標限制在所有螢幕範圍內，包括 Mac Virtual Display。
  - 滑鼠事件 flags=[]，並同時設 delta 欄位。

## 4. 通訊協定（WebSocket 文字幀，JSON）

伺服器 → 手機：
| t | 欄位 | 說明 |
|---|---|---|
| `hello` | `nonce, host, v` | 一連上就送；nonce 每條連線都不同 |
| `auth_ok` | `device, host, perm, secure, screen{w,h}, token?` | token 只在用配對碼配對成功時給一次 |
| `auth_fail` | `reason`（bad_code／pairing_closed／bad_token／locked／unauthenticated）, `retry?` | |
| `pairing` | `open` | Mac 已經跳出新的配對碼 |
| `ack` | `id, ok, via?（type／paste）, dup?, warn?（secure_input）, err?, us` | 文字和按鍵的確認；us 是伺服器處理時間 |
| `pong` | `ts, us` | 回傳手機送來的 ts，用來算 RTT |
| `status` | `perm, secure` | 權限或安全輸入狀態變了 |
| `replaced` | | 另一支手機接手，接著用 close 4409 關閉連線 |

手機 → 伺服器（認證前只接受前三種）：
| t | 欄位 |
|---|---|
| `pair_request` | `device` |
| `auth` | `code` 或 `proof = hex(HMAC-SHA256(key = hex(SHA256(token)), msg = nonce))`, `device, sid` |
| `ping` | `ts` |
| `move` | `dx, dy`（各 ±4000 以內） |
| `jump` | `x, y`（0…1） |
| `scroll` | `dx?, dy`（±4000 以內） |
| `click`／`down`／`up` | `b`（left／right／middle） |
| `text` | `id, s`（最多 20,000 字） |
| `key` | `id, k, mods?[], n?`（重複 1–200 次） |
| `release_all` | |

- `id` 在同一個頁面 session（`sid`）內遞增，伺服器依此去重複，重連補送時不會打兩次。
- close code：4401 未認證、4408 閒置、4409 被取代、1002 協定錯誤。

## 5. 安全（D-04、D-11、D-12）

- **只接受區網**：來源 IP 必須是 loopback、10/8、172.16/12、192.168/16、169.254/16、::1、fe80::/10 或 fc00::/7，其他直接斷線。
- **Host 白名單**：只接受 IP、`localhost`、`*.local`，用來擋 DNS rebinding。WebSocket 的 Origin 必須和 Host 相同，用來擋其他網站的跨站 WebSocket。
- **配對**：
  - 6 位數碼，每次啟動產生；開放 10 分鐘，配對成功一支手機就關閉。
  - 手機可以按「請 Mac 顯示配對碼」，Mac 就產生新碼，顯示在浮動視窗 2 分鐘；每 15 秒最多請求 1 次。
  - 同一個 IP 錯 5 次鎖 30 秒，之後每次加倍，最長 15 分鐘；全部來源累計錯 20 次就換新碼並關閉配對。
- **之後的登入**：用 token 對每次的 nonce 算 HMAC 當證明，**token 不再出現在網路上**。磁碟上只存 SHA-256(token)，位置在 `~/Library/Application Support/PhoneKeyMouse/devices.json`，權限 0600。可以用選單「忘記所有已配對手機」或 `--forget-devices` 撤銷。
- **同時只允許一支手機控制**；新手機登入後，舊的那支會收到 `replaced`，伺服器同時放開所有按住的鍵。
- **限制**：未認證的連線只能做 pair_request、auth、ping，其他指令一律斷線；未認證 120 秒就斷線，已認證但閒置 20 秒也斷線（手機每 2 秒 ping 一次）；單則訊息上限 1 MB；數值有範圍限制；不支援二進位幀。
- **HTTP 標頭**：CSP 只允許自己的來源，沒有任何外部資源；nosniff、no-referrer、DENY frame。
- **威脅模型與限制**：v1 沒有 TLS。可以擋住同一個 Wi-Fi 上不知道配對碼的人，以及事後被動側錄的人；擋不住正在主動做中間人攻擊、劫持已建立連線的人，也擋不住在配對那一刻側錄的人。建議只在家裡或可信任的 Wi-Fi 上用，或改用手機熱點。

## 6. 延遲目標（D-08）

| 段落 | 目標 | 怎麼量 |
|---|---|---|
| 伺服器處理（解析＋注入） | < 1 ms | `ack.us`、`pong.us` |
| 本機 loopback 往返 | p95 < 5 ms | `tools/bench.mjs`（Node 的 WebSocket 客戶端，走 127.0.0.1 和 LAN IP） |
| 區網（手機 → Mac 注入） | p95 < 30 ms | 手機頂端顯示的 RTT（每 2 秒 ping 一次，EMA）；要 Ray 在 MacBook Neo 上實測 |
| 參考值 | Phonaze 端到端 52 ms（S-01）、WiFi 單向約 25 ms（S-04） | |

手機端在 touchmove 裡直接送出移動，不等 requestAnimationFrame；`bufferedAmount` > 8 KB 時才合併。伺服器端 TCP_NODELAY。

## 7. 失敗處理（D-08）

| 狀況 | 手機上看到 | 系統行為 |
|---|---|---|
| 斷線（Wi-Fi、Mac 睡眠、伺服器關了） | 紅點、「連線中斷，正在重新連線…」 | 0.5／1／2／4 秒退避重連。文字和按鍵等確認，重連後補送，超過 1 分鐘不補送並提示。滑鼠不補送 |
| 頁面切到背景、螢幕鎖定 | — | 手機送 release_all。Mac 端閒置 20 秒斷線並放開所有按鍵。回到前景立刻重連 |
| 沒有輔助使用權限 | 紅色提示和開權限的路徑 | Mac 端每 2 秒檢查一次，開好之後自動恢復；選單列有「打開系統設定」；`--prompt-permission` 會叫出系統的授權對話框 |
| 安全輸入（密碼欄） | 黃色提示 | 照樣送出，但 ack 會帶 warn |
| 配對碼錯、被鎖 | 「配對碼不對」、「請等 N 秒」 | 見 §5 |
| 另一支手機接手 | 「另一支手機已經接手控制」 | 不會自動搶回來，點狀態列才重連 |
| port 已經被占用 | （Mac 終端機）錯誤說明 | 用 `--port` 換一個 |

## 8. 不在 v1 範圍（之後可以做）
- TLS（本機 CA＋iPhone 描述檔）、螢幕常亮（Wake Lock 要 secure context）、陀螺儀。
- AX 直接寫入文字欄位（S-32、S-34）。
- 依鍵盤配置找鍵碼（UCKeyTranslate，S-33），支援 Dvorak、AZERTY 的快捷鍵。
- 手機顯示 Mac 的狀態，例如目前的前景 App（S-06）。
- 原生 iOS 客戶端。

---

## v2（PKM-2）變更

### 手勢（D-15）
| 手勢 | 判斷方式（web/js/pointer.js） | 送出 |
|---|---|---|
| 三指滑動 | 三指在任何手指移動前落下（手指不會同時著地，所以「一指 → 二指 → 三指」也算）；中心移動 ≥ 40 px，而且一個方向是另一個方向的 1.3 倍以上；一次手勢只送一次 | 左 ⌃→、右 ⌃←、上 ⌃↑、下 ⌃↓ |
| 捏合 | 兩指時，兩指距離變化 > 16 px，而且大於中心移動的 1.2 倍 → 進入捏合；之後每變化 1.25 倍送一次 | 張開 ⌘＝、捏合 ⌘− |
| 雙指快滑（預設關） | 雙指捲動在 260 ms 內水平移動 ≥ 70 px，水平是垂直的 2.5 倍以上；成立時不再產生慣性捲動 | 往右 ⌘[、往左 ⌘] |
| 不變 | 單指點＝左鍵、雙指點＝右鍵、雙指滑＝捲動、長按再拖＝拖曳；捲動中加第三指不會變成三指滑動 | — |

- 手勢一律轉成鍵盤快捷鍵，經原本的 `key` 訊息（可靠、有 ack）送出；協定沒有新增訊息類型。
- Mac 端在 `auth_ok` 多帶 `hotkeysOff`：唯讀讀取 `com.apple.symbolichotkeys` 的 79／81／32／33，被明確關掉的才列出（沒有設定＝系統預設）。

### 版面（D-14、D-16）
| 狀態 | 直拿 | 橫拿 |
|---|---|---|
| 一般 | v1 版面（狀態列、觸控板、迷你地圖、左右鍵、文字框、按鍵列） | 觸控板全螢幕（844×390），左側浮動按鈕列：連線、Aa、⌘、鎖、⚙︎（支援 Fullscreen API 時多一個 ⛶） |
| 打字（`.typing`：文字框有焦點） | 收起狀態列、左右鍵、迷你地圖；觸控板左上角浮動：連線、⌄、⌘、鎖；文字框最多 2 行 | 觸控板在上，文字框＋按鍵列一列在下；浮動按鈕改成一排放左上 |
| 鍵盤真的彈出（`.kbd`：有焦點而且 visualViewport 比 layout viewport 矮 120 px 以上） | 下方 safe-area 歸零（被鍵盤蓋住） | 同左 |
| 快捷鍵面板 | 蓋在觸控板上，不改變其他區塊大小 | 同左（蓋滿） |

- 浮動按鈕、捲動條、面板上的觸控不算觸控板觸控（`notPad`）。
- 面板按鈕用 `tapScrollable`：清單可以捲動，沒有移動的觸控才算點擊；取消 touchend 讓文字框保持焦點（鍵盤不收）。
- 轉向只改 CSS，DOM 和狀態（拖曳鎖定、文字框內容、面板）都不重建。

### 快捷鍵（D-17）
- 內建四組：編輯、截圖、切換、其他（web/js/shortcuts.js `BUILTIN_GROUPS`）。截圖、切換這兩組按完面板會關。
- 自訂：localStorage `pkm.shortcuts` = `{version: 1, items: [{id, label, key, mods}]}`；最多 60 個；名稱最多 24 字；只接受 KeyMap 認得的鍵和 ⌃⌥⇧⌘。
- 匯出格式：`{"app":"phone-keymouse","type":"shortcuts","version":1,"items":[{"label","key","mods"}]}`；匯入也接受單純的陣列。

### 測試用保護（e2e 模式）
- `E2EGuardPolicy.isSystemWide`：⌃方向鍵、⌘Tab、⌘／⌃Space、⇧⌘3／4／5（含 ⌃）、⌃⌘Q、⇧⌘Q、⌥⌘Esc、⌥⌘D、F3／F4／F11，在 `--e2e-guard-pid` 模式一律不送，就算前景是 probe 也一樣。

## v2 補充 PKM-2-3（Ray 真機實測後）
- **按鍵事件的旗標（I-18、D-18）**：主鍵按下／放開的旗標＝修飾鍵＋`KeyMap.intrinsicFlags(keyCode)`：方向鍵 Fn＋數字鍵盤（0xA00000），Home／End／PgUp／PgDn／⌦／Help／F1–F12 Fn（0x800000），其他 0。修飾鍵的 flagsChanged 不變。和 CoreGraphics 自己建立該鍵事件時一樣（self-test 比對）。
- **ack 的新欄位**：`key` 的 ack，如果是剛好 ⌃＋方向鍵：`hotkey`（spaceLeft／spaceRight／missionControl／appWindows）、`hotkeyOff`（bool）、`spaces`（數字，讀不到就沒有）。`auth_ok` 多一個 `spaces`。都是 Mac 唯讀讀 com.apple.symbolichotkeys 和 com.apple.spaces。
- **手機**：ack 帶 `hotkey` 時，依 `hotkeyHint` 顯示原因；⚙︎ 設定的 `#macStatus` 顯示 `macStatusText`。
- **按鍵列（I-19、D-19）**：一列、橫向捲動；按鈕放開才送（手指移動超過 10 px 就算捲動），按住 420 ms 開始連續重複；`.keys-wrap.more-left／more-right` 顯示 ‹ ›。
- **迷你地圖拿掉（D-20）**：手機不再送 `jump`；Mac 端仍接受 `jump`（端對端測試驅動程式使用）。
- **dry-run 測試鉤子**：`PKM_DRY_HOTKEYS_OFF=spaceLeft,…`、`PKM_DRY_SPACES=1` 只影響 `--dry-run` 伺服器回報的狀態，給瀏覽器測試用。
- **e2e.sh**：開跑前檢查螢幕鎖定和 HIDIdleTime ≥ 30 秒（PKM_E2E_MIN_IDLE），`PKM_E2E_PREFLIGHT_ONLY=1` 只做檢查（D-21）。

## v3（PKM-3）變更

- **即時模式送字的時機**（I-21、D-22）：一次只進出一個字馬上送；一次改多個字（聽寫、預測字）等 0.7 秒停頓送淨差異；輸入框只在收鍵盤時清空。Mac 端 ⌫ 和貼上之間至少 50 ms、連續貼上至少 150 ms，剪貼簿還原到第一次貼上之前（D-23）。
- **送出後不再送同一段字**（I-24、D-25）：記住剛送出的字直到收鍵盤，跑回輸入框就拿掉；切換即時／整段永遠不送；送出鈕先收鍵盤。
- **選單列「用 iPhone 掃描」**（D-26）：IP 網址的 QR code（不含配對碼）；網址每次重新掃描（I-25）。
- **🎤 語音鍵**（D-27）：預覽框＋送出一則；https＋Safari 用語音辨識，否則鍵盤聽寫；Mac 自建本機 CA（名稱限制）＋port＋1 的 https／wss，http 提供描述檔。
- **按鍵列自訂**（D-28）：固定「即時」「⌘ 快捷鍵」＋存在手機的清單；✎ 編輯畫面（拖曳、加入、移除、新增自訂、恢復預設）。
- **除錯**：⚙︎ 輸入紀錄（只在手機記憶體，D-24）；記錄檔每次啟動寫網路介面。

## v4（PKM-4，SofaPad 4.0）協定和行為的改變

- 拿掉：語音鍵、https 監聽（port＋1）、`/pkm-ca.mobileconfig`、`/pkm-ca.cer`、`--no-https`、`--https-port`。
- `hello` 多了 `ver`（App 版本）、`build`（建置時間，或 `dev`）、`boot`（這次啟動的隨機 id）。
- `ping` 多了 `wall`（手機的 Date.now()）。`text`、`key` 多了 `sent`（放上連線時的手機時間）和 `at`（第一個字打下去的時間）；`click`、`down` 多了 `sent`。舊的 Mac 會忽略這些欄位。
- Mac 用最近 30 次 ping 的「到達 − wall」最小值當基準；`sent` 比基準晚 3 秒以上的 text／key 回 `{"t":"ack","id":N,"ok":false,"err":"late","late":ms}`、不打；click／down 不做；up、move、scroll 照做。
- `auth_ok` 多了 `last`（這個頁面 sid 最後處理的 id）、`skipped`（晚到沒打的 id，最多 50 個）、`boot`；排在注入佇列後面才送。
- 手機：每 1.5 秒 ping，4.5 秒沒收到任何訊息就斷線重連（0.3 秒起、×1.6、最多 2 秒）。重連後不重送任何 text／key：id ≤ last 且不在 skipped 的當作已打，其餘回報「沒送到」；boot 變了全部當作不確定。沒連上時 `sendReliable` 不排隊。
- 手機即時模式：有沒確認的 text／key 時新打的字先留著，確認後合成一段；點擊、按鍵、手勢、捲動前先送出等待中的字。輸入框不接受 historyUndo／historyRedo，沒有焦點時的 input 不算。
- Mac：注入在自己的序列佇列；網路佇列只解析、回 pong、轉交。
- 網址：`LANURLs.shown` → `scan`（IP 優先）、`alternate`（.local）、`more`（其他介面，放「進階」）；沒有任何位址時用 `fallback(computerName:)`。
- 名稱：SofaPad；bundle id `io.github.rick-ray-wldd.sofapad`；資料夾 `~/Library/Application Support/SofaPad`（第一次啟動從 PhoneKeyMouse 複製 devices.json）；記錄檔 `~/Library/Logs/SofaPad.log`。

## 4.1（SOFA-5）連線來源和網址

- 誰可以連：loopback、RFC 1918、169.254、fe80::/10、fc00::/7（Tailscale 的 fd7a:115c:a1e0::/48 除外），以及和 Mac 自己的全域 IPv6 同一個 /64 的全域 IPv6（D-37）。Tailscale（100.64.0.0/10、fd7a:115c:a1e0::/48）只有在「允許 Tailscale 裝置」打開時（D-38）。連得進來的仍要配對。
- 其他來源：任何請求都回 403 說明頁（`Refusal.page`），不建立 session；選單列顯示最近一次被拒的來源和時間；log「拒絕非區網來源 …」每個來源每分鐘一次（D-36）。
- 換網路：`NetWatch`（NWPathMonitor＋10 秒重掃）→ log「網路變了：…」、選單、開著的掃描／配對視窗換成新網址（D-39）。
- 新選項：`--allow-tailscale`。新設定檔：`settings.json`（`allowTailscale`）。
