import Foundation

/// The addresses a phone can open this Mac at (PKM-3-2): every private IPv4 address of an active interface,
/// Wi-Fi (en0) first, then the Bonjour .local name. Built from a fresh interface scan each time it is shown —
/// the v2 list was made once at start, so an app opened at login before Wi-Fi was up only ever offered .local (I-20).
public struct LANURL: Equatable {
    public let url: String
    /// e.g. "192.168.1.20（en0）" or "Laptop.local"
    public let label: String
    public let isIP: Bool
    /// BSD name of the interface an IP URL is on, e.g. "en0" (SOFA-5: the pairing window shows it)
    public let interface: String?

    public init(url: String, label: String, isIP: Bool, interface: String? = nil) {
        self.url = url
        self.label = label
        self.isIP = isIP
        self.interface = interface
    }
}

public enum LANURLs {
    public struct Interface: Equatable {
        public let name: String
        public let ip: String
        public init(name: String, ip: String) {
            self.name = name
            self.ip = ip
        }
    }

    /// Why an interface address is not offered (shown in the scan window and the log when there is no IP URL).
    public static func rejection(_ i: Interface) -> String? {
        guard let addr = IPAddress.parse(i.ip), case .v4(let b) = addr else { return "不是 IPv4" }
        if b[0] == 127 { return "本機迴路" }
        if b[0] == 169 && b[1] == 254 { return "自動指定位址（169.254，沒拿到路由器給的 IP）" }
        if !addr.isLocalNetwork { return "不是區網位址（SofaPad 只接受區網裡的手機）" }
        return nil
    }

    public static func build(interfaces: [Interface], localHostName: String?, port: UInt16) -> [LANURL] {
        let ips = interfaces.filter { rejection($0) == nil }
            .sorted { ($0.name == "en0" ? 0 : 1, $0.name, $0.ip) < ($1.name == "en0" ? 0 : 1, $1.name, $1.ip) }
        var seen = Set<String>()
        var out: [LANURL] = []
        for i in ips where seen.insert(i.ip).inserted {
            out.append(LANURL(url: "http://\(i.ip):\(port)/", label: "\(i.ip)（\(i.name)）", isIP: true, interface: i.name))
        }
        if let host = localHostName, !host.isEmpty {
            out.append(LANURL(url: "http://\(host).local:\(port)/", label: "\(host).local", isIP: false))
        }
        return out
    }

    /// What is shown (PKM-4, D-31): one address for the QR code — an IP, which opens even where .local names do not
    /// resolve — and the .local name as the one alternative (it survives the router handing out a new IP).
    /// Everything else (other network interfaces) goes under 進階 in the menu.
    public struct Shown: Equatable {
        public let scan: LANURL?
        public let alternate: LANURL?
        public let more: [LANURL]
    }

    public static func shown(_ urls: [LANURL]) -> Shown {
        let ips = urls.filter(\.isIP)
        let name = urls.first { !$0.isIP }
        guard let first = ips.first else { return Shown(scan: name, alternate: nil, more: []) }
        return Shown(scan: first, alternate: name, more: Array(ips.dropFirst()))
    }

    /// When there is no address at all, the QR still shows the Mac's name (I-20: the menu must always have a QR):
    /// it works as soon as the Wi-Fi is up, and the window says what is missing.
    public static func fallback(computerName: String, port: UInt16) -> LANURL {
        let host = computerName.map { $0.isLetter || $0.isNumber ? String($0) : "-" }.joined()
            .split(separator: "-", omittingEmptySubsequences: true).joined(separator: "-")
        return LANURL(url: "http://\(host.isEmpty ? "Mac" : host).local:\(port)/", label: "\(host.isEmpty ? "Mac" : host).local", isIP: false)
    }

    /// What the menu-bar "用 iPhone 掃描" QR code holds: the address only, never a pairing code (D-26).
    /// The pairing window's QR is the one that carries a short-lived code (`#pair=`), and only while pairing is open.
    public static func scanPayload(_ url: LANURL) -> String { url.url }

    public static func pairingPayload(_ url: String, code: String) -> String { "\(url)#pair=\(code)" }
}
