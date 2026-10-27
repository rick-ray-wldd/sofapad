import XCTest
@testable import PKMCore

/// I-21: what the Mac does between the parts of live typing.
final class InjectionPacerTests: XCTestCase {
    func testTextWaitsAfterBackspaces() {
        var p = InjectionPacer()
        p.did(.key, at: 10.000)
        XCTAssertEqual(p.wait(before: .paste, now: 10.010), 0.040, accuracy: 1e-9)
        XCTAssertEqual(p.wait(before: .text, now: 10.020), 0.030, accuracy: 1e-9)
        XCTAssertEqual(p.wait(before: .paste, now: 10.060), 0)
    }

    func testBackspaceHeldDownIsNotSlowed() {
        var p = InjectionPacer()
        p.did(.key, at: 1)
        XCTAssertEqual(p.wait(before: .key, now: 1), 0)
        p.did(.text, at: 2)
        XCTAssertEqual(p.wait(before: .text, now: 2), 0)
        XCTAssertEqual(p.wait(before: .key, now: 2), 0)
    }

    func testKeysAndPastesWaitAfterAPaste() {
        var p = InjectionPacer()
        XCTAssertEqual(p.wait(before: .paste, now: 0), 0)   // nothing before
        p.did(.paste, at: 5)
        XCTAssertEqual(p.wait(before: .key, now: 5.01), 0.04, accuracy: 1e-9)
        XCTAssertEqual(p.wait(before: .paste, now: 5.05), 0.10, accuracy: 1e-9)
        XCTAssertEqual(p.wait(before: .paste, now: 6), 0)
    }

    /// v2 sent "⌫⌫" and "⌘V" back to back (0 ms apart); replayed through the pacer the paste goes ≥ 50 ms later.
    func testReplayOfALiveRewrite() {
        var p = InjectionPacer()
        var t = 0.0
        var times: [(InjectionPacer.Kind, Double)] = []
        for k in [InjectionPacer.Kind.key, .key, .paste, .key, .paste, .paste] {
            t += p.wait(before: k, now: t)
            times.append((k, t))
            p.did(k, at: t)
        }
        XCTAssertEqual(times[2].1 - times[1].1, 0.05, accuracy: 1e-9)   // ⌫ → paste
        XCTAssertEqual(times[3].1 - times[2].1, 0.05, accuracy: 1e-9)   // paste → ⌫
        XCTAssertEqual(times[5].1 - times[4].1, 0.15, accuracy: 1e-9)   // paste → paste
    }
}

final class ClipboardKeeperTests: XCTestCase {
    /// A burst of three pastes: each finds our own item from the paste before; the clipboard must go back to what
    /// the user had before the first one (v2 restored the previous dictated chunk instead).
    func testBurstRestoresTheOriginal() {
        var k = ClipboardKeeper<String>()
        var clipboard = "user copied this"
        var count = 100
        var restores: [(ours: Int, saved: String)] = []
        for text in ["一", "二", "三"] {
            let saved = k.snapshotForPaste(changeCount: count) { clipboard }
            count += 1; clipboard = text
            k.wrote(changeCount: count, restoring: saved)
            restores.append((count, saved))
        }
        XCTAssertEqual(restores.map(\.saved), ["user copied this", "user copied this", "user copied this"])
        // Only the last paste's restore runs; the earlier ones see a newer clipboard and leave it.
        XCTAssertFalse(k.shouldRestore(ours: restores[0].ours, now: count))
        XCTAssertFalse(k.shouldRestore(ours: restores[1].ours, now: count))
        XCTAssertTrue(k.shouldRestore(ours: restores[2].ours, now: count))
    }

    func testUserCopiesBetweenPastes() {
        var k = ClipboardKeeper<String>()
        let s1 = k.snapshotForPaste(changeCount: 1) { "A" }
        k.wrote(changeCount: 2, restoring: s1)
        // the user copies "B" (count 3) before the restore; the next paste must save "B", not "A"
        let s2 = k.snapshotForPaste(changeCount: 3) { "B" }
        XCTAssertEqual(s2, "B")
        k.wrote(changeCount: 4, restoring: s2)
        XCTAssertFalse(k.shouldRestore(ours: 2, now: 4))
        XCTAssertTrue(k.shouldRestore(ours: 4, now: 4))
        // after a restore, a new paste snapshots afresh
        XCTAssertEqual(k.snapshotForPaste(changeCount: 4) { "C" }, "C")
    }
}
