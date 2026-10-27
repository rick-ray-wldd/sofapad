import AppKit
import ApplicationServices
import Carbon
import CoreGraphics
import PKMCore

/// Posts real keyboard / mouse events with CGEvent (needs the Accessibility permission).
final class CGInjector: InputInjector {
    enum TextMode: String {
        case type   // Unicode keyboard events, one grapheme per event
        case paste  // clipboard + ⌘V, clipboard restored afterwards
        case auto   // paste for long text or when a Mac input method (e.g. Zhuyin) is active, else type
    }

    var textMode: TextMode
    var autoPasteThreshold = 200
    /// End-to-end tests only: an event is posted only if this returns true for it
    /// (front-most app is the probe, and for clicks/scrolls the window under the cursor is the probe's).
    var guardCheck: ((CGEvent) -> Bool)?
    var log: (String) -> Void = { _ in }
    /// Self-test / benchmarks: events are handed here instead of being posted to the system.
    var capture: ((CGEvent) -> Void)?
    /// The self-test uses a private named pasteboard so the user's clipboard is never touched.
    var pasteboard: NSPasteboard = .general
    var pasteRestoreDelay: TimeInterval = 0.6

    private let source = CGEventSource(stateID: .hidSystemState)
    private var buttonsDown: Set<MouseButton> = []
    private var position: CGPoint?
    private var scrollRemainder = CGPoint.zero
    private var lastClick: (button: MouseButton, time: TimeInterval, location: CGPoint, count: Int64)?
    private var cachedPermission: (value: Bool, at: TimeInterval)?
    private var pacer = InjectionPacer()
    private var clipboardKeeper = ClipboardKeeper<[[(NSPasteboard.PasteboardType, Data)]]>()

    init(textMode: TextMode) { self.textMode = textMode }

    // MARK: - state

    var hasPermission: Bool {
        let now = ProcessInfo.processInfo.systemUptime
        if let c = cachedPermission, now - c.at < 1 { return c.value }
        let v = AXIsProcessTrusted()
        cachedPermission = (v, now)
        return v
    }

    var secureInputActive: Bool { IsSecureEventInputEnabled() }

    var screenLocked: Bool {
        if capture != nil { return false }   // --no-post / self-test: nothing reaches the system anyway
        guard let dict = CGSessionCopyCurrentDictionary() as? [String: Any] else { return false }
        return (dict["CGSSessionScreenIsLocked"] as? Bool) ?? false
    }

    /// ⌃←/→/↑/↓ switched off in System Settings → the phone warns when a three-finger swipe needs one (D-15).
    var disabledSystemShortcuts: [String] { SystemShortcutCheck.disabledNow() }
    var spaceCount: Int? { SystemShortcutCheck.spaceCountNow() }

    private func post(_ e: CGEvent?) {
        guard let e else { return }
        if let capture { capture(e); return }
        if let guardCheck, !guardCheck(e) {
            log("e2e guard: target is not the probe, event \(e.type.rawValue) dropped")
            return
        }
        e.post(tap: .cghidEventTap)
    }

    // MARK: - mouse

    private func currentLocation() -> CGPoint {
        let system = CGEvent(source: nil)?.location ?? .zero
        // Keep sub-point precision ourselves; resync if the real cursor moved (trackpad, another app).
        if let p = position, abs(p.x - system.x) < 2, abs(p.y - system.y) < 2 { return p }
        return system
    }

    func moveBy(dx: Double, dy: Double) {
        let from = currentLocation()
        let to = clampToDisplays(CGPoint(x: from.x + dx, y: from.y + dy), from: from)
        position = to
        let type: CGEventType
        let button: CGMouseButton
        if buttonsDown.contains(.left) { type = .leftMouseDragged; button = .left }
        else if buttonsDown.contains(.right) { type = .rightMouseDragged; button = .right }
        else if buttonsDown.contains(.middle) { type = .otherMouseDragged; button = .center }
        else { type = .mouseMoved; button = .left }
        let e = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: to, mouseButton: button)
        e?.flags = []   // a stuck modifier must not turn a click into ⌃-click (S-31)
        e?.setIntegerValueField(.mouseEventDeltaX, value: Int64(dx.rounded()))
        e?.setIntegerValueField(.mouseEventDeltaY, value: Int64(dy.rounded()))
        post(e)
    }

    private func displayBounds() -> [CGRect] {
        var count: UInt32 = 0
        CGGetActiveDisplayList(0, nil, &count)
        guard count > 0 else { return [] }
        var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
        CGGetActiveDisplayList(count, &ids, &count)
        return ids.prefix(Int(count)).map { CGDisplayBounds($0) }
    }

    private func currentDisplay() -> CGRect {
        let loc = currentLocation()
        let all = displayBounds()
        return all.first(where: { $0.contains(loc) }) ?? all.first ?? CGDisplayBounds(CGMainDisplayID())
    }

    var screenSize: (width: Double, height: Double) {
        let b = currentDisplay()
        return (Double(b.width), Double(b.height))
    }

    /// Mini-map: jump to a relative position on the display the cursor is on (ARC-Pad style, S-13).
    func jump(x: Double, y: Double) {
        let b = currentDisplay()
        let from = currentLocation()
        let to = CGPoint(x: b.minX + x * (b.width - 1), y: b.minY + y * (b.height - 1))
        moveBy(dx: to.x - from.x, dy: to.y - from.y)
    }

    /// Stay on screen. Moving into another display is allowed; otherwise clamp to the current one.
    private func clampToDisplays(_ p: CGPoint, from: CGPoint) -> CGPoint {
        var count: UInt32 = 0
        CGGetActiveDisplayList(0, nil, &count)
        guard count > 0 else { return p }
        var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
        CGGetActiveDisplayList(count, &ids, &count)
        let bounds = ids.map { CGDisplayBounds($0) }
        if bounds.contains(where: { $0.contains(p) }) { return p }
        let home = bounds.first(where: { $0.contains(from) }) ?? bounds[0]
        return CGPoint(x: min(max(p.x, home.minX), home.maxX - 1), y: min(max(p.y, home.minY), home.maxY - 1))
    }

    private func types(_ b: MouseButton) -> (down: CGEventType, up: CGEventType, cg: CGMouseButton) {
        switch b {
        case .left: return (.leftMouseDown, .leftMouseUp, .left)
        case .right: return (.rightMouseDown, .rightMouseUp, .right)
        case .middle: return (.otherMouseDown, .otherMouseUp, .center)
        }
    }

    /// macOS needs an explicit click count for double / triple clicks.
    private func nextClickCount(_ b: MouseButton, at loc: CGPoint) -> Int64 {
        let now = ProcessInfo.processInfo.systemUptime
        if let lc = lastClick, lc.button == b, now - lc.time < NSEvent.doubleClickInterval,
           hypot(lc.location.x - loc.x, lc.location.y - loc.y) < 6 {
            lastClick = (b, now, loc, lc.count + 1)
        } else {
            lastClick = (b, now, loc, 1)
        }
        return lastClick!.count
    }

    func click(_ button: MouseButton) {
        let loc = currentLocation()
        let t = types(button)
        let n = nextClickCount(button, at: loc)
        for type in [t.down, t.up] {
            let e = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: loc, mouseButton: t.cg)
            e?.flags = []
            e?.setIntegerValueField(.mouseEventClickState, value: n)
            post(e)
        }
    }

    func press(_ button: MouseButton, down: Bool) {
        if down == buttonsDown.contains(button) { return }
        let loc = currentLocation()
        let t = types(button)
        let n = down ? nextClickCount(button, at: loc) : (lastClick?.count ?? 1)
        let e = CGEvent(mouseEventSource: source, mouseType: down ? t.down : t.up, mouseCursorPosition: loc, mouseButton: t.cg)
        e?.flags = []
        e?.setIntegerValueField(.mouseEventClickState, value: n)
        post(e)
        if down { buttonsDown.insert(button) } else { buttonsDown.remove(button) }
    }

    /// dy > 0 = fingers moved down = content follows the fingers (natural scrolling).
    func scroll(dx: Double, dy: Double) {
        scrollRemainder.x += dx
        scrollRemainder.y += dy
        let ix = Int32(scrollRemainder.x.rounded(.towardZero))
        let iy = Int32(scrollRemainder.y.rounded(.towardZero))
        guard ix != 0 || iy != 0 else { return }
        scrollRemainder.x -= Double(ix)
        scrollRemainder.y -= Double(iy)
        let e = CGEvent(scrollWheelEvent2Source: source, units: .pixel, wheelCount: 2, wheel1: iy, wheel2: ix, wheel3: 0)
        e?.flags = []
        e?.setIntegerValueField(.scrollWheelEventIsContinuous, value: 1)
        post(e)
    }

    func releaseAll() {
        for b in buttonsDown { press(b, down: false) }
        buttonsDown.removeAll()
    }

    // MARK: - keyboard

    private func keyEvent(_ code: UInt16, down: Bool, flags: UInt64) -> CGEvent? {
        let e = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: down)
        e?.flags = CGEventFlags(rawValue: flags)
        return e
    }

    /// Waits as long as `InjectionPacer` says before doing `kind` (I-21).
    private func pace(_ kind: InjectionPacer.Kind) {
        let w = pacer.wait(before: kind, now: ProcessInfo.processInfo.systemUptime)
        if w > 0 { usleep(UInt32(w * 1_000_000)) }
    }

    func key(_ stroke: KeyStroke) {
        pace(.key)
        postKey(stroke)
        pacer.did(.key, at: ProcessInfo.processInfo.systemUptime)
    }

    private func postKey(_ stroke: KeyStroke) {
        var flags: UInt64 = 0
        let mods = stroke.modifiers.filter { $0.keyCode != nil }
        for m in mods {
            flags |= m.flag
            let e = keyEvent(m.keyCode!, down: true, flags: flags)
            e?.type = .flagsChanged
            post(e)
        }
        // WindowServer shortcuts (⌘Tab, ⌘Space, ⌃→) need the modifier to be down a moment first (S-31).
        if !mods.isEmpty { usleep(12_000) }
        post(keyEvent(stroke.keyCode, down: true, flags: stroke.eventFlags))
        post(keyEvent(stroke.keyCode, down: false, flags: stroke.eventFlags))
        if !mods.isEmpty { usleep(12_000) }
        for m in mods.reversed() {
            flags &= ~m.flag
            let e = keyEvent(m.keyCode!, down: false, flags: flags)
            e?.type = .flagsChanged
            post(e)
        }
    }

    @discardableResult
    func type(_ text: String) -> String {
        let usePaste: Bool
        switch textMode {
        case .type: usePaste = false
        case .paste: usePaste = true
        case .auto: usePaste = text.count > autoPasteThreshold || CGInjector.inputMethodActive()
        }
        if usePaste {
            pace(.paste)
            paste(text)
            pacer.did(.paste, at: ProcessInfo.processInfo.systemUptime)
            return "paste"
        }
        pace(.text)
        defer { pacer.did(.text, at: ProcessInfo.processInfo.systemUptime) }
        for step in TextPlanner.plan(text) {
            switch step {
            case .key(let k): postKey(k)
            case .unicode(let s):
                let u = Array(s.utf16)
                for down in [true, false] {
                    let e = keyEvent(0, down: down, flags: 0)
                    e?.keyboardSetUnicodeString(stringLength: u.count, unicodeString: u)
                    post(e)
                }
            }
        }
        return "type"
    }

    /// True when the Mac's current input source is an input method (Zhuyin, Pinyin, Japanese…) rather than
    /// a plain keyboard layout. Synthetic Unicode key events can be swallowed by such an input method.
    static func inputMethodActive() -> Bool {
        let check = { () -> Bool in
            guard let src = TISCopyCurrentKeyboardInputSource()?.takeRetainedValue(),
                  let raw = TISGetInputSourceProperty(src, kTISPropertyInputSourceType) else { return false }
            let type = Unmanaged<CFString>.fromOpaque(raw).takeUnretainedValue() as String
            return type != (kTISTypeKeyboardLayout as String)
        }
        return Thread.isMainThread ? check() : DispatchQueue.main.sync(execute: check)
    }

    /// Clipboard paste for long text or when an input method is active. The previous clipboard is restored —
    /// the one from before the first paste of a burst (I-21) — and the temporary item is marked
    /// transient/concealed so clipboard managers skip it.
    private func paste(_ text: String) {
        let work = {
            let pb = self.pasteboard
            let saved = self.clipboardKeeper.snapshotForPaste(changeCount: pb.changeCount) {
                (pb.pasteboardItems ?? []).map { item in
                    item.types.compactMap { t in item.data(forType: t).map { (t, $0) } }
                }
            }
            pb.clearContents()
            let item = NSPasteboardItem()
            item.setString(text, forType: .string)
            item.setString("", forType: NSPasteboard.PasteboardType("org.nspasteboard.TransientType"))
            item.setString("", forType: NSPasteboard.PasteboardType("org.nspasteboard.ConcealedType"))
            pb.writeObjects([item])
            let ours = pb.changeCount
            self.clipboardKeeper.wrote(changeCount: ours, restoring: saved)
            self.postKey(KeyStroke(keyCode: 0x09, modifiers: [.cmd]))   // ⌘V
            DispatchQueue.main.asyncAfter(deadline: .now() + self.pasteRestoreDelay) {
                // a newer paste or something the user copied: leave it (the newer paste restores later)
                guard self.clipboardKeeper.shouldRestore(ours: ours, now: pb.changeCount) else { return }
                pb.clearContents()
                let items = saved.map { pairs -> NSPasteboardItem in
                    let it = NSPasteboardItem()
                    for (t, d) in pairs { it.setData(d, forType: t) }
                    return it
                }
                if !items.isEmpty { pb.writeObjects(items) }
            }
        }
        if Thread.isMainThread { work() } else { DispatchQueue.main.sync(execute: work) }
    }
}

/// --dry-run: logs what would be injected, posts nothing.
final class LoggingInjector: InputInjector {
    let log: (String) -> Void
    init(log: @escaping (String) -> Void) { self.log = log }
    var hasPermission: Bool { true }
    var secureInputActive: Bool { false }
    var screenSize: (width: Double, height: Double) { (2560, 1440) }
    var screenLocked: Bool { false }
    /// Browser tests of the phone's hints (PKM-2-3): PKM_DRY_HOTKEYS_OFF=spaceLeft,… and PKM_DRY_SPACES=1 pretend
    /// the Mac's settings; unset = all shortcuts on, Space count unknown.
    var disabledSystemShortcuts: [String] {
        (ProcessInfo.processInfo.environment["PKM_DRY_HOTKEYS_OFF"] ?? "").split(separator: ",").map(String.init)
    }
    var spaceCount: Int? { ProcessInfo.processInfo.environment["PKM_DRY_SPACES"].flatMap { Int($0) } }
    func moveBy(dx: Double, dy: Double) { log(String(format: "move %.1f %.1f", dx, dy)) }
    func jump(x: Double, y: Double) { log(String(format: "jump %.3f %.3f", x, y)) }
    func scroll(dx: Double, dy: Double) { log(String(format: "scroll %.1f %.1f", dx, dy)) }
    func click(_ button: MouseButton) { log("click \(button.rawValue)") }
    func press(_ button: MouseButton, down: Bool) { log("\(down ? "down" : "up") \(button.rawValue)") }
    func type(_ text: String) -> String { log("type \(text.debugDescription)"); return "type" }
    func key(_ stroke: KeyStroke) { log("key \(stroke.keyCode) mods \(stroke.modifiers.map(\.rawValue))") }
    func releaseAll() { log("release all") }
}
