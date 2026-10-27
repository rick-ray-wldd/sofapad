# PKM-1 學術文獻回顧：手機當 HMD／遠端螢幕的鍵盤＋觸控板，與躺姿／手臂疲勞

> 研究子代理產出。只列出「實際用 WebFetch 或 curl 打開過頁面」的論文；每篇標明實際打開的網址、找到方式、閱讀深度。
> 閱讀深度標記：**全文**＝讀了 PDF/HTML 正文（註明讀了哪些章節）；**僅摘要**＝只讀到摘要或書目頁。
> 數字只引用實際讀到的內容；標 ➕ 的是我方推論或補充，不是論文內容。
> PDF 的取得方式：WebFetch 對 PDF 只回傳二進位內容，所以改用 WebFetch 存下的檔案，或用 curl 下載到 scratchpad，再以 `pdftotext` 抽出文字閱讀。
> 「Phonaze (ISMAR 2026)」依指示不查證，過程中也沒有碰到。

---

## 主題一：手機作為頭戴顯示器（VR/AR/MR、Vision Pro）的輸入裝置

### 1. Exploring Smartphone-enabled Text Selection in AR-HMD
- **作者／年份／出處**：Rajkumar Darbar, Arnaud Prouzeau, Joan Odicio-Vilchez, Thibault Lainé, Martin Hachet；2021；Graphics Interface 2021（Article 14），DOI 10.20380/GI2021.14
- **實際打開**：https://graphicsinterface.org/wp-content/uploads/gi2021-14.pdf（WebFetch 存下 PDF，再用 pdftotext 閱讀）
- **怎麼找到**：第一個 WebSearch「smartphone as touchpad input for head-mounted display text entry VR paper」的結果中出現海報版，再搜尋「Darbar text selection AR-HMD smartphone input device continuous touch trackpad」找到 GI 全文。
- **閱讀深度**：**全文**。讀了 Abstract、Related Work（手持裝置＋大螢幕段落）、3.1 四種技術、3.2 實作（CD gain 公式與 Table 1）、4 Experiment（參與者、任務、程序）、5 Results、6 Discussion & Design Implications、Limitations、8 Conclusion。
- **重點**：比較四種用手機在 HoloLens 上選取文字的方法：Continuous Touch（把手機當觸控板）、Discrete Touch、Spatial Movement、Raycasting。Continuous Touch 的設計是相對映射、可以 clutch，加上 logistic CD gain（參數：CDMax 28.34、CDMin 0.0143、λ 36.71、V_inf 0.039，單位照論文所列）。實驗有 20 人參加，分析 19 人，全程站立、只用慣用手。結果：
  - **完成時間**：Continuous Touch 平均 5.16 s，比 Discrete Touch 的 8.78 s 快。
  - **錯誤率**：Continuous Touch 為 1.05，Raycasting 為 24.21。
  - **主觀評價**：Continuous Touch 的 NASA-TLX 體力需求最低、挫折感最低，也最受偏好。
  - **使用者回饋**：受試者 P17 說能「把手放低」所以比較舒服。另有人反映用 700 ms 長按切換模式很難掌握，也有人因為單手握大手機、怕手機掉下去而不敢快速滑動拇指。
- **對我們設計的啟示**：
  - 主要的游標模式就做「相對觸控板＋加速度曲線（logistic）」，CD gain 參數要可以調整。
  - 用雙擊或觸覺回饋標示「開始／結束選取」的狀態。
  - 不要用 700 ms 長按做模式切換，可改用明確的按鈕或雙擊。
  - 手放低來操作在躺姿下是優勢。
  - 要考慮單手握持手機的穩定性，例如提供防滑的握持區、讓按鈕集中在拇指根部附近。

### 2. PAIR: Phone as an Augmented Immersive Reality Controller
- **作者／年份／出處**：Arda Ege Unlu, Robert Xiao；2021；VRST '21（Tokyo）
- **實際打開**：專案頁 https://www.robertxiao.ca/research/pair-ar-controller/（WebFetch）；PDF https://robertxiao.ca/pubs/2021_VRST_ARPhone.pdf。PDF 超過 10 MB，WebFetch 失敗，改用 curl 下載後以 pdftotext 閱讀。
- **怎麼找到**：先憑既有印象，再用 WebSearch「PAIR Phone as an Augmented Immersive Reality controller Unlu Xiao VRST」確認。
- **閱讀深度**：**全文**。讀了 Abstract、Intro、Related Work（部分）、系統（追蹤、座標對齊、資料傳輸）、Interactions、Applications、Evaluation 結果、Discussion（Latency、Drift）。
- **重點**：
  - **系統設計**：用 HoloLens 加 iPhone（ARKit）做 6DoF 追蹤，再搭配手機的觸控、螢幕鍵盤文字輸入與震動回饋。
  - **網路通道**：位姿資料走 UDP（為了降低延遲）；觸控輸入、圖形資源與回饋指令走 TCP（為了可靠的雙向傳輸）。
  - **延遲**：WiFi 單向延遲最高約 25 ms，整體追蹤延遲約 150 ms；快速移動時誤差顯著較大，作者把原因指向延遲。
  - **追蹤誤差**：最終誤差 14.4 cm，只用 ARKit 時為 19.2 cm；行走條件下是 9.4 cm 對 20.4 cm。
  - **互動**：論文提出「3D trackpad」，也就是在手機上 pan 來移動虛擬物件。
- **對我們設計的啟示**：
  - 觸控事件與文字可以走可靠的 TCP 類通道，WebSocket 就符合這個條件。
  - 要盯緊端到端延遲預算，因為區網 WiFi 單向就可能到 25 ms。游標移動應該送高頻率的相對位移並合併封包，避免排隊造成延遲。
  - 手機本身的觸覺回饋有價值，但在網頁上能不能用要另外確認（見設計啟示總結）。

### 3. STAT: Subtle Typing Around the Thigh for Head-Mounted Displays
- **作者／年份／出處**：Jay Henderson, Jessy Ceha, Edward Lank；2020；MobileHCI '20，DOI 10.1145/3379503.3403549
- **實際打開**：ACM DL https://dl.acm.org/doi/10.1145/3379503.3403549 回傳 403；unpaywall 只回傳轉址。摘要改從 OpenAlex API 讀取：`https://api.openalex.org/works?search=STAT subtle typing around the thigh head-mounted displays`。
- **怎麼找到**：第一個 WebSearch 的結果；全文搜尋「"Subtle Typing Around the Thigh" … pdf」沒有找到公開 PDF。
- **閱讀深度**：**僅摘要**。
- **重點**：把手機螢幕放在大腿上，當作 HMD 的觸控打字面，支援點擊打字和 word-gesture（滑行）打字。研究做了實驗室實驗，也比較了手機放在口袋內和口袋外的打字，並提出設計建議。摘要沒有提供速度或錯誤率數字。
- **對我們設計的啟示**：把手機「靠在身體上」（大腿、腹部、胸口）來打字，在 HMD 情境下是可行的方向，正好符合沙發躺姿：手機可以平放在腿上或胸口，用來打字和操作觸控板。

### 4. BISHARE: Exploring Bidirectional Interactions Between Smartphones and Head-Mounted Augmented Reality
- **作者／年份／出處**：Fengyuan Zhu, Tovi Grossman；2020；CHI '20，DOI 10.1145/3313831.3376233
- **實際打開**：dblp https://dblp.dagstuhl.de/rec/conf/chi/ZhuG20.html 被 Anubis 擋下。摘要改從 OpenAlex API 讀取：`https://api.openalex.org/works?search=BISHARE bidirectional interactions smartphones head-mounted augmented reality`。
- **怎麼找到**：WebSearch「BISHARE bidirectional interactions between smartphones and head-mounted augmented reality Zhu Grossman CHI 2020」。
- **閱讀深度**：**僅摘要**。
- **重點**：提出手機與 AR HMD 的「雙向」跨裝置設計空間，同時探討 HMD 如何輔助手機任務、手機如何輔助 HMD 任務。論文有互動原型和 12 人使用者研究。
- **對我們設計的啟示**：手機不只是輸入面，也可以當輸出面。例如手機螢幕可以顯示剪貼簿、輸入預覽、快捷鍵列，Mac 端也可以回傳狀態，像目前的前景 App 或游標所在區域。這可以留作 v2 的雙向功能。

### 5. Phonetroller: Visual Representations of Fingers for Precise Touch Input with Mobile Phones in VR
- **作者／年份／出處**：Fabrice Matulic, Aditya Ganeshan, Hiroshi Fujiwara, Daniel Vogel；2021；CHI '21，DOI 10.1145/3411764.3445583（PFN 頁面上的標題寫作 "Phonetroller: Mobile Phones as VR Controllers with Visual Feedback of Fingers to Enable Precise Touch Input"）
- **實際打開**：tech.preferred.jp 頁面被 301 轉址到列表頁，沒有拿到內容。摘要改從 OpenAlex API 讀取：`https://api.openalex.org/works?search=Phonetroller mobile phones as VR controllers ...`。
- **怎麼找到**：在搜尋 PAIR 的 WebSearch 結果中出現。
- **閱讀深度**：**僅摘要**。
- **重點**：在全沉浸式 VR 中，使用者看不到手機和手，因此難以精準觸控。作者在手機上方加一面鏡子，讓前鏡頭拍到拇指，再疊上半透明的拇指影子，並用深度學習推估 hover 點。研究結論是這種回饋對「拇指大小」的目標有效。
- **對我們設計的啟示**：
  - 戴著 HMD 時「看不到或不想低頭看手機」是核心問題。Vision Pro 雖然有 passthrough，但使用者的視線在虛擬 Mac 螢幕上。
  - 觸控板與按鈕要設計成**不用看也能操作**：按鈕做到拇指大小以上、固定在螢幕邊緣，觸控板區要大。
  - ➕ 可以考慮在 Mac 畫面上疊一個「手指位置／觸控狀態」的小指示，取代低頭看手機。

### 6. Breaking the Screen: Interaction Across Touchscreen Boundaries in Virtual Reality for Mobile Knowledge Workers
- **作者／年份／出處**：Verena Biener, Daniel Schneider, Travis Gesslein, Alexander Otte, Bastian Kuth, Per Ola Kristensson, Eyal Ofek, Michel Pahud, Jens Grubert；2020；IEEE TVCG（arXiv 2008.04559），DOI 10.1109/TVCG.2020.3023567
- **實際打開**：https://arxiv.org/pdf/2008.04559（curl 下載後以 pdftotext 閱讀）
- **怎麼找到**：用 OpenAlex 搜尋 ARC-Pad 時，第二筆結果就是這篇；它的參考文獻 [69] 引用了 ARC-Pad。
- **閱讀深度**：**全文（部分）**。讀了 Abstract、Introduction、互動設計（bimanual CD gain、gaze-based 切換）、4.5 結果摘要、討論片段。沒有讀完整的 Applications 和 User Feedback 章節。
- **重點**：
  - **情境**：在 VR 裡用平板當觸控板，操作好幾個虛擬螢幕，動機是飛機座位這類「侷促空間、雙手放著」的情境。
  - **兩種 gain**：在單一螢幕內採 1:1 CD gain。非慣用手按住平板邊框（寬 2 cm）時，切換到「粗調 gain」，手指移動 2 cm 就跳到下一個螢幕。他們在 5 人非正式研究中比較 1／2／3 cm，2 cm 最快，5 人中有 3 人偏好。
  - **gaze 切換**：用視線切換螢幕比雙手方案快約 30%，SUS 也較高，除了 1 人之外都偏好 gaze。作者提到可以用 200–300 ms 的時間門檻避免誤觸，但實驗中沒有啟用；空間門檻設為視窗大小的 5%。
- **對我們設計的啟示**：
  - 「雙段 gain」值得直接借用：一般拖曳是精細 gain；按住某個修飾區（例如觸控板邊緣一條「快速帶」，或另一根手指按住）時切成粗調 gain，用來跨越 Mac Virtual Display 的超寬畫面。
  - Mac 端拿不到 Vision Pro 的視線資料，所以 gaze 切換無法直接複製；可以改用 ARC-Pad 式的絕對跳躍（見 #11）。

### 7. Smartphone-Based Input as a Practical Alternative for Object Manipulation in HMD-Based Immersive Environments
- **作者／年份／出處**：Yotaro Sasaki, Yoshitsugu Manabe, Noriko Yata（Chiba University）；2026；APMAR '26（第 18 屆 Asia-Pacific Workshop on Mixed and Augmented Reality，台北），CEUR Workshop Proceedings Vol-4267
- **實際打開**：https://ceur-ws.org/Vol-4267/paper1.pdf（curl 下載後以 pdftotext 閱讀）
- **怎麼找到**：第一個 WebSearch 的結果。
- **閱讀深度**：**全文（部分）**。讀了 Abstract、Introduction、3.2 Input Methods（含 Pointer 方法與兩種手機方法的共同設計）、4.1 Participants，並看過各節標題。5 Results 只讀到摘要層級的結論。
- **重點**：
  - **比較對象**：兩種手機方法（Gesture 是離散筆畫指令，Pointer 是觸控移動 HMD 中的游標）對比 Meta Quest Touch Plus 控制器和徒手追蹤，共 12 人，做 Selection、Translation、Rotation、Docking 四種任務。
  - **結果**：Pointer 的整體主觀評分與控制器沒有統計差異（p_holm = .1875）。兩種手機方法的工作負荷和對齊穩定性都顯著優於徒手追蹤，但因為要明確切換模式，完成時間較長。
  - **操作方式**：手機方法都是右手單手、用右拇指操作，並在 Selected、MoveStarted 等狀態變化時給震動回饋，讓使用者不用一直看手機。
- **對我們設計的啟示**：
  - 手機 Pointer 與專用控制器的主觀評價相當，支持「單手拇指觸控板」這個方向。
  - 模式切換會讓速度變慢，所以拖曳、捲動要盡量做成免模式切換的手勢。
  - 每個狀態變化都要給不需要視覺的回饋。

### 8. SwEYEpinch: Exploring Intuitive, Efficient Text Entry for Extended Reality via Eye and Hand Tracking
- **作者／年份／出處**：Ziheng Li, Xichen He, Mengyuan Wu, Zeyi Tong, Haowen Wei, Benjamin Yang, Steven Feiner, Paul Sajda；2026；CHI '26，DOI 10.1145/3772318.3791820（arXiv 2604.03520）
- **實際打開**：https://www.cs.columbia.edu/~benyang/papers/sweyepinch.html（WebFetch）、https://arxiv.org/abs/2604.03520（WebFetch），全文 https://arxiv.org/pdf/2604.03520（curl 加 pdftotext）
- **怎麼找到**：WebSearch「Apple Vision Pro user study text entry or productivity arXiv 2024 2025 gaze pinch keyboard fatigue」。
- **閱讀深度**：**全文（部分）**。讀了 Abstract、Introduction 與 Related Work 的 XR 打字速度段落、Apparatus、User Study 1 的參與者與結果段落。沒有細讀 US2、US3 和 Discussion。
- **重點**：
  - **實驗設置**：用 Varjo XR-3 加 Ultraleap（不是 Vision Pro 實機），比較商用頭戴的兩種打字方式：Finger-Tap（Quest／HoloLens 風格）和 Gaze&Pinch（Vision Pro 風格，每個鍵都要看加捏）。
  - **US1 結果**：40 人，到第 5 個 session 時，SwEYEpinch-Basic 為 22.50 WPM，Finger-Tap 為 18.01 WPM，Gaze&Pinch 只有 10.01 WPM。
  - **長期訓練**：連續 7 天、30 個 session 後，SwEYEpinch 最高可達 64.7 WPM。
  - **Related Work 引述**：XR 空中打字常見約 15–17 WPM、約 11% 總錯誤率，並伴隨抬肩造成的疲勞。
- **對我們設計的啟示**：Vision Pro 原生的「看加捏」逐鍵輸入很慢，在這個研究的設置下約 10 WPM，空中點擊也會累手。這直接支持用**手機原生鍵盤與 IME（含中文輸入法）**打字、把「已確定的文字」送到 Mac 的方向，也就是本專案的核心假設。

---

## 主題二：手機當觸控板／間接指向（大螢幕、遠端顯示），以及單手拇指操作

### 9. The Impact of Control-Display Gain on User Performance in Pointing Tasks
- **作者／年份／出處**：Géry Casiez, Daniel Vogel, Ravin Balakrishnan, Andy Cockburn；2008；Human–Computer Interaction 23(3): 215–250，DOI 10.1080/07370020802278163
- **實際打開**：https://Www.Gwern.net/doc/design/2008-casiez.pdf（WebFetch 存下 PDF，再用 pdftotext 閱讀）
- **怎麼找到**：WebSearch「Casiez Vogel Balakrishnan Cockburn impact of control-display gain user performance pointing tasks hal pdf」。
- **閱讀深度**：**全文（部分）**。讀了 Abstract、目錄、4 Experiment 1（Apparatus、Task、Participants、Design）、6 Conclusions（6.1 Gain Level、6.2 Pointer Acceleration vs Constant Gain）。Experiment 2 的方法細節沒有細讀。
- **重點**：
  - **低 gain 的代價**：低 CD gain 會明顯拖累表現，主因是 clutch 次數和肢體速度上限（約 1.5 m/s）。在超大螢幕上，clutch 讓移動時間最多增加 124%（clutch 比例 24%）。
  - **高 gain 影響小**：3 人的先導實驗中，gain 超過 16 之後移動時間幾乎不再變化，只有非常小的目標會稍微變慢。
  - **加速度比固定 gain 好**：pointer acceleration 比 constant gain 快 3.3%，小目標快到 5.6%。作者建議以 PA 作為基準。
  - **可用 gain 範圍**：作者給出公式。最小 gain 為 CD_min = D_max / OR_max，作業範圍 OR_max 建議不超過 30 cm。最大 gain 受人手精度（約 0.2 mm）和裝置量化限制，CD_max = min(Mouse_res/Screen_res, W_min/Hand_res)。
- **對我們設計的啟示**：
  - ➕ 推算（假設值，不是論文數據）：假設拇指一次滑動大約 40 mm，Mac Virtual Display 寬 5120 px，最小目標約 10 px。那麼 CD_min ≈ 5120/40 ≈ 128 px/mm，而 CD_max ≈ 10 px / 0.2 mm = 50 px/mm。CD_min 大於 CD_max，代表**任何固定 gain 都無法同時兼顧「一次滑過整個螢幕」和「點得準」**。
  - 結論是必須用速度相關的加速度曲線，再加上 clutch 或絕對跳躍。

### 10. No more bricolage! Methods and tools to characterize, replicate and compare pointing transfer functions
- **作者／年份／出處**：Géry Casiez, Nicolas Roussel；2011；UIST '11，pp. 603–614，DOI 10.1145/2047196.2047276
- **實際打開**：lilloa.univ-lille.fr 回傳 404；HAL（inria-00635397/document）回傳 HTML 而不是 PDF。摘要改從 OpenAlex 讀取：https://api.openalex.org/works/doi:10.1145/2047196.2047276
- **怎麼找到**：WebSearch「Casiez Roussel "No more bricolage" pointing transfer functions touchpad OS X Windows libpointing」。
- **閱讀深度**：**僅摘要**。
- **重點**：作者用 EchoMouse 量測並重現 Windows、OS X、Xorg 的預設 transfer function（工具為 libpointing）。這些預設函數比無單位的固定 CD gain 最多提升 24% 的表現。OS X 的函數對小目標較有利，但對大目標最多比 Windows／Xorg 慢 9%。
- **對我們設計的啟示**：
  - 不要用固定 gain。可以直接參考作業系統等級的加速度曲線；libpointing 有公開的實作可參考，是否適用要另外確認。
  - ➕ 待驗證：如果 Mac 端用「設定絕對座標」的方式注入游標事件，macOS 自己的加速度可能不會套用，就得在手機端或伺服器端自己實作曲線。

### 11. ARC-Pad: Absolute+Relative Cursor Positioning for Large Displays with a Mobile Touchscreen（附碩士論文）
- **作者／年份／出處**：David C. McCallum, Pourang Irani；2009；UIST '09，pp. 153–156，DOI 10.1145/1622176.1622205。另附 McCallum 的碩士論文 "ARC-Pad: a mobile device for efficient cursor control on large displays"（University of Manitoba，2012）。
- **實際打開**：
  - 論文頁 https://hci.cs.umanitoba.ca/Publications/details/arc-pad-… 連線被拒（ECONNREFUSED／逾時），論文摘要改從 OpenAlex 讀取：`https://api.openalex.org/works?search=ARC-Pad absolute+relative cursor positioning ...`。
  - 碩士論文先抓 https://mspace.lib.umanitoba.ca/items/<id>/full（curl），再從頁面中的 citation_pdf_url 下載 https://mspace.lib.umanitoba.ca/bitstreams/<id>/download。
- **怎麼找到**：WebSearch「ARC-Pad absolute relative cursor positioning large displays mobile touchscreen McCallum Irani」。
- **閱讀深度**：UIST 論文**僅摘要**；碩士論文**全文（部分）**，讀了 Chapter 4（ARC-Pad、Relative／Absolute Input、Implementation、Experiment One 與結果、討論）和 Chapter 5 的 5.1 Cursor Acceleration、5.2 Hardware、5.4 Multitouch。
- **重點**：
  - **基本機制**：在手機觸控螢幕上「快速點一下」，游標就**絕對跳躍**到大螢幕上對應的位置；「滑動」時則是相對移動，套用 Windows XP 的加速度曲線。兩者不需要明確切換模式。
  - **點擊或滑動的判斷**：按下 300 ms 內放開，且移動小於 0.35 cm，就算 tap 並觸發跳躍；否則進入 tracking。
  - **實驗**：9 人，在 52 吋電視（1360×768）上，平均目標選取時間是 ARC-Pad 2.623 s 對純加速度 2.789 s。距離在 937 px 以上時優勢明顯，使用者在跳躍後也能追得上游標。
  - **改版**：後來的 iPod touch 版改成用「第二或第三根手指點一下」來觸發左鍵或右鍵點擊。先導研究中，最高的加速度等級完成時間最短，錯誤率也沒有顯著上升。
- **對我們設計的啟示**：
  - 針對 Vision Pro 超寬 Mac 虛擬螢幕的「長距離移動」問題，絕對跳躍是很有吸引力的解法。
  - 但在**單手拇指**操作下，「tap = 跳躍」會和「tap = 點擊」衝突，而單手很難用第二根手指點擊。➕ 建議改成在觸控板旁放一塊「迷你地圖區」專門負責絕對跳躍，主觸控板維持「點一下 = 左鍵」。
  - 300 ms 加 0.35 cm 可以直接當 tap 與 drag 的判斷門檻起始值。
  - 加速度可以設得積極一些。

### 12. Scroll, Tilt or Move It: Using Mobile Phones to Continuously Control Pointers on Large Public Displays
- **作者／年份／出處**：Sebastian Boring, Marko Jurmu, Andreas Butz；2009；OZCHI '09，pp. 161–168，DOI 10.1145/1738826.1738853
- **實際打開**：https://www.medien.informatik.uni-muenchen.de/pubdb/publications/pub/boring2009ozchi/boring2009ozchi.pdf（curl 下載後以 pdftotext 閱讀）
- **怎麼找到**：WebSearch「Boring "Scroll, Tilt or Move It" mobile phones continuously control pointers large public displays pdf」。
- **閱讀深度**：**全文**。讀了 Abstract、Introduction、Related Work（片段）、Interaction Techniques（片段）、Experimental Evaluation、Results and Discussion（時間、錯誤率、主觀評分、觀察）、Discussion。
- **重點**：12 人，用 Nokia N95 比較三種方式：Scroll（搖桿）、Tilt（傾斜，也就是速率控制）、Move（光流，也就是位置控制）。
  - **速度**：在 48 與 72 px 的目標上，Move 平均 1401 ms、Tilt 1868 ms、Scroll 2023 ms，Move 比 Scroll 快 31%。
  - **錯誤率**：Move 在長距離、24 px 目標上的錯誤率高達 46%。原因是**按下或放開選取鍵時手機會晃動**，游標跟著跑掉。Tilt 的錯誤主要來自 overshoot。
  - **作者建議**：按下與放開時暫停動作偵測。
  - **疲勞**：只轉手腕可以減輕 gorilla arm，把手臂靠在身上則能提高準確度。Scroll 沒有肩、臂、腕疲勞，但手指疲勞較高。
- **對我們設計的啟示**：
  - **不要把傾斜或空中滑鼠當主要指向方式**，因為錯誤率高、會 overshoot，躺著時更不穩定。
  - 點擊時要「凍結游標」：觸控按下後的短時間內忽略小位移，放開時也一樣。
  - 鼓勵把手臂或手機靠在身體上操作。

### 13. Modeling the Functional Area of the Thumb on Mobile Touchscreen Surfaces
- **作者／年份／出處**：Joanna Bergström-Lehtovirta（OpenAlex 寫作 Bergström）, Antti Oulasvirta；2014；CHI '14，pp. 1991–2000，DOI 10.1145/2556288.2557354
- **實際打開**：OpenAlex API 搜尋結果 `https://api.openalex.org/works?search=Modeling the functional area of the thumb on mobile touchscreen surfaces`（只有摘要）；兩次 WebSearch 都沒有找到公開 PDF。
- **怎麼找到**：WebSearch「Bergstrom-Lehtovirta Oulasvirta modeling functional area of the thumb mobile touchscreen CHI 2014 pdf」。
- **閱讀深度**：**僅摘要**。
- **重點**：作者從握持手的運動學推導出一個二次式模型，預測單手握持時拇指能觸及的「功能區域」。模型在 20 名參與者的拇指軌跡上擬合良好。模型的輸入有三個：螢幕尺寸、手的大小、食指在機背的位置；也可以反推某個版面預設的握法。
- **對我們設計的啟示**：
  - 橫向單手握持時，拇指只碰得到螢幕的一部分，而且可及範圍會隨握法和手的大小改變。
  - 點擊、右鍵、捲動按鈕應該放在拇指根部附近的弧形區域。
  - 提供左右手鏡像，以及「拖曳調整按鈕位置／觸控板大小」的校準功能。

---

## 主題三：躺姿／半躺／沙發使用的人因與手臂疲勞

### 14. Consumed Endurance: A Metric to Quantify Arm Fatigue of Mid-Air Interactions
- **作者／年份／出處**：Juan David Hincapié-Ramos, Xiang Guo, Paymahn Moghadasian, Pourang Irani；2014；CHI '14，pp. 1063–1072，DOI 10.1145/2556288.2557130
- **實際打開**：三個全文鏡像 https://www.lri.fr/~anab/teaching/evaluation/papers/consumed-endurance.pdf、https://s159.ok.ubc.ca/uploads/8d3a3004-…pdf、hci.cs.umanitoba.ca 都連線被拒或逾時（WebFetch 和 curl 都試過）。摘要改從 OpenAlex 讀取：https://api.openalex.org/works/doi:10.1145/2556288.2557130
- **怎麼找到**：WebSearch「Consumed Endurance metric arm fatigue mid-air interactions Hincapié-Ramos CHI 2014 pdf」。
- **閱讀深度**：**僅摘要**。
- **重點**：提出 Consumed Endurance（CE）指標來量化 gorilla-arm 效應，依據是上臂的生物力學結構。CE 可以用現成的攝影機骨架追蹤非侵入式量測，且和 Borg CR10 主觀費力量表有強相關。論文也提出一系列「省力的空中介面」設計準則，但我沒有讀到內文。
- **對我們設計的啟示**：疲勞主要來自手臂舉起時肩關節承受的力矩。我們的設計目標是**讓手臂完全不必懸空**：手機放在腿上或胸口，手肘有支撐。這樣理論上 CE 接近零，比 Vision Pro 的空中點擊或手勢有本質上的優勢。

### 15. Modeling Cumulative Arm Fatigue in Mid-Air Interaction based on Perceived Exertion and Kinetics of Arm Motion
- **作者／年份／出處**：Sujin Jang, Wolfgang Stuerzlinger, Satyajit Ambike, Karthik Ramani；2017；CHI '17，DOI 10.1145/3025453.3025523
- **實際打開**：OpenAlex API 搜尋結果 `https://api.openalex.org/works?search=Consumed endurance metric quantify arm fatigue mid-air interactions` 的第二筆（只有摘要）。
- **怎麼找到**：用 OpenAlex 搜尋 CE 時一併出現；Darbar 等人的論文參考文獻 [31] 也引用了它。
- **閱讀深度**：**僅摘要**。
- **重點**：作者提出用空中指向任務估計個人最大肩部力矩的簡易方法，結果與直接的力量量測一致。他們再結合主觀與生物力學量測，建立「累積主觀疲勞」模型，並用交叉驗證與既有指標比較。
- **對我們設計的啟示**：疲勞會「累積」，長時間的沙發工作需要按整段使用時間來評估。➕ 如果日後要做使用者測試，可以用 Borg CR10 每隔一段時間記錄，比較「手機觸控板」和「Vision Pro 原生手勢」。

### 16. NICER: A New and Improved Consumed Endurance and Recovery Metric to Quantify Muscle Fatigue of Mid-Air Interactions
- **作者／年份／出處**：Yi Li, Benjamin Tag, Shaozhang Dai, Robert Crowther, Tim Dwyer, Pourang Irani, Barrett Ens；2024；ACM TOG（SIGGRAPH），DOI 10.1145/3658230（arXiv 2406.08875）
- **實際打開**：https://arxiv.org/html/2406.08875v1（WebFetch）
- **怎麼找到**：在搜尋 CE 的 WebSearch 結果中出現。
- **閱讀深度**：**全文（部分）**。讀了 Abstract、1 Introduction、2 Related Work、3 NICER（3.1–3.4）、4 Study 1、5 Study 2、6 Study 3 到 6.3 前段。第 7、8 章和附錄沒有讀（頁面截斷）。
- **重點**：
  - **CE 的問題**：只依力矩估計，所以把高於與低於 90° 視為同樣費力，但 EMG 和主觀資料都不支持這點。低強度任務（低於最大力量約 15%）時，CE 預測的耐力時間會趨近無限，而且 CE 不考慮休息時的恢復。
  - **NICER 的改良**：加入肩部專用的耐力時間函數、90° 以上的修正項、Chaffin 力量模型，以及每秒 0.04 的恢復因子。
  - **Study 1**：24 人，45° 到 135° 外展。四條肌肉中有三條在 90° 以上疲勞得更快。
  - **Study 3**：NICER 與 Borg CR10 的相關係數為 0.978／0.976，CF 模型為 0.966／0.923。原始 CE 在這類低強度空中任務上無法給出預測。
- **對我們設計的啟示**：手臂高於肩膀最累，休息確實能恢復。躺在沙發上時，如果手機舉在臉前打字，前臂和肩膀仍然在出力。➕ 建議 UI 支援「手機平放、螢幕朝上、手腕靠著」的操作方式（橫向觸控板加大按鈕），不要要求使用者把手機舉到眼前。

### 17. Design Principles & Issues for Gaze and Pinch Interaction
- **作者／年份／出處**：Ken Pfeuffer（Aarhus University）；2024-01-18；arXiv 2401.10948。這是作者的觀點文章；同主題的期刊版是 Pfeuffer & Gellersen 2024 年發表於 IEEE CG&A 的 "Design Principles and Challenges for Gaze + Pinch Interaction in XR"，那篇我**沒有打開**。
- **實際打開**：https://arxiv.org/pdf/2401.10948（WebFetch 存下 PDF，再用 pdftotext 閱讀）
- **怎麼找到**：WebSearch「"Gaze + Pinch" interaction XR design principles challenges Pfeuffer Apple Vision Pro arXiv」。
- **閱讀深度**：**全文**（6 頁短文）。讀了 5 個 Design Principles、5 個 Issues、Summary、Further material。
- **重點**：
  - **定位**：Vision Pro 讓「看加捏」這種互動普及。原則一是分工：眼睛負責選擇，手負責操作，因為用視線指向，手幾乎不用移動，可以減少體力疲勞；手「可以放在任何地方」。
  - **已知問題**：
    - 時序：眼睛可能在捏之前就離開目標（late trigger），或在視線落到目標前就捏下（early trigger）。作者建議用最後一次穩定注視（約 200–300 ms）作為目標。
    - 遠距拖曳：1:1 映射會感覺太慢，需要依距離放大 transfer function。
    - 拖放序列：放下物件後視線移開，要再找回來很麻煩。
- **對我們設計的啟示**：
  - Vision Pro 的看加捏本身對手臂很友善，但它控制的是 visionOS 的視窗。Mac Virtual Display 裡的游標和文字輸入仍然需要我們的手機方案。
  - Pfeuffer 指出的遠距拖曳 CD ratio 問題，也提醒我們手機觸控板在超寬虛擬螢幕上需要加速度（呼應 #9、#11）。
  - ➕ 兩套系統並存時，要避免「看加捏」和手機觸控同時觸發，造成意外點擊。

### 18. Quantifying the Effects of Working in VR for One Week
- **作者／年份／出處**：Verena Biener, Snehanjali Kalamkar, Negar Nouri, Eyal Ofek, Michel Pahud, John J. Dudley, Jinghui Hu, Per Ola Kristensson, Maheshya Weerasinghe, Klen Čopič Pucihar, Matjaž Kljun, Stephan Streuber, Jens Grubert；2022；IEEE TVCG／ISMAR 2022（arXiv 2206.03189）
- **實際打開**：https://arxiv.org/pdf/2206.03189（curl 下載後以 pdftotext 閱讀）
- **怎麼找到**：WebSearch「Biener quantifying effects of working in VR for one week arXiv」。
- **閱讀深度**：**全文（部分）**。讀了 Abstract、Introduction（主要發現列表）、Apparatus、Typing Speed 結果、參與者事後回饋片段。其餘量表的細部結果沒有逐一讀。
- **重點**：
  - **設置**：16 人在 VR 中工作 5 天、每天 8 小時，對照實體桌面。VR 端用 Oculus Quest 2 加 Logitech K830（內建觸控板的實體鍵盤）。
  - **主觀負擔**：VR 的任務負荷高約 35%、挫折高 42%、眼睛疲勞高 48%，SUS 低 36%。第一天就有 2 人因偏頭痛、噁心、焦慮退出。
  - **打字速度**：VR 43.09 WPM，實體 46.88 WPM。第 5 天比第 1 天快，兩種條件皆然。
  - **事後回饋**：有一位參與者回報脖子和肩膀僵硬。
- **對我們設計的啟示**：HMD 長時間工作本身就有眼睛和頸肩負擔，所以輸入方式應盡量**降低額外負擔**：不舉手、不需頻繁低頭找按鍵。另一個觀察是，把「實體觸控板加鍵盤」帶進 VR 時，打字速度只小幅下降，這支持「熟悉的輸入裝置」策略；手機原生鍵盤同樣是使用者最熟悉的輸入方式。

### 19. Investigating the Effects of Position and Angle of Virtual Keyboard on Text Entry Performance and Workload
- **作者／年份／出處**：Koki Tominaga, Shun Fujita, Rei Takakura, Buntarou Shizuki；2021；Asian CHI Symposium 2021（3 頁海報），DOI 10.1145/3429360.3468174
- **實際打開**：https://www.iplab.cs.tsukuba.ac.jp/paper/poster/tominaga_AsianCHI2021.pdf（WebFetch 存下 PDF，再用 pdftotext 閱讀）
- **怎麼找到**：WebSearch「virtual reality interaction reclined or lying posture user study comfort arm fatigue head-mounted display bed」。
- **閱讀深度**：**全文**。讀了 Abstract、Introduction、User Study、Result、Discussion。
- **重點**：18 人，用 HTC VIVE 加 Leap Motion，站姿空中點擊虛擬鍵盤，鍵盤俯角 θ 為 0°、22.5°、45°。
  - 平均 19.3 WPM。
  - θ 對 WPM 和錯誤率沒有影響，但加權工作負荷（WWL）在 0° 與 45° 之間有顯著差異。
  - **鍵盤越高，上臂越累；越低，脖子越累。**
- **對我們設計的啟示**：「手臂高度」和「低頭角度」是一組取捨。躺姿使用手機時也一樣：手機舉高，手臂累；手機放低到胸口或腹部，需要低頭看。所以介面應該**盡量不用低頭看**（大按鈕、固定位置、Mac 端回顯），讓手機可以放在低處。

### 20. Investigating the Impact of Lying Postures on Mixed Reality Interaction
- **作者／年份／出處**：Yujin Jeong, Jiwon Lee, Jae Yeop Jeong, Euna Byun, Hyeok Ju Ko, Jin Woo Jeong（Seoul National University of Science and Technology）；2026；CHI '26 Extended Abstracts（Article 412），DOI 10.1145/3772363.3798467
- **實際打開**：https://pure.seoultech.ac.kr/en/publications/investigating-the-impact-of-lying-postures-on-mixed-reality-inter/（WebFetch）
- **怎麼找到**：WebSearch「text entry virtual reality while lying down supine reclined posture study」。
- **閱讀深度**：**僅摘要**（頁面上只有摘要，沒有效果量）。
- **重點**：作者指出，越來越多人躺著使用 MR 頭戴。研究找 18 人，在仰臥、左側臥、右側臥三種姿勢下做 3D 操作與指向任務，發現不同躺姿之間的表現和舒適度有顯著差異，並主張需要「隨姿勢調整的介面」。
- **對我們設計的啟示**：躺姿會改變使用表現。手機 UI 應該能快速切換握持方向與左右手配置，例如側躺時改用另一隻手、觸控板換邊；也要能鎖定螢幕方向，避免側躺時畫面自動旋轉。

### 21. Exploring Sensory Conflict Effect Due to Upright Redirection While Using VR in Reclining & Lying Positions（附續作 Exploring Locomotion Methods with Upright Redirected Views for VR Users in Reclining & Lying Positions）
- **作者／年份／出處**：
  - 2022 年版：Tianren Luo, Zhenxuan He, Chenyang Cai, Teng Han, Zhigeng Pan, Feng Tian；UIST '22，DOI 10.1145/3526113.3545692。
  - 續作：Tianren Luo, Chenyang Cai, Yiwen Zhao, Yachun Fan, Zhigeng Pan, Teng Han, Feng Tian；2023；UIST '23，DOI 10.1145/3586183.3606714。
- **實際打開**：
  - https://faculty.nwu.edu.cn/luotianren/en/lwcg/210244/content/18337.htm（WebFetch，只有書目）。
  - 兩篇的摘要改從 OpenAlex 讀取：https://api.openalex.org/works/doi:10.1145/3586183.3606714，以及 `https://api.openalex.org/works?search=Exploring sensory conflict effect due to upright redirection ...`。
  - paper.nweon.com 的 DNS 解析失敗。
- **怎麼找到**：WebSearch「virtual reality interaction reclined or lying posture …」先找到 2023 續作，再以「Luo "Exploring Locomotion Methods …" arXiv」找到作者頁與 2022 前作。
- **閱讀深度**：兩篇都**僅摘要**。
- **重點**：
  - **2022**：在半躺或躺著使用 VR 時，視角會往上，系統必須把畫面「扶正」（upright redirection）。這會造成視覺、前庭、本體感覺之間的衝突，帶來暈動症、自我感混淆、空間知覺偏差，**45° 半躺時最嚴重**。
  - **2023**：探討半躺或躺姿下的移動方式（tap 手勢、轉椅手勢），同樣是 45° 時表現最差，作者並提出改良方法。
- **對我們設計的啟示**：➕ 沙發半躺通常接近 30–45°，正好落在最差的區間。這組研究談的是 VR 世界的扶正，但對 Mac Virtual Display 來說，意思是虛擬螢幕的擺放角度應該配合仰角，不要強迫使用者在半躺時看一塊「直立」的螢幕。這屬於 visionOS 視窗擺放的問題，可以寫進使用指南。輸入端則要能在各種仰角下使用，不要依賴手機的方向感測。

### 22. Differences in neck muscle activity according to lying positions using a smartphone
- **作者／年份／出處**：Ahn SH, Jung SH, Kim HA, Kim JH, Weon YS, Kwon OY；2022；Journal of Back and Musculoskeletal Rehabilitation（35(2)），DOI 10.3233/BMR-200315，PMID 34334376
- **實際打開**：content.iospress.com 和 journals.sagepub.com 都回傳 403；PubMed 需要 cookie。摘要改從 Europe PMC REST API 讀取：`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=TITLE:"neck muscle activity" AND TITLE:"lying positions" AND TITLE:smartphone&format=json&resultType=core`。
- **怎麼找到**：WebSearch「smartphone use lying supine posture neck flexion muscle activity study ergonomics」，再搜尋「pubmed neck muscle activity four lying positions smartphone …」。
- **閱讀深度**：**僅摘要**。
- **重點**：23 名健康年輕受試者（22.4 ± 1.7 歲）在四種躺姿下用手機看影片：仰臥（SUP）、俯臥撐肘（PE）、側臥（SIDE）、側臥轉頭 45°（45-SIDE）。研究量測左右兩側的 SCM、前斜角肌、頸豎脊肌、上斜方肌。結論是**仰臥時頸部肌肉活動與左右不對稱最低**。
- **對我們設計的啟示**：如果要長時間在沙發上工作，仰臥或半仰臥、頭部有支撐，是頸部負擔較小的姿勢；側臥和俯臥撐肘較差。手機 UI 應以「仰躺、手機放在胸前或腹部」為主要情境設計，同時支援側臥時的單手鏡像配置。

---

## 打開過但資訊不足或不納入的頁面（透明記錄）
- **TrackCap**（Mohr et al., CHI 2019, DOI 10.1145/3290605.3300815）：https://realities.fh-salzburg.ac.at/publications/trackcap 只有書目，頁面寫明「Abstract not available」，所以不列為論文條目。PAIR 的 Related Work 提到它用手機前鏡頭追蹤。
- **Evaluating Text Input Methods on the Apple Vision Pro: A Comparison of Tap Typing and Gaze + Pinch**（Arnold, Epperson, Chaparro, HFES 2025, DOI 10.1177/10711813251367736）：https://portfolio.erau.edu/en/publications/evaluating-text-input-methods-on-the-apple-vision-pro-a-compariso/ 頁面沒有摘要，**沒有讀到任何結果數字**。這是唯一的 Vision Pro 實機打字研究線索，值得母 session 視需要再追查。
- **PMC9869316**（Heidary Torkamani et al., BMC Musculoskeletal Disorders 2023）：內容是手機成癮與頸部姿勢，和躺姿使用無關，不納入。
- **其他連線失敗**：dblp（被 Anubis 擋）、ACM DL（403）、UXPA Choi 2016 smart TV 打字（回傳 HTML 而不是 PDF）、HAL inria-00635397（回傳 HTML）。
- **文獻缺口**：搜尋「Chinese text entry virtual reality pinyin … smartphone」只找到專利，**沒有找到**探討「用手機中文輸入法為 HMD 輸入」的學術論文。

---

## 設計啟示總結

1. **主要游標模式用相對觸控板，加上非線性加速度曲線，不要用固定 gain**（#1、#7、#9、#10、#11）。在超寬的 Mac Virtual Display 上，固定 gain 從原理上就無法同時兼顧「一次滑過整個螢幕」和「點得準」（見 #9 的推算）。起始實作可以用 logistic 速度–gain 函數（#1 的參數可當參考值），並提供靈敏度滑桿。
2. **長距離移動**：可以參考 ARC-Pad 的絕對跳躍（#11），或 Breaking the Screen 的「按住修飾區切換粗調 gain，手指移 2 cm 跨一個螢幕」（#6）。單手拇指情境下，建議把「迷你地圖或快速帶」做成獨立區域，避免和「點一下 = 左鍵」衝突。
3. **點擊防抖與手勢門檻**：觸控按下和放開時凍結或忽略小位移（#12 的錯誤主要來自按壓時的晃動；#1 對 spatial 技術在觸控事件時暫停 300 ms）。tap 與 drag 的判斷起始值可用 300 ms、0.35 cm（#11）。**不要用 700 ms 長按切換模式**（#1）；拖曳鎖定、右鍵改用明確的按鈕或雙指手勢。
4. **不把傾斜或空中滑鼠當主要輸入**：#12 的 Tilt／Move 錯誤率高、容易 overshoot，#1 的 Raycasting 錯誤率 24.21 而且最耗體力；躺姿時更不穩。
5. **按鈕放在拇指功能區，並可校準**（#13）：橫向單手時，左鍵、右鍵、捲動、拖曳鎖定集中在拇指根部的弧形區；提供左右手鏡像和側臥配置（#20），並能鎖定螢幕方向。
6. **姿勢**：以「仰躺或半仰躺、手機平放在胸口或腹部、手肘有支撐」為主要情境（#22 仰臥的頸部肌肉活動最低；#12 手臂靠在身上更準；#14、#16 手臂不懸空就幾乎沒有肩部力矩疲勞）。避免要求使用者舉起手機（#16 越高越累）或頻繁低頭（#19 越低脖子越累）。半躺約 45° 時注意虛擬螢幕的擺放角度（#21）。
7. **文字輸入用手機原生鍵盤與 IME，只把已確定的文字送到 Mac**（#8：XR 中 Gaze&Pinch 逐鍵輸入約 10 WPM、Finger-Tap 約 18 WPM；#3：手機放在大腿上打字可行；#18：熟悉的輸入裝置只造成小幅掉速）。➕ 可以在 Mac 端疊一個小型「組字或送出預覽」，減少低頭確認的次數（#5 指出看不到手機是精準觸控的主要障礙）。
8. **不需視覺的回饋**：在拖曳開始、模式切換、送出文字等狀態變化時給回饋（#1、#7、#2 都用震動）。➕ 待驗證：iOS Safari 網頁是否能觸發震動仍有疑慮，必要時改在 Mac 端用游標樣式或聲音回饋。
9. **網路**：觸控與文字可以走可靠通道（#2 的觸控走 TCP），所以 WebSocket 可行。WiFi 單向延遲可能到約 25 ms，延遲會放大快速移動時的誤差（#2）。應該送相對位移、合併封包，並避免在佇列中累積。
10. **長時間使用**：HMD 長時間工作本身就提高眼睛疲勞與任務負荷（#18），疲勞會累積，休息有恢復效果（#15、#16）。輸入設計應以「最低動作量、免舉手、免低頭」為原則；➕ 也可以考慮在 UI 提供休息提醒。

---

## 工具使用統計

- **開始時間**：11:48（台北時間，`TZ=Asia/Taipei date '+%H:%M'`）
- **結束時間**：12:11（台北時間；總計約 23 分鐘）
- **WebSearch ×25**
- **WebFetch ×26**
  - 有拿到可用內容的 9 次：NICER arXiv HTML、Seoultech 頁面、PAIR 專案頁、Pfeuffer PDF、Darbar PDF、Casiez PDF、Tominaga PDF、SwEYEpinch 專案頁、arXiv abs。
  - 只拿到書目、內容不相關或資訊不足的 5 次：TrackCap 頁、PMC9869316、作者頁、HFES 頁，以及 unpaywall 只回傳轉址。
  - 失敗的 12 次：ECONNREFUSED、403、404、DNS 解析失敗、PDF 超過 10 MB、PubMed 需要 cookie、轉址未跟隨等。
- **Bash ×51**
  - 其中 17 次涉及網路：curl 下載 PDF／HTML，以及 OpenAlex、Europe PMC、arXiv、Semantic Scholar 的 API 查詢（Semantic Scholar 回傳 429）。
  - 其餘是 pdftotext 抽字、grep／sed 閱讀和 date。
- **ToolSearch ×1**（載入 WebSearch／WebFetch）
- **Write ×1**、**Edit ×3**（只寫入本檔）
- 中間產物（下載的 PDF、抽出的文字）都放在 session scratchpad，沒有寫到專案目錄。依指示，沒有讀取本機任何其他與本任務相關的產出檔。
