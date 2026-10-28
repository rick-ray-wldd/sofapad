import Foundation
import Network

/// SOFA-5: follows network changes, so the QR codes, the menu and the pairing window never keep an IP this Mac no
/// longer has (the phone opens that address and Safari only shows a blank page).
/// NWPathMonitor says when something changed; the addresses are then scanned a few more times, because DHCP can hand
/// out the new IP a moment after the path changes. A slow scan every 10 s catches an address that changes without
/// a path update.
public final class NetWatch {
    public struct State: Equatable {
        public let urls: [LANURL]
        public let scan: LANURL
        public init(urls: [LANURL], scan: LANURL) {
            self.urls = urls
            self.scan = scan
        }
    }

    /// (before, now), on the watcher's own queue.
    public var onChange: ((State, State) -> Void)?
    private let current: () -> State
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "pkm.netwatch")
    private var last: State?
    private var timer: DispatchSourceTimer?

    public init(current: @escaping () -> State) {
        self.current = current
    }

    public func start() {
        queue.async { [self] in
            check()
            monitor.pathUpdateHandler = { [weak self] _ in
                guard let self else { return }
                for delay in [0.3, 2, 6] { self.queue.asyncAfter(deadline: .now() + delay) { [weak self] in self?.check() } }
            }
            monitor.start(queue: queue)
            let t = DispatchSource.makeTimerSource(queue: queue)
            t.schedule(deadline: .now() + 10, repeating: 10)
            t.setEventHandler { [weak self] in self?.check() }
            t.resume()
            timer = t
        }
    }

    /// Scans now (tests call it directly; the monitor and the timer call it on the queue).
    func check() {
        let now = current()
        guard let before = last else { last = now; return }
        guard now != before else { return }
        last = now
        onChange?(before, now)
    }
}
