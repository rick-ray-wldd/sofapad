import XCTest

/// PKM-4 test hand for the iOS Simulator: drives Safari with the real iOS keyboard (typeText, Zhuyin keys,
/// candidates, Home and back) while the phone page talks to SofaPad on the Mac. It does nothing on its own: a script
/// on the Mac (tools/pkm4/run.mjs) writes cmd-N.json into the folder in PKM_IPC, this test runs it and writes
/// res-N.json. Files instead of HTTP, so App Transport Security never gets in the way. Runs inside the simulated
/// iPhone only — it never touches the Mac's own keyboard, mouse or windows.
final class DriverTests: XCTestCase {
    let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")

    func testDrive() throws {
        let env = ProcessInfo.processInfo.environment
        guard let dir = env["PKM_IPC"] else { XCTFail("PKM_IPC not set"); return }
        let limit = Double(env["PKM_MAX_SECONDS"] ?? "") ?? 1800
        let deadline = Date().addingTimeInterval(limit)
        let fm = FileManager.default
        var n = 1
        while Date() < deadline {
            let path = "\(dir)/cmd-\(n).json"
            guard let data = fm.contents(atPath: path),
                  let cmd = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                usleep(10_000)
                continue
            }
            let op = cmd["op"] as? String ?? ""
            var res: [String: Any] = ["n": n, "op": op, "t0": Date().timeIntervalSince1970 * 1000]
            do { try run(op, cmd, &res) } catch { res["err"] = "\(error)" }
            res["t1"] = Date().timeIntervalSince1970 * 1000
            let out = try JSONSerialization.data(withJSONObject: res)
            let tmp = "\(dir)/res-\(n).tmp"
            fm.createFile(atPath: tmp, contents: out)
            try fm.moveItem(atPath: tmp, toPath: "\(dir)/res-\(n).json")
            n += 1
            if op == "done" { return }
        }
        XCTFail("no 'done' within \(limit) s")
    }

    struct Failure: Error, CustomStringConvertible { let description: String }

    private func element(_ cmd: [String: Any]) throws -> XCUIElement {
        let label = cmd["label"] as? String ?? ""
        let e: XCUIElement
        switch cmd["kind"] as? String ?? "any" {
        case "button": e = safari.webViews.buttons[label].firstMatch
        case "textView": e = label.isEmpty ? safari.webViews.textViews.firstMatch : safari.webViews.textViews[label].firstMatch
        case "key": e = safari.keyboards.keys[label].firstMatch
        default: e = safari.descendants(matching: .any)[label].firstMatch
        }
        guard e.waitForExistence(timeout: (cmd["timeout"] as? Double) ?? 5) else { throw Failure(description: "not found: \(label)") }
        return e
    }

    private func run(_ op: String, _ cmd: [String: Any], _ res: inout [String: Any]) throws {
        switch op {
        case "activate":
            safari.activate()
        case "home":
            XCUIDevice.shared.press(.home)
        case "tap":
            try element(cmd).tap()
        case "type":
            // into whatever has keyboard focus in Safari, through the iOS keyboard
            safari.typeText(cmd["text"] as? String ?? "")
        case "typeEach":
            // one character at a time with a pause, like a person typing; t = when each typeText call returned
            let gap = UInt32(((cmd["gapMs"] as? Double) ?? 150) * 1000)
            var times: [Double] = []
            for ch in cmd["text"] as? String ?? "" {
                safari.typeText(String(ch))
                times.append(Date().timeIntervalSince1970 * 1000)
                usleep(gap)
            }
            res["times"] = times
        case "keys":
            // tap keyboard keys by label (Zhuyin ㄋ ㄧ ˇ…), then optionally a candidate
            for k in cmd["keys"] as? [String] ?? [] {
                let key = safari.keyboards.keys[k].firstMatch
                guard key.waitForExistence(timeout: 3) else { throw Failure(description: "no key \(k)") }
                key.tap()
            }
        case "typeKey":
            var flags: XCUIElement.KeyModifierFlags = []
            for m in cmd["mods"] as? [String] ?? [] {
                switch m {
                case "cmd": flags.insert(.command)
                case "shift": flags.insert(.shift)
                case "opt": flags.insert(.option)
                case "ctrl": flags.insert(.control)
                default: break
                }
            }
            safari.typeKey(cmd["key"] as? String ?? "", modifierFlags: flags)
        case "exists":
            let label = cmd["label"] as? String ?? ""
            res["exists"] = safari.descendants(matching: .any)[label].firstMatch.waitForExistence(timeout: (cmd["timeout"] as? Double) ?? 1)
        case "value":
            res["value"] = try element(cmd).value as? String ?? ""
        case "dump":
            res["tree"] = safari.debugDescription
        case "sleep":
            usleep(UInt32(((cmd["ms"] as? Double) ?? 100) * 1000))
        case "done":
            break
        default:
            throw Failure(description: "unknown op \(op)")
        }
    }
}
