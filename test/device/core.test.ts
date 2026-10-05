/**
 * Live test of the core tools against a real Tasker (emulator). Run with
 * `npm run test:device`; never part of `npm test`.
 *
 * Env: TASKER_URL (default http://localhost:1821, e.g. after
 * `adb forward tcp:1821 tcp:1821`), TASKER_TOKEN, or TASKER_TOKEN_FILE
 * (default ~/.tasker-mcp/emulator-token). Every object it creates is named
 * "MCPTest.*" and afterAll deletes all of them in one config import, whatever
 * passed or failed. It needs config imports, so never point it at a real phone.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Config } from "../../src/config.ts";
import { TaskerDoc } from "../../src/model/document.ts";
import { createServer } from "../../src/server.ts";
import {
  deleteTaskElement,
  projectName,
  removeFromProjects,
  removeRoot,
  withConfigEdit,
} from "../../src/tools/mutate.ts";
import { createToolContext, type RuntimeContext } from "../../src/tools/runtime.ts";

const PREFIX = "MCPTest.";
const LOOP = "MCPTest.Loop";
const LOOP2 = "MCPTest.Loop2";
const LOOP3 = "MCPTest.Loop3";
const RAW = "MCPTest.Raw";
const PROFILE = "MCPTest.Prof";
const PROJECT = "MCPTest.Proj";

function readToken(): string {
  const env = process.env["TASKER_TOKEN"];
  if (env !== undefined && env !== "") return env.trim();
  const file = process.env["TASKER_TOKEN_FILE"] ?? join(homedir(), ".tasker-mcp", "emulator-token");
  try {
    return readFileSync(file, "utf8").trim();
  } catch (e) {
    throw new Error(
      `device test: no token. Set TASKER_TOKEN or TASKER_TOKEN_FILE (tried ${file}): ${(e as Error).message}`,
      { cause: e },
    );
  }
}

let home: string;
let ctx: RuntimeContext;
let client: Client;
let closeServer: () => Promise<void>;

interface Res {
  isError: boolean;
  text: string;
  json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function callRaw(name: string, args: Record<string, unknown> = {}): Promise<Res> {
  const r = await client.callTool({ name, arguments: args });
  const text = (r.content as Array<{ text?: string }>).map((c) => c.text ?? "").join("\n");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { isError: r.isError === true, text, json };
}

/** Call a tool and fail the test with the tool's own message when it errors. */
async function call(name: string, args: Record<string, unknown> = {}): Promise<Res> {
  const r = await callRaw(name, args);
  if (r.isError) throw new Error(`${name} ${JSON.stringify(args)} failed: ${r.text}`);
  return r;
}

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "tasker-mcp-device-"));
  const config: Config = {
    url: (process.env["TASKER_URL"] ?? "http://localhost:1821").replace(/\/+$/, ""),
    token: readToken(),
    adbSerial: process.env["TASKER_ADB_SERIAL"],
    home,
    timeoutMs: 60_000,
    adbPath: process.env["TASKER_ADB"] ?? "adb",
    autoForward: false,
    policy: { allowConfigImport: true },
  };
  ctx = createToolContext(config);
  const server = createServer(ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "device-test", version: "0.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  closeServer = () => server.close();
  // Leftovers from an earlier aborted run would make create_task refuse.
  await cleanup();
});

/** Delete every MCPTest.* task, profile and project in one config import. */
async function cleanup(): Promise<void> {
  const { doc } = await ctx.backup();
  const has =
    doc.tasks().some((t) => TaskerDoc.nameOf(t).startsWith(PREFIX)) ||
    doc.profiles().some((p) => TaskerDoc.nameOf(p).startsWith(PREFIX)) ||
    doc.projects().some((p) => projectName(p).startsWith(PREFIX));
  if (!has) return;
  await withConfigEdit(ctx, "device-test", "cleanup MCPTest", (d) => {
    for (const p of d.profiles()) {
      if (!TaskerDoc.nameOf(p).startsWith(PREFIX)) continue;
      const id = TaskerDoc.idOf(p);
      removeRoot(d, p);
      if (id !== undefined) removeFromProjects(d, "pids", id);
    }
    for (const t of d.tasks()) {
      if (TaskerDoc.nameOf(t).startsWith(PREFIX)) deleteTaskElement(d, t);
    }
    for (const p of d.projects()) {
      if (projectName(p).startsWith(PREFIX)) removeRoot(d, p);
    }
  });
}

afterAll(async () => {
  try {
    await cleanup();
  } catch (e) {
    process.stderr.write(`device test cleanup failed: ${(e as Error).message}\n`);
  }
  await client?.close();
  await closeServer?.();
  await rm(home, { recursive: true, force: true });
});

// Tests in one file run in order; later ones build on earlier ones.
describe("core tools on a live Tasker", () => {
  it("pings the server and lists tasks", async () => {
    expect((await call("ping")).json).toMatchObject({ ok: true });
    const tasks = await call("list_tasks");
    const names = tasks.json.tasks.map((t: { name: string }) => t.name);
    expect(names).toContain("TaskerMCP.Dispatch");
  });

  it("creates a task from action names and verifies it", async () => {
    const r = await call("create_task", {
      name: LOOP,
      comment: "tasker-mcp device test",
      actions: [
        { action: "Variable Set", args: { Name: "%n", To: "%par1" } },
        { action: "If", condition: { conditions: [{ lhs: "%n", op: "eq", rhs: "go" }] } },
        { action: "Return", args: { Value: "went %n" } },
        { action: "End If" },
        { action: "Return", args: { Value: "%par1" } },
      ],
    });
    expect(r.json, r.text).toMatchObject({ ok: true, isNew: true, verified: true });
    expect(r.json.snapshot).toBeTruthy();
  });

  it("runs it and gets the Return value", async () => {
    expect((await call("run_task", { name: LOOP, par1: "go" })).json).toMatchObject({
      ok: true,
      return: "went go",
    });
    expect((await call("run_task", { name: LOOP, par1: "hello" })).json).toMatchObject({
      ok: true,
      return: "hello",
    });
  });

  it("splices an action in and reads it back", async () => {
    const r = await call("edit_task", {
      name: LOOP,
      patch: {
        splice: {
          index: 1,
          deleteCount: 0,
          insert: [{ action: "Variable Set", args: { Name: "%n", To: "%n!" } }],
        },
      },
    });
    expect(r.json, r.text).toMatchObject({ ok: true, isNew: false, verified: true });
    const got = (await call("get_task", { name: LOOP })).json;
    expect(got.actions.map((a: { code: number }) => a.code)).toEqual([547, 547, 37, 126, 38, 126]);
    expect(got.actions[1].args.find((a: { id: number }) => a.id === 1)).toMatchObject({
      value: "%n!",
    });
    // Before the splice "go" took the If branch ("went go"); now %n is "go!" so it falls through.
    expect((await call("run_task", { name: LOOP, par1: "go" })).json.return).toBe("go");
  });

  it("runs an ad-hoc action list", async () => {
    const r = await call("run_actions", {
      actions: [
        { action: "Flash", args: { Text: "tasker-mcp device test" } },
        { action: "Return", args: { Value: "adhoc-ok" } },
      ],
    });
    expect(r.json, r.text).toMatchObject({
      ok: true,
      return: "adhoc-ok",
      task: "TaskerMCP.Scratch",
    });
  });

  it("renames in place, then by import", async () => {
    const r = await call("rename", { kind: "task", from: LOOP, to: LOOP2 });
    expect(r.json, r.text).toMatchObject({ ok: true, verified: true });
    expect((await callRaw("get_task", { name: LOOP })).isError).toBe(true);
    expect((await call("get_task", { name: LOOP2 })).json.name).toBe(LOOP2);

    const e = await call("edit_task", { name: LOOP2, patch: { set: { name: LOOP3 } } });
    expect(e.json, e.text).toMatchObject({ ok: true, renamedFrom: LOOP2, verified: true });
    expect((await callRaw("get_task", { name: LOOP2 })).isError).toBe(true);
    expect((await call("run_task", { name: LOOP3, par1: "go" })).json.return).toBe("go");
  });

  it("returns the backup XML", async () => {
    const r = await call("get_backup_xml", { maxBytes: 5_000_000 });
    expect(r.json.truncated).toBe(false);
    expect(r.json.xml).toContain(LOOP3);
  });

  it("imports a raw task and runs it", async () => {
    const xml = `<Task sr="task9"><cdate>1</cdate><edate>1</edate><id>9</id><nme>${RAW}</nme>
<Action sr="act0" ve="7"><code>548</code><Str sr="arg0" ve="3">raw import</Str><Int sr="arg1" val="0"/></Action>
<Action sr="act1" ve="7"><code>126</code><Str sr="arg0" ve="3">raw-ok</Str><Int sr="arg1" val="1"/></Action>
</Task>`;
    const r = await call("import_xml", { xml });
    expect(r.json, r.text).toMatchObject({ ok: true, task: RAW, verified: true });
    expect((await call("run_task", { name: RAW })).json).toMatchObject({
      ok: true,
      return: "raw-ok",
    });
  });

  it("creates and deletes a profile with a Time context", async () => {
    const c = await call("create_profile", {
      name: PROFILE,
      contexts: [`<Time sr="con0"><fh>3</fh><fm>0</fm><th>3</th><tm>1</tm></Time>`],
      entryTask: RAW,
      enabled: false,
    });
    expect(c.json, c.text).toMatchObject({ ok: true, verified: true });
    const p = (await call("get_profile", { name: PROFILE })).json;
    expect(p).toMatchObject({ name: PROFILE, enabled: false, entryTask: RAW });
    expect(p.contexts[0].kind).toBe("Time");
    const d = await call("delete_profile", { name: PROFILE });
    expect(d.json, d.text).toMatchObject({ ok: true, verified: true });
    expect((await callRaw("get_profile", { name: PROFILE })).isError).toBe(true);
  });

  it("moves a task to a new project", async () => {
    const r = await call("move_to_project", { kind: "task", name: RAW, project: PROJECT });
    expect(r.json, r.text).toMatchObject({ ok: true, projectCreated: true, verified: true });
    const listed = (await call("list_tasks", { project: PROJECT })).json.tasks;
    expect(listed.map((t: { name: string }) => t.name)).toEqual([RAW]);
  });

  it("deletes tasks", async () => {
    for (const name of [RAW, LOOP3]) {
      const r = await call("delete_task", { name });
      expect(r.json, r.text).toMatchObject({ ok: true, verified: true });
    }
    const names = (await call("list_tasks")).json.tasks.map((t: { name: string }) => t.name);
    expect(names).not.toContain(RAW);
    expect(names).not.toContain(LOOP3);
  });
});
