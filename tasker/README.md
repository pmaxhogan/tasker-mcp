# The TaskerMCP phone project

`TaskerMCP.prj.xml` is the Tasker project that runs on the phone (or
emulator). It serves an authenticated HTTP API on port 1821 that the
`tasker-mcp` server talks to. It is generated: edit `tasker/js/*.js` or
`scripts/build-phone-project.ts`, then run

```bash
node scripts/build-phone-project.ts
```

and commit both. A unit test fails if the committed XML is stale.

## What is in it

| Object                    | Purpose                                                                                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile `TaskerMCP HTTP`  | HTTP Request event (code 2089), port 1821, method and path empty (matches every request), entry task `TaskerMCP.Dispatch`.                                                                                                                                        |
| Task `TaskerMCP.Dispatch` | Authenticates, routes, runs the needed Tasker actions, sends the HTTP Response. Collision handling "run both", so a long `/run` does not block other requests.                                                                                                    |
| Task `TaskerMCP.Setup`    | Generates a 64 hex character token from two `GenerateUUID()` calls (Java `UUID.randomUUID`, SecureRandom), stores it in `%TaskerMCP_Token`, and flashes it. On an emulator (device model `sdk_*`) it also writes `/sdcard/Download/tasker-mcp-token.txt` for adb. |
| Task `TaskerMCP.Debug`    | `Perform Task` it with `%par1` = a message to append it to the debug channel that `run_task` returns with `debug: true`.                                                                                                                                          |

## Installing

1. Copy `TaskerMCP.prj.xml` to the phone (for example into
   `Tasker/projects/` in shared storage).
2. In Tasker, long-press the project tab bar at the bottom > **Import
   Project** > pick the file.
3. Run the `TaskerMCP.Setup` task once (tap it, then the play button). It
   flashes the token; also find it in the VARS tab as `%TaskerMCP_Token`, or
   on an emulator with `adb shell cat /sdcard/Download/tasker-mcp-token.txt`.
4. Make sure Tasker is enabled and the `TaskerMCP HTTP` profile is on.

To rotate the token later, run `TaskerMCP.Setup` again or call
`POST /token/rotate`.

## Routes

Requests must come from localhost: `adb forward` (or a client on the phone
itself). Any other caller gets 403 before the token is even checked, unless
the global `%TaskerMCP_AllowRemote` is set to `1` on the phone (see Security
notes). Every request also needs `Authorization: Bearer <token>`; anything
else gets 401
`{"error": "unauthorized"}`. Errors are JSON `{"error": "..."}` with a non-200
status. Responses are sent as `text/plain` (Tasker's HTTP Response ignores the
mime field in this layout); the body is JSON except for `/backup`.

| Method | Path            | Body                                       | Response                                                                                                                                 |
| ------ | --------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/ping`         |                                            | `{ok, project, tasker, device}`                                                                                                          |
| GET    | `/backup`       |                                            | full Data Backup XML                                                                                                                     |
| GET    | `/list`         |                                            | `{projects, profiles, tasks, scenes, globals}` (names)                                                                                   |
| POST   | `/import`       | TaskerData XML with one Task               | `{ok}`. Replaces a task with the same name in place; a new task lands in the default "Base" project.                                     |
| POST   | `/config`       | full TaskerData XML                        | `202 {ok, restarting}`, then Tasker replaces its whole configuration and restarts its monitor (the server is back within a few seconds). |
| POST   | `/run`          | `{task, par1?, par2?, variables?, debug?}` | `{ok, return?, durationMs, error?, debug?}`                                                                                              |
| POST   | `/stop`         | `{task}`                                   | `{ok}`                                                                                                                                   |
| POST   | `/vars/get`     | `{name}`                                   | `{name, value?, set}`                                                                                                                    |
| POST   | `/vars/set`     | `{name, value}`                            | `{ok}`                                                                                                                                   |
| POST   | `/vars/list`    |                                            | `{globals}`                                                                                                                              |
| POST   | `/profile`      | `{name, enabled}`                          | `{ok}` or 404                                                                                                                            |
| POST   | `/command`      | `{command}`                                | `{ok}`                                                                                                                                   |
| GET    | `/runlog`       |                                            | 501: Tasker has no action that exports the Run Log                                                                                       |
| POST   | `/token/rotate` |                                            | `{token}` (the old token stops working at once)                                                                                          |

## Decisions and Tasker behaviour found on the device

Verified on Tasker 6.6.20 (trial build) on an Android 17 emulator.

- **One catch-all profile, not one per route.** Tasker honours only one HTTP
  Request event per port+path. An event with empty method and path matches
  everything, so a single profile plus a dispatcher keeps the project small
  and the routing in readable JavaScript (`tasker/js/dispatch.js`).
- **Import Data only imports tasks or a whole configuration.** Type "Task"
  replaces a same-named task in place (the existing id is kept). Profiles,
  projects, scenes, and deletions therefore go through `/config`, which the
  desktop server builds from a fresh backup with only the intended change.
  Imported new tasks always land in the "Base" project.
- **JavaScriptlet locals.** Variables declared with top-level `var` are copied
  back into the task. Locals set by an earlier JavaScriptlet are not visible
  as bare JS identifiers in a later one; read them with `local("name")`.
  Local arrays (for example Test Tasker results) are visible as JS arrays.
- **Perform Task.** "Limit Passthrough To" is not variable-expanded, so `/run`
  passes all dispatcher locals to the called task (caller-supplied variables
  are set with `setLocal` first). An empty local is "unset" and a reference to
  it stays literal, so the dispatcher has four Perform Task variants for the
  set/unset combinations of `%par1` and `%par2`.
- **Run Log.** Tasker has no action to export the Run Log, so `/runlog`
  answers 501 and `get_run_log` explains that; `get_logcat` covers the use
  case when Tasker's "Debug To System Log" preference is on.

- **Active and Passive configuration; only an editor save reaches disk.**
  Tasker holds two copies of its configuration. "Active" is the running
  service's copy; Import Data (a task or a whole configuration, so every
  `/import` and `/config`) changes only Active. "Passive" is the editor's copy,
  loaded from disk when the editor opens, and the only thing ever saved: on
  leaving the editor, `saveData` writes Passive only when the editor is dirty
  (logcat: `T: EXIT: from back: save: true dirty: false ...`). So every change
  made over this API is lost when Tasker restarts (force-stop, reboot), and if
  the user opens the editor and saves, the stale Passive overwrites them. An
  editor that is open during an import does not pick the import up.
  Exceptions that Tasker saves itself: global variables, and a profile's
  enabled flag set with Profile Status (`/profile`); that save writes only the
  flag, not other unsaved changes.
- **Persisting (`persist_config`).** `GET /backup` runs Data Backup, which
  writes Active to `/sdcard/Tasker/configs/user/tasker-mcp-live.xml`. The
  desktop server then drives the editor over adb:
  1. `am start -n net.dinglisch.android.taskerm/.Tasker -f 0x10008000`
     (CLEAR_TASK, so no stale editor instance is reused), dismissing nag
     dialogs.
  2. Menu (More options), Data, Restore, User Local Backup, then the entry
     `tasker-mcp-live` (the picker lists `Tasker/configs/user/`), then OK on
     "This will overwrite existing data. Continue ?". The editor now shows the
     live data and is dirty (Apply appears).
  3. Back: logcat shows `EXIT: ... dirty: true` and `saveData: ok: true`.
     Then Home.
  4. The restore may restart the monitor, so the server waits for `/ping` and
     re-reads `/backup` to check that nothing changed.

  Verified: a task made with `create_task` survives `am force-stop` and a
  relaunch only after this, and is lost without it
  (`test/device/persist.test.ts`). The round trip takes about 23 seconds on
  the emulator, most of it `uiautomator dump` (about 2 seconds per screen).
  The server never unlocks a phone: with the keyguard showing or the screen
  off it fails with the manual steps instead. The GUI steps match English
  labels.

## Security notes

- **Loopback only by default.** Tasker's HTTP server listens on every
  interface (verified: the socket is bound to `::`) and the HTTP Request event
  has no bind-address setting, so the dispatcher enforces it instead: it reads
  `%http_request_ip_address_v4` and answers 403 to anything that is not
  `127.0.0.1`/`::1`. `adb forward` connections arrive as `127.0.0.1`, so the
  usual USB or wireless-adb setup is unaffected. To reach the phone over
  Wi-Fi or Tailscale instead, set `%TaskerMCP_AllowRemote` to `1` in Tasker's
  VARS tab (and consider limiting the `TaskerMCP HTTP` profile with a Wi-Fi
  state context so the port is closed on other networks).

- The token is the only thing between the network and full control of
  Tasker. Keep port 1821 off untrusted networks; with adb, `adb forward` keeps
  it on localhost.
- With "Debug To System Log" on, Tasker writes variable values, including the
  token while Setup runs, to logcat. `get_logcat` redacts the token it knows.
- `TaskerMCP.Setup` writes the token to shared storage only on an emulator
  (device model `sdk_*`), where `adb` reads it. On a real phone the token
  stays in the `%TaskerMCP_Token` global; read it from the Flash or the VARS
  tab.
