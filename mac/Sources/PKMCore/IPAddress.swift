import Foundation

/// IPv4 / IPv6 literal with a "is this on my local network?" check.
/// The server only talks to loopback, private (RFC 1918), link-local and IPv6 unique-local peers.
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
}
