#!/usr/bin/env node
/**
 * Generates tasker/TaskerMCP.prj.xml, the phone-side Tasker project, from the
 * JavaScript in tasker/js/ and action layouts copied from GUI exports
 * (test/fixtures/emulator/gt-actions.xml and the dceluis project for the HTTP
 * Request event). Every arg layout below mirrors one of those exports; do not
 * add an action here without first building it in the Tasker GUI and copying
 * its exported XML.
 *
 *   node scripts/build-phone-project.ts [--out tasker/TaskerMCP.prj.xml]
 *
 * Runs on Node 26 type stripping; no build step.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ActionJson, ArgJson, ConditionJson } from "../src/model/types.ts";
import { formatElement, taskFromJson } from "../src/model/convert.ts";
import { createElement, parseFragment, serializeElement, textNode } from "../src/xml/index.ts";
import type { XmlElement } from "../src/xml/index.ts";

export const PROJECT_NAME = "TaskerMCP";
export const PROFILE_NAME = "TaskerMCP HTTP";
export const PORT = 1821;
/** Bump when the phone project changes in a way the server must know about. */
export const PHONE_PROJECT_VERSION = "1";
const TV = "6.6.20";
const BACKUP_PATH = "/sdcard/Tasker/tasker-mcp/backup.xml";

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const js = (name: string) => readFileSync(root(`tasker/js/${name}`), "utf8").trimEnd();

// No spec lookup: every arg is written explicitly, nothing is defaulted.
const lookup = () => undefined;

const str = (id: number, value = ""): ArgJson => ({ id, kind: "Str", value });
const int = (id: number, value: number | string = 0): ArgJson => ({ id, kind: "Int", value });
const raw = (id: number, tag: string, xml: string): ArgJson => ({ id, kind: "Raw", tag, raw: xml });

const RELEVANT_NONE = `<Bundle sr="arg0">
	<Vals sr="val">
		<net.dinglisch.android.tasker.RELEVANT_VARIABLES>&lt;StringArray sr=""/&gt;</net.dinglisch.android.tasker.RELEVANT_VARIABLES>
		<net.dinglisch.android.tasker.RELEVANT_VARIABLES-type>[Ljava.lang.String;</net.dinglisch.android.tasker.RELEVANT_VARIABLES-type>
	</Vals>
</Bundle>`;

const RELEVANT_UUID = `<Bundle sr="arg0">
	<Vals sr="val">
		<net.dinglisch.android.tasker.RELEVANT_VARIABLES>&lt;StringArray sr=""&gt;&lt;_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES0&gt;%uuid
UUID
&lt;/_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES0&gt;&lt;/StringArray&gt;</net.dinglisch.android.tasker.RELEVANT_VARIABLES>
		<net.dinglisch.android.tasker.RELEVANT_VARIABLES-type>[Ljava.lang.String;</net.dinglisch.android.tasker.RELEVANT_VARIABLES-type>
	</Vals>
</Bundle>`;

const cond = (lhs: string, op: number, rhs = ""): ConditionJson => ({ lhs, op, rhs });

// Condition operator codes (src/model/ops.ts): 0 eq, 1 neq.
const EQ = 0;
const NEQ = 1;
const SET = 12;
const NOT_SET = 13;

/** Action builders. Arg ids and kinds copied from GUI exports. */
const A = {
  javascriptlet: (code: string): ActionJson => ({
    code: 129,
    args: [str(0, code), str(1), int(2, 1), int(3, 45)],
  }),
  ifRoute: (route: string): ActionJson => ({
    code: 37,
    condition: { conditions: [cond("%route", EQ, route)] },
    args: [],
  }),
  endIf: (): ActionJson => ({ code: 38, args: [] }),
  dataBackup: (path: string): ActionJson => ({
    code: 322,
    continueOnError: true,
    args: [str(0, path), str(1), int(2, 0)],
  }),
  /** Test Tasker: type 3 globals, 5 profiles, 6 scenes, 7 tasks, 11 projects. */
  testTasker: (type: number, into: string): ActionJson => ({
    code: 347,
    continueOnError: true,
    args: [int(0, type), str(1), str(2, into)],
  }),
  /** Import Data: type 0 task, 1 configuration; source 0 variable. */
  importData: (type: 0 | 1, fromVar: string): ActionJson => ({
    code: 153,
    continueOnError: true,
    args: [int(0, type), int(1, 0), str(2, fromVar)],
  }),
  performTask: (o: {
    name: string;
    conditions?: ConditionJson[];
    par1?: string;
    par2?: string;
    returnVar?: string;
    passthrough?: boolean;
    passthroughList?: string;
  }): ActionJson => ({
    code: 130,
    continueOnError: true,
    ...(o.conditions
      ? {
          condition: {
            conditions: o.conditions,
            ...(o.conditions.length > 1 ? { joins: o.conditions.slice(1).map(() => "And") } : {}),
          },
        }
      : {}),
    args: [
      str(0, o.name),
      int(1, "%priority+1"),
      str(2, o.par1 ?? ""),
      str(3, o.par2 ?? ""),
      str(4, o.returnVar ?? ""),
      int(5, 0),
      int(6, o.passthrough ? 1 : 0),
      str(7, o.passthroughList ?? ""),
      int(8, o.returnVar ? 1 : 0),
      // Allow Overwrite Variables: passed values must win over the called
      // task's own (empty) Task Variables, which per-task MCP tools rely on.
      int(9, 1),
      int(10, 1),
    ],
  }),
  stopTask: (task: string): ActionJson => ({
    code: 137,
    continueOnError: true,
    args: [int(0, 0), str(1, task)],
  }),
  stop: (): ActionJson => ({ code: 137, args: [int(0, 0), str(1)] }),
  command: (cmd: string): ActionJson => ({ code: 385, continueOnError: true, args: [str(0, cmd)] }),
  httpResponse: (): ActionJson => ({
    code: 380,
    continueOnError: true,
    args: [
      raw(0, "Bundle", RELEVANT_NONE),
      str(1, "%http_request_id"),
      str(2, "%status"),
      str(3),
      int(4, 0),
      str(5, "%body"),
      str(6, "%ctype"),
      str(7),
      int(8, 0),
      str(9),
    ],
  }),
  wait: (seconds: number): ActionJson => ({
    code: 30,
    args: [int(0, 0), int(1, seconds), int(2, 0), int(3, 0), int(4, 0)],
  }),
  generateUuid: (): ActionJson => ({
    code: 365,
    args: [raw(0, "Bundle", RELEVANT_UUID), str(1, "GenerateUUID()")],
  }),
  variableSet: (name: string, value: string): ActionJson => ({
    code: 547,
    args: [str(0, name), str(1, value), int(2, 0), int(3, 0), int(4, 0), int(5, 3), int(6, 1)],
  }),
  flash: (text: string, condition?: ConditionJson): ActionJson => ({
    code: 548,
    ...(condition ? { condition: { conditions: [condition] } } : {}),
    args: [
      str(0, text),
      int(1, 1),
      int(2, 0),
      str(3),
      str(4),
      str(5),
      str(6),
      str(7),
      str(8),
      int(9, 1),
      str(10),
      int(11, 1),
      int(12, 0),
      str(13),
      int(14, 0),
      str(15),
    ],
  }),
  returnValue: (value: string): ActionJson => ({
    code: 126,
    args: [str(0, value), int(1, 1), int(2, 0), int(3, 0), str(4)],
  }),
};

function block(route: string, ...body: ActionJson[]): ActionJson[] {
  return [A.ifRoute(route), ...body, A.endIf()];
}

export const TASK_IDS = { dispatch: 9001, setup: 9002, debug: 9003 } as const;
const PROFILE_ID = 9010;

function dispatchActions(): ActionJson[] {
  return [
    A.javascriptlet(js("dispatch.js")),
    ...block("backup", A.dataBackup(BACKUP_PATH)),
    ...block(
      "list",
      A.testTasker(7, "%mcp_tasks"),
      A.testTasker(5, "%mcp_profiles"),
      A.testTasker(11, "%mcp_projects"),
      A.testTasker(6, "%mcp_scenes"),
      A.testTasker(3, "%mcp_globals"),
    ),
    ...block("varlist", A.testTasker(3, "%mcp_globals")),
    ...block("import", A.importData(0, "%http_request_body")),
    ...block(
      "run",
      A.testTasker(7, "%mcp_tasks"),
      // An empty local is "unset" in Tasker and a reference to it stays
      // literal, so each par1/par2 set/unset combination gets its own
      // Perform Task. "Limit Passthrough To" is taken literally (variables in
      // it are not expanded, observed on 6.6.20), so every dispatcher local
      // is passed through.
      ...[true, false].flatMap((p1) =>
        [true, false].map((p2) =>
          A.performTask({
            name: "%arg_task",
            conditions: [
              cond("%arg_par1", p1 ? SET : NOT_SET),
              cond("%arg_par2", p2 ? SET : NOT_SET),
            ],
            ...(p1 ? { par1: "%arg_par1" } : {}),
            ...(p2 ? { par2: "%arg_par2" } : {}),
            returnVar: "%mcp_result",
            passthrough: true,
          }),
        ),
      ),
    ),
    ...block("stop", A.stopTask("%arg_task")),
    ...block("command", A.command("%arg_value")),
    ...block(
      "rotate",
      A.performTask({ name: "TaskerMCP.Setup", par1: "quiet", returnVar: "%mcp_newtoken" }),
    ),
    ...block(
      "config",
      A.javascriptlet(
        'status = "202"; ctype = "application/json"; body = JSON.stringify({ ok: true, restarting: true });',
      ),
      A.httpResponse(),
      A.wait(1),
      A.importData(1, "%http_request_body"),
      A.stop(),
    ),
    A.javascriptlet(js("finish.js")),
    A.httpResponse(),
  ];
}

function setupActions(): ActionJson[] {
  return [
    A.generateUuid(),
    A.variableSet("%mcp_uuid1", "%uuid"),
    A.generateUuid(),
    A.variableSet("%mcp_uuid2", "%uuid"),
    A.javascriptlet(js("setup.js")),
    A.flash("TaskerMCP token: %TaskerMCP_Token", cond("%par1", NEQ, "quiet")),
    A.returnValue("%TaskerMCP_Token"),
  ];
}

const NOW = 1791158400000;

function task(
  id: number,
  name: string,
  comment: string,
  actions: ActionJson[],
  collision?: number,
): XmlElement {
  return taskFromJson(
    {
      name,
      comment,
      priority: 100,
      ...(collision === undefined ? {} : { collision }),
      actions: actions.map((a, i) => ({ ...a, index: i })),
    },
    lookup,
    { id, cdate: NOW, edate: NOW, now: () => NOW, fillDefaults: false },
  );
}

function leaf(name: string, text: string): XmlElement {
  return createElement(name, {}, [textNode(text)]);
}

/** HTTP Request event (code 2089), layout from the dceluis export (6.4.15). */
function profile(): XmlElement {
  const ev = parseFragment(`<Event sr="con0" ve="2">
	<code>2089</code>
	<pri>0</pri>
	<Bundle sr="arg0">
		<Vals sr="val">
			<net.dinglisch.android.tasker.RELEVANT_VARIABLES>&lt;StringArray sr=""/&gt;</net.dinglisch.android.tasker.RELEVANT_VARIABLES>
			<net.dinglisch.android.tasker.RELEVANT_VARIABLES-type>[Ljava.lang.String;</net.dinglisch.android.tasker.RELEVANT_VARIABLES-type>
		</Vals>
	</Bundle>
	<Int sr="arg1" val="${PORT}"/>
	<Str sr="arg2" ve="3"/>
	<Str sr="arg3" ve="3"/>
	<Str sr="arg4" ve="3"/>
	<Int sr="arg5" val="60"/>
	<Int sr="arg6" val="0"/>
	<Str sr="arg7" ve="3"/>
</Event>`);
  const el = createElement("Profile", { sr: `prof${PROFILE_ID}`, ve: "2" }, [
    leaf("cdate", String(NOW)),
    leaf("edate", String(NOW)),
    leaf("flags", "8"),
    leaf("id", String(PROFILE_ID)),
    leaf("mid0", String(TASK_IDS.dispatch)),
    leaf("nme", PROFILE_NAME),
    leaf("pri", "50"),
    ev,
  ]);
  return formatElement(el, 1);
}

function project(): XmlElement {
  const el = createElement("Project", { sr: "proj0", ve: "2" }, [
    leaf("cdate", String(NOW)),
    leaf("name", PROJECT_NAME),
    leaf("pids", String(PROFILE_ID)),
    leaf("tids", [TASK_IDS.dispatch, TASK_IDS.setup, TASK_IDS.debug].join(",")),
  ]);
  return formatElement(el, 1);
}

export function buildPhoneProject(): string {
  const tasks = [
    task(
      TASK_IDS.dispatch,
      "TaskerMCP.Dispatch",
      "Handles every tasker-mcp HTTP request: auth, routing, response.",
      dispatchActions(),
      2,
    ),
    task(
      TASK_IDS.setup,
      "TaskerMCP.Setup",
      "Generates a new bearer token into %TaskerMCP_Token and shows it.",
      setupActions(),
    ),
    task(
      TASK_IDS.debug,
      "TaskerMCP.Debug",
      "Perform Task with %par1 = message to add it to run_task's debug output.",
      [A.javascriptlet(js("debug.js"))],
    ),
  ];
  const parts = [profile(), project(), ...tasks].map((e) => `\t${serializeElement(e)}\n`);
  return `<TaskerData sr="" dvi="1" tv="${TV}">\n${parts.join("")}</TaskerData>\n`;
}

const argv = process.argv.slice(2);
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const outIdx = argv.indexOf("--out");
  const out = outIdx >= 0 ? argv[outIdx + 1]! : root("tasker/TaskerMCP.prj.xml");
  writeFileSync(out, buildPhoneProject());
  process.stdout.write(`wrote ${out}\n`);
}
