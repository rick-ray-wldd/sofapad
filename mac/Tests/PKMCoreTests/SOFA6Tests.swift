import XCTest
@testable import PKMCore

/// SOFA-6 cursor pad on the Mac side: only the four arrow keys with Shift / Option, at most 40 presses a second,
/// nothing that arrives late, nothing while the screen is locked or before pairing.
final class SOFA6Tests: XCTestCase {
    var sent: [[String: Any]] = []
    let injector = RecordingInjector()
    let pairing = PairingManager(storeURL: nil)

    func paired() -> ControlSession {
        let s = ControlSession(peerIP: "192.168.1.20", injector: injector, pairing: pairing, dedup: DedupStore(),
                               send: { [unowned self] in self.sent.append(try! JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any]) },
                               close: { _, _ in })
        s.start()
        s.handleAndWait(#"{"t":"auth","code":"\#(pairing.code)","device":"iPhone","sid":"p"}"#)
        XCTAssertTrue(s.isAuthenticated)
        return s
    }

    func testDecodeOnlyArrowsWithShiftAndOption() throws {
        XCTAssertEqual(try ClientMessage.decode(#"{"t":"caret","k":"left"}"#), .caret(key: "left", mods: [], repeat: 1))
        XCTAssertEqual(try ClientMessage.decode(#"{"t":"caret","k":"up","mods":["shift","opt"],"n":4}"#),
                       .caret(key: "up", mods: [.shift, .opt], repeat: 4))
        XCTAssertEqual(try ClientMessage.decode(#"{"t":"caret","k":"right","mods":["⇧","option","shift"]}"#),
                       .caret(key: "right", mods: [.shift, .opt], repeat: 1))
        for bad in [#"{"t":"caret","k":"a"}"#, #"{"t":"caret","k":"enter"}"#, #"{"t":"caret","k":"home"}"#,
                    #"{"t":"caret","k":"space"}"#, #"{"t":"caret"}"#,
                    #"{"t":"caret","k":"left","mods":["cmd"]}"#, #"{"t":"caret","k":"left","mods":["ctrl"]}"#,
                    #"{"t":"caret","k":"left","mods":["fn"]}"#, #"{"t":"caret","k":"left","mods":["shift","cmd"]}"#,
                    #"{"t":"caret","k":"left","n":0}"#, #"{"t":"caret","k":"left","n":5}"#, #"{"t":"caret","k":"left","n":1.5}"#] {
            XCTAssertThrowsError(try ClientMessage.decode(bad), bad)
        }
    }

    func testArrowsReachTheMacAsKeyPresses() {
        let s = paired()
        s.handleAndWait(#"{"t":"caret","k":"left","n":2}"#)
        s.handleAndWait(#"{"t":"caret","k":"right","mods":["shift"]}"#)
        s.handleAndWait(#"{"t":"caret","k":"right","mods":["opt","shift"]}"#)
        s.handleAndWait(#"{"t":"caret","k":"down"}"#)
        s.handleAndWait(#"{"t":"caret","k":"enter"}"#)          // refused: not an arrow
        XCTAssertEqual(injector.snapshot, [
            .key(KeyStroke(keyCode: 0x7B)), .key(KeyStroke(keyCode: 0x7B)),
            .key(KeyStroke(keyCode: 0x7C, modifiers: [.shift])),
            .key(KeyStroke(keyCode: 0x7C, modifiers: [.opt, .shift])),
            .key(KeyStroke(keyCode: 0x7D)),
        ])
        XCTAssertEqual(sent.last?["t"] as? String, "error", "the refused one gets an error, not a key")
        XCTAssertFalse(sent.contains { ($0["t"] as? String) == "ack" }, "cursor presses are not acked (they never hold back typing)")
        // arrow events carry the arrow keys' own flags (fn + numeric pad), like on a real keyboard (I-18)
        XCTAssertEqual(KeyStroke(keyCode: 0x7C, modifiers: [.shift]).eventFlags & KeyMap.numericPadFlag, KeyMap.numericPadFlag)
    }

    func testNotBeforePairingNorWhileLocked() {
        let s = ControlSession(peerIP: "192.168.1.20", injector: injector, pairing: pairing, dedup: DedupStore(),
                               send: { _ in }, close: { _, _ in })
        s.start()
        s.handleAndWait(#"{"t":"caret","k":"left"}"#)
        XCTAssertEqual(injector.snapshot, [], "before pairing")
        let p = paired()
        injector.screenLocked = true
        p.handleAndWait(#"{"t":"caret","k":"left"}"#)
        XCTAssertEqual(injector.snapshot, [], "screen locked")
        injector.screenLocked = false
        p.handleAndWait(#"{"t":"caret","k":"left"}"#)
        XCTAssertEqual(injector.snapshot, [.key(KeyStroke(keyCode: 0x7B))])
    }

    func testLatePressesAreDropped() {
        let s = paired()
        let now = Date().timeIntervalSince1970 * 1000
        for i in 0..<5 { s.handleAndWait(#"{"t":"ping","ts":\#(i),"wall":\#(now - 20)}"#) }   // a 20 ms trip
        s.handleAndWait(#"{"t":"caret","k":"left","sent":\#(now - 300)}"#)    // 0.28 s late: still fine
        s.handleAndWait(#"{"t":"caret","k":"right","sent":\#(now - 900)}"#)   // 0.88 s late: dropped
        XCTAssertEqual(injector.snapshot, [.key(KeyStroke(keyCode: 0x7B))])
    }

    func testAtMost40ASecond() {
        var b = CaretBudget()
        var t = 100.0
        var taken = 0
        for _ in 0..<200 {                       // the phone asking 200 times in one second
            if b.take(1, now: t) { taken += 1 }
            t += 0.005
        }
        XCTAssertLessThanOrEqual(taken, 41 + 40)   // the bucket starts full (40), then 40 more over the second
        XCTAssertGreaterThanOrEqual(taken, 75)
        var slow = CaretBudget()
        XCTAssertTrue((0..<30).allSatisfy { slow.take(1, now: 200 + Double($0) / 30) }, "30 a second always goes through")

        let s = paired()
        for _ in 0..<60 { s.handleAndWait(#"{"t":"caret","k":"left","n":4}"#) }   // 240 presses at once
        XCTAssertLessThanOrEqual(injector.snapshot.count, 40)
    }
}
