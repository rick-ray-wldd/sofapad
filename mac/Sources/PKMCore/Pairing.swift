import CryptoKit
import Foundation
import Security

/// Pairing code + device tokens.
///
/// - A 6-digit code is shown on the Mac. It is only accepted while the pairing window is open
///   (default 10 minutes after start or after the user asks for a new code).
/// - A correct code returns a random 256-bit token. Only its SHA-256 is stored on disk (mode 0600),
///   so the phone reconnects later without the code.
/// - Wrong codes are rate-limited per IP, and a burst of failures from anywhere rotates the code
///   and closes the window.
public final class PairingManager {
    public struct Device: Codable, Equatable {
        public var tokenHash: String
        public var name: String
        public var created: Date
        public var lastSeen: Date
    }

    public enum Failure: Error, Equatable {
        case badCode
        case pairingClosed
        case badToken
        case locked(retryAfter: Int)
    }

    public struct Policy {
        public var pairingWindow: TimeInterval = 600
        public var perIPFailuresBeforeLock = 5
        public var firstLockSeconds: TimeInterval = 30
        public var maxLockSeconds: TimeInterval = 900
        public var globalFailuresBeforeRotate = 20
        /// A phone asking to pair opens a short window and shows a fresh code on the Mac screen.
        public var requestWindow: TimeInterval = 120
        public var minSecondsBetweenRequests: TimeInterval = 15
        public init() {}
    }

    public private(set) var code: String
    public private(set) var pairingOpenUntil: Date?
    public private(set) var devices: [Device] = []
    /// Called when the code changes (new window or rotation after an attack).
    public var onCodeChange: ((String, String) -> Void)?

    private let storeURL: URL?
    private let now: () -> Date
    private let policy: Policy
    private var failures: [String: (count: Int, lockedUntil: Date?, lockCount: Int)] = [:]
    private var globalFailures = 0
    private var lastRequest: Date?
    private let lock = NSLock()

    public init(storeURL: URL?, policy: Policy = Policy(), now: @escaping () -> Date = Date.init) {
        self.storeURL = storeURL
        self.policy = policy
        self.now = now
        self.code = PairingManager.randomCode()
        self.devices = PairingManager.load(storeURL)
        self.pairingOpenUntil = now().addingTimeInterval(policy.pairingWindow)
    }

    public var isPairingOpen: Bool {
        lock.lock(); defer { lock.unlock() }
        return pairingOpenUntilUnlocked
    }

    private var pairingOpenUntilUnlocked: Bool {
        guard let until = pairingOpenUntil else { return false }
        return now() < until
    }

    /// New code and a fresh pairing window (menu item / Enter key on the Mac).
    @discardableResult
    public func openPairing(reason: String = "requested", window: TimeInterval? = nil) -> String {
        lock.lock()
        code = PairingManager.randomCode()
        pairingOpenUntil = now().addingTimeInterval(window ?? policy.pairingWindow)
        globalFailures = 0
        let c = code
        lock.unlock()
        onCodeChange?(c, reason)
        return c
    }

    /// An unpaired phone asks to pair (Bluetooth-style): the Mac shows a fresh code on screen and the
    /// phone user types it. Someone else on the Wi-Fi can trigger this but cannot see the Mac screen.
    /// Rate-limited so it cannot be used to spam the screen.
    public func requestPairing(ip: String) -> Result<Void, Failure> {
        lock.lock()
        if let retry = lockedRetryAfter(ip) { lock.unlock(); return .failure(.locked(retryAfter: retry)) }
        if pairingOpenUntilUnlocked { lock.unlock(); return .success(()) }
        let t = now()
        if let last = lastRequest, t.timeIntervalSince(last) < policy.minSecondsBetweenRequests {
            let retry = Int((policy.minSecondsBetweenRequests - t.timeIntervalSince(last)).rounded(.up))
            lock.unlock()
            return .failure(.locked(retryAfter: retry))
        }
        lastRequest = t
        lock.unlock()
        openPairing(reason: "phone-request", window: policy.requestWindow)
        return .success(())
    }

    public func closePairing() {
        lock.lock(); pairingOpenUntil = nil; lock.unlock()
    }

    /// Verifies a pairing code. On success returns a new token for the device.
    public func pair(code candidate: String, deviceName: String, ip: String) -> Result<String, Failure> {
        lock.lock()
        if let retry = lockedRetryAfter(ip) { lock.unlock(); return .failure(.locked(retryAfter: retry)) }
        guard pairingOpenUntilUnlocked else {
            lock.unlock()
            return .failure(.pairingClosed)
        }
        let ok = PairingManager.constantTimeEqual(candidate.trimmingCharacters(in: .whitespaces), code)
        if !ok {
            let failure = recordFailure(ip)
            var rotated: String?
            if globalFailures >= policy.globalFailuresBeforeRotate {
                code = PairingManager.randomCode()
                pairingOpenUntil = nil          // stays closed until the user opens it again on the Mac
                globalFailures = 0
                rotated = code
            }
            lock.unlock()
            if let rotated { onCodeChange?(rotated, "too-many-failures") }
            return .failure(failure)
        }
        failures[ip] = nil
        let token = PairingManager.randomToken()
        let t = now()
        let name = String(deviceName.prefix(60))
        devices.append(Device(tokenHash: PairingManager.hash(token), name: name.isEmpty ? "phone" : name, created: t, lastSeen: t))
        // A code pairs one phone; the next phone needs a new code from the Mac.
        code = PairingManager.randomCode()
        pairingOpenUntil = nil
        save()
        let next = code
        lock.unlock()
        onCodeChange?(next, "paired")
        return .success(token)
    }

    /// Verifies a login proof: HMAC-SHA256(key: hex(SHA256(token)), message: nonce), hex-encoded.
    /// The token itself never crosses the network after pairing, and a captured proof is useless
    /// because every connection gets a fresh nonce. Returns the device name.
    public func verify(proof: String, nonce: String, ip: String) -> Result<String, Failure> {
        lock.lock(); defer { lock.unlock() }
        if let retry = lockedRetryAfter(ip) { return .failure(.locked(retryAfter: retry)) }
        var match: Int?
        for (i, d) in devices.enumerated() where PairingManager.constantTimeEqual(PairingManager.proof(tokenHash: d.tokenHash, nonce: nonce), proof.lowercased()) {
            match = i
        }
        guard let i = match else {
            _ = recordFailure(ip)
            return .failure(.badToken)
        }
        failures[ip] = nil
        devices[i].lastSeen = now()
        save()
        return .success(devices[i].name)
    }

    public static func proof(tokenHash: String, nonce: String) -> String {
        let mac = HMAC<SHA256>.authenticationCode(for: Data(nonce.utf8), using: SymmetricKey(data: Data(tokenHash.utf8)))
        return Data(mac).map { String(format: "%02x", $0) }.joined()
    }

    /// Client-side proof (used by tests and the benchmark client).
    public static func proof(token: String, nonce: String) -> String {
        proof(tokenHash: hash(token), nonce: nonce)
    }

    public static func randomNonce() -> String {
        Data(randomBytes(18)).base64EncodedString()
    }

    public func forgetAllDevices() {
        lock.lock(); devices = []; save(); lock.unlock()
    }

    // MARK: - internals (call with lock held)

    private func lockedRetryAfter(_ ip: String) -> Int? {
        guard let until = failures[ip]?.lockedUntil else { return nil }
        let remaining = until.timeIntervalSince(now())
        return remaining > 0 ? Int(remaining.rounded(.up)) : nil
    }

    private func recordFailure(_ ip: String) -> Failure {
        globalFailures += 1
        var entry = failures[ip] ?? (0, nil, 0)
        entry.count += 1
        var result: Failure = .badCode
        if entry.count >= policy.perIPFailuresBeforeLock {
            let seconds = min(policy.firstLockSeconds * pow(2, Double(entry.lockCount)), policy.maxLockSeconds)
            entry.lockedUntil = now().addingTimeInterval(seconds)
            entry.lockCount += 1
            entry.count = 0
            result = .locked(retryAfter: Int(seconds))
        }
        failures[ip] = entry
        return result
    }

    private func save() {
        guard let storeURL else { return }
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        enc.dateEncodingStrategy = .iso8601
        guard let data = try? enc.encode(devices) else { return }
        try? FileManager.default.createDirectory(at: storeURL.deletingLastPathComponent(), withIntermediateDirectories: true,
                                                 attributes: [.posixPermissions: 0o700])
        try? data.write(to: storeURL, options: .atomic)
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: storeURL.path)
    }

    private static func load(_ url: URL?) -> [Device] {
        guard let url, let data = try? Data(contentsOf: url) else { return [] }
        let dec = JSONDecoder()
        dec.dateDecodingStrategy = .iso8601
        return (try? dec.decode([Device].self, from: data)) ?? []
    }

    // MARK: - crypto helpers

    static func randomBytes(_ n: Int) -> [UInt8] {
        var b = [UInt8](repeating: 0, count: n)
        let status = SecRandomCopyBytes(kSecRandomDefault, n, &b)
        precondition(status == errSecSuccess, "SecRandomCopyBytes failed")
        return b
    }

    public static func randomCode() -> String {
        // Rejection sampling keeps the 000000–999999 distribution uniform.
        while true {
            let b = randomBytes(4)
            let v = UInt32(b[0]) << 24 | UInt32(b[1]) << 16 | UInt32(b[2]) << 8 | UInt32(b[3])
            if v < 4_000_000_000 { return String(format: "%06u", v % 1_000_000) }
        }
    }

    public static func randomToken() -> String {
        Data(randomBytes(32)).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    public static func hash(_ token: String) -> String {
        SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    public static func constantTimeEqual(_ a: String, _ b: String) -> Bool {
        let x = Array(a.utf8), y = Array(b.utf8)
        var diff = UInt8(x.count == y.count ? 0 : 1)
        for i in 0..<max(x.count, y.count) {
            diff |= (i < x.count ? x[i] : 0) ^ (i < y.count ? y[i] : 0)
        }
        return diff == 0
    }
}
