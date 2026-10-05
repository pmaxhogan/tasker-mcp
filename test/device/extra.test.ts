/**
 * Live device tests for the variables, specs, docs, logs, snapshots and
 * per-task tool modules. Run with `npm run test:device` against an emulator
 * (or a phone) with the TaskerMCP project imported and Setup run.
 *
 * Env: TASKER_URL (default http://localhost:1821), TASKER_TOKEN or
 * TASKER_TOKEN_FILE (default ~/.tasker-mcp/emulator-token), TASKER_ADB_SERIAL
 * (default emulator-5554). Writes only touch the global MCPTestVar and the
 * task TaskerMCP.Test.McpTool.
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/config.ts";
import type { RegisterTools } from "../../src/tools/context.ts";
import { register as docs } from "../../src/tools/docs.ts";
import { register as logs } from "../../src/tools/logs.ts";
import { register as profiles } from "../../src/tools/profiles.ts";
import { createToolContext, type RuntimeContext } from "../../src/tools/runtime.ts";
import { register as snapshots } from "../../src/tools/snapshots.ts";
import { register as specs } from "../../src/tools/specs.ts";
import { registerTaskTools } from "../../src/tools/tasktools.ts";
import { register as variables } from "../../src/tools/variables.ts";

const URL_ = process.env.TASKER_URL ?? "http://localhost:1821";
const SERIAL = process.env.TASKER_ADB_SERIAL ?? "emulator-5554";
const TOKEN_FILE =
  process.env.TASKER_TOKEN_FILE ?? join(homedir(), ".tasker-mcp", "emulator-token");

function token(): string {
  const env = process.env.TASKER_TOKEN?.trim();
  if (env) return env;
  if (!existsSync(TOKEN_FILE)) {
    throw new Error(
      `No token: set TASKER_TOKEN or put it in ${TOKEN_FILE} ` +
        "(adb shell cat /sdcard/Download/tasker-mcp-token.txt after running TaskerMCP.Setup)",
    );
  }
  return readFileSync(TOKEN_FILE, "utf8").trim();
}

const TEST_TASK = "TaskerMCP.Test.McpTool";
const TEST_TOOL = "tasker_taskermcp_test_mcptool";

/**
 * A task with a #mcp comment, one Return action and one Task Variable. The
 * Return action layout is copied from tasker/TaskerMCP.prj.xml (TaskerMCP.Setup)
 * and the ProfileVariable layout from test/fixtures/dceluis-mcp-server.prj.xml.
 */
function testTaskXml(): string {
  return `<TaskerData sr="" dvi="1" tv="6.6.20">
	<Task sr="task99901">
		<cdate>1791158400000</cdate>
		<edate>1791158400000</edate>
		<id>99901</id>
		<nme>${TEST_TASK}</nme>
		<pc>Greets someone for the tasker-mcp device test. #mcp</pc>
		<pri>100</pri>
		<Action sr="act0" ve="7">
			<code>126</code>
			<Str sr="arg0" ve="3">hello %who</Str>
			<Int sr="arg1" val="1"/>
			<Int sr="arg2" val="0"/>
			<Int sr="arg3" val="0"/>
			<Str sr="arg4" ve="3"/>
		</Action>
		<ProfileVariable sr="pv0">
			<clearout>true</clearout>
			<exportval></exportval>
			<immutable>true</immutable>
			<pvci>false</pvci>
			<pvd>Who to greet (required)</pvd>
			<pvdn>who</pvdn>
			<pvid>99902</pvid>
			<pvit>t</pvit>
			<pvn>%who</pvn>
			<pvt>t</pvt>
			<strout>true</strout>
		</ProfileVariable>
	</Task>
</TaskerData>
`;
}

interface CallResult {
  isError: boolean;
  text: string;
  json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

let home: string;
let ctx: RuntimeContext;
let server: McpServer;
let client: Client;
let listChanged = 0;

async function call(name: string, args: Record<string, unknown> = {}): Promise<CallResult> {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as Array<{ text?: string }>).map((c) => c.text ?? "").join("\n");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { isError: res.isError === true, text, json };
}

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "tasker-mcp-device-"));
  const { config } = loadConfig([], {
    TASKER_URL: URL_,
    TASKER_TOKEN: token(),
    TASKER_ADB_SERIAL: SERIAL,
    TASKER_MCP_HOME: home,
    ...(process.env.TASKER_ADB ? { TASKER_ADB: process.env.TASKER_ADB } : {}),
  });
  ctx = createToolContext(config);
  const c = await ctx.client();
  try {
    await c.ping();
  } catch (e) {
    throw new Error(
      `Tasker at ${URL_} did not answer /ping (${(e as Error).message}). Start the emulator, ` +
        "import tasker/TaskerMCP.prj.xml, run TaskerMCP.Setup, and `adb forward tcp:1821 tcp:1821`.",
      { cause: e },
    );
  }
  server = new McpServer(
    { name: "tasker-mcp-device", version: "0.0.0" },
    { capabilities: { tools: { listChanged: true } } },
  );
  const mods: RegisterTools[] = [variables, profiles, specs, docs, logs, snapshots];
  for (const m of mods) m(server, ctx);
  registerTaskTools(server, ctx, { initialDelayMs: -1 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "device-test", version: "0.0.0" });
  client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
    listChanged++;
  });
  await Promise.all([server.connect(a), client.connect(b)]);
});

afterAll(async () => {
  await client?.close();
  await server?.close();
  if (home) await rm(home, { recursive: true, force: true });
});

describe("globals", () => {
  it("set_global, get_global and list_globals round trip MCPTestVar", async () => {
    const value = `v${Date.now()}`;
    const set = await call("set_global", { name: "MCPTestVar", value });
    expect(set.isError, set.text).toBe(false);
    const got = await call("get_global", { name: "%MCPTestVar" });
    expect(got.json).toEqual({ name: "MCPTestVar", value, set: true });
    const list = await call("list_globals");
    expect(list.isError, list.text).toBe(false);
    expect(list.json.globals).toContain("MCPTestVar");
  });
});

describe("action specs", () => {
  it("knows code 130 and warns on 990", async () => {
    const known = await call("get_action_spec", { codeOrName: 130 });
    expect(known.json).toMatchObject({ code: 130, known: true });
    expect(known.json.args.length).toBeGreaterThan(0);
    const unknown = await call("get_action_spec", { codeOrName: 990 });
    expect(unknown.isError).toBe(false);
    expect(unknown.json).toMatchObject({ code: 990, known: false });
  });
});

describe("docs", () => {
  it("search_docs finds Import Data", async (t) => {
    const r = await call("search_docs", { query: "import data" });
    if (
      r.isError &&
      /HTTP 404|fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|timeout/i.test(r.text)
    ) {
      t.skip(`docs download unavailable (docs-data branch missing or no network): ${r.text}`);
      return;
    }
    expect(r.isError, r.text).toBe(false);
    expect(r.json.count).toBeGreaterThan(0);
    expect(r.json.hits.map((h: { slug: string }) => h.slug).join(" ")).toMatch(/import_data/);
  });
});

describe("logs", () => {
  it("get_logcat returns redacted lines", async () => {
    // Make some Tasker activity first.
    await call("get_global", { name: "MCPTestVar" });
    const r = await call("get_logcat", { seconds: 300 });
    expect(r.isError, r.text).toBe(false);
    expect(Array.isArray(r.json.lines)).toBe(true);
    expect(r.text).not.toContain(token());
    if (r.json.count === 0) {
      console.warn(
        "get_logcat returned no lines: enable Tasker > Preferences > Misc > Debug To System Log",
      );
    }
  });

  it("get_run_log explains the 501", async () => {
    const r = await call("get_run_log");
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/get_logcat/);
  });
});

describe("snapshots", () => {
  it("snapshot_now then list_snapshots", async () => {
    const s = await call("snapshot_now", { label: "device test" });
    expect(s.isError, s.text).toBe(false);
    const l = await call("list_snapshots");
    expect(l.json.snapshots.map((x: { id: string }) => x.id)).toContain(s.json.snapshot.id);
    expect(s.json.snapshot.bytes).toBeGreaterThan(1000);
  });
});

describe("per-task tools", () => {
  it("refresh_tools picks up an imported #mcp task and calling it runs the task", async () => {
    const c = await ctx.client();
    const imported = await c.importXml(testTaskXml());
    expect(imported.ok).toBe(true);

    const r = await call("refresh_tools");
    expect(r.isError, r.text).toBe(false);
    const tool = r.json.tools.find((x: { name: string }) => x.name === TEST_TOOL);
    expect(tool, `tools: ${JSON.stringify(r.json.tools)}`).toEqual({
      name: TEST_TOOL,
      task: TEST_TASK,
      args: ["who"],
    });

    const listed = await client.listTools();
    const def = listed.tools.find((x) => x.name === TEST_TOOL);
    expect(def?.inputSchema.required).toEqual(["who"]);
    expect(def?.description).toMatch(/^Greets someone/);

    const run = await call(TEST_TOOL, { who: "device" });
    expect(run.isError, run.text).toBe(false);
    expect(run.json.ok).toBe(true);
    // If this fails with "hello %who", the Immutable Task Variable did not take the
    // value passed through /run's Perform Task.
    expect(run.json.return).toBe("hello device");
    await vi.waitFor(() => expect(listChanged).toBeGreaterThan(0));
  });
});
