import Foundation

public enum Modifier: String, CaseIterable, Equatable {
    case cmd, shift, opt, ctrl, fn

    /// CGEventFlags raw values.
    public var flag: UInt64 {
        switch self {
        case .cmd: return 0x0010_0000   // maskCommand
        case .shift: return 0x0002_0000 // maskShift
        case .opt: return 0x0008_0000   // maskAlternate
        case .ctrl: return 0x0004_0000  // maskControl
        case .fn: return 0x0080_0000    // maskSecondaryFn
        }
    }

    /// Virtual key code of the left-hand modifier key (fn has no regular key code we post).
    public var keyCode: UInt16? {
        switch self {
        case .cmd: return 0x37
        case .shift: return 0x38
        case .opt: return 0x3A
        case .ctrl: return 0x3B
        case .fn: return nil
        }
    }

    public static func parse(_ s: String) -> Modifier? {
        switch s.lowercased() {
        case "cmd", "command", "meta", "⌘": return .cmd
        case "shift", "⇧": return .shift
        case "opt", "option", "alt", "⌥": return .opt
        case "ctrl", "control", "⌃": return .ctrl
        case "fn": return .fn
        default: return nil
        }
    }
}

public struct KeyStroke: Equatable {
    public var keyCode: UInt16
    public var modifiers: [Modifier]
    public init(keyCode: UInt16, modifiers: [Modifier] = []) {
        self.keyCode = keyCode
        self.modifiers = modifiers
    }
    public var flags: UInt64 { modifiers.reduce(0) { $0 | $1.flag } }
    /// Flags of the key-down / key-up event: the modifiers plus what the key itself carries on a real keyboard
    /// (arrow keys: SecondaryFn + NumericPad). Without them ⌃← / ⌃→ never switch Spaces (I-18).
    public var eventFlags: UInt64 { flags | KeyMap.intrinsicFlags(keyCode: keyCode) }
}

/// Named keys → macOS virtual key codes (ANSI layout, Carbon kVK_* values).
public enum KeyMap {
    static let named: [String: UInt16] = [
        "enter": 0x24, "return": 0x24, "tab": 0x30, "space": 0x31,
        "backspace": 0x33, "delete": 0x33, "forwarddelete": 0x75, "escape": 0x35, "esc": 0x35,
        "left": 0x7B, "right": 0x7C, "down": 0x7D, "up": 0x7E,
        "home": 0x73, "end": 0x77, "pageup": 0x74, "pagedown": 0x79,
        "f1": 0x7A, "f2": 0x78, "f3": 0x63, "f4": 0x76, "f5": 0x60, "f6": 0x61,
        "f7": 0x62, "f8": 0x64, "f9": 0x65, "f10": 0x6D, "f11": 0x67, "f12": 0x6F,
        "capslock": 0x39,
    ]

    static let characters: [Character: UInt16] = [
        "a": 0x00, "s": 0x01, "d": 0x02, "f": 0x03, "h": 0x04, "g": 0x05, "z": 0x06, "x": 0x07,
        "c": 0x08, "v": 0x09, "b": 0x0B, "q": 0x0C, "w": 0x0D, "e": 0x0E, "r": 0x0F, "y": 0x10,
        "t": 0x11, "1": 0x12, "2": 0x13, "3": 0x14, "4": 0x15, "6": 0x16, "5": 0x17, "=": 0x18,
        "9": 0x19, "7": 0x1A, "-": 0x1B, "8": 0x1C, "0": 0x1D, "]": 0x1E, "o": 0x1F, "u": 0x20,
        "[": 0x21, "i": 0x22, "p": 0x23, "l": 0x25, "j": 0x26, "'": 0x27, "k": 0x28, ";": 0x29,
        "\\": 0x2A, ",": 0x2B, "/": 0x2C, "n": 0x2D, "m": 0x2E, ".": 0x2F, "`": 0x32,
    ]

    public static let numericPadFlag: UInt64 = 0x0020_0000   // maskNumericPad
    static let arrowKeys: Set<UInt16> = [0x7B, 0x7C, 0x7D, 0x7E]
    /// Home, End, Page Up/Down, Forward Delete, Help and F1–F12.
    static let functionKeys: Set<UInt16> = [0x73, 0x77, 0x74, 0x79, 0x75, 0x72,
                                            0x7A, 0x78, 0x63, 0x76, 0x60, 0x61, 0x62, 0x64, 0x65, 0x6D, 0x67, 0x6F]

    /// Flags a key carries by itself, the same ones CGEvent(keyboardEventSource:virtualKey:keyDown:) gives a new
    /// event and AppKit documents for NSEvent.ModifierFlags (.numericPad: "a key in the numeric keypad or an arrow
    /// key"; .function: arrow and navigation keys, F-keys). CGInjector replaces the event's flags with the
    /// modifiers, so these have to be added back.
    public static func intrinsicFlags(keyCode: UInt16) -> UInt64 {
        if arrowKeys.contains(keyCode) { return Modifier.fn.flag | numericPadFlag }
        if functionKeys.contains(keyCode) { return Modifier.fn.flag }
        return 0
    }

    public static func keyCode(for name: String) -> UInt16? {
        let n = name.lowercased()
        if let code = named[n] { return code }
        if n.count == 1, let c = n.first, let code = characters[c] { return code }
        return nil
    }

    public static func stroke(name: String, modifiers: [String]) -> KeyStroke? {
        guard let code = keyCode(for: name) else { return nil }
        var mods: [Modifier] = []
        for m in modifiers {
            guard let mod = Modifier.parse(m) else { return nil }
            if !mods.contains(mod) { mods.append(mod) }
        }
        return KeyStroke(keyCode: code, modifiers: mods)
    }
}

/// How a piece of text is typed: runs of characters go in as Unicode keyboard events,
/// newlines and tabs become real Return / Tab key presses.
public enum TextStep: Equatable {
    case unicode(String)
    case key(KeyStroke)
}

public enum TextPlanner {
    /// `maxUTF16` limits one keyboard event's Unicode payload; grapheme clusters are never split.
    public static func plan(_ text: String, maxUTF16: Int = 1) -> [TextStep] {
        var steps: [TextStep] = []
        var run = ""
        var runLen = 0
        func flush() {
            if !run.isEmpty { steps.append(.unicode(run)); run = ""; runLen = 0 }
        }
        let normalized = text.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n")
        for ch in normalized {
            if ch == "\n" { flush(); steps.append(.key(KeyStroke(keyCode: 0x24))); continue }
            if ch == "\t" { flush(); steps.append(.key(KeyStroke(keyCode: 0x30))); continue }
            let len = ch.utf16.count
            if runLen > 0 && runLen + len > maxUTF16 { flush() }
            run.append(ch)
            runLen += len
        }
        flush()
        return steps
    }
}
