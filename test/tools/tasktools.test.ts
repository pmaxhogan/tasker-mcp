import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskerDoc } from "../../src/model/document.ts";
import {
  MAX_TOOL_NAME,
  discoverTaskTools,
  hasMcpTag,
  inputShape,
  mangleToolName,
  register,
  registerTaskTools,
  stripMcpTag,
  taskToolRegistryFor,
  toVariables,
} from "../../src/tools/tasktools.ts";
import { parseFragment } from "../../src/xml/index.ts";
import {
  connectTools,
  createFakeContext,
  type FakeContext,
  type ToolHarness,
} from "./fake-context.ts";

function pv(o: {
  name: string;
  type: string;
  prompt?: string;
  immutable?: boolean;
  pvci?: boolean;
  pvit?: string;
}): string {
  return `<ProfileVariable sr="pv0">
<clearout>true</clearout>
<exportval></exportval>
<immutable>${o.immutable ?? true}</immutable>
<pvci>${o.pvci ?? false}</pvci>
<pvd>${o.prompt ?? ""}</pvd>
<pvdn>${o.name}</pvdn>
<pvid>1</pvid>
<pvit>${o.pvit ?? "t"}</pvit>
<pvn>%${o.name}</pvn>
<pvt>${o.type}</pvt>
<strout>true</strout>
</ProfileVariable>`;
}

const RETURN = (value: string): string => `<Action sr="act0" ve="7">
<code>126</code>
<Str sr="arg0" ve="3">${value}</Str>
<Int sr="arg1" val="1"/>
<Int sr="arg2" val="0"/>
<Int sr="arg3" val="0"/>
<Str sr="arg4" ve="3"/>
</Action>`;

function task(id: number, name: string, comment: string | undefined, body = ""): string {
  const pc = comment === undefined ? "" : `<pc>${comment}</pc>`;
  return `<Task sr="task${id}"><cdate>1</cdate><edate>1</edate><id>${id}</id><nme>${name}</nme>${pc}${body}</Task>`;
}

const LONG = "X".repeat(100);

function backup(extra = ""): string {
  return `<TaskerData sr="" dvi="1" tv="6.6.20">
<Project sr="proj0" ve="2"><cdate>1</cdate><name>Base</name><tids>10,11,12,13,14</tids></Project>
${task(
  10,
  "MCP Set Volume",
  "#mcp Sets the media volume.",
  RETURN("%level|%loud|%note") +
    pv({ name: "level", type: "n", prompt: "Volume 0-15 (required)" }) +
    pv({ name: "loud", type: "onoff", prompt: "Loud mode" }) +
    pv({ name: "note", type: "t" }) +
    pv({ name: "configured", type: "t", pvci: true }) +
    pv({ name: "mutable", type: "t", immutable: false }) +
    pv({ name: "projvar", type: "t", pvit: "pj" }) +
    pv({ name: "Bad-Name", type: "t" }),
)}
${task(11, "MCP set volume!", "Second one #MCP", RETURN("two"))}
${task(12, "Not exposed", "#mcpx is not the tag", RETURN("no"))}
${task(13, LONG, "#mcp", RETURN("long"))}
${task(14, "!!!", "#mcp symbols only", "")}
${extra}
</TaskerData>
`;
}

let fc: FakeContext;
let t: ToolHarness;

afterEach(async () => {
  vi.restoreAllMocks();
  await t?.close();
  t = undefined as unknown as ToolHarness;
  await fc?.cleanup();
  fc = undefined as unknown as FakeContext;
});

describe("convention helpers", () => {
  it("detects and strips the tag", () => {
    expect(hasMcpTag(undefined)).toBe(false);
    expect(hasMcpTag("Does things #mcp")).toBe(true);
    expect(hasMcpTag("#MCP")).toBe(true);
    expect(hasMcpTag("#mcpx")).toBe(false);
    expect(stripMcpTag("#mcp  Does  things.\n  More #mcp")).toBe("Does things.\nMore");
  });

  it("mangles names, dedupes and caps length", () => {
    const taken = new Set<string>();
    expect(mangleToolName("MCP Get Volume", taken)).toBe("tasker_mcp_get_volume");
    expect(mangleToolName("mcp-get--volume!", taken)).toBe("tasker_mcp_get_volume_2");
    expect(mangleToolName("MCP Get Volume", taken)).toBe("tasker_mcp_get_volume_3");
    expect(mangleToolName("!!!", taken)).toBe("tasker_task");
    const long1 = mangleToolName(LONG, taken);
    const long2 = mangleToolName(LONG, taken);
    expect(long1.length).toBe(MAX_TOOL_NAME);
    expect(long2.length).toBe(MAX_TOOL_NAME);
    expect(long2.endsWith("_2")).toBe(true);
  });

  it("maps task variables to a schema", () => {
    const defs = discoverTaskTools(TaskerDoc.parse(backup()));
    expect(defs.map((d) => d.tool)).toEqual([
      "tasker_mcp_set_volume",
      "tasker_mcp_set_volume_2",
      `tasker_${"x".repeat(MAX_TOOL_NAME - 7)}`,
      "tasker_task_14",
    ]);
    const vol = defs[0]!;
    expect(vol.task).toBe("MCP Set Volume");
    expect(vol.taskId).toBe(10);
    expect(vol.description).toMatch(
      /^Sets the media volume\.\n\n\(Tasker task "MCP Set Volume"\.\)/,
    );
    expect(vol.description).toContain(
      'Example: tasker_mcp_set_volume {"level":1,"loud":true,"note":"text"}',
    );
    expect(vol.args).toEqual([
      {
        name: "level",
        variable: "level",
        type: "number",
        required: true,
        description: "Volume 0-15 (required)",
      },
      {
        name: "loud",
        variable: "loud",
        type: "boolean",
        required: false,
        description: "Loud mode",
      },
      { name: "note", variable: "note", type: "string", required: false, description: "note" },
    ]);
    expect(defs[3]!.description).toMatch(/^symbols only/);
    const shape = inputShape(vol);
    expect(Object.keys(shape)).toEqual(["level", "loud", "note"]);
    expect(shape.level!.safeParse(undefined).success).toBe(false);
    expect(shape.loud!.safeParse(undefined).success).toBe(true);
    expect(toVariables(vol, { level: 5, loud: false, note: "hi", other: "x" })).toEqual({
      level: "5",
      loud: "false",
      note: "hi",
    });
  });

  it("describes a task without a comment body", () => {
    const doc = TaskerDoc.parse(
      `<TaskerData sr="" dvi="1" tv="6.6.20">${task(5, "Plain", "#mcp")}</TaskerData>`,
    );
    const [def] = discoverTaskTools(doc);
    expect(def!.description).toBe('Runs the Tasker task "Plain". Example: tasker_plain {}');
    const anon = parseFragment(`<Task sr="task6"><id>6</id><pc>#mcp</pc></Task>`);
    doc.root.children.push(anon);
    expect(discoverTaskTools(doc).length).toBe(1);
  });
});

describe("refresh_tools and per-task tools", () => {
  it("registers, calls, updates and removes task tools with listChanged", async () => {
    fc = await createFakeContext({ xml: backup() });
    t = await connectTools(fc.ctx, [
      (server, ctx) => {
        registerTaskTools(server, ctx, { initialDelayMs: -1 });
      },
    ]);
    let notified = 0;
    t.client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
      notified++;
    });
    expect(await t.toolNames()).toEqual(["refresh_tools"]);
    expect(fc.phone.routes()).toEqual([]);

    const r = await t.call("refresh_tools");
    expect(r.isError).toBe(false);
    expect(r.json.changed).toBe(true);
    expect(r.json.added).toHaveLength(4);
    expect(r.json.tools.find((x: { name: string }) => x.name === "tasker_mcp_set_volume")).toEqual({
      name: "tasker_mcp_set_volume",
      task: "MCP Set Volume",
      args: ["level", "loud", "note"],
    });
    const listed = await t.client.listTools();
    const vol = listed.tools.find((x) => x.name === "tasker_mcp_set_volume")!;
    expect(vol.inputSchema.required).toEqual(["level"]);
    expect(vol.inputSchema.properties).toMatchObject({
      level: { type: "number" },
      loud: { type: "boolean" },
      note: { type: "string" },
    });
    await vi.waitFor(() => expect(notified).toBeGreaterThan(0));

    const run = await t.call("tasker_mcp_set_volume", { level: 7, loud: true });
    expect(run.isError).toBe(false);
    expect(run.json).toMatchObject({ ok: true, return: "7|true|%note" });
    expect(fc.phone.calls.at(-1)).toEqual({
      route: "/run",
      body: { task: "MCP Set Volume", variables: { level: "7", loud: "true" } },
    });
    const bad = await t.call("tasker_mcp_set_volume", { loud: true });
    expect(bad.isError).toBe(true);

    // A second refresh with nothing changed.
    notified = 0;
    const same = await t.call("refresh_tools");
    expect(same.json).toMatchObject({ changed: false, added: [], removed: [], updated: [] });

    // Edit one task's comment, drop another.
    fc.phone.doc = TaskerDoc.parse(
      backup()
        .replace("#mcp Sets the media volume.", "#mcp Sets the volume, v2.")
        .replace("Second one #MCP", "no longer"),
    );
    const upd = await t.call("refresh_tools");
    expect(upd.json.changed).toBe(true);
    expect(upd.json.updated).toEqual(["tasker_mcp_set_volume"]);
    expect(upd.json.removed).toEqual(["tasker_mcp_set_volume_2"]);
    const names = await t.toolNames();
    expect(names).not.toContain("tasker_mcp_set_volume_2");
    const desc = (await t.client.listTools()).tools.find((x) => x.name === "tasker_mcp_set_volume");
    expect(desc!.description).toMatch(/v2/);
    await vi.waitFor(() => expect(notified).toBeGreaterThan(0));
    expect(taskToolRegistryFor(t.server)?.names()).toContain("tasker_mcp_set_volume");
  });

  it("marks a failed run as an error", async () => {
    fc = await createFakeContext({
      xml: backup(),
      runner: () => ({ ok: false, error: "task failed", durationMs: 1 }),
    });
    t = await connectTools(fc.ctx, [
      (s, c) => void registerTaskTools(s, c, { initialDelayMs: -1 }),
    ]);
    await t.call("refresh_tools");
    const r = await t.call("tasker_task_14");
    expect(r.isError).toBe(true);
    expect(r.json).toMatchObject({ ok: false, error: "task failed" });
  });

  it("reports a name clash with a static tool instead of throwing", async () => {
    fc = await createFakeContext({ xml: backup() });
    t = await connectTools(fc.ctx, [
      (server, ctx) => {
        server.registerTool("tasker_task_14", { description: "static" }, async () => ({
          content: [],
        }));
        registerTaskTools(server, ctx, { initialDelayMs: -1 });
      },
    ]);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const r = await t.call("refresh_tools");
    expect(r.isError).toBe(false);
    expect(r.json.errors).toHaveLength(1);
    expect(r.json.errors[0]).toMatch(/^tasker_task_14 \(task "!!!"\)/);
  });

  it("discovers in the background after a delay without touching the phone at register", async () => {
    fc = await createFakeContext({ xml: backup() });
    t = await connectTools(fc.ctx, [(s, c) => void registerTaskTools(s, c, { initialDelayMs: 5 })]);
    expect(fc.phone.routes()).toEqual([]);
    await vi.waitFor(async () => expect(await t.toolNames()).toContain("tasker_mcp_set_volume"));
  });

  it("logs a failed background discovery to stderr", async () => {
    fc = await createFakeContext({ xml: backup() });
    fc.phone.backup = async () => {
      throw new Error("phone offline");
    };
    const writes: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((s) => {
      writes.push(String(s));
      return true;
    });
    t = await connectTools(fc.ctx, [(s, c) => void registerTaskTools(s, c, { initialDelayMs: 1 })]);
    await vi.waitFor(() =>
      expect(writes.join("")).toMatch(/per-task tool discovery failed.*phone offline/),
    );
    // A later explicit refresh still works once the phone is back.
    fc.phone.backup = async () => fc.phone.xml();
    const r = await t.call("refresh_tools");
    expect(r.json.added.length).toBe(4);
  });

  it("the default register schedules discovery", async () => {
    vi.useFakeTimers();
    try {
      fc = await createFakeContext({ xml: backup() });
      const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
      const server = new McpServer({ name: "x", version: "0" });
      register(server, fc.ctx);
      expect(fc.phone.routes()).toEqual([]);
      await vi.runAllTimersAsync();
      expect(fc.phone.routes()).toEqual(["/backup"]);
      expect(taskToolRegistryFor(server)?.names()).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
