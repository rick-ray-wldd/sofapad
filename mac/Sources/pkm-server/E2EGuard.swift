import AppKit
import CoreGraphics
import PKMCore

/// Test-only safety net (D-10, PKM-1-1): never let an injected event reach any app but the probe.
/// Both rules stay (PKM-1-3): the probe must be front-most, and clicks/scrolls must hit a window owned by the probe.
enum E2EGuard {
    static func allows(_ event: CGEvent, probePid: pid_t, windows: Set<Int> = []) -> Bool {
        let targetsWindow: Bool
        switch event.type {
        case .mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged,
             .keyDown, .keyUp, .flagsChanged:
            targetsWindow = false   // keys go to the front-most app (checked by the policy); moving the cursor clicks nothing
        default:
            targetsWindow = true    // clicks and scrolls go to the window under the cursor, which may belong to another app
        }
        if event.type == .keyDown || event.type == .keyUp,
           E2EGuardPolicy.isSystemWide(keyCode: UInt16(event.getIntegerValueField(.keyboardEventKeycode)),
                                       flags: event.flags.rawValue) {
            return false   // would act on the whole Mac even with the probe in front (PKM-2 §2-5)
        }
        let location = event.location
        return onMain {
            E2EGuardPolicy.allows(targetsWindow: targetsWindow, probePid: probePid,
                                  front: NSWorkspace.shared.frontmostApplication?.processIdentifier,
                                  hitOwner: targetsWindow ? windowOwner(at: location) : nil)
                && (windows.isEmpty || frontWindow(of: probePid).map(windows.contains) == true)
        }
    }

    /// The probe's front-most normal window (CGWindowList is ordered front to back); window numbers need no
    /// Screen Recording permission, titles would.
    static func frontWindow(of pid: pid_t) -> Int? {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return nil }
        return list.first { ($0[kCGWindowOwnerPID as String] as? Int) == Int(pid) && ($0[kCGWindowLayer as String] as? Int) == 0 }?[kCGWindowNumber as String] as? Int
    }

    /// Owner of the window a real mouse-down at `point` (CG global coordinates) would hit; nil when unknown.
    /// AppKit's hit test skips click-through windows such as the full-screen Dock and Notification Center
    /// overlays that sit above every app window (I-11); the top-most window in CGWindowList does not.
    /// Needs NSApplication.shared to exist (otherwise the hit test returns 0) and the main thread.
    static func windowOwner(at point: CGPoint) -> pid_t? {
        guard let primary = NSScreen.screens.first else { return nil }
        let cocoa = NSPoint(x: point.x, y: primary.frame.maxY - point.y)
        let number = NSWindow.windowNumber(at: cocoa, belowWindowWithWindowNumber: 0)
        guard number > 0,
              let info = (CGWindowListCopyWindowInfo([.optionIncludingWindow], CGWindowID(number)) as? [[String: Any]])?.first,
              let pid = info[kCGWindowOwnerPID as String] as? Int else { return nil }
        return pid_t(pid)
    }

    private static func onMain<T>(_ work: () -> T) -> T {
        Thread.isMainThread ? work() : DispatchQueue.main.sync(execute: work)
    }
}
