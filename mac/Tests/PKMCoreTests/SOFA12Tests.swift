import XCTest
@testable import PKMCore

/// SOFA-12 versioned protocol (docs/PROTOCOL.md): the Mac announces its protocol version in `hello`, accepts its own
/// version and the one before it, and turns any other version away with a reason the client can show.
final class SOFA12Tests: XCTestCase {
    var sent: [[String: Any]] = []
    var closed: ControlSession.CloseCode?
    let injector = RecordingInjector()
    let pairing = PairingManager(storeURL: nil)

    func session() -> ControlSession {
        let s = ControlSession(peerIP: "192.168.1.20", injector: injector, pairing: pairing, dedup: DedupStore(),
                               send: { [unowned self] in self.sent.append(try! JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any]) },
                               close: { [unowned self] code, _ in self.closed = code })
        s.start()
        return s
    }

    func testVersionNumbers() {
        XCTAssertEqual(ProtocolVersion.current, 2)
        XCTAssertEqual(ProtocolVersion.oldest, 1)
        XCTAssertEqual([0, 1, 2, 3].map(ProtocolVersion.accepts), [false, true, true, false])
    }

    func testHelloAnnouncesTheProtocolVersionNextToTheAppVersion() {
        _ = session()
        let hello = try! XCTUnwrap(sent.first)
        XCTAssertEqual(hello["t"] as? String, "hello")
        XCTAssertEqual(hello["v"] as? Int, 2)
        XCTAssertEqual(hello["vmin"] as? Int, 1)
        XCTAssertEqual(hello["ver"] as? String, BuildInfo.version)
    }

    func testClientVersionIsDecodedAndDefaultsToOne() throws {
        XCTAssertEqual(try ClientMessage.decode(#"{"t":"pair_request","device":"iPhone"}"#), .pairRequest(device: "iPhone", v: 1))
        XCTAssertEqual(try ClientMessage.decode(#"{"t":"pair_request","device":"iPhone","v":2}"#), .pairRequest(device: "iPhone", v: 2))
        XCTAssertEqual(try ClientMessage.decode(#"{"t":"auth","code":"123456","sid":"s"}"#),
                       .auth(code: "123456", proof: nil, device: "", sid: "s", v: 1))
        XCTAssertEqual(try ClientMessage.decode(#"{"t":"auth","proof":"ab","sid":"s","v":3}"#),
                       .auth(code: nil, proof: "ab", device: "", sid: "s", v: 3))
        for bad in [#"{"t":"auth","code":"123456","v":"2"}"#, #"{"t":"auth","code":"123456","v":2.5}"#,
                    #"{"t":"pair_request","v":true}"#] {
            XCTAssertThrowsError(try ClientMessage.decode(bad), bad)
        }
    }

    func testPageFromBefore45PairsAsVersionOne() {
        let s = session()
        s.handleAndWait(#"{"t":"auth","code":"\#(pairing.code)","device":"iPhone","sid":"p"}"#)
        XCTAssertTrue(s.isAuthenticated)
        XCTAssertEqual(sent.last?["t"] as? String, "auth_ok")
    }

    func testCurrentAndPreviousVersionAreAccepted() {
        for v in [1, 2] {
            let s = session()
            s.handleAndWait(#"{"t":"auth","code":"\#(pairing.code)","device":"iPhone","sid":"p\#(v)","v":\#(v)}"#)
            XCTAssertTrue(s.isAuthenticated, "v\(v)")
            pairing.openPairing()
        }
        let s = session()
        s.handleAndWait(#"{"t":"pair_request","device":"iPhone","v":1}"#)
        XCTAssertEqual(sent.last?["t"] as? String, "pairing")
        XCTAssertNil(closed)
    }

    func testOtherVersionsAreTurnedAwayWithAReason() {
        for v in [0, 3, 99] {
            sent = []
            closed = nil
            let code = pairing.code
            let s = session()
            s.handleAndWait(#"{"t":"auth","code":"\#(code)","device":"iPhone","sid":"x","v":\#(v)}"#)
            XCTAssertFalse(s.isAuthenticated, "v\(v): no pairing with a client this Mac does not understand")
            XCTAssertEqual(sent.last?["t"] as? String, "auth_fail")
            XCTAssertEqual(sent.last?["reason"] as? String, "protocol")
            XCTAssertEqual(sent.last?["v"] as? Int, 2)
            XCTAssertEqual(sent.last?["vmin"] as? Int, 1)
            XCTAssertEqual(closed, .protocolVersion)
            XCTAssertEqual(ControlSession.CloseCode.protocolVersion.rawValue, 4426)
            XCTAssertEqual(pairing.code, code, "the code is not used up by a refused client")
            XCTAssertTrue(pairing.isPairingOpen)
        }
        // a pair request too: nothing is shown on the Mac's screen for it
        sent = []
        closed = nil
        pairing.closePairing()
        let s = session()
        s.handleAndWait(#"{"t":"pair_request","device":"iPhone","v":3}"#)
        XCTAssertEqual(sent.last?["reason"] as? String, "protocol")
        XCTAssertFalse(pairing.isPairingOpen)
        XCTAssertEqual(closed, .protocolVersion)
        XCTAssertEqual(injector.snapshot, [])
    }

    func testPageFilesAreNeverCached() throws {
        // after an update the phone can only get the new page (also a Home Screen web app)
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("sofa12-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir.appendingPathComponent("js"), withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        for f in ["index.html", "js/version.js", "manifest.webmanifest"] { try Data("x".utf8).write(to: dir.appendingPathComponent(f)) }
        let files = StaticFiles(root: dir)
        for path in ["/", "/js/version.js", "/manifest.webmanifest"] {
            let req = try XCTUnwrap(try HTTPRequest.parse(Array("GET \(path) HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n".utf8))).0
            let head = String(decoding: files.response(for: req), as: UTF8.self)
            XCTAssertTrue(head.contains("Cache-Control: no-store\r\n"), path)
            XCTAssertFalse(head.contains("no-cache"), path)
        }
    }

    func testProtocolDocumentNamesEveryMessageType() throws {
        // docs/PROTOCOL.md is what a native client is written from: every message the Mac decodes is in it
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../..").standardizedFileURL
        let doc = try String(contentsOf: root.appendingPathComponent("docs/PROTOCOL.md"), encoding: .utf8)
        for t in ["hello", "auth_ok", "auth_fail", "pairing", "ack", "pong", "status", "replaced", "error",
                  "pair_request", "auth", "ping", "move", "jump", "scroll", "click", "down", "up", "text", "key", "caret",
                  "release_all"] {
            XCTAssertTrue(doc.contains("`\(t)`"), "docs/PROTOCOL.md describes `\(t)`")
        }
        for code in ["4401", "4408", "4409", "4426", "1002"] { XCTAssertTrue(doc.contains(code), code) }
        XCTAssertTrue(doc.contains("Protocol version: \(ProtocolVersion.current)"))
    }
}
