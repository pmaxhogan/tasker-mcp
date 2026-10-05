/**
 * The mutation pipeline every mutating tool goes through, plus the helpers
 * they share (action input conversion, config document edits).
 *
 * Task writes: snapshot -> plan -> validate -> /import -> re-fetch backup ->
 * verify (diffTasks) -> duplicate check -> one follow-up config import when a
 * rename, a project move, or a duplicate cleanup needs it.
 *
 * Config writes (profiles, projects, deletes, renames): snapshot -> edit a
 * TaskerDoc built from the snapshot -> POST /config -> re-fetch.
 *
 * Every mutation runs under one process-wide async mutex. The lock is
 * reentrant (AsyncLocalStorage), so a tool may compose applyTask and
 * withConfigEdit without deadlocking.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { planReplaceTask, BASE_PROJECT, type ReplacePlan } from "../edit/plan.ts";
import { diffTasks, findDuplicates } from "../edit/verify.ts";
import {
  actionToJson,
  boolDefault,
  formatElement,
  guiDefault,
  intDefault,
  OBJECT_DEPTH,
  parseIdList,
  parseNameList,
  sortChildren,
  taskToJson,
  wrapForImport,
  type SpecLookup,
} from "../model/convert.ts";
import { TaskerDoc } from "../model/document.ts";
import { opByCode, opByName } from "../model/ops.ts";
import type { ActionJson, ArgJson, ConditionListJson, TaskJson } from "../model/types.ts";
import type { SnapshotInfo } from "../snapshots.ts";
import { ELSE_IF_NAME, normName, type SpecIndex } from "../spec/table.ts";
import { ArgType, type ActionSpec, type ArgSpec } from "../spec/types.ts";
import { validateTask, type Issue } from "../spec/validate.ts";
import {
  child,
  childText,
  children,
  cloneNode,
  createElement,
  insertChildElement,
  parseFragment,
  removeChild,
  setAttr,
  setChildText,
  textNode,
  XmlParseError,
  type XmlElement,
} from "../xml/index.ts";
import { ToolError, type Snapshot, type ToolContext } from "./context.ts";

// ---------------------------------------------------------------------------
// Mutex
// ---------------------------------------------------------------------------

const held = new AsyncLocalStorage<true>();
let tail: Promise<unknown> = Promise.resolve();

/**
 * Run `fn` while holding the mutation lock. Nested calls (from inside a
 * locked section) run inline, so composite tools never deadlock.
 */
export function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (held.getStore() === true) return fn();
  const run = tail.then(() => held.run(true, fn));
  tail = run.catch(() => undefined);
  return run;
}

// ---------------------------------------------------------------------------
// Action input (shared by create_task, edit_task, run_actions)
// ---------------------------------------------------------------------------

export const conditionInputSchema = z.object({
  conditions: z
    .array(
      z.object({
        lhs: z.string(),
        op: z.union([z.string(), z.number().int()]),
        rhs: z.string().optional(),
      }),
    )
    .min(1),
  joins: z.array(z.string()).optional(),
});

export const actionInputSchema = z.object({
  code: z.number().int().optional().describe("Action code (see search_actions)"),
  action: z.string().optional().describe('Action name instead of a code, e.g. "Variable Set"'),
  name: z.string().optional().describe("Alias of action (get_task output uses it)"),
  args: z
    .union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))])
    .optional()
    .describe(
      'Object keyed by arg name, label, id or "argN" (values are coerced by the spec type), or the ArgJson array get_task returns',
    ),
  enabled: z.boolean().optional(),
  label: z.string().optional(),
  condition: conditionInputSchema.optional(),
  continueOnError: z.boolean().optional(),
  collapsed: z.boolean().optional(),
  raw: z.string().optional().describe("The action's <Action> XML, for codes without a spec"),
  index: z.number().int().optional(),
  depth: z.number().int().optional(),
});

export type ActionInput = z.infer<typeof actionInputSchema>;
export type ConditionInput = z.infer<typeof conditionInputSchema>;

export function specLookup(spec: SpecIndex): SpecLookup {
  return (code) => spec.byCode(code);
}

const INT_RE = /^-?\d+$/;

function argList(spec: ActionSpec): string {
  return spec.args.map((a) => `${a.id} "${a.name}"`).join(", ");
}

/** Find the spec arg a caller's key means: id, "argN", name, label, or a unique name prefix. */
export function resolveArgKey(spec: ActionSpec, key: string): ArgSpec | number {
  const k = key.trim();
  const m = /^(?:arg)?(\d+)$/i.exec(k);
  if (m) {
    const id = Number(m[1]);
    return spec.args.find((a) => a.id === id) ?? id;
  }
  const n = normName(k);
  const exact = spec.args.find((a) => normName(a.name) === n || normName(a.label ?? "") === n);
  if (exact) return exact;
  const stripped = spec.args.find((a) => normName(a.name.replace(/\([^)]*\)/g, "")) === n);
  if (stripped) return stripped;
  const prefix = spec.args.filter((a) => n !== "" && normName(a.name).startsWith(n));
  if (prefix.length === 1) return prefix[0] as ArgSpec;
  throw new ToolError(
    `${spec.name} (${spec.code}) has no arg "${key}"`,
    `use an arg id or name: ${argList(spec)}`,
  );
}

function rawTag(raw: string, where: string): string {
  try {
    return parseFragment(raw).name;
  } catch (e) {
    throw new ToolError(`${where}: invalid raw XML: ${(e as Error).message}`);
  }
}

function asBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === 0 || v === 1) return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(s)) return true;
    if (["false", "0", "no", "off"].includes(s)) return false;
  }
  return undefined;
}

/** An explicit ArgJson-like object ({kind, value} / {kind: "Raw", raw}) passes through. */
function explicitArg(id: number, v: unknown, where: string): ArgJson | undefined {
  if (v === null || typeof v !== "object" || Array.isArray(v) || !("kind" in v)) return undefined;
  const o = v as { kind: unknown; value?: unknown; raw?: unknown; tag?: unknown };
  switch (o.kind) {
    case "Str":
      return { id, kind: "Str", value: String(o.value ?? "") };
    case "Int":
      if (typeof o.value === "number" || typeof o.value === "string") {
        return { id, kind: "Int", value: o.value };
      }
      break;
    case "Bool": {
      const b = asBool(o.value);
      if (b !== undefined) return { id, kind: "Bool", value: b };
      break;
    }
    case "Raw":
      if (typeof o.raw === "string") {
        return {
          id,
          kind: "Raw",
          tag: typeof o.tag === "string" ? o.tag : rawTag(o.raw, where),
          raw: o.raw,
        };
      }
      break;
  }
  throw new ToolError(
    `${where}: arg${id} is not a valid {kind, value} object`,
    'use {kind: "Str"|"Int"|"Bool", value} or {kind: "Raw", raw: "<...>"}',
  );
}

/** Coerce one caller value to an ArgJson by the spec type (or by the JS type when unknown). */
export function coerceArg(
  id: number,
  value: unknown,
  spec: ArgSpec | undefined,
  where: string,
): ArgJson {
  const explicit = explicitArg(id, value, where);
  if (explicit !== undefined) return explicit;
  const label = spec === undefined ? `arg${id}` : `arg${id} "${spec.name}"`;
  const bad = (want: string): ToolError =>
    new ToolError(`${where}: ${label} needs ${want}, got ${JSON.stringify(value)}`);
  if (spec === undefined) {
    if (typeof value === "boolean") return { id, kind: "Bool", value };
    if (typeof value === "number") return { id, kind: "Int", value };
    if (typeof value === "string") {
      if (value.trim().startsWith("<"))
        return { id, kind: "Raw", tag: rawTag(value, where), raw: value };
      return { id, kind: "Str", value };
    }
    throw bad("a string, number or boolean");
  }
  switch (spec.type) {
    case ArgType.Int:
      if (typeof value === "number" && Number.isInteger(value)) return { id, kind: "Int", value };
      if (typeof value === "string") {
        const s = value.trim();
        return { id, kind: "Int", value: INT_RE.test(s) ? Number(s) : value };
      }
      throw bad('an integer or a "%variable"');
    case ArgType.Boolean: {
      const b = asBool(value);
      if (b !== undefined) return { id, kind: "Bool", value: b };
      if (typeof value === "string" && value.includes("%")) return { id, kind: "Int", value };
      throw bad("true or false");
    }
    case ArgType.String:
    case ArgType.Scene:
      if (typeof value === "string") return { id, kind: "Str", value };
      if (typeof value === "number" || typeof value === "boolean") {
        return { id, kind: "Str", value: String(value) };
      }
      throw bad("a string");
    default: {
      // App, Icon, Bundle: only raw XML can express them.
      if (typeof value === "string" && value.trim().startsWith("<")) {
        return { id, kind: "Raw", tag: rawTag(value, where), raw: value };
      }
      const tag = spec.type === ArgType.App ? "App" : spec.type === ArgType.Icon ? "Img" : "Bundle";
      throw new ToolError(
        `${where}: ${label} is a ${tag} arg and needs raw XML like <${tag} sr="arg${id}">...</${tag}>`,
        "build it in the Tasker GUI, export, and copy the element",
      );
    }
  }
}

/**
 * Condition joiners as get_task reports them (the `<boolN>` text, lower case).
 * The Tasker GUI offers And, Or, Xor and a "High Precedence" variant of each,
 * written `And2`/`Or2`/`Xor2` and shown as `&+`, `|+`, `X|+` in the task
 * editor (verified on Tasker 6.6.20, see docs/conformance.md).
 */
const JOINS: Record<string, string> = {
  and: "and",
  or: "or",
  xor: "xor",
  and2: "and2",
  or2: "or2",
  xor2: "xor2",
  "&": "and",
  "|": "or",
  "x|": "xor",
  "and+": "and2",
  "or+": "or2",
  "xor+": "xor2",
  "&+": "and2",
  "|+": "or2",
  "x|+": "xor2",
  "and (high precedence)": "and2",
  "or (high precedence)": "or2",
  "xor (high precedence)": "xor2",
};

/** Normalize a caller's join ("and", "Or2", "&+", "Xor (High Precedence)") or undefined. */
export function joinByName(j: string): string | undefined {
  return JOINS[j.trim().toLowerCase().replace(/\s+/g, " ")];
}

export function conditionFromInput(c: ConditionInput, where: string): ConditionListJson {
  const out: ConditionListJson = {
    conditions: c.conditions.map((x, i) => {
      const info = typeof x.op === "number" ? opByCode(x.op) : opByName(x.op);
      if (info === undefined) {
        throw new ToolError(
          `${where}: condition ${i} has unknown operator ${JSON.stringify(x.op)}`,
          'use a code 0-13 or a name such as "eq", "neq", "~", "~R", "<", ">", "=", "Set", "!Set"',
        );
      }
      return {
        lhs: x.lhs,
        op: info.code,
        opName: info.name,
        rhs: info.takesRhs ? (x.rhs ?? "") : "",
      };
    }),
  };
  if (c.joins !== undefined && c.joins.length > 0) {
    out.joins = c.joins.map((j) => {
      const v = joinByName(j);
      if (v === undefined) {
        throw new ToolError(
          `${where}: condition join "${j}" must be and, or, or xor (or and2, or2, xor2 for the high-precedence forms)`,
        );
      }
      return v;
    });
  }
  return out;
}

/** One caller action as ActionJson. Unknown codes need `raw`. */
export function actionFromInput(spec: SpecIndex, input: ActionInput, index: number): ActionJson {
  const where = `action ${index}`;
  const lookup = specLookup(spec);
  let base: ActionJson | undefined;
  if (input.raw !== undefined) {
    let el: XmlElement;
    try {
      el = parseFragment(input.raw);
    } catch (e) {
      throw new ToolError(`${where}: invalid raw XML: ${(e as Error).message}`);
    }
    if (el.name !== "Action") {
      throw new ToolError(`${where}: raw XML must be an <Action> element, got <${el.name}>`);
    }
    base = actionToJson(el, lookup);
    if (input.code !== undefined && input.code !== base.code) {
      throw new ToolError(`${where}: code ${input.code} does not match the raw XML's ${base.code}`);
    }
  }

  let actionSpec: ActionSpec | undefined;
  let code: number;
  if (base !== undefined) {
    code = base.code;
    actionSpec = spec.byCode(code);
  } else if (input.code !== undefined) {
    code = input.code;
    actionSpec = spec.byCode(code);
    if (actionSpec === undefined) {
      throw new ToolError(
        spec.isPlugin(code)
          ? `${where}: action code ${code} is a plugin action; pass its raw XML`
          : `Unknown action code ${code}; use get_action_spec or pass raw XML`,
        "search_actions finds codes by name",
      );
    }
  } else {
    const nm = input.action ?? input.name;
    if (nm === undefined) {
      throw new ToolError(`${where}: give a code, an action name, or raw XML`);
    }
    const r = spec.resolve(nm);
    if ("error" in r) {
      const did = r.suggestions.map((s) => `${s.name} (${s.code})`).join(", ");
      throw new ToolError(`${where}: ${r.error}`, did ? `did you mean: ${did}` : undefined);
    }
    actionSpec = r.spec;
    code = r.spec.code;
    if (normName(nm) === normName(ELSE_IF_NAME) && input.condition === undefined) {
      throw new ToolError(
        `${where}: "${ELSE_IF_NAME}" is an Else (43) with a condition; give it a condition`,
        `or use "Else" for a plain Else`,
      );
    }
  }

  const action: ActionJson = base ?? { code, args: [] };
  if (base === undefined && actionSpec !== undefined) action.name = actionSpec.name;
  if (input.args !== undefined) {
    const args = new Map<number, ArgJson>(action.args.map((a) => [a.id, a]));
    if (Array.isArray(input.args)) {
      for (const a of input.args) {
        const id = typeof a["id"] === "number" ? a["id"] : Number(a["id"]);
        if (!Number.isInteger(id))
          throw new ToolError(`${where}: every arg in the array needs an id`);
        const conv = explicitArg(id, a, where);
        if (conv === undefined) throw new ToolError(`${where}: arg${id} needs a kind`);
        if (typeof a["name"] === "string") conv.name = a["name"];
        args.set(id, conv);
      }
    } else {
      for (const [key, value] of Object.entries(input.args)) {
        let argSpec: ArgSpec | undefined;
        let id: number;
        if (actionSpec === undefined) {
          const m = /^(?:arg)?(\d+)$/i.exec(key.trim());
          if (!m) {
            throw new ToolError(`${where}: code ${code} has no spec; key args by id ("arg0", "1")`);
          }
          id = Number(m[1]);
        } else {
          const r = resolveArgKey(actionSpec, key);
          if (typeof r === "number") id = r;
          else {
            argSpec = r;
            id = r.id;
          }
        }
        const arg = coerceArg(id, value, argSpec, where);
        if (argSpec !== undefined) arg.name = argSpec.name;
        args.set(id, arg);
      }
    }
    action.args = [...args.values()].sort((a, b) => a.id - b.id);
  }
  if (base === undefined && actionSpec !== undefined) fillDefaults(action, actionSpec);
  if (input.enabled !== undefined) action.enabled = input.enabled;
  if (input.label !== undefined) action.label = input.label;
  if (input.continueOnError !== undefined) action.continueOnError = input.continueOnError;
  if (input.collapsed !== undefined) action.collapsed = input.collapsed;
  if (input.condition !== undefined) action.condition = conditionFromInput(input.condition, where);
  action.index = index;
  return action;
}

/**
 * Add the Int and Boolean args the caller left out, with their spec
 * defaults, so validation does not reject an omitted "Max Rounding Digits".
 * Strings, apps, icons and bundles stay absent: a missing mandatory one is a
 * real error.
 */
export function fillDefaults(action: ActionJson, spec: ActionSpec): void {
  const have = new Set(action.args.map((a) => a.id));
  for (const s of spec.args) {
    if (have.has(s.id)) continue;
    const gui = guiDefault(spec.code, s.id);
    if (typeof gui === "boolean" && s.type === ArgType.Boolean) {
      action.args.push({ id: s.id, name: s.name, kind: "Bool", value: gui });
    } else if (gui !== undefined && typeof gui !== "boolean" && s.type === ArgType.Int) {
      action.args.push({ id: s.id, name: s.name, kind: "Int", value: gui });
    } else if (s.type === ArgType.Int)
      action.args.push({ id: s.id, name: s.name, kind: "Int", value: intDefault(s) });
    else if (s.type === ArgType.Boolean) {
      action.args.push({ id: s.id, name: s.name, kind: "Bool", value: boolDefault(s) });
    }
  }
  action.args.sort((a, b) => a.id - b.id);
}

export function actionsFromInput(spec: SpecIndex, inputs: ActionInput[]): ActionJson[] {
  return inputs.map((a, i) => actionFromInput(spec, a, i));
}

// ---------------------------------------------------------------------------
// Config document helpers
// ---------------------------------------------------------------------------

const ROOT_ORDER = ["dmetric", "Profile", "Project", "Scene", "Task"];

function rank(name: string): number {
  const i = ROOT_ORDER.indexOf(name);
  return i < 0 ? ROOT_ORDER.length : i;
}

/** Re-sort and re-indent a top-level object after editing its children. */
export function tidy(el: XmlElement): XmlElement {
  sortChildren(el);
  el.selfClosing = false;
  return formatElement(el, OBJECT_DEPTH);
}

/** Insert a top-level element where Tasker would write it (after the last of its kind). */
export function insertRoot(doc: TaskerDoc, el: XmlElement): void {
  const kids = doc.root.children;
  let after = -1;
  let firstEl = -1;
  kids.forEach((k, i) => {
    if (k.type !== "element") return;
    if (firstEl < 0) firstEl = i;
    if (rank(k.name) <= rank(el.name)) after = i;
  });
  if (after >= 0) {
    kids.splice(after + 1, 0, textNode("\n\t"), el);
  } else if (firstEl >= 0) {
    kids.splice(firstEl, 0, el, textNode("\n\t"));
  } else {
    insertChildElement(doc.root, el);
  }
}

/** Remove a top-level element with its indentation. */
export function removeRoot(doc: TaskerDoc, el: XmlElement): void {
  removeChild(doc.root, el);
}

/** Replace a top-level element in place. */
export function replaceRoot(doc: TaskerDoc, old: XmlElement, next: XmlElement): void {
  const kids = doc.root.children;
  const i = kids.indexOf(old);
  if (i < 0) insertRoot(doc, next);
  else kids[i] = next;
}

type ListTag = "tids" | "pids" | "scenes";

function readList(project: XmlElement, tag: ListTag): string[] {
  const t = childText(project, tag);
  return tag === "scenes" ? parseNameList(t) : parseIdList(t).map(String);
}

function writeList(project: XmlElement, tag: ListTag, values: string[]): void {
  const existing = child(project, tag);
  if (values.length === 0) {
    if (existing !== undefined) removeChild(project, existing);
    return;
  }
  if (existing === undefined) {
    setChildText(project, tag, values.join(","));
    tidy(project);
  } else {
    setChildText(project, tag, values.join(","));
  }
}

export function projectName(project: XmlElement): string {
  return childText(project, "name") ?? "";
}

/** Where a member is listed first: [project name, position], without changing anything. */
export function locateInProjects(
  doc: TaskerDoc,
  tag: ListTag,
  member: string | number,
): { project: string; position: number } | undefined {
  for (const p of doc.projects()) {
    const pos = readList(p, tag).indexOf(String(member));
    if (pos >= 0) return { project: projectName(p), position: pos };
  }
  return undefined;
}

/** Remove a member from every project's list. Returns [project name, position] where it was. */
export function removeFromProjects(
  doc: TaskerDoc,
  tag: ListTag,
  member: string | number,
): { project: string; position: number } | undefined {
  const m = String(member);
  let found: { project: string; position: number } | undefined;
  for (const p of doc.projects()) {
    const list = readList(p, tag);
    const pos = list.indexOf(m);
    if (pos < 0) continue;
    found ??= { project: projectName(p), position: pos };
    writeList(
      p,
      tag,
      list.filter((x) => x !== m),
    );
  }
  return found;
}

/** A new empty project element. */
export function newProject(doc: TaskerDoc, name: string, now: number = Date.now()): XmlElement {
  const el = createElement("Project", { sr: `proj${doc.projects().length}`, ve: "2" }, []);
  setChildText(el, "cdate", String(now));
  setChildText(el, "name", name);
  tidy(el);
  insertRoot(doc, el);
  return el;
}

/** Find a project by name, creating it when missing. */
export function ensureProject(doc: TaskerDoc, name: string): XmlElement {
  return doc.projectByName(name) ?? newProject(doc, name);
}

/** Add a member to a project's list (at `position`, else at the end), removing it elsewhere first. */
export function moveToProject(
  doc: TaskerDoc,
  tag: ListTag,
  member: string | number,
  project: string,
  position?: number,
): void {
  removeFromProjects(doc, tag, member);
  const p = ensureProject(doc, project);
  const list = readList(p, tag);
  const at = position === undefined ? list.length : Math.min(position, list.length);
  list.splice(at, 0, String(member));
  writeList(p, tag, list);
}

/** Every element under a Scene whose name ends in "Task" and holds a task id. */
function sceneTaskRefs(el: XmlElement, out: XmlElement[] = []): XmlElement[] {
  for (const k of children(el)) {
    if (/Task$/.test(k.name) && INT_RE.test(textOf(k))) out.push(k);
    sceneTaskRefs(k, out);
  }
  return out;
}

/** Task ids a scene references (click / long-click / ... handlers). */
export function sceneTaskIds(scene: XmlElement): number[] {
  return sceneTaskRefs(scene)
    .map((k) => Number(textOf(k)))
    .filter((n) => Number.isInteger(n));
}

function textOf(el: XmlElement): string {
  return el.children
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();
}

/** Rewrite a scene's task refs through `map` (old id -> new id), all at once. */
export function remapSceneTaskRefs(scene: XmlElement, map: Map<number, number>): void {
  for (const ref of sceneTaskRefs(scene)) {
    const to = map.get(Number(textOf(ref)));
    if (to !== undefined) ref.children = [textNode(String(to))];
  }
}

/** Point every profile mid0/mid1 and scene task ref at `to` instead of `from`. */
export function remapTaskRefs(doc: TaskerDoc, from: number, to: number): void {
  for (const p of doc.profiles()) {
    for (const tag of ["mid0", "mid1"]) {
      if (childText(p, tag)?.trim() === String(from)) setChildText(p, tag, String(to));
    }
  }
  for (const s of doc.scenes()) {
    for (const ref of sceneTaskRefs(s)) {
      if (textOf(ref) === String(from)) ref.children = [textNode(String(to))];
    }
  }
}

/** Names of profiles whose entry or exit task is `id`. */
export function profilesUsingTask(doc: TaskerDoc, id: number): string[] {
  return doc
    .profiles()
    .filter((p) => ["mid0", "mid1"].some((t) => childText(p, t)?.trim() === String(id)))
    .map((p) => TaskerDoc.nameOf(p) || `#${TaskerDoc.idOf(p)}`);
}

/** Remove a task element and its id from every project. */
export function deleteTaskElement(doc: TaskerDoc, el: XmlElement): void {
  const id = TaskerDoc.idOf(el);
  removeRoot(doc, el);
  if (id !== undefined) removeFromProjects(doc, "tids", id);
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export interface MutationResult {
  ok: boolean;
  task?: string;
  taskId?: number;
  isNew?: boolean;
  project?: string;
  /** What changed, as a diff summary. */
  changed: string[];
  warnings: string[];
  /** Id of the snapshot taken before the change (restore_snapshot undoes it). */
  snapshot?: string;
  /** True when the task read back from the phone matches what was asked for. */
  verified: boolean;
  /** Stale duplicate task ids deleted after the import. */
  duplicatesRemoved?: number[];
  renamedFrom?: string;
  /** Set when the task should move to this project but config imports are disabled. */
  targetProject?: string;
}

export interface ApplyTaskOptions {
  tool: string;
  label?: string;
  /** Validate against the spec table first (default true). Errors abort. */
  validate?: boolean;
  /** Current name when renaming to desired.name. */
  baseName?: string;
  /** Save a snapshot before the change (default true; false only fetches a backup). */
  saveSnapshot?: boolean;
  /**
   * Import this Task element as is (its id is fixed up) instead of planning
   * one from `desired` (import_xml). `desired` is then what verify compares.
   */
  element?: XmlElement;
  /** Call ctx.toolsChanged() afterwards (default true; the scratch task skips it). */
  notify?: boolean;
}

export function formatIssue(i: Issue): string {
  const at = i.index === undefined ? "" : `action ${i.index}: `;
  return `${at}${i.message}${i.hint ? ` (${i.hint})` : ""}`;
}

/** validateTask; throws a ToolError carrying every error, returns the warnings. */
export function validateOrThrow(spec: SpecIndex, task: TaskJson): string[] {
  const v = validateTask(task, spec);
  if (v.errors.length > 0) {
    throw new ToolError(
      `Task "${task.name}" failed validation: ${v.errors.map(formatIssue).join("; ")}`,
      "fix the actions (get_action_spec shows each action's args) or pass validate: false",
    );
  }
  return v.warnings.map(formatIssue);
}

/** Adapter over planReplaceTask so the call shape lives in one place. */
export function planTask(
  doc: TaskerDoc,
  desired: TaskJson,
  lookup: SpecLookup,
  baseName?: string,
): ReplacePlan {
  try {
    return planReplaceTask(doc, desired, lookup, baseName === undefined ? {} : { baseName });
  } catch (e) {
    if (e instanceof ToolError) throw e;
    throw new ToolError((e as Error).message);
  }
}

/** A plan for importing a prepared Task element verbatim (import_xml). */
function planElement(doc: TaskerDoc, el: XmlElement): ReplacePlan {
  const name = TaskerDoc.nameOf(el);
  const existing = doc.taskByName(name);
  const existingId = existing === undefined ? undefined : TaskerDoc.idOf(existing);
  const taskId = existingId ?? doc.nextFreeId();
  const element = cloneNode(el);
  setChildText(element, "id", String(taskId));
  setAttr(element, "sr", `task${taskId}`);
  const plan: ReplacePlan = {
    xml: wrapForImport([element], doc.taskerVersion ?? "6.6.20"),
    taskId,
    isNew: existingId === undefined,
    element,
    warnings: [],
  };
  const projectEl = existingId === undefined ? undefined : doc.projectOfTask(existingId);
  plan.project = projectEl === undefined ? BASE_PROJECT : projectName(projectEl);
  return plan;
}

async function snapshotOrBackup(
  ctx: ToolContext,
  tool: string,
  label: string,
  save: boolean,
): Promise<{ doc: TaskerDoc; info?: SnapshotInfo }> {
  if (save) {
    const s: Snapshot = await ctx.snapshot(tool, label);
    return { doc: s.doc, info: s.info };
  }
  return { doc: (await ctx.backup()).doc };
}

/**
 * Create or replace one task by name and verify it on the phone. See the
 * module doc for the steps. Holds the mutation lock.
 */
export function applyTask(
  ctx: ToolContext,
  desired: TaskJson,
  opts: ApplyTaskOptions,
): Promise<MutationResult> {
  return exclusive(async () => {
    const name = desired.name;
    if (name.trim() === "") throw new ToolError("A task needs a name");
    ctx.assertWritable("task", name);
    if (opts.baseName !== undefined && opts.baseName !== name) {
      ctx.assertWritable("task", opts.baseName);
      // A rename deletes the old task afterwards, which needs a config import.
      ctx.assertWritable("config", `rename task ${opts.baseName}`);
    }
    const warnings = opts.validate === false ? [] : validateOrThrow(ctx.spec, desired);
    const lookup = specLookup(ctx.spec);
    const label = opts.label ?? `${opts.tool} ${name}`;
    const snap = await snapshotOrBackup(ctx, opts.tool, label, opts.saveSnapshot !== false);
    const before = snap.doc.taskByName(opts.baseName ?? name);
    const plan =
      opts.element === undefined
        ? planTask(snap.doc, desired, lookup, opts.baseName)
        : planElement(snap.doc, opts.element);
    warnings.push(...plan.warnings);

    const client = await ctx.client();
    await client.importXml(plan.xml);
    let fresh = (await ctx.backup()).doc;

    // Which copy is ours: the one matching the request, else the planned id, else the newest.
    // Work with elements, not ids: a rename payload carries the old task's id, and
    // the phone may keep it, so two tasks can share an id.
    const candidates = fresh.tasks().filter((el) => TaskerDoc.nameOf(el) === name);
    if (candidates.length === 0) {
      throw new ToolError(
        `The import reported success but no task named "${name}" is on the phone`,
        "check Tasker on the phone; the snapshot " +
          (snap.info?.id ?? "") +
          " holds the previous state",
      );
    }
    const json = new Map(candidates.map((el) => [el, taskToJson(el, lookup)]));
    const matching = candidates.filter(
      (el) => diffTasks(desired, json.get(el) as TaskJson, lookup).equal,
    );
    const isPlanned = (el: XmlElement): boolean => TaskerDoc.idOf(el) === plan.taskId;
    const keep = (matching.find(isPlanned) ??
      matching[matching.length - 1] ??
      candidates.find(isPlanned) ??
      candidates[candidates.length - 1]) as XmlElement;
    const keepId = TaskerDoc.idOf(keep) as number;
    const staleEls = candidates.filter((el) => el !== keep);
    const stale = staleEls.map((el) => TaskerDoc.idOf(el) as number);

    const actual = json.get(keep) as TaskJson;
    const verify = diffTasks(desired, actual, lookup);
    for (const d of verify.differences) warnings.push(`verify: ${d}`);

    const changed: string[] = [];
    if (plan.renamedFrom !== undefined) {
      changed.push(`renamed ${JSON.stringify(plan.renamedFrom.name)} to ${JSON.stringify(name)}`);
    }
    if (before === undefined) {
      changed.push(`created task ${JSON.stringify(name)} with ${actual.actions.length} actions`);
    } else {
      const d = diffTasks({ ...taskToJson(before, lookup), name }, actual, lookup);
      changed.push(...d.differences);
      if (changed.length === 0) changed.push("no changes");
    }

    const result: MutationResult = {
      ok: true,
      task: name,
      taskId: keepId,
      isNew: before === undefined,
      changed,
      warnings,
      verified: verify.equal,
    };
    if (snap.info !== undefined) result.snapshot = snap.info.id;
    if (plan.renamedFrom !== undefined) result.renamedFrom = plan.renamedFrom.name;

    // One follow-up config import for duplicates, the rename, and the project move.
    const needMove = plan.targetProject !== undefined;
    const oldTask =
      plan.renamedFrom === undefined ? undefined : fresh.taskByName(plan.renamedFrom.name);
    if (stale.length > 0 || oldTask !== undefined || needMove) {
      if (!ctx.policy.allowConfigImport) {
        if (stale.length > 0) {
          warnings.push(
            `duplicate tasks named ${JSON.stringify(name)} remain (ids ${stale.join(", ")}); config import is disabled so they cannot be deleted here`,
          );
        }
        if (needMove) {
          result.targetProject = plan.targetProject as string;
          warnings.push(
            `the task is in project ${BASE_PROJECT}; moving it to ${plan.targetProject} needs a config import, which is disabled`,
          );
        }
      } else {
        for (const el of staleEls) {
          const id = TaskerDoc.idOf(el) as number;
          removeRoot(fresh, el);
          if (id !== keepId) {
            removeFromProjects(fresh, "tids", id);
            remapTaskRefs(fresh, id, keepId);
          }
        }
        if (stale.length > 0) result.duplicatesRemoved = stale;
        let target = plan.targetProject;
        let position: number | undefined;
        if (oldTask !== undefined) {
          const oldId = TaskerDoc.idOf(oldTask) as number;
          // Where the old task sat before the import; the renamed task takes that slot.
          const where = locateInProjects(snap.doc, "tids", oldId);
          // When the phone kept the payload's (old) id, refs already point at the new task.
          if (oldId !== keepId) {
            remapTaskRefs(fresh, oldId, keepId);
            removeFromProjects(fresh, "tids", oldId);
          }
          removeRoot(fresh, oldTask);
          if (where !== undefined && (target === undefined || target === where.project)) {
            target = where.project;
            position = where.position;
          }
        }
        if (target !== undefined) moveToProject(fresh, "tids", keepId, target, position);
        await ctx.replaceConfig(fresh.serialize());
        fresh = (await ctx.backup()).doc;
        const after = findDuplicates(fresh, "task", name);
        if (after.length !== 1) {
          warnings.push(
            `after cleanup the phone holds ${after.length} tasks named ${JSON.stringify(name)}`,
          );
        }
        if (oldTask !== undefined && plan.renamedFrom !== undefined) {
          if (fresh.taskByName(plan.renamedFrom.name) !== undefined) {
            warnings.push(
              `the old task ${JSON.stringify(plan.renamedFrom.name)} is still on the phone`,
            );
          }
        }
      }
    }
    const finalEl = fresh.taskByName(name);
    const finalId = finalEl === undefined ? undefined : TaskerDoc.idOf(finalEl);
    if (finalId !== undefined) {
      result.taskId = finalId;
      const p = fresh.projectOfTask(finalId);
      if (p !== undefined) result.project = projectName(p);
    }
    if (opts.notify !== false) ctx.toolsChanged();
    return result;
  });
}

export interface ConfigEditResult<R> {
  /** The configuration read back from the phone after the import. */
  doc: TaskerDoc;
  snapshot: SnapshotInfo;
  result: R;
}

/**
 * Edit the whole configuration: snapshot, let `fn` mutate a TaskerDoc built
 * from it, POST /config, re-fetch. Throws before the snapshot when config
 * imports are disabled. Holds the mutation lock.
 */
export function withConfigEdit<R>(
  ctx: ToolContext,
  tool: string,
  label: string,
  fn: (doc: TaskerDoc) => R | Promise<R>,
): Promise<ConfigEditResult<R>> {
  return exclusive(async () => {
    ctx.assertWritable("config", label);
    const snap = await ctx.snapshot(tool, label);
    const doc = TaskerDoc.parse(snap.xml);
    const result = await fn(doc);
    await ctx.replaceConfig(doc.serialize());
    const fresh = await ctx.backup();
    return { doc: fresh.doc, snapshot: snap.info, result };
  });
}

/** Parse XML for a tool, turning parse errors into ToolErrors with a hint. */
export function parseTaskerXml(xml: string, what = "XML"): TaskerDoc {
  try {
    return TaskerDoc.parse(xml);
  } catch (e) {
    const msg = e instanceof XmlParseError || e instanceof Error ? e.message : String(e);
    throw new ToolError(
      `Invalid ${what}: ${msg}`,
      "pass a TaskerData document as Tasker exports it",
    );
  }
}
