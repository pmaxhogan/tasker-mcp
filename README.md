# tasker-mcp

[![CI](https://github.com/pmaxhogan/tasker-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/pmaxhogan/tasker-mcp/actions/workflows/ci.yml)
[![Publish](https://github.com/pmaxhogan/tasker-mcp/actions/workflows/publish.yml/badge.svg)](https://github.com/pmaxhogan/tasker-mcp/actions/workflows/publish.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An MCP server that gives AI agents full read, edit, and run access to
[Tasker](https://tasker.joaoapps.com) on Android. An agent can list and inspect
every task, profile, project, and scene, create and edit them, run tasks and
ad-hoc action lists, read and write global variables, and look up Tasker's
action reference, all without you clicking through the Tasker editor. It works
through Tasker's own HTTP Request event and its XML export/import, so the only
thing on the phone is one small Tasker project: there is no Android app to
install beyond Tasker itself.

## Requirements

- Tasker 6.2 or newer on the phone (the HTTP Request event is required). Tested
  on 6.6.20 and 6.7.6-beta.
- Node 26 or newer on the machine that runs your MCP client.
- adb is optional. It is the safest way to reach the phone (see Quickstart).

## Quickstart

### 1. Install the phone project

1. Copy `tasker/TaskerMCP.prj.xml` from this repo to the phone (for example into
   `Tasker/projects/` in shared storage).
2. In Tasker, long-press the project tab bar at the bottom, choose **Import
   Project**, and pick the file.
3. Run the `TaskerMCP.Setup` task once (open it and press play). It generates a
   token and flashes it. You can read it again later in the VARS tab as
   `%TaskerMCP_Token`.
4. Make sure Tasker is enabled and the `TaskerMCP HTTP` profile is on.

### 2. Connect

- **adb (recommended).** Attach the phone by USB or wireless debugging. When
  `TASKER_URL` is unset and exactly one device is attached, tasker-mcp runs
  `adb forward` for port 1821 itself and talks to `localhost`, so the port never
  has to be reachable from the network. With several devices, set
  `TASKER_ADB_SERIAL`.
- **Direct.** The phone project refuses non-localhost callers by default. To
  use `TASKER_URL=http://<phone-ip>:1821` on a network you trust, first set
  the global `%TaskerMCP_AllowRemote` to `1` in Tasker's VARS tab. Read
  [SECURITY.md](SECURITY.md): with remote access on, the token is the only
  protection.

Give the server the token with `TASKER_TOKEN` or, better, `TASKER_TOKEN_FILE`
(a file containing just the token).

### 3. Install the server

The package is not published to npm yet (the publish workflow currently runs
`npm publish --dry-run`). Until it is, build from source:

```bash
git clone https://github.com/pmaxhogan/tasker-mcp.git
cd tasker-mcp
npm ci
npm run build
claude mcp add tasker --scope user \
  -e TASKER_TOKEN_FILE=/abs/path/to/tasker-token.txt \
  -- node /abs/path/to/tasker-mcp/dist/index.js
```

Once published, this becomes:

```bash
claude mcp add tasker --scope user \
  -e TASKER_TOKEN_FILE=/abs/path/to/tasker-token.txt \
  -- npx -y @pmaxhogan/tasker-mcp
```

Any other MCP client that speaks stdio takes the same command in its JSON
config:

```json
{
  "mcpServers": {
    "tasker": {
      "command": "node",
      "args": ["/abs/path/to/tasker-mcp/dist/index.js"],
      "env": {
        "TASKER_TOKEN_FILE": "/abs/path/to/tasker-token.txt",
        "TASKER_WRITE_ALLOW": "TaskerMCP.Test,TaskerMCP."
      }
    }
  }
}
```

Verify with the `ping` tool.

## Configuration

Every option is an environment variable or a command line flag; flags win.

| Env var                       | Flag                                          | Default                                      | Meaning                                                                                                             |
| ----------------------------- | --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `TASKER_URL`                  | `--url`                                       | unset                                        | Phone URL, e.g. `http://192.168.1.50:1821`. Unset means auto `adb forward` to `localhost`.                          |
| `TASKER_TOKEN`                | `--token`                                     | unset                                        | Bearer token.                                                                                                       |
| `TASKER_TOKEN_FILE`           | `--token-file`                                | unset                                        | File holding the token. Order: `--token`, `--token-file`, `TASKER_TOKEN`, `TASKER_TOKEN_FILE`.                      |
| `TASKER_ADB_SERIAL`           | `--serial`                                    | unset                                        | adb device serial when more than one is attached.                                                                   |
| `TASKER_ADB`                  | `--adb`                                       | `adb`                                        | adb executable.                                                                                                     |
| `TASKER_MCP_HOME`             | `--home`                                      | `~/.tasker-mcp`                              | State directory (snapshots, docs cache).                                                                            |
| `TASKER_TIMEOUT_MS`           | `--timeout-ms`                                | `30000`                                      | Per-request timeout in milliseconds.                                                                                |
| `TASKER_WRITE_ALLOW`          | `--write-allow`                               | unset (everything)                           | Comma separated name prefixes. Mutating tools only touch objects whose name starts with one.                        |
| `TASKER_WRITE_ALLOW_PROJECTS` | `--write-allow-projects`                      | unset                                        | Comma separated project name prefixes. Those projects, and every task, profile and scene in them, are writable too. |
| `TASKER_ALLOW_CONFIG_IMPORT`  | `--allow-config-import`, `--no-config-import` | `true`, or `false` when an allow list is set | Allow whole-configuration imports (see below).                                                                      |
| `TASKER_AUTO_PERSIST`         | `--auto-persist`, `--no-auto-persist`         | `false`                                      | Run `persist_config` after every change (needs adb; about 25 s per change). See Limitations.                        |

Also `--help` and `--version`.

### Safe mode for a real phone

Start a real phone like this until you trust your agent:

```bash
TASKER_WRITE_ALLOW=TaskerMCP.Test,TaskerMCP.
```

Writes are then confined to objects named `TaskerMCP.Test...` or `TaskerMCP....`
(tasks, profiles, projects, scenes, globals), and whole-configuration imports
are off. Reads, runs, and snapshots are unaffected. Set
`TASKER_ALLOW_CONFIG_IMPORT=true` to allow deletes, renames, and profile edits
inside the allowed prefixes. Also pull a Tasker Data Backup before the first
write.

To open up whole projects instead of (or as well as) name prefixes:

```bash
TASKER_WRITE_ALLOW_PROJECTS=MCP.
```

Every project whose name starts with `MCP.` is then writable, along with the
tasks, profiles and scenes in it, whatever they are called. An existing object
is judged by the project it is in now, so one cannot be pulled in from another
project. Editing a task in place needs nothing more. Creating one in such a
project, moving, renaming and deleting are whole-configuration imports (a new
task always lands in `Base` first), so they also need
`TASKER_ALLOW_CONFIG_IMPORT=true`.

`persist_config` and `TASKER_AUTO_PERSIST` work in safe mode: they save
Tasker's own running configuration, which holds nothing the allow lists did
not let through. They drive the phone over adb, so with `TASKER_URL` set also
give `TASKER_ADB_SERIAL`.

## Tools

Tools that change your Tasker configuration or phone state are marked **yes**.

### Raw XML

| Tool              | What it does                                                    | Mutates |
| ----------------- | --------------------------------------------------------------- | ------- |
| `get_backup_xml`  | The full Data Backup XML.                                       | no      |
| `get_task_xml`    | One task as TaskerData XML.                                     | no      |
| `get_profile_xml` | One profile as XML.                                             | no      |
| `get_project_xml` | One project as XML.                                             | no      |
| `get_scene_xml`   | One scene as XML.                                               | no      |
| `import_xml`      | Import a Task XML (replaced in place by name) or a full config. | yes     |

### Structured read and edit

| Tool              | What it does                                                        | Mutates |
| ----------------- | ------------------------------------------------------------------- | ------- |
| `list_projects`   | Projects and their contents.                                        | no      |
| `list_profiles`   | Profiles with their contexts and tasks.                             | no      |
| `list_tasks`      | Tasks, optionally by project.                                       | no      |
| `list_scenes`     | Scenes.                                                             | no      |
| `get_task`        | A task as JSON: actions with named, decoded args.                   | no      |
| `get_profile`     | A profile as JSON.                                                  | no      |
| `get_project`     | A project as JSON.                                                  | no      |
| `create_task`     | Create a task from a JSON action list.                              | yes     |
| `edit_task`       | Change the actions of a task.                                       | yes     |
| `delete_task`     | Delete a task (whole-configuration import).                         | yes     |
| `create_profile`  | Create a profile (whole-configuration import).                      | yes     |
| `edit_profile`    | Edit a profile (whole-configuration import).                        | yes     |
| `delete_profile`  | Delete a profile (whole-configuration import).                      | yes     |
| `move_to_project` | Move a task or profile into a project (whole-configuration import). | yes     |
| `rename`          | Rename a task, profile, or project (whole-configuration import).    | yes     |

### Run

| Tool          | What it does                                                                                                                                           | Mutates |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `run_task`    | Run a task with `par1`, `par2`, variables; returns the result, duration, and optional debug output.                                                    | yes     |
| `run_actions` | Run an ad-hoc action list. Uses one reusable task, `TaskerMCP.Scratch`, replaced in place, because deleting a task needs a whole-configuration import. | yes     |
| `stop_task`   | Stop a running task.                                                                                                                                   | yes     |

### Variables, profiles, commands

| Tool                  | What it does                       | Mutates |
| --------------------- | ---------------------------------- | ------- |
| `get_global`          | Read a global variable.            | no      |
| `set_global`          | Set a global variable.             | yes     |
| `list_globals`        | All global variables.              | no      |
| `set_profile_enabled` | Turn a profile on or off.          | yes     |
| `send_command`        | Send a Tasker Command System text. | yes     |

### Action specs and docs

| Tool                     | What it does                                                | Mutates |
| ------------------------ | ----------------------------------------------------------- | ------- |
| `get_action_spec`        | An action by code or name: args with ids, names, and types. | no      |
| `search_actions`         | Search the action table.                                    | no      |
| `list_action_categories` | Action categories.                                          | no      |
| `search_docs`            | Search the Tasker userguide.                                | no      |
| `list_docs`              | List userguide pages.                                       | no      |
| `get_doc`                | One userguide page, or one section of a long manual.        | no      |
| `refresh_docs`           | Re-download the docs index; drops cached pages if changed.  | no      |

### Logs

| Tool          | What it does                                                                                | Mutates |
| ------------- | ------------------------------------------------------------------------------------------- | ------- |
| `get_logcat`  | Tasker lines from logcat (needs adb and Tasker's "Debug To System Log"); redacts the token. | no      |
| `get_run_log` | Explains that Tasker has no action that exports the Run Log, and points at `get_logcat`.    | no      |

### Snapshots

| Tool               | What it does                                     | Mutates |
| ------------------ | ------------------------------------------------ | ------- |
| `list_snapshots`   | Saved snapshots, newest first.                   | no      |
| `snapshot_now`     | Save a snapshot of the current configuration.    | no      |
| `restore_snapshot` | Restore a snapshot (whole-configuration import). | yes     |

### Saving to disk

| Tool             | What it does                                                                                                                                                                                                                                           | Mutates |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `persist_config` | Save Tasker's running configuration to disk so changes survive a Tasker restart or reboot. Drives Tasker's editor over adb (Data > Restore of the live backup, then the Apply checkmark to save); needs an unlocked screen and takes about 25 seconds. | yes     |

Every mutating tool's result carries `persisted` (and a `persistHint` when it
is `false`). See Limitations for why.

### Per-task tools and connection

Any task whose comment (its description in Tasker) contains `#mcp` becomes a tool
named `tasker_<name>`, with the rest of the comment as its description and the
task's Task Variables as arguments (the convention from dceluis/tasker-mcp).
Calling it runs the task, so it mutates whatever the task does.
`refresh_tools` re-reads the configuration and tells the client when the set
changed. `ping` checks the connection.

To make a task a tool:

1. Put `#mcp` and a one-line description in the task's comment.
2. Add Task Variables for the arguments (Immutable on, Configure on Import
   off); the Prompt becomes the argument description, and "(required)" in the
   Prompt makes it required. Type Number becomes a number argument, On/Off a
   boolean.
3. Make the first action a JavaScriptlet labelled `MCP#parse_args`, with the
   condition `%par1 Is Set` and this code:

   ```js
   const args = JSON.parse(local("par1"));
   for (const name in args) {
     setLocal(name, args[name]);
   }
   exit();
   ```

   Tasker does not let Perform Task overwrite Immutable Task Variables, so the
   arguments arrive as JSON in `%par1` and this action copies them into the
   task's variables (the dceluis/tasker-mcp convention; tasks built for that
   project work unchanged).

## Safety net

- **Snapshot before every mutation.** Each write first fetches a full backup and
  saves it under `~/.tasker-mcp/snapshots`, keeping the newest 20. Undo with
  `restore_snapshot`.
- **Verify-readback.** After an import the server re-fetches the configuration
  and checks that the change landed, and reports a mismatch instead of assuming
  success.
- **Validation.** Edits are checked against the action table (arg ids and
  types) before anything is sent.
- **Unknown action codes are allowed** as raw XML, so a new Tasker action is not
  blocked by an out-of-date table.
- **Write policy.** See safe mode above.

## How it works

The phone runs a Tasker project with one HTTP Request profile and a JavaScript
dispatcher. This server talks to it over HTTP and does all XML parsing, editing,
and validation on the desktop. The design and the reasoning behind each decision
are in [docs/architecture.md](docs/architecture.md). The route table and the
Tasker behaviour verified on a device are in [tasker/README.md](tasker/README.md). How the
library was checked against Tasker's own editor, in both directions, is in
[docs/conformance.md](docs/conformance.md).

## Limitations

- **Changes are not saved to disk until persisted.** Tasker keeps two copies
  of its configuration: the running one, which every tasker-mcp change edits,
  and the editor's copy, which is the only one Tasker ever writes to disk. So
  a change made through tasker-mcp works at once but is **lost when Tasker
  restarts** (force-stop, update, reboot). Worse, if you open Tasker's editor
  and save anything before persisting, the editor's stale copy overwrites the
  changes. After a batch of changes, call `persist_config` (or start the server
  with `TASKER_AUTO_PERSIST=true`, which does it after every change). It needs
  adb (with `TASKER_URL` set, also `TASKER_ADB_SERIAL`) and an unlocked
  screen; on a phone without adb, do it by hand: **Tasker >
  menu > Data > Restore > User Local Backup > tasker-mcp-live > OK, then tap the
  checkmark in the toolbar (or press Back)**. (Global variables and a profile's on/off state are saved by Tasker
  itself, but that save does not include other unsaved changes, so
  `set_profile_enabled` still reports `persisted: false`.)
- Imported new tasks always land in the default `Base` project. Use
  `move_to_project` afterwards.
- Tasker's Import Data only takes tasks or a whole configuration. Profile,
  project, rename, and delete edits therefore replace the whole configuration,
  which restarts Tasker's monitor for about 3 seconds. The server waits for the
  phone to answer again.
- The Run Log cannot be exported by any Tasker action. Use `get_logcat`.
- Scenes are read-only.
- Trial builds of Tasker work as the full app while the trial lasts; behaviour
  after it expires is Tasker's, not this project's.

## Docs search

The Tasker userguide is scraped weekly by a GitHub Action into the orphan
`docs-data` branch of this repo and downloaded to `~/.tasker-mcp/docs` on first
use of a docs tool. The text is (c) joaoapps and is never committed to `main`
or shipped in the npm package.

Manuals that the site loads section by section with JavaScript, such as the
Scenes V2 (Screen Builder) Manual, are stored one section per page:
`get_doc {"slug": "scenes_v2"}` returns an index of the sections, and each
section has its own slug (`scenes_v2__05_general`) that `search_docs` returns
and `get_doc` reads.

The cache is not refreshed on its own. Call `refresh_docs` to pick up a newer
scrape; pages already downloaded are dropped when the published guide changed
and are downloaded again when next read.

## Development

```bash
npm ci
git config core.hooksPath .githooks   # gitleaks pre-push hook
npm run build
npm test                    # unit and XML fixture tests (what CI runs)
npm run test:coverage       # with v8 coverage
npm run coverage:ratchet    # fail if coverage dropped more than 0.5 points
npm run test:device         # live tests against an emulator or phone, never in CI
npm run lint                # eslint plus the ASCII dash check
npm run format
npm run typecheck
```

`scripts/device/` holds the emulator drivers (`import-project.mjs`,
`add-actions.mjs`, `ui.mjs`); they default `ANDROID_SERIAL` to the emulator. See
[CONTRIBUTING.md](CONTRIBUTING.md).
`setup-emulator.mjs <Tasker.apk>` rebuilds an emulator target in one go; start the
emulator with `-no-snapshot`, or a restart rolls back to an old snapshot and
loses the Tasker install.

## Releasing

`publish.yml` runs on every push to `main` and publishes a patch release. The
version is computed from the registry (latest published patch + 1, never below
the `major.minor.0` floor in `package.json`) and is not committed back. The job
installs with `--ignore-scripts` and no dependency cache, and npm attaches
provenance.

Auth is npm trusted publishing (OIDC) only; no token is stored. npm is retiring
direct publishes from 2FA-bypass tokens: they will only be able to stage a
release that a human then approves with 2FA
([changelog](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)).
Trusted publishing can still publish directly, provided the trusted publisher
is allowed to run `npm publish`. The job always runs `npm publish`, so a
stage-only publisher fails the job instead of queueing a release for approval.

Until the repository variable `NPM_TRUSTED_PUBLISHING` is `true`, the job runs
`npm publish --dry-run` and skips the tag. One-time setup:

1. The package must exist before a trusted publisher can be attached. Publish
   the first version by hand: `npm login`, `npm ci`, `npm run build`,
   `npm publish --access public` (npm asks for 2FA once).
2. Attach the trusted publisher, allowing direct publishes (2FA once):

   ```bash
   npm trust github @pmaxhogan/tasker-mcp --repo pmaxhogan/tasker-mcp      --file publish.yml --allow-publish
   ```

   The same thing on npmjs.com: package Settings > Trusted publishing > GitHub
   Actions, owner `pmaxhogan`, repository `tasker-mcp`, workflow `publish.yml`,
   and tick the option that allows `npm publish`. New configurations are
   stage-only unless you do.

3. Arm the job: `gh variable set NPM_TRUSTED_PUBLISHING --body true`.
4. Run the workflow straight away (Actions > Publish > Run workflow). A new
   trusted publisher expires unless it completes a publish within 2 days.
5. Optional hardening once that works: package Settings > Publishing access >
   "Require two-factor authentication and disallow tokens". Trusted publishing
   keeps working.

## Credits

- [Tasker](https://tasker.joaoapps.com) by joaoapps. Action names, labels, and
  help text are extracted from the Tasker app for interoperability.
- [MapTasker](https://github.com/mctinker/Map-Tasker) (MIT): the action table.
- [Tasker-XML-Info](https://github.com/Taskomater/Tasker-XML-Info) (MIT): action
  codes.
- [dceluis/tasker-mcp](https://github.com/dceluis/tasker-mcp) (MIT): the
  per-task `#mcp` tool convention.

Licenses and notices for the bundled data are in `data/NOTICE`.

## License

MIT, see [LICENSE](LICENSE).
