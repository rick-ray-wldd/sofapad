import Foundation

/// IPv4 / IPv6 literal with a "is this on my local network?" check.
/// The server only talks to loopback, private (RFC 1918), link-local and IPv6 unique-local peers, and (SOFA-5) global
/// IPv6 peers in the same /64 as one of this Mac's own addresses. Tailscale peers only when the user allows them.
public enum IPAddress: Equatable {
    case v4([UInt8])
    case v6([UInt8])

    /// Accepts "192.168.1.5", "fe80::1%en0", "::ffff:192.168.1.5". Zone ids are ignored.
    public static func parse(_ text: String) -> IPAddress? {
        var s = text
        if let pct = s.firstIndex(of: "%") { s = String(s[..<pct]) }
        if s.hasPrefix("[") && s.hasSuffix("]") { s = String(s.dropFirst().dropLast()) }
        var v4 = in_addr()
        if inet_pton(AF_INET, s, &v4) == 1 {
            return .v4(withUnsafeBytes(of: &v4.s_addr) { Array($0) })
        }
        var v6 = in6_addr()
        if inet_pton(AF_INET6, s, &v6) == 1 {
            let bytes = withUnsafeBytes(of: &v6) { Array($0) }
            // IPv4-mapped IPv6 (::ffff:a.b.c.d) is treated as the IPv4 address.
            if bytes[0..<10].allSatisfy({ $0 == 0 }) && bytes[10] == 0xff && bytes[11] == 0xff {
                return .v4(Array(bytes[12..<16]))
            }
            return .v6(bytes)
        }
        return nil
    }

    public var isLocalNetwork: Bool {
        switch self {
        case .v4(let b):
            switch (b[0], b[1]) {
            case (127, _): return true                    // loopback
            case (10, _): return true                     // 10/8
            case (172, 16...31): return true              // 172.16/12
            case (192, 168): return true                  // 192.168/16
            case (169, 254): return true                  // link-local
            default: return false
            }
        case .v6(let b):
            if b[0..<15].allSatisfy({ $0 == 0 }) && b[15] == 1 { return true } // ::1
            if b[0] == 0xfe && (b[1] & 0xc0) == 0x80 { return true }            // fe80::/10 link-local
            if (b[0] & 0xfe) == 0xfc { return true }                            // fc00::/7 unique-local
            return false
        }
    }

    public static func isLocalNetwork(_ text: String) -> Bool {
        parse(text)?.isLocalNetwork ?? false
    }

    /// Tailscale's addresses (SOFA-5): 100.64.0.0/10, and fd7a:115c:a1e0::/48 for IPv6 (inside fc00::/7, so a
    /// Tailscale phone is not let in as "unique-local" while the 允許 Tailscale 裝置 switch is off).
    public var isTailscale: Bool {
        switch self {
        case .v4(let b): return b[0] == 100 && b[1] & 0xc0 == 64
        case .v6(let b): return b[0..<6].elementsEqual([0xfd, 0x7a, 0x11, 0x5c, 0xa1, 0xe0])
        }
    }

    /// Who may connect to the server at all (they still have to pair): the local network, and Tailscale peers only
    /// when `allowTailscale` is on (SOFA-5, off by default).
    public func isAllowedPeer(sameLinkAs own: @autoclosure () -> [IPAddress], allowTailscale: Bool) -> Bool {
        if isTailscale { return allowTailscale }
        return isLocalNetwork(sameLinkAs: own())
    }

    /// Global unicast IPv6 (2000::/3).
    public var isGlobalIPv6: Bool {
        if case .v6(let b) = self { return b[0] & 0xe0 == 0x20 }
        return false
    }

    /// SOFA-5: a phone on the same Wi-Fi often connects to the .local name with its global IPv6 address. That address
    /// shares the /64 the router hands out on this link (SLAAC), so it counts as local when its first 64 bits match
    /// one of this Mac's own global IPv6 addresses. Any other global IPv6 address is still refused.
    /// `own` is only evaluated for a global IPv6 peer.
    public func isLocalNetwork(sameLinkAs own: @autoclosure () -> [IPAddress]) -> Bool {
        if isLocalNetwork { return true }
        guard isGlobalIPv6, case .v6(let b) = self else { return false }
        return own().contains { mine in
            guard mine.isGlobalIPv6, case .v6(let m) = mine else { return false }
            return m[0..<8] == b[0..<8]
        }
    }
}
