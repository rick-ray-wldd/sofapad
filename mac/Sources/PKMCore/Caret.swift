import Foundation

/// SOFA-6 cursor pad: hold and drag on the phone to move the Mac's text cursor. It may only press the four arrow keys,
/// with Shift (select) and Option (a word at a time) — nothing else, whatever the phone sends.
public enum CaretPolicy {
    public static let keys: Set<String> = ["left", "right", "up", "down"]
    public static let modifiers: Set<Modifier> = [.shift, .opt]
    /// Presses in one message.
    public static let maxRepeat = 4
    /// Presses per second the Mac accepts; the phone sends at most 30.
    public static let maxPerSecond = 40.0
    /// A press held up longer than this (ms, measured against the phone's own pings) is dropped: a cursor that keeps
    /// moving after the finger has stopped is worse than one that stops short.
    public static let lateLimit = 500.0
}

/// Token bucket for cursor-pad presses (work queue only).
public struct CaretBudget {
    private var tokens = CaretPolicy.maxPerSecond
    private var last: Double?
    public init() {}

    /// `now` in seconds. False = over the rate: drop these presses.
    public mutating func take(_ n: Int, now: Double) -> Bool {
        if let last { tokens = min(CaretPolicy.maxPerSecond, tokens + (now - last) * CaretPolicy.maxPerSecond) }
        last = now
        guard tokens >= Double(n) else { return false }
        tokens -= Double(n)
        return true
    }
}
