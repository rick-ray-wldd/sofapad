import Foundation

/// Spacing between the parts of live typing on the Mac (I-21). With an input method such as Zhuyin active, text
/// goes in as clipboard + ⌘V. A receiving app (a terminal, an Electron app) can take "⌫⌫ then ⌘V" that arrive
/// together as one chunk and lose the ⌫ — the old word stays and the new one is pasted after it (Ray's 疊字).
/// A slow app also reads the clipboard for a ⌘V late, after the next paste has already replaced it.
/// So: text waits a moment after keys, keys wait after a paste, and a paste waits after the previous paste.
/// Key after key (holding ⌫) and text after text are not slowed down.
public struct InjectionPacer {
    public enum Kind: Equatable { case key, text, paste }

    public var keyToText: TimeInterval = 0.05
    public var pasteToKey: TimeInterval = 0.05
    public var pasteToPaste: TimeInterval = 0.15
    private var last: (kind: Kind, at: TimeInterval)?

    public init() {}

    /// Seconds to wait before doing `kind` at `now` (0 when it can go right away).
    public func wait(before kind: Kind, now: TimeInterval) -> TimeInterval {
        guard let last else { return 0 }
        let gap: TimeInterval
        switch (last.kind, kind) {
        case (.key, .text), (.key, .paste): gap = keyToText
        case (.paste, .key), (.paste, .text): gap = pasteToKey
        case (.paste, .paste): gap = pasteToPaste
        default: gap = 0
        }
        return max(0, gap - (now - last.at))
    }

    /// Record that `kind` finished at `at`.
    public mutating func did(_ kind: Kind, at: TimeInterval) {
        last = (kind, at)
    }
}

/// What the clipboard should go back to after a paste (I-21). Within a burst of pastes the clipboard still holds
/// our own temporary item from the previous paste; saving that would put dictated text on the clipboard at the end
/// and lose what the user had copied. So a paste that finds our item still there keeps the earlier snapshot.
public struct ClipboardKeeper<Snapshot> {
    private var held: (changeCount: Int, snapshot: Snapshot)?

    public init() {}

    /// The snapshot to restore after this paste. `changeCount` is the clipboard's count before writing.
    public mutating func snapshotForPaste(changeCount: Int, current: () -> Snapshot) -> Snapshot {
        if let held, held.changeCount == changeCount { return held.snapshot }
        return current()
    }

    /// Our item is on the clipboard now, with this change count.
    public mutating func wrote(changeCount: Int, restoring snapshot: Snapshot) {
        held = (changeCount, snapshot)
    }

    /// Restore only if nobody (us or the user) has written to the clipboard since this paste.
    public mutating func shouldRestore(ours: Int, now changeCount: Int) -> Bool {
        guard ours == changeCount else { return false }
        held = nil
        return true
    }
}
