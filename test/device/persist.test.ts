/**
 * Live test of persist_config against a real Tasker (emulator): a task made
 * over the API survives a force-stop of Tasker only after persist_config.
 * Run with `npm run test:device`; never part of `npm test`.
 *
 * Env: TASKER_URL (default http://localhost:1821), TASKER_TOKEN or
 * TASKER_TOKEN_FILE (default ~/.tasker-mcp/emulator-token), TASKER_ADB_SERIAL
 * (default emulator-5554, so a forgotten serial never lands on a real phone),
 * TASKER_ADB. It force-stops Tasker and drives its editor, so never point it
 * at a real phone.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultExec } from "../../src/adb.ts";
import type { Config } from "../../src/config.ts";
import { UiDriver } from "../../src/device/ui.ts";
import { createServer } from "../../src/server.ts";
import { PERSIST_HINT, TASKER_PACKAGE } from "../../src/tools/persist.ts";
import { createToolContext, type RuntimeContext } from "../../src/tools/runtime.ts";

const TASK = "MCPTest.Persist";
const LOST = "MCPTest.PersistLost";
const SERIAL = process.env["TASKER_ADB_SERIAL"] ?? "emulator-5554";
const ADB = process.env["TASKER_ADB"] ?? "adb";

function readToken(): string {
  const env = process.env["TASKER_TOKEN"];
  if (env !== undefined && env !== "") return env.trim();
  const file = process.env["TASKER_TOKEN_FILE"] ?? join(homedir(), ".tasker-mcp", "emulator-token");
  return readFileSync(file, "utf8").trim();
}

let home: string;
let ctx: RuntimeContext;
let client: Client;
let closeServer: () => Promise<void>;
const ui = new UiDriver({ exec: defaultExec, adbPath: ADB, serial: SERIAL });

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

async function call(name: string, args: Record<string, unknown> = {}): Promise<Res> {
  const r = await callRaw(name, args);
  if (r.isError) throw new Error(`${name} ${JSON.stringify(args)} failed: ${r.text}`);
  return r;
}

async function taskNames(): Promise<string[]> {
  const r = await call("list_tasks");
  return r.json.tasks.map((t: { name: string }) => t.name);
}

/** Force-stop Tasker, start it again, and wait until its HTTP server answers. */
async function restartTasker(): Promise<void> {
  await ui.shell("am", "force-stop", TASKER_PACKAGE);
  await ui.sleep(1500);
  await ui.shell("am", "start", "-n", `${TASKER_PACKAGE}/.Tasker`);
  await ui.waitFor("desc:More options", 30_000, (nodes) => ui.dismissNag(nodes));
  await ui.key("HOME");
  await ui.adb(["forward", "tcp:1821", "tcp:1821"]);
  await (await ctx.client()).waitForPing({ timeoutMs: 60_000, intervalMs: 1000 });
}

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "tasker-mcp-device-"));
  const config: Config = {
    url: (process.env["TASKER_URL"] ?? "http://localhost:1821").replace(/\/+$/, ""),
    token: readToken(),
    adbSerial: SERIAL,
    home,
    timeoutMs: 60_000,
    adbPath: ADB,
    autoForward: false,
    autoPersist: false,
    policy: { allowConfigImport: true },
  };
  ctx = createToolContext(config);
  const server = createServer(ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "device-test", version: "0.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  closeServer = () => server.close();
  await removeLeftovers();
});

/** Delete TASK and LOST when present, and persist that. */
async function removeLeftovers(): Promise<void> {
  const names = await taskNames();
  const left = [TASK, LOST].filter((n) => names.includes(n));
  for (const n of left) await call("delete_task", { name: n });
  if (left.length > 0) await call("persist_config");
}

afterAll(async () => {
  try {
    await removeLeftovers();
  } catch (e) {
    process.stderr.write(`device test cleanup failed: ${(e as Error).message}\n`);
  }
  await client?.close();
  await closeServer?.();
  await rm(home, { recursive: true, force: true });
});

describe("persist_config on a live Tasker", () => {
  it("without persist_config a created task is lost when Tasker restarts", async () => {
    await call("create_task", {
      name: LOST,
      actions: [{ action: "Flash", args: { Text: "lost" } }],
    });
    expect(await taskNames()).toContain(LOST);
    await restartTasker();
    expect(await taskNames()).not.toContain(LOST);
  });

  it("a created task survives a Tasker force-stop after persist_config", async () => {
    const created = await call("create_task", {
      name: TASK,
      actions: [{ action: "Flash", args: { Text: "persist" } }],
    });
    expect(created.json).toMatchObject({
      ok: true,
      verified: true,
      persisted: false,
      persistHint: PERSIST_HINT,
    });

    const p = await call("persist_config");
    expect(p.json.persisted).toBe(true);
    expect(p.json.durationMs).toBeGreaterThan(0);
    process.stderr.write(`persist_config took ${p.json.durationMs} ms\n`);

    await restartTasker();
    expect(await taskNames()).toContain(TASK);
  });

  it("a deletion survives a restart after persist_config", async () => {
    const del = await call("delete_task", { name: TASK });
    expect(del.json).toMatchObject({ ok: true, persisted: false });
    await call("persist_config");
    await restartTasker();
    expect(await taskNames()).not.toContain(TASK);
  });
});
