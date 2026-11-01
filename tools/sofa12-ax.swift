// Accessibility helper for the end-to-end update test (SOFA-12, tools/sofa12-update-e2e.mjs). It reads and presses the
// windows of one app, the test copy of SofaPad with Sparkle's update windows, the way a person clicks them. Needs the
// Accessibility permission for the terminal that runs the test.
//   ax tree <pid>                  every window of the app: id, title, frame, and its texts and buttons (JSON)
//   ax press <pid> <title>         presses the first button with that title (exit 1 when there is none)
//   ax menu <pid> [<item>]         opens the app's menu-bar menu, prints its items, presses <item> or closes it again
//   ax menushot <pid> <png>        opens the menu, takes a picture of the menu alone, closes it
//   ax front                       the pid of the app in front (the one that gets the keys)
//   ax locked                      1 while the Mac shows its lock screen (then nothing here can see or press anything)
//   ax stage <x> <y> <w> <h> <file> [bundle id]
//                                  a plain dark window over that part of the screen, with the line in <file> as its
//                                  caption (redrawn when the file changes): the backdrop of the screen recording. No
//                                  other app comes in front of it, except the one with that bundle id
import AppKit
import ApplicationServices
import Foundation

func attr(_ e: AXUIElement, _ name: String) -> AnyObject? {
    var v: AnyObject?
    return AXUIElementCopyAttributeValue(e, name as CFString, &v) == .success ? v : nil
}
func str(_ e: AXUIElement, _ name: String) -> String? { attr(e, name) as? String }
func children(_ e: AXUIElement) -> [AXUIElement] { (attr(e, kAXChildrenAttribute) as? [AXUIElement]) ?? [] }
func frame(_ e: AXUIElement) -> [String: Double] {
    var p = CGPoint.zero, s = CGSize.zero
    if let v = attr(e, kAXPositionAttribute) { AXValueGetValue(v as! AXValue, .cgPoint, &p) }
    if let v = attr(e, kAXSizeAttribute) { AXValueGetValue(v as! AXValue, .cgSize, &s) }
    return ["x": p.x, "y": p.y, "w": s.width, "h": s.height]
}

/// Texts and buttons inside an element, in reading order. Never back up into the application element (on a locked
/// screen macOS answers with it for everything), and at most a few thousand elements.
var visited = 0
func walk(_ e: AXUIElement, depth: Int = 0, into out: inout [[String: Any]]) {
    visited += 1
    guard depth < 25, visited < 4000 else { return }
    let role = str(e, kAXRoleAttribute) ?? ""
    if role == kAXApplicationRole as String { return }
    var item: [String: Any] = ["role": role]
    if let t = str(e, kAXTitleAttribute), !t.isEmpty { item["title"] = t }
    if let v = attr(e, kAXValueAttribute) as? String, !v.isEmpty { item["value"] = v }
    if let d = str(e, kAXDescriptionAttribute), !d.isEmpty { item["description"] = d }
    if role == kAXButtonRole as String { item["enabled"] = (attr(e, kAXEnabledAttribute) as? Bool) ?? false }
    if item.count > 1 { out.append(item) }
    for c in children(e) { walk(c, depth: depth + 1, into: &out) }
}

/// CGWindowIDs of the app's windows on screen, by title and frame (for `screencapture -l`).
func windowIDs(_ pid: pid_t) -> [[String: Any]] {
    let list = (CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]]) ?? []
    return list.filter { ($0[kCGWindowOwnerPID as String] as? Int32) == pid }.map { w in
        let b = (w[kCGWindowBounds as String] as? [String: Double]) ?? [:]
        return ["id": w[kCGWindowNumber as String] ?? 0, "title": w[kCGWindowName as String] ?? "", "layer": w[kCGWindowLayer as String] ?? 0,
                "x": b["X"] ?? 0, "y": b["Y"] ?? 0, "w": b["Width"] ?? 0, "h": b["Height"] ?? 0]
    }
}

func findButton(_ e: AXUIElement, _ title: String, depth: Int = 0) -> AXUIElement? {
    guard depth < 25, str(e, kAXRoleAttribute) != kAXApplicationRole as String else { return nil }
    if str(e, kAXRoleAttribute) == kAXButtonRole as String, str(e, kAXTitleAttribute) == title { return e }
    for c in children(e) { if let b = findButton(c, title, depth: depth + 1) { return b } }
    return nil
}

/// The app's windows. Normally its AXWindows; when that holds no real window (macOS answers with the application
/// element on a locked screen, I-54), the windows the window server shows for the app, found by hit-testing inside
/// each one.
func appWindows(_ pid: pid_t) -> [AXUIElement] {
    let app = AXUIElementCreateApplication(pid)
    let listed = ((attr(app, kAXWindowsAttribute) as? [AXUIElement]) ?? []).filter { str($0, kAXRoleAttribute) == kAXWindowRole as String }
    if !listed.isEmpty { return listed }
    var found: [AXUIElement] = []
    let sys = AXUIElementCreateSystemWide()
    for w in windowIDs(pid) where (w["layer"] as? Int ?? 0) == 0 {
        let (x, y, wd) = (w["x"] as? Double ?? 0, w["y"] as? Double ?? 0, w["w"] as? Double ?? 0)
        var hit: AXUIElement?
        guard AXUIElementCopyElementAtPosition(sys, Float(x + wd / 2), Float(y + 12), &hit) == .success, let h = hit else { continue }
        var owner: pid_t = 0
        AXUIElementGetPid(h, &owner)
        guard owner == pid else { continue }
        var cur: AXUIElement? = h
        while let c = cur, str(c, kAXRoleAttribute) != kAXWindowRole as String {
            cur = attr(c, kAXParentAttribute).map { $0 as! AXUIElement }
        }
        if let win = cur, !found.contains(where: { CFEqual($0, win) }) { found.append(win) }
    }
    return found
}

func emit(_ obj: Any) {
    let data = try! JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys])
    print(String(decoding: data, as: UTF8.self))
}

let args = CommandLine.arguments
guard args.count >= 2 else { print("usage: ax tree|press|menu|stage …"); exit(2) }
switch args[1] {
case "tree":
    let pid = pid_t(args[2])!
    let windows = appWindows(pid)
    emit(["windows": windows.map { w -> [String: Any] in
        var items: [[String: Any]] = []
        walk(w, into: &items)
        return ["title": str(w, kAXTitleAttribute) ?? "", "frame": frame(w), "items": items]
    }, "ids": windowIDs(pid)])
case "press":
    let pid = pid_t(args[2])!
    for w in appWindows(pid) {
        if let b = findButton(w, args[3]) {
            exit(AXUIElementPerformAction(b, kAXPressAction as CFString) == .success ? 0 : 1)
        }
    }
    exit(1)
case "menu", "menushot":
    let pid = pid_t(args[2])!
    let app = AXUIElementCreateApplication(pid)
    guard let bar = attr(app, "AXExtrasMenuBar"), let item = children(bar as! AXUIElement).first else { exit(1) }
    AXUIElementPerformAction(item, kAXPressAction as CFString)
    Thread.sleep(forTimeInterval: 0.6)
    let menu = children(item).first
    let items = menu.map(children) ?? []
    emit(items.map { str($0, kAXTitleAttribute) ?? "" })
    if args[1] == "menushot", let menu {
        // the open menu is the app's window on the pop-up menu layer
        let shot = windowIDs(pid).filter { ($0["layer"] as? Int ?? 0) > 0 }.max { ($0["h"] as? Double ?? 0) < ($1["h"] as? Double ?? 0) }
        if let id = shot?["id"] {
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
            p.arguments = ["-x", "-o", "-l", "\(id)", args[3]]
            try? p.run()
            p.waitUntilExit()
        }
        AXUIElementPerformAction(menu, kAXCancelAction as CFString)
    } else if args.count > 3, let hit = items.first(where: { str($0, kAXTitleAttribute) == args[3] }) {
        AXUIElementPerformAction(hit, kAXPressAction as CFString)
    } else if let menu {
        AXUIElementPerformAction(menu, kAXCancelAction as CFString)
    }
case "locked":
    let session = CGSessionCopyCurrentDictionary() as? [String: Any] ?? [:]
    print((session["CGSSessionScreenIsLocked"] as? Bool) == true ? 1 : 0)
case "front":
    print(NSWorkspace.shared.frontmostApplication?.processIdentifier ?? 0)
case "stage":
    let (x, y, w, h) = (Double(args[2])!, Double(args[3])!, Double(args[4])!, Double(args[5])!)
    let file = args[6]
    let allowed = args.count > 7 ? args[7] : ""   // the app the recording is about: it may come in front of the stage
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    let screen = NSScreen.screens[0].frame
    final class StageWindow: NSWindow { override var canBecomeKey: Bool { true } }   // borderless windows cannot, by default
    let window = StageWindow(contentRect: NSRect(x: x, y: screen.height - y - h, width: w, height: h),
                             styleMask: [.borderless], backing: .buffered, defer: false)
    window.backgroundColor = NSColor(calibratedRed: 0.09, green: 0.1, blue: 0.13, alpha: 1)
    window.isReleasedWhenClosed = false
    let caption = NSTextField(labelWithString: "")
    caption.font = .monospacedSystemFont(ofSize: 15, weight: .medium)
    caption.textColor = NSColor(white: 0.85, alpha: 1)
    caption.frame = NSRect(x: 24, y: h - 60, width: w - 48, height: 40)
    caption.maximumNumberOfLines = 2
    window.contentView?.addSubview(caption)
    // The stage is the active app before the recorded app is: when that one quits, macOS hands the front back to the
    // stage, not to whatever was in front before. Any other app that still comes forward is covered again at once.
    let takeFront = {
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        AXUIElementSetAttributeValue(AXUIElementCreateApplication(getpid()), kAXFrontmostAttribute as CFString, kCFBooleanTrue)
    }
    DispatchQueue.main.async(execute: takeFront)
    NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { note in
        guard let other = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
              other.processIdentifier != getpid(), other.bundleIdentifier != allowed else { return }
        takeFront()
    }
    Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { _ in
        let line = (try? String(contentsOfFile: file, encoding: .utf8)) ?? ""
        if line == "quit" { exit(0) }
        if caption.stringValue != line { caption.stringValue = line }
    }
    app.run()
default:
    print("unknown command")
    exit(2)
}
