import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Exec } from "../../src/adb.ts";
import type { Config } from "../../src/config.ts";
import { DocsStore } from "../../src/docs/index.ts";
import { SnapshotStore } from "../../src/snapshots.ts";
import { getSpec } from "../../src/spec/table.ts";
import { ToolError } from "../../src/tools/context.ts";
import {
  checkWritable,
  createToolContext,
  describePolicy,
  TOKEN_HINT,
} from "../../src/tools/runtime.ts";
import { connectTools, createFakeContext, EMPTY_BACKUP } from "./fake-context.ts";

let home: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "tasker-mcp-rt-"));
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

function config(over: Partial<Config> = {}): Config {
  return {
    url: "http://phone.lan:1821",
    token: "tok",
    adbSerial: undefined,
    home,
    timeoutMs: 1000,
    adbPath: "adb",
    autoForward: false,
    autoPersist: false,
    policy: { allowConfigImport: true },
    ...over,
  };
}

interface Seen {
  method: string;
  url: string;
  body?: string;
}

/** A fetch that answers like the phone project. */
function phoneFetch(seen: Seen[], backup = EMPTY_BACKUP): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    seen.push({ method: init?.method ?? "GET", url, body: init?.body as string | undefined });
    if (url.endsWith("/backup")) return new Response(backup, { status: 200 });
    if (url.endsWith("/config"))
      return new Response('{"ok":true,"restarting":true}', { status: 202 });
    if (url.endsWith("/ping")) {
      return new Response('{"ok":true,"tasker":"6.6.20","project":"TaskerMCP","device":"x"}');
    }
    return new Response('{"error":"nope"}', { status: 404 });
  }) as typeof fetch;
}

describe("checkWritable", () => {
  it("allows everything without a prefix list", () => {
    expect(() => checkWritable({ allowConfigImport: true }, "task", "Any")).not.toThrow();
  });

  it("enforces prefixes per kind", () => {
    const p = { allowPrefixes: ["MCPTest.", "%Mcp"], allowConfigImport: false };
    expect(() => checkWritable(p, "task", "MCPTest.A")).not.toThrow();
    expect(() => checkWritable(p, "variable", "%McpX")).not.toThrow();
    expect(() => checkWritable(p, "variable", "McpX")).not.toThrow();
    let err: unknown;
    try {
      checkWritable(p, "profile", "Other");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ToolError);
    expect((err as ToolError).message).toContain('Write to profile "Other" refused');
    expect((err as ToolError).hint).toContain("TASKER_WRITE_ALLOW");
  });

  it("guards config imports", () => {
    expect(() => checkWritable({ allowConfigImport: false }, "config", "delete x")).toThrow(
      /\(delete x\), which is disabled/,
    );
    expect(() => checkWritable({ allowConfigImport: false }, "config", "")).toThrow(/disabled/);
    expect(() => checkWritable({ allowConfigImport: true }, "config", "")).not.toThrow();
  });

  it("describes the policy", () => {
    expect(describePolicy({ allowConfigImport: true })).toBe("config imports allowed");
    expect(describePolicy({ allowPrefixes: ["A", "B"], allowConfigImport: false })).toBe(
      "writes are limited to names starting with A, B; config imports disabled",
    );
  });
});

describe("createToolContext", () => {
  it("needs a token, and retries after a failure", async () => {
    const ctx = createToolContext(config({ token: undefined }));
    const err = await ctx.client().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect((err as ToolError).message).toBe("No Tasker token configured");
    expect((err as ToolError).hint).toBe(TOKEN_HINT);
    // Not cached: a second call tries again (and fails again the same way).
    await expect(ctx.client()).rejects.toThrow("No Tasker token configured");
  });

  it("talks to a URL without adb", async () => {
    const seen: Seen[] = [];
    const ctx = createToolContext(config({ adbSerial: "S9" }), { fetch: phoneFetch(seen) });
    expect(await ctx.serial()).toBe("S9");
    const c1 = await ctx.client();
    expect(await ctx.client()).toBe(c1);
    const b = await ctx.backup();
    expect(b.doc.projects()).toHaveLength(1);
    expect(seen[0]).toMatchObject({ method: "GET", url: "http://phone.lan:1821/backup" });
    const snap = await ctx.snapshot("test_tool", "before x");
    expect(snap.info).toMatchObject({ tool: "test_tool", label: "before x", device: "S9" });
    expect((await ctx.snapshots.list())[0]?.id).toBe(snap.info.id);
    expect(ctx.snapshots.dir).toBe(join(home, "snapshots"));
    expect(ctx.docs).toBeInstanceOf(DocsStore);
    expect(ctx.spec).toBe(getSpec());
    expect(ctx.policy).toEqual({ allowConfigImport: true });
  });

  it("uses the URL host as the snapshot device when there is no serial", async () => {
    const ctx = createToolContext(config(), { fetch: phoneFetch([]) });
    expect(await ctx.serial()).toBeUndefined();
    expect((await ctx.snapshot("t", "l")).info.device).toBe("phone.lan:1821");
  });

  it("forwards over adb when there is no URL", async () => {
    const calls: string[][] = [];
    const exec: Exec = async (_file, args) => {
      calls.push(args);
      if (args[0] === "devices") {
        return {
          stdout: "List of devices attached\nemu-5554 device model:x\n",
          stderr: "",
          code: 0,
        };
      }
      return { stdout: "", stderr: "", code: 0 };
    };
    const seen: Seen[] = [];
    const ctx = createToolContext(config({ url: undefined, autoForward: true }), {
      exec,
      fetch: phoneFetch(seen),
    });
    expect(await ctx.serial()).toBe("emu-5554");
    expect(calls).toContainEqual(["-s", "emu-5554", "forward", "tcp:1821", "tcp:1821"]);
    await ctx.backup();
    expect(seen[0]?.url).toBe("http://localhost:1821/backup");
    expect((await ctx.snapshot("t", "l")).info.device).toBe("emu-5554");
    expect(await ctx.serial()).toBe("emu-5554");
  });

  it("surfaces adb failures without caching them", async () => {
    let n = 0;
    const exec: Exec = async () => {
      n++;
      return { stdout: "List of devices attached\n", stderr: "", code: 0 };
    };
    const ctx = createToolContext(config({ url: undefined, autoForward: true }), { exec });
    await expect(ctx.client()).rejects.toThrow(/No adb devices found/);
    await expect(ctx.serial()).rejects.toThrow(/No adb devices found/);
    expect(n).toBe(2);
  });

  it("rejects a backup that is not TaskerData", async () => {
    const ctx = createToolContext(config(), { fetch: phoneFetch([], "<html/>") });
    await expect(ctx.backup()).rejects.toThrow(/not a Tasker configuration/);
  });

  it("replaces the config and waits for the phone", async () => {
    const seen: Seen[] = [];
    const ctx = createToolContext(config(), { fetch: phoneFetch(seen), pingIntervalMs: 1 });
    await ctx.replaceConfig(EMPTY_BACKUP);
    expect(seen.map((s) => `${s.method} ${new URL(s.url).pathname}`)).toEqual([
      "POST /config",
      "GET /ping",
    ]);
    const locked = createToolContext(config({ policy: { allowConfigImport: false } }), {
      fetch: phoneFetch([]),
    });
    await expect(locked.replaceConfig(EMPTY_BACKUP)).rejects.toThrow(/disabled/);
    expect(() => locked.assertWritable("config", "x")).toThrow(ToolError);
    expect(() => locked.assertWritable("task", "x")).not.toThrow();
  });

  it("calls the toolsChanged hook and survives it throwing", () => {
    let n = 0;
    const ctx = createToolContext(config(), {
      onToolsChanged: () => n++,
      client: {} as never,
      spec: getSpec(),
      snapshots: new SnapshotStore(join(home, "s")),
      docs: new DocsStore({ home }),
    });
    ctx.toolsChanged();
    expect(n).toBe(1);
    ctx.onToolsChanged(() => {
      throw new Error("x");
    });
    expect(() => ctx.toolsChanged()).not.toThrow();
    ctx.onToolsChanged(undefined);
    ctx.toolsChanged();
  });

  it("uses an injected client", async () => {
    const fake = { backup: async () => EMPTY_BACKUP } as never;
    const ctx = createToolContext(config({ token: undefined }), { client: fake });
    expect(await ctx.client()).toBe(fake);
    expect((await ctx.snapshot("t", "l")).info.device).toBe("phone.lan:1821");
  });
});

describe("full server", () => {
  it("registers every core tool with an example and annotations", async () => {
    const f = await createFakeContext();
    const h = await connectTools(f.ctx);
    const { tools } = await h.client.listTools();
    const names = tools.map((x) => x.name);
    for (const n of [
      "list_projects",
      "list_tasks",
      "list_profiles",
      "list_scenes",
      "get_task",
      "get_profile",
      "get_project",
      "create_task",
      "edit_task",
      "delete_task",
      "create_profile",
      "edit_profile",
      "delete_profile",
      "move_to_project",
      "rename",
      "get_backup_xml",
      "get_task_xml",
      "get_profile_xml",
      "get_project_xml",
      "get_scene_xml",
      "import_xml",
      "run_task",
      "run_actions",
      "stop_task",
    ]) {
      expect(names).toContain(n);
      const tool = tools.find((x) => x.name === n)!;
      expect(tool.description, n).toContain(`Example: ${n} {`);
      expect(tool.annotations?.readOnlyHint, n).toBeTypeOf("boolean");
      expect(tool.annotations?.destructiveHint, n).toBeTypeOf("boolean");
      expect(tool.annotations?.idempotentHint, n).toBeTypeOf("boolean");
    }
    await h.close();
    await f.cleanup();
  });
});
