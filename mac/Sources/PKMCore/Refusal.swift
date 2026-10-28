import Foundation

/// SOFA-5: a phone that is not on the Mac's local network used to be dropped without a word, so Safari only showed a
/// blank page. It now gets one short page that says why, in Chinese and English. It still cannot control anything:
/// a refused connection never gets a session, a WebSocket or a file — every request on it gets this page.
public enum Refusal {
    public static func page(peer: String) -> String {
        let p = escape(peer)
        let tailscale = IPAddress.parse(peer)?.isTailscale == true
        return """
        <!doctype html>
        <html lang="zh-Hant"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>SofaPad：手機不在 Mac 的區網裡</title>
        <style>
        body{font:16px/1.5 -apple-system,system-ui,sans-serif;margin:0 auto;padding:24px 20px;max-width:560px;color:#1d1d1f;background:#fff}
        @media (prefers-color-scheme:dark){body{color:#f2f2f7;background:#1c1c1e}}
        h1{font-size:20px;margin:0 0 8px}h1+p,section p:first-child{margin-top:0}section{margin-top:32px}
        code{font:15px ui-monospace,Menlo,monospace;word-break:break-all}ol{padding-left:22px}li{margin:6px 0}.note{opacity:.7;font-size:14px}
        </style></head><body>
        <h1>你的手機不在 Mac 的區網裡</h1>
        <p>來源位址：<code>\(p)</code>\(tailscale ? "（Tailscale：手機的連線走了 Tailscale）" : "")</p>
        <p>SofaPad 只接受和 Mac 在同一個區網裡的手機，所以這台 Mac 拒絕了這個連線。請檢查：</p>
        <ol>
        <li>關掉手機的 VPN。手機開 Tailscale 時請關掉，或在 Mac 的 SofaPad 選單打開「允許 Tailscale 裝置」。</li>
        <li>手機和 Mac 連同一個 Wi-Fi，不要連訪客網路。</li>
        <li>路由器如果開了「AP 隔離」（也叫用戶端隔離），把它關掉。</li>
        </ol>
        <p class="note">改好後再掃一次 Mac 上的 QR code。Mac 選單列的 SofaPad 選單會顯示這次被拒的來源和時間。</p>
        <section lang="en">
        <h1>Your phone is not on the Mac's local network</h1>
        <p>Source address: <code>\(p)</code>\(tailscale ? " (Tailscale: the phone's connection went through Tailscale)" : "")</p>
        <p>SofaPad only accepts phones on the same local network as the Mac, so this Mac refused the connection. Check:</p>
        <ol>
        <li>Turn off VPN on the phone. If the phone has Tailscale on, turn it off, or turn on "允許 Tailscale 裝置" (allow Tailscale devices) in the SofaPad menu on the Mac.</li>
        <li>Join the same Wi-Fi as the Mac, not a guest network.</li>
        <li>If the router has AP isolation (also called client isolation) on, turn it off.</li>
        </ol>
        <p class="note">Then scan the QR code on the Mac again. The SofaPad menu in the Mac's menu bar shows the refused address and the time.</p>
        </section>
        </body></html>

        """
    }

    /// 403 with the page above. Not cached, so the real page opens as soon as the phone is on the right network.
    public static func response(peer: String) -> [UInt8] {
        HTTPResponse.build(status: 403, reason: "Forbidden",
                           headers: [("Content-Type", "text/html; charset=utf-8"), ("Cache-Control", "no-store"),
                                     ("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'"),
                                     ("X-Content-Type-Options", "nosniff"), ("Referrer-Policy", "no-referrer")],
                           body: Array(page(peer: peer).utf8))
    }

    static func escape(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;").replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")
    }
}
