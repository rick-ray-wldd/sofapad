import AppKit

// pkm-probe: end-to-end test target, test use only.
// Shows a window with a real NSTextView, brings itself to the front, and prints every key/mouse
// event it receives as JSON lines. It never posts events itself. On exit it puts the cursor back
// where it was and re-activates the app that was in front before (PKM-1-1 rule 3).
//
//   pkm-probe --seconds 90 --stop-file /path/stop [--restore-pid PID]
// prints {"ready":…} first and {"final":…} last.

setvbuf(stdout, nil, _IOLBF, 0)

func arg(_ name: String) -> String? {
    guard let i = CommandLine.arguments.firstIndex(of: name), i + 1 < CommandLine.arguments.count else { return nil }
    return CommandLine.arguments[i + 1]
}

let maxSeconds = min(Double(arg("--seconds") ?? "90") ?? 90, 110)   // never longer than 2 minutes
let stopFile = arg("--stop-file")

func emit(_ obj: [String: Any]) {
    if let d = try? JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys]), let s = String(data: d, encoding: .utf8) {
        print(s)
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
// The app that was in front before the test (I-12). `open` makes the probe front before this code runs, so
// e2e.sh records the front app first and passes it here; asking NSWorkspace now would return the probe itself.
let previousApp = arg("--restore-pid").flatMap { pid_t($0) }.flatMap { NSRunningApplication(processIdentifier: $0) }
    ?? NSWorkspace.shared.frontmostApplication
let savedCursor = CGEvent(source: nil)?.location ?? .zero

let screen = NSScreen.screens.first!.frame          // primary screen (Cocoa coordinates)
let rect = NSRect(x: screen.midX - 450, y: screen.midY - 300, width: 900, height: 600)
let window = NSWindow(contentRect: rect, styleMask: [.titled], backing: .buffered, defer: false)
window.title = "SofaPad 端對端測試（自動，約 1 分鐘內關閉）"
window.level = .floating
window.acceptsMouseMovedEvents = true
let scroll = NSScrollView(frame: NSRect(origin: .zero, size: rect.size))
scroll.hasVerticalScroller = true
let textView = NSTextView(frame: NSRect(origin: .zero, size: rect.size))
textView.font = .systemFont(ofSize: 22)
textView.isRichText = false
textView.isAutomaticQuoteSubstitutionEnabled = false
textView.isAutomaticDashSubstitutionEnabled = false
textView.isAutomaticTextReplacementEnabled = false
textView.isAutomaticSpellingCorrectionEnabled = false
scroll.documentView = textView
window.contentView = scroll
window.makeKeyAndOrderFront(nil)
window.makeFirstResponder(textView)
NSRunningApplication.current.activate(options: [.activateAllWindows])
if #available(macOS 14.0, *) { app.activate() } else { app.activate(ignoringOtherApps: true) }

func finish(_ reason: String) {
    emit(["final": textView.string, "reason": reason])
    CGWarpMouseCursorPosition(savedCursor)
    CGAssociateMouseAndMouseCursorPosition(1)
    window.orderOut(nil)
    if let prev = previousApp, prev.processIdentifier != getpid() {
        if #available(macOS 14.0, *) { prev.activate() } else { prev.activate(options: []) }
    }
    emit(["restored": ["cursor": ["x": savedCursor.x, "y": savedCursor.y], "app": previousApp?.bundleIdentifier ?? ""]])
    exit(0)
}

NSEvent.addLocalMonitorForEvents(matching: [.keyDown, .leftMouseDown, .leftMouseUp, .rightMouseDown, .rightMouseUp,
                                             .leftMouseDragged, .scrollWheel, .mouseMoved]) { e in
    var o: [String: Any] = ["e": "\(e.type.rawValue)"]
    switch e.type {
    case .keyDown: o["e"] = "key"; o["chars"] = e.characters ?? ""; o["code"] = Int(e.keyCode); o["flags"] = e.modifierFlags.rawValue & 0xFFFF0000
    case .leftMouseDown: o["e"] = "ldown"; o["n"] = e.clickCount
    case .leftMouseUp: o["e"] = "lup"; o["n"] = e.clickCount
    case .rightMouseDown: o["e"] = "rdown"
    case .rightMouseUp: o["e"] = "rup"
    case .leftMouseDragged: o["e"] = "drag"
    case .scrollWheel: o["e"] = "scroll"; o["dy"] = e.scrollingDeltaY; o["precise"] = e.hasPreciseScrollingDeltas
    case .mouseMoved: o["e"] = "moved"
    default: break
    }
    let p = CGEvent(source: nil)?.location ?? .zero
    o["x"] = Int(p.x); o["y"] = Int(p.y)
    emit(o)
    // Swallow right-click so no context menu pops up, and ⌘-shortcuts other than ⌘A (select all) so the test
    // window does not beep or run menu items; let everything else through to the text view.
    if e.type == .rightMouseDown || e.type == .rightMouseUp { return nil }
    if e.type == .keyDown, e.modifierFlags.contains(.command), e.charactersIgnoringModifiers != "a" { return nil }
    return e
}

DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
    // CG global coordinates (origin top-left of the primary screen) for the driver.
    let f = window.frame
    let cg = CGRect(x: f.minX, y: screen.height - f.maxY, width: f.width, height: f.height)
    emit(["ready": true, "pid": Int(getpid()),
          "front": NSWorkspace.shared.frontmostApplication?.processIdentifier == getpid(),
          "window": ["x": cg.minX, "y": cg.minY, "w": cg.width, "h": cg.height],
          "screen": ["w": screen.width, "h": screen.height],
          "cursor": ["x": savedCursor.x, "y": savedCursor.y],
          "previous": previousApp?.bundleIdentifier ?? ""])
}

Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
    if let stopFile, FileManager.default.fileExists(atPath: stopFile) { finish("stop-file") }
}
DispatchQueue.main.asyncAfter(deadline: .now() + maxSeconds) { finish("timeout") }
signal(SIGTERM, SIG_IGN)
let term = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
term.setEventHandler { finish("sigterm") }
term.resume()

app.run()
