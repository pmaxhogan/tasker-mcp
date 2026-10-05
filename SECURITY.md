# Security Policy

## Supported versions

tasker-mcp is pre-1.0. Only the current `main` branch and the latest release of
`@pmaxhogan/tasker-mcp` on npm (once it is published) are supported. Fixes land
on `main` and ship in the next release; there are no backports.

## Reporting a vulnerability

Report privately through GitHub, not in a public issue: go to the
[Security tab](https://github.com/pmaxhogan/tasker-mcp/security) of
`pmaxhogan/tasker-mcp` and choose **Report a vulnerability**. That opens a
private advisory visible only to you and the maintainer.

Useful details: affected version, how the phone is reached (adb forward or a
direct URL), reproduction steps, and impact.

tasker-mcp is maintained by one person in their spare time. There is no bug
bounty and no paid support. Response is best effort: expect an acknowledgement
within about a week. Please allow a reasonable window for a fix before
disclosing publicly.

## Security model

tasker-mcp gives an AI agent control of an automation app that can do almost
anything on a phone. Treat the connection and the agent accordingly.

### The token is the only control

The phone project serves HTTP on port 1821. Every request needs
`Authorization: Bearer <token>`; anything else gets 401. The token is 64 hex
characters built from two `GenerateUUID()` calls (Java `UUID.randomUUID`, backed
by `SecureRandom`). There is no other authentication, no TLS, and no rate
limiting. Anyone who has the token and can reach the port has full control of
Tasker, including running arbitrary actions.

- Tasker's HTTP server binds all interfaces on the phone and has no
  bind-address setting, so the phone project enforces loopback-only itself:
  the dispatcher answers 403 to any caller that is not `127.0.0.1`/`::1`
  before it looks at the token. `adb forward` arrives as `127.0.0.1`, so adb
  use is unaffected. Remote access (Wi-Fi, Tailscale) is an explicit opt-in:
  set the global `%TaskerMCP_AllowRemote` to `1` on the phone, and from then
  on the token is the only protection for anyone on that network.
- Prefer `adb forward` (the default when `TASKER_URL` is unset): the server
  talks to `localhost` and nothing needs to be exposed.
- Never expose port 1821 to an untrusted network or the internet. If you must
  use a direct URL, use a network you control.
- Keep the token out of shell history and config files you commit; prefer
  `TASKER_TOKEN_FILE` with a file only you can read.

### Token rotation

Rotate the token with `POST /token/rotate` (the old token stops working at once)
or by running `TaskerMCP.Setup` again. Rotate after any suspected leak, then
update `TASKER_TOKEN` or the token file.

### Logs

With Tasker's "Debug To System Log" preference on, Tasker writes variable
values, including the token while Setup runs, to logcat. `get_logcat` redacts
the token the server is configured with, but anything else on the device or in a
bug report can still read logcat. Leave that preference off unless you are
debugging.

### Snapshots

Before every mutation the server saves your full Tasker configuration to
`~/.tasker-mcp/snapshots` (the newest 20 are kept). Those files can contain
secrets that live in task actions, such as API keys, passwords, and URLs with
credentials. Protect the directory (permissions, disk encryption), keep it out of
backups and cloud sync you do not trust, and delete snapshots you no longer
need.

### Token file on emulators

`TaskerMCP.Setup` writes the token to `/sdcard/Download/tasker-mcp-token.txt`
only on emulators (device model `sdk_*`), where adb reads it. On a real phone
the token stays in the `%TaskerMCP_Token` global; read it from the flash message
or the VARS tab.

### Write policy for real phones

By default every tool may modify anything, and whole-configuration imports
(which replace all of Tasker's configuration) are allowed. On a real phone set
`TASKER_WRITE_ALLOW` to name prefixes, for example
`TASKER_WRITE_ALLOW=TaskerMCP.Test,TaskerMCP.`. Mutating tools then refuse
objects outside those prefixes, and config imports turn off unless you set
`TASKER_ALLOW_CONFIG_IMPORT=true`. Note that this scopes what the tools write; a
task you allow the agent to create can still run any Tasker action when it runs,
so the policy limits accidents, not a determined agent. Pull a Tasker Data
Backup before the first write.

### Dependencies and supply chain

- Dependabot opens weekly grouped PRs with a 3-day cooldown so a release is a few
  days old before it is proposed. Minor and patch updates auto-merge once CI is
  green; majors stay manual.
- Every push to `main` publishes to npm. The publish job installs with
  `npm ci --ignore-scripts`, so no dependency install script runs in the job
  that holds publish credentials, and publishes with provenance.
- gitleaks runs in CI and in a pre-push hook to keep secrets out of this public
  repo.
- The runtime has two dependencies: the MCP SDK and zod.

## Out of scope

- Anything that requires an attacker to already hold the token or to be the
  user running the server.
- Exposing port 1821 to an untrusted network, or running with
  `TASKER_WRITE_ALLOW` unset and an untrusted agent. These are deployment
  choices documented above.
- Vulnerabilities in Tasker, Android, adb, or Node. Report those upstream.
- Findings from automated scanners with no demonstrated exploit path.
