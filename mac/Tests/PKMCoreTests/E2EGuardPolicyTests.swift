import XCTest
@testable import PKMCore

/// The e2e guard keeps both rules (PKM-1-3): probe front-most, and clicks/scrolls must hit a probe window.
final class E2EGuardPolicyTests: XCTestCase {
    let probe: Int32 = 4242
    let orca: Int32 = 81665

    func testKeysAndMovesNeedTheProbeInFront() {
        XCTAssertTrue(E2EGuardPolicy.allows(targetsWindow: false, probePid: probe, front: probe, hitOwner: nil))
        XCTAssertFalse(E2EGuardPolicy.allows(targetsWindow: false, probePid: probe, front: orca, hitOwner: probe))
        XCTAssertFalse(E2EGuardPolicy.allows(targetsWindow: false, probePid: probe, front: nil, hitOwner: probe))
    }

    func testClicksNeedBothFrontAndHitWindow() {
        XCTAssertTrue(E2EGuardPolicy.allows(targetsWindow: true, probePid: probe, front: probe, hitOwner: probe))
        // probe in front but the click would land on another app's window
        XCTAssertFalse(E2EGuardPolicy.allows(targetsWindow: true, probePid: probe, front: probe, hitOwner: orca))
        // click would land on the probe but another app is in front: not loosened to a front-only or hit-only check
        XCTAssertFalse(E2EGuardPolicy.allows(targetsWindow: true, probePid: probe, front: orca, hitOwner: probe))
    }

    func testUnknownWindowOrOwnerIsBlocked() {
        XCTAssertFalse(E2EGuardPolicy.allows(targetsWindow: true, probePid: probe, front: probe, hitOwner: nil))
        XCTAssertFalse(E2EGuardPolicy.allows(targetsWindow: true, probePid: probe, front: nil, hitOwner: nil))
    }
}

/// PKM-2 §2-5: system-wide shortcuts are never really injected in e2e mode; the gestures' shortcuts are checked.
final class SystemShortcutTests: XCTestCase {
    func flags(_ mods: Modifier...) -> UInt64 { mods.reduce(0) { $0 | $1.flag } }

    func testSystemWideShortcutsAreRecognised() {
        let blocked: [(UInt16, UInt64, String)] = [
            (0x7B, flags(.ctrl), "⌃← Space left"), (0x7C, flags(.ctrl), "⌃→ Space right"),
            (0x7E, flags(.ctrl), "⌃↑ Mission Control"), (0x7D, flags(.ctrl), "⌃↓ App Exposé"),
            (0x30, flags(.cmd), "⌘Tab"), (0x31, flags(.cmd), "⌘Space"),
            (0x14, flags(.shift, .cmd), "⇧⌘3"), (0x15, flags(.shift, .cmd), "⇧⌘4"), (0x17, flags(.shift, .cmd), "⇧⌘5"),
            (0x15, flags(.ctrl, .shift, .cmd), "⌃⇧⌘4"), (0x0C, flags(.ctrl, .cmd), "⌃⌘Q lock"),
            (0x35, flags(.opt, .cmd), "⌥⌘Esc"), (0x67, 0, "F11"),
        ]
        for (code, f, name) in blocked {
            XCTAssertTrue(E2EGuardPolicy.isSystemWide(keyCode: code, flags: f), name)
        }
    }

    func testOrdinaryShortcutsStillReachTheProbe() {
        let allowed: [(UInt16, UInt64, String)] = [
            (0x08, flags(.cmd), "⌘C"), (0x09, flags(.cmd), "⌘V"), (0x00, flags(.cmd), "⌘A"), (0x06, flags(.shift, .cmd), "⇧⌘Z"),
            (0x18, flags(.cmd), "⌘="), (0x1B, flags(.cmd), "⌘-"), (0x28, flags(.opt, .cmd), "⌥⌘K"),
            (0x7B, 0, "←"), (0x7B, flags(.cmd), "⌘←"), (0x7B, flags(.opt), "⌥←"), (0x14, 0, "3"), (0x31, 0, "space"),
            (0x24, 0, "Return"), (0x33, 0, "⌫"),
        ]
        for (code, f, name) in allowed {
            XCTAssertFalse(E2EGuardPolicy.isSystemWide(keyCode: code, flags: f), name)
        }
    }

    func testDisabledSpaceShortcutsAreReported() {
        XCTAssertEqual(SystemShortcutCheck.disabled(in: nil), [])
        XCTAssertEqual(SystemShortcutCheck.disabled(in: [:]), [], "missing entries = system default (on)")
        let hotkeys: [String: Any] = [
            "79": ["enabled": 0, "value": ["parameters": [65535, 123, 8650752]]],
            "81": ["enabled": true],
            "32": ["enabled": false],
            "60": ["enabled": 0],   // not watched
        ]
        XCTAssertEqual(SystemShortcutCheck.disabled(in: hotkeys), ["spaceLeft", "missionControl"])
    }
}

/// I-18: three-finger swipes sent ⌃+arrow without the flags a real arrow key carries, so Spaces never switched.
final class ArrowKeyFlagTests: XCTestCase {
    func testArrowKeysCarryFnAndNumericPadLikeAPhysicalKeyboard() {
        for name in ["left", "right", "up", "down"] {
            let s = KeyMap.stroke(name: name, modifiers: ["ctrl"])!
            XCTAssertEqual(s.eventFlags, 0x00A4_0000, "⌃\(name) = ⌃ + SecondaryFn + NumericPad")
            XCTAssertEqual(s.flags, Modifier.ctrl.flag, "the modifiers posted as flagsChanged stay ⌃ only")
        }
        XCTAssertEqual(KeyMap.stroke(name: "left", modifiers: [])!.eventFlags, 0x00A0_0000)
    }

    func testNavigationAndFunctionKeysCarryFn() {
        for name in ["home", "end", "pageup", "pagedown", "forwarddelete", "f1", "f5", "f12"] {
            XCTAssertEqual(KeyMap.stroke(name: name, modifiers: [])!.eventFlags, Modifier.fn.flag, name)
        }
    }

    func testOrdinaryKeysGetNoExtraFlags() {
        for name in ["a", "c", "3", "=", "space", "enter", "tab", "escape", "backspace"] {
            let s = KeyMap.stroke(name: name, modifiers: ["cmd"])!
            XCTAssertEqual(s.eventFlags, Modifier.cmd.flag, name)
        }
    }

    func testE2EGuardStillBlocksArrowShortcutsWithTheNewFlags() {
        let ctrlLeft = KeyMap.stroke(name: "left", modifiers: ["ctrl"])!
        XCTAssertTrue(E2EGuardPolicy.isSystemWide(keyCode: ctrlLeft.keyCode, flags: ctrlLeft.eventFlags))
        let cmdLeft = KeyMap.stroke(name: "left", modifiers: ["cmd"])!
        XCTAssertFalse(E2EGuardPolicy.isSystemWide(keyCode: cmdLeft.keyCode, flags: cmdLeft.eventFlags), "⌘← line start")
    }

    func testHotkeyNameIsExactlyControlArrow() {
        let ctrl = Modifier.ctrl.flag
        XCTAssertEqual(SystemShortcutCheck.hotkeyName(keyCode: 0x7B, flags: ctrl), "spaceLeft")
        XCTAssertEqual(SystemShortcutCheck.hotkeyName(keyCode: 0x7C, flags: ctrl | 0x00A0_0000), "spaceRight")
        XCTAssertEqual(SystemShortcutCheck.hotkeyName(keyCode: 0x7E, flags: ctrl), "missionControl")
        XCTAssertEqual(SystemShortcutCheck.hotkeyName(keyCode: 0x7D, flags: ctrl), "appWindows")
        XCTAssertNil(SystemShortcutCheck.hotkeyName(keyCode: 0x7B, flags: ctrl | Modifier.shift.flag))
        XCTAssertNil(SystemShortcutCheck.hotkeyName(keyCode: 0x7B, flags: Modifier.cmd.flag))
        XCTAssertNil(SystemShortcutCheck.hotkeyName(keyCode: 0x00, flags: ctrl))
    }

    func testSpaceCountFromDockPreferences() {
        func config(_ monitors: [[String: Any]]) -> [String: Any] {
            ["SpacesDisplayConfiguration": ["Management Data": ["Monitors": monitors]]]
        }
        // Shape seen on this Mac mini: one desktop on "Main", other displays collapsed (no Spaces key).
        XCTAssertEqual(SystemShortcutCheck.spaceCount(in: config([
            ["Display Identifier": "Main", "Spaces": [["type": 0]]],
            ["Display Identifier": "4A1C", "Collapsed Space": [:]],
        ])), 1)
        XCTAssertEqual(SystemShortcutCheck.spaceCount(in: config([
            ["Display Identifier": "Main", "Spaces": [["type": 0], ["type": 0], ["type": 4]]],
        ])), 3)
        XCTAssertNil(SystemShortcutCheck.spaceCount(in: nil))
        XCTAssertNil(SystemShortcutCheck.spaceCount(in: ["SpacesDisplayConfiguration": ["Other": 1]]))
        XCTAssertNil(SystemShortcutCheck.spaceCount(in: config([["Display Identifier": "Main"]])))
    }
}
