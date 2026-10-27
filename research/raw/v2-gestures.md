# v2 手勢研究：macOS App 能否用「公開 API」注入真正的多指觸控板手勢？

研究日期：2026-10-24。研究者：research subagent。方法：僅閱讀網頁／GitHub raw 檔（WebSearch、WebFetch、curl 讀取），未 clone、未安裝、未執行任何下載的程式碼。
標記說明：「僅摘要」＝只看到搜尋摘要／片段，沒有實際開啟該頁。WebFetch 的內容經過小模型摘要，引文以其回傳為準；GitHub 星數／最後 push／license 由 GitHub API（curl）取得。

---

## (a) 來源表

### A. Apple 官方文件

| ID | 標題 | URL | 類型 | 實際開啟 | 日期 | 關鍵內容 |
|---|---|---|---|---|---|---|
| G-01 | CGEventType | https://developer.apple.com/tutorials/data/documentation/coregraphics/cgeventtype.json | Apple 文件 (JSON) | 是，完整 | 無 | 公開 CGEventType 共 19 項：null、left/right/otherMouse Down/Up/Dragged、mouseMoved、keyDown/keyUp、flagsChanged、**scrollWheel**、tabletPointer、tabletProximity、tapDisabledByTimeout/UserInput。**沒有任何 gesture / swipe / magnify / rotate 型別。** |
| G-02 | CGEventField | https://developer.apple.com/tutorials/data/documentation/coregraphics/cgeventfield.json | Apple 文件 (JSON) | 是（前 100000 字元＋offset 100000 之後段落） | 無 | 清單內有 `scrollWheelEventScrollPhase`、`scrollWheelEventMomentumPhase`、`scrollWheelEventMomentumOptionPhase`、`scrollWheelEventScrollCount`、`scrollWheelEventInstantMouser`、`mouseEventSubtype`。僅 `scrollWheelEventIsContinuous` 有說明（「non-zero when pixel-based」）；**phase 三個欄位僅列名，abstract 為空**＝符號公開但語意未文件化。沒有 gesture 專用欄位。 |
| G-03 | CGScrollPhase | https://developer.apple.com/documentation/coregraphics/cgscrollphase.md | Apple 文件 | 是 | 無 | enum 有 `began / cancelled / changed / ended / mayBegin`，頁面無描述文字、availability 為空 `-`。（另有 `CGMomentumScrollPhase`，MMF 原始碼使用，未另行開啟其文件頁。） |
| G-04 | CGEvent.init(scrollWheelEvent2Source:units:wheelCount:wheel1:wheel2:wheel3:) | https://developer.apple.com/tutorials/data/documentation/coregraphics/cgevent/init(scrollwheelevent2source:units:wheelcount:wheel1:wheel2:wheel3:).json | Apple 文件 (JSON) | 是 | 無 | 簽章 `init?(scrollWheelEvent2Source:units:wheelCount:wheel1..3)`；macOS 10.13+；abstract／discussion 皆空。公開，但只建立「滾輪」事件，不含手勢。 |
| G-05 | NSEvent.isSwipeTrackingFromScrollEventsEnabled | https://developer.apple.com/documentation/appkit/nsevent/isswipetrackingfromscrolleventsenabled.md | Apple 文件 | 是（注意：正確拼法是 `...FromScrollEventsEnabled`，我第一次輸入錯字 404） | 2026 版權頁 | macOS 10.7+。"A Boolean value that indicates whether to track fluid swipe gestures using scroll events." 說明：自訂捲動的 App 在呼叫 `trackSwipeEvent(options:dampenAmountThresholdMin:max:usingHandler:)` 前要確認為 true；值由使用者偏好決定；NSScrollView 自動處理。→ **接收端的 API**，不是注入端。 |
| G-06 | NSEvent.EventType | https://developer.apple.com/tutorials/data/documentation/appkit/nsevent/eventtype.json | Apple 文件 (JSON) | 是（beginGesture/endGesture 不在摘要結果中） | 無 | swipe:"The user performed a swipe gesture."；magnify:"pinch-open or pinch-close"；rotate；gesture:"nonspecific type of gesture"；smartMagnify；pressure。皆未標 deprecated。這些是 **AppKit 接收端** 的 NSEvent 型別，不是可用 CGEvent 建立的型別。 |
| G-07 | NSEvent.trackSwipeEvent(...) 頁面 | https://developer.apple.com/documentation/appkit/nsevent/trackswipeevent(options:dampenamountthresholdmin:max:usera:) | Apple 文件 | **失敗**：HTML 與 JSON 皆 404（我猜錯 URL） | - | 未取得本頁本文。僅從 G-05 與搜尋摘要（G-08）得知簽章 `trackSwipeEvent(options:dampenAmountThresholdMin:max:usingHandler:)`。標「僅摘要」。 |
| G-08 | WebSearch：trackSwipeEvent 搜尋結果 | https://developer.apple.com/documentation/appkit/nsevent/swipetrackingoptions.md | 搜尋結果 | **僅摘要** | 無 | SwipeTrackingOptions 有兩項（lockDirection、clampGestureAmount）。 |

### B. 開源專案（機制）

| ID | 專案 | URL | 星數／最後 push／License | 實際開啟 | 機制（公開 vs 私有） |
|---|---|---|---|---|---|
| G-09 | SensibleSideButtons (archagon) | https://github.com/archagon/sensible-side-buttons | 2.1k★（頁面）/ API: 2128★、pushed 2026-09-19 / GPL-2.0 | 是（GitHub 頁、README、檔案樹） | README："your side buttons will simulate 3-finger swipes"。檔案樹含 `External/TouchEvents.c/.h`、`External/IOHIDEventTypes.h`、`IOHIDEventData.h`。**使用私有／未文件化的 gesture CGEvent（Calftrail TouchEvents 血統）**。我沒有開啟 TouchEvents.h 內文（猜的 master 路徑 404），機制細節是從 G-10 的作者註解交叉得知。 |
| G-10 | Mac Mouse Fix：TouchSimulator.m | https://raw.githubusercontent.com/noah-nuebling/mac-mouse-fix/master/Helper/Core/Touch/TouchSimulator.m | 見 G-11 | 是（grep ＋兩段 WebFetch 摘要） | 原始碼註解："originally found ... in SensibleSideButtons ... under the name `SBFFakeSwipe:`... heavily based on natevw's ... 'CalfTrail Touch'"。作法：`CGEventCreate(NULL)` → `CGEventSetType/Field 55 = 29`（NSEventTypeGesture）＋ **field 110 = IOHID 子型別**（NavigationSwipe、Rotation=5、Zoom=8、ZoomToggle=22、DockSwipe）＋ field 132 = phase，再 `CGEventPost(kCGHIDEventTap / kCGSessionEventTap)`。註解自稱 "undocumented CGEventFields found through Calftrail TouchExtractor"。**DockSwipe（切 Space／Mission Control／Launchpad）：pre-macOS 27 用數字 CGEvent field（124,135,119,139,123,165,136,129,130,134,41…），並同時發 type 29 與 type 30 事件；註解 "macOS 27 fix notes: (CGEventFields are now ignored, instead it relies on an IOHIDEvent)"，macOS 27 路徑改為建立 `HIDEvent`（kIOHIDEventTypeDockSwipe）後 `CGEventSetHIDEvent(e30, hidEvent)`，並列出 macOS 27 Beta 2 的已知問題（dock swipe 轉場偶爾卡住）。** 檔內無 `CGS` 前綴呼叫。→ 全為私有／未文件化，且 **macOS 27 已經改變機制**，跨版本風險極高。 |
| G-11 | Mac Mouse Fix | https://github.com/noah-nuebling/mac-mouse-fix | 11.1k★（API 11144）/ pushed 2026-10-23 / 最新 release 3.1.0（2026-09-15）/ 自訂 "MMF License"（GitHub 判為 NOASSERTION，原始碼可看但不可直接做成複製品，**不可直接抄**） | 是（GitHub 頁、API） | README：按鈕可指派「Spaces & Mission Control」；「Scroll & Navigate」讓按鈕拖曳等同觸控板雙指滑動；頁面未提私有 API，但原始碼證實使用（G-10）。 |
| G-12 | Mac Mouse Fix：GestureScrollSimulator.m | https://raw.githubusercontent.com/noah-nuebling/mac-mouse-fix/master/Helper/Core/Touch/GestureScrollSimulator.m | 同 G-11 | 是（curl ＋ grep 前段與註解） | 檔頭："generates fluid scroll events containing gesture data similar to the Apple Trackpad or Magic Mouse driver... don't contain any raw touch information. But in most situations, they will work exactly like scrolling on an Apple Trackpad"。實作：type 22 scrollWheel（field 55）＋ **field 88 IsContinuous、field 99 = scroll phase、field 123 = momentum phase、field 137 = directionInvertedFromDevice**，用 `kCGSessionEventTap` 送出；再送一個 **type 29 事件（field 110=6 scroll 子型別、field 116/119 = gesture delta、field 132 = phase）**。註解：Safari 不會自己延續慣性、Xcode 會，所以要自己補 momentum 事件；"Needs to be kCGHIDEventTap instead of kCGSessionEventTap to work with Swish"。→ **scroll phase 欄位在公開 enum/欄位名稱中存在（G-02、G-03），但實務上要搭配未文件化的 type 29 gesture 事件才能「完全像觸控板」。** |
| G-13 | yabai（現址 asmvik/yabai） | https://github.com/asmvik/yabai | API: 29754★、pushed 2026-06-14、MIT | 是（README 以 curl 讀取）；另 koekeishiya wiki 頁以 WebFetch | README："System Integrity Protection can be (partially) disabled for yabai to inject a scripting addition into Dock.app ... enables control of the window server"。Wiki：移動／建立／銷毀 Space 需要 SIP 部分關閉。**切換 Space 本身不在 wiki 摘要的 SIP 清單內**（該模型明說無法確認）。→ 私有／注入 Dock，不適合我們。Wiki URL：https://github.com/koekeishiya/yabai/wiki/Disabling-System-Integrity-Protection |
| G-14 | Hammerspoon | https://github.com/Hammerspoon/hammerspoon | 16.3k★、pushed 2026-07-08、MIT | 是 | 無手勢注入。 |
| G-15 | hs.spaces 文件 | http://www.hammerspoon.org/docs/hs.spaces.html | 官方文件 | 是（第一次 hammerspoon.github.io 被 301，改開新網址） | "do utilize some private APIs which means that Apple could change them at any time"；`gotoSpace` 是「programmatically invoking the button to activate the space」（用 Accessibility 去按 Mission Control 內的按鈕），有無法完全抑制的視覺閃現。 |
| G-16 | LinearMouse | https://github.com/linearmouse/linearmouse | API: 7053★、pushed 2026-10-11、MIT | 是 | 頁面未提手勢模擬／Mission Control／私有 API（僅滑鼠捲動／加速度調整）。 |
| G-17 | Mos | https://github.com/Mos-Mac/Mos → 實際為 https://github.com/Caldis/Mos | API: 21711★、pushed 2026-10-12、license NOASSERTION | 僅取得 API 統計；內容頁 WebFetch 404（舊網址）。 | 平滑捲動工具；**未確認其機制**，標「僅統計」。 |
| G-18 | Amethyst | https://github.com/ianyh/Amethyst | API: 16302★、pushed 2026-10-20、MIT | 是（README 以 curl 讀取） | 需 Accessibility 權限；README 提到「Throw focused window to space left/right」、並建議用鍵盤導覽 Space；不做手勢注入。 |
| G-19 | BetterTouchTool 文件 | https://docs.folivora.ai/docs/1_gestures.html | 官方文件 | **失敗 404** | 未取得。BTT 屬閉源，機制未驗證。 |

### C. 其他佐證

| ID | 標題 | URL | 類型 | 實際開啟 | 關鍵內容 |
|---|---|---|---|---|---|
| G-20 | WebKit：Add support for testing swipes | https://webkit.googlesource.com/WebKit/+/8635bd65e0e503d0a90fff39220762d65ce1b9bb | commit | **僅摘要**（搜尋結果） | WebKit 測試工具用 `swipeGestureWithWheelAndMomentumPhases` 以 Core Graphics scroll phase 值＋gesture 型欄位合成 swipe。 |
| G-21 | WebKit LayoutTest：pushState-programmatic-back-while-swiping-crash | https://webkit.googlesource.com/WebKit/+/master/LayoutTests/swipe/pushState-programmatic-back-while-swiping-crash.html | 測試檔 | **失敗 403**，僅摘要 | 搜尋摘要稱此測試混用 gesture 型欄位與帶 scroll phase 的 scrollWheel 事件。 |
| G-22 | Chromium issue 40322807（MMF 註解引用） | https://issues.chromium.org/issues/40322807 | issue | 未開啟（僅 MMF 檔頭引用） | MMF 註解：合成的 gesture scroll 缺 raw touch info，Chromium 有 bug，Magic Mouse 也有，真觸控板沒有。 |
| G-23 | Apple：Mission Control 說明 | https://support.apple.com/en-kw/guide/mac-help/mh35798/26/mac/26 | Apple Support | 是 | "press Control-Up Arrow" 進出 Mission Control；Control-Down Arrow 顯示目前 App 所有視窗；可在「Keyboard settings」更改；其他 Mission Control 選項在 System Settings → Desktop & Dock → Mission Control。（本頁未提 ⌃←/→。） |
| G-24 | Apple：在多個 Spaces 中工作 | https://support.apple.com/guide/mac-help/work-in-multiple-spaces-mh14112/mac | Apple Support | 是 | "Press the Control key and the Right or Left arrow key."；"On a trackpad, swipe left or right with three or four fingers."（頁面未說這些鍵是否預設啟用、也未說在哪個設定頁開關。） |
| G-25 | MacMost：31 Mission Control Tips | https://macmost.com/?p=34342 | 第三方 | **僅摘要** | 稱 Move left/right a space 需到 System Settings → Keyboard → Keyboard Shortcuts → Mission Control 勾選啟用（第三方，與 Apple 頁無對照）。 |
| G-26 | Apple：Mac keyboard shortcuts（設定入口） | https://support.apple.com/guide/mac-help/mchlp2271/mac | Apple Support | 是 | 設定入口：System Settings → Keyboard → Keyboard Shortcuts。頁面本身不列 Mission Control 預設鍵。 |
| G-27 | Apple：Take a screenshot on Mac | https://support.apple.com/guide/mac-help/take-a-screenshot-mh26782/mac | Apple Support | 是 | ⇧⌘3 全螢幕、⇧⌘4 選區、⇧⌘5 截圖面板；"Add Control to any of the above to copy the capture instead of saving it"（例如 ⌃⇧⌘3 複製全螢幕到剪貼簿）。 |
| G-28 | Apple：How to take a screenshot（舊 HT 頁） | https://support.apple.com/en-us/102650 | Apple Support | 是 | 只提 ⇧⌘5（Mojave 之後）與 ⇧⌘3/4；**未**提 Control 變體（以 G-27 為準）。 |
| G-29 | Apple：Zoom（輔助使用）說明 | https://support.apple.com/guide/mac-help/mh40579/mac | Apple Support | **僅摘要**（搜尋摘要） | 修飾鍵＋捲動可縮放，修飾鍵可選 Control／Option／Command，位於 Accessibility → Zoom（預設是否開啟：摘要稱需啟用；Hexnode 頁稱預設修飾鍵為 Control）。 |
| G-30 | MacMost：10 places to zoom | https://macmost.com/10-places-where-you-can-zoom-in-on-content-on-your-mac.html | 第三方 | **僅摘要** | Safari View 選單列出 ⌘+ 與 ⌘-（"plus" 實際是 ⌘=）。AbilityNet 的 Sonoma/Tahoe 頁卻寫 Ctrl + +；兩說矛盾，未能解決。 |

---

## (b) 結論：公開 vs 私有

**問題：macOS 13–27 的 App 能否只靠公開、有文件的 API 注入「真正的」多指觸控板手勢（NSEventTypeGesture/Swipe/Magnify/Rotate、dock swipe／切 Space）？**

**不能。**

1. **公開 CGEventType 清單（G-01）沒有 gesture／swipe／magnify／rotate／dock 型別**；能建立的只有滑鼠、鍵盤、flagsChanged、scrollWheel、tablet。NSEvent 的 `.swipe/.magnify/.rotate/.gesture`（G-06）是接收端型別，Apple 沒有提供「用 CGEvent 合成它們」的文件化路徑。
2. **有一個灰色地帶：scroll phase。** `scrollWheelEventScrollPhase / MomentumPhase` 欄位與 `CGScrollPhase` enum（began/changed/ended/cancelled/mayBegin）在公開標頭／文件中**有名字但沒有說明**（G-02、G-03）。用 `CGEvent(scrollWheelEvent2Source:...)`（公開，G-04）建立像素捲動事件並填入 phase，是「符號公開、語意半文件化」。這是兩指滑動（Safari／Finder 的 trackSwipe-from-scroll，接收端 G-05 說明 NSScrollView 會自動處理）最接近公開的做法。
3. **證據強度**：Mac Mouse Fix（G-12）實際就是用「scrollWheel（field 55=22, 88, 99, 123, 137）＋type 29 gesture 事件（field 110=6, 116/119, 132）」做出可用的兩指捲動與滑動，作者自述在「大多數情況」與真觸控板相同，但**缺 raw touch 資料，Chromium 會有 bug（G-22）**，且需要補慣性事件。**我沒有找到「僅用 scroll phase 欄位（不加 type 29 事件）就能讓 Safari／Chrome 觸發雙指滑動返回／前進」的明確證據**；WebKit 測試工具（G-20/21，僅摘要）是同時混用 gesture 欄位。結論：未驗證，只能當實驗。
4. **三指滑動切 Space／Mission Control／App Exposé（dock swipe）：全部是私有路徑。** SensibleSideButtons 與 Mac Mouse Fix（G-09、G-10）靠未文件化 CGEvent field（來自 Calftrail 逆向）；**macOS 27 起 MMF 說 CGEvent field 被忽略，改成 `CGEventSetHIDEvent` ＋私有 `HIDEvent` 類別**，並有 macOS 27 Beta 2 的已知問題。這代表：隨 OS 版本變動、無文件、可能被 Apple 隨時改掉；而且 MMF 授權不可直接抄，SensibleSideButtons 為 GPL-2.0（會傳染）。
5. **其他工具走別條路**：yabai 用 SIP 部分關閉＋注入 Dock（G-13，不可行）；Hammerspoon `hs.spaces` 用私有 API 並用 Accessibility 點 Mission Control 內按鈕（G-15，有畫面閃現）；Amethyst 只用 Accessibility 與鍵盤（G-18）。
6. **注意**：不確定 Apple 是否有「文件化」的 Space 切換 API；本研究查到的 Apple 頁面都只提鍵盤／手勢／設定，沒有程式介面。

**公開替代方案＝送鍵盤快速鍵（CGEvent keyDown/keyUp，需 Accessibility，已是本專案現有機制）。** 缺點：使用者可能改過或關掉系統快速鍵；Space 切換會用系統預設動畫（與三指滑動的跟手動畫不同，沒有「跟手」連續感）。

### 已驗證 vs 未驗證的細節
- 已驗證（Apple 頁）：⌃↑ 進／出 Mission Control、⌃↓ App 視窗（G-23）；「⌃ + ←/→」切 Space（G-24）；設定入口 Keyboard → Keyboard Shortcuts（G-26）；⇧⌘3/4/5 及加 Control 複製到剪貼簿（G-27）。
- **未驗證**：這些 Mission Control 快速鍵在**全新安裝的預設狀態是否皆為開啟**。Apple 頁面未明說，MacMost（G-25，僅摘要）暗示 Move left/right a space 需手動勾選。**實作時應做「偵測／提示」：第一次使用請使用者到 System Settings → Keyboard → Keyboard Shortcuts → Mission Control 確認勾選。** 也可讀取 `com.apple.symbolichotkeys` 偏好設定檢查（此點為經驗推論，本次未找到來源，未驗證）。
- 縮放：瀏覽器 ⌘= / ⌘-（G-30，僅摘要，且與 AbilityNet 說法矛盾）；macOS 輔助使用縮放需在 Accessibility → Zoom 啟用，修飾鍵＋捲動（G-29，僅摘要）。

---

## (c) 各手勢的建議公開機制

| 想要的手勢 | 建議（公開）機制 | 備註 |
|---|---|---|
| 三指左右滑（切 Space） | 送 ⌃← / ⌃→（CGEvent 鍵盤，帶 `.maskControl`，方向鍵通常需附 `.maskSecondaryFn`/numericPad 旗標，**此旗標細節為經驗，未查到來源，請實測**） | 需使用者啟用 Move left/right a space；沒有跟手動畫。可在手機 UI 上做成「滑動一次＝切一格」。 |
| 三指上滑（Mission Control） | ⌃↑；或以 NSWorkspace 開啟 Mission Control.app（未驗證） | G-23。 |
| 三指下滑（App Exposé／Application windows） | ⌃↓ | G-23。 |
| 兩指左右滑（網頁上一頁／下一頁） | 優先：⌘[ / ⌘]（多數瀏覽器；未在本次來源驗證，請實測）。實驗選項：scroll phase 序列（began→changed→ended＋慣性）搭配 `isContinuous` | 純 scroll phase 能否觸發 Safari 滑動返回，**無證據**（見結論 3）；MMF 需再加 type 29 事件（私有）。 |
| 捏合縮放 | ⌘= / ⌘-（瀏覽器）；或 ⌃＋捲動（僅輔助使用縮放已啟用時）；真正的 magnify 事件為私有（MMF 的 field 110=8） | G-29/G-30，皆僅摘要。 |
| 截圖 | ⇧⌘3/4/5；複製到剪貼簿加 ⌃（⌃⇧⌘3/4） | G-27，Apple 頁已驗證。 |
| 兩指捲動 | `CGEvent(scrollWheelEvent2Source:units:.pixel...)`，公開 | G-04；平滑度可再加 phase（半文件化）。 |

### 決策建議
- v2 用「鍵盤快速鍵」實作三指手勢與縮放，標明這是模擬而非真手勢；文案上避免宣稱「原生觸控板手勢」。
- 若 Ray 堅持「跟手」的三指動畫，唯一路徑是私有 gesture／HIDEvent（G-10），需承擔：macOS 27 已改機制、無文件、授權（MMF License、SSB GPL-2.0）、App Store 不適用、每次大版本需回歸測試。建議僅列為 opt-in 實驗功能，並在 macOS 版本偵測失敗時退回鍵盤快速鍵。
