// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "PhoneKeyMouse",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "pkm-server", targets: ["pkm-server"]),
    ],
    targets: [
        // Pure logic: HTTP/WebSocket parsing, pairing, protocol, key map, text planning, session, server.
        .target(name: "PKMCore"),
        // Mac agent: CGEvent injector, CLI, QR code, permission checks.
        .executableTarget(name: "pkm-server", dependencies: ["PKMCore"]),
        // Test-only event probe for end-to-end tests (front-most window that records what it receives).
        .executableTarget(name: "pkm-probe"),
        .testTarget(name: "PKMCoreTests", dependencies: ["PKMCore"]),
    ]
)
