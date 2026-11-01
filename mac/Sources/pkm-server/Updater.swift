import AppKit
import PKMCore
import Sparkle

/// In-app updates (SOFA-12, D-56) with Sparkle: a check at every launch and once a day, 檢查更新… in the menu, the
/// release notes, then download, EdDSA check, replace and relaunch. The feed is the appcast.xml of the latest GitHub
/// release (Info.plist: SUFeedURL, SUPublicEDKey; tools/build-app.sh). SofaPad.app only, never the command-line runs.
final class Updater: NSObject, SPUUpdaterDelegate, SPUStandardUserDriverDelegate {
    static let feed = "https://github.com/rick-ray-wldd/sofapad/releases/latest/download/appcast.xml"

    private var controller: SPUStandardUpdaterController!
    private let log: (String) -> Void
    /// A phone is connected. An update found by a scheduled check then waits in the menu instead of opening a window:
    /// near launch Sparkle would make its window key, and what the phone types would land in it.
    var phoneConnected: () -> Bool = { false }
    /// The version waiting to be installed (the menu offers it), or nil.
    var onWaiting: ((String?) -> Void)?

    init(log: @escaping (String) -> Void) {
        self.log = log
        super.init()
        controller = SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: self, userDriverDelegate: self)
    }

    func start() {
        do {
            try controller.updater.start()
        } catch {
            log("自動更新無法啟動：\(error.localizedDescription)")
            return
        }
        checkAtLaunch()
    }

    /// 檢查更新… (and the menu's 安裝新版本 …: it brings the waiting update back).
    func checkForUpdates() { controller.checkForUpdates(nil) }

    /// Sparkle checks by itself at launch only when a day has passed since the last check; otherwise SofaPad asks for
    /// one, so every launch checks. Waits until Sparkle has set up its schedule (until then it refuses a check).
    private func checkAtLaunch() {
        let launched = Date()
        var delay = 0.0
        #if DEBUG
        // end-to-end update test only: check a few seconds later, once the phone is connected; not in release builds
        delay = UserDefaults.standard.double(forKey: "SofaPadTestCheckDelay")
        #endif
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] timer in
            let elapsed = Date().timeIntervalSince(launched)
            guard let self, elapsed < delay + 30 else { timer.invalidate(); return }
            let updater = self.controller.updater
            guard elapsed >= delay, !updater.sessionInProgress else { return }
            timer.invalidate()
            if (updater.lastUpdateCheckDate ?? .distantPast) < launched { updater.checkForUpdatesInBackground() }
        }
    }

    // MARK: SPUUpdaterDelegate

    func feedURLString(for updater: SPUUpdater) -> String? {
        #if DEBUG
        // end-to-end update test only (tools/sofa12-update-e2e.mjs): a feed on 127.0.0.1; not in release builds
        if let test = UserDefaults.standard.string(forKey: "SofaPadTestFeedURL") { return test }
        #endif
        return Updater.feed   // also ignores a feed URL left in the user defaults
    }

    func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        log("有新版本：\(item.displayVersionString)（\(item.versionString)）")
    }

    func updaterDidNotFindUpdate(_ updater: SPUUpdater) {
        log("檢查更新：已是最新版 \(BuildInfo.version)")
    }

    func updater(_ updater: SPUUpdater, willInstallUpdate item: SUAppcastItem) {
        log("安裝新版本 \(item.displayVersionString)，接著重新開啟 SofaPad")
    }

    func updater(_ updater: SPUUpdater, didAbortWithError error: Error) {
        let e = error as NSError
        // "no update" also ends here (SUNoUpdateError): the line above already said so
        if e.domain == SUSparkleErrorDomain && e.code == Int(SUError.noUpdateError.rawValue) { return }
        log("更新中止：\(e.localizedDescription)" + ((e.userInfo[NSUnderlyingErrorKey] as? NSError).map { "（\($0.localizedDescription)）" } ?? ""))
    }

    // MARK: SPUStandardUserDriverDelegate (gentle reminders for a menu-bar app)

    var supportsGentleScheduledUpdateReminders: Bool { true }

    func standardUserDriverShouldHandleShowingScheduledUpdate(_ update: SUAppcastItem, andInImmediateFocus immediateFocus: Bool) -> Bool {
        !phoneConnected()
    }

    func standardUserDriverWillHandleShowingUpdate(_ handleShowingUpdate: Bool, forUpdate update: SUAppcastItem, state: SPUUserUpdateState) {
        if !state.userInitiated { onWaiting?(update.displayVersionString) }
        if !handleShowingUpdate { log("有新版本 \(update.displayVersionString)：手機連線中，先放在選單列（安裝新版本…）") }
    }

    func standardUserDriverDidReceiveUserAttention(forUpdate update: SUAppcastItem) { onWaiting?(nil) }

    func standardUserDriverWillFinishUpdateSession() { onWaiting?(nil) }
}
