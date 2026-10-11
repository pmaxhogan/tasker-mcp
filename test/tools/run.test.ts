import { afterEach, describe, expect, it } from "vitest";
import { TaskerDoc } from "../../src/model/document.ts";
import { register as registerRun, SCRATCH_TASK } from "../../src/tools/run.ts";
import { getSpec } from "../../src/spec/table.ts";
import {
  actionFromInput,
  applyTask,
  coerceArg,
  exclusive,
  insertRoot,
  newProject,
  parseTaskerXml,
  profilesUsingTask,
  remapTaskRefs,
  replaceRoot,
  resolveArgKey,
} from "../../src/tools/mutate.ts";
import {
  connectTools,
  createFakeContext,
  type FakeContext,
  type FakeContextOptions,
  type ToolHarness,
} from "./fake-context.ts";

let fc: FakeContext | undefined;
let t: ToolHarness | undefined;

async function setup(opts: FakeContextOptions = {}): Promise<{ fc: FakeContext; t: ToolHarness }> {
  fc = await createFakeContext(opts);
  t = await connectTools(fc.ctx, [registerRun]);
  return { fc, t };
}

afterEach(async () => {
  await t?.close();
  await fc?.cleanup();
  t = undefined;
  fc = undefined;
});

const FLASH_RETURN = [
  { action: "Flash", args: { Text: "hello" } },
  { action: "Variable Set", args: { Name: "%out", To: "done" } },
  { action: "Return", args: { Value: "%out" } },
];

describe("run_task", () => {
  it("runs a task with params and variables", async () => {
    const { fc, t } = await setup();
    fc.phone.runner = (_p, opts) => ({ ok: true, return: JSON.stringify(opts), durationMs: 3 });
    const r = await t.call("run_task", {
      name: "MCP.T1",
      par1: "a",
      par2: "b",
      variables: { "%myvar": "1", other: "2" },
      timeoutSec: 5,
      debug: true,
    });
    expect(r.isError, r.text).toBe(false);
    expect(JSON.parse(r.json.return)).toEqual({
      task: "MCP.T1",
      par1: "a",
      par2: "b",
      variables: { myvar: "1", other: "2" },
      timeoutSec: 5,
      debug: true,
    });
  });

  it("explains a missing task and bad variable names", async () => {
    const { t } = await setup();
    const r = await t.call("run_task", { name: "Nope" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("no task named Nope; list_tasks shows the task names");
    const v = await t.call("run_task", { name: "MCP.T1", variables: { MyVar: "x" } });
    expect(v.text).toContain("must be lower case");
  });

  it("passes other failures through as results", async () => {
    const { fc, t } = await setup();
    fc.phone.runner = () => ({ ok: false, error: "timed out", durationMs: 1 });
    const r = await t.call("run_task", { name: "MCP.T1" });
    expect(r.isError).toBe(false);
    expect(r.json).toMatchObject({ ok: false, error: "timed out" });
  });
});

describe("run_actions", () => {
  it("imports the scratch task, runs it, then empties it", async () => {
    const { fc, t } = await setup();
    const r = await t.call("run_actions", { actions: FLASH_RETURN });
    expect(r.isError, r.text).toBe(false);
    expect(r.json).toMatchObject({ ok: true, return: "done", task: SCRATCH_TASK });
    expect(fc.phone.flashes).toEqual(["hello"]);
    const scratch = fc.phone.doc.taskByName(SCRATCH_TASK)!;
    expect(scratch).toBeDefined();
    expect(fc.phone.doc.tasks().filter((x) => TaskerDoc.nameOf(x) === SCRATCH_TASK)).toHaveLength(
      1,
    );
    // keep: false re-imported it empty.
    expect(scratch.children.some((c) => c.type === "element" && c.name === "Action")).toBe(false);
    expect(fc.phone.routes()).not.toContain("/config");
    expect(await fc.ctx.snapshots.list()).toEqual([]);
    expect(fc.toolsChangedCount()).toBe(0);

    // A second call replaces it in place.
    const r2 = await t.call("run_actions", {
      actions: [{ action: "Return", args: { Value: "again" } }],
      keep: true,
      debug: true,
      timeoutSec: 10,
    });
    expect(r2.json).toMatchObject({ ok: true, return: "again", debug: ["code 126"] });
    expect(fc.phone.doc.tasks().filter((x) => TaskerDoc.nameOf(x) === SCRATCH_TASK)).toHaveLength(
      1,
    );
    expect(
      fc.phone.doc
        .taskByName(SCRATCH_TASK)!
        .children.some((c) => c.type === "element" && c.name === "Action"),
    ).toBe(true);
  });

  it("follows the write policy", async () => {
    const denied = await setup({
      policy: { allowPrefixes: ["MCPTest."], allowConfigImport: false },
    });
    const r = await denied.t.call("run_actions", { actions: FLASH_RETURN });
    expect(r.isError).toBe(true);
    expect(r.text).toContain(`Write to task "${SCRATCH_TASK}" refused`);
    await t!.close();
    await fc!.cleanup();
    const allowed = await setup({
      policy: { allowPrefixes: ["TaskerMCP."], allowConfigImport: false },
    });
    const ok = await allowed.t.call("run_actions", { actions: FLASH_RETURN });
    expect(ok.json).toMatchObject({ ok: true, return: "done" });
  });

  it("rejects invalid actions before touching the phone", async () => {
    const { fc, t } = await setup();
    const r = await t.call("run_actions", { actions: [{ action: "End If" }] });
    expect(r.text).toContain("failed validation");
    expect(fc.phone.routes()).toEqual([]);
  });

  it("reports pipeline warnings and resets the scratch task even when the run throws", async () => {
    const { fc, t } = await setup();
    fc.phone.runner = () => {
      throw new Error("phone gone");
    };
    const r = await t.call("run_actions", {
      actions: [{ raw: `<Action sr="act0" ve="7"><code>3</code></Action>` }],
    });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("phone gone");
    expect(fc.phone.routes().filter((x) => x === "/import")).toHaveLength(2);

    fc.phone.runner = () => ({ ok: true, durationMs: 1 });
    const w = await t.call("run_actions", {
      actions: [{ raw: `<Action sr="act0" ve="7"><code>3</code></Action>` }],
    });
    expect(w.json.warnings.join(" ")).toContain("Unknown action code 3");
  });

  it("marks an unverified import", async () => {
    const { fc, t } = await setup();
    const real = fc.phone.importXml.bind(fc.phone);
    fc.phone.importXml = async (xml: string) => real(xml.replace(">hello<", ">HELLO<"));
    const r = await t.call("run_actions", { actions: FLASH_RETURN, keep: true });
    expect(r.json.verified).toBe(false);
  });

  it("ignores a failure while emptying the scratch task", async () => {
    const { fc, t } = await setup();
    let n = 0;
    const real = fc.phone.importXml.bind(fc.phone);
    fc.phone.importXml = async (xml: string) => {
      n++;
      if (n === 2) throw new Error("import failed");
      return real(xml);
    };
    const r = await t.call("run_actions", { actions: FLASH_RETURN });
    expect(r.json).toMatchObject({ ok: true, return: "done" });
  });
});

describe("stop_task", () => {
  it("stops a task", async () => {
    const { fc, t } = await setup();
    expect((await t.call("stop_task", { name: "MCP.T1" })).json).toEqual({ ok: true });
    expect(fc.phone.stopped).toEqual(["MCP.T1"]);
  });
});

describe("exclusive", () => {
  it("serializes callers and is reentrant", async () => {
    const order: string[] = [];
    const slow = exclusive(async () => {
      order.push("a-start");
      await new Promise((r) => setTimeout(r, 20));
      // Nested: must not deadlock.
      await exclusive(async () => order.push("a-nested"));
      order.push("a-end");
    });
    const fast = exclusive(async () => order.push("b"));
    const failing = exclusive(async () => {
      throw new Error("boom");
    });
    await Promise.all([slow, fast, failing.catch(() => undefined)]);
    await exclusive(async () => order.push("c"));
    expect(order).toEqual(["a-start", "a-nested", "a-end", "b", "c"]);
  });
});

describe("mutate helpers", () => {
  const spec = getSpec();

  it("coerces values with and without a spec", () => {
    expect(coerceArg(0, true, undefined, "w")).toEqual({ id: 0, kind: "Bool", value: true });
    expect(coerceArg(0, 3, undefined, "w")).toEqual({ id: 0, kind: "Int", value: 3 });
    expect(coerceArg(0, "s", undefined, "w")).toEqual({ id: 0, kind: "Str", value: "s" });
    expect(coerceArg(0, '<Bundle sr="arg0"/>', undefined, "w")).toMatchObject({
      kind: "Raw",
      tag: "Bundle",
    });
    expect(() => coerceArg(0, null, undefined, "w")).toThrow(/a string, number or boolean/);
    expect(() => coerceArg(0, "<oops", undefined, "w")).toThrow(/invalid raw XML/);
    const vs = spec.byCode(547)!;
    const maths = vs.args.find((a) => a.id === 3)!;
    expect(coerceArg(3, "off", maths, "w")).toEqual({ id: 3, kind: "Bool", value: false });
    expect(coerceArg(3, "%flag", maths, "w")).toEqual({ id: 3, kind: "Int", value: "%flag" });
    const kill = spec.byCode(18)!.args[0]!;
    expect(coerceArg(0, '<App sr="arg0"/>', kill, "w")).toMatchObject({ kind: "Raw", tag: "App" });
    expect(coerceArg(0, { kind: "Raw", raw: "<App/>" }, kill, "w")).toMatchObject({ tag: "App" });
    expect(coerceArg(0, { kind: "Int", value: 2 }, undefined, "w")).toMatchObject({ value: 2 });
    expect(() => coerceArg(0, { kind: "Bool", value: "x" }, undefined, "w")).toThrow(/kind/);
    expect(() => coerceArg(0, { kind: "Raw" }, undefined, "w")).toThrow(/kind/);
  });

  it("resolves arg keys", () => {
    const pt = spec.byCode(130)!;
    expect(resolveArgKey(pt, "arg2")).toMatchObject({ id: 2 });
    expect(resolveArgKey(pt, "77")).toBe(77);
    expect(resolveArgKey(pt, "Return Value")).toMatchObject({ id: 4 });
    expect(() => resolveArgKey(pt, "Para")).toThrow(/has no arg/);
  });

  it("converts unknown-code raw actions, keyed by id", () => {
    const a = actionFromInput(
      spec,
      {
        raw: `<Action sr="act0" ve="7"><code>3</code></Action>`,
        args: { arg0: "x", 1: 2 },
        collapsed: true,
      },
      0,
    );
    expect(a).toMatchObject({ code: 3, collapsed: true });
    expect(a.args).toEqual([
      { id: 0, kind: "Str", value: "x" },
      { id: 1, kind: "Int", value: 2 },
    ]);
    expect(() =>
      actionFromInput(
        spec,
        { raw: `<Action sr="act0" ve="7"><code>3</code></Action>`, args: { Name: "x" } },
        0,
      ),
    ).toThrow(/key args by id/);
  });

  it("edits documents", () => {
    const doc = TaskerDoc.parse(`<TaskerData sr="" dvi="1" tv="6.6.20"></TaskerData>`);
    const p = newProject(doc, "P", 5);
    expect(doc.projects()).toEqual([p]);
    const t = TaskerDoc.parse(
      `<TaskerData><Task sr="task1"><id>1</id><nme>T</nme></Task></TaskerData>`,
    ).tasks()[0]!;
    insertRoot(doc, t);
    const prof = TaskerDoc.parse(
      `<TaskerData><Profile sr="prof2"><id>2</id><mid0>1</mid0></Profile></TaskerData>`,
    ).profiles()[0]!;
    insertRoot(doc, prof);
    expect(
      doc.root.children
        .filter((c) => c.type === "element")
        .map((c) => (c as { name: string }).name),
    ).toEqual(["Profile", "Project", "Task"]);
    const t2 = TaskerDoc.parse(
      `<TaskerData><Task sr="task3"><id>3</id><nme>U</nme></Task></TaskerData>`,
    ).tasks()[0]!;
    replaceRoot(doc, t2, t2);
    expect(doc.taskByName("U")).toBe(t2);
    remapTaskRefs(doc, 1, 3);
    expect(profilesUsingTask(doc, 3)).toEqual(["#2"]);
    expect(() => parseTaskerXml("<x/>", "backup")).toThrow(/Invalid backup/);
  });

  it("refuses an empty task name", async () => {
    const f = await createFakeContext();
    await expect(applyTask(f.ctx, { name: " ", actions: [] }, { tool: "t" })).rejects.toThrow(
      "A task needs a name",
    );
    await f.cleanup();
  });
});
