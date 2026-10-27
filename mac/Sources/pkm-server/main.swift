import AppKit
import ApplicationServices
import Foundation
import PKMCore

setvbuf(stdout, nil, _IOLBF, 0)

struct Options {
    var port: UInt16 = 8765
    var bind: String?
    var webRoot: String?
    var textMode = CGInjector.TextMode.auto
    var noUI = false
    var dryRun = false
    var forgetDevices = false
    var pairingWindow: TimeInterval = 600
    var e2eGuardPid: pid_t?
    var stateDir: String?
    var promptPermission = false
    var selfTest = false
    var noPost = false
    var snapshotScan: String?
}

func usage() -> Never {
    print("""
    用法：pkm-server [選項]
      --port N              監聽的 port（預設 8765）
      --bind IP             只在這個本機位址監聽（預設：所有網路介面，但只接受區網來源）
      --web-root DIR        手機網頁所在資料夾（預設自動尋找）
      --text-mode MODE      auto（預設）｜type｜paste
      --pairing-window SEC  啟動後配對碼有效秒數（預設 600）
      --forget-devices      忘記所有已配對手機後再啟動
      --prompt-permission   請 macOS 顯示「輔助使用」授權對話框
      --no-ui               不顯示選單列圖示和配對視窗（純終端機）
      --dry-run             只印出會送的事件，不真的操作 Mac
      --no-post             照常建立 CGEvent 但不送進系統（量延遲、截圖用）
      --self-test           檢查 CGEvent 內容（不送進系統）後結束
      --state-dir DIR       配對資料存放位置（預設 ~/Library/Application Support/SofaPad）
      --snapshot-scan PNG   把「用 iPhone 掃描」視窗畫成圖片後結束（截圖用，不顯示視窗）
    """)
    exit(2)
}

func parseOptions() -> Options {
    var o = Options()
    var args = CommandLine.arguments.dropFirst()
    func value() -> String { guard let v = args.popFirst() else { usage() }; return v }
    while let a = args.popFirst() {
        switch a {
        case "--port": guard let p = UInt16(value()) else { usage() }; o.port = p
        case "--bind": o.bind = value()
        case "--web-root": o.webRoot = value()
        case "--text-mode": guard let m = CGInjector.TextMode(rawValue: value()) else { usage() }; o.textMode = m
        case "--pairing-window": guard let s = TimeInterval(value()) else { usage() }; o.pairingWindow = s
        case "--forget-devices": o.forgetDevices = true
        case "--prompt-permission": o.promptPermission = true
        case "--no-ui": o.noUI = true
        case "--dry-run": o.dryRun = true
        case "--e2e-guard-pid": guard let p = pid_t(value()) else { usage() }; o.e2eGuardPid = p
        case "--state-dir": o.stateDir = value()
        case "--self-test": o.selfTest = true
        case "--no-post": o.noPost = true
        case "--snapshot-scan": o.snapshotScan = value()
        case "-h", "--help": usage()
        default: print("不認得的選項：\(a)"); usage()
        }
    }
    return o
}

func findWebRoot(_ explicit: String?) -> URL? {
    let fm = FileManager.default
    var candidates: [URL] = []
    if let explicit { candidates.append(URL(fileURLWithPath: explicit)) }
    if let res = Bundle.main.resourceURL { candidates.append(res.appendingPathComponent("web")) }
    let exe = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath().deletingLastPathComponent()
    candidates.append(exe.appendingPathComponent("web"))
    // Running from the source tree: mac/Sources/pkm-server/main.swift → <repo>/web
    candidates.append(URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        .appendingPathComponent("../../../web").standardizedFileURL)
    candidates.append(URL(fileURLWithPath: fm.currentDirectoryPath).appendingPathComponent("web"))
    return candidates.first { fm.fileExists(atPath: $0.appendingPathComponent("index.html").path) }
}

func timestamp() -> String {
    let f = DateFormatter()
    f.dateFormat = "HH:mm:ss"
    return f.string(from: Date())
}

func log(_ s: String) { print("[\(timestamp())] \(s)") }

let options = parseOptions()
if options.selfTest { exit(SelfTest.run() ? 0 : 1) }
if let path = options.snapshotScan { exit(snapshotScanView(to: path, port: options.port) ? 0 : 1) }

/// Started as SofaPad.app (double-click), not from a terminal.
let isAppBundle = Bundle.main.bundleIdentifier == "io.github.rick-ray-wldd.sofapad"
if isAppBundle && isatty(1) == 0 && getppid() == 1 {   // launched from Finder / open, not a shell
    let logs = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0].appendingPathComponent("Logs")
    try? FileManager.default.createDirectory(at: logs, withIntermediateDirectories: true)
    freopen(logs.appendingPathComponent("SofaPad.log").path, "a", stdout)
    setvbuf(stdout, nil, _IOLBF, 0)
}
guard let webRoot = findWebRoot(options.webRoot) else {
    print("找不到手機網頁資料夾（web/index.html）。請用 --web-root 指定。")
    exit(1)
}

let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
let stateDir = options.stateDir.map { URL(fileURLWithPath: $0) } ?? support.appendingPathComponent("SofaPad")
// Renamed from Phone KeyMouse (PKM-4-1, D-33): bring the paired phones over once, so the phone keeps working without
// pairing again. Only devices.json is copied; the old folder stays for Ray to delete (README).
if options.stateDir == nil, !FileManager.default.fileExists(atPath: stateDir.path) {
    let old = support.appendingPathComponent("PhoneKeyMouse/devices.json")
    if FileManager.default.fileExists(atPath: old.path) {
        try? FileManager.default.createDirectory(at: stateDir, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        if (try? FileManager.default.copyItem(at: old, to: stateDir.appendingPathComponent("devices.json"))) != nil {
            log("已把 Phone KeyMouse 配對過的手機搬到 SofaPad（不用重新配對）")
        }
    }
}
var policy = PairingManager.Policy()
policy.pairingWindow = options.pairingWindow
let pairing = PairingManager(storeURL: stateDir.appendingPathComponent("devices.json"), policy: policy)
if options.forgetDevices {
    pairing.forgetAllDevices()
    log("已忘記所有配對過的手機")
}

let injector: InputInjector
if options.dryRun {
    injector = LoggingInjector(log: { log("[dry-run] \($0)") })
} else {
    let cg = CGInjector(textMode: options.textMode)
    cg.log = log
    if options.noPost {
        cg.capture = { _ in }
        log("--no-post：事件只建立、不送進系統")
    }
    if let pid = options.e2eGuardPid {
        _ = NSApplication.shared   // the guard's hit test needs a window-server connection, also with --no-ui
        // PKM-4: PKM_E2E_WINDOWS=id,id also requires the probe's front window to be one of these (two TextEdit test windows)
        let windows = Set((ProcessInfo.processInfo.environment["PKM_E2E_WINDOWS"] ?? "").split(separator: ",").compactMap { Int($0) })
        cg.guardCheck = { event in E2EGuard.allows(event, probePid: pid, windows: windows) }
        log("端對端測試模式：只有前景 App 是 pid \(pid)\(windows.isEmpty ? "" : "、前景視窗是 \(windows.sorted())")、而且點擊／捲動落在它的視窗上時才送事件")
    }
    injector = cg
}

let settingsURL = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")!
if !options.dryRun && !AXIsProcessTrusted() {
    print("""

    ⚠️  這個程式還沒有「輔助使用」權限，macOS 會丟掉它送出的鍵盤和滑鼠事件。
        請打開：系統設定 → 隱私權與安全性 → 輔助使用，把執行這個程式的 App
        （SofaPad.app，或你用來執行它的「終端機」）打開。開好之後不用重開，手機上會自動顯示已就緒。
    """)
    if options.promptPermission || isAppBundle {
        let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(opts)
    }
}

var config = PKMServer.Config(webRoot: webRoot)
config.port = options.port
config.bindHost = options.bind
config.hostName = NetInfo.computerName()
config.timingLog = ProcessInfo.processInfo.environment["PKM_E2E_TIMING"] == "1"
log("版本 \(BuildInfo.version)（建置 \(BuildInfo.build)）")
let server = PKMServer(config: config, pairing: pairing, injector: injector)
server.log = log
var ui: StatusUI?
var serverPort = options.port

/// Scanned again every time it is needed (I-20: a list made once at start misses Wi-Fi that comes up later).
func currentURLs() -> [LANURL] {
    if options.bind == "127.0.0.1" { return [LANURL(url: "http://127.0.0.1:\(serverPort)/", label: "127.0.0.1", isIP: true)] }
    return NetInfo.urls(port: serverPort)
}

/// The one address for QR codes (D-31): an IP when there is one, else the .local name — never nothing (I-20).
func scanURL() -> LANURL {
    LANURLs.shown(currentURLs()).scan ?? LANURLs.fallback(computerName: NetInfo.computerName(), port: serverPort)
}

func pairURL(_ base: String, _ code: String) -> String { LANURLs.pairingPayload(base, code: code) }

func announce(code: String, reason: String) {
    let open = pairing.isPairingOpen
    if open {
        log("配對碼：\(code)（\(reason == "phone-request" ? "手機要求配對，2 分鐘內有效" : "有效時間內可配對一支新手機")）")
    } else if reason == "paired" {
        log("手機已配對。要再配對另一支手機：在這裡按 Enter，或用選單列的「配對新手機」。")
    } else if reason == "too-many-failures" {
        log("⚠️ 配對碼錯誤太多次，已換新碼並關閉配對。需要時請在這裡按 Enter 重新開放配對。")
    }
    DispatchQueue.main.async {
        ui?.code = code
        ui?.pairingOpen = open
        ui?.refresh()
        if open && reason == "phone-request" {
            ui?.showPairingPanel(code: code, url: pairURL(scanURL().url, code), seconds: 120)
        } else if !open {
            ui?.hidePairingPanel()
        }
    }
}

pairing.onCodeChange = { code, reason in announce(code: code, reason: reason) }

server.onReady = { port in
    serverPort = port
    let found = currentURLs()
    let shown = LANURLs.shown(found)
    let main = scanURL()
    // I-20: always say which interfaces were seen, so a missing IP URL on another Mac can be explained from the log
    log("網路介面：\(NetInfo.scanSummary())" + (found.contains(where: \.isIP) ? "" : "（找不到區網 IP 網址，只能用 .local）"))
    print("""

    ========== SofaPad \(BuildInfo.version) ==========
    手機和這台 Mac 連同一個 Wi-Fi，用 iPhone 相機掃下面的 QR code，或用 Safari 打開：
      \(main.url)\(shown.alternate.map { "\n      （IP 換了打不開時：\($0.url)）" } ?? "")
    配對碼：\(pairing.code)（\(Int(options.pairingWindow / 60)) 分鐘內有效；之後手機可以按「要求配對」，Mac 螢幕會跳出新碼）
    網頁資料夾：\(webRoot.path)
    已配對手機：\(pairing.devices.count) 支
    """)
    if let qr = QRCode.terminalString(for: pairURL(main.url, pairing.code)) {
        print("人在 Mac 前面時，也可以用手機相機掃這個 QR code（內含配對碼）：")
        print(qr)
    }
    print("在這裡按 Enter：產生新配對碼；輸入 q 再按 Enter：結束。\n")
    DispatchQueue.main.async {
        ui?.code = pairing.code
        ui?.pairingOpen = pairing.isPairingOpen
        ui?.refresh()
        // Show the startup code on screen too: inside Vision Pro the Mac display is the only place to read it.
        if pairing.isPairingOpen && pairing.devices.isEmpty {
            ui?.showPairingPanel(code: pairing.code, url: pairURL(main.url, pairing.code), seconds: options.pairingWindow)
        }
    }
}

server.onControllerChange = { name in
    DispatchQueue.main.async {
        ui?.controller = name
        ui?.refresh()
    }
}
do {
    try server.start()
} catch {
    print("無法在 port \(options.port) 監聽：\(error)。是不是已經有另一個 pkm-server 在跑？可以用 --port 換一個。")
    exit(1)
}

let signalQueue = DispatchQueue(label: "pkm.signals")
var signalSources: [DispatchSourceSignal] = []
for sig in [SIGINT, SIGTERM] {
    signal(sig, SIG_IGN)
    let s = DispatchSource.makeSignalSource(signal: sig, queue: signalQueue)
    s.setEventHandler {
        log("結束中…")
        server.stop()
        exit(0)
    }
    s.resume()
    signalSources.append(s)
}

if isatty(0) == 1 {
    Thread.detachNewThread {
        while let line = readLine() {
            let cmd = line.trimmingCharacters(in: .whitespaces).lowercased()
            if cmd == "q" || cmd == "quit" {
                server.stop()
                exit(0)
            }
            pairing.openPairing(reason: "terminal")
        }
    }
}

if options.noUI {
    // A real run loop (not dispatchMain) so NSWorkspace keeps frontmostApplication current for the e2e guard.
    RunLoop.main.run()
} else {
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    let statusUI = StatusUI()
    statusUI.permission = options.dryRun || AXIsProcessTrusted()
    statusUI.onNewCode = { pairing.openPairing(reason: "menu") }
    statusUI.onForgetDevices = {
        pairing.forgetAllDevices()
        log("已忘記所有配對過的手機")
    }
    statusUI.onOpenSettings = { NSWorkspace.shared.open(settingsURL) }
    statusUI.urlProvider = currentURLs
    statusUI.scanURL = scanURL
    statusUI.scanSummary = NetInfo.scanSummary
    ui = statusUI
    statusUI.refresh()
    Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { _ in
        let p = options.dryRun || AXIsProcessTrusted()
        if p != statusUI.permission {
            statusUI.permission = p
            statusUI.refresh()
            log(p ? "已取得「輔助使用」權限" : "⚠️ 「輔助使用」權限被關閉")
        }
    }
    app.run()
}
