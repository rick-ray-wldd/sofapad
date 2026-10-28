import Foundation

/// This Mac's own interface addresses, IPv4 and IPv6, scanned now (up, not loopback).
/// The menu offers the IPv4 ones as URLs (LANURLs); the server compares IPv6 peers with the IPv6 ones (SOFA-5).
public enum LocalAddresses {
    public struct Entry: Equatable {
        public let name: String
        /// Numeric text, e.g. "192.168.1.20" or "fe80::1%en0"
        public let text: String
        public let address: IPAddress
    }

    public static func scan() -> [Entry] {
        var result: [Entry] = []
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return [] }
        defer { freeifaddrs(ifaddr) }
        for p in sequence(first: first, next: { $0.pointee.ifa_next }) {
            let flags = Int32(p.pointee.ifa_flags)
            guard flags & IFF_UP != 0, flags & IFF_LOOPBACK == 0, let sa = p.pointee.ifa_addr,
                  sa.pointee.sa_family == UInt8(AF_INET) || sa.pointee.sa_family == UInt8(AF_INET6) else { continue }
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            guard getnameinfo(sa, socklen_t(sa.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 else { continue }
            let text = String(cString: host)
            guard let address = IPAddress.parse(text) else { continue }
            result.append(Entry(name: String(cString: p.pointee.ifa_name), text: text, address: address))
        }
        return result
    }
}
