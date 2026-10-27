import Foundation

/// Serves the phone page from a directory. Only GET/HEAD, only regular files inside the root.
public struct StaticFiles {
    public let root: URL

    public init(root: URL) { self.root = root.standardizedFileURL.resolvingSymlinksInPath() }

    static let types: [String: String] = [
        "html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8",
        "mjs": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8",
        "json": "application/json", "webmanifest": "application/manifest+json",
        "svg": "image/svg+xml", "png": "image/png", "ico": "image/x-icon", "txt": "text/plain; charset=utf-8",
    ]

    /// Security headers for every page response. The page needs no third-party resources.
    static let securityHeaders: [(String, String)] = [
        ("Content-Security-Policy", "default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"),
        ("X-Content-Type-Options", "nosniff"),
        ("Referrer-Policy", "no-referrer"),
        ("X-Frame-Options", "DENY"),
        ("Cache-Control", "no-cache"),
    ]

    public func response(for request: HTTPRequest) -> [UInt8] {
        guard request.method == "GET" || request.method == "HEAD" else {
            return HTTPResponse.text(405, "Method Not Allowed", "method not allowed")
        }
        guard let url = resolve(request.path) else {
            return HTTPResponse.text(404, "Not Found", "not found")
        }
        guard let body = try? Data(contentsOf: url) else {
            return HTTPResponse.text(404, "Not Found", "not found")
        }
        let type = StaticFiles.types[url.pathExtension.lowercased()] ?? "application/octet-stream"
        let bytes = request.method == "HEAD" ? [] : [UInt8](body)
        var headers = [("Content-Type", type)] + StaticFiles.securityHeaders
        if request.method == "HEAD" { headers.append(("X-Body-Length", "\(body.count)")) }
        return HTTPResponse.build(status: 200, reason: "OK", headers: headers, body: bytes)
    }

    /// Maps a URL path to a file inside the root, or nil (traversal, hidden files, directories, missing).
    public func resolve(_ path: String) -> URL? {
        guard let decoded = path.removingPercentEncoding else { return nil }
        var rel = decoded
        if rel == "/" || rel.isEmpty { rel = "/index.html" }
        if rel.hasSuffix("/") { rel += "index.html" }
        let parts = rel.split(separator: "/", omittingEmptySubsequences: true)
        guard !parts.isEmpty, !parts.contains(where: { $0 == ".." || $0.hasPrefix(".") || $0.contains("\0") }) else { return nil }
        let url = parts.reduce(root) { $0.appendingPathComponent(String($1)) }.standardizedFileURL.resolvingSymlinksInPath()
        guard url.path.hasPrefix(root.path + "/") else { return nil }
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir), !isDir.boolValue else { return nil }
        return url
    }
}
