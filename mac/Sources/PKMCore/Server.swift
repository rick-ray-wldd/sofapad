import Foundation
import Network

/// LAN server: serves the phone page over HTTP and accepts one controlling phone over WebSocket (/ws).
public final class PKMServer {
    public struct Config {
        public var port: UInt16 = 8765
        /// Bind to one local address (e.g. "127.0.0.1" for tests). nil = all interfaces.
        public var bindHost: String?
        public var webRoot: URL
        public var hostName = "Mac"
        /// Close a connection that sent nothing for this long (the phone pings every 2 s).
        public var idleTimeout: TimeInterval = 20
        /// Unauthenticated sockets must authenticate within this time.
        public var authTimeout: TimeInterval = 120
        /// Tests only (PKM-4, PKM_E2E_TIMING=1): log when each text/key was typed on the phone and posted here.
        public var timingLog = false
        public init(webRoot: URL) { self.webRoot = webRoot }
    }

    public let config: Config
    public let pairing: PairingManager
    public let injector: InputInjector
    public var log: (String) -> Void = { print($0) }
    /// Fired with the bound port once listening.
    public var onReady: ((UInt16) -> Void)?
    public var onControllerChange: ((String?) -> Void)?

    let queue = DispatchQueue(label: "pkm.server")
    /// All injection, in order, off the network queue (see ControlSession.work).
    let work = DispatchQueue(label: "pkm.inject")
    /// New on every start: lets the phone tell a restarted Mac app from a lost message.
    public let boot = PairingManager.randomNonce()
    private var listener: NWListener?
    private var connections: [ObjectIdentifier: Connection] = [:]
    private weak var active: Connection?
    private let dedup = DedupStore()
    private let files: StaticFiles
    private var timer: DispatchSourceTimer?

    public init(config: Config, pairing: PairingManager, injector: InputInjector) {
        self.config = config
        self.pairing = pairing
        self.injector = injector
        self.files = StaticFiles(root: config.webRoot)
    }

    public var controllerName: String? { queue.sync { active?.session?.deviceName } }

    public func start() throws {
        let tcp = NWProtocolTCP.Options()
        tcp.noDelay = true
        let params = NWParameters(tls: nil, tcp: tcp)
        params.allowLocalEndpointReuse = true
        let listener: NWListener
        if let bind = config.bindHost {
            params.requiredLocalEndpoint = .hostPort(host: NWEndpoint.Host(bind), port: NWEndpoint.Port(rawValue: config.port)!)
            listener = try NWListener(using: params)
        } else {
            listener = try NWListener(using: params, on: NWEndpoint.Port(rawValue: config.port)!)
        }
        listener.newConnectionHandler = { [weak self] nw in self?.accept(nw) }
        listener.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                self.onReady?(listener.port?.rawValue ?? self.config.port)
            case .failed(let error):
                self.log("listener failed: \(error)")
            default: break
            }
        }
        self.listener = listener
        listener.start(queue: queue)

        let t = DispatchSource.makeTimerSource(queue: queue)
        t.schedule(deadline: .now() + 1, repeating: 1)
        t.setEventHandler { [weak self] in self?.tick() }
        t.resume()
        timer = t
    }

    public func stop() {
        queue.sync {
            timer?.cancel()
            timer = nil
            listener?.cancel()
            listener = nil
            for c in connections.values { c.session?.disconnected(); c.nw.cancel() }
            connections.removeAll()
        }
    }

    private func tick() {
        let now = Date()
        for c in connections.values {
            let limit = c.session?.isAuthenticated == true ? config.idleTimeout : config.authTimeout
            if now.timeIntervalSince(c.lastActivity) > limit {
                log("closing idle connection from \(c.peer)")
                c.closeWS(.idle, "idle")
            } else if let s = c.session {
                s.onWorkQueue { s.pushStatusIfChanged() }
            }
        }
    }

    // MARK: - connections

    private func accept(_ nw: NWConnection) {
        let peer = PKMServer.peerAddress(nw.endpoint)
        guard IPAddress.isLocalNetwork(peer) else {
            log("rejected non-local peer \(peer)")
            nw.cancel()
            return
        }
        let c = Connection(nw: nw, peer: peer, server: self)
        connections[ObjectIdentifier(c)] = c
        nw.stateUpdateHandler = { [weak self, weak c] state in
            guard let self, let c else { return }
            switch state {
            case .failed, .cancelled: self.remove(c)
            default: break
            }
        }
        nw.start(queue: queue)
        c.receive()
    }

    fileprivate func remove(_ c: Connection) {
        guard connections.removeValue(forKey: ObjectIdentifier(c)) != nil else { return }
        c.session?.disconnected()
        if active === c {
            active = nil
            log("controller disconnected: \(c.session?.deviceName ?? "?")")
            onControllerChange?(nil)
        }
    }

    fileprivate func handleHTTP(_ c: Connection, _ req: HTTPRequest) {
        guard HostPolicy.isAllowedHost(req.header("host")) else {
            c.sendAndClose(HTTPResponse.text(421, "Misdirected Request", "bad host"))
            return
        }
        if req.path == "/ws" {
            guard req.isWebSocketUpgrade, req.header("sec-websocket-version") == "13",
                  let key = req.header("sec-websocket-key"),
                  HostPolicy.originMatches(origin: req.header("origin"), host: req.header("host")) else {
                c.sendAndClose(HTTPResponse.text(403, "Forbidden", "websocket upgrade refused"))
                return
            }
            c.upgrade(key: key, session: makeSession(for: c))
            return
        }
        c.sendAndClose(files.response(for: req))
    }

    private func makeSession(for c: Connection) -> ControlSession {
        // replies may come from the injection queue: hop back to the connection's queue to send
        let s = ControlSession(peerIP: c.peer, injector: injector, pairing: pairing, dedup: dedup, work: work,
                               send: { [weak c, queue] text in queue.async { c?.sendText(text) } },
                               close: { [weak c, queue] code, reason in queue.async { c?.closeWS(code, reason) } })
        s.hostName = config.hostName
        s.boot = boot
        s.log = { [weak self] in self?.log($0) }
        if config.timingLog { s.timingLog = { [weak self] in self?.log($0) } }
        s.onAuthenticated = { [weak self, weak c] _ in
            guard let self, let c else { return }
            if let old = self.active, old !== c { old.session?.replaced() }
            self.active = c
            self.onControllerChange?(c.session?.deviceName)
        }
        return s
    }

    static func peerAddress(_ endpoint: NWEndpoint) -> String {
        guard case .hostPort(let host, _) = endpoint else { return "" }
        switch host {
        case .ipv4(let a): return a.rawValue.map(String.init).joined(separator: ".")
        case .ipv6(let a):
            let s = "\(a)"
            return s.hasPrefix("[") ? String(s.dropFirst().dropLast()) : s
        case .name(let n, _): return n
        @unknown default: return ""
        }
    }
}

/// One TCP connection: HTTP request head first, then (maybe) WebSocket frames.
final class Connection {
    let nw: NWConnection
    let peer: String
    unowned let server: PKMServer
    var session: ControlSession?
    var lastActivity = Date()
    private var head: [UInt8] = []
    private var isWebSocket = false
    private var parser = WSFrameParser()
    private var assembler = WSMessageAssembler()
    private var closing = false

    init(nw: NWConnection, peer: String, server: PKMServer) {
        self.nw = nw
        self.peer = peer
        self.server = server
    }

    func receive() {
        nw.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, complete, error in
            guard let self else { return }
            if let data, !data.isEmpty {
                self.lastActivity = Date()
                self.ingest([UInt8](data))
            }
            if complete || error != nil {
                self.nw.cancel()
                return
            }
            if !self.closing { self.receive() }
        }
    }

    private func ingest(_ bytes: [UInt8]) {
        if isWebSocket {
            parser.append(bytes)
            drainFrames()
            return
        }
        head += bytes
        do {
            guard let (req, used) = try HTTPRequest.parse(head) else { return }
            let rest = Array(head[used...])
            head = []
            server.handleHTTP(self, req)
            if isWebSocket && !rest.isEmpty {
                parser.append(rest)
                drainFrames()
            }
        } catch {
            sendAndClose(HTTPResponse.text(400, "Bad Request", "bad request"))
        }
    }

    private func drainFrames() {
        do {
            while let frame = try parser.next() {
                guard let event = try assembler.consume(frame) else { continue }
                switch event {
                case .text(let s): session?.handle(s)
                case .binary: closeWS(.protocolError, "binary not supported")
                case .ping(let p): send(WebSocket.encode(.pong, p))
                case .pong: break
                case .close: closeWS(.normal, "bye")
                }
                if closing { return }
            }
        } catch {
            closeWS(.protocolError, "protocol error")
        }
    }

    func upgrade(key: String, session: ControlSession) {
        self.session = session
        isWebSocket = true
        send(WebSocket.handshakeResponse(clientKey: key))
        session.start()
    }

    func send(_ bytes: [UInt8]) {
        nw.send(content: Data(bytes), completion: .contentProcessed { _ in })
    }

    func sendText(_ text: String) {
        guard !closing else { return }
        send(WebSocket.text(text))
    }

    func sendAndClose(_ bytes: [UInt8]) {
        closing = true
        nw.send(content: Data(bytes), completion: .contentProcessed { [weak self] _ in self?.nw.cancel() })
    }

    func closeWS(_ code: ControlSession.CloseCode, _ reason: String) {
        guard !closing else { return }
        if isWebSocket {
            sendAndClose(WebSocket.close(code: code.rawValue, reason: reason))
        } else {
            closing = true
            nw.cancel()
        }
    }
}
