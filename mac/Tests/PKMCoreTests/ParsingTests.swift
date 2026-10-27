import XCTest
@testable import PKMCore

final class HTTPTests: XCTestCase {
    func testParsesUpgradeRequest() throws {
        let raw = "GET /ws HTTP/1.1\r\nHost: 192.168.1.5:8765\r\nUpgrade: websocket\r\nConnection: keep-alive, Upgrade\r\nSec-WebSocket-Key: abc\r\nSec-WebSocket-Version: 13\r\nOrigin: http://192.168.1.5:8765\r\n\r\nEXTRA"
        let (req, used) = try XCTUnwrap(HTTPRequest.parse(Array(raw.utf8)))
        XCTAssertEqual(req.method, "GET")
        XCTAssertEqual(req.path, "/ws")
        XCTAssertTrue(req.isWebSocketUpgrade)
        XCTAssertEqual(req.header("sec-websocket-key"), "abc")
        XCTAssertEqual(String(decoding: Array(raw.utf8)[used...], as: UTF8.self), "EXTRA")
    }

    func testIncompleteAndMalformed() throws {
        XCTAssertNil(try HTTPRequest.parse(Array("GET / HTTP/1.1\r\nHost: x".utf8)))
        XCTAssertThrowsError(try HTTPRequest.parse(Array("NONSENSE\r\n\r\n".utf8)))
        XCTAssertThrowsError(try HTTPRequest.parse([UInt8](repeating: 65, count: HTTPRequest.maxHeadBytes + 10)))
    }

    func testQuerySplit() throws {
        let (req, _) = try XCTUnwrap(HTTPRequest.parse(Array("GET /a.js?v=2 HTTP/1.1\r\nHost: x.local\r\n\r\n".utf8)))
        XCTAssertEqual(req.path, "/a.js")
        XCTAssertEqual(req.query, "v=2")
    }

    func testHostPolicyBlocksRebinding() {
        XCTAssertTrue(HostPolicy.isAllowedHost("192.168.1.5:8765"))
        XCTAssertTrue(HostPolicy.isAllowedHost("Laptop.local:8765"))
        XCTAssertTrue(HostPolicy.isAllowedHost("[fe80::1]:8765"))
        XCTAssertTrue(HostPolicy.isAllowedHost("localhost:8765"))
        XCTAssertFalse(HostPolicy.isAllowedHost("evil.example.com:8765"))
        XCTAssertFalse(HostPolicy.isAllowedHost(nil))
        XCTAssertTrue(HostPolicy.originMatches(origin: "http://192.168.1.5:8765", host: "192.168.1.5:8765"))
        XCTAssertFalse(HostPolicy.originMatches(origin: "http://evil.example.com", host: "192.168.1.5:8765"))
        XCTAssertFalse(HostPolicy.originMatches(origin: nil, host: "192.168.1.5:8765"))
    }

    func testLocalNetworkFilter() {
        for ok in ["127.0.0.1", "10.0.0.8", "172.20.1.1", "192.168.1.20", "169.254.3.4", "::1", "fe80::1%en0", "fd12::3", "::ffff:192.168.1.9"] {
            XCTAssertTrue(IPAddress.isLocalNetwork(ok), ok)
        }
        for bad in ["8.8.8.8", "172.32.0.1", "100.64.0.1", "2001:4860::8888", "::ffff:8.8.8.8", "garbage", ""] {
            XCTAssertFalse(IPAddress.isLocalNetwork(bad), bad)
        }
    }
}

final class WebSocketTests: XCTestCase {
    func testRFCAcceptKey() {
        XCTAssertEqual(WebSocket.acceptKey(for: "dGhlIHNhbXBsZSBub25jZQ=="), "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=")
    }

    func testMaskedRoundTripAllLengths() throws {
        for n in [0, 5, 125, 126, 300, 65535, 65536, 70000] {
            let payload = (0..<n).map { UInt8(truncatingIfNeeded: $0 * 7) }
            var p = WSFrameParser(maxPayload: 1 << 20)
            let frame = WebSocket.encode(.binary, payload, mask: [1, 2, 3, 4])
            // feed in two pieces to exercise buffering
            let cut = frame.count / 2
            p.append(Array(frame[..<cut]))
            if cut < frame.count { XCTAssertNil(try p.next()) }
            p.append(Array(frame[cut...]))
            let f = try XCTUnwrap(p.next())
            XCTAssertEqual(f.payload, payload, "len \(n)")
            XCTAssertEqual(f.opcode, .binary)
        }
    }

    func testRejectsUnmaskedClientFrames() {
        var p = WSFrameParser()
        p.append(WebSocket.encode(.text, Array("hi".utf8)))
        XCTAssertThrowsError(try p.next())
    }

    func testRejectsHugeFrames() {
        var p = WSFrameParser(maxPayload: 1000)
        p.append(WebSocket.encode(.text, [UInt8](repeating: 65, count: 2000), mask: [9, 9, 9, 9]))
        XCTAssertThrowsError(try p.next())
    }

    func testFragmentedTextWithInterleavedPing() throws {
        var a = WSMessageAssembler()
        XCTAssertNil(try a.consume(.init(fin: false, opcode: .text, payload: Array("你".utf8))))
        XCTAssertEqual(try a.consume(.init(fin: true, opcode: .ping, payload: [1])), .ping([1]))
        XCTAssertEqual(try a.consume(.init(fin: true, opcode: .continuation, payload: Array("好".utf8))), .text("你好"))
        XCTAssertThrowsError(try a.consume(.init(fin: true, opcode: .continuation, payload: [])))
    }

    func testInvalidUTF8Rejected() {
        var a = WSMessageAssembler()
        XCTAssertThrowsError(try a.consume(.init(fin: true, opcode: .text, payload: [0xff, 0xfe])))
    }
}

final class KeyAndTextTests: XCTestCase {
    func testKeyMap() {
        XCTAssertEqual(KeyMap.stroke(name: "enter", modifiers: []), KeyStroke(keyCode: 0x24))
        XCTAssertEqual(KeyMap.stroke(name: "c", modifiers: ["cmd"]), KeyStroke(keyCode: 0x08, modifiers: [.cmd]))
        XCTAssertEqual(KeyMap.stroke(name: "Z", modifiers: ["cmd", "shift", "cmd"])?.modifiers, [.cmd, .shift])
        XCTAssertEqual(KeyMap.stroke(name: "up", modifiers: ["ctrl"])?.flags, Modifier.ctrl.flag)
        XCTAssertNil(KeyMap.stroke(name: "nosuchkey", modifiers: []))
        XCTAssertNil(KeyMap.stroke(name: "a", modifiers: ["hyper"]))
    }

    func testTextPlanSplitsGraphemesAndNewlines() {
        let steps = TextPlanner.plan("你好\n👨‍👩‍👧 ok\r\nA\tB")
        XCTAssertEqual(steps, [
            .unicode("你"), .unicode("好"), .key(KeyStroke(keyCode: 0x24)),
            .unicode("👨‍👩‍👧"), .unicode(" "), .unicode("o"), .unicode("k"), .key(KeyStroke(keyCode: 0x24)),
            .unicode("A"), .key(KeyStroke(keyCode: 0x30)), .unicode("B"),
        ])
    }

    func testTextPlanChunks() {
        XCTAssertEqual(TextPlanner.plan("abcdefgh", maxUTF16: 3), [.unicode("abc"), .unicode("def"), .unicode("gh")])
        // a surrogate pair is never split
        XCTAssertEqual(TextPlanner.plan("a😀b", maxUTF16: 2), [.unicode("a"), .unicode("😀"), .unicode("b")])
    }

    func testDecodeMessages() throws {
        XCTAssertEqual(try ClientMessage.decode(#"{"t":"move","dx":1.5,"dy":-2}"#), .move(dx: 1.5, dy: -2))
        XCTAssertEqual(try ClientMessage.decode(#"{"t":"text","id":3,"s":"中文"}"#), .text(id: 3, text: "中文"))
        XCTAssertEqual(try ClientMessage.decode(#"{"t":"key","id":4,"k":"backspace","n":5}"#), .key(id: 4, name: "backspace", mods: [], repeat: 5))
        XCTAssertEqual(try ClientMessage.decode(#"{"t":"click","b":"right"}"#), .click(.right))
        XCTAssertThrowsError(try ClientMessage.decode(#"{"t":"move","dx":true,"dy":1}"#))
        XCTAssertThrowsError(try ClientMessage.decode(#"{"t":"key","id":1,"k":"a","n":999}"#))
        XCTAssertThrowsError(try ClientMessage.decode(#"{"t":"exec"}"#))
        XCTAssertThrowsError(try ClientMessage.decode("not json"))
    }
}
