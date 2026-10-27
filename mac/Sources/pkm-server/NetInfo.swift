import AppKit
import CoreImage
import Foundation
import PKMCore
import SystemConfiguration

enum NetInfo {
    /// Every IPv4 address of an active, non-loopback interface, private or not (LANURLs decides which to offer,
    /// and says why the others are left out).
    static func interfaces() -> [LANURLs.Interface] {
        var result: [LANURLs.Interface] = []
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return [] }
        defer { freeifaddrs(ifaddr) }
        for p in sequence(first: first, next: { $0.pointee.ifa_next }) {
            let flags = Int32(p.pointee.ifa_flags)
            guard flags & IFF_UP != 0, flags & IFF_LOOPBACK == 0,
                  let sa = p.pointee.ifa_addr, sa.pointee.sa_family == UInt8(AF_INET) else { continue }
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            guard getnameinfo(sa, socklen_t(sa.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 else { continue }
            result.append(LANURLs.Interface(name: String(cString: p.pointee.ifa_name), ip: String(cString: host)))
        }
        return result
    }

    /// Fresh list of addresses a phone can open (IP first, then .local), scanned now.
    static func urls(port: UInt16) -> [LANURL] {
        LANURLs.build(interfaces: interfaces(), localHostName: localHostName(), port: port)
    }

    /// One line for the log / scan window: which interfaces were seen and why some are not offered.
    static func scanSummary() -> String {
        let all = interfaces()
        if all.isEmpty { return "沒有任何網路介面有 IPv4 位址（Wi-Fi 還沒連上？）" }
        return all.map { i in "\(i.name) \(i.ip)" + (LANURLs.rejection(i).map { "：不使用，\($0)" } ?? "") }.joined(separator: "；")
    }

    /// Bonjour name, e.g. "Laptop" → http://Laptop.local:8765
    static func localHostName() -> String? {
        SCDynamicStoreCopyLocalHostName(nil) as String?
    }

    static func computerName() -> String {
        (SCDynamicStoreCopyComputerName(nil, nil) as String?) ?? Host.current().localizedName ?? "Mac"
    }
}

enum QRCode {
    /// Module matrix (true = dark) with a 2-module quiet zone.
    static func matrix(for text: String) -> [[Bool]]? {
        guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        filter.setValue(Data(text.utf8), forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")
        guard let image = filter.outputImage else { return nil }
        // I-20: the GPU context can fail (no QR on one Mac); the software renderer is the fallback
        guard let cg = CIContext().createCGImage(image, from: image.extent)
                ?? CIContext(options: [.useSoftwareRenderer: true]).createCGImage(image, from: image.extent) else { return nil }
        let w = cg.width, h = cg.height
        var pixels = [UInt8](repeating: 0, count: w * h)
        guard let bm = CGContext(data: &pixels, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                                 space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return nil }
        bm.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        // CIQRCodeGenerator already adds a 1-module margin; add one more.
        let core = (0..<h).map { y in (0..<w).map { x in pixels[y * w + x] < 128 } }
        let pad = 1
        let blank = [Bool](repeating: false, count: w + 2 * pad)
        return [blank] + core.map { [false] + $0 + [false] } + [blank]
    }

    /// Two modules per character cell using half blocks, black on white so any terminal theme scans.
    static func terminalString(for text: String) -> String? {
        guard let m = matrix(for: text) else { return nil }
        var out = ""
        var y = 0
        while y < m.count {
            out += "\u{1B}[30;47m"
            for x in 0..<m[y].count {
                let top = m[y][x]
                let bottom = y + 1 < m.count ? m[y + 1][x] : false
                switch (top, bottom) {
                case (true, true): out += "█"
                case (true, false): out += "▀"
                case (false, true): out += "▄"
                case (false, false): out += " "
                }
            }
            out += "\u{1B}[0m\n"
            y += 2
        }
        return out
    }

    /// Drawn on demand at the display's own scale (I-20: lockFocus, deprecated since macOS 14, is not used).
    static func image(for text: String, scale: CGFloat) -> NSImage? {
        guard let m = matrix(for: text) else { return nil }
        let n = m.count
        let size = CGFloat(n) * scale
        return NSImage(size: NSSize(width: size, height: size), flipped: true) { _ in
            NSColor.white.setFill()
            NSRect(x: 0, y: 0, width: size, height: size).fill()
            NSColor.black.setFill()
            for (y, row) in m.enumerated() {
                for (x, dark) in row.enumerated() where dark {
                    NSRect(x: CGFloat(x) * scale, y: CGFloat(y) * scale, width: scale, height: scale).fill()
                }
            }
            return true
        }
    }
}
