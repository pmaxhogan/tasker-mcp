# Contributing

## Setup

```bash
git clone https://github.com/pmaxhogan/tasker-mcp.git
cd tasker-mcp
npm ci
git config core.hooksPath .githooks   # gitleaks pre-push hook (needs gitleaks installed)
npm run build
npm test
```

Node 26 or newer. Before opening a PR run `npm run lint`, `npm run typecheck`,
`npm run format:check`, and `npm run test:coverage` followed by
`npm run coverage:ratchet`. See [CLAUDE.md](CLAUDE.md) for the code style rules
(ESM with `.ts` import extensions, no `console.*` in `src/`, Prettier, LF line
endings, and no em or en dashes anywhere: use an ASCII `-`).

## Commits

Conventional Commits: `type(scope): summary`, lower case, imperative, no
trailing period. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`,
`build`, `ci`, `perf`. The body explains why.

## Never hand-author an action arg layout

Tasker's action XML is irregular and easy to get subtly wrong. Do not write an
action's arg layout from memory. Build the action in the Tasker GUI, export it,
and copy the XML. The spec table in `data/` tells you arg ids, names, and types
but is generated: do not edit it by hand (regenerate with
`scripts/apk-extract.mjs`).

To harvest ground truth from the emulator:

1. Start the emulator with Tasker installed and open a new task in Tasker's task
   edit screen.
2. Run `node scripts/device/add-actions.mjs "Read File" "Write File"`. It adds
   each named action with default arguments through the action picker.
3. Save the task, run a Data Backup, and copy the exported `<Action>` elements
   into a sanitized fixture under `test/fixtures/`. No tokens, IPs, or personal
   strings: this repo is public.

## Device tests

Device tests run against an emulator (or a phone you do not mind), never in CI.

```bash
node scripts/device/import-project.mjs tasker/TaskerMCP.prj.xml --replace
npm run test:device
```

The scripts in `scripts/device/` default `ANDROID_SERIAL` to `emulator-5554` so a
forgotten serial never lands on a real phone. Run `TaskerMCP.Setup` on the
emulator once; it writes the token to `/sdcard/Download/tasker-mcp-token.txt`.

## Regenerating the phone project

`tasker/TaskerMCP.prj.xml` is generated. Edit `tasker/js/*.js` or
`scripts/build-phone-project.ts`, then:

```bash
node scripts/build-phone-project.ts
```

Commit both. A unit test fails when the committed XML is stale.
