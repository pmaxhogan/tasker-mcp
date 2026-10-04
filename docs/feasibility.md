# Tasker MCP - Feasibility Notes

*Compiled 2026-09-27*

**Short version: yes, feasible, and ~70% of it already exists in pieces - just not as an MCP.** Nobody has shipped the full thing; the closest is a run-only MCP. The real work is the XML editing layer, and there is a Python project most of that can be lifted from.

## What Tasker actually exposes

There is no native REST/CRUD API. What you get:

- **HTTP Request event + HTTP Response action (Tasker 6.2+)** - a profile with this event makes Tasker spin up an HTTP server on the port you pick; you respond via the Quick Response field or the HTTP Response action using `%http_request_id`. This is the backbone of every "Tasker API" project out there. João's own "Http Server Example" TaskerNet project is the reference.
- **Self-management actions** callable from inside such a server: Perform Task (with `%par1`/`%par2` and return value), Data Backup (dumps the full config XML), Import (task/profile/project from XML), Set Variable / global reads, Profile Status, Command. TaskerHA's companion project wires exactly these up - it exposes profiles, tasks, scenes, and global variables, plus perform_task, send_command, backup, and import_task from XML.
- **Intents / Command System** - a `net.dinglisch.android.tasker.ACTION_TASK`-style intent with `PERMISSION_RUN_TASKS`, a Task ContentProvider that lists named tasks, and the Command System (`PERMISSION_SEND_COMMAND`), all gated behind "Allow external access" in Tasker settings. From adb that is `am broadcast`; no plugin app needed.
- **XML round-trip is the only edit path.** Tasker exports four XML types - full Data Backup (`.xml`), Project (`.prj.xml`), Profile, and Task - importable via Data > Restore, long-press import, etc. Actions are numeric codes (`<code>664</code>`) with positional args. Taskomater/Tasker-XML-Info documents the structure. If/For/End blocks are a *flat* action list with matching begin/end codes, so "hierarchy editing" is just reordering with bracket validation.
- **New Java Code action (Oct 2025 beta)** - exposes `tasker.callTask(name, params, priority)` and `sendCommand()`, plus accessibility hooks. Does not unlock config editing, but is a decent in-app place to host a richer endpoint later.
- **Logs**: Prefs > Misc > "Debug to System Log" pushes Tasker's log to logcat, which `adb logcat` reads. The Run Log is UI-only/exportable. No HTTP endpoint for it found.

## What already exists

| Project | What it does | Gap vs. requirements |
|---|---|---|
| **dceluis/tasker-mcp** (Go, 45★, 3 commits, MIT) | Import a Tasker project, generate an API key, run a Go binary (stdio or SSE) that talks to Tasker's HTTP server on port 1821; tasks are exposed as tools by marking them with a comment + Task Variables, and a Node script converts the exported XML into `toolDescriptions.json` | Run-only. No editing, no logs, no docs. Effectively abandoned. |
| **mctinker/Map-Tasker** (Python 3.11+, MIT, v13.1, active Sep 2026) | Desktop GUI that fetches backup XML over LAN via the Http Server project, edits Projects/Profiles/Tasks/Scenes, find/replace, health check, variable xref, imports edits back, test-runs tasks on the phone. Helper Tasks are added through the HTTP API on first use - List Tasker Objects (projects have no HTTP endpoint), Backup For ID Check, Import Profile, Run Task by name returning its result, plus Open/Send routes for each object type | Has everything except an MCP interface. NiceGUI-coupled, but the XML parse/edit/action-code tables are separable. Some actions/events are not editable because they need on-device info. |
| **lone-faerie/taskerha** | HA integration + "Tasker HTTP API" TaskerNet project | Cleanest reference for the phone-side project. |
| tasker-mcp (crates.io), mcp-tasker (PyPI), Zapier "TASKER" | Unrelated things that share the name | Ignore. |

## Recommended build

**Do not write an Android plugin app.** Phone side is a Tasker project (fork TaskerHA's or João's Http Server Example) exposing: list objects, backup XML, import XML, perform task w/ return, get/set global, profile enable/disable, command. Desktop side is a Python MCP (FastMCP) that:

1. **Read**: fetch backup XML → parse into project/profile/task/action tree with resolved action names (borrow MapTasker's code→name tables in `maptasker/assets`) → expose `list_projects`, `get_task`, `search_config`.
2. **Edit**: mutate the tree → serialize the affected task/profile/project XML → `import`. Validate If/For/End bracket balance and IDs before pushing; MapTasker's "backup for ID check after import" pattern exists because import can create ID collisions/duplicates, so plan for a name-based replace step.
3. **Run/logs**: `perform_task` via HTTP; `adb logcat -s Tasker` for logs when USB-attached (best-effort).
4. **Docs**: `tasker.joaoapps.com/userguide/en/` is a few hundred static HTML pages. Too big to dump whole; vendor it to markdown once and expose `search_docs` / `get_action_doc(code)` tools. A skill file with just the action-code index + XML rules is the realistic "in context" piece.

**Connectivity**: `adb forward tcp:1821 tcp:1821` over USB exposes the phone's HTTP server at `localhost:1821` with no WiFi and no Tailscale running on the phone (sidesteps battery drain). LAN IP works at home.

**Effort estimate**: phone project + run/read/vars MCP is a weekend. The edit layer with proper action-arg schemas is the long tail (MapTasker's `caveats.txt` is the list of what's annoying).

**Next step**: clone MapTasker and Tasker-XML-Info and map out which modules to extract.

## Sources

- [dceluis/tasker-mcp](https://github.com/dceluis/tasker-mcp)
- [mctinker/Map-Tasker](https://github.com/mctinker/Map-Tasker) · [Generated Output wiki](https://github.com/mctinker/Map-Tasker/wiki/Generated-Output)
- [lone-faerie/taskerha](https://github.com/lone-faerie/taskerha/)
- [Tasker HTTP Request Event docs](https://tasker.joaoapps.com/userguide/en/help/eh_http_request.html)
- [Tasker Java Code action docs](https://tasker.joaoapps.com/userguide/en/help/ah_java_code.html)
- [Taskomater/Tasker-XML-Info](https://github.com/Taskomater/Tasker-XML-Info)
- [flutter_tasker (intent/Command System/ContentProvider reference)](https://pub.dev/packages/flutter_tasker)
