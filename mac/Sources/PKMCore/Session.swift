import Foundation

/// Remembers the last text/key id handled per phone page session, so a phone that reconnects and
/// resends unacknowledged text does not type it twice, and which ids were skipped as too late (PKM-4).
public final class DedupStore {
    private var last: [String: Int] = [:]
    private var skipped: [String: [Int]] = [:]
    private var order: [String] = []
    private let capacity: Int
    private let lock = NSLock()

    public init(capacity: Int = 32) { self.capacity = capacity }

    /// True when `id` is new for `sid` (and records it).
    public func accept(sid: String, id: Int) -> Bool {
        lock.lock(); defer { lock.unlock() }
        if let prev = last[sid], id <= prev { return false }
        if last[sid] == nil {
            order.append(sid)
            if order.count > capacity { let gone = order.removeFirst(); last[gone] = nil; skipped[gone] = nil }
        }
        last[sid] = id
        return true
    }

    /// The last id handled for `sid` (0 = nothing from this page yet, or this Mac app started since).
    public func lastAccepted(sid: String) -> Int {
        lock.lock(); defer { lock.unlock() }
        return last[sid] ?? 0
    }

    /// `id` arrived too late and was not typed: counts as handled (never typed later), but the phone is told.
    public func skip(sid: String, id: Int) {
        lock.lock(); defer { lock.unlock() }
        if let prev = last[sid], id <= prev { return }
        if last[sid] == nil { order.append(sid) }
        last[sid] = id
        skipped[sid, default: []].append(id)
        if skipped[sid]!.count > 200 { skipped[sid]!.removeFirst(skipped[sid]!.count - 200) }
    }

    public func skippedIds(sid: String) -> [Int] {
        lock.lock(); defer { lock.unlock() }
        return skipped[sid] ?? []
    }
}

/// How late a message from the phone is (PKM-4). The phone stamps text, keys and clicks with its own clock when it
/// puts them on the socket; pings carry the same clock. The smallest "arrived − sent" over recent pings is the clock
/// difference plus the quickest trip, so "arrived − sent − that" is how much longer this message took than a normal
/// trip — whatever the two clocks say. A message that sat in a stalled connection (Wi-Fi asleep, the phone already
/// gave up and reconnected) is seconds late: by then Ray may be in another window, so it is not typed.
public struct LatenessMeter {
    public var limit: Double = 3000          // ms
    private var samples: [Double] = []
    public init() {}

    public mutating func ping(sentWall: Double, arrived: Double) {
        samples.append(arrived - sentWall)
        if samples.count > 30 { samples.removeFirst(samples.count - 30) }
    }

    /// ms later than a quick trip, or nil before the first ping (nothing known yet: never drop then).
    public func lateness(sentWall: Double, arrived: Double) -> Double? {
        guard let base = samples.min() else { return nil }
        return arrived - sentWall - base
    }

    public func isLate(sentWall: Double?, arrived: Double) -> Bool {
        guard let sentWall, let l = lateness(sentWall: sentWall, arrived: arrived) else { return false }
        return l > limit
    }
}

/// One phone connection after the WebSocket handshake: authentication, then input commands.
public final class ControlSession {
    public enum CloseCode: UInt16 {
        case normal = 1000
        case protocolError = 1002
        case unauthorized = 4401
        case replaced = 4409
        case idle = 4408
    }

    public struct Limits {
        public var maxMove = 4000.0
        public var maxScroll = 4000.0
        public var maxTextChars = 20_000
        public init() {}
    }

    public let peerIP: String
    /// One-time challenge for the token proof; sent in the hello message.
    public let nonce = PairingManager.randomNonce()
    public private(set) var deviceName: String?
    public private(set) var sid = ""
    public var isAuthenticated: Bool { deviceName != nil }
    public var hostName = "Mac"

    /// Called once authentication succeeds (the server uses it to drop an older controller).
    public var onAuthenticated: ((ControlSession) -> Void)?
    public var log: ((String) -> Void)?
    /// Tests only (PKM-4): one JSON line per text/key with the phone's input time and when it was posted.
    public var timingLog: ((String) -> Void)?
    /// Changes every time the Mac app starts; the phone uses it to tell "not delivered" from "Mac restarted".
    public var boot = ""

    private let injector: InputInjector
    /// Every injector call runs here, in arrival order (PKM-4). Network reads, pings and pongs stay on the server's
    /// own queue, so a burst of slow clipboard pastes can no longer hold back a pong and look like a dead connection.
    private let work: DispatchQueue
    private let pairing: PairingManager
    private let dedup: DedupStore
    private let limits: Limits
    private let send: (String) -> Void
    private let close: (CloseCode, String) -> Void
    private var heldButtons: Set<String> = []
    private var lastPermission: Bool?
    private var lastSecure: Bool?
    private var lastLocked: Bool?
    private var meter = LatenessMeter()   // network queue only

    public init(peerIP: String, injector: InputInjector, pairing: PairingManager, dedup: DedupStore,
                limits: Limits = Limits(), work: DispatchQueue? = nil,
                send: @escaping (String) -> Void, close: @escaping (CloseCode, String) -> Void) {
        self.peerIP = peerIP
        self.injector = injector
        self.work = work ?? DispatchQueue(label: "pkm.inject")
        self.pairing = pairing
        self.dedup = dedup
        self.limits = limits
        self.send = send
        self.close = close
    }

    private func reply(_ fields: [String: Any]) { send(ServerMessage.encode(fields)) }

    /// First message after the WebSocket handshake.
    public func start() {
        reply(["t": "hello", "nonce": nonce, "host": hostName, "v": 1, "boot": boot, "ver": BuildInfo.version, "build": BuildInfo.build])
    }

    public func handle(_ text: String) {
        let started = DispatchTime.now().uptimeNanoseconds
        let message: ClientMessage
        do {
            message = try ClientMessage.decode(text)
        } catch {
            reply(["t": "error", "msg": "bad message: \(error)"])
            if !isAuthenticated { close(.protocolError, "bad message") }
            return
        }

        guard isAuthenticated else {
            handleUnauthenticated(message)
            return
        }
        let received = Date().timeIntervalSince1970 * 1000
        // the phone's clock fields (PKM-4): "wall" on pings, "sent" on text/keys/clicks, "at" = when it was typed
        let fields = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any] ?? [:]
        let num = { (k: String) -> Double? in (fields[k] as? NSNumber)?.doubleValue }
        if case .ping(let ts) = message {
            if let wall = num("wall") { meter.ping(sentWall: wall, arrived: received) }
            reply(["t": "pong", "ts": ts, "us": elapsedMicros(since: started)])
            work.async { self.pushStatusIfChanged() }
            return
        }
        let late = num("sent").flatMap { meter.isLate(sentWall: $0, arrived: received) ? meter.lateness(sentWall: $0, arrived: received) : nil }
        let at = num("at")
        work.async { self.perform(message, started: started, at: at, received: received, late: late) }
    }

    /// Injection, in arrival order, on `work`. `late` = ms this message was held up on the way (nil = on time).
    private func perform(_ message: ClientMessage, started: UInt64, at: Double?, received: Double, late: Double?) {
        if let late {
            // Held up in a stalled connection: the window in front now may not be the one it was typed for (PKM-4).
            switch message {
            case .text(let id, _), .key(let id, _, _, _):
                dedup.skip(sid: sid, id: id)
                reply(["t": "ack", "id": id, "ok": false, "err": "late", "late": Int(late)])
                log?("late by \(Int(late)) ms: id \(id) not typed")
                return
            case .click, .down:
                log?("late by \(Int(late)) ms: click not done")
                return
            default: break   // moves, scrolls and button-up still apply (an "up" must never be lost)
            }
        }
        if injector.screenLocked {
            switch message {
            case .text(let id, _), .key(let id, _, _, _):
                reply(["t": "ack", "id": id, "ok": false, "err": "locked"])
                pushStatusIfChanged()
                return
            case .move, .jump, .scroll, .click, .down, .up:
                pushStatusIfChanged()
                return
            default: break
            }
        }

        switch message {
        case .pairRequest, .auth:
            reply(["t": "error", "msg": "already authenticated"])
        case .ping:
            break
        case .move(let dx, let dy):
            injector.moveBy(dx: clamp(dx, limits.maxMove), dy: clamp(dy, limits.maxMove))
        case .jump(let x, let y):
            injector.jump(x: min(1, max(0, x)), y: min(1, max(0, y)))
        case .scroll(let dx, let dy):
            injector.scroll(dx: clamp(dx, limits.maxScroll), dy: clamp(dy, limits.maxScroll))
        case .click(let b):
            injector.click(b)
        case .down(let b):
            heldButtons.insert(b.rawValue)
            injector.press(b, down: true)
        case .up(let b):
            heldButtons.remove(b.rawValue)
            injector.press(b, down: false)
        case .releaseAll:
            heldButtons.removeAll()
            injector.releaseAll()
        case .text(let id, let s):
            guard s.count <= limits.maxTextChars else {
                reply(["t": "ack", "id": id, "ok": false, "err": "too long"])
                return
            }
            var fields: [String: Any] = ["t": "ack", "id": id, "ok": true]
            if dedup.accept(sid: sid, id: id) {
                if injector.secureInputActive { fields["warn"] = "secure_input" }
                fields["via"] = injector.type(s)
            } else {
                fields["dup"] = true
            }
            fields["us"] = elapsedMicros(since: started)
            reply(fields)
            timing(id: id, kind: "text", chars: s.count, at: at, received: received, via: fields["via"] as? String)
        case .key(let id, let name, let mods, let n):
            guard let stroke = KeyMap.stroke(name: name, modifiers: mods) else {
                reply(["t": "ack", "id": id, "ok": false, "err": "unknown key"])
                return
            }
            var fields: [String: Any] = ["t": "ack", "id": id, "ok": true]
            // ⌃←→↑↓: tell the phone, right away, why nothing may have happened on the Mac (PKM-2-3)
            if let hotkey = SystemShortcutCheck.hotkeyName(keyCode: stroke.keyCode, flags: stroke.flags) {
                fields["hotkey"] = hotkey
                fields["hotkeyOff"] = injector.disabledSystemShortcuts.contains(hotkey)
                if let s = injector.spaceCount { fields["spaces"] = s }
            }
            if dedup.accept(sid: sid, id: id) {
                for _ in 0..<n { injector.key(stroke) }
            } else {
                fields["dup"] = true
            }
            fields["us"] = elapsedMicros(since: started)
            reply(fields)
            timing(id: id, kind: "key:\(name)", chars: n, at: at, received: received, via: nil)
        }
    }

    private func timing(id: Int, kind: String, chars: Int, at: Double?, received: Double, via: String?) {
        guard let timingLog else { return }
        var f: [String: Any] = ["id": id, "kind": kind, "n": chars, "recv": received, "done": Date().timeIntervalSince1970 * 1000]
        if let at { f["at"] = at }
        if let via { f["via"] = via }
        if let data = try? JSONSerialization.data(withJSONObject: f, options: [.sortedKeys]) {
            timingLog("e2e-timing " + String(decoding: data, as: UTF8.self))
        }
    }

    private func handleUnauthenticated(_ message: ClientMessage) {
        switch message {
        case .ping(let ts):
            reply(["t": "pong", "ts": ts, "us": 0])
        case .pairRequest:
            switch pairing.requestPairing(ip: peerIP) {
            case .success:
                reply(["t": "pairing", "open": true])
                log?("pairing requested from \(peerIP)")
            case .failure(let f):
                reply(failureFields(f))
            }
        case .auth(let code, let proof, let device, let sid):
            if let proof {
                switch pairing.verify(proof: proof, nonce: nonce, ip: peerIP) {
                case .success(let name):
                    authenticated(name: name, sid: sid, newToken: nil)
                case .failure(let f):
                    reply(failureFields(f))
                    log?("token rejected from \(peerIP)")
                }
            } else if let code {
                let name = device.isEmpty ? "phone" : device
                switch pairing.pair(code: code, deviceName: name, ip: peerIP) {
                case .success(let newToken):
                    authenticated(name: name, sid: sid, newToken: newToken)
                case .failure(let f):
                    reply(failureFields(f))
                    log?("pairing code rejected from \(peerIP): \(f)")
                }
            }
        default:
            reply(["t": "auth_fail", "reason": "unauthenticated"])
            close(.unauthorized, "authenticate first")
        }
    }

    private func authenticated(name: String, sid: String, newToken: String?) {
        deviceName = name
        self.sid = sid.isEmpty ? UUID().uuidString : String(sid.prefix(64))
        // Text from this page's previous connection may still be queued for injection: answer after it, so `last`
        // (the last text/key id handled for this page) is exact. The phone never sends anything again after a
        // reconnect (D-30): what is above `last` was not typed and is shown on the phone instead.
        work.async { self.sendAuthOK(name: name, newToken: newToken) }
    }

    private func sendAuthOK(name: String, newToken: String?) {
        let screen = injector.screenSize
        var fields: [String: Any] = ["t": "auth_ok", "device": name, "host": hostName,
                                     "perm": injector.hasPermission, "secure": injector.secureInputActive,
                                     "locked": injector.screenLocked,
                                     "screen": ["w": screen.width, "h": screen.height],
                                     "last": dedup.lastAccepted(sid: sid), "skipped": dedup.skippedIds(sid: sid).suffix(50).map { $0 },
                                     "boot": boot]
        if let newToken { fields["token"] = newToken }
        let off = injector.disabledSystemShortcuts
        if !off.isEmpty { fields["hotkeysOff"] = off }
        if let n = injector.spaceCount { fields["spaces"] = n }
        lastPermission = injector.hasPermission
        lastSecure = injector.secureInputActive
        lastLocked = injector.screenLocked
        reply(fields)
        log?("authenticated \(name) from \(peerIP)\(newToken == nil ? "" : " (new pairing)")")
        onAuthenticated?(self)
    }

    private func failureFields(_ f: PairingManager.Failure) -> [String: Any] {
        switch f {
        case .badCode: return ["t": "auth_fail", "reason": "bad_code"]
        case .pairingClosed: return ["t": "auth_fail", "reason": "pairing_closed"]
        case .badToken: return ["t": "auth_fail", "reason": "bad_token"]
        case .locked(let s): return ["t": "auth_fail", "reason": "locked", "retry": s]
        }
    }

    /// Sends a status message when permission or Secure Input state changed (call on the injection queue).
    public func pushStatusIfChanged() {
        guard isAuthenticated else { return }
        let p = injector.hasPermission, s = injector.secureInputActive, l = injector.screenLocked
        if p != lastPermission || s != lastSecure || l != lastLocked {
            lastPermission = p
            lastSecure = s
            lastLocked = l
            reply(["t": "status", "perm": p, "secure": s, "locked": l])
        }
    }

    /// Another phone took over.
    public func replaced() {
        releaseHeld()
        reply(["t": "replaced"])
        close(.replaced, "another phone connected")
    }

    /// Connection gone: never leave a mouse button or modifier stuck down.
    public func disconnected() {
        releaseHeld()
    }

    private func releaseHeld() {
        guard isAuthenticated else { return }
        work.async {
            self.heldButtons.removeAll()
            self.injector.releaseAll()
        }
    }

    /// Runs `block` after everything queued for injection so far (tests, the server's status tick).
    public func onWorkQueue(_ block: @escaping () -> Void) { work.async(execute: block) }

    /// Tests: handle a message and wait until its injection and reply are done.
    public func handleAndWait(_ text: String) {
        handle(text)
        work.sync {}
    }

    private func clamp(_ v: Double, _ limit: Double) -> Double { max(-limit, min(limit, v)) }

    private func elapsedMicros(since start: UInt64) -> Int {
        Int((DispatchTime.now().uptimeNanoseconds - start) / 1000)
    }
}
