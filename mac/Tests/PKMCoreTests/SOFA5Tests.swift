import XCTest
@testable import PKMCore

/// SOFA-5: who may connect (same-/64 IPv6, Tailscale switch) and what a refused phone is told.
final class SOFA5Tests: XCTestCase {
    func ip(_ s: String) -> IPAddress { IPAddress.parse(s)! }

    // MARK: same /64 IPv6

    func testGlobalIPv6InTheMacsOwnSlash64IsLocal() {
        let own = [ip("192.168.1.20"), ip("fe80::1c2b:3a4d:5e6f:7081%en0"), ip("2001:db8:1:2:aaaa:bbbb:cccc:10")]
        XCTAssertTrue(ip("2001:db8:1:2::5").isLocalNetwork(sameLinkAs: own), "same /64 = same Wi-Fi")
        XCTAssertTrue(ip("2001:db8:1:2:ffff:ffff:ffff:ffff").isLocalNetwork(sameLinkAs: own), "a temporary address in the same /64")
        XCTAssertFalse(ip("2001:db8:1:3::5").isLocalNetwork(sameLinkAs: own), "the next /64 is another network")
        XCTAssertFalse(ip("2001:db8:9:2::5").isLocalNetwork(sameLinkAs: own))
        XCTAssertFalse(ip("2606:4700::1111").isLocalNetwork(sameLinkAs: own), "other global IPv6 is still refused")
    }

    func testOnlyTheMacsGlobalIPv6AddressesCount() {
        // no global IPv6 on the Mac: no global IPv6 peer is local, whatever the Mac's other addresses are
        let own = [ip("192.168.1.20"), ip("fe80::1"), ip("fd12:3456:789a:1::1")]
        XCTAssertFalse(ip("2001:db8:1:2::5").isLocalNetwork(sameLinkAs: own))
        XCTAssertFalse(ip("2001:db8:1:2::5").isLocalNetwork(sameLinkAs: []))
        // the /64 rule is IPv6 only: a public IPv4 next to the Mac's is still refused
        XCTAssertFalse(ip("203.0.113.5").isLocalNetwork(sameLinkAs: [ip("203.0.113.1")]))
    }

    func testPrivateAddressesStayLocalAndTheMacIsOnlyScannedForGlobalIPv6() {
        var scans = 0
        func own() -> [IPAddress] { scans += 1; return [] }
        for ok in ["192.168.1.5", "10.0.0.2", "172.16.0.9", "169.254.1.1", "127.0.0.1", "::1", "fe80::1%en0", "fd12:3456::1"] {
            XCTAssertTrue(ip(ok).isLocalNetwork(sameLinkAs: own()), ok)
        }
        XCTAssertFalse(ip("8.8.8.8").isLocalNetwork(sameLinkAs: own()))
        XCTAssertEqual(scans, 0, "interfaces are scanned only for a global IPv6 peer")
        _ = ip("2001:db8::1").isLocalNetwork(sameLinkAs: own())
        XCTAssertEqual(scans, 1)
    }

    // MARK: Tailscale switch

    func testTailscaleAddresses() {
        for t in ["100.64.0.1", "100.127.255.254", "fd7a:115c:a1e0::1", "fd7a:115c:a1e0:ab12::5"] {
            XCTAssertTrue(ip(t).isTailscale, t)
        }
        for n in ["100.63.255.255", "100.128.0.1", "192.168.1.5", "fd7a:115c:a1e1::1", "fd12:3456::1"] {
            XCTAssertFalse(ip(n).isTailscale, n)
        }
    }

    func testTailscalePeersOnlyWhenTheSwitchIsOn() {
        for t in ["100.64.0.1", "fd7a:115c:a1e0::1"] {
            XCTAssertFalse(ip(t).isAllowedPeer(sameLinkAs: [], allowTailscale: false), "\(t): off by default")
            XCTAssertTrue(ip(t).isAllowedPeer(sameLinkAs: [], allowTailscale: true), t)
        }
        // Tailscale's IPv6 range is inside fc00::/7, which counts as local otherwise
        XCTAssertTrue(ip("fd7a:115c:a1e0::1").isLocalNetwork)
        // the switch does not change anything else
        for ok in ["192.168.1.5", "fd12:3456::1"] {
            XCTAssertTrue(ip(ok).isAllowedPeer(sameLinkAs: [], allowTailscale: false), ok)
        }
        XCTAssertFalse(ip("8.8.8.8").isAllowedPeer(sameLinkAs: [], allowTailscale: true))
        XCTAssertFalse(ip("2001:db8:1:2::5").isAllowedPeer(sameLinkAs: [], allowTailscale: true))
        XCTAssertTrue(ip("2001:db8:1:2::5").isAllowedPeer(sameLinkAs: [ip("2001:db8:1:2::10")], allowTailscale: false))
    }

    // MARK: the 403 page

    func testRefusalPageSaysWhyInBothLanguages() {
        let page = Refusal.page(peer: "203.0.113.5")
        XCTAssertTrue(page.contains("<code>203.0.113.5</code>"))
        XCTAssertTrue(page.contains("你的手機不在 Mac 的區網裡"))
        XCTAssertTrue(page.contains("Your phone is not on the Mac's local network"))
        for fix in ["關掉手機的 VPN", "連同一個 Wi-Fi，不要連訪客網路", "AP 隔離",
                    "Turn off VPN on the phone", "not a guest network", "AP isolation"] {
            XCTAssertTrue(page.contains(fix), fix)
        }
        XCTAssertTrue(page.contains("手機開 Tailscale 時請關掉，或在 Mac 的 SofaPad 選單打開「允許 Tailscale 裝置」"))
        XCTAssertFalse(page.contains("手機的連線走了 Tailscale"), "only said for a Tailscale address")
        XCTAssertTrue(Refusal.page(peer: "100.64.0.1").contains("（Tailscale：手機的連線走了 Tailscale）"))
        XCTAssertFalse(page.contains("<script"), "no script, nothing loaded from anywhere")
        XCTAssertTrue(Refusal.page(peer: "<b>&\"'").contains("&lt;b&gt;&amp;&quot;&#39;"))
    }

    func testRefusalResponseIs403AndNotCached() {
        let text = String(decoding: Refusal.response(peer: "203.0.113.5"), as: UTF8.self)
        XCTAssertTrue(text.hasPrefix("HTTP/1.1 403 Forbidden\r\n"))
        XCTAssertTrue(text.contains("Content-Type: text/html; charset=utf-8\r\n"))
        XCTAssertTrue(text.contains("Cache-Control: no-store\r\n"))
        XCTAssertTrue(text.contains("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\r\n"))
        XCTAssertTrue(text.contains("Connection: close\r\n"))
    }

    func testIPURLsKnowTheirInterface() {
        let urls = LANURLs.build(interfaces: [LANURLs.Interface(name: "en0", ip: "192.168.1.20")], localHostName: "Studio", port: 8765)
        XCTAssertEqual(urls.map(\.interface), ["en0", nil])
    }
}

/// The server end to end on 127.0.0.1, with the peer check replaced so this address counts as refused.
final class RefusalServerTests: XCTestCase {
    var server: PKMServer!
    var injector: RecordingInjector!
    var port: UInt16 = 0
    var refused: [String] = []
    let lock = NSLock()
    var allow = false
    let webRoot = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../../web").standardizedFileURL

    override func setUpWithError() throws {
        injector = RecordingInjector()
        port = UInt16.random(in: 20000...40000)
        var config = PKMServer.Config(webRoot: webRoot)
        config.port = port
        config.bindHost = "127.0.0.1"
        server = PKMServer(config: config, pairing: PairingManager(storeURL: nil), injector: injector)
        server.log = { _ in }
        server.isAllowedPeer = { [unowned self] _ in lock.withLock { allow } }
        server.onRefused = { [unowned self] peer, _ in lock.withLock { refused.append(peer) } }
        let ready = expectation(description: "ready")
        server.onReady = { _ in ready.fulfill() }
        try server.start()
        wait(for: [ready], timeout: 5)
    }

    override func tearDown() { server.stop() }

    func get(_ path: String) async throws -> (Int, [AnyHashable: Any], String) {
        let (data, resp) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:\(port)\(path)")!)
        let http = resp as! HTTPURLResponse
        return (http.statusCode, http.allHeaderFields, String(decoding: data, as: UTF8.self))
    }

    func testRefusedPeerGetsTheExplanationForEveryRequestAndNothingElse() async throws {
        let (status, headers, body) = try await get("/")
        XCTAssertEqual(status, 403)
        XCTAssertEqual(headers["Cache-Control"] as? String, "no-store")
        XCTAssertTrue(body.contains("<code>127.0.0.1</code>"))
        XCTAssertTrue(body.contains("Your phone is not on the Mac's local network"))
        let (s2, _, b2) = try await get("/js/app.js")
        XCTAssertEqual(s2, 403, "no files")
        XCTAssertFalse(b2.contains("import"))

        var req = URLRequest(url: URL(string: "ws://127.0.0.1:\(port)/ws")!)
        req.setValue("http://127.0.0.1:\(port)", forHTTPHeaderField: "Origin")
        let task = URLSession.shared.webSocketTask(with: req)
        task.resume()
        do {
            _ = try await task.receive()
            XCTFail("no WebSocket for a refused peer")
        } catch {}
        XCTAssertTrue(injector.events.isEmpty)
        XCTAssertEqual(lock.withLock { refused }.first, "127.0.0.1", "the menu bar hears about it")
        XCTAssertGreaterThanOrEqual(lock.withLock { refused.count }, 3)

        lock.withLock { allow = true }
        let (s3, _, b3) = try await get("/")
        XCTAssertEqual(s3, 200)
        XCTAssertTrue(b3.contains("<title>SofaPad</title>"))
    }
}

/// The network watcher reports a change once, with the address before and after, and stays quiet otherwise.
final class NetWatchTests: XCTestCase {
    func testReportsEachChangeOnce() {
        let a = LANURL(url: "http://192.168.1.20:8765/", label: "192.168.1.20（en0）", isIP: true, interface: "en0")
        let b = LANURL(url: "http://10.0.0.5:8765/", label: "10.0.0.5（en0）", isIP: true, interface: "en0")
        let name = LANURL(url: "http://Studio.local:8765/", label: "Studio.local", isIP: false)
        var now = NetWatch.State(urls: [a, name], scan: a)
        let watch = NetWatch(current: { now })
        var seen: [(NetWatch.State, NetWatch.State)] = []
        watch.onChange = { seen.append(($0, $1)) }
        watch.check()                       // the first scan only sets the starting point
        watch.check()
        XCTAssertTrue(seen.isEmpty)
        now = NetWatch.State(urls: [b, name], scan: b)   // DHCP gave the Mac a new IP
        watch.check()
        watch.check()
        XCTAssertEqual(seen.count, 1)
        XCTAssertEqual(seen.first?.0.scan.url, "http://192.168.1.20:8765/")
        XCTAssertEqual(seen.first?.1.scan.url, "http://10.0.0.5:8765/")
        now = NetWatch.State(urls: [name], scan: name)   // Wi-Fi off: only the name is left
        watch.check()
        XCTAssertEqual(seen.count, 2)
        XCTAssertEqual(seen.last?.1.scan.url, "http://Studio.local:8765/")
    }
}
