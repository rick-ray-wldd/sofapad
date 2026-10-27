import XCTest
@testable import PKMCore

/// PKM-3-2: the addresses offered in the menu and the "用 iPhone 掃描" QR code.
final class LANURLsTests: XCTestCase {
    typealias I = LANURLs.Interface

    func testWiFiFirstThenOtherNetworksThenLocalName() {
        let urls = LANURLs.build(interfaces: [I(name: "en7", ip: "10.0.1.12"), I(name: "en0", ip: "192.168.1.20"),
                                              I(name: "bridge100", ip: "172.20.10.1")],
                                 localHostName: "Laptop", port: 8765)
        XCTAssertEqual(urls.map(\.url), ["http://192.168.1.20:8765/", "http://172.20.10.1:8765/", "http://10.0.1.12:8765/",
                                         "http://Laptop.local:8765/"])
        XCTAssertEqual(urls.map(\.isIP), [true, true, true, false])
        XCTAssertEqual(urls[0].label, "192.168.1.20（en0）")
    }

    func testAddressesThePhoneCouldNotUseAreLeftOutWithAReason() {
        let all = [I(name: "en0", ip: "203.0.113.5"), I(name: "utun3", ip: "100.96.4.2"), I(name: "en1", ip: "169.254.7.9")]
        let urls = LANURLs.build(interfaces: all, localHostName: "Studio", port: 8765)
        XCTAssertEqual(urls.map(\.url), ["http://Studio.local:8765/"])   // only the name is left
        XCTAssertEqual(LANURLs.rejection(all[0]), "不是區網位址（SofaPad 只接受區網裡的手機）")
        XCTAssertNotNil(LANURLs.rejection(all[1]))                           // CGNAT / VPN range
        XCTAssertEqual(LANURLs.rejection(all[2]), "自動指定位址（169.254，沒拿到路由器給的 IP）")
        XCTAssertNil(LANURLs.rejection(I(name: "en0", ip: "192.168.1.2")))
    }

    func testNoNetworkNoName() {
        XCTAssertEqual(LANURLs.build(interfaces: [], localHostName: nil, port: 8765), [])
        // the same address on two interfaces is offered once
        XCTAssertEqual(LANURLs.build(interfaces: [I(name: "en0", ip: "192.168.1.2"), I(name: "en1", ip: "192.168.1.2")],
                                     localHostName: nil, port: 9000).map(\.url), ["http://192.168.1.2:9000/"])
    }

    /// D-26: the menu QR is the address only; the pairing window's QR carries the code.
    func testScanQRHasNoPairingCode() {
        let u = LANURL(url: "http://192.168.1.20:8765/", label: "192.168.1.20（en0）", isIP: true)
        XCTAssertEqual(LANURLs.scanPayload(u), "http://192.168.1.20:8765/")
        XCTAssertFalse(LANURLs.scanPayload(u).contains("#pair"))
        XCTAssertEqual(LANURLs.pairingPayload(u.url, code: "123456"), "http://192.168.1.20:8765/#pair=123456")
    }
}
