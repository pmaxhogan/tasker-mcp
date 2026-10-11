# GUI conformance: the Tasker task editor vs the structured model

This wave checked that what an agent sees through the MCP tools (`get_task`
JSON) is what a person sees in Tasker's task editor, in both directions:

- **A, GUI -> XML**: tasks built by hand in the task editor, then read with
  `get_task`.
- **B, XML -> GUI**: tasks written with `create_task` (structured JSON, action
  and arg names), then opened in the task editor.

Run on 2026-10-04 against Tasker 6.6.20 (trial) on the Pixel_8 AVD emulator
(Android 17), TaskerMCP phone project imported, server driven in-process over
an MCP `InMemoryTransport` like `test/device/core.test.ts`.

The verified GUI ground truth for direction A is committed:
`test/fixtures/emulator/conformance-gui.xml` (the seven `Conf.A*` tasks exactly
as `get_task_xml` returned them) and `test/conformance.test.ts`, which parses
that file and asserts every fact below, so CI keeps it.

## Method

The task editor was driven with `scripts/device/ui.mjs` (uiautomator). New
actions were inserted at a position with long-press > More options > Insert
Action (it inserts before the selected row); If / For were added with the
"If, Else, End If" / "For, End For" templates the editor offers on save.

Reading the editor:

- **Task Edit list** (one uiautomator dump per task): each row has
  `actionnum_text` ("3."), `actionname_text`, and `argN_label` / `argN_text`
  pairs for the arg summary; If / Else If rows carry `condition_text`.
- **Indentation**: the row number sits at x = 84 + 67 * depth (px, 1080 wide
  screen).
- **Disabled**: the row is greyed with a bar on its left, which moves the row
  number 17 px right (x = 101 at depth 0). uiautomator has no other signal.
- **Label**: an `action_label` TextView above the row.
- **Collapsed block**: the If row stays, every row up to and including its
  End If is hidden; the row numbers jump (2. then 7.).
- **Action Edit** (opened per action where the row does not show it):
  checkbox states, text fields, spinner text, Continue Task After Error.

Each dump was compared with `get_task` by a script: action name, order, depth,
enabled, label, condition text (rendered from `lhs`/`op`/`rhs`/`joins` with the
`symbol` column of `src/model/ops.ts`), and every arg the row shows, matched by
the arg's spec name. Editor-only facts were compared by hand.

## Tasks

### Direction A (built in the GUI)

| Task    | Covers                                                                                                                                                                                                                                                                             |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conf.A1 | For (`%item` in `1,2,3`) containing If `%item eq 2` / Else / End If with a Flash in each branch (one with Long ticked), then Wait 1 s 3 ms inside the For. Nested depth 0-1-2.                                                                                                     |
| Conf.A2 | If `%aaa ~ foo*` And `%bbb Set` Or `%ccc < 5` (Matches, Is Set, Maths Less Than); Else with a condition (Else If `%ddd neq x`); Variable Set in each branch; Return.                                                                                                               |
| Conf.A3 | Labels ("start here" on Variable Set, "pause" on Wait), a disabled Flash, Read File of a missing file with Continue Task After Error, Wait 2 s.                                                                                                                                    |
| Conf.A4 | Variable Set, Variable Split (Delete Base ticked), Array Push (position 1), Variable Search Replace (store matches in `%hits`, Replace Matches, replace with `bar`), Return `%csv(#)/%text`. Run: `4/bar and bar`.                                                                 |
| Conf.A5 | Perform Task `Conf.A4` with Parameter 1, Parameter 2 and Return Value Variable `%ret`; Show Scene `ConfScene` displayed as Dialog with Continue Task After Error; Flash with Tasker Layout and a Title; Return `%ret`. Run: `4/bar and bar`.                                       |
| Conf.A6 | If `%xxx !Set` Xor (High Precedence) `%yyy ~R ^a.*`, containing Wait 2 min and Beep (duration 900), folded in the editor before saving.                                                                                                                                            |
| Conf.A7 | If `%num = 4` And (High Precedence) `%num Even` Or (High Precedence) `%num > 10`, Else, Variable Set with Do Maths / with Append; folded and unfolded before saving. Run with `num` 4 / 12 / 6: `8` / `24` / `small` (the very first run with 4 returned `small`; not reproduced). |

### Direction B (written with create_task)

| Task    | Covers                                                                                                                                                                                                                              |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conf.B1 | For / If `%item eq b` with `collapsed: true` / Flash (`Long: true`) / Else / Flash / End If / Wait 1 s 250 ms / End For.                                                                                                            |
| Conf.B2 | If with three conditions (`~`, `Set`, `<`) and joins `["or", "and"]`; action name `"Else If"` with a condition; Return.                                                                                                             |
| Conf.B3 | Labelled Variable Set; Flash with `enabled: false` and a label; Read File with `continueOnError: true`; labelled Wait.                                                                                                              |
| Conf.B4 | Variable Split (`Delete Base: true`), Array Push, Variable Search Replace (store matches, Replace Matches, Replace With), Return.                                                                                                   |
| Conf.B5 | Perform Task `Conf.B4` with both parameters and a return variable; Show Scene (`Display As: 3`) with continueOnError; Flash with Tasker Layout and Title; Return.                                                                   |
| Conf.B6 | Array Push given only as raw `<Action>` XML copied from `test/fixtures/emulator/gt-actions.xml`; collapsed If with joins `["xor2", "and2"]` (`!Set`, `~R`, `=`); If with `["or2"]` (`Even`, `>`) holding a disabled, labelled Beep. |
| Conf.B7 | Defaults check after the fixes: Variable Set and Perform Task with no Priority / Structure Output given, Show Scene with no options. Run: `4/ins/dog and dog/p1`.                                                                   |

## Results

### Direction A: GUI -> get_task

| Task    | Rows | Names / order / depth | Enabled / label | Condition text | Row args | Editor-only facts                                                                          | Result |
| ------- | ---- | --------------------- | --------------- | -------------- | -------- | ------------------------------------------------------------------------------------------ | ------ |
| Conf.A1 | 8    | pass                  | pass            | pass           | pass     | Long 1 / 0, Wait MS 3 Seconds 1                                                            | pass   |
| Conf.A2 | 6    | pass after fix 2      | pass            | pass           | pass     | -                                                                                          | pass   |
| Conf.A3 | 4    | pass                  | pass            | -              | pass     | continueOnError on Read File only                                                          | pass   |
| Conf.A4 | 6    | pass                  | pass            | -              | pass     | Delete Base, Store Matches, Replace Matches                                                | pass   |
| Conf.A5 | 4    | pass                  | pass            | -              | pass     | Priority `%priority`, Parameter 2, return var, Display As 3 = Dialog, Tasker Layout, Title | pass   |
| Conf.A6 | 4    | pass                  | pass            | pass           | pass     | `collapsed: true`                                                                          | pass   |
| Conf.A7 | 6    | pass                  | pass            | pass           | pass     | `collapsed: false` after unfold, Do Maths, Append                                          | pass   |

Every arg label on a row matched the spec table's arg name exactly
(`Variable Array`, `To Var`, `Parameter 1 (%par1)`, `Replace With`, ...), and
every operator symbol in `src/model/ops.ts` that was used (`eq`, `neq`, `~`,
`~R`, `<`, `>`, `=`, `Even`, `Set`, `!Set`) is what the editor prints. The
editor's operator picker lists the 14 operators in exactly the code order of
`ops.ts` (Equals = 0 ... Isn't Set = 13).

### Direction B: create_task -> task editor

| Task    | Created                | Rows (GUI)                     | Names / order / depth | Enabled / label | Condition text | Row args | Editor-only facts                                                    | Result              |
| ------- | ---------------------- | ------------------------------ | --------------------- | --------------- | -------------- | -------- | -------------------------------------------------------------------- | ------------------- |
| Conf.B1 | ok                     | 4 folded, 8 unfolded           | pass                  | pass            | pass           | pass     | If shown folded; Flash Long ticked; Wait 250 ms / 1 s                | pass                |
| Conf.B2 | failed, ok after fix 2 | 6                              | pass (Else If)        | pass            | pass           | pass     | -                                                                    | pass                |
| Conf.B3 | ok                     | 5                              | pass                  | pass            | -              | pass     | Flash disabled + label; Read File Continue Task After Error ticked   | pass                |
| Conf.B4 | ok                     | 6                              | pass                  | pass            | -              | pass     | -                                                                    | pass                |
| Conf.B5 | ok                     | 4                              | pass                  | pass            | -              | pass     | Display As "Dialog", Continue Task After Error, Tasker Layout, Title | pass, but see fix 4 |
| Conf.B6 | failed, ok after fix 1 | 5 folded, 7 unfolded           | pass                  | pass            | pass           | pass     | raw Array Push shows `%gtvar` / 5 / `%gtvar`                         | pass                |
| Conf.B7 | ok                     | not opened (see parked item 2) | -                     | -               | -              | -        | verified through `get_task_xml` and a run                            | pass (XML, run)     |

`run_task Conf.B5` returned no value although its Perform Task names a
return variable; `run_task Conf.A5` (same shape, built in the GUI) returned
`4/bar and bar`. That led to fix 4. `Conf.B7`, created after the fix, returns
`4/ins/dog and dog/p1`.

## Mismatches and fixes

1. **High-precedence condition joins were rejected on the way in** (library
   bug). The editor offers And / Or / Xor and a "High Precedence" variant of
   each; the variants export as `<boolN>And2</boolN>`, `Or2`, `Xor2` and show
   as `&+`, `|+`, `X|+`. `get_task` reported them as `and2` / `or2` / `xor2`,
   but `create_task` and `edit_task` only accepted `and`, `or`, `xor`, so any
   GUI task using one could not be edited from its own `get_task` output.
   Fixed in `src/tools/mutate.ts` (`joinByName`: accepts the six names plus
   the editor's symbols and labels). Tests: `test/tools/structured.test.ts`
   ("accepts high-precedence joins and Else If"), `test/conformance.test.ts`.
   On the device, `edit_task Conf.A6` with its own `get_task` actions now
   verifies, and `Conf.B6` shows `X|+`, `&+`, `|+`.
2. **Else with a condition** (naming mismatch, fixed). The editor names a
   code 43 with a ConditionList "Else If"; `get_task` called it "Else", and
   `create_task` refused `"action": "Else If"` (unknown action). Now
   `actionToJson` names it "Else If" (`src/model/convert.ts`), the spec index
   resolves "Else If" to 43 (`src/spec/table.ts`), and `create_task` refuses
   "Else If" without a condition (`src/tools/mutate.ts`). Tests as in 1.
3. **Structure Output default** (library bug). The spec table marks the
   "Structure Output (JSON, etc)" checkbox with spec `bosta`, which
   `boolDefault` read as off, so `create_task` wrote 0 where the editor
   defaults it on (Variable Set arg6, For arg2, Read File arg2, Perform Task
   arg10; also in `gt-actions.xml`). Fixed in `boolDefault`
   (`src/model/convert.ts`) and in `isDefaultArg` (`src/edit/verify.ts`).
   Tests: `test/model/convert.test.ts`, `test/edit/edit.test.ts`,
   `test/tools/structured.test.ts` ("fills the defaults the Tasker editor
   uses").
4. **Perform Task Priority default** (library bug with a runtime effect). The
   editor fills Priority with the variable `%priority` (the caller's
   priority); `create_task` wrote `0` from the spec range `0:50`. With
   priority 0 the called task runs below the caller, which does not wait for
   it, so the return variable stays empty (`Conf.B5`). Fixed with a small
   table of editor defaults that differ from the spec (`guiDefault` in
   `src/model/convert.ts`, used by `fillDefaults` in `src/tools/mutate.ts`).
5. **Show Scene defaults** (library bug, same table). The editor ticks
   Blocking Overlay + (arg9) and Overlay + (arg10); the spec says `false`.
6. **Variable names under 3 characters** (validation gap, now a warning). The
   editor refuses `%xx` ("bad variable name: must start with % and be 3 or
   more alphanumeric characters or _, not starting/ending in _").
   `create_task` accepted `Variable Set %xy`, Tasker imported it, and at run
   time `%xy` was not a variable (Return `%xy` returned nothing).
   `validateTask` now warns on a plain `%name` in a variable-name arg (spec
   `uvar...`) that breaks the rule (`src/spec/validate.ts`, tests in
   `test/spec/validate.test.ts`).
7. **`<coll>` polarity in the docs** (doc error, code was right).
   `docs/tasker-xml-format.md` said `<coll>false</coll>` means collapsed. The
   GUI writes `<coll>true</coll>` for a folded block and `<coll>false</coll>`
   after unfolding it again; absent on a block never folded.
   `actionToJson` already used `collapsed = coll === "true"`, and
   `create_task` with `collapsed: true` shows folded in the editor (B1, B6).
   Doc fixed.

Test expectation issues (not library bugs): the editor prints a pick-list arg
by its text (Show Scene "Display As" 3 = "Dialog"; the stored value is the
index), booleans on the row as "On", and Wait as one summary ("1 Second, 3
MS", "1 Minute", "2 Mins") instead of labelled args. The comparison maps
these; `test/conformance.test.ts` has the mapping.

## Not verifiable here

- **Plugin actions**: no plugin app is installed on the emulator, so plugin
  actions (code >= 1000, Bundle args) could not be built or displayed.
- **Plain Xor's row text and XML**: not exported in this wave (Xor High
  Precedence was).
- **Arg values cut off at the screen edge**: long rows (Perform Task) end in
  a label with no value; those were read in Action Edit instead.

## Parked

1. **An open task editor holds a stale configuration and Apply writes it
   back.** While the Tasker GUI stays open, tasks imported through the HTTP
   server do not appear in it, and tapping Apply (after any GUI edit) saves
   the GUI's copy over them. Observed: after the first Apply in this wave a
   leftover device-test task `TaskerMCP.Test.McpTool` was gone and a
   previously deleted `MCPTest.Loop` was back. Not a library bug, but users
   editing in the GUI while an agent writes will lose work. Repro: open
   Tasker on the TASKS tab, `create_task` a new task, check it is not listed,
   edit any task in the GUI and Apply, then `list_tasks`.
2. **Server writes after a force-stop of Tasker did not persist.** To make
   the GUI reload, Tasker was force-stopped and relaunched. Tasks imported
   before that survived it (Conf.B1..B6, ids 90-95). After it, every new
   import came back with id 2 and was gone after the next force-stop
   (Conf.B7 twice), and the 15 cleanup `delete_task` config imports were all
   undone by the next force-stop too, although `list_tasks` showed them
   applied. A GUI delete followed by Apply did persist. Undiagnosed; looks
   like Tasker state after a force-stop and relaunch (the relaunch first
   showed an Android "Placeholder notifications" settings screen), not the
   payloads (the import carries id 96+). Repro:
   `adb -s emulator-5554 shell am force-stop net.dinglisch.android.taskerm`,
   relaunch Tasker, `create_task` a new task (note `taskId`), wait, force-stop
   again, `list_tasks`.

## Cleanup

All Conf.\* tasks were deleted with `delete_task`; because of parked item 2
that did not stick, so they were deleted again in the GUI and applied, which
survived a further force-stop. Final task list: GT.Imported, MCP.T1,
TaskerMCP.Scratch and the TaskerMCP project. `MCPTest.Loop`, resurrected by
parked item 1, was deleted too; `TaskerMCP.Test.McpTool` (lost to parked
item 1) is recreated by `test/device/extra.test.ts` on its next run.
