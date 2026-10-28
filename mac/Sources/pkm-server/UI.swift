import AppKit
import PKMCore

/// Menu-bar item and the floating pairing-code panel. Everything here runs on the main thread.
/// The panel matters for the Vision Pro case: a phone asks to pair, and the code shows up on the
/// Mac Virtual Display without anyone touching the Mac.
final class StatusUI: NSObject, NSMenuDelegate {
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private var panel: NSPanel?
    private var hideTimer: Timer?
    private var scanPanel: NSPanel?
    private var pairingCode = ""
    private var pairingUntil = Date()

    /// Scans the network interfaces again every time the menu opens or a QR code is shown (I-20).
    var urlProvider: () -> [LANURL] = { [] }
    /// The one address for QR codes (D-31), never missing.
    var scanURL: () -> LANURL = { LANURL(url: "http://127.0.0.1:8765/", label: "127.0.0.1", isIP: true) }
    var scanSummary: () -> String = { "" }
    var code = ""
    var pairingOpen = false
    var controller: String?
    var permission = true
    /// SOFA-5: the last phone refused for not being on the local network (address, when).
    var lastRefused: (peer: String, at: Date)?
    /// SOFA-5: accept Tailscale devices (100.64.0.0/10); off by default.
    var allowTailscale = false
    var onToggleTailscale: ((Bool) -> Void)?

    var onNewCode: (() -> Void)?
    var onForgetDevices: (() -> Void)?
    var onOpenSettings: (() -> Void)?

    override init() {
        super.init()
        refresh()
    }

    func refresh() {
        statusItem.button?.title = controller == nil ? "⌨︎🖱" : "⌨︎🖱●"
        statusItem.button?.toolTip = "SofaPad \(BuildInfo.version)"
        let menu = NSMenu()
        menu.delegate = self
        populate(menu)
        statusItem.menu = menu
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        populate(menu)
    }

    private func populate(_ menu: NSMenu) {
        // which version is running (PKM-4): the phone's ⚙︎ shows the same numbers
        let version = NSMenuItem(title: "SofaPad \(BuildInfo.version)（\(BuildInfo.build == "dev" ? "開發版" : "建置 " + BuildInfo.build)）", action: nil, keyEquivalent: "")
        version.isEnabled = false
        menu.addItem(version)
        let title = NSMenuItem(title: controller.map { "已連線：\($0)" } ?? "沒有手機連線", action: nil, keyEquivalent: "")
        title.isEnabled = false
        menu.addItem(title)
        if let r = lastRefused {
            let f = DateFormatter()
            f.dateFormat = Calendar.current.isDateInToday(r.at) ? "HH:mm:ss" : "M/d HH:mm"
            let item = NSMenuItem(title: "⚠️ 最近拒絕的連線：\(r.peer)（\(f.string(from: r.at))，不在區網；手機上有說明頁）", action: nil, keyEquivalent: "")
            item.isEnabled = false
            menu.addItem(item)
        }
        if !permission {
            let warn = NSMenuItem(title: "⚠️ 尚未開啟「輔助使用」權限：打開系統設定…", action: #selector(openSettings), keyEquivalent: "")
            warn.target = self
            menu.addItem(warn)
        }
        menu.addItem(.separator())
        let scan = NSMenuItem(title: "用 iPhone 掃描（QR code）…", action: #selector(scanClicked), keyEquivalent: "")
        scan.target = self
        menu.addItem(scan)
        // one address, plus the .local name as the only alternative; the rest under 進階 (D-31)
        let all = urlProvider()
        let shown = LANURLs.shown(all)
        let main = scanURL()
        menu.addItem(copyItem("拷貝網址 \(main.url)", main.url))
        if let alt = shown.alternate { menu.addItem(copyItem("拷貝網址 \(alt.url)（IP 換了用這個）", alt.url)) }
        let codeItem = NSMenuItem(title: pairingOpen ? "配對碼：\(code)" : "配對已關閉", action: nil, keyEquivalent: "")
        codeItem.isEnabled = false
        menu.addItem(codeItem)
        let newCode = NSMenuItem(title: "配對新手機（產生新配對碼）", action: #selector(newCodeClicked), keyEquivalent: "n")
        newCode.target = self
        menu.addItem(newCode)
        let forget = NSMenuItem(title: "忘記所有已配對手機", action: #selector(forgetClicked), keyEquivalent: "")
        forget.target = self
        menu.addItem(forget)
        let tailscale = NSMenuItem(title: "允許 Tailscale 裝置（100.64.0.0/10，仍要配對）", action: #selector(tailscaleClicked), keyEquivalent: "")
        tailscale.target = self
        tailscale.state = allowTailscale ? .on : .off
        menu.addItem(tailscale)
        let advanced = NSMenu()
        for u in shown.more { advanced.addItem(copyItem("拷貝網址 \(u.url)（\(u.label)）", u.url)) }
        let net = NSMenuItem(title: "網路介面：\(scanSummary())", action: nil, keyEquivalent: "")
        net.isEnabled = false
        advanced.addItem(net)
        let adv = NSMenuItem(title: "進階", action: nil, keyEquivalent: "")
        adv.submenu = advanced
        menu.addItem(adv)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "結束 SofaPad", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
    }

    private func copyItem(_ title: String, _ url: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: #selector(copyURL(_:)), keyEquivalent: "")
        item.representedObject = url
        item.target = self
        return item
    }

    @objc private func copyURL(_ sender: NSMenuItem) {
        guard let u = sender.representedObject as? String else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(u, forType: .string)
    }

    @objc private func newCodeClicked() { onNewCode?() }
    @objc private func scanClicked() { showScanPanel() }

    // MARK: - "用 iPhone 掃描" (PKM-3-2)

    /// One QR code: this Mac's address (an IP when there is one, D-31). Only the address: pairing stays in its own
    /// flow (D-26). Always shows a QR, even with no network yet (I-20).
    func showScanPanel(activate: Bool = true) {
        if activate { scanPanel?.orderOut(nil) }
        let urls = urlProvider()
        let summary = urls.contains(where: \.isIP) ? "" : scanSummary()
        if !summary.isEmpty { print("用 iPhone 掃描：找不到區網 IP 網址（\(summary)）") }
        let main = scanURL()
        let alt = LANURLs.shown(urls).alternate
        let view = ScanView(url: main, alternate: alt, summary: summary, place: NetInfo.describe(main))
        if !activate {
            // network changed while it is open (SOFA-5): new contents, same place, no focus change
            guard let open = scanPanel, open.isVisible else { return }
            open.contentView = view
            open.setContentSize(view.fittingSize)
            return
        }
        let p = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 380, height: 480),
                        styleMask: [.titled, .closable, .utilityWindow, .hudWindow],
                        backing: .buffered, defer: false)
        p.title = "SofaPad：用 iPhone 掃描"
        p.level = .floating
        p.isFloatingPanel = true
        p.hidesOnDeactivate = false
        p.isReleasedWhenClosed = false
        p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        p.contentView = view
        p.setContentSize(view.fittingSize)
        p.center()
        p.orderFrontRegardless()
        NSApp.activate(ignoringOtherApps: true)
        p.makeKey()
        scanPanel = p
    }
    @objc private func forgetClicked() { onForgetDevices?() }
    @objc private func tailscaleClicked() { onToggleTailscale?(!allowTailscale) }
    @objc private func openSettings() { onOpenSettings?() }

    /// SOFA-5: the network changed. The menu is rebuilt each time it opens; open windows get the new address now.
    func networkChanged() {
        refresh()
        if let s = scanPanel, s.isVisible { showScanPanel(activate: false) }
        if let p = panel {
            let left = pairingUntil.timeIntervalSinceNow
            guard left > 1 else { return }
            let view = pairingContent(code: pairingCode, seconds: left)
            p.contentView = view
            p.setContentSize(view.fittingSize)
        }
    }

    /// Big code on top of everything, without stealing focus. The QR code holds the current address and the code.
    func showPairingPanel(code: String, seconds: TimeInterval) {
        hidePairingPanel()
        pairingCode = code
        pairingUntil = Date().addingTimeInterval(seconds)
        let p = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 360, height: 420),
                        styleMask: [.titled, .closable, .nonactivatingPanel, .utilityWindow, .hudWindow],
                        backing: .buffered, defer: false)
        p.title = "SofaPad 配對"
        p.level = .floating
        p.isFloatingPanel = true
        p.hidesOnDeactivate = false
        p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        let view = pairingContent(code: code, seconds: seconds)
        p.contentView = view
        p.setContentSize(view.fittingSize)
        p.center()
        p.orderFrontRegardless()
        panel = p
        hideTimer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in self?.hidePairingPanel() }
    }

    private func pairingContent(code: String, seconds: TimeInterval) -> NSView {
        pairingView(code: code, seconds: seconds, main: scanURL(), summary: scanSummary)
    }

    func hidePairingPanel() {
        hideTimer?.invalidate()
        hideTimer = nil
        panel?.orderOut(nil)
        panel = nil
    }
}

/// Contents of the pairing window: the code, a QR code with the address and the code, and (SOFA-5) which IP and
/// network this is. Also drawn off screen for the screenshots (PKM_SNAPSHOT_PAIRING).
func pairingView(code: String, seconds: TimeInterval, main: LANURL, summary: () -> String) -> NSView {
    let url: String? = main.url.isEmpty ? nil : LANURLs.pairingPayload(main.url, code: code)
    let heading = NSTextField(labelWithString: "在手機上輸入這組配對碼")
    heading.font = .systemFont(ofSize: 16, weight: .medium)
    let digits = NSTextField(labelWithString: code.map(String.init).joined(separator: " "))
    digits.font = .monospacedDigitSystemFont(ofSize: 54, weight: .bold)
    let note = NSTextField(labelWithString: "\(Int((seconds / 60).rounded(.up))) 分鐘內有效；別人看不到你的螢幕就無法配對")
    note.font = .systemFont(ofSize: 12)
    note.textColor = .secondaryLabelColor
    var views: [NSView] = [heading, digits, note]
    if let url, let img = QRCode.image(for: url, scale: 5) {
        let iv = NSImageView(image: img)
        iv.imageScaling = .scaleProportionallyUpOrDown
        iv.widthAnchor.constraint(equalToConstant: 180).isActive = true
        iv.heightAnchor.constraint(equalToConstant: 180).isActive = true
        let scan = NSTextField(labelWithString: "用 iPhone 相機掃描就會自動配對")
        scan.font = .systemFont(ofSize: 12)
        scan.textColor = .secondaryLabelColor
        let address = NSTextField(labelWithString: url.components(separatedBy: "#").first ?? url)
        address.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        address.isSelectable = true
        // SOFA-5: which IP and network this is; it follows network changes while the window is open
        let place = NSTextField(labelWithString: "這台 Mac：\(NetInfo.describe(main))")
        place.font = .systemFont(ofSize: 12)
        place.textColor = .secondaryLabelColor
        views += [iv, scan, address, place]
    } else {
        // I-20: say why there is no QR code instead of silently leaving it out
        print("配對視窗沒有 QR code：\(url == nil ? "沒有可用的網址" : "QR code 產生失敗")（\(url ?? "")；網路介面：\(summary())）")
        let none = NSTextField(labelWithString: url == nil ? "找不到這台 Mac 的網址，請用選單列的「拷貝網址」" : "QR code 產生失敗，請用選單列的「拷貝網址」")
        none.font = .systemFont(ofSize: 12)
        none.textColor = .secondaryLabelColor
        views.append(none)
    }
    let stack = NSStackView(views: views)
    stack.orientation = .vertical
    stack.alignment = .centerX
    stack.spacing = 10
    stack.edgeInsets = NSEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)
    return stack
}

/// Contents of the "用 iPhone 掃描" panel: one QR code, its address, and the .local name as the one alternative.
/// Also rendered off screen for the screenshots (`--snapshot-scan PATH`).
final class ScanView: NSStackView {
    init(url: LANURL, alternate: LANURL?, summary: String, place: String? = nil) {
        super.init(frame: .zero)
        orientation = .vertical
        alignment = .centerX
        spacing = 10
        edgeInsets = NSEdgeInsets(top: 20, left: 24, bottom: 20, right: 24)
        widthAnchor.constraint(equalToConstant: 340).isActive = true

        let heading = NSTextField(labelWithString: "用 iPhone 相機掃描，打開 SofaPad")
        heading.font = .systemFont(ofSize: 16, weight: .medium)
        addArrangedSubview(heading)
        let payload = LANURLs.scanPayload(url)
        let image = NSImageView(image: QRCode.image(for: payload, scale: 6) ?? NSImage())
        image.imageScaling = .scaleProportionallyUpOrDown
        image.widthAnchor.constraint(equalToConstant: 220).isActive = true
        image.heightAnchor.constraint(equalToConstant: 220).isActive = true
        if image.image?.size == .zero { print("用 iPhone 掃描：QR code 產生失敗（\(payload)）") }
        let address = NSTextField(labelWithString: payload)
        address.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        address.isSelectable = true
        addArrangedSubview(image)
        addArrangedSubview(address)
        if let place {
            let line = NSTextField(labelWithString: "這台 Mac：\(place)")
            line.font = .systemFont(ofSize: 12)
            line.textColor = .secondaryLabelColor
            addArrangedSubview(line)
        }
        if !summary.isEmpty {
            let warn = NSTextField(wrappingLabelWithString: "找不到區網 IP，只能用名稱（.local）。\(summary)")
            warn.font = .systemFont(ofSize: 11)
            warn.textColor = .systemOrange
            warn.preferredMaxLayoutWidth = 292
            addArrangedSubview(warn)
        }
        var text = "手機要和 Mac 連同一個 Wi-Fi。這個 QR code 只有網址：已配對的手機掃了就能用；新手機打開後按「請 Mac 顯示配對碼」。"
        if let alternate { text += "\nMac 的 IP 換了、掃了打不開時，改用：\(alternate.url)" }
        let note = NSTextField(wrappingLabelWithString: text)
        note.font = .systemFont(ofSize: 11)
        note.textColor = .secondaryLabelColor
        note.preferredMaxLayoutWidth = 292
        addArrangedSubview(note)
    }

    required init?(coder: NSCoder) { fatalError() }
}

/// `--snapshot-scan PATH`: draws the scan panel's contents into a PNG without showing anything (screenshots).
/// PKM_SNAPSHOT_INTERFACES="en0=192.168.1.20,en7=10.0.0.5" replaces the real interfaces (to show other cases).
/// PKM_SNAPSHOT_PAIRING=<code> draws the pairing window instead.
func snapshotScanView(to path: String, port: UInt16) -> Bool {
    _ = NSApplication.shared
    var interfaces = NetInfo.interfaces()
    if let fake = ProcessInfo.processInfo.environment["PKM_SNAPSHOT_INTERFACES"] {
        interfaces = fake.split(separator: ",").compactMap { pair in
            let kv = pair.split(separator: "=", maxSplits: 1).map(String.init)
            return kv.count == 2 ? LANURLs.Interface(name: kv[0], ip: kv[1]) : nil
        }
    }
    let urls = LANURLs.build(interfaces: interfaces, localHostName: ProcessInfo.processInfo.environment["PKM_SNAPSHOT_HOST"] ?? NetInfo.localHostName(), port: port)
    let shown = LANURLs.shown(urls)
    let main = shown.scan ?? LANURLs.fallback(computerName: "Mac", port: port)
    let summary = urls.contains(where: \.isIP) ? "" :
        (interfaces.isEmpty ? "沒有任何網路介面有 IPv4 位址（Wi-Fi 還沒連上？）"
            : interfaces.map { i in "\(i.name) \(i.ip)" + (LANURLs.rejection(i).map { "：不使用，\($0)" } ?? "") }.joined(separator: "；"))
    // PKM_SNAPSHOT_PAIRING=<code>: draw the pairing window instead (SOFA-5: it shows the IP and the network)
    let view: NSView = ProcessInfo.processInfo.environment["PKM_SNAPSHOT_PAIRING"].map { pairingView(code: $0, seconds: 600, main: main, summary: { summary }) }
        ?? ScanView(url: main, alternate: shown.alternate, summary: summary, place: NetInfo.describe(main))
    let box = NSView()
    box.appearance = NSAppearance(named: .darkAqua)
    box.wantsLayer = true
    box.layer?.backgroundColor = NSColor(white: 0.16, alpha: 1).cgColor
    box.addSubview(view)
    view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([view.leadingAnchor.constraint(equalTo: box.leadingAnchor), view.trailingAnchor.constraint(equalTo: box.trailingAnchor),
                                 view.topAnchor.constraint(equalTo: box.topAnchor), view.bottomAnchor.constraint(equalTo: box.bottomAnchor)])
    box.setFrameSize(view.fittingSize)
    box.layoutSubtreeIfNeeded()
    guard let rep = box.bitmapImageRepForCachingDisplay(in: box.bounds) else { return false }
    box.cacheDisplay(in: box.bounds, to: rep)
    guard let png = rep.representation(using: .png, properties: [:]) else { return false }
    do { try png.write(to: URL(fileURLWithPath: path)) } catch { print(error); return false }
    print("scan view \(Int(box.bounds.width))×\(Int(box.bounds.height)) → \(path)；網址：\(urls.map(\.url))")
    return true
}
