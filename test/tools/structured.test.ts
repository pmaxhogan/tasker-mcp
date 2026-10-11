import { afterEach, describe, expect, it } from "vitest";
import { TaskerDoc } from "../../src/model/document.ts";
import { register as registerStructured } from "../../src/tools/structured.ts";
import { register as registerRaw } from "../../src/tools/raw.ts";
import { register as registerRun } from "../../src/tools/run.ts";
import { child, childText, children } from "../../src/xml/index.ts";
import {
  connectTools,
  createFakeContext,
  SCENE_BACKUP,
  type FakeContext,
  type FakeContextOptions,
  type ToolHarness,
} from "./fake-context.ts";

let fc: FakeContext | undefined;
let t: ToolHarness | undefined;

async function setup(opts: FakeContextOptions = {}): Promise<{ fc: FakeContext; t: ToolHarness }> {
  fc = await createFakeContext(opts);
  t = await connectTools(fc.ctx, [registerStructured, registerRaw, registerRun]);
  return { fc, t };
}

afterEach(async () => {
  await t?.close();
  await fc?.cleanup();
  t = undefined;
  fc = undefined;
});

const LOOP_ACTIONS = [
  { action: "Variable Set", args: { Name: "%n", To: "%par1" } },
  {
    action: "If",
    condition: { conditions: [{ lhs: "%n", op: "eq", rhs: "go" }] },
  },
  { action: "Return", args: { Value: "went %n" } },
  { action: "End If" },
  { action: "Return", args: { Value: "stayed" } },
];

describe("list and get tools", () => {
  it("lists projects, tasks, profiles and scenes", async () => {
    const { t } = await setup();
    const p = await t.call("list_projects");
    expect(p.isError).toBe(false);
    expect(p.json.projects.map((x: { name: string }) => x.name)).toEqual(["Base", "TaskerMCP"]);

    const tasks = await t.call("list_tasks");
    expect(tasks.json.tasks).toContainEqual({ id: 45, name: "MCP.T1", project: "Base" });
    const base = await t.call("list_tasks", { project: "TaskerMCP" });
    expect(base.json.tasks.every((x: { project: string }) => x.project === "TaskerMCP")).toBe(true);
    const missing = await t.call("list_tasks", { project: "Nope" });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('No project named "Nope"');

    const profiles = await t.call("list_profiles");
    expect(profiles.json.profiles[0]).toMatchObject({
      name: "TaskerMCP HTTP",
      enabled: true,
      entryTask: "TaskerMCP.Dispatch",
    });
    const none = await t.call("list_profiles", { project: "Base" });
    expect(none.json.profiles).toEqual([]);
    expect((await t.call("list_scenes")).json).toEqual({ scenes: [] });
  });

  it("reads a task with resolved names", async () => {
    const { t } = await setup();
    const r = await t.call("get_task", { name: "MCP.T1" });
    expect(r.isError).toBe(false);
    expect(r.json).toMatchObject({ id: 45, name: "MCP.T1", project: "Base", priority: 100 });
    expect(r.json.actions[0]).toMatchObject({ code: 130, name: "Perform Task" });
    expect(r.json.actions[0].args[0]).toMatchObject({ id: 0, name: "Name", kind: "Str" });
    const byId = await t.call("get_task", { id: 45 });
    expect(byId.json.name).toBe("MCP.T1");
    expect((await t.call("get_task", { id: 9999 })).text).toContain("No task with id 9999");
    expect((await t.call("get_task", {})).text).toContain("Give a task name or id");
    const near = await t.call("get_task", { name: "mcp.t" });
    expect(near.isError).toBe(true);
    expect(near.text).toContain("did you mean: MCP.T1");
    const far = await t.call("get_task", { name: "zzzz" });
    expect(far.text).toContain("list_tasks lists them");
  });

  it("reads profiles and projects", async () => {
    const { t } = await setup();
    const p = await t.call("get_profile", { name: "TaskerMCP HTTP" });
    expect(p.json).toMatchObject({
      name: "TaskerMCP HTTP",
      project: "TaskerMCP",
      entryTask: "TaskerMCP.Dispatch",
      enabled: true,
    });
    expect(p.json.contexts[0]).toMatchObject({ kind: "Event", code: 2089, name: "HTTP Request" });
    expect((await t.call("get_profile", { name: "x" })).text).toContain("list_profiles");
    const proj = await t.call("get_project", { name: "TaskerMCP" });
    expect(proj.json).toMatchObject({
      name: "TaskerMCP",
      profiles: ["TaskerMCP HTTP"],
    });
    expect(proj.json.tasks).toContain("TaskerMCP.Dispatch");
  });
});

describe("create_task", () => {
  it("creates a task from action names, verifies it, and it runs", async () => {
    const { fc, t } = await setup();
    const r = await t.call("create_task", { name: "MCPTest.Loop", actions: LOOP_ACTIONS });
    expect(r.isError, r.text).toBe(false);
    expect(r.json).toMatchObject({
      ok: true,
      task: "MCPTest.Loop",
      isNew: true,
      verified: true,
      project: "Base",
    });
    expect(r.json.changed[0]).toContain("created task");
    expect(r.json.snapshot).toMatch(/^\d{8}T/);
    expect(fc.phone.routes()).toEqual(["/backup", "/backup", "/import", "/backup"]);
    expect(fc.toolsChangedCount()).toBe(1);

    const got = await t.call("get_task", { name: "MCPTest.Loop" });
    expect(got.json.actions.map((a: { code: number }) => a.code)).toEqual([547, 37, 126, 38, 126]);
    expect(got.json.actions[1].condition.conditions[0]).toMatchObject({ op: 0, opName: "eq" });
    expect(got.json.actions[2].depth).toBe(1);

    expect((await t.call("run_task", { name: "MCPTest.Loop", par1: "go" })).json).toMatchObject({
      ok: true,
      return: "went go",
    });
    expect((await t.call("run_task", { name: "MCPTest.Loop", par1: "no" })).json.return).toBe(
      "stayed",
    );
  });

  it("refuses an existing name", async () => {
    const { t } = await setup();
    const r = await t.call("create_task", { name: "MCP.T1", actions: [] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("already exists; use edit_task");
  });

  it("reports validation errors and unknown codes", async () => {
    const { fc, t } = await setup();
    const bad = await t.call("create_task", {
      name: "X",
      actions: [{ action: "End If" }, { code: 39 }],
    });
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain("failed validation");
    expect(bad.text).toContain("End If without an open If");
    expect(bad.text).toContain("never closed");
    expect(fc.phone.routes()).not.toContain("/import");

    const unknown = await t.call("create_task", { name: "X", actions: [{ code: 3 }] });
    expect(unknown.text).toContain("Unknown action code 3; use get_action_spec or pass raw XML");
    const plugin = await t.call("create_task", { name: "X", actions: [{ code: 123456789 }] });
    expect(plugin.text).toContain("plugin action");
    const name = await t.call("create_task", { name: "X", actions: [{ action: "Flsh" }] });
    expect(name.text).toContain("did you mean");
    const nothing = await t.call("create_task", { name: "X", actions: [{}] });
    expect(nothing.text).toContain("give a code, an action name, or raw XML");
    const skip = await t.call("create_task", {
      name: "X",
      actions: [{ action: "End If" }],
      validate: false,
    });
    expect(skip.isError).toBe(false);
  });

  it("accepts raw XML for unknown codes and keeps it", async () => {
    const { t } = await setup();
    const raw = `<Action sr="act0" ve="7"><code>3</code><Str sr="arg0" ve="3">x</Str></Action>`;
    const r = await t.call("create_task", { name: "Raw", actions: [{ raw }] });
    expect(r.isError, r.text).toBe(false);
    expect(r.json.warnings.join(" ")).toContain("Unknown action code 3");
    const got = await t.call("get_task", { name: "Raw" });
    expect(got.json.actions[0].raw).toContain("<code>3</code>");
    expect(got.json.warnings[0]).toContain("unknown action code 3");
    const bad = await t.call("create_task", { name: "Raw2", actions: [{ raw: "<Task/>" }] });
    expect(bad.text).toContain("must be an <Action> element");
    const broken = await t.call("create_task", { name: "Raw2", actions: [{ raw: "<Action" }] });
    expect(broken.text).toContain("invalid raw XML");
    const mismatch = await t.call("create_task", { name: "Raw2", actions: [{ raw, code: 5 }] });
    expect(mismatch.text).toContain("does not match");
  });

  it("coerces args by spec type and accepts several key forms", async () => {
    const { t } = await setup();
    const r = await t.call("create_task", {
      name: "Coerce",
      priority: 7,
      collision: 2,
      comment: "hello",
      actions: [
        {
          action: "Variable Set",
          args: { arg0: "%x", "1": 5, "Do Maths": "true", Max: "4", 2: false },
          label: "lbl",
          enabled: false,
          continueOnError: true,
        },
        { code: 548, args: { Text: true, Long: 1 } },
        { action: "Flash", args: { 0: { kind: "Str", value: "explicit" } } },
        { action: "Perform Task", args: { Name: "MCP.T1", Priority: "%prio", "Parameter 1": "a" } },
      ],
    });
    expect(r.isError, r.text).toBe(false);
    expect(r.json.verified).toBe(true);
    const got = (await t.call("get_task", { name: "Coerce" })).json;
    expect(got).toMatchObject({ priority: 7, collision: 2, comment: "hello" });
    const vs = got.actions[0];
    expect(vs).toMatchObject({ label: "lbl", enabled: false, continueOnError: true });
    expect(vs.args.find((a: { id: number }) => a.id === 1)).toMatchObject({
      kind: "Str",
      value: "5",
    });
    expect(vs.args.find((a: { id: number }) => a.id === 3)).toMatchObject({
      kind: "Int",
      value: 1,
    });
    expect(vs.args.find((a: { id: number }) => a.id === 5)).toMatchObject({
      kind: "Int",
      value: 4,
    });
    expect(got.actions[1].args[0]).toMatchObject({ kind: "Str", value: "true" });
    expect(got.actions[2].args[0]).toMatchObject({ value: "explicit" });
    expect(got.actions[3].args.find((a: { id: number }) => a.id === 1)).toMatchObject({
      value: "%prio",
    });
  });

  it("rejects bad args and operators", async () => {
    const { t } = await setup();
    const cases: Array<[unknown, string]> = [
      [{ action: "Flash", args: { Nope: "x" } }, 'has no arg "Nope"'],
      [{ action: "Variable Set", args: { "Max Rounding Digits": true } }, "needs an integer"],
      [{ action: "Variable Set", args: { "Do Maths": "maybe" } }, "needs true or false"],
      [{ action: "Flash", args: { Text: { a: 1 } } }, "needs a string"],
      [{ action: "Flash", args: { Text: { kind: "Int" } } }, "not a valid {kind, value}"],
      [{ action: "Kill App", args: { App: "x" } }, "is a App arg and needs raw XML"],
      [
        { action: "If", condition: { conditions: [{ lhs: "%a", op: "approx" }] } },
        "unknown operator",
      ],
      [
        {
          action: "If",
          condition: {
            conditions: [
              { lhs: "a", op: 0 },
              { lhs: "b", op: 0 },
            ],
            joins: ["nand"],
          },
        },
        "must be and, or, or xor",
      ],
      [{ code: 3, args: { Text: "x" } }, "Unknown action code 3"],
      [{ action: "Flash", args: [{ kind: "Str", value: "x" }] }, "needs an id"],
      [{ action: "Flash", args: [{ id: 0 }] }, "needs a kind"],
    ];
    for (const [action, msg] of cases) {
      const r = await t.call("create_task", { name: "Bad", actions: [action] });
      expect(r.isError, JSON.stringify(action)).toBe(true);
      expect(r.text, JSON.stringify(action)).toContain(msg);
    }
  });

  it("accepts the ArgJson array get_task returns and Bool/Raw kinds", async () => {
    const { t } = await setup();
    const src = (await t.call("get_task", { name: "MCP.T1" })).json;
    const r = await t.call("create_task", {
      name: "Copy",
      actions: [
        ...src.actions,
        {
          action: "Variable Set",
          args: [
            { id: 0, kind: "Str", value: "%a" },
            { id: 1, kind: "Str", value: "1" },
            { id: 3, kind: "Bool", value: "yes" },
          ],
        },
      ],
    });
    expect(r.isError, r.text).toBe(false);
    expect(r.json.verified).toBe(true);
  });

  // Found by the GUI conformance wave (docs/conformance.md).
  it("accepts high-precedence joins and Else If, as get_task reports them", async () => {
    const { fc, t } = await setup();
    const cond = (joins: string[]) => ({
      conditions: [
        { lhs: "%aaa", op: "Set" },
        { lhs: "%bbb", op: "~R", rhs: "^b" },
        { lhs: "%ccc", op: "=", rhs: "1" },
      ],
      joins,
    });
    const r = await t.call("create_task", {
      name: "Joins",
      actions: [
        { action: "If", condition: cond(["xor2", "And2"]) },
        { action: "Else If", condition: cond(["&+", "Or (High Precedence)"]) },
        { action: "Else" },
        { action: "End If" },
      ],
    });
    expect(r.isError, r.text).toBe(false);
    expect(r.json.verified).toBe(true);
    const acts = children(fc.phone.doc.taskByName("Joins")!, "Action");
    const bools = (i: number) =>
      [0, 1].map((b) => childText(child(acts[i]!, "ConditionList")!, `bool${b}`));
    expect(bools(0)).toEqual(["Xor2", "And2"]);
    expect(bools(1)).toEqual(["And2", "Or2"]);
    const got = (await t.call("get_task", { name: "Joins" })).json;
    expect(got.actions.map((a: { name: string }) => a.name)).toEqual([
      "If",
      "Else If",
      "Else",
      "End If",
    ]);
    expect(got.actions[0].condition.joins).toEqual(["xor2", "and2"]);
    // The get_task output goes straight back in.
    const again = await t.call("edit_task", { name: "Joins", patch: { actions: got.actions } });
    expect(again.isError, again.text).toBe(false);
    expect(again.json.verified).toBe(true);

    const bad = await t.call("create_task", {
      name: "Bad",
      actions: [{ action: "If" }, { action: "Else If" }, { action: "End If" }],
    });
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain('"Else If" is an Else (43) with a condition');
  });

  it("fills the defaults the Tasker editor uses", async () => {
    const { t } = await setup();
    const r = await t.call("create_task", {
      name: "Defaults",
      actions: [
        { action: "Variable Set", args: { Name: "%aaa", To: "1" } },
        { action: "Perform Task", args: { Name: "MCP.T1" } },
        { action: "Show Scene", args: { Name: "Scene1" } },
      ],
    });
    expect(r.isError, r.text).toBe(false);
    const got = (await t.call("get_task", { name: "Defaults" })).json;
    const arg = (i: number, id: number) =>
      got.actions[i].args.find((a: { id: number }) => a.id === id);
    expect(arg(0, 6)).toMatchObject({ name: "Structure Output (JSON, etc)", value: 1 });
    expect(arg(1, 1)).toMatchObject({ name: "Priority", kind: "Int", value: "%priority" });
    expect(arg(1, 10)).toMatchObject({ value: 1 });
    expect(arg(2, 9)).toMatchObject({ name: "Blocking Overlay +", value: 1 });
    expect(arg(2, 10)).toMatchObject({ name: "Overlay +", value: 1 });
  });

  it("moves a new task to its project with one config import", async () => {
    const { fc, t } = await setup();
    const r = await t.call("create_task", {
      name: "Moved",
      project: "Tools",
      actions: [{ action: "Flash", args: { Text: "x" } }],
    });
    expect(r.isError, r.text).toBe(false);
    expect(r.json.project).toBe("Tools");
    expect(fc.phone.routes().filter((x) => x === "/config")).toHaveLength(1);
    expect(fc.phone.doc.summary().tasks.find((x) => x.name === "Moved")?.project).toBe("Tools");
  });

  it("reports targetProject when config imports are disabled", async () => {
    const { fc, t } = await setup({ policy: { allowConfigImport: false } });
    const r = await t.call("create_task", {
      name: "Stay",
      project: "Tools",
      actions: [{ action: "Flash", args: { Text: "x" } }],
    });
    expect(r.isError, r.text).toBe(false);
    expect(r.json).toMatchObject({ targetProject: "Tools", project: "Base" });
    expect(r.json.warnings.join(" ")).toContain("config import");
    expect(fc.phone.routes()).not.toContain("/config");
  });

  it("enforces the write allow list", async () => {
    const { fc, t } = await setup({
      policy: { allowPrefixes: ["MCPTest."], allowConfigImport: true },
    });
    const r = await t.call("create_task", { name: "Other", actions: [] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Write to task "Other" refused');
    const p = await t.call("create_task", { name: "MCPTest.A", project: "Elsewhere", actions: [] });
    expect(p.text).toContain('Write to project "Elsewhere" refused');
    expect(fc.phone.routes()).toEqual([]);
    const okr = await t.call("create_task", { name: "MCPTest.A", actions: [] });
    expect(okr.isError, okr.text).toBe(false);
  });

  it("deletes stale duplicates when the phone adds a copy", async () => {
    const { fc, t } = await setup();
    await t.call("create_task", {
      name: "Dup",
      actions: [{ action: "Flash", args: { Text: "1" } }],
    });
    fc.phone.importMode = "duplicate";
    const r = await t.call("edit_task", {
      name: "Dup",
      patch: { actions: [{ action: "Flash", args: { Text: "2" } }] },
    });
    expect(r.isError, r.text).toBe(false);
    expect(r.json.duplicatesRemoved).toHaveLength(1);
    expect(r.json.verified).toBe(true);
    const tasks = fc.phone.doc.tasks().filter((x) => TaskerDoc.nameOf(x) === "Dup");
    expect(tasks).toHaveLength(1);
    expect((await t.call("get_task", { name: "Dup" })).json.actions[0].args[0].value).toBe("2");
  });

  it("warns about duplicates it cannot delete without config import", async () => {
    const { fc, t } = await setup({ policy: { allowConfigImport: false } });
    await t.call("create_task", {
      name: "Dup",
      actions: [{ action: "Flash", args: { Text: "1" } }],
    });
    fc.phone.importMode = "duplicate";
    const r = await t.call("edit_task", {
      name: "Dup",
      patch: { set: { comment: "c" } },
    });
    expect(r.json.warnings.join(" ")).toContain("duplicate tasks");
  });

  it("fails when the task never shows up", async () => {
    const { fc, t } = await setup();
    fc.phone.importXml = async () => ({ ok: true });
    const r = await t.call("create_task", { name: "Ghost", actions: [] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("no task named");
  });

  it("flags a verify mismatch", async () => {
    const { fc, t } = await setup();
    const real = fc.phone.importXml.bind(fc.phone);
    fc.phone.importXml = async (xml: string) => real(xml.replace(">hi<", ">HI<"));
    const r = await t.call("create_task", {
      name: "Mismatch",
      actions: [{ action: "Flash", args: { Text: "hi" } }],
    });
    expect(r.json.verified).toBe(false);
    expect(r.json.warnings.join(" ")).toContain("verify: action 0: arg0");
  });
});

describe("edit_task", () => {
  it("splices, sets fields and reports what changed", async () => {
    const { t } = await setup();
    await t.call("create_task", { name: "E", actions: LOOP_ACTIONS });
    const r = await t.call("edit_task", {
      name: "E",
      patch: [
        {
          splice: {
            index: 0,
            deleteCount: 0,
            insert: [{ action: "Flash", args: { Text: "hey" } }],
          },
        },
        { set: { priority: 9, comment: "c" } },
      ],
    });
    expect(r.isError, r.text).toBe(false);
    expect(r.json).toMatchObject({ isNew: false, verified: true });
    expect(r.json.changed.join(" ")).toContain("action count");
    const got = (await t.call("get_task", { name: "E" })).json;
    expect(got.actions[0].code).toBe(548);
    expect(got).toMatchObject({ priority: 9, comment: "c" });

    const same = await t.call("edit_task", { name: "E", patch: { set: { comment: "c" } } });
    expect(same.json.changed).toEqual(["no changes"]);
    const bad = await t.call("edit_task", {
      name: "E",
      patch: { splice: { index: 99, deleteCount: 0 } },
    });
    expect(bad.text).toContain("out of range");
  });

  it("renames by import, deletes the old task and keeps project and profile refs", async () => {
    const { fc, t } = await setup();
    const r = await t.call("edit_task", {
      name: "TaskerMCP.Dispatch",
      patch: { set: { name: "TaskerMCP.Dispatch2" } },
      validate: false,
    });
    expect(r.isError, r.text).toBe(false);
    expect(r.json).toMatchObject({ renamedFrom: "TaskerMCP.Dispatch", project: "TaskerMCP" });
    expect(r.json.changed[0]).toContain("renamed");
    const s = fc.phone.doc.summary();
    expect(s.tasks.some((x) => x.name === "TaskerMCP.Dispatch")).toBe(false);
    expect(s.profiles[0]?.entryTask).toBe("TaskerMCP.Dispatch2");
    expect(s.projects.find((p) => p.name === "TaskerMCP")?.tasks[0]).toBe("TaskerMCP.Dispatch2");
    expect(s.projects.find((p) => p.name === "Base")?.tasks).toEqual(["MCP.T1"]);
  });

  it("renames correctly when the phone keeps the payload's (old) id", async () => {
    const { fc, t } = await setup({ importMode: "sameId" });
    const r = await t.call("edit_task", {
      name: "TaskerMCP.Dispatch",
      patch: { set: { name: "TaskerMCP.Dispatch2" } },
      validate: false,
    });
    expect(r.isError, r.text).toBe(false);
    expect(r.json).toMatchObject({ verified: true, taskId: 58, project: "TaskerMCP" });
    expect(r.json.duplicatesRemoved).toBeUndefined();
    const s = fc.phone.doc.summary();
    expect(s.tasks.filter((x) => x.id === 58).map((x) => x.name)).toEqual(["TaskerMCP.Dispatch2"]);
    expect(s.profiles[0]?.entryTask).toBe("TaskerMCP.Dispatch2");
    expect(s.projects.find((p) => p.name === "TaskerMCP")?.tasks[0]).toBe("TaskerMCP.Dispatch2");
    expect(s.projects.find((p) => p.name === "Base")?.tasks).toEqual(["MCP.T1"]);
  });

  it("refuses a rename without config import, before writing", async () => {
    const { fc, t } = await setup({ policy: { allowConfigImport: false } });
    const r = await t.call("edit_task", { name: "MCP.T1", patch: { set: { name: "MCP.T2" } } });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("TASKER_ALLOW_CONFIG_IMPORT");
    expect(fc.phone.routes()).not.toContain("/import");
  });

  it("refuses a rename onto an existing name", async () => {
    const { t } = await setup();
    const r = await t.call("edit_task", {
      name: "MCP.T1",
      patch: { set: { name: "TaskerMCP.Setup" } },
    });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("already exists");
  });
});

describe("delete_task", () => {
  it("deletes a task and scrubs its project", async () => {
    const { fc, t } = await setup();
    const r = await t.call("delete_task", { name: "MCP.T1" });
    expect(r.isError, r.text).toBe(false);
    expect(r.json).toMatchObject({ ok: true, verified: true });
    expect(fc.phone.doc.taskByName("MCP.T1")).toBeUndefined();
    const base = fc.phone.doc.projectByName("Base")!;
    expect(childText(base, "tids")).toBeUndefined();
    expect(fc.toolsChangedCount()).toBe(1);
  });

  it("refuses a task a profile uses unless forced", async () => {
    const { fc, t } = await setup();
    const r = await t.call("delete_task", { name: "TaskerMCP.Dispatch" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("used by profile(s) TaskerMCP HTTP");
    expect(fc.phone.routes()).not.toContain("/config");
    const f = await t.call("delete_task", { name: "TaskerMCP.Dispatch", force: true });
    expect(f.json.warnings[0]).toContain("deleted task");
  });

  it("needs config import", async () => {
    const { t } = await setup({ policy: { allowConfigImport: false } });
    const r = await t.call("delete_task", { name: "MCP.T1" });
    expect(r.text).toContain("disabled");
  });
});

describe("profiles", () => {
  const TIME = `<Time sr="con0"><fh>7</fh><fm>0</fm><th>8</th><tm>0</tm></Time>`;

  it("creates, edits and deletes a profile", async () => {
    const { fc, t } = await setup();
    const c = await t.call("create_profile", {
      name: "Morning",
      contexts: [TIME, { event: "HTTP Request", args: { arg1: 1822, arg2: "GET" } }],
      entryTask: "MCP.T1",
      exitTask: 59,
      enabled: false,
    });
    expect(c.isError, c.text).toBe(false);
    expect(c.json).toMatchObject({ ok: true, project: "Base", verified: true });
    const got = (await t.call("get_profile", { name: "Morning" })).json;
    expect(got).toMatchObject({ enabled: false, entryTask: "MCP.T1", project: "Base" });
    expect(got.contexts.map((x: { kind: string }) => x.kind)).toEqual(["Time", "Event"]);
    expect(got.contexts[1]).toMatchObject({ code: 2089 });

    const dup = await t.call("create_profile", {
      name: "Morning",
      contexts: [TIME],
      entryTask: "MCP.T1",
    });
    expect(dup.text).toContain("already exists");

    const en = await t.call("edit_profile", { name: "Morning", set: { enabled: true } });
    expect(en.json).toMatchObject({ ok: true, verified: true });
    expect(fc.phone.routes()).toContain("/profile");

    const ed = await t.call("edit_profile", {
      name: "Morning",
      set: {
        name: "Morning2",
        enabled: false,
        entryTask: "TaskerMCP.Setup",
        exitTask: null,
        contexts: [{ state: 120, args: { arg0: 1 }, invert: true }],
      },
    });
    expect(ed.isError, ed.text).toBe(false);
    expect(ed.json.changed).toContain("exit task removed");
    const p2 = (await t.call("get_profile", { name: "Morning2" })).json;
    expect(p2).toMatchObject({ enabled: false, entryTask: "TaskerMCP.Setup" });
    expect(p2.exitTask).toBeUndefined();
    expect(p2.contexts[0]).toMatchObject({ kind: "State", code: 120 });
    expect(p2.contexts[0].raw).toContain("<pin>true</pin>");

    const ex = await t.call("edit_profile", {
      name: "Morning2",
      set: { exitTask: "MCP.T1", enabled: true },
    });
    expect(ex.isError, ex.text).toBe(false);

    const del = await t.call("delete_profile", { name: "Morning2" });
    expect(del.json).toMatchObject({ ok: true, verified: true });
    expect(fc.phone.doc.profileByName("Morning2")).toBeUndefined();
    expect(childText(fc.phone.doc.projectByName("Base")!, "pids")).toBeUndefined();
  });

  it("puts a profile in its entry task's project or the given one", async () => {
    const { t } = await setup();
    const a = await t.call("create_profile", {
      name: "P1",
      contexts: [{ event: 2089 }],
      entryTask: "TaskerMCP.Setup",
    });
    expect(a.json.project).toBe("TaskerMCP");
    const b = await t.call("create_profile", {
      name: "P2",
      contexts: [{ event: "2089" }],
      entryTask: "MCP.T1",
      project: "New",
    });
    expect(b.json.project).toBe("New");
  });

  it("rejects bad contexts and tasks", async () => {
    const { t } = await setup();
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ contexts: ["<Task/>"] }, "is not a profile context"],
      [{ contexts: ["<Time"] }, "invalid raw XML"],
      [{ contexts: [{ event: "No Such Event Here" }] }, "Unknown event"],
      [{ contexts: [{ event: "HTTP Requst" }] }, "did you mean: HTTP Request"],
      [{ contexts: [{ state: "zzzzqqq" }] }, "Unknown state"],
      [{ contexts: [{ event: 1, args: { bad: 1 } }] }, 'key args by id ("arg0")'],
      [{ contexts: [TIME], entryTask: "Nope" }, 'No task named "Nope"'],
      [{ contexts: [TIME], entryTask: 4242 }, "no task with id 4242"],
    ];
    for (const [over, msg] of cases) {
      const r = await t.call("create_profile", { name: "Bad", entryTask: "MCP.T1", ...over });
      expect(r.isError, msg).toBe(true);
      expect(r.text).toContain(msg);
    }
    expect((await t.call("edit_profile", { name: "TaskerMCP HTTP", set: {} })).text).toContain(
      "Nothing to change",
    );
    expect(
      (await t.call("edit_profile", { name: "TaskerMCP HTTP", set: { name: "TaskerMCP HTTP" } }))
        .isError,
    ).toBe(false);
  });

  it("refuses a rename onto an existing profile", async () => {
    const { t } = await setup();
    await t.call("create_profile", { name: "A", contexts: [TIME], entryTask: "MCP.T1" });
    const r = await t.call("edit_profile", { name: "A", set: { name: "TaskerMCP HTTP" } });
    expect(r.text).toContain("already exists");
  });
});

describe("move_to_project and rename", () => {
  it("moves a task, a profile and a scene, creating the project", async () => {
    const { fc, t } = await setup();
    const r = await t.call("move_to_project", { kind: "task", name: "MCP.T1", project: "Fresh" });
    expect(r.isError, r.text).toBe(false);
    expect(r.json).toMatchObject({ ok: true, projectCreated: true, verified: true });
    const p = await t.call("move_to_project", {
      kind: "profile",
      name: "TaskerMCP HTTP",
      project: "Fresh",
    });
    expect(p.json).toMatchObject({ ok: true, projectCreated: false });
    const proj = fc.phone.doc.summary().projects.find((x) => x.name === "Fresh");
    expect(proj).toMatchObject({ tasks: ["MCP.T1"], profiles: ["TaskerMCP HTTP"] });
    const scene = await t.call("move_to_project", {
      kind: "scene",
      name: "None",
      project: "Fresh",
    });
    expect(scene.text).toContain('No scene named "None"');
  });

  it("renames each kind in place", async () => {
    const { fc, t } = await setup({ xml: SCENE_BACKUP });
    const task = await t.call("rename", { kind: "task", from: "MCP.T1", to: "MCP.T9" });
    expect(task.isError, task.text).toBe(false);
    expect(fc.phone.doc.taskByName("MCP.T9")?.attrs).toBeDefined();
    expect(TaskerDoc.idOf(fc.phone.doc.taskByName("MCP.T9")!)).toBe(45);
    const callers = await t.call("rename", {
      kind: "task",
      from: "TaskerMCP.Debug",
      to: "TaskerMCP.Dbg",
    });
    expect(callers.json.warnings.join(" ")).toContain('task "MCP.T9" still calls');
    expect(
      (await t.call("rename", { kind: "profile", from: "TaskerMCP HTTP", to: "HTTP" })).json.ok,
    ).toBe(true);
    expect((await t.call("rename", { kind: "project", from: "Base", to: "Base2" })).json.ok).toBe(
      true,
    );
    const sc = await t.call("rename", { kind: "scene", from: "Pop", to: "Pop2" });
    expect(sc.json.ok, sc.text).toBe(true);
    expect(fc.phone.doc.summary().scenes).toEqual([{ name: "Pop2", project: "Base2" }]);
    const clash = await t.call("rename", { kind: "task", from: "MCP.T9", to: "TaskerMCP.Setup" });
    expect(clash.text).toContain("already exists");
    const clash2 = await t.call("rename", { kind: "project", from: "Base2", to: "TaskerMCP" });
    expect(clash2.text).toContain("already exists");
  });
});
