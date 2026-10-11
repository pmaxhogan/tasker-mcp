/**
 * Structured (JSON) tools: list and read tasks, profiles, projects, scenes;
 * create / edit / delete tasks and profiles; move objects between projects;
 * rename. Every mutation goes through src/tools/mutate.ts.
 */
import { z } from "zod";
import { applyPatch, type TaskPatch } from "../edit/splice.ts";
import { BASE_PROJECT } from "../edit/plan.ts";
import { opByCode } from "../model/ops.ts";
import { argToElement, profileToJson, projectToJson, taskToJson } from "../model/convert.ts";
import { TaskerDoc } from "../model/document.ts";
import type { TaskJson } from "../model/types.ts";
import { editDistance, normName, type SpecIndex } from "../spec/table.ts";
import {
  attr,
  child,
  childText,
  children,
  createElement,
  elementText,
  parseFragment,
  removeChild,
  setAttr,
  setChildText,
  textNode,
  type XmlElement,
} from "../xml/index.ts";
import { handler, ok, ToolError, type RegisterTools, type ToolContext } from "./context.ts";
import {
  actionInputSchema,
  actionsFromInput,
  applyTask,
  coerceArg,
  deleteTaskElement,
  exclusive,
  finishMutation,
  insertRoot,
  moveToProject,
  profilesUsingTask,
  projectName,
  removeFromProjects,
  removeRoot,
  specLookup,
  tidy,
  withConfigEdit,
  type ActionInput,
} from "./mutate.ts";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false } as const;
const WRITE_IDEMPOTENT = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
} as const;
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false } as const;

/** Up to 5 names close to `name` (substring or small edit distance), for "did you mean" hints. */
export function nearNames(names: string[], name: string): string[] {
  const n = normName(name);
  const maxD = Math.max(2, Math.floor(n.length / 4));
  const scored = names
    .filter((x) => x !== "")
    .map((x) => {
      const m = normName(x);
      const score = m === n ? 0 : m.includes(n) || n.includes(m) ? 1 : 1 + editDistance(m, n);
      return { x, score };
    })
    .filter((s) => s.score <= 1 + maxD)
    .sort((a, b) => a.score - b.score || a.x.localeCompare(b.x));
  return scored.slice(0, 5).map((s) => s.x);
}

function notFound(kind: string, name: string, names: string[], listTool: string): ToolError {
  const near = nearNames(names, name);
  return new ToolError(
    `No ${kind} named ${JSON.stringify(name)}`,
    near.length > 0 ? `did you mean: ${near.join(", ")}` : `${listTool} lists them`,
  );
}

export function requireTask(doc: TaskerDoc, name: string): XmlElement {
  const t = doc.taskByName(name);
  if (t === undefined) {
    throw notFound("task", name, doc.tasks().map(TaskerDoc.nameOf), "list_tasks");
  }
  return t;
}

export function requireProfile(doc: TaskerDoc, name: string): XmlElement {
  const p = doc.profileByName(name);
  if (p === undefined) {
    throw notFound("profile", name, doc.profiles().map(TaskerDoc.nameOf), "list_profiles");
  }
  return p;
}

export function requireProject(doc: TaskerDoc, name: string): XmlElement {
  const p = doc.projectByName(name);
  if (p === undefined) {
    throw notFound("project", name, doc.projects().map(projectName), "list_projects");
  }
  return p;
}

export function requireScene(doc: TaskerDoc, name: string): XmlElement {
  const s = doc.sceneByName(name);
  if (s === undefined) throw notFound("scene", name, doc.sceneNames(), "list_scenes");
  return s;
}

/** Task by name or id, for tools that accept either. */
export function findTask(doc: TaskerDoc, args: { name?: string; id?: number }): XmlElement {
  if (args.id !== undefined) {
    const t = doc.taskById(args.id);
    if (t === undefined) throw new ToolError(`No task with id ${args.id}`, "list_tasks lists ids");
    return t;
  }
  if (args.name === undefined) throw new ToolError("Give a task name or id");
  return requireTask(doc, args.name);
}

/** The structured view of a task, with its project and resolved names. */
export function taskJson(ctx: ToolContext, doc: TaskerDoc, el: XmlElement): TaskJson {
  const id = TaskerDoc.idOf(el);
  const p = id === undefined ? undefined : doc.projectOfTask(id);
  return taskToJson(el, specLookup(ctx.spec), {
    ...(p === undefined ? {} : { project: projectName(p) }),
    opName: (op) => opByCode(op)?.name,
  });
}

function contextNames(ctx: ToolContext, doc: TaskerDoc) {
  return {
    event: (c: number) => ctx.spec.eventName(c),
    state: (c: number) => ctx.spec.stateName(c),
    taskName: (id: number) => {
      const n = doc.taskName(id);
      return n === "" ? undefined : n;
    },
  };
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export const contextInputSchema = z.union([
  z
    .string()
    .describe("Raw XML of one context element (<Event>, <State>, <Time>, <Day>, <App>, <Loc>)"),
  z.object({
    event: z.union([z.string(), z.number().int()]).describe("Event code or name"),
    args: z.record(z.string(), z.unknown()).optional().describe('Keyed "argN"'),
  }),
  z.object({
    state: z.union([z.string(), z.number().int()]).describe("State code or name"),
    args: z.record(z.string(), z.unknown()).optional().describe('Keyed "argN"'),
    invert: z.boolean().optional(),
  }),
]);
export type ContextInput = z.infer<typeof contextInputSchema>;

const MAX_CODE = 10_000;
let eventCodes: Map<string, number> | undefined;
let stateCodes: Map<string, number> | undefined;

function codeByName(spec: SpecIndex, kind: "event" | "state", name: string | number): number {
  if (typeof name === "number") return name;
  if (/^\d+$/.test(name.trim())) return Number(name.trim());
  let map = kind === "event" ? eventCodes : stateCodes;
  if (map === undefined) {
    map = new Map();
    for (let c = 0; c < MAX_CODE; c++) {
      const n = kind === "event" ? spec.eventName(c) : spec.stateName(c);
      if (n !== undefined && !map.has(normName(n))) map.set(normName(n), c);
    }
    if (kind === "event") eventCodes = map;
    else stateCodes = map;
  }
  const code = map.get(normName(name));
  if (code === undefined) {
    const near = nearNames(
      [...map.keys()].map((k) => {
        const c = map.get(k) as number;
        return (kind === "event" ? spec.eventName(c) : spec.stateName(c)) ?? k;
      }),
      name,
    );
    throw new ToolError(
      `Unknown ${kind} ${JSON.stringify(name)}`,
      near.length > 0 ? `did you mean: ${near.join(", ")}` : `pass the ${kind} code or raw XML`,
    );
  }
  return code;
}

/** One profile context element with `sr="con<index>"`. */
export function buildContext(spec: SpecIndex, input: ContextInput, index: number): XmlElement {
  const sr = `con${index}`;
  if (typeof input === "string") {
    let el: XmlElement;
    try {
      el = parseFragment(input);
    } catch (e) {
      throw new ToolError(`context ${index}: invalid raw XML: ${(e as Error).message}`);
    }
    if (!["Event", "State", "Time", "Day", "App", "Loc"].includes(el.name)) {
      throw new ToolError(
        `context ${index}: <${el.name}> is not a profile context`,
        "use <Event>, <State>, <Time>, <Day>, <App> or <Loc>",
      );
    }
    setAttr(el, "sr", sr);
    return el;
  }
  const isEvent = "event" in input;
  const code = isEvent
    ? codeByName(spec, "event", input.event)
    : codeByName(spec, "state", input.state);
  const kids: XmlElement[] = [createElement("code", undefined, [textNode(String(code))])];
  if (isEvent) kids.push(createElement("pri", undefined, [textNode("0")]));
  if (!isEvent && input.invert === true)
    kids.push(createElement("pin", undefined, [textNode("true")]));
  for (const [key, value] of Object.entries(input.args ?? {})) {
    const m = /^(?:arg)?(\d+)$/i.exec(key.trim());
    if (!m) throw new ToolError(`context ${index}: key args by id ("arg0"), got "${key}"`);
    kids.push(argToElement(coerceArg(Number(m[1]), value, undefined, `context ${index}`)));
  }
  return createElement(isEvent ? "Event" : "State", { sr, ve: "2" }, kids);
}

function taskIdFor(doc: TaskerDoc, ref: string | number, what: string): number {
  if (typeof ref === "number") {
    if (doc.taskById(ref) === undefined) throw new ToolError(`${what}: no task with id ${ref}`);
    return ref;
  }
  const t = requireTask(doc, ref);
  return TaskerDoc.idOf(t) as number;
}

function setContexts(spec: SpecIndex, profile: XmlElement, contexts: ContextInput[]): void {
  for (const k of children(profile)) {
    if (["Event", "State", "Time", "Day", "App", "Loc"].includes(k.name)) removeChild(profile, k);
  }
  contexts.forEach((c, i) => profile.children.push(buildContext(spec, c, i)));
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  actions: z.array(actionInputSchema).optional().describe("Replace the whole action list"),
  splice: z
    .object({
      index: z.number().int().min(0),
      deleteCount: z.number().int().min(0),
      insert: z.array(actionInputSchema).optional(),
    })
    .optional(),
  set: z
    .object({
      name: z.string().optional().describe("Rename the task"),
      priority: z.number().int().nullable().optional(),
      collision: z.number().int().min(0).max(2).nullable().optional(),
      comment: z.string().nullable().optional(),
    })
    .optional(),
});
type PatchInput = z.infer<typeof patchSchema>;

function patchFromInput(ctx: ToolContext, p: PatchInput): TaskPatch {
  const out: TaskPatch = {};
  if (p.actions !== undefined) out.actions = actionsFromInput(ctx.spec, p.actions as ActionInput[]);
  if (p.splice !== undefined) {
    out.splice = { index: p.splice.index, deleteCount: p.splice.deleteCount };
    if (p.splice.insert !== undefined) {
      out.splice.insert = (p.splice.insert as ActionInput[]).map((a, i) => {
        const conv = actionsFromInput(ctx.spec, [a])[0]!;
        conv.index = p.splice!.index + i;
        return conv;
      });
    }
  }
  if (p.set !== undefined) {
    const s: NonNullable<TaskPatch["set"]> = {};
    if (p.set.name !== undefined) s.name = p.set.name;
    if (p.set.priority !== undefined) s.priority = p.set.priority;
    if (p.set.collision !== undefined) s.collision = p.set.collision;
    if (p.set.comment !== undefined) s.comment = p.set.comment;
    out.set = s;
  }
  return out;
}

const kindSchema = z.enum(["task", "profile", "scene"]);

export const register: RegisterTools = (server, ctx) => {
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "List Tasker projects with their task, profile and scene names. Example: list_projects {}",
      inputSchema: {},
      annotations: READ,
    },
    handler(async () => ok({ projects: (await ctx.backup()).doc.summary().projects })),
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        'List named tasks (id, name, project), optionally only one project\'s. Anonymous tasks are counted, not listed. Example: list_tasks {"project": "Base"}',
      inputSchema: { project: z.string().optional() },
      annotations: READ,
    },
    handler(async ({ project }: { project?: string }) => {
      const doc = (await ctx.backup()).doc;
      if (project !== undefined) requireProject(doc, project);
      let tasks = doc.summary().tasks;
      if (project !== undefined) tasks = tasks.filter((t) => t.project === project);
      const named = tasks.filter((t) => t.name !== "");
      return ok({ tasks: named, anonymous: tasks.length - named.length });
    }),
  );

  server.registerTool(
    "list_profiles",
    {
      title: "List profiles",
      description:
        'List profiles with enabled state, project and entry/exit task. Example: list_profiles {"project": "Base"}',
      inputSchema: { project: z.string().optional() },
      annotations: READ,
    },
    handler(async ({ project }: { project?: string }) => {
      let profiles = (await ctx.backup()).doc.summary().profiles;
      if (project !== undefined) profiles = profiles.filter((p) => p.project === project);
      return ok({ profiles });
    }),
  );

  server.registerTool(
    "list_scenes",
    {
      title: "List scenes",
      description: "List scenes and their projects. Example: list_scenes {}",
      inputSchema: {},
      annotations: READ,
    },
    handler(async () => ok({ scenes: (await ctx.backup()).doc.summary().scenes })),
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description:
        'Read one task as JSON: actions with code, name, args (id, name, kind, value), conditions with opName, nesting depth. Actions Tasker\'s spec table does not know keep their XML in `raw`. Example: get_task {"name": "My Task"}',
      inputSchema: { name: z.string().optional(), id: z.number().int().optional() },
      annotations: READ,
    },
    handler(async (args: { name?: string; id?: number }) => {
      const doc = (await ctx.backup()).doc;
      return ok(taskJson(ctx, doc, findTask(doc, args)));
    }),
  );

  server.registerTool(
    "get_profile",
    {
      title: "Get profile",
      description:
        'Read one profile as JSON: enabled, project, entry/exit task names, contexts (kind, code, name, raw XML). Example: get_profile {"name": "Battery Low"}',
      inputSchema: { name: z.string() },
      annotations: READ,
    },
    handler(async ({ name }: { name: string }) => {
      const doc = (await ctx.backup()).doc;
      const p = requireProfile(doc, name);
      const proj = doc.projectOfProfile(TaskerDoc.idOf(p) ?? -1);
      return ok(
        profileToJson(
          p,
          contextNames(ctx, doc),
          proj === undefined ? {} : { project: projectName(proj) },
        ),
      );
    }),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description:
        'Read one project: its tasks, profiles and scenes by name. Example: get_project {"name": "Base"}',
      inputSchema: { name: z.string() },
      annotations: READ,
    },
    handler(async ({ name }: { name: string }) => {
      const doc = (await ctx.backup()).doc;
      return ok(
        projectToJson(requireProject(doc, name), {
          taskName: (id) => doc.taskName(id),
          profileName: (id) => doc.profileName(id),
        }),
      );
    }),
  );

  server.registerTool(
    "create_task",
    {
      title: "Create task",
      description:
        "Create a task from a list of actions, validated against the spec table, imported, read back and verified. " +
        'Each action: {action: name | code: n, args: {<arg name|id|"argN">: value}, condition?: {conditions: [{lhs, op, rhs}], joins?}, enabled?, label?, continueOnError?} or {raw: "<Action>..."} for codes without a spec. ' +
        "New tasks land in Base; `project` moves it (needs config import). " +
        'Example: create_task {"name": "Hello", "actions": [{"action": "Flash", "args": {"Text": "hi"}}, {"action": "Return", "args": {"Value": "%par1"}}]}',
      inputSchema: {
        name: z.string(),
        actions: z.array(actionInputSchema),
        project: z.string().optional(),
        comment: z.string().optional(),
        priority: z.number().int().optional(),
        collision: z
          .number()
          .int()
          .min(0)
          .max(2)
          .optional()
          .describe("0 abort new, 1 abort existing, 2 run both"),
        validate: z.boolean().optional().describe("Default true; false skips spec validation"),
      },
      annotations: WRITE,
    },
    handler(
      async (args: {
        name: string;
        actions: ActionInput[];
        project?: string;
        comment?: string;
        priority?: number;
        collision?: number;
        validate?: boolean;
      }) =>
        exclusive(async () => {
          ctx.assertWritable("task", args.name);
          if (args.project !== undefined && args.project !== BASE_PROJECT) {
            ctx.assertWritable("project", args.project);
          }
          const doc = (await ctx.backup()).doc;
          if (doc.taskByName(args.name) !== undefined) {
            throw new ToolError(
              `A task named ${JSON.stringify(args.name)} already exists`,
              "use edit_task to change it, or pick another name",
            );
          }
          const task: TaskJson = {
            name: args.name,
            actions: actionsFromInput(ctx.spec, args.actions),
          };
          if (args.project !== undefined) task.project = args.project;
          if (args.comment !== undefined) task.comment = args.comment;
          if (args.priority !== undefined) task.priority = args.priority;
          if (args.collision !== undefined) task.collision = args.collision;
          return ok(
            await applyTask(ctx, task, {
              tool: "create_task",
              ...(args.validate === undefined ? {} : { validate: args.validate }),
            }),
          );
        }),
    ),
  );

  server.registerTool(
    "edit_task",
    {
      title: "Edit task",
      description:
        "Change a task with a patch: {actions: [...]} replaces every action, {splice: {index, deleteCount, insert?}} edits a range, {set: {name?, priority?, collision?, comment?}} changes fields (null clears; a new name renames, which needs a config import). " +
        "Actions use the create_task shape, or the objects get_task returns. Several patches may be passed as an array. " +
        'Example: edit_task {"name": "Hello", "patch": {"splice": {"index": 0, "deleteCount": 1, "insert": [{"action": "Flash", "args": {"Text": "bye"}}]}}}',
      inputSchema: {
        name: z.string(),
        patch: z.union([patchSchema, z.array(patchSchema)]),
        validate: z.boolean().optional(),
      },
      annotations: WRITE,
    },
    handler(async (args: { name: string; patch: PatchInput | PatchInput[]; validate?: boolean }) =>
      exclusive(async () => {
        ctx.assertWritable("task", args.name);
        const doc = (await ctx.backup()).doc;
        const current = taskJson(ctx, doc, requireTask(doc, args.name));
        delete current.warnings;
        const patches = (Array.isArray(args.patch) ? args.patch : [args.patch]).map((p) =>
          patchFromInput(ctx, p),
        );
        let next: TaskJson;
        try {
          next = applyPatch(current, patches);
        } catch (e) {
          throw new ToolError((e as Error).message, "get_task shows the current action indexes");
        }
        const renaming = next.name !== args.name;
        return ok(
          await applyTask(ctx, next, {
            tool: "edit_task",
            ...(renaming ? { baseName: args.name } : {}),
            ...(args.validate === undefined ? {} : { validate: args.validate }),
          }),
        );
      }),
    ),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description:
        'Delete a task (whole-configuration import). Refuses when a profile uses it as entry or exit task unless force is true. Example: delete_task {"name": "Old Task"}',
      inputSchema: { name: z.string(), force: z.boolean().optional() },
      annotations: DESTRUCTIVE,
    },
    handler(async ({ name, force }: { name: string; force?: boolean }) => {
      ctx.assertWritable("task", name);
      const r = await withConfigEdit(ctx, "delete_task", `delete task ${name}`, (doc) => {
        const el = requireTask(doc, name);
        const users = profilesUsingTask(doc, TaskerDoc.idOf(el) ?? -1);
        if (users.length > 0 && force !== true) {
          throw new ToolError(
            `Task ${JSON.stringify(name)} is used by profile(s) ${users.join(", ")}`,
            "change or delete those profiles first, or pass force: true",
          );
        }
        deleteTaskElement(doc, el);
        return users;
      });
      ctx.toolsChanged();
      const warnings = r.result.map((p) => `profile ${p} now points at a deleted task`);
      return ok({
        ok: r.doc.taskByName(name) === undefined,
        deleted: name,
        snapshot: r.snapshot.id,
        changed: [`deleted task ${JSON.stringify(name)}`],
        warnings: [...warnings, ...r.warnings],
        verified: r.doc.taskByName(name) === undefined,
        ...r.persist,
      });
    }),
  );

  server.registerTool(
    "create_profile",
    {
      title: "Create profile",
      description:
        "Create a profile (whole-configuration import). contexts: raw XML strings of <Event>/<State>/<Time>/<Day>/<App>/<Loc> elements, or {event: code|name, args: {argN: value}} / {state: code|name, args, invert?}. The profile joins `project`, else the entry task's project. " +
        'Example: create_profile {"name": "Morning", "contexts": ["<Time sr=\\"con0\\"><fh>7</fh><fm>0</fm><th>8</th><tm>0</tm></Time>"], "entryTask": "Hello"}',
      inputSchema: {
        name: z.string(),
        contexts: z.array(contextInputSchema).min(1),
        entryTask: z.union([z.string(), z.number().int()]),
        exitTask: z.union([z.string(), z.number().int()]).optional(),
        project: z.string().optional(),
        enabled: z.boolean().optional(),
      },
      annotations: WRITE,
    },
    handler(
      async (args: {
        name: string;
        contexts: ContextInput[];
        entryTask: string | number;
        exitTask?: string | number;
        project?: string;
        enabled?: boolean;
      }) => {
        ctx.assertWritable("profile", args.name);
        if (args.project !== undefined) ctx.assertWritable("project", args.project);
        const r = await withConfigEdit(
          ctx,
          "create_profile",
          `create profile ${args.name}`,
          (doc) => {
            if (doc.profileByName(args.name) !== undefined) {
              throw new ToolError(
                `A profile named ${JSON.stringify(args.name)} already exists`,
                "use edit_profile, or pick another name",
              );
            }
            const entry = taskIdFor(doc, args.entryTask, "entryTask");
            const exit =
              args.exitTask === undefined ? undefined : taskIdFor(doc, args.exitTask, "exitTask");
            const id = doc.nextFreeId();
            const now = String(Date.now());
            const el = createElement("Profile", { sr: `prof${id}`, ve: "2" }, []);
            setChildText(el, "cdate", now);
            setChildText(el, "edate", now);
            setChildText(el, "id", String(id));
            if (args.enabled === false) setChildText(el, "limit", "true");
            setChildText(el, "mid0", String(entry));
            if (exit !== undefined) setChildText(el, "mid1", String(exit));
            setChildText(el, "nme", args.name);
            setContexts(ctx.spec, el, args.contexts);
            tidy(el);
            insertRoot(doc, el);
            const entryProject = doc.projectOfTask(entry);
            const project =
              args.project ??
              (entryProject === undefined ? BASE_PROJECT : projectName(entryProject));
            moveToProject(doc, "pids", id, project);
            return { id, project };
          },
        );
        const made = r.doc.profileByName(args.name);
        return ok({
          ok: made !== undefined,
          profile: args.name,
          profileId: made === undefined ? undefined : TaskerDoc.idOf(made),
          project: r.result.project,
          snapshot: r.snapshot.id,
          changed: [`created profile ${JSON.stringify(args.name)}`],
          warnings: r.warnings,
          verified: made !== undefined,
          ...r.persist,
        });
      },
    ),
  );

  server.registerTool(
    "edit_profile",
    {
      title: "Edit profile",
      description:
        "Change a profile: set {name?, enabled?, entryTask?, exitTask? (null removes), contexts? (replaces all)}. Enabling or disabling alone uses the /profile route (no config import); anything else is a whole-configuration import. " +
        'Example: edit_profile {"name": "Morning", "set": {"enabled": false}}',
      inputSchema: {
        name: z.string(),
        set: z.object({
          name: z.string().optional(),
          enabled: z.boolean().optional(),
          entryTask: z.union([z.string(), z.number().int()]).optional(),
          exitTask: z.union([z.string(), z.number().int()]).nullable().optional(),
          contexts: z.array(contextInputSchema).min(1).optional(),
        }),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    handler(
      async (args: {
        name: string;
        set: {
          name?: string;
          enabled?: boolean;
          entryTask?: string | number;
          exitTask?: string | number | null;
          contexts?: ContextInput[];
        };
      }) => {
        const s = args.set;
        ctx.assertWritable("profile", args.name);
        if (s.name !== undefined) ctx.assertWritable("profile", s.name);
        const keys = Object.keys(s).filter((k) => (s as Record<string, unknown>)[k] !== undefined);
        if (keys.length === 0)
          throw new ToolError("Nothing to change", "pass at least one field in set");
        if (keys.length === 1 && s.enabled !== undefined) {
          return exclusive(async () => {
            const snap = await ctx.snapshot("edit_profile", `edit profile ${args.name}`);
            requireProfile(snap.doc, args.name);
            await (await ctx.client()).setProfileEnabled(args.name, s.enabled as boolean);
            const after = (await ctx.backup()).doc.profileByName(args.name);
            const enabled = after !== undefined && childText(after, "limit") !== "true";
            const warnings: string[] = [];
            const persist = await finishMutation(ctx, warnings);
            return ok({
              ok: true,
              profile: args.name,
              snapshot: snap.info.id,
              changed: [
                `${s.enabled ? "enabled" : "disabled"} profile ${JSON.stringify(args.name)}`,
              ],
              warnings,
              verified: enabled === s.enabled,
              ...persist,
            });
          });
        }
        const r = await withConfigEdit(ctx, "edit_profile", `edit profile ${args.name}`, (doc) => {
          const p = requireProfile(doc, args.name);
          const changed: string[] = [];
          if (s.name !== undefined && s.name !== args.name) {
            if (doc.profileByName(s.name) !== undefined) {
              throw new ToolError(`A profile named ${JSON.stringify(s.name)} already exists`);
            }
            setChildText(p, "nme", s.name);
            changed.push(`renamed to ${JSON.stringify(s.name)}`);
          }
          if (s.enabled !== undefined) {
            const limit = child(p, "limit");
            if (s.enabled && limit !== undefined) removeChild(p, limit);
            if (!s.enabled) setChildText(p, "limit", "true");
            changed.push(s.enabled ? "enabled" : "disabled");
          }
          if (s.entryTask !== undefined) {
            setChildText(p, "mid0", String(taskIdFor(doc, s.entryTask, "entryTask")));
            changed.push(`entry task ${JSON.stringify(s.entryTask)}`);
          }
          if (s.exitTask === null) {
            const m = child(p, "mid1");
            if (m !== undefined) removeChild(p, m);
            changed.push("exit task removed");
          } else if (s.exitTask !== undefined) {
            setChildText(p, "mid1", String(taskIdFor(doc, s.exitTask, "exitTask")));
            changed.push(`exit task ${JSON.stringify(s.exitTask)}`);
          }
          if (s.contexts !== undefined) {
            setContexts(ctx.spec, p, s.contexts);
            changed.push(`${s.contexts.length} contexts`);
          }
          setChildText(p, "edate", String(Date.now()));
          tidy(p);
          return changed;
        });
        const finalName = s.name ?? args.name;
        return ok({
          ok: true,
          profile: finalName,
          snapshot: r.snapshot.id,
          changed: r.result,
          warnings: r.warnings,
          verified: r.doc.profileByName(finalName) !== undefined,
          ...r.persist,
        });
      },
    ),
  );

  server.registerTool(
    "delete_profile",
    {
      title: "Delete profile",
      description:
        'Delete a profile (whole-configuration import); its tasks stay. Example: delete_profile {"name": "Morning"}',
      inputSchema: { name: z.string() },
      annotations: DESTRUCTIVE,
    },
    handler(async ({ name }: { name: string }) => {
      ctx.assertWritable("profile", name);
      const r = await withConfigEdit(ctx, "delete_profile", `delete profile ${name}`, (doc) => {
        const p = requireProfile(doc, name);
        const id = TaskerDoc.idOf(p);
        removeRoot(doc, p);
        if (id !== undefined) removeFromProjects(doc, "pids", id);
      });
      const gone = r.doc.profileByName(name) === undefined;
      return ok({
        ok: gone,
        deleted: name,
        snapshot: r.snapshot.id,
        changed: [`deleted profile ${JSON.stringify(name)}`],
        warnings: r.warnings,
        verified: gone,
        ...r.persist,
      });
    }),
  );

  server.registerTool(
    "move_to_project",
    {
      title: "Move to project",
      description:
        'Move a task, profile or scene into a project, creating the project when missing (whole-configuration import). Example: move_to_project {"kind": "task", "name": "Hello", "project": "Tools"}',
      inputSchema: { kind: kindSchema, name: z.string(), project: z.string() },
      annotations: WRITE_IDEMPOTENT,
    },
    handler(
      async ({
        kind,
        name,
        project,
      }: {
        kind: "task" | "profile" | "scene";
        name: string;
        project: string;
      }) => {
        ctx.assertWritable(kind, name);
        ctx.assertWritable("project", project);
        const r = await withConfigEdit(
          ctx,
          "move_to_project",
          `move ${kind} ${name} to ${project}`,
          (doc) => {
            const created = doc.projectByName(project) === undefined;
            if (kind === "scene") {
              requireScene(doc, name);
              moveToProject(doc, "scenes", name, project);
            } else {
              const el = kind === "task" ? requireTask(doc, name) : requireProfile(doc, name);
              moveToProject(
                doc,
                kind === "task" ? "tids" : "pids",
                TaskerDoc.idOf(el) as number,
                project,
              );
            }
            return created;
          },
        );
        const s = r.doc.summary();
        const where =
          kind === "task"
            ? s.tasks.find((t) => t.name === name)?.project
            : kind === "profile"
              ? s.profiles.find((p) => p.name === name)?.project
              : s.scenes.find((x) => x.name === name)?.project;
        return ok({
          ok: where === project,
          moved: { kind, name, project },
          projectCreated: r.result,
          snapshot: r.snapshot.id,
          changed: [`moved ${kind} ${JSON.stringify(name)} to ${JSON.stringify(project)}`],
          warnings: r.warnings,
          verified: where === project,
          ...r.persist,
        });
      },
    ),
  );

  server.registerTool(
    "rename",
    {
      title: "Rename",
      description:
        "Rename a task, profile, project or scene in place, keeping its id (whole-configuration import). Callers that reference a task by name (Perform Task) are reported, not changed. " +
        'Example: rename {"kind": "task", "from": "Hello", "to": "Hello World"}',
      inputSchema: {
        kind: z.enum(["task", "profile", "project", "scene"]),
        from: z.string(),
        to: z.string().min(1),
      },
      annotations: WRITE,
    },
    handler(
      async ({
        kind,
        from,
        to,
      }: {
        kind: "task" | "profile" | "project" | "scene";
        from: string;
        to: string;
      }) => {
        ctx.assertWritable(kind, from);
        ctx.assertWritable(kind, to);
        const r = await withConfigEdit(ctx, "rename", `rename ${kind} ${from}`, (doc) => {
          const warnings: string[] = [];
          const clash = (exists: boolean): void => {
            if (exists) throw new ToolError(`A ${kind} named ${JSON.stringify(to)} already exists`);
          };
          switch (kind) {
            case "task": {
              const el = requireTask(doc, from);
              clash(doc.taskByName(to) !== undefined);
              setChildText(el, "nme", to);
              for (const t of doc.tasks()) {
                const callers = children(t, "Action").filter(
                  (a) =>
                    childText(a, "code") === "130" &&
                    children(a).some((k) => attr(k, "sr") === "arg0" && elementText(k) === from),
                );
                if (callers.length > 0) {
                  warnings.push(
                    `task ${JSON.stringify(TaskerDoc.nameOf(t))} still calls ${JSON.stringify(from)} with Perform Task`,
                  );
                }
              }
              break;
            }
            case "profile":
              clash(doc.profileByName(to) !== undefined);
              setChildText(requireProfile(doc, from), "nme", to);
              break;
            case "project":
              clash(doc.projectByName(to) !== undefined);
              setChildText(requireProject(doc, from), "name", to);
              break;
            case "scene": {
              const el = requireScene(doc, from);
              clash(doc.sceneByName(to) !== undefined);
              setChildText(el, "nme", to);
              setAttr(el, "sr", `scene${to}`);
              for (const p of doc.projects()) {
                const list = (childText(p, "scenes") ?? "").split(",").map((x) => x.trim());
                if (list.includes(from))
                  setChildText(p, "scenes", list.map((x) => (x === from ? to : x)).join(","));
              }
              warnings.push("actions that show or destroy the scene by name are not updated");
              break;
            }
          }
          return warnings;
        });
        if (kind === "task") ctx.toolsChanged();
        const s = r.doc.summary();
        const present =
          kind === "task"
            ? s.tasks.some((t) => t.name === to)
            : kind === "profile"
              ? s.profiles.some((p) => p.name === to)
              : kind === "project"
                ? s.projects.some((p) => p.name === to)
                : s.scenes.some((x) => x.name === to);
        return ok({
          ok: present,
          renamed: { kind, from, to },
          snapshot: r.snapshot.id,
          changed: [`renamed ${kind} ${JSON.stringify(from)} to ${JSON.stringify(to)}`],
          warnings: [...r.result, ...r.warnings],
          verified: present,
          ...r.persist,
        });
      },
    ),
  );
};
