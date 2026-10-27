import Foundation

public enum MouseButton: String, Equatable {
    case left, right, middle
}

/// Messages from the phone. JSON objects with a short "t" type field (see design/SPEC.md §4).
public enum ClientMessage: Equatable {
    case pairRequest(device: String)
    case auth(code: String?, proof: String?, device: String, sid: String)
    case move(dx: Double, dy: Double)
    /// Absolute jump on the mini-map: x, y in 0…1 of the display under the cursor.
    case jump(x: Double, y: Double)
    case scroll(dx: Double, dy: Double)
    case click(MouseButton)
    case down(MouseButton)
    case up(MouseButton)
    case text(id: Int, text: String)
    case key(id: Int, name: String, mods: [String], repeat: Int)
    case releaseAll
    case ping(ts: Double)

    public enum DecodeError: Error, Equatable {
        case notJSON
        case missingType
        case unknownType(String)
        case badField(String)
    }

    public static func decode(_ text: String) throws -> ClientMessage {
        guard let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw DecodeError.notJSON }
        guard let t = obj["t"] as? String else { throw DecodeError.missingType }

        func num(_ k: String) throws -> Double {
            guard let v = obj[k] as? NSNumber, CFGetTypeID(v) != CFBooleanGetTypeID(), v.doubleValue.isFinite else {
                throw DecodeError.badField(k)
            }
            return v.doubleValue
        }
        func int(_ k: String) throws -> Int {
            let d = try num(k)
            guard d == d.rounded(), abs(d) < 9e15 else { throw DecodeError.badField(k) }
            return Int(d)
        }
        func str(_ k: String) throws -> String {
            guard let v = obj[k] as? String else { throw DecodeError.badField(k) }
            return v
        }
        func button() throws -> MouseButton {
            let raw = (obj["b"] as? String) ?? "left"
            guard let b = MouseButton(rawValue: raw) else { throw DecodeError.badField("b") }
            return b
        }

        switch t {
        case "pair_request":
            return .pairRequest(device: (obj["device"] as? String) ?? "")
        case "auth":
            let code = obj["code"] as? String
            let proof = obj["proof"] as? String
            guard code != nil || proof != nil else { throw DecodeError.badField("code/proof") }
            return .auth(code: code, proof: proof, device: (obj["device"] as? String) ?? "", sid: (obj["sid"] as? String) ?? "")
        case "move": return .move(dx: try num("dx"), dy: try num("dy"))
        case "jump": return .jump(x: try num("x"), y: try num("y"))
        case "scroll": return .scroll(dx: (try? num("dx")) ?? 0, dy: try num("dy"))
        case "click": return .click(try button())
        case "down": return .down(try button())
        case "up": return .up(try button())
        case "text": return .text(id: try int("id"), text: try str("s"))
        case "key":
            let mods = (obj["mods"] as? [String]) ?? []
            let n = obj["n"] == nil ? 1 : try int("n")
            guard (1...200).contains(n) else { throw DecodeError.badField("n") }
            return .key(id: try int("id"), name: try str("k"), mods: mods, repeat: n)
        case "release_all": return .releaseAll
        case "ping": return .ping(ts: try num("ts"))
        default: throw DecodeError.unknownType(t)
        }
    }
}

public enum ServerMessage {
    public static func encode(_ fields: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: fields, options: [.sortedKeys]),
              let s = String(data: data, encoding: .utf8) else { return "{}" }
        return s
    }
}

/// What the session needs from the operating system. The real implementation posts CGEvents;
/// tests use `RecordingInjector`.
public protocol InputInjector: AnyObject {
    func moveBy(dx: Double, dy: Double)
    /// x, y in 0…1 of the display the cursor is on.
    func jump(x: Double, y: Double)
    func scroll(dx: Double, dy: Double)
    func click(_ button: MouseButton)
    func press(_ button: MouseButton, down: Bool)
    /// Types text. Returns the method actually used ("type" or "paste").
    @discardableResult func type(_ text: String) -> String
    func key(_ stroke: KeyStroke)
    func releaseAll()
    /// nil when unknown. False means events will be dropped by macOS (no Accessibility permission).
    var hasPermission: Bool { get }
    /// True while macOS Secure Input is on (password fields); typed text is blocked then.
    var secureInputActive: Bool { get }
    /// Size in points of the display the cursor is on (for the phone's mini-map).
    var screenSize: (width: Double, height: Double) { get }
    /// True while the Mac shows the lock screen. Nothing is injected then: keys would land in the
    /// login window's password field.
    var screenLocked: Bool { get }
    /// macOS shortcuts the phone's gestures rely on that are switched off (SystemShortcutCheck names).
    var disabledSystemShortcuts: [String] { get }
    /// Spaces (desktops + full-screen apps) on the display that has the most; nil when unknown.
    var spaceCount: Int? { get }
}

public extension InputInjector {
    var disabledSystemShortcuts: [String] { [] }
    var spaceCount: Int? { nil }
}

public final class RecordingInjector: InputInjector {
    public enum Event: Equatable {
        case move(Double, Double)
        case jump(Double, Double)
        case scroll(Double, Double)
        case click(MouseButton)
        case press(MouseButton, Bool)
        case type(String)
        case key(KeyStroke)
        case releaseAll
    }

    public private(set) var events: [Event] = []
    public var hasPermission = true
    public var secureInputActive = false
    public var screenSize: (width: Double, height: Double) = (1920, 1080)
    public var screenLocked = false
    public var disabledSystemShortcuts: [String] = []
    public var spaceCount: Int?
    private let lock = NSLock()
    public var onEvent: ((Event) -> Void)?

    public init() {}

    private func record(_ e: Event) {
        lock.lock(); events.append(e); lock.unlock()
        onEvent?(e)
    }

    public var snapshot: [Event] { lock.lock(); defer { lock.unlock() }; return events }
    public func reset() { lock.lock(); events = []; lock.unlock() }

    public func moveBy(dx: Double, dy: Double) { record(.move(dx, dy)) }
    public func jump(x: Double, y: Double) { record(.jump(x, y)) }
    public func scroll(dx: Double, dy: Double) { record(.scroll(dx, dy)) }
    public func click(_ button: MouseButton) { record(.click(button)) }
    public func press(_ button: MouseButton, down: Bool) { record(.press(button, down)) }
    public func type(_ text: String) -> String { record(.type(text)); return "type" }
    public func key(_ stroke: KeyStroke) { record(.key(stroke)) }
    public func releaseAll() { record(.releaseAll) }
}
