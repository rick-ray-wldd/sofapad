# RESEARCH-LOG

> 公開版本：為了隱私，電腦名稱、使用者名稱、區網 IP（改成 192.168.x.x）、本機路徑、個人助理系統的 id、他人姓名和 email 已遮蔽，P-22 和他人對話有關的原文改成概述（見 docs/PUBLIC-CHECK.md）；其餘逐字未改。

讀了多少：全文／僅摘要／README／程式碼（clone 唯讀）／只看標題。GitHub 另記星數、最後更新、授權、平台、是否 clone／執行（一律不執行）。
來源由 writer 本人與 3 個研究子代理（見 TOOL-LOG）查詢；子代理回報的來源由 writer 抽查後才列入，抽查結果寫在「讀了多少」欄。

| 編號 | 類型 | 標題、作者、年份 | 網址或 DOI | 怎麼找到的 | 讀了多少 | 重點 | 用在哪 |
|---|---|---|---|---|---|---|---|
| S-01 | 論文 | Kang, Kim, Lee, Lee, Woo, Koo, Son, Cho, Ahn, Ku, Kim. **Phonaze: Gaze-Hover with Torso-Supported Phone Confirmation for Ergonomic Interaction in Supine Mixed Reality.** IEEE ISMAR 2026，program paper 1557 | https://www.ieeeismar.net/2026/papers/ （11:51 curl 下載官方頁並抽出條目；DOI 未公開，未核實） | 派工線索（S-02）→ 官方論文頁；另搜 "Phonaze gaze-hover torso-supported phone confirmation supine mixed reality" 找不到全文 | 僅摘要（官方摘要全文；論文全文未公開） | 摘要：躺姿 XR 的空中手勢很快手酸；用頭顯原生 gaze hover 指、躺著時手機放在軀幹上用拇指點確認；兩支原生 App 走本地 Wi-Fi，端到端 tap→回饋平均 52 ms；AVP 上 N=18 組內實驗，對比 Direct Touch 手臂疲勞降 75%（Borg CR-10 1.9 vs 7.6）、選取時間快 31%、SUS 85.2 | 支持「手臂有支撐、只動拇指」的設計方向；52 ms 當延遲參考（D-05、D-08） |
| S-02 | 內部線索 | Ray 另一份研究 VRRES-2 的 SOURCES_v2.md，A6 條目 | （課程資料夾） | 派工單指定 | 全文（只讀 A1–A7 相關段落） | A6 記載 Phonaze 題名、作者、ISMAR 2026 paper 1557，標「B，僅摘要」、「DOI 未核實」。writer 核對：題名、作者、編號與官方頁一致。該檔寫「全文未取得，因此不引用 n 或效果數值」較保守；這些數字其實出現在官方摘要裡，本專案引用時標「摘要所載」 | 交叉核對 S-01 |
| S-03 | 論文 | Darbar, Prouzeau, Odicio-Vilchez, Lainé, Hachet. Exploring Smartphone-enabled Text Selection in AR-HMD. GI 2021 | https://graphicsinterface.org/wp-content/uploads/gi2021-14.pdf（DOI 10.20380/GI2021.14） | A1（文獻子代理）：搜尋 smartphone as touchpad input for head-mounted display text entry | 全文 | 手機當連續觸控板（相對＋logistic CD gain）最快、錯誤最少、體力負擔最低；700 ms 長按切模式難用 | D-05 |
| S-04 | 論文 | Unlu, Xiao. PAIR: Phone as an Augmented Immersive Reality Controller. VRST 2021 | https://robertxiao.ca/pubs/2021_VRST_ARPhone.pdf（writer 12:14 curl 確認 200 application/pdf） | A1（文獻子代理）：搜尋 PAIR Phone as an Augmented Immersive Reality controller | 全文 | 觸控與文字走 TCP；WiFi 單向延遲最高約 25 ms | D-02、D-08 |
| S-05 | 論文 | Henderson, Ceha, Lank. STAT: Subtle Typing Around the Thigh for HMDs. MobileHCI 2020 | DOI 10.1145/3379503.3403549（ACM 403；OpenAlex 摘要；writer 用 Crossref 核對題名與作者相符） | A1（文獻子代理）：第一輪搜尋 | 僅摘要 | 手機放大腿上當 HMD 打字面 | D-05（姿勢） |
| S-06 | 論文 | Zhu, Grossman. BISHARE. CHI 2020 | DOI 10.1145/3313831.3376233（OpenAlex 摘要） | A1（文獻子代理）：搜尋 BISHARE … | 僅摘要 | 手機與 AR HMD 雙向互動設計空間 | v2 想法，沒用到 v1 |
| S-07 | 論文 | Matulic, Ganeshan, Fujiwara, Vogel. Phonetroller. CHI 2021 | DOI 10.1145/3411764.3445583（OpenAlex 摘要） | A1（文獻子代理）：PAIR 搜尋結果 | 僅摘要 | VR 看不到手機與手，精準觸控難 | D-05（大按鈕、免看） |
| S-08 | 論文 | Biener et al. Breaking the Screen. IEEE TVCG 2020 | https://arxiv.org/pdf/2008.04559（writer 12:14 確認 arXiv 頁存在） | A1（文獻子代理）：OpenAlex 搜 ARC-Pad 時出現 | 全文（部分） | 平板當觸控板，按住邊框切粗調 gain 跨螢幕 | D-05（迷你地圖） |
| S-09 | 論文 | Sasaki, Manabe, Yata. Smartphone-Based Input as a Practical Alternative… APMAR 2026 | https://ceur-ws.org/Vol-4267/paper1.pdf | A1（文獻子代理）：第一輪搜尋 | 全文（部分） | 手機 Pointer 主觀評價與 Quest 控制器無顯著差異；單手拇指＋震動回饋 | D-05 |
| S-10 | 論文 | Li et al. SwEYEpinch. CHI 2026 | https://arxiv.org/abs/2604.03520、https://arxiv.org/pdf/2604.03520（writer 12:14 用 arXiv API 確認題名相符） | A1（文獻子代理）：搜尋 Apple Vision Pro user study text entry … | 全文（部分） | Gaze&Pinch 逐鍵約 10 WPM、Finger-Tap 約 18 WPM（Varjo 設置） | D-06 |
| S-11 | 論文 | Casiez, Vogel, Balakrishnan, Cockburn. The Impact of Control-Display Gain… HCI 2008 | https://Www.Gwern.net/doc/design/2008-casiez.pdf | A1（文獻子代理）：搜尋 Casiez … control-display gain | 全文（部分） | 加速度比固定 gain 快；低 gain 因 clutch 變慢 | D-05 |
| S-12 | 論文 | Casiez, Roussel. No more bricolage! UIST 2011 | DOI 10.1145/2047196.2047276（OpenAlex 摘要） | A1（文獻子代理）：搜尋 No more bricolage | 僅摘要 | OS 加速度函數比固定 gain 最多好 24% | D-05（客戶端自己做曲線） |
| S-13 | 論文 | McCallum, Irani. ARC-Pad. UIST 2009；McCallum 碩士論文 2012 | DOI 10.1145/1622176.1622205（OpenAlex 摘要）；https://mspace.lib.umanitoba.ca/items/<id>/full | A1（文獻子代理）：搜尋 ARC-Pad … | UIST 僅摘要；碩士論文全文（部分，第 4–5 章） | 點一下絕對跳躍、滑動相對移動；tap 判斷 300 ms／0.35 cm | D-05（迷你地圖、tap 門檻） |
| S-14 | 論文 | Boring, Jurmu, Butz. Scroll, Tilt or Move It. OZCHI 2009 | https://www.medien.informatik.uni-muenchen.de/pubdb/publications/pub/boring2009ozchi/boring2009ozchi.pdf | A1（文獻子代理）：搜尋 Scroll, Tilt or Move It | 全文 | 按壓時手機晃動造成高錯誤率；手臂靠身體更準 | D-05（不做空中滑鼠、點擊凍結） |
| S-15 | 論文 | Bergström-Lehtovirta, Oulasvirta. Modeling the Functional Area of the Thumb. CHI 2014 | DOI 10.1145/2556288.2557354（OpenAlex 摘要） | A1（文獻子代理）：搜尋 functional area of the thumb | 僅摘要 | 單手拇指可及區模型 | D-05（按鈕位置、左手模式） |
| S-16 | 論文 | Hincapié-Ramos et al. Consumed Endurance. CHI 2014 | DOI 10.1145/2556288.2557130（3 個全文鏡像連線失敗；OpenAlex 摘要） | A1（文獻子代理）：搜尋 Consumed Endurance | 僅摘要 | 以肩部力矩量化 gorilla arm | D-05（手臂不懸空） |
| S-17 | 論文 | Jang, Stuerzlinger, Ambike, Ramani. Modeling Cumulative Arm Fatigue. CHI 2017 | DOI 10.1145/3025453.3025523（OpenAlex 摘要） | A1（文獻子代理）：OpenAlex 搜 CE 時一併出現 | 僅摘要 | 疲勞會累積 | 沒直接用到（背景） |
| S-18 | 論文 | Li et al. NICER. ACM TOG 2024 | https://arxiv.org/html/2406.08875v1 | A1（文獻子代理）：CE 搜尋結果 | 全文（部分） | 手臂高於肩最累；休息會恢復 | D-05（不要求舉高手機） |
| S-19 | 論文 | Pfeuffer. Design Principles & Issues for Gaze and Pinch Interaction. arXiv 2024 | https://arxiv.org/pdf/2401.10948 | A1（文獻子代理）：搜尋 Gaze + Pinch design principles | 全文 | 看加捏對手臂友善；遠距拖曳需要放大 transfer function | REPORT §2（背景） |
| S-20 | 論文 | Biener et al. Quantifying the Effects of Working in VR for One Week. ISMAR 2022 | https://arxiv.org/pdf/2206.03189 | A1（文獻子代理）：搜尋 Biener working in VR one week | 全文（部分） | VR 中用熟悉的實體鍵盤＋觸控板只小幅掉速（43 vs 47 WPM） | D-06 |
| S-21 | 論文 | Tominaga, Fujita, Takakura, Shizuki. Position and Angle of Virtual Keyboard. AsianCHI 2021 | https://www.iplab.cs.tsukuba.ac.jp/paper/poster/tominaga_AsianCHI2021.pdf | A1（文獻子代理）：搜尋 VR reclined lying posture comfort | 全文（3 頁海報） | 鍵盤越高手越累、越低脖子越累 | D-05（免低頭） |
| S-22 | 論文 | Jeong et al. Investigating the Impact of Lying Postures on MR Interaction. CHI 2026 EA | https://pure.seoultech.ac.kr/en/publications/investigating-the-impact-of-lying-postures-on-mixed-reality-inter/（writer 11:52 的 Phonaze 搜尋也看到這頁的搜尋結果） | A1（文獻子代理）：搜尋 text entry VR lying down supine | 僅摘要 | 不同躺姿下的表現與舒適度有顯著差異 | D-05（左手模式） |
| S-23 | 論文 | Luo et al. Sensory Conflict… Reclining & Lying Positions. UIST 2022；續作 UIST 2023 | DOI 10.1145/3526113.3545692、10.1145/3586183.3606714（OpenAlex 摘要） | A1（文獻子代理）：搜尋 VR reclined lying posture | 僅摘要 | 45° 半躺時感官衝突最嚴重 | README 使用建議 |
| S-24 | 論文 | Ahn et al. Differences in neck muscle activity according to lying positions using a smartphone. JBMR 2022 | DOI 10.3233/BMR-200315（Europe PMC API 摘要） | A1（文獻子代理）：搜尋 smartphone lying supine neck muscle | 僅摘要 | 仰臥時頸部肌肉負擔最低 | D-05（主要情境：仰躺、手機放胸口） |
| S-25 | 論文 | Arnold, Epperson, Chaparro. Evaluating Text Input Methods on the Apple Vision Pro. HFES 2025 | https://portfolio.erau.edu/en/publications/evaluating-text-input-methods-on-the-apple-vision-pro-a-compariso/ | A1（文獻子代理）（S-02 也列為 A7） | 只看標題（頁面沒有摘要） | — | 沒用到（沒讀到內容） |
| S-26 | 論文 | Mohr et al. TrackCap. CHI 2019 | https://realities.fh-salzburg.ac.at/publications/trackcap | A1（文獻子代理）：PAIR 的 Related Work | 只看書目 | — | 沒用到 |
| S-30 | GitHub | Unrud/remote-touchpad（692★；2026-10-11；GPL-3.0；瀏覽器→Linux/Win/Mac；clone 792cd0f，未執行） | https://github.com/Unrud/remote-touchpad | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | 程式碼（clone 唯讀）；writer 抽查 API 與 socket.mjs:20-28 相符 | 密鑰放 #fragment＋HMAC challenge；純 JS SHA | D-04 |
| S-31 | GitHub | joonlab/MacPilot（25★；2026-08-03；MIT；瀏覽器→Mac；clone 9333dc2，未執行） | https://github.com/joonlab/MacPilot | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | 程式碼（clone 唯讀）；writer 抽查 EventInjector.swift:250-264 相符 | Swift NWListener＋CGEvent；滑鼠 flags=[]；修飾鍵真的按下；IME 比對演算法。反例：PIN 預設關 | D-03、D-06、D-07 |
| S-32 | GitHub | Pls-1q43/VibeCast（54★；2026-06-24；MIT；瀏覽器→Mac；clone 374e37b，未執行） | https://github.com/Pls-1q43/VibeCast | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | 程式碼（clone 唯讀） | 手機輸入法→Mac；AXValue 或剪貼簿（備份、貼上、還原） | D-07 |
| S-33 | GitHub | maros-o/opencouchpad（43★；2026-10-12；MIT；瀏覽器→Linux/Win/Mac（實驗性）；clone c506385，未執行） | https://github.com/maros-o/opencouchpad | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | 程式碼（clone 唯讀）；writer 抽查 API 相符 | 加速度 EMA、慣性、PIN 鎖定、Host 白名單、continuous scroll；組字中也送（反例） | D-04、D-05 |
| S-34 | GitHub | chekusu/sofatap（132★；2026-10-22；MIT；原生 iPhone/Android App→Win/Mac/Linux；未 clone） | https://github.com/chekusu/sofatap | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README＋3 個檔（A2 用 gh api）；writer 12:06 WebFetch 自讀 README | QR＋wss 憑證釘選；Unicode ≤20 UTF-16；斷線釋放；TestFlight beta。最接近的現成方案之一 | D-07、D-09 |
| S-35 | GitHub | rahatsagor/CmdPalm（93★；2026-10-19；AGPL-3.0；瀏覽器→Mac） | https://github.com/rahatsagor/CmdPalm | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README | QR、PIN、Mac 端核准；單拇指捲動條 | D-05（只借概念） |
| S-36 | GitHub | narendraio/fingerfly（17★；2026-05-25；MIT；瀏覽器→Mac） | https://github.com/narendraio/fingerfly | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README | 靈敏度、捲動倍率；README 沒提到認證 | D-05 |
| S-37 | GitHub | hello-claude/phone-web-remote（1★；2026-06-06；MIT；瀏覽器→Mac/Win） | https://github.com/hello-claude/phone-web-remote | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README | 非 ASCII 字元走剪貼簿；4 位數 PIN | D-07 |
| S-38 | GitHub | Soham109/glasspad（4★；2026-10-22；MIT；原生 App→Mac/Win） | https://github.com/Soham109/glasspad | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README | 電腦端按 Allow 核准 | D-11（參考） |
| S-39 | GitHub | Mehver/iController（12★；2026-10-17；BSD-3；瀏覽器→Win（Mac 只到舊版）） | https://github.com/Mehver/iController | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README | — | 沒用到（Mac 支援已停） |
| S-40 | GitHub | Kaia-Alenia/Axon（40★；2026-08-23；GPL-3.0；Android→Linux/Win/Mac） | https://github.com/Kaia-Alenia/Axon | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README | 移動走 UDP | 沒採用（WebSocket 已足夠，D-02） |
| S-41 | GitHub | gasolin/webbymouse（80★；2016-05-17；MIT） | https://github.com/gasolin/webbymouse | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README | 停更 | 沒用到 |
| S-42 | GitHub | KDE/kdeconnect-kde（4071★；2026-10-23；GPL；Android/iOS→Linux（macOS 非官方）） | https://github.com/KDE/kdeconnect-kde | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README＋1 個檔（gh api） | 按住鍵時要送 Dragged 事件 | D-03 |
| S-43 | GitHub | feschber/lan-mouse（5405★；2026-09-26；GPL-3.0；電腦↔電腦） | https://github.com/feschber/lan-mouse | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README＋1 個檔 | DTLS＋指紋；delta 欄位 | D-03、D-12 |
| S-44 | GitHub | deskflow/deskflow（30039★；2026-10-21；GPL-2.0；電腦↔電腦） | https://github.com/deskflow/deskflow | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README | 輔助使用授權注意事項 | README（權限說明） |
| S-45 | GitHub | input-leap/input-leap（8320★；2025-11-27；已封存） | https://github.com/input-leap/input-leap | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README＋API | 紅旗：已封存 | 沒用到 |
| S-46 | GitHub | debauchee/barrier（30946★；2022-02-04；停止維護） | https://github.com/debauchee/barrier | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README | 紅旗：已停止維護 | 沒用到 |
| S-47 | GitHub | go-vgo/robotgo（10878★；2026-10-22；Apache-2.0；Go 函式庫） | https://github.com/go-vgo/robotgo | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README＋2 個檔 | 逐字 Unicode＋剪貼簿 | D-07 |
| S-48 | GitHub | nut-tree/nut.js、libnut-core（2857★；2024-05；Node 原生模組） | https://github.com/nut-tree/nut.js | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README＋1 個檔 | 預建套件要付費訂閱 | 沒採用（D-03） |
| S-49 | GitHub | BlueM/cliclick（2031★；2025-08-23；Obj-C 命令列工具） | https://github.com/BlueM/cliclick | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README | 每個事件開一個行程，太慢 | 沒採用 |
| S-50 | GitHub | p0dalirius/RemoteMouse-3.008-Exploit（65★；2025-02-11；攻擊工具） | https://github.com/p0dalirius/RemoteMouse-3.008-Exploit | A2（GitHub 子代理）：GitHub API 搜尋或任務指定名單 | README | 沒有認證的按鍵注入＝RCE | D-04（威脅模型） |
| S-60 | App | Remote Mouse | https://apps.apple.com/us/app/remote-mouse/id385894596 ；https://www.remotemouse.net/ | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 部分滿足；有追蹤和廣告 | D-09 |
| S-61 | App | Unified Remote | https://apps.apple.com/us/app/unified-remote/id825534179 ；https://www.unifiedremote.com/ | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 部分滿足；$4.99 買斷、Data Not Collected | D-09 |
| S-62 | App | Mobile Mouse WIFI Remote＋Server | https://apps.apple.com/us/app/mobile-mouse/id289616509 ；https://apps.apple.com/us/app/mobile-mouse-server/id412814284?mt=12 | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 部分滿足 | D-09 |
| S-63 | App | Mobile Mouse Bluetooth Remote | https://apps.apple.com/us/app/-/id6749246683 | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 部分滿足；Mac 不用裝東西，但只能送按鍵、用不到手機注音 | D-06、D-09 |
| S-64 | App | Bluetouch | https://apps.apple.com/us/app/id1622635358 | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 不滿足；Mac 相容沒證實、有追蹤 | D-09 |
| S-65 | App | Tracepad | https://apps.apple.com/us/app/id1658454999 ；https://apps.apple.com/app/id1665418821 ；https://www.tracepad.site/（只讀到標題） | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 部分滿足（最接近）；明寫 any input method | D-09 |
| S-66 | App | Mouse · Keyboard（Remote Sunrise） | https://apps.apple.com/us/app/input-mouse-keyboard/id1515294700 | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 部分滿足；HTTPS、配對要核准、Data Not Collected | D-09 |
| S-67 | App | Remote KeyPad and NumPad Pro | https://apps.apple.com/us/app/remote-keypad-and-numpad-pro/id1135300319 | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 不滿足（只有數字鍵） | 沒用到 |
| S-68 | App | Remote Keyboard & Mouse（JIE WANG） | https://apps.apple.com/us/app/-/id6745342030 | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 部分滿足；有追蹤 | D-09 |
| S-69 | App | KDE Connect（App） | https://apps.apple.com/us/app/kde-connect/id1580245991 ；https://kdeconnect.kde.org/download.html | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 部分滿足（待驗證） | D-09 |
| S-70 | App | WiFi Mouse（Necta） | https://apps.apple.com/us/app/-/id629552573 | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 不滿足；2018 年後停更 | 沒用到 |
| S-71 | App | Remote for Mac（Aexol）＋CVE-2025-34089 | https://apps.apple.com/us/app/remote-for-mac/id1086962925 ；https://www.tenable.com/cve/CVE-2025-34089 | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 不滿足；未授權 RCE，CVSS 9.8 | D-04（威脅模型） |
| S-72 | App | Bluetooth Keyboard & Mouse（AppGround，Android） | https://appground.io/ | A3（產品子代理）：WebSearch 產品名＋App Store | App Store 頁／官網（WebFetch 萃取） | 部分滿足（只有 Android；只能送按鍵） | D-09 |
| S-73 | App | Keymote | （沒開官方頁） | A3（產品子代理）：WebSearch 產品名＋App Store | 僅搜尋摘要 | 僅搜尋摘要；推定已下架 | 沒用到 |
| S-80 | 官方文件 | Apple Support 118521：Use Mac Virtual Display with Apple Vision Pro | https://support.apple.com/en-us/118521 | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取）；writer 12:06 自己 WebFetch 核對相符 | 只認 Mac 本機或連在 Mac 上的鍵盤、觸控板、滑鼠；沒提到 iPhone 和虛擬鍵盤 | D-02、D-03 |
| S-81 | 官方文件 | Apple Vision Pro 使用手冊：Use Mac Virtual Display | https://support.apple.com/guide/apple-vision-pro/tan357ede966/visionos | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 共用指標；不能同時用 iPhone Mirroring | REPORT §4.2 |
| S-82 | 官方文件 | Vision Pro 使用手冊：藍牙配件 | https://support.apple.com/guide/apple-vision-pro/tanaa651a58d/visionos | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 沒說能操作 Mac Virtual Display | REPORT §4.2 |
| S-83 | 官方文件 | Vision Pro 使用手冊：虛擬鍵盤 | https://support.apple.com/guide/apple-vision-pro/tana14220eef/visionos | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 沒提到能打進 Mac | REPORT §4.2 |
| S-84 | 官方文件 | Apple Support 149067：visionOS 27 新功能 | https://support.apple.com/en-us/149067 | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 沒有新增輸入相關功能 | REPORT §4.2 |
| S-85 | 官方文件 | Apple Support 102459：Universal Control | https://support.apple.com/en-us/102459 | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 只支援 Mac 和 iPad | D-09 |
| S-86 | 官方文件 | Apple Support 120421：iPhone Mirroring | https://support.apple.com/en-us/120421 | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 方向相反 | D-09 |
| S-87 | 官方文件 | Apple Support 102597：Sidecar | https://support.apple.com/en-us/102597 | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 只支援 iPad | D-09 |
| S-88 | 官方文件 | Apple Support 118667：切換控制「使用其他裝置」 | https://support.apple.com/en-us/118667 | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 掃描式操作，不適合打字 | D-09 |
| S-89 | 官方文件 | Apple TV 使用手冊：用 iPhone 鍵盤輸入 | https://support.apple.com/guide/tv/atvb827791d6/tvos | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 只支援 Apple TV | D-09 |
| S-90 | 官方文件 | Apple Developer Forums 725238（另含 695844） | https://developer.apple.com/forums/thread/725238 | A3（產品子代理）：WebSearch（限 Apple 網域等） | 論壇討論串（萃取） | CoreBluetooth 擋 HID 0x1812 | D-01、D-02 |
| S-91 | 官方文件 | Mac 使用手冊：聽寫 | https://support.apple.com/guide/mac-help/mh40584/mac | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 可以從選單啟動、不用鍵盤 | README（備案） |
| S-92 | 官方文件 | macOS 功能支援頁 | https://www.apple.com/macos/feature-availability/ | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 聽寫支援華語（台灣） | README（備案） |
| S-93 | 官方文件 | Mac 使用手冊：輔助使用鍵盤 | https://support.apple.com/guide/mac-help/mchlc74c1c9f/mac | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 螢幕小鍵盤 | README（備案） |
| S-94 | 官方文件 | Apple Support 121932：Magic Trackpad 規格 | https://support.apple.com/en-us/121932 | A3（產品子代理）：WebSearch（限 Apple 網域等） | 官方頁（萃取） | 相容 Vision Pro 和 Mac | REPORT §4.3 |
| S-95 | 官方文件 | QMK 文件：Unicode | https://docs.qmk.fm/features/unicode | A3（產品子代理）：WebSearch（限 Apple 網域等） | 文件頁（萃取） | HID 鍵盤在 macOS 送 Unicode 要先改輸入來源 | D-06 |
| S-96 | 官方文件 | Apple Developer：CGEvent.keyboardSetUnicodeString(stringLength:unicodeString:) | sosumi MCP fetchAppleDocumentation | A2（GitHub 子代理）：查 Unicode 注入的長度上限 | 文件全文（MCP Markdown） | 沒寫長度上限；寫了 application frameworks may ignore the Unicode string | D-07 |
| S-97 | 產品（硬體） | Logitech K400 Plus | https://www.logitech.com/en-us/products/keyboards/k400-plus-touchpad-keyboard.920-007119.html | A3（產品子代理） | 官方產品頁（萃取） | 官方相容清單沒有 macOS | REPORT §4.3 |
| S-98 | 產品（硬體） | Twiddler 4 | https://mytwiddler.com（403） | A3（產品子代理） | 僅搜尋摘要 | 單手和弦鍵盤＋觸控板 | 沒用到 |
| S-99 | 產品（硬體） | Logitech K830 | （沒開官方頁） | A3（產品子代理） | 僅搜尋摘要 | 客廳鍵盤；已停產（多家零售商） | 沒用到 |
| S-100 | 官方文件 | Apple TN3179: Understanding local network privacy（2026-10-06 修訂） | https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy（sosumi MCP） | writer 12:32 自己查：README 需要寫的權限 | 全文 | 「Listening for and accepting incoming TCP connections」不需要區域網路權限；從終端機執行的命令列工具自動允許 | README 疑難排解、D-03 |

## v2（PKM-2）

編號接續 v1（S-101 起）。子代理 B2 的完整來源表在 `research/raw/v2-ios-keyboard.md`（K-01～K-27）；這裡列 writer 用到的部分，並記 writer 自己的抽查。

| 編號 | 類型 | 標題、作者、年份 | 網址或 DOI | 怎麼找到的 | 讀了多少 | 重點 | 用在哪 |
|---|---|---|---|---|---|---|---|
| S-101 | WebKit bug | 217754 Safe-area-inset-bottom still set when keyboard appears（2020） | https://bugs.webkit.org/show_bug.cgi?id=217754 | B2（K-01）；writer 14:53 curl 核對標題相符 | 標題（writer）；全文（B2） | 鍵盤出現時 safe-area-inset-bottom 仍保留 → 下方空白 | I-13 原因 (2)、D-14 |
| S-102 | WebKit bug | 259770 Implement the interactive-widget property in the viewport meta tag | https://bugs.webkit.org/show_bug.cgi?id=259770 | B2（K-02）；writer 14:53 curl 核對：實際標題是 "Implement the interactive-widget property…"，B2 寫成 "Support interactive-widget…"，內容一致 | 標題（writer）；全文（B2） | iOS 不支援 interactive-widget，鍵盤只縮 visual viewport | I-13、D-14 |
| S-103 | 官方部落格 | Chrome for Developers：Control viewport resize behavior | https://developer.chrome.com/blog/viewport-resize-behavior | B2（K-04） | 全文（B2） | Safari iOS：layout viewport 不動、只縮 visual viewport | tools/touch-area.mjs 的模擬方式 |
| S-104 | 開發者部落格 | Use Your Loaf：iPhone 14 Screen Sizes | https://useyourloaf.com/blog/iphone-14-screen-sizes/ | B2（K-09）；writer 14:53 curl 核對數字相符 | 全文（writer 抽數字） | iPhone 14 直向 safe-area 上 47／下 34；橫向 左右 47、下 21；14 Pro 直向上 59 | 重現與截圖的 safe-area 設定 |
| S-105 | 論壇 | Apple Developer Forums 800125（iOS 26 visualViewport 差 24 px） | https://developer.apple.com/forums/thread/800125 | B2（K-05） | 全文（B2） | 收鍵盤後 vv.height 可能和 innerHeight 差 24 px → 不能只靠高度判斷鍵盤，要配合 focus | D-14（鍵盤偵測） |
| S-106 | 資料 | iPhone 鍵盤高度（Codemia、Apple Wiki 等） | https://codemia.io/knowledge-hub/path/what_is_the_height_of_iphones_onscreen_keyboard | B2（K-08、K-10） | 全文／僅摘要 | **找不到新機型鍵盤高度的可靠數字**；只有舊的 216／162 pt。重現用的 336／380 px 是估計值，要 Ray 實機量 | tools/touch-area.mjs（標成估計） |
| S-107 | 媒體 | Macworld：iOS 13 三指編輯手勢 | https://www.macworld.com/article/3410596/ | B2（K-11） | 全文（B2） | iOS 三指左滑＝還原、右滑＝重做、捏合＝拷貝貼上；系統層級 | D-15 風險（三指手勢可能被 iOS 吃掉） |
| S-108 | 論壇 | Apple Developer Forums 121034：How to disable three finger tap | https://developer.apple.com/forums/thread/121034 | B2（K-12） | 第 1 頁（B2） | 原生 App 才能調 editingInteractionConfiguration；網頁沒有已證實的關閉方法 | D-15 風險 |
| S-109 | 論壇 | Apple Developer Forums 133248：Fullscreen API on non-video element | https://developer.apple.com/forums/thread/133248 | B2（K-19） | 第 1 頁（B2） | Apple 員工：任意元素全螢幕只有 iPadOS；17.2 beta 曾在 flag 後出現，後來又停用 | D-16 |
| S-110 | 相容表 | caniuse Fullscreen API | https://caniuse.com/fullscreen | B2（K-18） | 摘要（B2） | iOS Safari 12–27.2 列「Partial」（iPhone 只限 video） | D-16 |
| S-111 | 官方指南 | web.dev：PWA enhancements | https://web.dev/learn/pwa/enhancements | B2（K-21） | 全文（B2） | iOS 只支援 display: standalone；black-translucent 讓內容延伸到狀態列下 | D-16（建議加到主畫面） |
| S-112 | 文件 | MDN ScreenOrientation.lock() | https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock | B2（K-23、K-24） | 全文，相容表沒載入（B2） | 通常要全螢幕才能鎖方向；iOS 不支援 manifest orientation（僅摘要） | D-16（不鎖方向，兩個方向都做） |
| S-113 | 部落格 | pqina：Blocking navigation gestures on iOS Safari | https://pqina.nl/blog/blocking-navigation-gestures-on-ios-13-4/ | B2（K-25） | 全文（B2） | 邊緣 20 px 內的 touchstart 呼叫 preventDefault 可擋 Safari 分頁的左右滑返回；主畫面 App 不一定有效 | D-16（觸控板延伸到邊緣並 preventDefault） |
| S-114 | Apple 文件 | CGEventType（公開列舉，19 項） | https://developer.apple.com/documentation/coregraphics/cgeventtype | B1（G-01）；writer 14:55 用 sosumi 核對 | 全文（writer） | 公開的事件類型只有滑鼠、鍵盤、捲輪、平板和 tap 狀態，**沒有 gesture／swipe／magnify** | D-15 |
| S-115 | Apple 文件 | CGEventField（scrollWheelEventScrollPhase、MomentumPhase）、CGScrollPhase | https://developer.apple.com/documentation/coregraphics/cgeventfield | B1（G-02、G-03） | 全文（B1） | 捲動的 phase 欄位有列出但沒有說明文字 | D-15（雙指左右翻頁不靠 phase 實驗） |
| S-116 | Apple 文件 | NSEvent.EventType、isSwipeTrackingFromScrollEventsEnabled | https://developer.apple.com/documentation/appkit/nsevent/eventtype | B1（G-05、G-06） | 全文（B1） | .swipe／.magnify／.rotate 是接收端的類型，沒有建立它們的公開方法 | D-15 |
| S-117 | GitHub | SensibleSideButtons（archagon），約 2.1k★，pushed 2026-09-19，GPL-2.0 | https://github.com/archagon/sensible-side-buttons | B1（G-09） | README、檔案樹（B1；沒有 clone） | 用未公開的 CGEvent 欄位（type 29、field 110）合成翻頁手勢 → 私有 API | D-15（不採用） |
| S-118 | GitHub | Mac Mouse Fix（noah-nuebling），約 11.1k★，pushed 2026-10-23，自訂 MMF License | https://github.com/noah-nuebling/mac-mouse-fix | B1（G-10～G-12）；原始檔用 curl 讀 | 部分原始碼（B1） | 合成 Mission Control／切換空間／翻頁用私有欄位；註解說 macOS 27 起 CGEvent 欄位被忽略，改用私有 HIDEvent＋CGEventSetHIDEvent | D-15（不採用；證實「真手勢」只有私有路線） |
| S-119 | GitHub | yabai（asmvik），約 29.8k★，MIT；Hammerspoon hs.spaces | https://github.com/asmvik/yabai 、http://www.hammerspoon.org/docs/hs.spaces.html | B1（G-13～G-15） | README、文件（B1） | 切換空間要部分關閉 SIP 並注入 Dock，或用私有 API | D-15（不採用） |
| S-120 | Apple 支援 | Mission Control、在多個空間中工作 | https://support.apple.com/guide/mac-help/work-in-multiple-spaces-mh14112/mac | B1（G-23、G-24） | 全文（B1） | ⌃←／⌃→ 切換空間，⌃↑ Mission Control，⌃↓ 目前 App 的視窗 | D-15（預設對應） |
| S-121 | Apple 支援 | Take a screenshot on Mac | https://support.apple.com/guide/mac-help/take-a-screenshot-mh26782/mac | B1（G-27）；writer 14:55 curl 核對 support.apple.com/102646 有「Control-Shift-Command-3」存到剪貼簿的說明 | 全文 | ⇧⌘3 全螢幕、⇧⌘4 選取範圍、⇧⌘5 截圖工具；加 ⌃ 改存到剪貼簿 | 快捷鍵面板內建截圖組 |
| S-122 | 第三方 | MacMost：Mission Control tips（「移到左／右邊空間」可能要手動打開） | https://macmost.com/?p=34342 | B1（G-25） | 僅摘要 | Apple 頁沒有說 ⌃←／⌃→ 是否預設啟用；第三方說要自己勾 | D-15（Mac 端讀設定、提醒 Ray） |

| S-123 | 論壇 | Apple Developer Forums：Simulating Fn (Globe) + Arrow Key Events Ignoring Fn Modifier（Sequoia） | https://developer.apple.com/forums/thread/766200 | 19:00 搜 "CGEvent ctrl arrow switch space … SecondaryFn NumericPad" | 讀全文（回覆沒載入） | 作者用 `.cghidEventTap` 送 ⌃→，旗標 `[.maskSecondaryFn, .maskControl]`，結果「切換到下一個空間」（作者原本想要的是視窗拼貼）。表示 CGEvent 送的 ⌃→ 帶 Fn 旗標時，會觸發切換空間 | I-18、D-18 |
| S-124 | 論壇 | Keyboard Maestro Forum：Move windows between spaces not working anymore（peternlewis，2018-10-05） | https://forum.keyboardmaestro.com/t/move-windows-between-spaces-not-working-anymore/11710/7 | 同上搜尋 | 讀該則 | 模擬 ⌃數字切空間可以，模擬 ⌃←／⌃→ 不行，作者不知道原因。和 I-18 一致（數字鍵不帶 Fn 旗標、方向鍵帶） | I-18（旁證） |
| S-125 | 官方文件 | Apple：NSEvent.ModifierFlags.numericPad | https://developer.apple.com/documentation/appkit/nsevent/modifierflags-swift.struct/numericpad | sosumi | 讀全文 | 「A key in the numeric keypad or an arrow key has been pressed.」方向鍵本身就帶 numericPad 旗標 | I-18、KeyMap.intrinsicFlags |
| S-126 | 論壇 | Apple Community：MacBook Pro Mission Control Space switching shortcut issue（2026-07） | https://discussions.apple.com/thread/256323518 | 19:00 搜 "AppleSymbolicHotKeys 79 parameters" | 僅摘要 | 79（移到左邊的空間）的 parameters 格式是 (65535, 123, 修飾鍵值)；改 plist 會讓快速鍵失效，建議用系統設定改。預設值 8650752＝0x840000＝⌃＋Fn 是 writer 自己換算，沒有找到 Apple 文件 | D-18 選項 C（不做） |
| S-127 | 本機實驗 | writer：CoreGraphics 新建按鍵事件的預設旗標（只建立、不送進系統） | scratchpad/flags/flags.swift | 18:59 自己寫 | — | 方向鍵 0x20A00000（Fn＋數字鍵盤＋非合併）、Home／End／PgUp／PgDn／⌦／F1／F3 0x20800000、a／esc／return／tab／space 0x20000000；用 nil 和 hidSystemState 來源結果相同 | I-18、self-test 比對基準 |

## v3（PKM-3）

研究：2 個 Sonnet 子代理（00:23:12、00:23:25 開始，約 1 分鐘、1.5 分鐘完成），題目 B3「iOS Web Speech API」、B4「手機錄音＋HTTPS＋Mac 本機辨識」。下表的「來源」是子代理實際讀過的（它們標 primary／secondary）；writer 沒有逐筆重讀的會寫「子代理讀」。

| 編號 | 類型 | 來源 | 網址 | 怎麼找到 | 讀了多少 | 結論 | 用在 |
|---|---|---|---|---|---|---|---|
| S-128 | 本機唯讀 | writer：Mac mini 目前的輸入來源 | `defaults read com.apple.HIToolbox AppleSelectedInputSources` | 00:28 自己查 | — | `com.apple.inputmethod.TCIM.Zhuyin`（注音）→ CGInjector auto 模式每段文字都用剪貼簿＋⌘V | I-21 根本原因 (2) |
| S-129 | 本機實驗 | writer：v2（git archive HEAD 66cd355，mac/ 和 69a5626 相同）加新 self-test 項目 | scratchpad/v2-selftest、design/evidence/pkm31-selftest-before.txt | 00:36 自己做 | — | v2：⌫ 到 ⌘V 14.3 ms、連續貼上最短 28.8 ms、連續貼上後剪貼簿剩「二」（原本的內容不見）；新版全過 | I-21、D-23 |
| S-130 | 原始碼 | WebKit：SpeechRecognition.idl（`[SecureContext]`、`InterfaceName=webkitSpeechRecognition`） | https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/Modules/speech/SpeechRecognition.idl | 子代理 B3 | 子代理讀全文 | 介面標 SecureContext → http://…local 上 `webkitSpeechRecognition` 不存在 | PKM-3 語音鍵（D-25） |
| S-131 | Bug | WebKit Bugzilla 225298（2021-05-04 WebKit 工程師：「SpeechRecognition API is not available in SafariViewController and web apps added to Home Screen for now」，RESOLVED LATER；也說要開 Siri／聽寫） | https://bugs.webkit.org/show_bug.cgi?id=225298 | 子代理 B3 | 子代理讀 | 加入主畫面的 Web App 不能用 Web Speech；沒找到修好的版本 | D-25 |
| S-132 | 原始碼 | WebKit：WebSpeechRecognizerTask.mm、SpeechRecognitionPermissionManager.cpp、SpeechRecognitionErrorType.h | https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/Modules/speech/cocoa/WebSpeechRecognizerTask.mm | 子代理 B3 | 子代理讀 | lang 直接給 SFSpeechRecognizer（zh-TW、en-US 照傳），沒有自動判斷語言；有支援才用裝置上辨識，否則可能走 Apple 伺服器；錯誤 not-allowed／service-not-allowed 的觸發條件 | D-25、手機錯誤提示 |
| S-133 | 官方 | WebKit Blog：MediaRecorder API（iOS 14.3 起預設開啟、audio/mp4 AAC） | https://webkit.org/blog/11353/mediarecorder-api/ | 子代理 B4 | 子代理讀 | 手機錄音可行，但 getUserMedia 需要安全來源（MDN，子代理未直接讀） | D-25 方案 B |
| S-134 | 官方 | Apple 支援：信任手動安裝的憑證描述檔（設定 → 一般 → 關於本機 → 憑證信任設定） | https://support.apple.com/en-us/102390 | 子代理 B4 | 子代理讀 | Ray 自己裝描述檔＋打開完全信任的步驟 | D-25 HTTPS 選項、README |
| S-135 | 官方 | Apple 支援：398 天上限不影響使用者自行加入的根憑證 | https://support.apple.com/en-us/102028 | 子代理 B4 | 子代理讀 | 自簽根憑證簽出的伺服器憑證不受 398 天限制（825 天規則子代理憑記憶，未證實） | D-25 |
| S-136 | 官方 | Apple 文件：kSecImportToMemoryOnly（macOS 15.0+） | https://developer.apple.com/documentation/security/ksecimporttomemoryonly | 子代理 B4 | 子代理讀 | Mac 端可以不進鑰匙圈就載入 PKCS#12 身分（TLS 用） | D-25 HTTPS 選項 |
| S-137 | 官方 | Apple 文件：SFSpeechRecognizer.supportsOnDeviceRecognition、SpeechAnalyzer（macOS 26+） | https://developer.apple.com/documentation/speech/speechanalyzer | 子代理 B4 | 子代理讀 | Mac 本機辨識可行，但要語音辨識權限（Ray 同意）；zh-TW 是否支援裝置上辨識未證實 | D-25 方案 B |
| S-138 | 查不到 | iOS 鍵盤聽寫在 textarea 產生的 inputType／composition 事件 | （WebKit DictationCommand、W3C editing 討論串，子代理只找到線索） | 子代理 B3 第 8 題 | — | **沒有可靠來源**；I-21 的聽寫模型（刪詞＋插入較長版本）是 writer 的假設，用 Ray 兩個樣本逐字重現佐證；手機加輸入紀錄讓 Ray 錄真的事件 | I-21、D-22、D-24 |
| S-139 | 本機實驗 | writer：Apple SecTrust 是否遵守自建 CA 的 nameConstraints | scratchpad/nc/ | 01:08 自己做 | — | 自建 CA（permitted DNS:local、IP:192.168/16）簽 www.example.com：LibreSSL「permitted subtree violation」、Apple SecTrust 拒絕；同一張拿掉名稱限制的 CA → SecTrust 信任。結論：macOS 的 Apple 驗證遵守名稱限制（iOS 用同一套 Security 架構，推論同樣成立，未在 iPhone 實測）。www.apple.com 不能當對照（Apple 釘選） | D-27、self-test 7d、I-27 |

## v4（PKM-4）

這次沒有上網查資料，都是本機實驗和讀程式碼（sofapad 是 Ray 自己的公開 repo，限制解除後 clone 到本機唯讀）。

| 編號 | 類型 | 來源 | 網址 | 怎麼找到 | 讀了多少 | 結論 | 用在 |
|---|---|---|---|---|---|---|---|
| S-140 | 本機實驗 | `xcrun simctl help`（Xcode 27.1） | — | 02:12 自己查 | 全部子指令 | 沒有打字的指令（只有 openurl、pbcopy、spawn…）→ 要用 XCUITest | D-34 |
| S-141 | 本機實驗 | 沒有主 App 的 UI 測試套件（手寫 project.pbxproj＋scheme） | tools/pkm4/SimDriver | 02:13 自己做 | — | `build-for-testing` 成功，`XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")` 能操作 Safari；模擬器在 Mac 鎖定時也能跑；`defaults write -g AppleKeyboards` 在模擬器裡加注音鍵盤有效（三聲鍵的標籤是「三聲、」） | D-34、I-29 |
| S-142 | 本機實驗 | XCUITest `typeText` 一串字在 Safari textarea 產生的事件 | design/evidence/pkm4/switch-new-*.json 的 timing | 02:46 看量測 | — | 第一個字單獨一個事件，其餘大多合成一個（像聽寫），所以「連續打一串」會走 0.7 秒等待；量一般打字要一次一個鍵 | I-33 |
| S-143 | 本機實驗 | HID 閒置時間（`ioreg -c IOHIDSystem` HIDIdleTime）和自己送的 CGEvent | — | 02:45 | — | 送到 HID 層的模擬事件也會重設閒置時間 | I-32 |
| S-144 | 本機實驗 | TextEdit 未命名文件關閉時的對話框（AX 樹） | scratchpad/axclose.swift | 02:45 | — | 對話框是 AXSheet，「刪除」按鈕在它下面一層的群組裡 | I-31 |
| S-145 | 讀程式碼 | sofapad（Python v0.2）全部檔案和 process 紀錄 | https://github.com/rick-ray-wldd/sofapad （本機 clone） | 02:17 clone；子代理整理事實 | 全部 | 架構、功能、時間、問題的比較（docs/COMPARISON.md 的依據） | COMPARISON.md |
