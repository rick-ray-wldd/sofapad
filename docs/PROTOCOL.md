# SofaPad protocol (Mac ↔ phone)

[README](../README.md) · [繁體中文 README](../README.zh-TW.md) · [Releasing](RELEASING.md)

Protocol version: 2 (SofaPad 4.5). The Mac also accepts version 1 (SofaPad 4.0–4.4).

This is what the SofaPad app on the Mac speaks with the phone. The phone page in `web/` is one client; a native
iPhone app can be another, next to it, and is written from this page. The Mac's code is `mac/Sources/PKMCore/`
(`Protocol.swift`, `Session.swift`, `Server.swift`, `Pairing.swift`), the page's is `web/js/connection.js`.

## 1. Transport

- The Mac listens on **port 8765** (all interfaces; `--port`, `--bind` change it). Plain **HTTP/1.1**, no TLS.
- `GET` / `HEAD` on any other path serve the phone page (`web/`). Every file comes with
  `Cache-Control: no-store` (4.5), a strict `Content-Security-Policy` and `X-Frame-Options: DENY`.
- **WebSocket** at **`/ws`** (RFC 6455, version 13). Text frames only, one JSON object per frame, at most 1 MiB;
  a binary frame closes the connection (1002). The Mac answers WebSocket pings with pongs.
- **Who may connect**: loopback, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fe80::/10, fc00::/7 (not Tailscale's
  fd7a:115c:a1e0::/48), and global IPv6 in the Mac's own /64. Tailscale (100.64.0.0/10, fd7a:115c:a1e0::/48) only
  while "允許 Tailscale 裝置" (Allow Tailscale devices) is on. Anyone else gets a 403 page for every request.
- **Host** must be an IP address, `localhost` or a `*.local` name (DNS rebinding). For `/ws`, **Origin** must be
  `http://` or `https://` followed by exactly the Host header; a request without Origin is refused (403). A native
  client sends `Origin: http://<the same host:port it connects to>`.

## 2. Messages

JSON objects with a short type in `"t"`. Unknown fields are ignored on both sides; that is how fields were added
within version 1 (`ver`, `boot`, `sent`, `last`, `caret`, …).

### Mac → client

| `t` | Fields | When |
|---|---|---|
| `hello` | `nonce`, `host`, `v`, `vmin`, `ver`, `build`, `boot` | first message on every connection. `nonce`: one-time challenge for the token proof. `host`: the Mac's name. `v`: protocol version the Mac speaks; `vmin`: oldest version it accepts (4.5: 2 and 1; a Mac from before 4.5 sends `v: 1` and no `vmin`). `ver`, `build`: the app's version and build time (`dev` when run from the source tree). `boot`: random, new each time the app starts |
| `auth_ok` | `device`, `host`, `perm`, `secure`, `locked`, `screen {w, h}`, `last`, `skipped[]`, `boot`, `token?`, `hotkeysOff?[]`, `spaces?` | login accepted. `token` only right after pairing with a code. `perm`: Accessibility permission on; `secure`: Secure Input on; `locked`: lock screen. `last`: last text/key `id` handled for this `sid`; `skipped`: ids that arrived too late and were not typed (at most 50) |
| `auth_fail` | `reason`, `retry?`, `v?`, `vmin?` | `bad_code`, `pairing_closed`, `bad_token` (forget the token), `locked` (`retry` seconds), `unauthenticated`, `protocol` (with the Mac's `v` and `vmin`; then close 4426) |
| `pairing` | `open` | a new code is on the Mac's screen (after `pair_request`) |
| `ack` | `id`, `ok`, `via?`, `dup?`, `warn?`, `err?`, `late?`, `us`, `hotkey?`, `hotkeyOff?`, `spaces?` | for every `text` and `key`. `via`: `type` or `paste`. `dup`: already handled (same `sid` and `id`). `warn`: `secure_input`. `err`: `too long`, `unknown key`, `locked`, `late` (with `late` in ms: not typed). `us`: time spent on the Mac. `hotkey…`: for ⌃←→↑↓, whether that macOS shortcut is on and how many Spaces there are |
| `pong` | `ts`, `us` | answers `ping`, echoing its `ts` |
| `status` | `perm`, `secure`, `locked` | one of them changed |
| `replaced` | | another client logged in; the Mac closes this one with 4409 |
| `error` | `msg` | a message the Mac could not use (before login it also closes with 1002) |

### Client → Mac

Before login only `pair_request`, `auth` and `ping` are accepted; anything else gets `auth_fail`
`unauthenticated` and close 4401.

| `t` | Fields | |
|---|---|---|
| `pair_request` | `device`, `v` | asks the Mac to show a new code (a 2-minute window; at most one request per 15 s) |
| `auth` | `code` or `proof`, `device`, `sid`, `v` | log in with a pairing code (the reply carries a `token`) or a token proof (§3). `sid`: random id of this client session (up to 64 characters), the scope of `id` |
| `ping` | `ts`, `wall?` | every 1.5 s. `ts`: any clock (echoed); `wall`: `Date.now()` in ms (the Mac measures delays from it) |
| `move` | `dx`, `dy` | relative pointer move in points (each clamped to ±4000) |
| `jump` | `x`, `y` | absolute position, 0…1 of the display under the pointer |
| `scroll` | `dx?`, `dy` | ±4000 |
| `click`, `down`, `up` | `b` | `left` (default), `right`, `middle`. `down`/`up` hold and release (drag). `click` and `down` carry `sent` |
| `text` | `id`, `s`, `sent?`, `at?` | type `s` (at most 20,000 characters; `\n` is Return, `\t` Tab). `id`: increasing within the `sid`. `sent`: `Date.now()` when it was put on the socket; `at`: when it was typed |
| `key` | `id`, `k`, `mods?[]`, `n?`, `sent?`, `at?` | press key `k` `n` times (1–200). Keys: a–z, 0–9, ``-=[]\;',./` ``, `enter`/`return`, `tab`, `space`, `backspace`/`delete`, `forwarddelete`, `escape`/`esc`, `left`, `right`, `up`, `down`, `home`, `end`, `pageup`, `pagedown`, `f1`–`f12`, `capslock`. Modifiers: `cmd`, `shift`, `opt`, `ctrl`, `fn` (also ⌘ ⇧ ⌥ ⌃) |
| `caret` | `k`, `mods?[]`, `n?`, `sent` | cursor pad: `left`/`right`/`up`/`down` with `shift` and/or `opt` only, `n` 1–4. Not acked; at most 40 presses a second |
| `release_all` | | release every button and modifier held down (the page sends it when it goes to the background) |

### Ordering, delivery and lateness

- Text and keys are numbered (`id`) and acked. The Mac handles them in order and drops repeats (same `sid`,
  `id` not above the last one handled).
- **Never send text or keys again after a reconnect**: by then another window may be in front on the Mac. After a
  reconnect, `auth_ok.last` and `skipped` tell which of the unacked ones were typed; report the rest to the user.
  When `boot` changed, the Mac app restarted and nothing is known.
- The Mac compares `sent` with the `wall` of recent pings. Text, keys, clicks and `down` that arrive more than 3 s
  later than a normal trip are not done (`ack` `err: "late"`); `caret` more than 0.5 s late is dropped. `move`,
  `scroll` and `up` are always done (an `up` must never be lost).
- While the Mac shows its lock screen nothing is injected (`ack` `err: "locked"`, `status` `locked: true`).

### Connection life

- Send a `ping` every 1.5 s. Treat 4.5 s without any message from the Mac as a dead connection and reconnect
  (0.3 s, ×1.6, at most 2 s between tries).
- The Mac closes a logged-in connection after 20 s without any message, an unauthenticated one after 120 s.
- One client controls the Mac at a time: a new login sends `replaced` to the old one and closes it with 4409. The
  Mac also releases everything the old client held down. Don't reconnect automatically after 4409.

| Close code | Meaning |
|---|---|
| 1000 | normal |
| 1002 | protocol error (bad frame, bad message before login, binary frame) |
| 4401 | not logged in |
| 4408 | idle |
| 4409 | replaced by another client |
| 4426 | protocol version not accepted (4.5): after `auth_fail` `protocol` |

## 3. Pairing and login

- The Mac shows a 6-digit **code** for 10 minutes after it starts and whenever someone chooses
  "配對新手機" (Pair a new phone) in its menu. `pair_request` opens a 2-minute window with a new code on the Mac's
  screen. A code pairs one client; then the window closes.
- `auth` with the `code` → `auth_ok` with a **token** (32 random bytes, base64url). Keep it on the device; the Mac
  stores only its SHA-256.
- Every later login: `auth` with
  `proof = hex(HMAC-SHA256(key = UTF-8 of hex(SHA-256(UTF-8 of token)), message = UTF-8 of hello.nonce))`,
  lowercase hex. The token itself never goes over the network again.
- Wrong codes: 5 from one address lock it out for 30 s, doubling up to 15 min; 20 from anywhere change the code and
  close pairing. `auth_fail` `bad_token` means the Mac forgot this client: delete the token and pair again.
- The QR code in the Mac's pairing window is `http://<address>:8765/#pair=<code>`; the one under
  "用 iPhone 掃描" (Scan with iPhone) has only the address.

## 4. Versions

There are two version numbers, and they are separate:

- the **app version** (`hello.ver`, e.g. `4.5.0`, and `build`), which changes with every release;
- the **protocol version** (`hello.v`, an integer), which changes only when a client has to change to keep working
  with the Mac.

**Rules (version 2)**

1. The Mac announces `v` (what it speaks) and `vmin` (the oldest it accepts) in `hello`. It accepts its own version
   and the one before it: `vmin = v − 1`.
2. A client says which version it speaks with `v` in `pair_request` and `auth`. A client that sends no `v` speaks
   version 1.
3. A client whose `v` is outside `vmin…v` gets `auth_fail` `{reason: "protocol", v, vmin}` and close 4426. It is not
   paired and nothing it sends is used.
4. A client decides from `hello` alone whether it can go on: it can when the Mac's `v` is one it knows, or when the
   Mac still accepts the client's own version (`vmin ≤ client's v ≤ Mac's v`). Otherwise it does not log in, tells
   the user who has to update (the Mac app when the Mac's `v` is lower, the client when it is higher), and looks
   again every few seconds: the Mac may be updated meanwhile.
5. Messages and fields a side doesn't know are ignored, so a newer side can add them within a version.

**What each version is**

| Version | SofaPad | Change |
|---|---|---|
| 1 | 4.0–4.4 | as above, without `v` from the client, `vmin`, `auth_fail` `protocol` and 4426 |
| 2 | 4.5 | the client sends `v`; `hello` has `vmin`; `auth_fail` `protocol`; close 4426 |

**Who works with whom**

| | Mac 4.4 (speaks 1) | Mac 4.5 (speaks 2, accepts 1–2) |
|---|---|---|
| page 4.4 (speaks 1) | yes | yes |
| page 4.5 (speaks 2, works with Macs that speak 1 or 2) | yes (the Mac ignores `v`) | yes |

The phone page also **follows the Mac's app version** (4.5): the Mac serves the page, so when `hello.ver` or
`build` differs from the page's own, the page reloads itself to get the Mac's, at most twice for the same Mac
version (`?follow=n~version` in the address), and says so if that didn't help (`web/js/follow.js`). A native client
doesn't come from the Mac: it shows the Mac's `ver` next to its own and relies on rule 4.

## 5. Writing a native client

1. Connect to `ws://<Mac>:8765/ws` with `Origin: http://<Mac>:8765`.
2. Read `hello`. Check rule 4. Log in with the token proof, or pair (show a field for the 6 digits; offer
   `pair_request`).
3. Store the `token` from the first `auth_ok`, safely (the Keychain on iOS). Remember `boot`.
4. Ping every 1.5 s with `wall`. Send `move`/`scroll` as they come (coalesce to about one per frame), `text`/`key`
   numbered and only while connected, `release_all` when the app goes to the background.
5. On a dead connection, reconnect; never resend text or keys (§2). On 4409, stop and let the user take over again.
6. Show `perm`, `secure` and `locked` from `auth_ok` and `status`, and the reasons in `auth_fail`.

Tests that pin this down: `mac/Tests/PKMCoreTests/SOFA12Tests.swift` (versions; every message type above must
appear in this file), `web/test/follow.test.mjs`, `tools/sofa12-follow.mjs` (the real 4.4.0 page against a 4.5 Mac,
mismatched versions both ways).
