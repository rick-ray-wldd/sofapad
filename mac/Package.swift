// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "PhoneKeyMouse",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "pkm-server", targets: ["pkm-server"]),
    ],
    dependencies: [
        // In-app updates (SOFA-12): the only dependency. Pinned; tools/build-app.sh embeds and re-signs the framework.
        .package(url: "https://github.com/sparkle-project/Sparkle", exact: "2.10.0"),
    ],
    targets: [
        // Pure logic: HTTP/WebSocket parsing, pairing, protocol, key map, text planning, session, server.
        .target(name: "PKMCore"),
        // Mac agent: CGEvent injector, CLI, QR code, permission checks, updates.
        .executableTarget(name: "pkm-server", dependencies: ["PKMCore", .product(name: "Sparkle", package: "Sparkle")]),
        // Test-only event probe for end-to-end tests (front-most window that records what it receives).
        .executableTarget(name: "pkm-probe"),
        .testTarget(name: "PKMCoreTests", dependencies: ["PKMCore"]),
    ]
)
