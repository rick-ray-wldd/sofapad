import AppKit
import CoreImage
import CoreGraphics
import PKMCore

/// `pkm-server --self-test`: builds the real CGEvents for typing, shortcuts, clicks, drags, scrolls and jumps,
/// captures them instead of posting, and checks every field. Safe to run anytime: nothing reaches the system
/// and the clipboard path uses a private pasteboard.
enum SelfTest {
    static func run() -> Bool {
        var events: [CGEvent] = []
        let inj = CGInjector(textMode: .type)
        // Events that are never posted keep timestamp 0; stamp the moment they would have been posted (I-21 pacing checks).
        inj.capture = { e in
            let c = e.copy()!
            c.timestamp = CGEventTimestamp(DispatchTime.now().uptimeNanoseconds)
            events.append(c)
        }
        let pb = NSPasteboard(name: NSPasteboard.Name("SofaPad.selftest.\(getpid())"))
        inj.pasteboard = pb
        inj.pasteRestoreDelay = 0.2
        var failures = 0
        var skipped = 0
        /// Checks that need the real desktop on screen cannot be measured on the lock screen (its windows cover
        /// everything and loginwindow is in front); they are reported as SKIP, not as a pass or a failure.
        func checkOnDesktop(_ name: String, _ ok: Bool, _ detail: String = "") {
            if CGInjector(textMode: .type).screenLocked {
                skipped += 1
                print("SKIP " + name + "  → 螢幕鎖定中，最上層是鎖定畫面，解鎖後才量得到")
            } else {
                check(name, ok, detail)
            }
        }
        func check(_ name: String, _ ok: Bool, _ detail: String = "") {
            if !ok { failures += 1 }
            print((ok ? "PASS " : "FAIL ") + name + (detail.isEmpty || ok ? "" : "  → \(detail)"))
        }
        func unicode(_ e: CGEvent) -> String {
            var len = 0
            var buf = [UniChar](repeating: 0, count: 32)
            e.keyboardGetUnicodeString(maxStringLength: 32, actualStringLength: &len, unicodeString: &buf)
            return String(utf16CodeUnits: buf, count: len)
        }
        func code(_ e: CGEvent) -> Int64 { e.getIntegerValueField(.keyboardEventKeycode) }
        let cmd = CGEventFlags.maskCommand.rawValue

        // 1. text: one Unicode keyDown/keyUp pair per grapheme, Return for "\n", no modifier flags
        events = []
        _ = inj.type("你好，Hi😀👨‍👩‍👧\n")
        let downs = events.filter { $0.type == .keyDown }
        let ups = events.filter { $0.type == .keyUp }
        let typed = downs.filter { code($0) == 0 }.map(unicode)
        check("文字：中文、全形標點、英文、emoji、ZWJ 家庭 emoji 各成一組 Unicode 事件",
              typed == ["你", "好", "，", "H", "i", "😀", "👨‍👩‍👧"], "\(typed)")
        check("文字：每個 keyDown 都有對應的 keyUp", downs.count == ups.count, "\(downs.count) vs \(ups.count)")
        check("文字：換行送 Return 鍵（keycode 36）", downs.last.map(code) == 36)
        check("文字：Unicode 事件不帶修飾鍵", downs.filter { code($0) == 0 }.allSatisfy { $0.flags.rawValue & 0x00FF_0000 == 0 })

        // 2. ⌘C and ⇧⌘Z: real modifier keys go down first and up last
        events = []
        inj.key(KeyStroke(keyCode: 0x08, modifiers: [.cmd]))
        let seq = events.map { ($0.type, code($0), $0.flags.rawValue & cmd != 0) }
        check("快捷鍵 ⌘C：⌘ 按下 → C 按下／放開（帶 ⌘）→ ⌘ 放開",
              seq.count == 4 && seq[0].0 == .flagsChanged && seq[0].1 == 0x37 && seq[0].2
                && seq[1] == (.keyDown, 8, true) && seq[2] == (.keyUp, 8, true)
                && seq[3].0 == .flagsChanged && !seq[3].2, "\(seq)")
        events = []
        inj.key(KeyStroke(keyCode: 0x06, modifiers: [.cmd, .shift]))
        let z = events.first { $0.type == .keyDown }
        check("快捷鍵 ⇧⌘Z：主鍵同時帶 ⌘ 和 ⇧", z.map { $0.flags.contains(.maskCommand) && $0.flags.contains(.maskShift) } ?? false)
        check("快捷鍵 ⇧⌘Z：修飾鍵最後全部放開", events.last.map { $0.type == .flagsChanged && $0.flags.rawValue & 0x00FF_0000 == 0 } ?? false)

        // 2b. ⌃←→↑↓ (three-finger swipes) look like a physical keyboard's: same keycode, and ⌃ plus the flags the
        //     arrow key carries itself, taken from CoreGraphics' own new event for that key (I-18). Captured only.
        var arrowsOK = true
        var arrowSeen: [String] = []
        for k: UInt16 in [0x7B, 0x7C, 0x7E, 0x7D] {
            events = []
            inj.key(KeyStroke(keyCode: k, modifiers: [.ctrl]))
            let physical = ((CGEvent(keyboardEventSource: nil, virtualKey: k, keyDown: true)?.flags.rawValue ?? 0) | Modifier.ctrl.flag) & 0x00FF_0000
            let main = events.filter { $0.type == .keyDown || $0.type == .keyUp }
            let got = main.map { $0.flags.rawValue & 0x00FF_0000 }
            if main.count != 2 || !main.allSatisfy({ code($0) == Int64(k) }) || got.contains(where: { $0 != physical }) || physical != 0x00A4_0000 {
                arrowsOK = false
            }
            arrowSeen.append("\(k):" + got.map { String($0, radix: 16) }.joined(separator: "/"))
        }
        check("⌃←→↑↓（三指滑動）和實體鍵盤一樣：keycode 123／124／126／125，旗標 ⌃＋Fn＋數字鍵盤＝0xA40000（I-18）", arrowsOK, arrowSeen.joined(separator: " "))
        events = []
        inj.key(KeyStroke(keyCode: 0x08, modifiers: [.cmd]))
        check("一般按鍵不會多帶 Fn／數字鍵盤旗標（⌘C 主鍵只有 ⌘）",
              events.filter { $0.type == .keyDown }.allSatisfy { $0.flags.rawValue & 0x00FF_0000 == Modifier.cmd.flag })

        // 3. clicks: second click within the double-click interval gets clickState 2
        events = []
        inj.click(.left)
        inj.click(.left)
        let states = events.filter { $0.type == .leftMouseDown }.map { $0.getIntegerValueField(.mouseEventClickState) }
        check("雙擊：連點兩下 clickState = 1, 2", states == [1, 2], "\(states)")
        check("滑鼠事件 flags 清空（不會變成 ⌃-點擊）", events.allSatisfy { $0.flags.rawValue & 0x00FF_0000 == 0 })
        events = []
        inj.click(.right)
        check("右鍵：rightMouseDown＋rightMouseUp", events.map(\.type) == [.rightMouseDown, .rightMouseUp])

        // 4. drag: button held → moves become leftMouseDragged
        events = []
        let before = CGEvent(source: nil)?.location ?? .zero
        inj.press(.left, down: true)
        inj.moveBy(dx: 10, dy: 0)
        inj.press(.left, down: false)
        check("拖曳：按住 → leftMouseDragged → 放開", events.map(\.type) == [.leftMouseDown, .leftMouseDragged, .leftMouseUp],
              "\(events.map(\.type.rawValue))")
        if events.count == 3 {
            check("拖曳：位移 +10 pt、delta 欄位 = 10", abs(events[1].location.x - before.x - 10) < 0.01
                  && events[1].getIntegerValueField(.mouseEventDeltaX) == 10)
        }

        // 5. scroll: pixel units, continuous, fractions carried over
        events = []
        inj.scroll(dx: 0, dy: 30.6)
        inj.scroll(dx: 0, dy: 0.6)
        // Pixel scrolls carry the pixel amount in PointDeltaAxis1 (DeltaAxis1 is the derived line count).
        let wheel = events.map { $0.getIntegerValueField(.scrollWheelEventPointDeltaAxis1) }
        check("捲動：30.6 + 0.6 px → 30, 1 px（小數累積）", wheel == [30, 1], "\(wheel)")
        check("捲動：continuous（像觸控板）", events.allSatisfy { $0.getIntegerValueField(.scrollWheelEventIsContinuous) == 1 })

        // 6. jump to the middle of the current display; clamp at the edge
        var count: UInt32 = 0
        CGGetActiveDisplayList(0, nil, &count)
        var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
        CGGetActiveDisplayList(count, &ids, &count)
        let here = CGEvent(source: nil)?.location ?? .zero
        let display = ids.map { CGDisplayBounds($0) }.first { $0.contains(here) } ?? CGDisplayBounds(CGMainDisplayID())
        events = []
        inj.jump(x: 0.5, y: 0.5)
        if let e = events.first {
            check("迷你地圖：jump(0.5, 0.5) → 螢幕中央", abs(e.location.x - display.midX) < 1.5 && abs(e.location.y - display.midY) < 1.5,
                  "\(e.location) vs \(display)")
        } else { check("迷你地圖：jump 有送出事件", false) }
        events = []
        inj.moveBy(dx: -1_000_000, dy: 0)
        check("游標不會跑出螢幕：往左超出 → 停在左邊界", events.first.map { abs($0.location.x - display.minX) < 0.01 } ?? false)

        // 7. long text in auto mode → clipboard paste, then the previous clipboard comes back
        pb.clearContents()
        pb.setString("selftest-original", forType: .string)
        inj.textMode = .auto
        events = []
        let long = String(repeating: "長", count: 250)
        let via = inj.type(long)
        let pasted = pb.string(forType: .string)
        let markerTypes = pb.pasteboardItems?.first?.types.map(\.rawValue) ?? []
        let cmdV = events.contains { $0.type == .keyDown && code($0) == 9 && $0.flags.contains(.maskCommand) }
        RunLoop.main.run(until: Date().addingTimeInterval(0.5))
        check("長文字（250 字）自動改用貼上：剪貼簿放入文字＋送出 ⌘V", via == "paste" && pasted == long && cmdV)
        check("貼上後還原原本的剪貼簿", pb.string(forType: .string) == "selftest-original", pb.string(forType: .string) ?? "nil")
        check("暫存剪貼簿項目標成 transient／concealed（剪貼簿管理工具會略過）",
              markerTypes.contains("org.nspasteboard.TransientType") && markerTypes.contains("org.nspasteboard.ConcealedType"), "\(markerTypes)")

        // 7b. live dictation on a Mac with Zhuyin (I-21): "⌫×2 then paste" — the ⌘V waits a moment after the ⌫, so
        //     an app reading them as one chunk cannot drop the ⌫; a burst of pastes is spaced out and the clipboard
        //     ends up as it was before the first one (v2 left the previous dictated chunk on it).
        inj.textMode = .paste
        RunLoop.main.run(until: Date().addingTimeInterval(0.3))
        events = []
        for _ in 0..<2 { inj.key(KeyStroke(keyCode: 0x33)) }
        inj.type("鍵盤")
        let lastBackspace = events.last { $0.type == .keyUp && code($0) == 0x33 }
        let firstCmdV = events.first { $0.type == .keyDown && code($0) == 9 && $0.flags.contains(.maskCommand) }
        let gapMs = Double((firstCmdV?.timestamp ?? 0) &- (lastBackspace?.timestamp ?? 0)) / 1_000_000
        check("⌫ 後面接貼上：⌘V 至少晚 45 ms 才送，接收端不會把 ⌫ 和貼上併成一包（I-21）",
              lastBackspace != nil && firstCmdV != nil && gapMs >= 45 && gapMs < 400, String(format: "%.1f ms", gapMs))
        RunLoop.main.run(until: Date().addingTimeInterval(0.5))
        pb.clearContents()
        pb.setString("selftest-original", forType: .string)
        events = []
        for s in ["一", "二", "三"] { inj.type(s) }
        let pastes = events.filter { $0.type == .keyDown && code($0) == 9 && $0.flags.contains(.maskCommand) }.map(\.timestamp)
        let minGap = zip(pastes.dropFirst(), pastes).map { Double($0 &- $1) / 1_000_000 }.min() ?? 0
        check("連續貼上至少間隔 140 ms（慢的 App 不會讀到下一段的剪貼簿）", pastes.count == 3 && minGap >= 140, "\(pastes.count) 次，最短 \(minGap) ms")
        RunLoop.main.run(until: Date().addingTimeInterval(0.6))
        check("連續貼上之後，剪貼簿回到第一次貼上之前的內容（不會留下聽寫的字）",
              pb.string(forType: .string) == "selftest-original", pb.string(forType: .string) ?? "nil")
        inj.textMode = .type
        pb.releaseGlobally()

        // 7c. PKM-3-2: the menu-bar "用 iPhone 掃描" QR code, read back with CoreImage's own QR detector
        let scanURLs = LANURLs.build(interfaces: [LANURLs.Interface(name: "en0", ip: "192.168.1.20")], localHostName: "Studio", port: 8765)
        let scanText = LANURLs.scanPayload(scanURLs[0])
        var decoded: [String] = []
        if let img = QRCode.image(for: scanText, scale: 6), let tiff = img.tiffRepresentation, let ci = CIImage(data: tiff),
           let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh]) {
            decoded = detector.features(in: ci).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
        }
        check("「用 iPhone 掃描」QR code 掃出來就是 IP 網址，不含配對碼（PKM-3-2）", decoded == ["http://192.168.1.20:8765/"], "\(decoded)")


        // 8. e2e guard (I-11): a real mouse-down hit test, not "top-most window in the list". A small window at the
        //    probe's level sits under the full-screen Dock / Notification Center overlays. It is shown for about half
        //    a second without activating this process; nothing is posted.
        _ = NSApplication.shared
        let primary = NSScreen.screens.first!.frame
        let box = NSWindow(contentRect: NSRect(x: primary.midX - 60, y: primary.midY - 60, width: 120, height: 120),
                           styleMask: [.borderless], backing: .buffered, defer: false)
        box.level = .floating
        box.backgroundColor = .systemOrange
        box.orderFrontRegardless()
        RunLoop.main.run(until: Date().addingTimeInterval(0.25))
        let center = CGPoint(x: primary.midX, y: primary.height - primary.midY)   // CG coordinates
        let me = getpid()
        let above = (CGWindowListCopyWindowInfo([.optionOnScreenAboveWindow], CGWindowID(box.windowNumber)) as? [[String: Any]] ?? [])
            .filter { w in
                let b = w[kCGWindowBounds as String] as? [String: Double] ?? [:]
                return CGRect(x: b["X"] ?? 0, y: b["Y"] ?? 0, width: b["Width"] ?? 0, height: b["Height"] ?? 0).contains(center)
            }
            .map { "\($0[kCGWindowOwnerName as String] ?? "?")(layer \($0[kCGWindowLayer as String] ?? "?"))" }
        let owner = E2EGuard.windowOwner(at: center)
        checkOnDesktop("e2e 保護：點擊目標用真正的 hit test，自己的視窗在游標下 → 判定是自己（上面蓋著的透明視窗：\(above.isEmpty ? "無" : above.joined(separator: "、"))）",
              owner == me, "owner \(owner.map(String.init) ?? "nil") vs \(me)")
        let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: center, mouseButton: .left)!
        check("e2e 保護：視窗在游標下、但這個程式不在前景 → 點擊照樣擋（不只看視窗）",
              !E2EGuard.allows(down, probePid: me))
        if let front = NSWorkspace.shared.frontmostApplication?.processIdentifier, front != me {
            let key = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true)!
            check("e2e 保護：前景 App 是目標時，按鍵放行", E2EGuard.allows(key, probePid: front))
            checkOnDesktop("e2e 保護：前景 App 是目標、但游標下是別人的視窗 → 點擊擋下（不只看前景）",
                  !E2EGuard.allows(down, probePid: front))
            // PKM-2 §2-5: whole-Mac shortcuts are dropped in e2e mode even when the target app is in front.
            func keyEvent(_ code: CGKeyCode, _ flags: CGEventFlags) -> CGEvent {
                let e = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: true)!
                e.flags = flags
                return e
            }
            check("e2e 保護：⌃→（切換桌面）、⌃↑（Mission Control）、⌃⇧⌘4（截圖）即使前景是目標也擋下",
                  !E2EGuard.allows(keyEvent(0x7C, .maskControl), probePid: front)
                  && !E2EGuard.allows(keyEvent(0x7E, .maskControl), probePid: front)
                  && !E2EGuard.allows(keyEvent(0x15, [.maskControl, .maskShift, .maskCommand]), probePid: front))
            check("e2e 保護：⌘A、⌘=、⌥⌘K 這類只影響前景 App 的快捷鍵照常放行",
                  E2EGuard.allows(keyEvent(0x00, .maskCommand), probePid: front)
                  && E2EGuard.allows(keyEvent(0x18, .maskCommand), probePid: front)
                  && E2EGuard.allows(keyEvent(0x28, [.maskAlternate, .maskCommand]), probePid: front))
        }
        box.ignoresMouseEvents = true
        RunLoop.main.run(until: Date().addingTimeInterval(0.25))
        let through = E2EGuard.windowOwner(at: center)
        check("e2e 保護：不接點擊的視窗（像 Dock、通知中心的全螢幕透明層）會被略過", through != me,
              "owner \(through.map(String.init) ?? "nil")")
        box.orderOut(nil)
        check("e2e 保護：拿不到視窗（螢幕外）→ 沒有擁有者 → 判定不是 probe",
              E2EGuard.windowOwner(at: CGPoint(x: -100_000, y: -100_000)) == nil)

        print("資訊：目前 Mac 輸入來源是輸入法（會自動改用貼上）＝\(CGInjector.inputMethodActive())；螢幕鎖定＝\(CGInjector(textMode: .type).screenLocked)；輔助使用權限＝\(inj.hasPermission)；三指手勢需要但被關掉的系統快速鍵＝\(SystemShortcutCheck.disabledNow().isEmpty ? "無" : SystemShortcutCheck.disabledNow().joined(separator: ","))；空間（桌面＋全螢幕 App）數＝\(SystemShortcutCheck.spaceCountNow().map(String.init) ?? "不明")")
        let skipNote = skipped > 0 ? "（略過 \(skipped) 項：螢幕鎖定）" : ""
        print(failures == 0 ? "SELF-TEST OK" + skipNote : "SELF-TEST FAILED (\(failures))" + skipNote)
        return failures == 0
    }
}
