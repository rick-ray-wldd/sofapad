// PKM-4 test bench, Mac half: two untitled TextEdit windows as the only injection targets ("Orca" and "LINE").
// Uses the Accessibility API only (no Apple Events, so no automation prompt): open TextEdit with one untitled
// document, File ▸ New for the second, bring a window to the front, read its text, watch it for latency, and at
// the end close both without saving and quit. Refuses to start if TextEdit is already running (Ray's documents).
//   tewin launch | front <win> | text <win> | front-info | watch <win> | close | clip
import AppKit
import ApplicationServices

@_silgen_name("_AXUIElementGetWindow")
func _AXUIElementGetWindow(_ element: AXUIElement, _ id: UnsafeMutablePointer<CGWindowID>) -> AXError

let bundleID = "com.apple.TextEdit"

func out(_ obj: Any) {
    let data = try! JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys])
    print(String(decoding: data, as: UTF8.self))
    fflush(stdout)
}
func fail(_ msg: String) -> Never { out(["ok": false, "err": msg]); exit(1) }

func attr(_ e: AXUIElement, _ name: String) -> AnyObject? {
    var v: AnyObject?
    return AXUIElementCopyAttributeValue(e, name as CFString, &v) == .success ? v : nil
}
func children(_ e: AXUIElement) -> [AXUIElement] { attr(e, kAXChildrenAttribute) as? [AXUIElement] ?? [] }
func role(_ e: AXUIElement) -> String { attr(e, kAXRoleAttribute) as? String ?? "" }

func textEdit() -> NSRunningApplication? { NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).first }

func windows(_ app: NSRunningApplication) -> [(num: Int, el: AXUIElement)] {
    let ax = AXUIElementCreateApplication(app.processIdentifier)
    return (attr(ax, kAXWindowsAttribute) as? [AXUIElement] ?? []).compactMap { w in
        var id: CGWindowID = 0
        guard _AXUIElementGetWindow(w, &id) == .success, role(w) == kAXWindowRole as String,
              (attr(w, kAXSubroleAttribute) as? String) == kAXStandardWindowSubrole as String else { return nil }
        return (Int(id), w)
    }
}

func textArea(_ e: AXUIElement, depth: Int = 0) -> AXUIElement? {
    if role(e) == kAXTextAreaRole as String { return e }
    if depth > 6 { return nil }
    for c in children(e) { if let t = textArea(c, depth: depth + 1) { return t } }
    return nil
}

/// The front-most normal window of `pid` (CGWindowList is front to back).
func frontWindow(_ pid: pid_t) -> Int? {
    let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
    return list.first { ($0[kCGWindowOwnerPID as String] as? Int) == Int(pid) && ($0[kCGWindowLayer as String] as? Int) == 0 }?[kCGWindowNumber as String] as? Int
}

func window(_ app: NSRunningApplication, _ num: Int) -> AXUIElement {
    guard let w = windows(app).first(where: { $0.num == num })?.el else { fail("no TextEdit window \(num)") }
    return w
}

func pressMenu(_ app: NSRunningApplication, path: [String]) -> Bool {
    let ax = AXUIElementCreateApplication(app.processIdentifier)
    guard let bar = attr(ax, kAXMenuBarAttribute) else { return false }
    var current = bar as! AXUIElement
    for (i, title) in path.enumerated() {
        let items = children(current).flatMap { role($0) == kAXMenuRole as String ? children($0) : [$0] }
        guard let item = items.first(where: { (attr($0, kAXTitleAttribute) as? String) == title }) else { return false }
        if i == path.count - 1 { return AXUIElementPerformAction(item, kAXPressAction as CFString) == .success }
        current = item
    }
    return false
}

let args = CommandLine.arguments.dropFirst()
guard let command = args.first else { fail("usage") }
guard AXIsProcessTrusted() else { fail("no Accessibility permission for this process") }

switch command {
case "launch":
    if textEdit() != nil { fail("TextEdit is already running: not touching it (it may hold your documents)") }
    let cfg = NSWorkspace.OpenConfiguration()
    // one untitled document instead of the Open panel; an argument for this launch only, nothing is saved
    cfg.arguments = ["-NSShowAppCentricOpenPanelInsteadOfUntitledFile", "NO", "-ApplePersistenceIgnoreState", "YES"]
    cfg.activates = true
    let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID)!
    let sem = DispatchSemaphore(value: 0)
    NSWorkspace.shared.openApplication(at: url, configuration: cfg) { _, _ in sem.signal() }
    sem.wait()
    var app: NSRunningApplication?
    for _ in 0..<100 { app = textEdit(); if let a = app, windows(a).count >= 1 { break }; usleep(100_000) }
    guard let a = app, windows(a).count >= 1 else { fail("TextEdit did not open a window") }
    // File ▸ New (English or Chinese menus)
    if !(pressMenu(a, path: ["File", "New"]) || pressMenu(a, path: ["檔案", "新增"])) { fail("could not press File ▸ New") }
    for _ in 0..<50 { if windows(a).count >= 2 { break }; usleep(100_000) }
    let ws = windows(a)
    guard ws.count == 2 else { fail("expected 2 TextEdit windows, found \(ws.count)") }
    out(["ok": true, "pid": Int(a.processIdentifier), "windows": ws.map(\.num)])
case "front":
    guard let a = textEdit(), let s = args.dropFirst().first, let num = Int(s) else { fail("usage: front <win>") }
    let w = window(a, num)
    let ax = AXUIElementCreateApplication(a.processIdentifier)
    AXUIElementSetAttributeValue(ax, kAXFrontmostAttribute as CFString, kCFBooleanTrue)
    AXUIElementSetAttributeValue(w, kAXMainAttribute as CFString, kCFBooleanTrue)
    AXUIElementPerformAction(w, kAXRaiseAction as CFString)
    let t0 = Date()
    while Date().timeIntervalSince(t0) < 2 {
        if NSWorkspace.shared.frontmostApplication?.processIdentifier == a.processIdentifier, frontWindow(a.processIdentifier) == num { break }
        usleep(5_000)
    }
    let ok = NSWorkspace.shared.frontmostApplication?.processIdentifier == a.processIdentifier && frontWindow(a.processIdentifier) == num
    out(["ok": ok, "ms": Int(Date().timeIntervalSince(t0) * 1000), "front": frontWindow(a.processIdentifier) ?? 0])
case "text":
    guard let a = textEdit(), let s = args.dropFirst().first, let num = Int(s) else { fail("usage: text <win>") }
    guard let t = textArea(window(a, num)) else { fail("no text area") }
    out(["ok": true, "text": attr(t, kAXValueAttribute) as? String ?? ""])
case "front-info":
    let f = NSWorkspace.shared.frontmostApplication
    var fields: [String: Any] = ["ok": true, "bundle": f?.bundleIdentifier ?? "", "pid": Int(f?.processIdentifier ?? 0)]
    if let a = textEdit() { fields["textEditFront"] = frontWindow(a.processIdentifier) ?? 0 }
    let locked = (CGSessionCopyCurrentDictionary() as? [String: Any])?["CGSSessionScreenIsLocked"] as? Bool ?? false
    fields["locked"] = locked
    out(fields)
case "watch":
    // one line per change of the window's text length: epoch ms, length, last character (latency measurement)
    guard let a = textEdit(), let s = args.dropFirst().first, let num = Int(s) else { fail("usage: watch <win>") }
    guard let t = textArea(window(a, num)) else { fail("no text area") }
    var last = -1
    setvbuf(stdout, nil, _IOLBF, 0)
    while true {
        var n: CFTypeRef?
        if AXUIElementCopyAttributeValue(t, kAXNumberOfCharactersAttribute as CFString, &n) == .success, let len = n as? Int, len != last {
            last = len
            print("\(Date().timeIntervalSince1970 * 1000) \(len)")
        }
        usleep(1_000)
    }
case "close":
    guard let a = textEdit() else { out(["ok": true, "note": "not running"]); exit(0) }
    for (_, w) in windows(a) {
        // the close button, then "Delete" / "Don't Save" in the sheet that asks about the new document
        if let close = attr(w, kAXCloseButtonAttribute) { AXUIElementPerformAction(close as! AXUIElement, kAXPressAction as CFString) }
        for _ in 0..<30 {
            usleep(100_000)
            let sheets = children(w).filter { role($0) == kAXSheetRole as String }
            guard let sheet = sheets.first else { continue }
            func buttonsIn(_ e: AXUIElement, _ d: Int = 0) -> [AXUIElement] {
                (role(e) == kAXButtonRole as String ? [e] : []) + (d < 4 ? children(e).flatMap { buttonsIn($0, d + 1) } : [])
            }
            let buttons = buttonsIn(sheet)
            let names = ["Delete", "Don’t Save", "Don't Save", "刪除", "不儲存"]
            if let b = buttons.first(where: { names.contains(attr($0, kAXTitleAttribute) as? String ?? "") }) {
                AXUIElementPerformAction(b, kAXPressAction as CFString)
                break
            }
        }
    }
    usleep(500_000)
    let left = windows(a).count
    if left == 0 { a.terminate() }
    out(["ok": left == 0, "windowsLeft": left])
case "activate":
    // give the front back to the app that had it before the test
    guard let s = args.dropFirst().first, let pid = pid_t(s), pid > 0 else { fail("usage: activate <pid>") }
    let ax = AXUIElementCreateApplication(pid)
    let r = AXUIElementSetAttributeValue(ax, kAXFrontmostAttribute as CFString, kCFBooleanTrue)
    out(["ok": r == .success])
case "mouse":
    let p = CGEvent(source: nil)?.location ?? .zero
    out(["ok": true, "x": Double(p.x), "y": Double(p.y)])
case "clip":
    out(["ok": true, "changeCount": NSPasteboard.general.changeCount, "string": NSPasteboard.general.string(forType: .string) ?? ""])
default:
    fail("unknown command \(command)")
}
