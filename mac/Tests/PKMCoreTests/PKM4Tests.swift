import XCTest
@testable import PKMCore

/// PKM-4: text that sat in a stalled connection is not typed, pings are answered while the Mac is busy typing,
/// a reconnecting phone learns exactly what was typed, one QR address, one version everywhere.
final class PKM4Tests: XCTestCase {
    var sent: [[String: Any]] = []
    let lock = NSLock()
    let injector = RecordingInjector()
    let pairing = PairingManager(storeURL: nil)
    let dedup = DedupStore()
    let work = DispatchQueue(label: "test.inject")   // one injection queue for all connections, like the server

    func session() -> ControlSession {
        let s = ControlSession(peerIP: "192.168.1.20", injector: injector, pairing: pairing, dedup: dedup, work: work,
                               send: { [unowned self] text in
                                   let obj = try! JSONSerialization.jsonObject(with: Data(text.utf8)) as! [String: Any]
                                   self.lock.lock(); self.sent.append(obj); self.lock.unlock()
                               },
                               close: { _, _ in })
        s.start()
        return s
    }
    var replies: [[String: Any]] { lock.lock(); defer { lock.unlock() }; return sent }

    /// The same phone page logging in again on a new connection (token proof, as after a reconnect).
    func reconnect(sid: String) -> ControlSession {
        let token = replies.compactMap { $0["token"] as? String }.last!
        let s = session()
        s.handleAndWait(#"{"t":"auth","proof":"\#(PairingManager.proof(token: token, nonce: s.nonce))","sid":"\#(sid)"}"#)
        return s
    }

    // MARK: lateness

    func testLatenessIgnoresClockDifferenceAndCatchesAStall() {
        var m = LatenessMeter()
        XCTAssertFalse(m.isLate(sentWall: 0, arrived: 999_999), "nothing known before the first ping: never dropped")
        // the phone's clock is 100 s ahead of the Mac's; a normal trip takes 5–12 ms
        for d in [12.0, 5, 9] { m.ping(sentWall: 100_000 + 1_000, arrived: 1_000 + d) }
        XCTAssertFalse(m.isLate(sentWall: 100_000 + 2_000, arrived: 2_000 + 40), "40 ms trip: on time")
        XCTAssertFalse(m.isLate(sentWall: 100_000 + 3_000, arrived: 3_000 + 2_900), "2.9 s: still typed")
        XCTAssertTrue(m.isLate(sentWall: 100_000 + 4_000, arrived: 4_000 + 4_500), "held up 4.5 s in a stalled connection")
        XCTAssertEqual(m.lateness(sentWall: 100_000 + 4_000, arrived: 4_000 + 4_500)!, 4_495, accuracy: 0.1)
    }

    func testLateTextIsNotTypedAndTheReconnectingPhoneIsTold() throws {
        let s = session()
        s.handleAndWait(#"{"t":"auth","code":"\#(pairing.code)","sid":"page"}"#)
        let now = Date().timeIntervalSince1970 * 1000
        s.handleAndWait(#"{"t":"ping","ts":1,"wall":\#(now)}"#)
        s.handleAndWait(#"{"t":"text","id":1,"s":"on time","sent":\#(now + 5)}"#)
        s.handleAndWait(#"{"t":"text","id":2,"s":"Orca 那段","sent":\#(now - 6000)}"#)   // 6 s in a stalled connection
        s.handleAndWait(#"{"t":"click","b":"left","sent":\#(now - 6000)}"#)
        s.handleAndWait(#"{"t":"up","b":"left","sent":\#(now - 6000)}"#)                   // a release always applies
        XCTAssertEqual(injector.snapshot, [.type("on time"), .press(.left, false)])
        let ack = replies.last { ($0["t"] as? String) == "ack" && ($0["id"] as? Int) == 2 }
        XCTAssertEqual(ack?["ok"] as? Bool, false)
        XCTAssertEqual(ack?["err"] as? String, "late")
        // the same page reconnects: told what was typed (last) and what was skipped
        _ = reconnect(sid: "page")
        let ok = try XCTUnwrap(replies.last { ($0["t"] as? String) == "auth_ok" })
        XCTAssertEqual(ok["last"] as? Int, 2)
        XCTAssertEqual(ok["skipped"] as? [Int], [2])
        XCTAssertNotNil(ok["boot"])
        // and a resend of id 2 would never be typed now
        XCTAssertFalse(dedup.accept(sid: "page", id: 2))
    }

    func testPingsAreAnsweredWhileTheMacIsStillTyping() {
        injector.onEvent = { e in if case .type = e { usleep(300_000) } }   // a slow clipboard paste
        let s = session()
        s.handleAndWait(#"{"t":"auth","code":"\#(pairing.code)","sid":"p"}"#)
        sent = []
        s.handle(#"{"t":"text","id":1,"s":"long paste"}"#)
        s.handle(#"{"t":"ping","ts":7}"#)
        // the pong goes out at once, before the text's ack
        XCTAssertEqual(replies.first?["t"] as? String, "pong")
        s.handleAndWait(#"{"t":"ping","ts":8}"#)
        XCTAssertEqual(replies.compactMap { $0["t"] as? String }.filter { $0 != "status" }, ["pong", "pong", "ack"],
                       "both pongs go out while the paste is still running")
    }

    func testReconnectAnswerWaitsForTextStillBeingTyped() throws {
        injector.onEvent = { e in if case .type = e { usleep(200_000) } }
        let s = session()
        s.handleAndWait(#"{"t":"auth","code":"\#(pairing.code)","sid":"pg"}"#)
        s.handle(#"{"t":"text","id":5,"s":"still typing"}"#)
        _ = reconnect(sid: "pg")    // the phone reconnected while id 5 was being typed
        let ok = try XCTUnwrap(replies.last { ($0["t"] as? String) == "auth_ok" })
        XCTAssertEqual(ok["last"] as? Int, 5, "auth_ok comes after the queued text, so id 5 counts as typed")
    }

    // MARK: one QR address (D-31)

    func testOneAddressForTheQRAndTheNameAsTheOnlyAlternative() {
        typealias I = LANURLs.Interface
        let urls = LANURLs.build(interfaces: [I(name: "en0", ip: "192.168.1.20"), I(name: "en7", ip: "10.0.0.5")],
                                 localHostName: "Studio", port: 8765)
        let shown = LANURLs.shown(urls)
        XCTAssertEqual(shown.scan?.url, "http://192.168.1.20:8765/")
        XCTAssertEqual(shown.alternate?.url, "http://Studio.local:8765/")
        XCTAssertEqual(shown.more.map(\.url), ["http://10.0.0.5:8765/"], "other interfaces only under 進階")
        let nameOnly = LANURLs.shown(LANURLs.build(interfaces: [], localHostName: "Studio", port: 8765))
        XCTAssertEqual(nameOnly.scan?.url, "http://Studio.local:8765/")
        XCTAssertNil(nameOnly.alternate)
        XCTAssertNil(LANURLs.shown([]).scan)
        XCTAssertEqual(LANURLs.fallback(computerName: "My Mac’s mini", port: 8765).url, "http://My-Mac-s-mini.local:8765/",
                       "no network at all: the QR still has an address (I-20)")
    }

    // MARK: version

    func testOneVersionNumberEverywhere() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../..").standardizedFileURL
        let file = try String(contentsOf: root.appendingPathComponent("VERSION"), encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
        let js = try String(contentsOf: root.appendingPathComponent("web/js/version.js"), encoding: .utf8)
        XCTAssertEqual(BuildInfo.sourceVersion, file)
        XCTAssertTrue(js.contains("VERSION = '\(file)'"), "web/js/version.js says the same version")
        let hello = replies   // hello carries the version for the phone's ⚙︎
        _ = session()
        let h = try XCTUnwrap(replies.dropFirst(hello.count).first)
        XCTAssertEqual(h["ver"] as? String, BuildInfo.version)
        XCTAssertNotNil(h["build"])
    }
}
