# Public release check

SofaPad 4.0 was developed as "Phone KeyMouse" in a private repository. This repository received it as **one import
commit**, not its history: that history (54 commits) contains private details in every revision, including the
author's email in the commit metadata. The private history stays with the owner.

Checked on 2026-10-28 before the import: the whole private working tree and all of its git history were scanned; the
exported tree was scanned again afterwards.

## What was never in the history

No API keys, private keys, certificates, tokens, passwords or real pairing codes were ever committed (server logs
print the pairing code as `******`; codes in the tests are fixed fakes).

## What was changed or left out

| Category | Treatment | Places |
|---|---|---|
| Computer names (hostnames) | replaced with `<desktop>.local` / `<laptop>`; in code and tests with example names | 7 |
| The real LAN IP address | `192.168.x.x` in the records; `192.168.1.20` in code and tests | 24 |
| A public IP used as a test example | documentation range `203.0.113.5` / `x.x.x.x` | 2 |
| User name and local paths | `user`, `~/…`, or the repository name | 33 |
| IDs of the owner's personal-assistant system (station, task, project, run, terminal) and its file names | replaced with `S-…`, `T-…`, or a short description | 39 |
| Email addresses and account names | removed | 3 |
| Names of other people; the owner's unrelated work | removed or replaced with a short description | 4 |
| A user prompt about a conversation with another person (P-22) | replaced with a summary, as noted in the file | 1 |
| Test logs listing local paths, other running apps and their process ids | not included (the results files are) | 9 files |
| Three screenshots showing real network addresses | not included; 4.0 has the same window drawn with example addresses | 3 files |
| A planning note unrelated to the product, with a third party's email | not included | 1 file |
| A VPN (Tailscale) address in the test logs | `100.x.x.x` | 23 |
| One-time pairing codes printed by the test servers (expired, made for one run) | `******`, as the app's own log prints them | 23 |
| What the coordinator was busy with at the time | "busy with other work" | 3 |

Every process file in `process/` starts with a note saying it is the public version. The owner's own prompts are
kept word for word (as in the earlier SofaPad records), apart from the items above.

Kept on purpose: the owner's first name and prompts, the model names "Mac mini" and "MacBook Neo" (not network
names), the description of how the work was coordinated (with the ids removed), the coordinator's log, the plan to
share the project, and process ids and window numbers in the test logs.

## Final search (2026-10-28)

A search of this tree outside `legacy/` for every removed value — user and computer names, the LAN and campus
addresses, the whole 100.64.0.0/10 range, local paths, assistant-system ids and files, email and account names,
other people's names, the coordinator's other work, and six-digit pairing codes — finds 5 lines in 4 files (and
this file, which quotes them), none of them private:

| File | What matches | Why it stays |
|---|---|---|
| `mac/Tests/PKMCoreTests/ParsingTests.swift` | `100.64.0.1` | made-up example: addresses in this range must be refused |
| `mac/Tests/PKMCoreTests/LANURLsTests.swift` | `100.96.4.2`; `#pair=123456` | made-up examples: a VPN interface is not offered; the shape of a pairing link |
| `process/dispatch/DISPATCH-PKM-4.md`, `process/ISSUES.md` | `100.64.0.0/10` | the name of the range, not an address |

The same search over `legacy/` finds nothing.

The Python version in `legacy/v0.2-python/` was moved as it was; its own history in this repository is unchanged.

## 4.1 (2026-10-28)

Before the 4.1 commit, the same search over the whole tree, plus the computer's own local host name, LAN address and
Tailscale addresses (IPv4 and IPv6) read from its interfaces at the time, finds none of those real values. Besides the
lines in the table above it finds only made-up test values:

| File | What matches | Why it stays |
|---|---|---|
| `mac/Tests/PKMCoreTests/SOFA5Tests.swift` | `100.64.0.1`, `100.127.255.254`, `fd7a:115c:a1e0::1`, `fd7a:115c:a1e0:ab12::5` | made-up examples: the two ends of the Tailscale range, refused until the switch is on |

`100.64.0.0/10` and `fd7a:115c:a1e0::/48` now also appear in the code, README and records as the names of the ranges
that the "允許 Tailscale 裝置" switch covers. The added lines were also checked for every private IPv4 range, IPv6
addresses, `.local` names, local paths, email addresses, six-digit codes and assistant-system ids: only example values
(`192.168.1.20`, `10.0.0.5`, `2001:db8::/32`, `Studio.local`, …). The test logs in `design/evidence/sofa5/` show this
computer's Tailscale address as `100.x.x.x`. The four new screenshots show only example addresses.

## 4.2 (2026-10-29)

Before the 4.2 commit, the same search over the whole tree, with the computer's own local host name, LAN address and
Tailscale addresses read from its interfaces at the time: none of those real values, and no new matches besides the
made-up test values listed above (`SOFA6Tests.swift` uses `192.168.1.20` only). The added lines were checked again for
every private IPv4 range, IPv6, `.local` names, local paths, email addresses, six-digit codes, assistant-system ids and
names of other projects: only example values, the names of the Tailscale ranges, and the made-up test sentence of
`tools/pkm33-send-clear.mjs` in its results file. The release zip is built from the same tree (`tools/package.sh`) and
holds the app, the release notes, the install guide and the licence. Every file in it was searched too. The first
search read the executable with `strings`: it found one absolute source path with the user name, compiled in from
`#filePath` since 4.0 (process/ISSUES.md I-46; release builds no longer contain it), but `strings` on macOS skips the
symbol table, where the release build had left 47 more absolute paths as its debug map. The coordinator's scan found
them before anything was uploaded (I-47). `tools/build-app.sh` now keeps that map in a dSYM outside the app, strips it
from the app, and fails if the repo path or the home folder is anywhere in the app. The new zip was searched byte by
byte, every file including the executable, for `/Users/`, the home folder, the account and full name, the computer's
names, its LAN and Tailscale addresses read from its interfaces, any address in the private ranges, email addresses
and the assistant-system ids: none of the real values. The only private-range matches are the self-test's example
`192.168.1.20` and the Tailscale range name `100.64.0.0/10` in the menu text
([`design/evidence/sofa6/release-zip-scan.txt`](../design/evidence/sofa6/release-zip-scan.txt)). The two new
screenshots show only the test page.

## 4.3 (2026-10-30)

Before the push, every line added since 4.2.0 (`origin/main..HEAD`: the 4.3 commits, the demo page, the READMEs,
the records and the test results) was searched, with this computer's account and full name, its computer and local
host names, the git user name and its LAN and Tailscale addresses (IPv4 and IPv6) read from its interfaces at the
time: none of those real values. Also searched: every private IPv4 range and the whole 100.64.0.0/10, Tailscale IPv6,
`.local` names, local paths, email addresses, six-digit numbers and pairing-code patterns, assistant-system ids and
names, and other people's names. What it finds is only:

| Where | What matches | Why it stays |
|---|---|---|
| `design/evidence/sofa8/release-zip-scan.txt`, `design/evidence/sofa9/release-zip-scan.txt` | the range names `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, `fd7a:115c:a1e0::/48`; `192.168.1.20`; `/Users/` | the list of what the zip was searched for, with 0 or the known example hits |
| test results in `design/evidence/sofa8/`, `design/evidence/sofa9/` | six-digit numbers | milliseconds and pixel areas, not codes |
| `pkm33-send-clear` results | 「我在 Orca 說的私人內容…」 | the made-up test sentence, as in 4.2 |
| README links | `rick-ray-wldd` | the repository's own address |

One name was taken out before anything was pushed: a SOFA-8 test result named the assistant system's folder; the
unpushed commit was rewritten to describe it instead. The release zip was searched byte by byte again
([`design/evidence/sofa9/release-zip-scan.txt`](../design/evidence/sofa9/release-zip-scan.txt)): the same example
values as 4.2 and nothing real. The new screenshots show only the demo page and the test phone page (example values).
