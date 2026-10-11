import { afterEach, describe, expect, it } from "vitest";
import { TaskerDoc } from "../../src/model/document.ts";
import { register } from "../../src/tools/snapshots.ts";
import { childText, setChildText } from "../../src/xml/index.ts";
import {
  connectTools,
  createFakeContext,
  type FakeContext,
  type FakeContextOptions,
  type ToolHarness,
} from "./fake-context.ts";

let fc: FakeContext;
let t: ToolHarness;

async function setup(opts: FakeContextOptions = {}): Promise<void> {
  fc = await createFakeContext(opts);
  t = await connectTools(fc.ctx, [register]);
}

afterEach(async () => {
  await t?.close();
  t = undefined as unknown as ToolHarness;
  await fc?.cleanup();
  fc = undefined as unknown as FakeContext;
});

function setComment(task: string, text: string): void {
  const el = fc.phone.doc.taskByName(task);
  if (el === undefined) throw new Error(`no task ${task}`);
  setChildText(el, "pc", text);
}

function commentOf(task: string): string | undefined {
  const el = fc.phone.doc.taskByName(task);
  return el === undefined ? undefined : childText(el, "pc");
}

describe("snapshot tools", () => {
  it("snapshot_now saves and list_snapshots lists", async () => {
    await setup();
    const empty = await t.call("list_snapshots");
    expect(empty.json).toEqual({ count: 0, snapshots: [] });
    const r = await t.call("snapshot_now", { label: "before cleanup" });
    expect(r.json.ok).toBe(true);
    expect(r.json.snapshot).toMatchObject({ label: "before cleanup", tool: "snapshot_now" });
    const l = await t.call("list_snapshots");
    expect(l.json.count).toBe(1);
    expect(l.json.snapshots[0].id).toBe(r.json.snapshot.id);
  });

  it("restore_snapshot in config mode replaces the configuration and is undoable", async () => {
    await setup();
    setComment("MCP.T1", "original");
    const snap = await t.call("snapshot_now", { label: "orig" });
    setComment("MCP.T1", "changed");
    const r = await t.call("restore_snapshot", { id: snap.json.snapshot.id });
    expect(r.isError).toBe(false);
    expect(r.json).toMatchObject({ ok: true, mode: "config", restored: snap.json.snapshot.id });
    expect(fc.phone.routes()).toContain("/config");
    expect(commentOf("MCP.T1")).toBe("original");
    // The pre-restore snapshot holds the changed state.
    const undo = await fc.ctx.snapshots.get(r.json.undo);
    const undoDoc = TaskerDoc.parse(undo.xml);
    expect(childText(undoDoc.taskByName("MCP.T1")!, "pc")).toBe("changed");
  });

  it("restore_snapshot in tasks mode re-imports allowed tasks by name", async () => {
    await setup({ policy: { allowPrefixes: ["MCP."], allowConfigImport: false } });
    setComment("MCP.T1", "original");
    const snap = await t.call("snapshot_now", { label: "orig" });
    setComment("MCP.T1", "changed");
    const r = await t.call("restore_snapshot", { id: snap.json.snapshot.id });
    expect(r.isError).toBe(false);
    expect(r.json.mode).toBe("tasks");
    expect(r.json.tasks).toEqual(["MCP.T1"]);
    expect(r.json.skipped.map((s: { name: string }) => s.name)).toContain("TaskerMCP.Dispatch");
    expect(fc.phone.routes()).not.toContain("/config");
    expect(commentOf("MCP.T1")).toBe("original");
  });

  it("restore_snapshot tasks mode reports import failures", async () => {
    await setup();
    const snap = await t.call("snapshot_now", { label: "orig" });
    fc.phone.importXml = async () => {
      throw new Error("import broke");
    };
    const r = await t.call("restore_snapshot", { id: snap.json.snapshot.id, mode: "tasks" });
    expect(r.isError).toBe(true);
    expect(r.json.ok).toBe(false);
    expect(r.json.failed[0]).toMatchObject({ error: "import broke" });
  });

  it("refuses config mode when config imports are disabled, without a snapshot", async () => {
    await setup({ policy: { allowConfigImport: false } });
    const snap = await t.call("snapshot_now", { label: "orig" });
    const r = await t.call("restore_snapshot", { id: snap.json.snapshot.id, mode: "config" });
    expect(r.isError).toBe(true);
    expect((await fc.ctx.snapshots.list()).length).toBe(1);
  });

  it("fails tasks mode when the policy allows no task", async () => {
    await setup({ policy: { allowPrefixes: ["Nothing."], allowConfigImport: false } });
    const snap = await t.call("snapshot_now", { label: "orig" });
    const r = await t.call("restore_snapshot", { id: snap.json.snapshot.id });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/no named task the write policy allows; check TASKER_WRITE_ALLOW/);
  });

  it("reports an unknown id", async () => {
    await setup();
    const r = await t.call("restore_snapshot", { id: "nope" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/Snapshot "nope" not found/);
  });
});
