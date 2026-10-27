import XCTest
@testable import PKMCore

/// Real sockets on 127.0.0.1 (random high port), RecordingInjector instead of CGEvents.
final class ServerTests: XCTestCase {
    var server: PKMServer!
    var injector: RecordingInjector!
    var port: UInt16 = 0
    let webRoot = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../../web").standardizedFileURL

    override func setUpWithError() throws {
        injector = RecordingInjector()
        port = UInt16.random(in: 20000...40000)
        var config = PKMServer.Config(webRoot: webRoot)
        config.port = port
        config.bindHost = "127.0.0.1"
        config.hostName = "TestMac"
        server = PKMServer(config: config, pairing: PairingManager(storeURL: nil), injector: injector)
        server.log = { _ in }
        let ready = expectation(description: "ready")
        server.onReady = { _ in ready.fulfill() }
        try server.start()
        wait(for: [ready], timeout: 5)
    }

    override func tearDown() {
        server.stop()
    }

    func get(_ path: String, host: String? = nil) async throws -> (Int, [AnyHashable: Any], Data) {
        var req = URLRequest(url: URL(string: "http://127.0.0.1:\(port)\(path)")!)
        if let host { req.setValue(host, forHTTPHeaderField: "Host") }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let http = resp as! HTTPURLResponse
        return (http.statusCode, http.allHeaderFields, data)
    }

    func testServesPageWithSecurityHeaders() async throws {
        let (status, headers, body) = try await get("/")
        XCTAssertEqual(status, 200)
        XCTAssertTrue(String(decoding: body, as: UTF8.self).contains("<title>SofaPad</title>"))
        XCTAssertNotNil(headers["Content-Security-Policy"])
        XCTAssertEqual(headers["X-Content-Type-Options"] as? String, "nosniff")
        let (s2, _, _) = try await get("/js/app.js")
        XCTAssertEqual(s2, 200)
    }

    func testTraversalAndMissingFiles() async throws {
        let (s1, _, _) = try await get("/%2e%2e/%2e%2e/Package.swift")
        XCTAssertEqual(s1, 404)
        let (s2, _, _) = try await get("/nope.html")
        XCTAssertEqual(s2, 404)
    }

    func testWebSocketNeedsMatchingOrigin() async throws {
        var req = URLRequest(url: URL(string: "ws://127.0.0.1:\(port)/ws")!)
        req.setValue("http://evil.example.com", forHTTPHeaderField: "Origin")
        let task = URLSession.shared.webSocketTask(with: req)
        task.resume()
        do {
            _ = try await task.receive()
            XCTFail("handshake should be refused")
        } catch {}
    }

    func connect() async throws -> URLSessionWebSocketTask {
        var req = URLRequest(url: URL(string: "ws://127.0.0.1:\(port)/ws")!)
        req.setValue("http://127.0.0.1:\(port)", forHTTPHeaderField: "Origin")
        let task = URLSession.shared.webSocketTask(with: req)
        task.resume()
        return task
    }

    func recv(_ task: URLSessionWebSocketTask) async throws -> [String: Any] {
        guard case .string(let s) = try await task.receive() else { throw URLError(.cannotParseResponse) }
        return try JSONSerialization.jsonObject(with: Data(s.utf8)) as! [String: Any]
    }

    func send(_ task: URLSessionWebSocketTask, _ s: String) async throws { try await task.send(.string(s)) }

    func testEndToEndOverSocket() async throws {
        let ws = try await connect()
        let hello = try await recv(ws)
        XCTAssertEqual(hello["t"] as? String, "hello")
        XCTAssertEqual(hello["host"] as? String, "TestMac")

        let code = server.pairing.code
        let wrong = code == "000000" ? "111111" : "000000"
        try await send(ws, #"{"t":"auth","code":"\#(wrong)","sid":"s"}"#)
        let fail = try await recv(ws)
        XCTAssertEqual(fail["reason"] as? String, "bad_code")
        try await send(ws, #"{"t":"move","dx":1,"dy":1}"#)   // must be refused (closes the socket)
        do { _ = try await recv(ws) } catch {}
        XCTAssertEqual(injector.snapshot, [])

        let ws2 = try await connect()
        _ = try await recv(ws2)
        try await send(ws2, #"{"t":"auth","code":"\#(code)","device":"iPhone","sid":"s2"}"#)
        let ok = try await recv(ws2)
        XCTAssertEqual(ok["t"] as? String, "auth_ok")
        let token = try XCTUnwrap(ok["token"] as? String)

        try await send(ws2, #"{"t":"text","id":1,"s":"中文 English 😀"}"#)
        let ack = try await recv(ws2)
        XCTAssertEqual(ack["id"] as? Int, 1)
        try await send(ws2, #"{"t":"move","dx":3,"dy":4}"#)
        try await send(ws2, #"{"t":"click","b":"right"}"#)
        try await send(ws2, #"{"t":"scroll","dy":-20}"#)
        try await send(ws2, #"{"t":"ping","ts":42}"#)
        let pong = try await recv(ws2)
        XCTAssertEqual(pong["t"] as? String, "pong")
        XCTAssertEqual(injector.snapshot, [.type("中文 English 😀"), .move(3, 4), .click(.right), .scroll(0, -20)])

        // A second phone with the token takes over; the first one is told and released.
        let ws3 = try await connect()
        let hello3 = try await recv(ws3)
        let proof = PairingManager.proof(token: token, nonce: hello3["nonce"] as! String)
        try await send(ws3, #"{"t":"auth","proof":"\#(proof)","sid":"s3"}"#)
        let ok3 = try await recv(ws3)
        XCTAssertEqual(ok3["t"] as? String, "auth_ok")
        let replaced = try await recv(ws2)
        XCTAssertEqual(replaced["t"] as? String, "replaced")
        XCTAssertEqual(injector.snapshot.last, .releaseAll)
        ws3.cancel(with: .normalClosure, reason: nil)
    }
}
