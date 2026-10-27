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
