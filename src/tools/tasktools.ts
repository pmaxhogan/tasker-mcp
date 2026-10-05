/**
 * Per-task tools (the dceluis/tasker-mcp convention): Tasker tasks the user
 * marks become MCP tools of their own.
 *
 * Convention:
 * - A task is exposed when its comment (`<pc>`, the task's description in
 *   Tasker) contains the tag `#mcp`. The rest of the comment, tag removed,
 *   is the tool description.
 * - Tool name: `tasker_` + the task name lower cased, every run of
 *   characters outside [a-z0-9_] replaced by one `_`, at most 64 characters.
 *   Collisions get `_2`, `_3`, ... in task id order, so a task keeps its name
 *   across refreshes.
 * - Arguments come from the task's Task Variables (`<ProfileVariable>`
 *   children with `pvit` "t") that are Immutable and not Configure on Import
 *   (`immutable` true, `pvci` false), as in dceluis's project. The name is
 *   `pvn` without `%`, the description is the Prompt (`pvd`), and the type is
 *   from `pvt`: "n" -> number, "onoff" -> boolean, anything else -> string.
 *   Arguments are optional unless the prompt contains "(required)".
 * - Calling the tool runs the task (POST /run) with the arguments both as
 *   JSON in %par1 and as passed-through local variables (lower case names,
 *   values stringified), and returns the run result:
 *   {ok, return?, durationMs, error?}.
 * - Immutable Task Variables are NOT overwritten by passthrough (verified on
 *   Tasker 6.6.20), so the task must start with dceluis's `MCP#parse_args`
 *   JavaScriptlet, which copies the %par1 JSON into locals with setLocal.
 *   PARSE_ARGS_JS below is that action's code.
 *
 * The phone is never contacted during register(): the first discovery runs in
 * the background shortly after startup and failures only go to stderr.
 * refresh_tools re-reads the backup on demand and sends listChanged when the
 * set of tools changed.
 */
import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { log } from "../log.ts";
import { TaskerDoc } from "../model/document.ts";
import { childText, children, type XmlElement } from "../xml/index.ts";
import { handler, ok, type ToolContext } from "./context.ts";

/**
 * The first action of a per-task tool (a JavaScriptlet labelled
 * MCP#parse_args, conditioned on %par1 being set): turns the JSON arguments
 * in %par1 into local variables.
 */
export const PARSE_ARGS_JS = `const args = JSON.parse(local('par1'));
for (const name in args) {
  setLocal(name, args[name]);
}
exit();`;

export const TOOL_PREFIX = "tasker_";
export const MAX_TOOL_NAME = 64;
export const DEFAULT_INITIAL_DELAY_MS = 1500;

const TAG_RE = /#mcp(?![a-z0-9_])/gi;
const LOCAL_RE = /^[a-z][a-z0-9_]*$/;

export type TaskArgType = "number" | "boolean" | "string";

export interface TaskToolArg {
  /** Argument name as the agent sees it: `pvn` without `%`. */
  name: string;
  /** Local variable name sent to /run (lower case). */
  variable: string;
  type: TaskArgType;
  required: boolean;
  description?: string;
}

export interface TaskToolDef {
  tool: string;
  task: string;
  taskId?: number;
  description: string;
  args: TaskToolArg[];
}

export function hasMcpTag(comment: string | undefined): boolean {
  return comment !== undefined && new RegExp(TAG_RE.source, "i").test(comment);
}

/** The comment without the `#mcp` tag, whitespace tidied. */
export function stripMcpTag(comment: string): string {
  return comment
    .replace(TAG_RE, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** `tasker_<name>` per the convention, unique against `taken` (which it extends). */
export function mangleToolName(taskName: string, taken: Set<string>, fallback = "task"): string {
  const core = taskName
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = (TOOL_PREFIX + (core === "" ? fallback : core)).slice(0, MAX_TOOL_NAME);
  let name = base;
  for (let n = 2; taken.has(name); n++) {
    const suffix = `_${n}`;
    name = base.slice(0, MAX_TOOL_NAME - suffix.length) + suffix;
  }
  taken.add(name);
  return name;
}

function argType(pvt: string | undefined): TaskArgType {
  if (pvt === "n") return "number";
  if (pvt === "onoff") return "boolean";
  return "string";
}

/** The tool arguments a Task element's Task Variables define. */
export function taskArgs(task: XmlElement): TaskToolArg[] {
  const out: TaskToolArg[] = [];
  const seen = new Set<string>();
  for (const pv of children(task, "ProfileVariable")) {
    const pvit = childText(pv, "pvit")?.trim();
    if (pvit !== undefined && pvit !== "t") continue;
    if (childText(pv, "immutable")?.trim() !== "true") continue;
    if (childText(pv, "pvci")?.trim() === "true") continue;
    const name = (childText(pv, "pvn") ?? "").trim().replace(/^%/, "");
    const variable = name.toLowerCase();
    if (!LOCAL_RE.test(variable) || seen.has(variable)) continue;
    seen.add(variable);
    const prompt = (childText(pv, "pvd") ?? "").trim();
    const label = (childText(pv, "pvdn") ?? "").trim();
    const arg: TaskToolArg = {
      name,
      variable,
      type: argType(childText(pv, "pvt")?.trim()),
      required: /\(required\)/i.test(prompt),
    };
    const description = prompt || label;
    if (description !== "") arg.description = description;
    out.push(arg);
  }
  return out;
}

function exampleValue(a: TaskToolArg): unknown {
  if (a.type === "number") return 1;
  if (a.type === "boolean") return true;
  return "text";
}

/** Every `#mcp` task in a backup as a tool definition, in task id order. */
export function discoverTaskTools(doc: TaskerDoc): TaskToolDef[] {
  const tasks = doc
    .tasks()
    .map((el, i) => ({ el, i, id: TaskerDoc.idOf(el) }))
    .filter((t) => TaskerDoc.nameOf(t.el) !== "" && hasMcpTag(childText(t.el, "pc")))
    .sort(
      (a, b) => (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER) || a.i - b.i,
    );
  const taken = new Set<string>();
  return tasks.map(({ el, id }) => {
    const task = TaskerDoc.nameOf(el);
    const tool = mangleToolName(task, taken, id === undefined ? "task" : `task_${id}`);
    const args = taskArgs(el);
    const comment = stripMcpTag(childText(el, "pc") ?? "");
    const example: Record<string, unknown> = {};
    for (const a of args) example[a.name] = exampleValue(a);
    const description =
      (comment === ""
        ? `Runs the Tasker task "${task}".`
        : `${comment}\n\n(Tasker task "${task}".)`) +
      ` Example: ${tool} ${JSON.stringify(example)}`;
    const def: TaskToolDef = { tool, task, description, args };
    if (id !== undefined) def.taskId = id;
    return def;
  });
}

/** zod raw shape for a definition's arguments. */
export function inputShape(def: TaskToolDef): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {};
  for (const a of def.args) {
    let s: z.ZodType =
      a.type === "number" ? z.number() : a.type === "boolean" ? z.boolean() : z.string();
    if (a.description !== undefined) s = s.describe(a.description);
    shape[a.name] = a.required ? s : s.optional();
  }
  return shape;
}

/** Tool arguments -> /run variables: lower case names, string values, unset ones left out. */
export function toVariables(
  def: TaskToolDef,
  args: Record<string, unknown>,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const a of def.args) {
    const v = args[a.name];
    if (v === undefined || v === null) continue;
    vars[a.variable] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return vars;
}

export interface RefreshResult {
  changed: boolean;
  added: string[];
  removed: string[];
  updated: string[];
  tools: { name: string; task: string; args: string[] }[];
  errors?: string[];
}

interface Entry {
  def: TaskToolDef;
  signature: string;
  registered: RegisteredTool;
}

/** Keeps the dynamic per-task tools in sync with the phone. */
export class TaskToolRegistry {
  private readonly server: McpServer;
  private readonly ctx: ToolContext;
  private readonly entries = new Map<string, Entry>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(server: McpServer, ctx: ToolContext) {
    this.server = server;
    this.ctx = ctx;
  }

  /** Names of the currently registered per-task tools. */
  names(): string[] {
    return [...this.entries.keys()].sort();
  }

  /** Re-read the backup and sync the tools. Calls run one after another. */
  refresh(): Promise<RefreshResult> {
    const run = this.queue.then(() => this.doRefresh());
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async doRefresh(): Promise<RefreshResult> {
    const { doc } = await this.ctx.backup();
    const defs = discoverTaskTools(doc);
    const wanted = new Map(defs.map((d) => [d.tool, d]));
    const added: string[] = [];
    const removed: string[] = [];
    const updated: string[] = [];
    const errors: string[] = [];

    for (const [name, entry] of this.entries) {
      const def = wanted.get(name);
      if (def !== undefined && JSON.stringify(def) === entry.signature) continue;
      entry.registered.remove();
      this.entries.delete(name);
      (def === undefined ? removed : updated).push(name);
    }
    for (const def of defs) {
      if (this.entries.has(def.tool)) continue;
      try {
        const registered = this.register(def);
        this.entries.set(def.tool, { def, signature: JSON.stringify(def), registered });
        if (!updated.includes(def.tool)) added.push(def.tool);
      } catch (e) {
        const msg = `${def.tool} (task "${def.task}"): ${e instanceof Error ? e.message : String(e)}`;
        errors.push(msg);
        const i = updated.indexOf(def.tool);
        if (i >= 0) removed.push(...updated.splice(i, 1));
        log("task tool not registered", { tool: def.tool, error: msg });
      }
    }
    const changed = added.length > 0 || removed.length > 0 || updated.length > 0;
    if (changed) this.server.sendToolListChanged();

    const result: RefreshResult = {
      changed,
      added,
      removed,
      updated,
      tools: [...this.entries.values()]
        .map((e) => ({ name: e.def.tool, task: e.def.task, args: e.def.args.map((a) => a.name) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
    if (errors.length > 0) result.errors = errors;
    return result;
  }

  private register(def: TaskToolDef): RegisteredTool {
    const ctx = this.ctx;
    return this.server.registerTool(
      def.tool,
      {
        title: `Tasker task: ${def.task}`,
        description: def.description,
        inputSchema: inputShape(def),
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
      },
      handler(async (args: Record<string, unknown>): Promise<CallToolResult> => {
        const client = await ctx.client();
        const variables = toVariables(def, args);
        // Immutable Task Variables cannot be overwritten by Perform Task
        // passthrough (verified on 6.6.20), so the arguments also travel as
        // JSON in %par1 for the task's MCP#parse_args action (dceluis
        // convention) to set with setLocal.
        const result = await client.run({
          task: def.task,
          par1: JSON.stringify(variables),
          variables,
        });
        return result.ok ? ok(result) : { ...ok(result), isError: true };
      }),
    );
  }
}

export interface TaskToolOptions {
  /** Delay before the first background refresh; a negative value disables it. */
  initialDelayMs?: number;
}

const registries = new WeakMap<McpServer, TaskToolRegistry>();

/**
 * The registry registered on `server`, if any. Server wiring can hook
 * ctx.toolsChanged to `taskToolRegistryFor(server)?.refresh()` so task edits
 * update the per-task tools.
 */
export function taskToolRegistryFor(server: McpServer): TaskToolRegistry | undefined {
  return registries.get(server);
}

/** Registers refresh_tools and schedules the first discovery. Returns the registry. */
export function registerTaskTools(
  server: McpServer,
  ctx: ToolContext,
  opts: TaskToolOptions = {},
): TaskToolRegistry {
  const registry = new TaskToolRegistry(server, ctx);
  registries.set(server, registry);
  server.registerTool(
    "refresh_tools",
    {
      title: "Refresh per-task tools",
      description:
        "Re-read the Tasker configuration and expose every task whose comment contains #mcp " +
        "as a tool named tasker_<task name>, with its Immutable Task Variables as arguments " +
        '(a prompt containing "(required)" makes one required). Returns the tool list. ' +
        "Example: refresh_tools {}",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async () => ok(await registry.refresh())),
  );
  const delay = opts.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  if (delay >= 0) {
    const timer = setTimeout(() => {
      registry.refresh().catch((e: unknown) => {
        log("per-task tool discovery failed; call refresh_tools to retry", {
          error: e instanceof Error ? e.message : String(e),
        });
      });
    }, delay);
    timer.unref();
  }
  return registry;
}

export function register(server: McpServer, ctx: ToolContext): void {
  registerTaskTools(server, ctx);
}
