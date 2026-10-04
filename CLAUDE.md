# tasker-mcp

TypeScript MCP server (stdio) that gives AI agents read, edit, and run access
to Tasker on Android. The phone side is a Tasker project
(`tasker/TaskerMCP.prj.xml`) that serves an authenticated HTTP API on port
1821; this package talks to it and does all XML work on the desktop.

## Commands

```bash
npm install
git config core.hooksPath .githooks   # once per clone: gitleaks pre-push hook
npm run build              # tsc -> dist/
npm test                   # vitest unit + XML fixture tests (what CI runs)
npm run test:coverage      # plus v8 coverage into coverage/
npm run coverage:ratchet   # fail if coverage dropped more than 0.5 points
npm run coverage:ratchet:write  # accept a new baseline (only when it went up)
npm run test:device        # live tests against an emulator/phone (never in CI)
npm run lint               # eslint plus scripts/check-ascii.mjs
npm run format             # prettier --write
npm run typecheck
```

## Layout

- `src/` - the server. `xml/` lossless TaskerData parse/serialize, `spec/`
  action-spec table and validation, `edit/` replace-by-name planning, `client/`
  HTTP client for the phone project, `tools/` one file per MCP tool group,
  `docs/` userguide fetch/cache/search.
- `data/` - generated action-spec JSON (MapTasker + Tasker APK). Do not hand
  edit; regenerate with `scripts/apk-extract.mjs`. See `data/NOTICE`.
- `tasker/` - the phone-side Tasker project and its route documentation.
- `scripts/` - repo tooling; `scripts/device/` drives the emulator.
- `test/` - unit tests; `test/fixtures/` sanitized Tasker XML; `test/device/`
  live device tests.

## Dependency pins

- **TypeScript stays on 6.0.x.** typescript-eslint 8.x peers `<6.1.0`. See the
  `//typescript` note in `package.json`; Dependabot ignores the TS major.

## Commit messages

**Conventional Commits, always**: `type(scope): summary`.

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`,
  `perf`. Scope is the area touched (`xml`, `spec`, `tools`, `phone`, `docs`,
  `ci`, ...) and optional for global changes.
- Summary is lower case, imperative, no trailing period.
- The body explains WHY, not what the diff shows. Wrap at 72 columns.

## Style rules

- **TypeScript, ESM only.** Relative imports carry a `.ts` extension
  (`rewriteRelativeImportExtensions` rewrites them on build).
- **Never `console.*` in `src/`.** stdout is the MCP protocol channel; a stray
  log line corrupts it. Write diagnostics to stderr via `src/log.ts`. ESLint
  enforces the ban.
- **No em dashes or en dashes anywhere.** Use an ASCII `-`. `npm run lint`
  fails on them.
- **Prettier**: semicolons, double quotes, 2-space indent, 100 columns.
- **LF line endings everywhere** (`.gitattributes`).
- **Never hand-author a Tasker action's arg layout from memory.** Build it in
  the Tasker GUI, export, and copy the XML; the spec table in `data/` gives
  arg ids, names, and types.

## Device safety

- Device scripts default `ANDROID_SERIAL` to the emulator. A forgotten `-s`
  must never land on a real phone.
- On a real phone, writes are confined to the `TaskerMCP` server project and a
  `TaskerMCP.Test` project. Pull a Data Backup before the first write.

## This repo is public

Never commit secrets: no bearer tokens, IPs, or personal strings in fixtures or
sample XML. gitleaks runs pre-push and in CI.
