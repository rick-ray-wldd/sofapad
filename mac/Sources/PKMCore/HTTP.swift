import Foundation

/// Minimal HTTP/1.1 request head parser. Only what the phone page needs: GET for static files
/// and the WebSocket upgrade request.
public struct HTTPRequest: Equatable {
    public let method: String
    public let path: String
    public let query: String?
    public let version: String
    /// Header names are lower-cased. Repeated headers are joined with ", ".
    public let headers: [String: String]

    public func header(_ name: String) -> String? { headers[name.lowercased()] }

    public enum ParseError: Error, Equatable {
        case tooLarge
        case malformed
    }

    public static let maxHeadBytes = 16 * 1024

    /// Parses a request head from the start of `bytes`.
    /// Returns nil when the head is not complete yet; otherwise the request and the number of bytes consumed.
    public static func parse(_ bytes: [UInt8]) throws -> (HTTPRequest, Int)? {
        guard let end = findHeadEnd(bytes) else {
            if bytes.count > maxHeadBytes { throw ParseError.tooLarge }
            return nil
        }
        if end > maxHeadBytes { throw ParseError.tooLarge }
        guard let head = String(bytes: bytes[0..<end], encoding: .utf8) else { throw ParseError.malformed }
        var lines = head.components(separatedBy: "\r\n")
        guard !lines.isEmpty else { throw ParseError.malformed }
        let requestLine = lines.removeFirst().split(separator: " ", omittingEmptySubsequences: true)
        guard requestLine.count == 3, requestLine[2].hasPrefix("HTTP/") else { throw ParseError.malformed }
        let target = String(requestLine[1])
        guard target.hasPrefix("/") else { throw ParseError.malformed }
        var path = target
        var query: String?
        if let q = target.firstIndex(of: "?") {
            path = String(target[..<q])
            query = String(target[target.index(after: q)...])
        }
        var headers: [String: String] = [:]
        for line in lines where !line.isEmpty {
            guard let colon = line.firstIndex(of: ":") else { throw ParseError.malformed }
            let name = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
            let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            guard !name.isEmpty else { throw ParseError.malformed }
            if let existing = headers[name] { headers[name] = existing + ", " + value } else { headers[name] = value }
        }
        let req = HTTPRequest(method: String(requestLine[0]), path: path, query: query,
                              version: String(requestLine[2]), headers: headers)
        return (req, end + 4)
    }

    private static func findHeadEnd(_ b: [UInt8]) -> Int? {
        guard b.count >= 4 else { return nil }
        for i in 0...(b.count - 4) where b[i] == 13 && b[i + 1] == 10 && b[i + 2] == 13 && b[i + 3] == 10 {
            return i
        }
        return nil
    }

    /// True when the request asks to upgrade to a WebSocket.
    public var isWebSocketUpgrade: Bool {
        guard let upgrade = header("upgrade")?.lowercased(), upgrade == "websocket" else { return false }
        let connection = header("connection")?.lowercased() ?? ""
        return connection.split(separator: ",").contains { $0.trimmingCharacters(in: .whitespaces) == "upgrade" }
    }
}

public enum HTTPResponse {
    public static func build(status: Int, reason: String, headers: [(String, String)] = [], body: [UInt8] = []) -> [UInt8] {
        var head = "HTTP/1.1 \(status) \(reason)\r\n"
        for (k, v) in headers { head += "\(k): \(v)\r\n" }
        head += "Content-Length: \(body.count)\r\n"
        head += "Connection: close\r\n\r\n"
        return Array(head.utf8) + body
    }

    public static func text(_ status: Int, _ reason: String, _ message: String) -> [UInt8] {
        build(status: status, reason: reason,
              headers: [("Content-Type", "text/plain; charset=utf-8"), ("Cache-Control", "no-store")],
              body: Array(message.utf8))
    }
}

/// Host / Origin checks. They block DNS-rebinding and cross-site WebSocket hijacking:
/// only IP literals, localhost and *.local names are accepted, and a WebSocket Origin must name the same host.
public enum HostPolicy {
    /// Splits "host:port" / "[v6]:port" and returns the host part (lower-cased, brackets removed).
    public static func hostPart(_ hostHeader: String) -> String {
        let h = hostHeader.trimmingCharacters(in: .whitespaces).lowercased()
        if h.hasPrefix("[") {
            if let close = h.firstIndex(of: "]") { return String(h[h.index(after: h.startIndex)..<close]) }
            return h
        }
        if let colon = h.lastIndex(of: ":"), h.firstIndex(of: ":") == colon { return String(h[..<colon]) }
        return h
    }

    public static func isAllowedHost(_ hostHeader: String?) -> Bool {
        guard let hostHeader, !hostHeader.isEmpty else { return false }
        let host = hostPart(hostHeader)
        if host == "localhost" || host.hasSuffix(".local") { return true }
        return IPAddress.parse(host) != nil
    }

    /// Origin must be http(s)://<same host[:port]> as the Host header. Missing Origin is rejected for WebSockets.
    public static func originMatches(origin: String?, host: String?) -> Bool {
        guard let origin, let host else { return false }
        let o = origin.lowercased()
        let stripped: Substring
        if o.hasPrefix("http://") { stripped = o.dropFirst(7) } else if o.hasPrefix("https://") { stripped = o.dropFirst(8) } else { return false }
        return String(stripped) == host.lowercased()
    }
}
