# Test fixtures

Real Tasker exports, committed byte-for-byte (no edits, no re-serialization).
Used by the XML parse/serialize round-trip tests. Do not reformat them.

Rule: Tokens/IPs never in fixtures. No bearer tokens, API keys, IP addresses,
or personal strings. Scan with `gitleaks dir test/fixtures --no-banner` before
adding a file. Every fixture below was scanned and needed no scrubbing.

| File | Source repo | Path in repo | Commit SHA | License | Copyright |
| --- | --- | --- | --- | --- | --- |
| `dceluis-mcp-server.prj.xml` | dceluis/tasker-mcp | `dist/mcp_server.prj.xml` | `830193d799d64908d6e5405b391bce009e747786` (main HEAD when fetched) | MIT | Copyright (c) 2025 Luis Sanchez |
| `public/rho.prj.xml` | mikeyobrien/rho | `tasker/Rho.prj.xml` | `00a0dc43c02d6da2cd9fd8a6baae75922e5bcb35` | MIT | Copyright (c) 2025 Mike O'Brien |
| `public/ktools-alarm.prj.xml` | kstillson/ktools | `tools-etc/Tasker/Alarm.prj.xml` | `e92a08491a6a508c78c52303ffd9d76c1f1af47d` | MIT | Copyright (c) 2021 Ken Stillson |
| `public/cyanbridge-tasker-ai.prj.xml` | FerSaiyan/Alternative-HeyCyan-App-and-SDK | `android/CyanBridge/tasker/Tasker_AI.prj.xml` | `d89e47257ee2b67783f246f893aeeb02f4f7f8db` | Apache-2.0 | none stated in LICENSE (unfilled boilerplate); owner FerSaiyan |
| `public/taskerbchsdk-bch-monitor.prj.xml` | ElrikPiro/taskerBchSdk | `BCH_Monitor.prj.xml` | `9a530dd855e544c8ca3ca2fb941c2fb6fc176c9b` | Unlicense (public domain) | none |

Commit SHAs for the `public/` files are the latest commit touching that path
at download time (2026-10-04).

## Emulator exports

| File | Provenance |
|---|---|
| `emulator/gt-actions.xml` | Built in the Tasker 6.6.20 trial GUI on the Pixel_8 emulator with `scripts/device/add-actions.mjs` (default args; placeholder `%gtvar` where a field was mandatory), exported with Data Backup. Ground truth for the arg layouts of the actions the phone project uses. |
| `emulator/conformance-gui.xml` | Tasks `Conf.A1`..`Conf.A7`, built by hand in the Tasker 6.6.20 trial task editor on the Pixel_8 emulator (uiautomator driving the GUI), read back with `get_task_xml` and joined under one `TaskerData` root (no other edits). GUI ground truth for `test/conformance.test.ts`; see `docs/conformance.md`. No tokens (checked for 64-hex strings). |
