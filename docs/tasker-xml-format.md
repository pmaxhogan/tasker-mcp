# Tasker XML format notes

Observed facts about Tasker's export/backup XML, collected from the fixtures in
`test/fixtures/` (real exports from Tasker 5.9.2 through 6.6.17-rc), the
Taskomater/Tasker-XML-Info docs, and GUI exports from the emulator. When this
file and a fresh GUI export disagree, the GUI export wins: update this file.

## General

- LF line endings, tab indentation, no `<?xml?>` declaration, trailing newline.
- Root: `<TaskerData sr="" dvi="1" tv="6.4.15">`. `tv` is the Tasker version
  and is not semver (`6.6.17-rc`, `6.7.6-beta`). Treat it as opaque.
- Root children in a project export: `dmetric?` (only with scenes), `Profile*`,
  `Project`, `Scene*`, `Task*`.
- **Positional `sr` indices are sorted lexicographically in the file**:
  `act0, act1, act10, act11, act2, ...` and `arg0, arg1, arg10, arg2, ...`.
  The logical order of actions in a task is the numeric suffix of `sr`, not
  document order. Preserve document order on round trip; sort numerically when
  presenting.

## Child order

Tasker writes an element's children as: plain tags (no `sr`) in alphabetical
order, then children that carry an `sr` attribute, sorted as strings by `sr`.
Rebuilding whole tasks from the rho and ktools fixtures with this rule
reproduces them byte for byte.

## Action

`<Action sr="act0" ve="7">`. Children: `code`, then optional `coll`, `label`,
`on`, `se` (alphabetical), then the args, then `ConditionList sr="if"`.

- Disabled action: `<on>false</on>` (absence means enabled).
- Label: `<label>text</label>` (may be multi-line).
- `<se>false</se>` means "Continue Task After Error" is ON; when `<se>` is
  absent the task stops on error (MapTasker `taskedit.py`,
  `action_continues_after_error`).
- `<coll>false</coll>`: collapsed in the editor; only on If (37) / For (39).
- Block actions: If 37, Else 43, Else If is 43 with a ConditionList, End If 38,
  For 39, End For 40. Else/End If usually have no args.

### Arg elements (position is `sr="argN"`)

| Tag      | Shape                                                                                                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Str`    | `<Str sr="arg0" ve="3">text</Str>`, empty `<Str sr="arg5" ve="3"/>`. Literal newlines allowed.                                                                                                       |
| `Int`    | `<Int sr="arg1" val="1821"/>` or variable form `<Int sr="arg0"><var>%level</var></Int>`. No `ve`.                                                                                                    |
| `Bundle` | `<Bundle sr="arg0"><Vals sr="val">...</Vals></Bundle>`. Vals holds `<KEY>value</KEY>` plus `<KEY-type>java.lang.String</KEY-type>`. Keys contain dots. `RELEVANT_VARIABLES` embeds escaped XML text. |
| `App`    | `<App sr="arg0"><appClass/><appPkg/><label/></App>`, or empty `<App sr="arg1"/>`.                                                                                                                    |
| `Img`    | `<Img sr="arg1" ve="2"><nme>icon</nme></Img>`, `<Img ...><var>%png</var></Img>`, or empty.                                                                                                           |

Booleans are `Int` with `val="0"`/`"1"`.

### ConditionList

```xml
<ConditionList sr="if">
	<bool0>And</bool0>
	<Condition sr="c0" ve="3">
		<lhs>%td_button</lhs>
		<op>12</op>
		<rhs></rhs>
	</Condition>
	<Condition sr="c1" ve="3">
		<lhs>%td_button</lhs>
		<op>0</op>
		<rhs>COPY</rhs>
	</Condition>
</ConditionList>
```

`boolN` joiners (`And`/`Or`) appear only with 2+ conditions. `rhs` may be
`<rhs></rhs>` or `<rhs/>`. `op` is an integer code; see `src/model/ops.ts`.

## Task

`<Task sr="task396">` children: `cdate`, `edate`, `id`, `nme`, `pc`, `pri`,
`rty`, `stayawake`, then `Action*` (`sr="actN"`), `Img` (`sr="icn"`), and
`ProfileVariable*` (`sr="pvN"`), per the child-order rule.

- `<pc>` is the task comment/description.
- Profile enabled/disabled: a disabled object carries `<limit>true</limit>`
  (MapTasker `objprops.py`). `<flags>` bits: 1 hide in notification, 2
  collapsed, 4 delete after disable, 8 ignore settings restore, 16 ignore task
  order, 32 run exit task on startup.
- `<rty>` collision handling: 0/absent abort new, 1 abort existing, 2 run both.
- Anonymous tasks (scene event handlers, profile-only tasks) have no `nme`.
- Task Variables are `<ProfileVariable sr="pvN">` children with, in order,
  `clearout, exportval, immutable, pvci, pvd, pvdn, pvid, pvit, pvn, pvt,
strout` (`pvv` optional). `pvit` is `t` on tasks and `pj` on projects; `pvn`
  is the variable name, `pvd` the prompt/description, `pvt` the type (`t`
  text, `n` number, `onoff`, `cn`, `f`, `ln`, `ti`).

## Profile

`<Profile sr="prof425" ve="2">` children: `cdate, edate, clp, cldm, flags, id,
limit, mid0, mid1, nme, pri`, then contexts, optional `Share`.

- `mid0` entry task id, `mid1` exit task id.
- Contexts `sr="con0".."conN"`:
  - `<Event sr="con0" ve="2"><code>2089</code><pri>0</pri>...args</Event>`
    (2089 = HTTP Request, 599 = Intent Received).
  - `<State sr="con0" ve="2"><code>120</code><Int sr="arg0" val="1"/></State>`
    with an optional `<pin>` (inverted).
  - `<Time sr="con0"><fh>7</fh><fm>45</fm><th>7</th><tm>45</tm></Time>`; repeat
    form adds `<rep>` and `<repval>`. No code.
  - Day, App, Loc: shapes not yet in fixtures.

## Project

`<Project sr="proj0" ve="2">` children: `cdate`, `name` (not `nme`), `pids`
(csv profile ids), `tids` (csv task ids), `scenes` (csv scene names),
`ProfileVariable*`, `Share`. Empty lists are omitted. Projects in 6.x backups
also carry an `<id>` UUID.

## Scene

`<Scene sr="sceneName">` children: `cdate, edate, heightLand, heightPort, nme,
widthLand, widthPort`, then element nodes (`RectElement`, `ButtonElement`,
`TextElement`, ...) and `PropertiesElement`. Event tasks are referenced by id
(`<clickTask>52</clickTask>`), usually anonymous tasks.

## HTTP server pieces (from the dceluis project, Tasker 6.4.15)

HTTP Request event, code 2089: `arg0` Bundle (relevant variables), `arg1` Int
port, `arg2` Str method, `arg3` Str path, `arg4` Str quick response, `arg5` Int
timeout seconds, `arg6` Int, `arg7` Str. Variables set: `%http_request_body`,
`%http_request_files()`, `%http_request_headers()`,
`%http_request_ip_address_v4`, `%http_request_method`, `%http_request_path`,
`%http_request_port`, `%http_request_id`, multipart arrays.

HTTP Response action, code 380: `arg0` Bundle, `arg1` Str request id
(`%http_request_id`), `arg2` Str status code, `arg3` Str, `arg4` Int, `arg5` Str
body, `arg6` Str, `arg7` Str, `arg8` Int, `arg9` Str. Confirm the remaining arg
meanings from a GUI export (see `test/fixtures/emulator/`).
