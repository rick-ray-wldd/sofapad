import Foundation

/// Decision rule of the end-to-end test guard (D-10, PKM-1-1, PKM-1-3), kept free of AppKit so it can be unit tested.
/// The AppKit side (front-most app, hit-tested window owner) lives in pkm-server's `E2EGuard`.
public enum E2EGuardPolicy {
    /// - Parameters:
    ///   - targetsWindow: true for clicks and scrolls (they go to the window under the cursor); false for keys,
    ///     moves and drags (keys go to the front-most app, moving the cursor clicks nothing).
    ///   - front: pid of the front-most app; nil when unknown.
    ///   - hitOwner: pid owning the window a real mouse-down at the event location would hit; nil when unknown.
    /// Unknown is treated as "not the probe": the event is dropped.
    public static func allows(targetsWindow: Bool, probePid: Int32, front: Int32?, hitOwner: Int32?) -> Bool {
        guard front == probePid else { return false }
        return !targetsWindow || hitOwner == probePid
    }

    /// Shortcuts that act on the whole Mac even while the probe is front-most (switch Spaces, Mission Control,
    /// app switcher, Spotlight, screenshots, lock / log out, force quit, show Desktop, Dock hiding).
    /// PKM-2 §2-5: never really injected during e2e tests; only checked in dry-run and unit tests.
    public static func isSystemWide(keyCode: UInt16, flags: UInt64) -> Bool {
        let cmd = flags & Modifier.cmd.flag != 0
        let ctrl = flags & Modifier.ctrl.flag != 0
        let shift = flags & Modifier.shift.flag != 0
        let opt = flags & Modifier.opt.flag != 0
        switch keyCode {
        case 0x7B, 0x7C, 0x7D, 0x7E: return ctrl && !cmd          // ⌃←→↑↓ Spaces, Mission Control, App Exposé
        case 0x30: return cmd                                       // ⌘Tab app switcher
        case 0x31: return cmd || ctrl                               // ⌘Space Spotlight, ⌃Space input source
        case 0x14, 0x15, 0x17: return cmd && shift                  // ⇧⌘3/4/5 (± ⌃) screenshots
        case 0x0C: return cmd && (ctrl || shift)                    // ⌃⌘Q lock screen, ⇧⌘Q log out
        case 0x35: return cmd && opt                                // ⌥⌘Esc force quit
        case 0x02: return cmd && opt                                // ⌥⌘D Dock hiding
        case 0x63, 0x76, 0x67: return true                          // F3, F4, F11 (Mission Control, Launchpad, Desktop)
        default: return false
        }
    }
}

/// Read-only check of the macOS keyboard shortcuts the phone's gestures rely on (D-15). Nothing is changed:
/// when one is switched off, the phone tells Ray where to switch it on.
public enum SystemShortcutCheck {
    /// com.apple.symbolichotkeys IDs → names the phone knows. 79 / 81 Move left / right a space (⌃← / ⌃→),
    /// 32 Mission Control (⌃↑), 33 Application windows (⌃↓).
    public static let watched: [(id: String, name: String)] = [
        ("79", "spaceLeft"), ("81", "spaceRight"), ("32", "missionControl"), ("33", "appWindows"),
    ]

    /// Names of watched shortcuts that are explicitly disabled. A missing entry means the system default (on).
    public static func disabled(in hotkeys: [String: Any]?) -> [String] {
        guard let hotkeys else { return [] }
        return watched.compactMap { w in
            guard let entry = hotkeys[w.id] as? [String: Any] else { return nil }
            let enabled = (entry["enabled"] as? Bool) ?? (entry["enabled"] as? Int).map { $0 != 0 } ?? true
            return enabled ? nil : w.name
        }
    }

    /// Reads the current user's setting (CFPreferences, read-only; synchronized first so a change made in
    /// System Settings after the app started is seen).
    public static func disabledNow() -> [String] {
        let domain = "com.apple.symbolichotkeys" as CFString
        CFPreferencesAppSynchronize(domain)
        return disabled(in: CFPreferencesCopyAppValue("AppleSymbolicHotKeys" as CFString, domain) as? [String: Any])
    }

    /// The watched shortcut a stroke is (exactly ⌃ + arrow), e.g. ⌃← → "spaceLeft"; nil for anything else.
    public static func hotkeyName(keyCode: UInt16, flags: UInt64) -> String? {
        let mods = flags & (Modifier.cmd.flag | Modifier.shift.flag | Modifier.opt.flag | Modifier.ctrl.flag)
        guard mods == Modifier.ctrl.flag else { return nil }
        return [0x7B: "spaceLeft", 0x7C: "spaceRight", 0x7E: "missionControl", 0x7D: "appWindows"][keyCode]
    }

    /// Spaces on the display that has the most, from the Dock's com.apple.spaces preferences
    /// (SpacesDisplayConfiguration → Management Data → Monitors → Spaces; desktops and full-screen apps both count,
    /// since ⌃← / ⌃→ move between both). Read-only and best effort: nil when the format is not recognised.
    public static func spaceCount(in config: [String: Any]?) -> Int? {
        guard let display = config?["SpacesDisplayConfiguration"] as? [String: Any],
              let data = display["Management Data"] as? [String: Any],
              let monitors = data["Monitors"] as? [[String: Any]] else { return nil }
        let counts = monitors.compactMap { ($0["Spaces"] as? [Any])?.count }
        return counts.max()
    }

    public static func spaceCountNow() -> Int? {
        let domain = "com.apple.spaces" as CFString
        CFPreferencesAppSynchronize(domain)
        let key = "SpacesDisplayConfiguration" as CFString
        guard let v = CFPreferencesCopyAppValue(key, domain) else { return nil }
        return spaceCount(in: ["SpacesDisplayConfiguration": v])
    }
}
