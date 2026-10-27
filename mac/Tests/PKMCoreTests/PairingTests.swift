import XCTest
@testable import PKMCore

final class PairingTests: XCTestCase {
    var clock = Date(timeIntervalSince1970: 1_000_000)
    func manager(_ url: URL? = nil, policy: PairingManager.Policy = .init()) -> PairingManager {
        PairingManager(storeURL: url, policy: policy, now: { [unowned self] in self.clock })
    }

    func testCodeShape() {
        for _ in 0..<200 {
            let c = PairingManager.randomCode()
            XCTAssertEqual(c.count, 6)
            XCTAssertTrue(c.allSatisfy(\.isNumber))
        }
    }

    func testCorrectCodePairsOnceThenCloses() throws {
        let m = manager()
        let code = m.code
        guard case .success(let token) = m.pair(code: code, deviceName: "iPhone", ip: "192.168.1.9") else { return XCTFail() }
        XCTAssertGreaterThanOrEqual(token.count, 40)
        XCTAssertFalse(m.isPairingOpen, "a code pairs one phone")
        XCTAssertEqual(m.pair(code: code, deviceName: "x", ip: "192.168.1.10"), .failure(.pairingClosed))
        let nonce = PairingManager.randomNonce()
        XCTAssertEqual(m.verify(proof: PairingManager.proof(token: token, nonce: nonce), nonce: nonce, ip: "192.168.1.9"), .success("iPhone"))
    }

    func testWrongCodeRejectedAndLocksOutAfterFive() {
        let m = manager()
        let wrong = m.code == "000000" ? "111111" : "000000"
        for _ in 0..<4 { XCTAssertEqual(m.pair(code: wrong, deviceName: "x", ip: "192.168.1.66"), .failure(.badCode)) }
        XCTAssertEqual(m.pair(code: wrong, deviceName: "x", ip: "192.168.1.66"), .failure(.locked(retryAfter: 30)))
        // even the right code is refused while locked
        if case .locked = m.pair(code: m.code, deviceName: "x", ip: "192.168.1.66").failureValue {} else { XCTFail("should stay locked") }
        // other IPs are not locked
        XCTAssertNotEqual(m.pair(code: wrong, deviceName: "x", ip: "192.168.1.67"), .failure(.locked(retryAfter: 30)))
        clock += 31
        XCTAssertEqual(m.pair(code: wrong, deviceName: "x", ip: "192.168.1.66"), .failure(.badCode))
    }

    func testBurstOfFailuresRotatesCodeAndClosesPairing() {
        var policy = PairingManager.Policy()
        policy.globalFailuresBeforeRotate = 6
        let m = manager(policy: policy)
        let original = m.code
        var rotatedTo: String?
        m.onCodeChange = { c, reason in if reason == "too-many-failures" { rotatedTo = c } }
        for i in 0..<6 { _ = m.pair(code: "99999\(i)" == original ? "888888" : "99999\(i)", deviceName: "x", ip: "10.0.0.\(i)") }
        XCTAssertNotNil(rotatedTo)
        XCTAssertNotEqual(m.code, original)
        XCTAssertFalse(m.isPairingOpen)
        XCTAssertEqual(m.pair(code: original, deviceName: "x", ip: "10.0.0.99"), .failure(.pairingClosed))
    }

    func testWindowExpires() {
        let m = manager()
        clock += 601
        XCTAssertEqual(m.pair(code: m.code, deviceName: "x", ip: "192.168.1.2"), .failure(.pairingClosed))
    }

    func testPhoneRequestOpensShortWindowAndIsRateLimited() {
        let m = manager()
        m.closePairing()
        var shown: String?
        m.onCodeChange = { c, r in if r == "phone-request" { shown = c } }
        if case .failure = m.requestPairing(ip: "192.168.1.3") { XCTFail("request should open pairing") }
        XCTAssertNotNil(shown)
        XCTAssertTrue(m.isPairingOpen)
        clock += 121
        XCTAssertFalse(m.isPairingOpen)
        clock -= 110 // within 15 s of the last request
        m.closePairing()
        if case .failure(.locked) = m.requestPairing(ip: "192.168.1.3") {} else { XCTFail("should be rate limited") }
    }

    func testProofWithWrongNonceOrTokenFails() {
        let m = manager()
        guard case .success(let token) = m.pair(code: m.code, deviceName: "p", ip: "192.168.1.9") else { return XCTFail() }
        XCTAssertEqual(m.verify(proof: PairingManager.proof(token: token, nonce: "old"), nonce: "new", ip: "192.168.1.9"), .failure(.badToken))
        XCTAssertEqual(m.verify(proof: PairingManager.proof(token: "guess", nonce: "n"), nonce: "n", ip: "192.168.1.9"), .failure(.badToken))
    }

    func testCrossLanguageProofVector() {
        // Same vector as web/test/sha256.test.mjs
        XCTAssertEqual(PairingManager.proof(token: "test-token-AbC_123", nonce: "bm9uY2Utbm9uY2Utbm9uY2U="),
                       "9929ae2ffeac5dc4a9797eddb8b4550fe84c31e87559952ab87676da7a19e0eb")
    }

    func testDevicesPersistHashedWithPrivatePermissions() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let url = dir.appendingPathComponent("devices.json")
        let m = manager(url)
        guard case .success(let token) = m.pair(code: m.code, deviceName: "iPhone", ip: "192.168.1.9") else { return XCTFail() }
        let text = try String(contentsOf: url, encoding: .utf8)
        XCTAssertFalse(text.contains(token), "token itself must not be stored")
        XCTAssertTrue(text.contains(PairingManager.hash(token)))
        let perms = try FileManager.default.attributesOfItem(atPath: url.path)[.posixPermissions] as? Int
        XCTAssertEqual(perms, 0o600)
        let reloaded = manager(url)
        XCTAssertEqual(reloaded.devices.count, 1)
        reloaded.forgetAllDevices()
        XCTAssertEqual(manager(url).devices.count, 0)
        try? FileManager.default.removeItem(at: dir)
    }
}

extension Result {
    var failureValue: Failure? { if case .failure(let f) = self { return f } else { return nil } }
}
