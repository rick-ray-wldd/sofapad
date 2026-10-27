# v2 iOS 鍵盤 / viewport / 手勢 / 全螢幕 研究（原始筆記）

研究日期：2026-10-24。標記規則：「已開啟」= WebFetch 實際取得頁面內容（由小模型摘要回傳，非逐字全文）；「僅摘要」= 只看到搜尋結果片段。
**重要缺口（誠實聲明）**：第 2 題的 iPhone 鍵盤高度（pt）本次沒有找到任何可引用的來源數字；下方數字標為「未驗證／一般知識」，需在實機用 visualViewport 量測。

## (a) 來源表

| ID | 標題 | URL | 類型 | 實際開啟？ | 日期 | 關鍵發現 |
|---|---|---|---|---|---|---|
| K-01 | WebKit Bug 217754 Safe-area-inset-bottom still set when keyboard appears | https://bugs.webkit.org/show_bug.cgi?id=217754 | WebKit bug | 已開啟 | 2020-10-15 回報，2025-04-22 最後修改 | 鍵盤出現時 safe-area-inset-bottom 仍保留，造成鍵盤與內容間空白；狀態 NEW 未修；workaround：visualViewport resize 時加 class，`:has(:focus-visible)` 下把 `--safe-area-inset-bottom` 設 0（需改用 var 而非 env） |
| K-02 | WebKit Bug 259770 Support interactive-widget in viewport meta | https://bugs.webkit.org/show_bug.cgi?id=259770 | WebKit bug | 已開啟 | 2023-08-03；最後修改 2026-09-17 | 狀態 NEW，未出貨；"there remains no option to make the viewport resize to the actual visible region"；2026-06 仍有人問是否有 feature flag |
| K-03 | MDN VirtualKeyboard API | https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API | 文件 | 已開啟（相容表未載入） | — | Limited availability／experimental／僅 secure context（HTTPS）；頁面未提 Safari。我們是 plain http LAN，即使支援也不可用 |
| K-04 | Chrome：Control viewport resize behavior (interactive-widget) | https://developer.chrome.com/blog/viewport-resize-behavior | 官方部落格 | 已開啟 | — | Safari iOS 屬於「只縮 Visual Viewport、Layout Viewport 不動」；fixed 元素「can be obscured by the OSK」；interactive-widget 僅 Chrome 108+（不含 iOS 上的 Chrome） |
| K-05 | Apple Developer Forums 800125（iOS 26 fixed 元素錯位） | https://developer.apple.com/forums/thread/800125 | 論壇 | 已開啟 | 2025（iOS 26.0 期間） | 鍵盤開關後 visualViewport.height 與 innerHeight 常持續差 24px；offsetTop 通常可回 0；26.1 beta 有人回報修復，26.0.1 未修；追蹤 WebKit bug 297779 |
| K-06 | 搜尋摘要：iOS Safari visualViewport/innerHeight（含日文筆記） | （搜尋結果，多個 URL） | 搜尋 | 僅摘要 | — | 鍵盤出現時 Layout Viewport 大小不變、Visual Viewport 縮小，innerHeight 不變 |
| K-07 | mathix：Keep fixed elements on top of iOS keyboard | https://mathix-dev.nuxt.dev/blog/fix-html-elements-on-top-of-the-ios-keyboard-using-html-css-js | 部落格 | 已開啟 | — | 公式 `bottom = max(0, innerHeight - vv.height - vv.offsetTop)`；作者稱「不流暢但目前最佳」；VirtualKeyboard `env(keyboard-inset-height)` 僅 Chromium |
| K-08 | Codemia：iPhone 鍵盤高度 | https://codemia.io/knowledge-hub/path/what_is_the_height_of_iphones_onscreen_keyboard | Q&A 彙整 | 已開啟 | — | 僅提舊值 216pt 直向／162pt 橫向，且明說高度隨機型、方向、預測列、語言變動，勿寫死；無新機型數字 |
| K-09 | Use Your Loaf：iPhone 14 Screen Sizes | https://useyourloaf.com/blog/iphone-14-screen-sizes/ | 開發者部落格 | 已開啟 | iPhone 14 世代 | iPhone 14：直向 top47/bottom34/left0/right0；橫向 top0/bottom21/left47/right47。14 Pro：直向 top59/bottom34；橫向 left/right 59、bottom21 |
| K-10 | 搜尋摘要：iPhone 鍵盤高度（Apple Wiki、cnblogs、Apple forums） | https://theapplewiki.com/wiki/Dev:IOS_Keyboard 等 | 搜尋 | 僅摘要 | — | 無可用新機型 pt 數字 |
| K-11 | Macworld：iOS 13 手勢 cut/copy/paste/undo/redo | https://www.macworld.com/article/3410596/ios-13-and-ipados-13-how-to-use-the-new-gestures-for-cut-copy-paste-undo-and-redo.html | 媒體 | 已開啟 | 2019 | 三指左滑=Undo、右滑=Redo、三指雙擊=Undo、三指捏合=Copy、張開=Paste、捏合兩次=Cut、三指按住約 1 秒=快捷列；文章未說明如何關閉 |
| K-12 | Apple Dev Forums 121034：How to disable three finger tap | https://developer.apple.com/forums/thread/121034 | 論壇 | 已開啟（第 1 頁） | iOS 13 beta 期 | 原生 app 可覆寫 `editingInteractionConfiguration` 回傳 None，但實測不可靠；iOS 13.1 後 popup 減少但手勢仍可能取消 app 動作；無 Apple 官方設定開關 |
| K-13 | 搜尋摘要：停用三指手勢 | https://discussions.apple.com/thread/254886950 等 | 搜尋 | 僅摘要 | — | 設定 > 輔助使用 > 觸控 只能關「搖動以還原」；三指手勢無已證實的關閉開關（找不到官方文件） |
| K-14 | 搜尋摘要：Zoom 三指雙擊／設定 | https://www.456bereastreet.com/archive/201105/ios_tip_how_to_zoom_on_web_pages_that_have_disabled_user_zoom 等 | 搜尋 | 僅摘要 | — | 輔助使用「縮放」：三指雙擊開關縮放、三指雙擊並拖曳調整；關閉路徑 設定 > 輔助使用 > 縮放；「user-scalable=no 的頁面仍可被輔助縮放」 |
| K-15 | 搜尋摘要：touch-action／preventDefault 與多指 | https://bugs.webkit.org/show_bug.cgi?id=182521 等 | 搜尋 | 僅摘要 | — | Apple 舊文件：可用 preventDefault 關掉 Safari 預設並自行處理 multi-touch／gesture；沒有任何來源證實頁面能攔截系統層三指編輯手勢 |
| K-16 | WebKit Bug 292603 / 236445 / 274773 / 272779 | https://bugs.webkit.org/show_bug.cgi?id=292603 | WebKit bug | 僅摘要 | 2024–2025 | Safari/WKWebView 底部 home-indicator inset 空條；橫向 inset 只在 viewport-fit=cover 才非 0（272779 主張）；portrait 讀到 0 屬預期（274773） |
| K-17 | MDN Element.requestFullscreen | https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen | 文件 | 已開啟（相容表未載入） | — | 需 transient user activation；相容表未取得 |
| K-18 | caniuse Fullscreen API | https://caniuse.com/fullscreen | 相容表 | 已開啟（摘要） | 含 iOS 27.x | iOS Safari 12 – 27.2 皆列「Partial support」；頁面摘要未說明 partial 範圍（iPhone 僅 video） |
| K-19 | Apple Dev Forums 133248：Fullscreen API on non-video element | https://developer.apple.com/forums/thread/133248 | 論壇 | 已開啟（第 1 頁） | 2020–2024 | Apple Staff 2020：任意元素 fullscreen 僅 iPadOS；Apple Staff 2023-10：「Safari 17.2 beta … Fullscreen API is supported on iPhone」（需 Settings > Safari > Advanced > Feature Flags > Fullscreen API）；2024-02 17.4 beta 4 release note「disabling support for the Fullscreen API on iOS」；之後多則回報 iPhone 仍不行 |
| K-20 | 搜尋摘要：iPhone fullscreen／WebKit 206854、240312 | https://bugs.webkit.org/show_bug.cgi?id=240312 | 搜尋 | 僅摘要 | 最新留言 2026-06 | 使用者稱 WWDC26 Safari 27 beta notes 仍無 iPhone element fullscreen |
| K-21 | web.dev PWA Enhancements | https://web.dev/learn/pwa/enhancements | 官方指南 | 已開啟 | — | iOS/iPadOS「only display: standalone is supported」；`apple-mobile-web-app-status-bar-style: black-translucent` 讓 PWA 進入全螢幕但「different from Android」，狀態列仍顯示、覆蓋在內容上、透明底、白色圖示；theme color 被忽略；`navigator.standalone` 為 WebKit 專屬 |
| K-22 | Apple Dev Forums 104611 Fullscreen when added to HomeScreen | https://developer.apple.com/forums/thread/104611 | 論壇 | 已開啟 | 2021 | 僅一則回覆：`"display":"standalone"` 讓頁面「全螢幕」載入；未談 black-translucent |
| K-23 | MDN ScreenOrientation.lock() | https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock | 文件 | 已開啟（相容表未載入） | — | Limited availability；通常只在行動裝置且 fullscreen 下可用；錯誤 NotSupportedError 等；頁面未列 Safari（「Safari 不支援」為摘要模型的一般知識，非頁面內容） |
| K-24 | 搜尋摘要：manifest orientation on iOS | https://community.mendix.com/link/space/mobile/questions/115035 、Frontend Masters | 搜尋 | 僅摘要 | — | 多處稱 Safari iOS 不支援 manifest orientation；建議用 media query 顯示「請旋轉裝置」提示 |
| K-25 | pqina：Blocking navigation gestures on iOS Safari | https://pqina.nl/blog/blocking-navigation-gestures-on-ios-13-4/ | 部落格 | 已開啟 | iOS 13.4+ | 對 `touchstart` 做 `preventDefault()` 可擋 Safari 邊緣左右滑返回/前進；需限定距離邊緣 20px 內，否則會擋捲動；文章未談主畫面 App |
| K-26 | 搜尋摘要：W3C manifest issue（主畫面 web app 擋返回手勢） | https://lists.w3.org/Archives/Public/public-webapps-github/2022Jun/0288.html | 搜尋 | 僅摘要 | 2022–2025 | 稱主畫面安裝的 web app 目前「無法」像 WKWebView 那樣關閉邊緣返回手勢；有人用邊緣 touchstart handler workaround |
| K-27 | 搜尋摘要：form accessory bar（Capacitor、Framework7） | https://capacitorjs.com/docs/apis/keyboard | 搜尋 | 僅摘要 | — | 附件列（上一個/下一個/完成）是 WKWebView 原生屬性，非 DOM，CSS/JS 無法移除；Capacitor 的 setAccessoryBarVisible 僅限 iPhone 且需原生包裝；Framework7 論壇建議用 VisualViewport 偵測鍵盤並重排 |

## (b) 發現（對應 1–6 題）

### 1. 鍵盤開啟時 viewport 行為
- iOS Safari：Layout Viewport 尺寸不變，只縮 Visual Viewport（K-04, K-06）。`window.innerHeight` 與 `100vh`/`100dvh` 不隨鍵盤改變；`visualViewport.height` 縮小；Safari 會捲動 layout viewport 讓焦點欄位可見，因此 `visualViewport.offsetTop` 可能變成非 0（本次只有 K-05 間接佐證 offsetTop 行為，且是 iOS 26 的 bug 報告）。
- fixed 元素依附 layout viewport，會被鍵盤蓋住或位置錯位（K-04）。我們的做法（height=vv.height, top=vv.offsetTop）正是 K-07 的同類解法，作者承認「不流暢但目前最佳」。
- iOS 26.0 有 bug：關閉鍵盤後 vv.height 與 innerHeight 常持續差約 24px（K-05），26.1 beta 有人回報已修，26.0.1 未修。**我們的程式不要假設「鍵盤關閉 ⇒ vv.height === innerHeight」**。
- `interactive-widget`：iOS Safari 不支援；WebKit bug 259770 至 2026-09 仍 NEW（K-02）。meta 內有該 key 也無作用（無害但無效）。
- VirtualKeyboard API（`navigator.virtualKeyboard`）：Chromium 限定、需 HTTPS（K-03, K-07）；Safari 無；我們是 plain http，更不可用。

### 2. 鍵盤高度（pt）— 來源不足
- 有來源的數字只有舊值 216pt 直向 / 162pt 橫向（K-08，明確標為過時、不可作為規則）。
- 未驗證的一般知識（**非本次來源證實，請實機量測**）：390×844 直向，字母鍵盤約 291pt（不含預測列）；含 QuickType/預測列約 336pt（預測列約 45pt）；橫向約 194–209pt 加預測列。中文注音/拼音候選列通常比預測列更高或與其相當，另有九宮格／手寫等差異；Safari 網頁輸入還可能加表單附件列（上一個/下一個/完成/AutoFill，約 44pt 量級）。K-27 僅證實附件列是原生元件、網頁不能移除；沒有找到「主畫面 standalone 是否也顯示附件列」的來源。
- 結論：只能以 `innerHeight - (vv.height + vv.offsetTop)` 在執行期取得，不能寫死。

### 3. env(safe-area-inset-bottom) 與鍵盤
- 證實：鍵盤出現時 safe-area-inset-bottom **仍被套用**，鍵盤上方留白，bug 自 2020 至 2025-04 仍 NEW（K-01）。數值是 34px 級別的 home-indicator inset（K-09：iPhone 14 直向 bottom 34），K-01 頁面本身沒有寫「34px」。
- 因此我們 root 的 `padding-bottom: env(safe-area-inset-bottom)` 在鍵盤模式下白白浪費約 34px。K-01 的 workaround：偵測鍵盤模式（focus 或 vv 縮小）後把 bottom padding 設 0，改用 CSS 變數而非直接 env()。

### 4. 三指系統手勢
- 手勢內容（iOS 13+）：左滑 undo、右滑 redo、三指雙擊 undo、捏合 copy、張開 paste、捏兩次 cut、三指按住 ≈1 秒 出快捷列（K-11）。
- 是否在 Safari 網頁內容觸發：K-12 顯示這是 UIKit 文字編輯層（以 `editingInteractionConfiguration` 控制），在原生 app 內都難以可靠關閉。**沒有任何來源證實網頁能攔截或抑制它**；K-15 的 Apple 舊文件只說 preventDefault 可關掉 Safari 預設手勢，與系統編輯手勢不同層。我的推論（未被來源證實）：當 textarea 聚焦/有文字編輯 responder 時，三指手勢最可能被觸發；沒有可編輯焦點時影響較小。需實機測試。
- 使用者可關：未找到官方設定能關三指 undo/redo/copy/paste（K-13）；只有 設定 > 輔助使用 > 觸控 > 「搖動以還原」可關搖動（與三指不同）。
- Accessibility Zoom：若使用者啟用，三指雙擊開關縮放、三指雙擊後拖曳調整倍率（K-14）；關閉：設定 > 輔助使用 > 縮放。此為輔助功能，頁面無法停用，且 `user-scalable=no` 不擋它（K-14 摘要，頁面為 2011 舊文）。
- touch-action：iOS Safari 在較舊資料只支援 auto/manipulation（K-15 摘要，可能過時），不要依賴 `touch-action:none`，仍需 touchstart/touchmove 的 preventDefault（需 `{passive:false}`）。

### 5. 「鍵盤模式」最佳實務（來源有限，多為整理）
- 偵測：`visualViewport` 的 resize/scroll；以 `innerHeight - vv.height - vv.offsetTop`（K-07）或 vv.height/innerHeight 比值；同時以 focusin/focusout 作為輔助，因為 iOS 26 bug 會殘留 ~24px 差（K-05），不能只靠高度判斷。
- 套用高度：`root.height = vv.height`、`top = vv.offsetTop`（K-07 同法）。
- 鍵盤模式下把 safe-area bottom 設 0（K-01）。
- 「點其他按鈕時不收鍵盤」的 `preventDefault` on pointerdown/touchstart／mousedown 是通用做法；本次**沒有專門來源**，屬一般知識，需實機驗證（尤其 touchstart preventDefault 會同時阻止合成 click）。
- 避免 iOS 因 focus 捲動頁面：本次無可引用來源。常見做法為 root 用 position:fixed 並在 vv scroll 事件中 `window.scrollTo(0,0)`，或 `focus({preventScroll:true})`（一般知識，未驗證）。

### 6. 全螢幕與方向（協調者追加）

**6a. requestFullscreen on iPhone**
- 任意元素 fullscreen：iPadOS 自 Safari 16.4（無前綴）可用；iPhone 僅 `<video>` 可透過 `webkitEnterFullscreen`（K-19, K-20）。Apple Staff 2023-10 說 17.2 beta 的 iPhone 支援 Fullscreen API（需開 Feature Flag），但 17.4 beta 4 release note 寫「disabling support for the Fullscreen API on iOS」，之後使用者持續回報 iPhone 不行，2026-06 有人稱 Safari 27 beta 仍無（K-19, K-20）。
- caniuse 對 iOS Safari 12–27.2 一律列 Partial（K-18），未說明範圍。結論：**iPhone 上不要依賴 requestFullscreen 對 div/body 生效**；feature-detect 後 fallback。

**6b. 主畫面 Web App**
- manifest `display`：iOS 只支援 standalone（K-21）。`fullscreen` 值預期會退回 standalone（來源說「only standalone is supported」，未直接測 fullscreen 值）。
- `black-translucent`：狀態列仍在，但覆蓋在內容上、透明底、白字，內容延伸到狀態列下方（K-21）；搭配 `viewport-fit=cover`，頂部 safe-area-inset-top 要自己留（直向 47–59px，K-09）。
- 橫向狀態列：本次沒有來源直接證實「iPhone 橫向隱藏狀態列」。K-09 顯示橫向 top inset 為 0，與狀態列在橫向不佔 top 空間一致（這是間接推論）。

**6c. 方向鎖定**
- `screen.orientation.lock()`：MDN 頁面相容表未載入（K-23），Safari 不支援為一般知識；manifest `orientation` 在 iOS 被忽略，有多個論壇/課程來源（僅摘要，K-24）。建議：不鎖定，偵測 portrait/landscape 重排，或顯示「請旋轉」提示。

**6d. 橫向 safe-area**
- iPhone 14：左右 47、bottom 21、top 0；iPhone 14 Pro（Dynamic Island）：左右 59、bottom 21（K-09）。
- 左右 inset 在 `viewport-fit=cover` 才非 0（K-16 摘要）；我們已設 cover。
- Safari 網址列/分頁列在橫向是否佔空間：本次沒有直接來源（只看到「Hide Toolbar 時 inset 仍為 0」的摘要）。主畫面 standalone 無 Safari UI。

**6e. 邊緣手勢**
- 邊緣返回/前進：Safari 分頁可在邊緣 ~20px 內對 touchstart preventDefault 擋掉（iOS 13.4+，K-25）；**主畫面 web app 被報告為無法關閉**（K-26，僅摘要，2022–2025）。
- 底部 home indicator 上滑、通知中心／控制中心下拉：本次**沒有找到任何網頁端可擋的來源**；這是系統層手勢，網頁無法擋。「全螢幕模式需二次上滑」是原生 app 的 `prefersHomeIndicatorAutoHidden`/`preferredScreenEdgesDeferringSystemGestures` 機制，網頁無對應 API（這句為一般知識，非來源證實）。實務對策：關鍵觸控區避開最上與最下邊緣（建議各留約 20–34px），並保留 safe-area。

## (c) 對我們版面的含意
1. 根因（高信心）：iOS 不 resize layout viewport，鍵盤佔用的是 Visual Viewport 的一部分；再加上 (i) 鍵盤本體 + QuickType/注音候選列 + 可能的表單附件列各佔固定高度（未驗證約 290–340pt 直向）、(ii) root 的 `padding-bottom: env(safe-area-inset-bottom)` 在鍵盤開啟時仍保留約 34px（K-01）、(iii) `padding-top: safe-area-inset-top`（47–59px，black-translucent 下需要）、(iv) textarea／工具列自身高度，在 844pt 螢幕上直向剩餘高度只剩約 844 − 336 − 34 − 59 ≈ 400pt 再扣掉輸入列，觸控板才變小。橫向（螢幕高約 390pt、鍵盤約 200pt）更慘，剩約 190pt 減去工具列。
2. 設計建議：
   - 鍵盤模式時：safe-area bottom 設 0（用 CSS 變數）；縮小或收起頂部非必要區。
   - 鍵盤模式用 `focusin/focusout` + vv 縮小雙重判斷（K-05 的 24px 殘差）。
   - 橫向或鍵盤模式：觸控板改為「左右並排」（鍵盤輸入區與觸控板並列）或把文字輸入改成浮動窄條，避免垂直堆疊。
   - 不依賴 interactive-widget／VirtualKeyboard／requestFullscreen／orientation.lock（皆 iOS 無效）；使用 media query（orientation）重排與旋轉提示。
   - 觸控板邊緣 20px 左右對 touchstart preventDefault 以擋 Safari 邊緣返回（僅 Safari 分頁有效，K-25；主畫面 app 不一定）；上下系統邊緣不放關鍵操作。
   - 三指操作（若我們有三指手勢）可能與系統 undo/redo/copy/paste 與 Accessibility Zoom 衝突，且頁面無法停用；建議避免把三指手勢當核心功能，或僅在 textarea 未聚焦時使用，並實機驗證。
   - 實機量測：在頁面加診斷 overlay 顯示 innerHeight、vv.height、vv.offsetTop、safe-area、鍵盤各種輸入法下的高度，補足本次缺的第 2 題數字。
