import XCTest
@testable import PKMCore

final class SessionTests: XCTestCase {
    var sent: [[String: Any]] = []
    var closed: ControlSession.CloseCode?
    let injector = RecordingInjector()
    let pairing = PairingManager(storeURL: nil)
    let dedup = DedupStore()

    func session(ip: String = "192.168.1.20") -> ControlSession {
        let s = ControlSession(peerIP: ip, injector: injector, pairing: pairing, dedup: dedup,
                               send: { [unowned self] in self.sent.append(try! JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any]) },
                               close: { [unowned self] code, _ in self.closed = code })
        s.start()
        return s
    }

    var lastType: String? { sent.last?["t"] as? String }

    func testHelloCarriesNonce() {
        let s = session()
        XCTAssertEqual(sent.first?["t"] as? String, "hello")
        XCTAssertEqual(sent.first?["nonce"] as? String, s.nonce)
    }

    func testInputBeforeAuthIsRefusedAndClosed() {
        let s = session()
        s.handleAndWait(#"{"t":"text","id":1,"s":"rm -rf"}"#)
        XCTAssertEqual(injector.snapshot, [])
        XCTAssertEqual(closed, .unauthorized)
    }

    func testWrongPairingCodeIsRejected() {
        let s = session()
        let wrong = pairing.code == "123456" ? "654321" : "123456"
        s.handleAndWait(#"{"t":"auth","code":"\#(wrong)","sid":"a"}"#)
        XCTAssertEqual(lastType, "auth_fail")
        XCTAssertEqual(sent.last?["reason"] as? String, "bad_code")
        XCTAssertFalse(s.isAuthenticated)
        s.handleAndWait(#"{"t":"move","dx":5,"dy":5}"#)
        XCTAssertEqual(injector.snapshot, [], "nothing reaches the Mac without pairing")
    }

    func testPairTypeAndDedup() throws {
        let s = session()
        s.handleAndWait(#"{"t":"auth","code":"\#(pairing.code)","device":"iPhone","sid":"page1"}"#)
        XCTAssertEqual(lastType, "auth_ok")
        XCTAssertNotNil(sent.last?["token"] as? String)
        XCTAssertEqual((sent.last?["screen"] as? [String: Double])?["w"], 1920)
        s.handleAndWait(#"{"t":"text","id":1,"s":"你好，世界 Hello 😀"}"#)
        XCTAssertEqual(sent.last?["t"] as? String, "ack")
        XCTAssertEqual(sent.last?["via"] as? String, "type")
        s.handleAndWait(#"{"t":"text","id":1,"s":"你好，世界 Hello 😀"}"#) // resent after reconnect
        XCTAssertEqual(sent.last?["dup"] as? Bool, true)
        s.handleAndWait(#"{"t":"key","id":2,"k":"backspace","n":3}"#)
        s.handleAndWait(#"{"t":"key","id":3,"k":"c","mods":["cmd"]}"#)
        XCTAssertEqual(injector.snapshot, [
            .type("你好，世界 Hello 😀"),
            .key(KeyStroke(keyCode: 0x33)), .key(KeyStroke(keyCode: 0x33)), .key(KeyStroke(keyCode: 0x33)),
            .key(KeyStroke(keyCode: 0x08, modifiers: [.cmd])),
        ])
    }

    /// PKM-2-3: the ack of ⌃←→↑↓ tells the phone whether the shortcut is off and how many Spaces there are.
    func testControlArrowAckCarriesHotkeyStatus() {
        injector.disabledSystemShortcuts = ["spaceLeft"]
        injector.spaceCount = 1
        let s = session()
        s.handleAndWait(#"{"t":"auth","code":"\#(pairing.code)","sid":"h"}"#)
        XCTAssertEqual(sent.last?["spaces"] as? Int, 1)
        XCTAssertEqual(sent.last?["hotkeysOff"] as? [String], ["spaceLeft"])
        s.handleAndWait(#"{"t":"key","id":1,"k":"left","mods":["ctrl"]}"#)
        XCTAssertEqual(sent.last?["hotkey"] as? String, "spaceLeft")
        XCTAssertEqual(sent.last?["hotkeyOff"] as? Bool, true)
        XCTAssertEqual(sent.last?["spaces"] as? Int, 1)
        s.handleAndWait(#"{"t":"key","id":2,"k":"up","mods":["ctrl"]}"#)
        XCTAssertEqual(sent.last?["hotkey"] as? String, "missionControl")
        XCTAssertEqual(sent.last?["hotkeyOff"] as? Bool, false)
        s.handleAndWait(#"{"t":"key","id":3,"k":"c","mods":["cmd"]}"#)
        XCTAssertNil(sent.last?["hotkey"], "ordinary shortcuts carry no hint")
        XCTAssertEqual(injector.snapshot.count, 3, "the shortcut is still sent even when it looks switched off")
    }

    func testMouseCommandsAndReleaseOnDisconnect() {
        let s = session()
        s.handleAndWait(#"{"t":"auth","code":"\#(pairing.code)","sid":"p"}"#)
        s.handleAndWait(#"{"t":"move","dx":12.5,"dy":-3}"#)
        s.handleAndWait(#"{"t":"click","b":"left"}"#)
        s.handleAndWait(#"{"t":"click","b":"right"}"#)
        s.handleAndWait(#"{"t":"scroll","dx":0,"dy":40}"#)
        s.handleAndWait(#"{"t":"down","b":"left"}"#)
        s.handleAndWait(#"{"t":"move","dx":99999,"dy":0}"#)
        s.handleAndWait(#"{"t":"jump","x":0.25,"y":1.7}"#)
        s.disconnected()
        s.handleAndWait(#"{"t":"ping","ts":1}"#)   // waits for the queued release
        XCTAssertEqual(injector.snapshot, [
            .move(12.5, -3), .click(.left), .click(.right), .scroll(0, 40), .press(.left, true), .move(4000, 0), .jump(0.25, 1),
            .releaseAll,
        ])
    }

    func testTokenProofLogin() {
        let s1 = session()
        s1.handleAndWait(#"{"t":"auth","code":"\#(pairing.code)","sid":"p"}"#)
        let token = sent.last?["token"] as! String
        sent = []
        let s2 = session()
        let proof = PairingManager.proof(token: token, nonce: s2.nonce)
        s2.handleAndWait(#"{"t":"auth","proof":"\#(proof)","sid":"p2"}"#)
        XCTAssertEqual(lastType, "auth_ok")
        XCTAssertNil(sent.last?["token"], "token is only sent once, at pairing")
        // replaying the same proof on a new connection fails (new nonce)
        let s3 = session()
        s3.handleAndWait(#"{"t":"auth","proof":"\#(proof)","sid":"p3"}"#)
        XCTAssertEqual(sent.last?["reason"] as? String, "bad_token")
    }

    func testNothingIsInjectedWhileScreenLocked() {
        let s = session()
        s.handleAndWait(#"{"t":"auth","code":"\#(pairing.code)","sid":"p"}"#)
        injector.screenLocked = true
        s.handleAndWait(#"{"t":"text","id":1,"s":"password123"}"#)
        let ack = sent.last { $0["t"] as? String == "ack" }
        XCTAssertEqual(ack?["err"] as? String, "locked")
        XCTAssertEqual(ack?["ok"] as? Bool, false)
        s.handleAndWait(#"{"t":"click","b":"left"}"#)
        s.handleAndWait(#"{"t":"move","dx":3,"dy":3}"#)
        XCTAssertEqual(injector.snapshot, [], "lock screen must never receive phone input")
        XCTAssertTrue(sent.contains { $0["t"] as? String == "status" && $0["locked"] as? Bool == true })
        injector.screenLocked = false
        s.handleAndWait(#"{"t":"text","id":2,"s":"ok"}"#)
        XCTAssertEqual(injector.snapshot, [.type("ok")])
    }

    func testPermissionAndSecureInputReported() {
        injector.hasPermission = false
        let s = session()
        s.handleAndWait(#"{"t":"auth","code":"\#(pairing.code)","sid":"p"}"#)
        XCTAssertEqual(sent.last?["perm"] as? Bool, false)
        injector.hasPermission = true
        injector.secureInputActive = true
        s.pushStatusIfChanged()
        XCTAssertEqual(lastType, "status")
        XCTAssertEqual(sent.last?["secure"] as? Bool, true)
        s.handleAndWait(#"{"t":"text","id":1,"s":"pw"}"#)
        XCTAssertEqual(sent.last?["warn"] as? String, "secure_input")
    }
}
