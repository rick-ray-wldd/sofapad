import Foundation

/// Version and build time, shown in the menu bar and sent to the phone (PKM-4: "which version is Ray running?").
/// The app bundle carries both in Info.plist (tools/build-app.sh); a build run from the source tree says "dev".
public enum BuildInfo {
    /// Same as the VERSION file and web/js/version.js (a test checks they agree).
    public static let sourceVersion = "4.4.0"

    public static var version: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? sourceVersion
    }

    /// e.g. "2026-10-28 05:12"; "dev" when not built as an app.
    public static var build: String {
        Bundle.main.infoDictionary?["SofaPadBuildTime"] as? String ?? "dev"
    }
}
