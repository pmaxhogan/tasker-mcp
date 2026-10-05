/**
 * Shared test harness for tool modules: an in-memory "phone" plus a real
 * ToolContext (src/tools/runtime.ts) wired to it.
 *
 * Stable API (other test files import these):
 *
 *   const { ctx, phone, home, cleanup } = await createFakeContext(opts?);
 *   const t = await connectTools(ctx, [register]);   // or omit to register every module
 *   const r = await t.call("get_task", { name: "MCP.T1" });  // {isError, text, json}
 *   await t.close(); await cleanup();
 *
 * FakePhone keeps a TaskerDoc (`phone.doc`, `phone.xml()`) and mimics the
 * phone project's routes with the behaviour verified on Tasker 6.6.20:
 * - /import replaces a same-NAME task in place keeping its id; a new task
 *   lands in project "Base" (created if missing) whatever the XML says.
 *   `importMode: "sameId"` is "replace", except a new-name task keeps the
 *   payload's id even when another task has it (a rename payload carries the
 *   old task's id; the real phone may or may not keep it).
 *   `importMode: "duplicate"` instead appends a second copy (to exercise the
 *   duplicate cleanup path).
 * - /config replaces the whole document; waitForPing resolves at once.
 * - /run executes the named task with a tiny interpreter (Variable Set 547,
 *   Flash 548, Return 126, Stop 137, If 37 / Else 43 / End If 38); a missing
 *   task gives {ok: false, error: "no task named X"}. Override with `runner`.
 * - /vars/* use `phone.globals`; /profile toggles `<limit>`.
 * Every call is recorded in `phone.calls` as {route, body}.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Exec } from "../../src/adb.ts";
import {
  TaskerHttpError,
  type ListResult,
  type PingResult,
  type RunOptions,
  type RunResult,
  type TaskerClient,
} from "../../src/client/index.ts";
import type { Config } from "../../src/config.ts";
import { DocsStore } from "../../src/docs/index.ts";
import { parseIdList } from "../../src/model/convert.ts";
import { TaskerDoc } from "../../src/model/document.ts";
import { createServer } from "../../src/server.ts";
import { SnapshotStore } from "../../src/snapshots.ts";
import { getSpec } from "../../src/spec/table.ts";
import type { RegisterTools, WritePolicy } from "../../src/tools/context.ts";
import { createToolContext, type RuntimeContext } from "../../src/tools/runtime.ts";
import {
  attr,
  child,
  childText,
  children,
  cloneNode,
  createElement,
  elementText,
  insertChildElement,
  removeChild,
  setAttr,
  setChildText,
  type XmlElement,
} from "../../src/xml/index.ts";

export const FIXTURE_BACKUP = new URL("../fixtures/emulator/taskermcp-backup.xml", import.meta.url);

/** The emulator backup fixture: Base + TaskerMCP projects, one profile, tasks MCP.T1 and TaskerMCP.*. */
export function fixtureBackupXml(): string {
  return readFileSync(FIXTURE_BACKUP, "utf8");
}

/** A minimal backup: a Base project with no tasks. */
export const EMPTY_BACKUP = `<TaskerData sr="" dvi="1" tv="6.6.20">
\t<Project sr="proj0" ve="2">
\t\t<cdate>1</cdate>
\t\t<name>Base</name>
\t</Project>
</TaskerData>
`;

/**
 * A small backup with a scene: Base holds task MCP.T1 (id 45, calls
 * TaskerMCP.Debug) and scene "Pop" whose button runs task 45; TaskerMCP holds
 * profile "TaskerMCP HTTP" (entry 58) and tasks 58, 59, 60.
 */
export const SCENE_BACKUP = `<TaskerData sr="" dvi="1" tv="6.6.20">
\t<Profile sr="prof61" ve="2">
\t\t<id>61</id>
\t\t<mid0>58</mid0>
\t\t<nme>TaskerMCP HTTP</nme>
\t\t<Time sr="con0"><fh>7</fh></Time>
\t</Profile>
\t<Project sr="proj0" ve="2">
\t\t<name>Base</name>
\t\t<scenes>Pop</scenes>
\t\t<tids>45</tids>
\t</Project>
\t<Project sr="proj1" ve="2">
\t\t<name>TaskerMCP</name>
\t\t<pids>61</pids>
\t\t<tids>58,59,60</tids>
\t</Project>
\t<Scene sr="scenePop">
\t\t<nme>Pop</nme>
\t\t<ButtonElement sr="elements0">
\t\t\t<clickTask>45</clickTask>
\t\t</ButtonElement>
\t</Scene>
\t<Task sr="task45">
\t\t<id>45</id>
\t\t<nme>MCP.T1</nme>
\t\t<Action sr="act0" ve="7">
\t\t\t<code>130</code>
\t\t\t<Str sr="arg0" ve="3">TaskerMCP.Debug</Str>
\t\t\t<Int sr="arg1" val="0"/>
\t\t</Action>
\t</Task>
\t<Task sr="task58">
\t\t<id>58</id>
\t\t<nme>TaskerMCP.Dispatch</nme>
\t</Task>
\t<Task sr="task59">
\t\t<id>59</id>
\t\t<nme>TaskerMCP.Setup</nme>
\t</Task>
\t<Task sr="task60">
\t\t<id>60</id>
\t\t<nme>TaskerMCP.Debug</nme>
\t</Task>
</TaskerData>
`;

export type FakeRunner = (phone: FakePhone, opts: RunOptions) => RunResult | Promise<RunResult>;

export interface FakeCall {
  route: string;
  body?: unknown;
}

export interface FakePhoneOptions {
  xml?: string;
  importMode?: "replace" | "duplicate" | "sameId";
  runner?: FakeRunner;
}

function argEl(action: XmlElement, id: number): XmlElement | undefined {
  return children(action).find((c) => attr(c, "sr") === `arg${id}`);
}

function argStr(action: XmlElement, id: number): string {
  const el = argEl(action, id);
  if (el === undefined) return "";
  if (el.name === "Int") {
    const v = attr(el, "val");
    if (v !== undefined) return v;
    const vv = child(el, "var");
    return vv === undefined ? "" : elementText(vv);
  }
  return elementText(el);
}

/** The phone side, in memory. Methods mirror TaskerClient. */
export class FakePhone {
  doc: TaskerDoc;
  readonly calls: FakeCall[] = [];
  readonly globals = new Map<string, string>();
  readonly flashes: string[] = [];
  readonly stopped: string[] = [];
  importMode: "replace" | "duplicate" | "sameId";
  runner: FakeRunner;
  token = "fake-token";

  constructor(opts: FakePhoneOptions = {}) {
    this.doc = TaskerDoc.parse(opts.xml ?? fixtureBackupXml());
    this.importMode = opts.importMode ?? "replace";
    this.runner = opts.runner ?? defaultRunner;
  }

  xml(): string {
    return this.doc.serialize();
  }

  /** Route names of every call so far, e.g. ["/backup", "/import"]. */
  routes(): string[] {
    return this.calls.map((c) => c.route);
  }

  /** This phone as a TaskerClient (structurally; only the used methods exist). */
  client(): TaskerClient {
    return this as unknown as TaskerClient;
  }

  async ping(): Promise<PingResult> {
    this.calls.push({ route: "/ping" });
    return { ok: true, tasker: "6.6.20", project: "TaskerMCP", device: "fake" };
  }

  async waitForPing(): Promise<PingResult> {
    return this.ping();
  }

  async backup(): Promise<string> {
    this.calls.push({ route: "/backup" });
    return this.xml();
  }

  async list(): Promise<ListResult> {
    this.calls.push({ route: "/list" });
    const s = this.doc.summary();
    return {
      projects: s.projects.map((p) => p.name),
      profiles: s.profiles.map((p) => p.name),
      tasks: s.tasks.map((t) => t.name),
      scenes: s.scenes.map((x) => x.name),
      globals: [...this.globals.keys()],
    };
  }

  private baseProject(): XmlElement {
    let base = this.doc.projectByName("Base");
    if (base === undefined) {
      base = createElement("Project", { sr: `proj${this.doc.projects().length}`, ve: "2" }, []);
      setChildText(base, "name", "Base");
      insertChildElement(this.doc.root, base);
    }
    return base;
  }

  async importXml(xml: string): Promise<{ ok: boolean }> {
    this.calls.push({ route: "/import", body: xml });
    let incoming: TaskerDoc;
    try {
      incoming = TaskerDoc.parse(xml);
    } catch (e) {
      throw new TaskerHttpError({
        status: 500,
        route: "/import",
        body: "",
        hint: `the phone reported an error: ${(e as Error).message}`,
      });
    }
    for (const t of incoming.tasks()) {
      const el = cloneNode(t);
      const name = TaskerDoc.nameOf(el);
      const existing = this.importMode !== "duplicate" ? this.doc.taskByName(name) : undefined;
      if (existing !== undefined) {
        const id = TaskerDoc.idOf(existing) as number;
        setChildText(el, "id", String(id));
        setAttr(el, "sr", `task${id}`);
        const kids = this.doc.root.children;
        kids[kids.indexOf(existing)] = el;
        continue;
      }
      let id = TaskerDoc.idOf(el);
      const taken = id !== undefined && this.doc.taskById(id) !== undefined;
      if (id === undefined || (taken && this.importMode !== "sameId")) id = this.doc.nextFreeId();
      setChildText(el, "id", String(id));
      setAttr(el, "sr", `task${id}`);
      insertChildElement(this.doc.root, el);
      const base = this.baseProject();
      const tids = parseIdList(childText(base, "tids"));
      tids.push(id);
      setChildText(base, "tids", tids.join(","));
    }
    return { ok: true };
  }

  async replaceConfig(xml: string): Promise<{ ok: boolean; restarting: boolean }> {
    this.calls.push({ route: "/config", body: xml });
    this.doc = TaskerDoc.parse(xml);
    return { ok: true, restarting: true };
  }

  async run(opts: RunOptions): Promise<RunResult> {
    this.calls.push({ route: "/run", body: opts });
    return this.runner(this, opts);
  }

  async stop(task: string): Promise<{ ok: boolean }> {
    this.calls.push({ route: "/stop", body: { task } });
    this.stopped.push(task);
    return { ok: true };
  }

  async getVar(name: string): Promise<{ name: string; value?: string; set: boolean }> {
    this.calls.push({ route: "/vars/get", body: { name } });
    const v = this.globals.get(name.replace(/^%/, ""));
    return v === undefined ? { name, set: false } : { name, value: v, set: true };
  }

  async setVar(name: string, value: string): Promise<{ ok: boolean }> {
    this.calls.push({ route: "/vars/set", body: { name, value } });
    this.globals.set(name.replace(/^%/, ""), value);
    return { ok: true };
  }

  async listVars(): Promise<{ globals: string[] }> {
    this.calls.push({ route: "/vars/list" });
    return { globals: [...this.globals.keys()] };
  }

  async setProfileEnabled(name: string, enabled: boolean): Promise<{ ok: boolean }> {
    this.calls.push({ route: "/profile", body: { name, enabled } });
    const p = this.doc.profileByName(name);
    if (p === undefined) {
      throw new TaskerHttpError({
        status: 404,
        route: "/profile",
        body: '{"error":"no profile"}',
        hint: "no profile",
      });
    }
    const limit = child(p, "limit");
    if (enabled) {
      if (limit !== undefined) removeChild(p, limit);
    } else {
      setChildText(p, "limit", "true");
    }
    return { ok: true };
  }

  async command(command: string): Promise<{ ok: boolean }> {
    this.calls.push({ route: "/command", body: { command } });
    return { ok: true };
  }

  async runLog(): Promise<string> {
    this.calls.push({ route: "/runlog" });
    throw new TaskerHttpError({ status: 501, route: "/runlog", body: "", hint: "no run log" });
  }

  setToken(token: string): void {
    this.token = token;
  }

  async rotateToken(): Promise<{ token: string }> {
    this.calls.push({ route: "/token/rotate" });
    this.token = `rotated-${this.calls.length}`;
    return { token: this.token };
  }
}

// ---------------------------------------------------------------------------
// The default task runner
// ---------------------------------------------------------------------------

function substitute(s: string, locals: Map<string, string>, globals: Map<string, string>): string {
  return s.replace(/%([A-Za-z_][A-Za-z0-9_]*)/g, (m, name: string) => {
    const lower = name.toLowerCase() === name;
    const v = lower ? locals.get(name) : globals.get(name);
    return v ?? m;
  });
}

function evalCondition(
  action: XmlElement,
  locals: Map<string, string>,
  globals: Map<string, string>,
): boolean {
  const list = children(action).find((c) => c.name === "ConditionList");
  if (list === undefined) return true;
  const conds = children(list, "Condition").sort((a, b) =>
    (attr(a, "sr") ?? "").localeCompare(attr(b, "sr") ?? ""),
  );
  const joins = children(list)
    .filter((c) => /^bool\d+$/.test(c.name))
    .map((c) => elementText(c).toLowerCase());
  let result: boolean | undefined;
  conds.forEach((c, i) => {
    const rawLhs = childText(c, "lhs") ?? "";
    const lhs = substitute(rawLhs, locals, globals);
    const rhs = substitute(childText(c, "rhs") ?? "", locals, globals);
    const op = Number(childText(c, "op"));
    let v: boolean;
    switch (op) {
      case 0:
        v = lhs === rhs;
        break;
      case 1:
        v = lhs !== rhs;
        break;
      case 2:
        v = new RegExp(`^${rhs.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(
          lhs,
        );
        break;
      case 6:
        v = Number(lhs) < Number(rhs);
        break;
      case 7:
        v = Number(lhs) > Number(rhs);
        break;
      case 8:
        v = Number(lhs) === Number(rhs);
        break;
      case 12:
        v = lhs !== rawLhs || !rawLhs.startsWith("%");
        break;
      case 13:
        v = lhs === rawLhs && rawLhs.startsWith("%");
        break;
      default:
        v = false;
    }
    if (result === undefined) result = v;
    else result = joins[i - 1] === "or" ? result || v : result && v;
  });
  return result ?? true;
}

/** Interprets Variable Set, Flash, Return, Stop, If / Else / End If. */
export const defaultRunner: FakeRunner = (phone, opts) => {
  const task = phone.doc.taskByName(opts.task);
  if (task === undefined) return { ok: false, error: `no task named ${opts.task}`, durationMs: 1 };
  const locals = new Map<string, string>();
  if (opts.par1 !== undefined && opts.par1 !== "") locals.set("par1", opts.par1);
  if (opts.par2 !== undefined && opts.par2 !== "") locals.set("par2", opts.par2);
  for (const [k, v] of Object.entries(opts.variables ?? {})) locals.set(k.replace(/^%/, ""), v);
  const debug: string[] = [];
  const actions = children(task, "Action").sort(
    (a, b) =>
      Number((attr(a, "sr") ?? "act0").slice(3)) - Number((attr(b, "sr") ?? "act0").slice(3)),
  );
  // Each open If: whether its parent runs, and whether a branch was taken.
  const stack: Array<{ parentRuns: boolean; taken: boolean; runs: boolean }> = [];
  const running = (): boolean => stack.every((s) => s.runs);
  for (const a of actions) {
    const code = Number(childText(a, "code"));
    if (code === 37) {
      const parentRuns = running();
      const c = parentRuns && evalCondition(a, locals, phone.globals);
      stack.push({ parentRuns, taken: c, runs: c });
      continue;
    }
    if (code === 43) {
      const top = stack[stack.length - 1];
      if (top !== undefined) {
        const hasCond = children(a).some((c) => c.name === "ConditionList");
        const c =
          top.parentRuns && !top.taken && (!hasCond || evalCondition(a, locals, phone.globals));
        top.runs = c;
        if (c) top.taken = true;
      }
      continue;
    }
    if (code === 38) {
      stack.pop();
      continue;
    }
    if (!running()) continue;
    if (childText(a, "on") === "false") continue;
    if (!evalCondition(a, locals, phone.globals)) continue;
    if (opts.debug) debug.push(`code ${code}`);
    switch (code) {
      case 547: {
        const name = argStr(a, 0).replace(/^%/, "");
        const value = substitute(argStr(a, 1), locals, phone.globals);
        if (name.toLowerCase() === name) locals.set(name, value);
        else phone.globals.set(name, value);
        break;
      }
      case 548:
        phone.flashes.push(substitute(argStr(a, 0), locals, phone.globals));
        break;
      case 126: {
        const r: RunResult = {
          ok: true,
          return: substitute(argStr(a, 0), locals, phone.globals),
          durationMs: 5,
        };
        if (opts.debug) r.debug = debug;
        return r;
      }
      case 137:
        return { ok: true, durationMs: 5 };
      default:
        break;
    }
  }
  const r: RunResult = { ok: true, durationMs: 5 };
  if (opts.debug) r.debug = debug;
  return r;
};

// ---------------------------------------------------------------------------
// Context and MCP client
// ---------------------------------------------------------------------------

export interface FakeContextOptions extends FakePhoneOptions {
  policy?: WritePolicy;
  /** Merged over the default test config (url http://fake:1821, token "fake-token"). */
  config?: Partial<Config>;
  exec?: Exec;
  /** Use an existing phone instead of creating one. */
  phone?: FakePhone;
}

export interface FakeContext {
  ctx: RuntimeContext;
  phone: FakePhone;
  /** Temp state dir (snapshots, docs cache). */
  home: string;
  /** How many times ctx.toolsChanged() was called. */
  toolsChangedCount(): number;
  cleanup(): Promise<void>;
}

const offlineFetch: typeof fetch = async () => {
  throw new Error("offline (test)");
};

export async function createFakeContext(opts: FakeContextOptions = {}): Promise<FakeContext> {
  const home = await mkdtemp(join(tmpdir(), "tasker-mcp-test-"));
  const phone = opts.phone ?? new FakePhone(opts);
  const config: Config = {
    url: "http://fake:1821",
    token: "fake-token",
    adbSerial: undefined,
    home,
    timeoutMs: 1000,
    adbPath: "adb",
    autoForward: false,
    autoPersist: false,
    policy: opts.policy ?? { allowConfigImport: true },
    ...opts.config,
  };
  if (opts.policy !== undefined) config.policy = opts.policy;
  let changed = 0;
  const ctx = createToolContext(config, {
    client: phone.client(),
    spec: getSpec(),
    snapshots: new SnapshotStore(join(home, "snapshots"), { keep: 20 }),
    docs: new DocsStore({ home, fetch: offlineFetch }),
    exec:
      opts.exec ?? (async () => ({ stdout: "", stderr: "exec not available in tests", code: 1 })),
    pingIntervalMs: 1,
    onToolsChanged: () => {
      changed++;
    },
  });
  return {
    ctx,
    phone,
    home,
    toolsChangedCount: () => changed,
    cleanup: () => rm(home, { recursive: true, force: true }),
  };
}

export interface CallResult {
  isError: boolean;
  text: string;
  /** Parsed JSON of the text, or undefined when it is not JSON. */
  json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface ToolHarness {
  client: Client;
  server: McpServer;
  call(name: string, args?: Record<string, unknown>): Promise<CallResult>;
  /** Names of the registered tools. */
  toolNames(): Promise<string[]>;
  close(): Promise<void>;
}

/**
 * Connect an MCP client to a server built over `ctx`. With `registers`, only
 * those modules (plus nothing else) are registered; without, createServer
 * registers ping and every module in TOOL_MODULES.
 */
export async function connectTools(
  ctx: RuntimeContext,
  registers?: RegisterTools[],
): Promise<ToolHarness> {
  let server: McpServer;
  if (registers === undefined) {
    server = createServer(ctx);
  } else {
    server = new McpServer(
      { name: "tasker-mcp-test", version: "0.0.0" },
      { capabilities: { tools: { listChanged: true } } },
    );
    for (const r of registers) r(server, ctx);
  }
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return {
    client,
    server,
    async call(name, args = {}) {
      const res = await client.callTool({ name, arguments: args });
      const content = res.content as Array<{ type: string; text?: string }>;
      const text = content.map((c) => c.text ?? "").join("\n");
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
      return { isError: res.isError === true, text, json };
    },
    async toolNames() {
      const r = await client.listTools();
      return r.tools.map((t) => t.name);
    },
    async close() {
      await client.close();
      await server.close();
    },
  };
}
