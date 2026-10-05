/**
 * Conversion between Tasker XML elements (src/xml DOM) and the structured JSON
 * view (src/model/types.ts).
 *
 * The guarantee: for every Task element, taskToJson -> taskFromJson ->
 * taskToJson yields the same JSON (with `fillDefaults: false`; with defaults
 * filled the only additions are spec default args, which verify.ts ignores).
 * Generated XML follows Tasker's own layout so a generated file looks like an
 * export: tab indentation, `sr` / `ve` / `val` attribute order, and child order
 * "plain tags alphabetically, then `sr`-keyed children sorted
 * lexicographically by `sr`" (act0, act1, act10, act2; arg* before `if`;
 * act* before icn before pv*). See docs/tasker-xml-format.md.
 *
 * Anything not understood travels as raw XML: unknown arg elements become
 * `{kind: "Raw"}`, and an action with an unknown code or an unrecognized child
 * keeps its whole XML in `raw`. actionToElement writes that back verbatim
 * unless the structured fields next to it were edited; then it applies the
 * edits onto the parsed raw element and keeps every other child as-is.
 */

import { computeDepths, PLUGIN_CODE_MIN } from "../edit/blocks.ts";
import type { ActionSpec, ArgSpec } from "../spec/types.ts";
import {
  attr,
  childText,
  children,
  cloneNode,
  createElement,
  elementText,
  escapeAttr,
  parseFragment,
  serializeElement,
  setAttr,
  textNode,
  type XmlElement,
  type XmlNode,
} from "../xml/index.ts";
import { opByCode } from "./ops.ts";
import type {
  ActionJson,
  ArgJson,
  ConditionJson,
  ConditionListJson,
  ProfileContextJson,
  ProfileJson,
  ProjectJson,
  TaskJson,
} from "./types.ts";

/** Spec lookup by action code; decoupled from src/spec/table.ts on purpose. */
export type SpecLookup = (code: number) => ActionSpec | undefined;

/** MapTasker arg type codes (src/spec/types.ts ArgType), repeated to keep this module decoupled. */
const T_INT = 0;
const T_STRING = 1;
const T_APP = 2;
const T_BOOLEAN = 3;
const T_ICON = 4;
const T_SCENE = 6;
// Bundle (5) has no default element: see defaultArgElement.

/** Depth of an `<Action>` in any TaskerData file: TaskerData > Task > Action. */
export const ACTION_DEPTH = 2;
/** Depth of a top-level object (`Task`, `Profile`, ...) in a TaskerData file. */
export const OBJECT_DEPTH = 1;

const ACTION_KNOWN = new Set(["code", "coll", "label", "on", "se", "ConditionList"]);
const INT_RE = /^-?\d+$/;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Elements that already carry their own whitespace (parsed fragments, clones); never reformatted. */
const verbatim = new WeakSet<XmlElement>();

function markVerbatim(el: XmlElement): XmlElement {
  verbatim.add(el);
  return el;
}

/** Numeric suffix of an `sr` like "act12" for the given prefix, or undefined. */
export function srIndex(sr: string | undefined, prefix: string): number | undefined {
  if (sr === undefined || !sr.startsWith(prefix)) return undefined;
  const rest = sr.slice(prefix.length);
  return /^\d+$/.test(rest) ? Number(rest) : undefined;
}

/** Comma separated id list (`<tids>`, `<pids>`) as numbers. */
export function parseIdList(csv: string | undefined): number[] {
  if (csv === undefined) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => INT_RE.test(s))
    .map(Number);
}

/** Comma separated name list (`<scenes>`). */
export function parseNameList(csv: string | undefined): string[] {
  if (csv === undefined) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

function intText(el: XmlElement, name: string): number | undefined {
  const t = childText(el, name)?.trim();
  return t !== undefined && INT_RE.test(t) ? Number(t) : undefined;
}

/** A leaf element `<name>text</name>`; empty text gives `<name></name>` unless selfClose. */
function leaf(name: string, text: string, selfClose = false): XmlElement {
  const el = createElement(name, undefined, text === "" ? [] : [textNode(text)]);
  el.selfClosing = text === "" && selfClose;
  return el;
}

function hasOnlyAttrs(el: XmlElement, names: string[]): boolean {
  return el.attrs.length === names.length && el.attrs.every((a, i) => a.name === names[i]);
}

function hasElementChildren(el: XmlElement): boolean {
  return el.children.some((c) => c.type === "element");
}

function isWhitespace(n: XmlNode): boolean {
  return n.type === "text" && /^[ \t\r\n]*$/.test(n.text);
}

/**
 * Sort children Tasker style: plain tags alphabetically, then `sr`-keyed
 * children lexicographically by `sr`. Stable; drops whitespace text (call
 * formatElement afterwards).
 */
export function sortChildren(el: XmlElement): void {
  const kids = children(el);
  const plain = kids.filter((c) => attr(c, "sr") === undefined);
  const keyed = kids.filter((c) => attr(c, "sr") !== undefined);
  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  plain.sort((a, b) => cmp(a.name, b.name));
  keyed.sort((a, b) => cmp(attr(a, "sr") ?? "", attr(b, "sr") ?? ""));
  el.children = [...plain, ...keyed];
}

/**
 * Indent `el` (sitting at `depth` tabs) the way Tasker exports do: each
 * element child on its own line at depth + 1, the end tag at depth. Leaf
 * elements (text only) are left alone, as are elements created from raw XML
 * (they already carry whitespace for their fixed depth). Returns `el`.
 */
export function formatElement(el: XmlElement, depth: number): XmlElement {
  if (verbatim.has(el) || !hasElementChildren(el)) return el;
  if (el.children.some((c) => c.type !== "element" && !isWhitespace(c))) return el;
  const inner = "\n" + "\t".repeat(depth + 1);
  const out: XmlNode[] = [];
  for (const c of children(el)) {
    out.push(textNode(inner), formatElement(c, depth + 1));
  }
  out.push(textNode("\n" + "\t".repeat(depth)));
  el.children = out;
  el.selfClosing = false;
  return el;
}

function capitalize(s: string): string {
  return s === "" ? s : s[0]!.toUpperCase() + s.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// XML -> JSON
// ---------------------------------------------------------------------------

export interface ToJsonOptions {
  /** Project name to put on the TaskJson. */
  project?: string;
  /** Operator code -> name; defaults to src/model/ops.ts. */
  opName?: (op: number) => string | undefined;
}

/** True for a plugin action: not in the spec table and code >= 1000. */
export function isPluginCode(code: number, lookup: SpecLookup): boolean {
  return lookup(code) === undefined && code >= PLUGIN_CODE_MIN;
}

/** One `<Str|Int|Bundle|App|Img sr="argN">` as ArgJson. Never fails: unknown shapes are Raw. */
export function argToJson(el: XmlElement, id: number, spec?: ArgSpec): ArgJson {
  const name = spec?.name;
  // Key order id, name, kind, value: what an agent reads first.
  const named = <T extends ArgJson>(a: T): T =>
    name === undefined ? a : (Object.assign({ id: a.id, name }, a) as T);
  if (el.name === "Str" && hasOnlyAttrs(el, ["sr", "ve"]) && attr(el, "ve") === "3") {
    if (!hasElementChildren(el)) {
      return named({ id, kind: "Str", value: elementText(el) });
    }
  }
  if (el.name === "Int") {
    const val = attr(el, "val");
    if (hasOnlyAttrs(el, ["sr", "val"]) && val !== undefined && el.children.length === 0) {
      return named({ id, kind: "Int", value: INT_RE.test(val) ? Number(val) : val });
    }
    const kids = children(el);
    const v = kids[0];
    if (
      hasOnlyAttrs(el, ["sr"]) &&
      kids.length === 1 &&
      v !== undefined &&
      v.name === "var" &&
      v.attrs.length === 0 &&
      !hasElementChildren(v) &&
      el.children.every((c) => c === v || isWhitespace(c))
    ) {
      return named({ id, kind: "Int", value: elementText(v) });
    }
  }
  return named({ id, kind: "Raw", tag: el.name, raw: serializeElement(el) });
}

/** `<ConditionList sr="if">` as JSON, or undefined when it holds anything unexpected. */
export function conditionListToJson(
  el: XmlElement,
  opName: (op: number) => string | undefined = (op) => opByCode(op)?.name,
): ConditionListJson | undefined {
  const conds: Array<{ i: number; c: ConditionJson }> = [];
  const joins: Array<{ i: number; j: string }> = [];
  for (const k of children(el)) {
    const b = /^bool(\d+)$/.exec(k.name);
    if (b !== null && k.attrs.length === 0 && !hasElementChildren(k)) {
      joins.push({ i: Number(b[1]), j: elementText(k).toLowerCase() });
      continue;
    }
    const ci = srIndex(attr(k, "sr"), "c");
    if (k.name !== "Condition" || ci === undefined || attr(k, "ve") !== "3") return undefined;
    const parts = children(k);
    if (parts.some((p) => !["lhs", "op", "rhs"].includes(p.name) || hasElementChildren(p))) {
      return undefined;
    }
    const op = intText(k, "op");
    if (op === undefined) return undefined;
    const c: ConditionJson = { lhs: childText(k, "lhs") ?? "", op };
    const on = opName(op);
    if (on !== undefined) c.opName = on;
    c.rhs = childText(k, "rhs") ?? "";
    conds.push({ i: ci, c });
  }
  conds.sort((a, b) => a.i - b.i);
  joins.sort((a, b) => a.i - b.i);
  const out: ConditionListJson = { conditions: conds.map((x) => x.c) };
  if (joins.length > 0) out.joins = joins.map((x) => x.j);
  return out;
}

/**
 * One `<Action>` as JSON. `warnings` collects unknown-code notes. The action's
 * own XML is kept in `raw` when its code is unknown (and not a plugin) or when
 * it holds a child this layer does not model, so nothing is lost.
 */
export function actionToJson(
  el: XmlElement,
  lookup: SpecLookup,
  opts: ToJsonOptions & { warnings?: string[]; index?: number } = {},
): ActionJson {
  const code = intText(el, "code") ?? -1;
  const spec = lookup(code);
  const plugin = spec === undefined && code >= PLUGIN_CODE_MIN;
  const action: ActionJson =
    opts.index === undefined ? { code, args: [] } : { index: opts.index, code, args: [] };
  if (spec !== undefined) action.name = spec.name;
  else if (plugin) action.name = "Plugin";
  action.enabled = childText(el, "on") !== "false";
  const label = childText(el, "label");
  if (label !== undefined) action.label = label;
  action.continueOnError = childText(el, "se") === "false";

  // A ve other than 7 never occurs in the fixtures; such an action stays raw
  // (still editable: see actionToElement) so its ve is written back unchanged.
  let understood = hasOnlyAttrs(el, ["sr", "ve"]) && attr(el, "ve") === "7";
  const coll = childText(el, "coll");
  if (coll === "true" || coll === "false") action.collapsed = coll === "true";
  else if (coll !== undefined) understood = false;
  const args: ArgJson[] = [];
  for (const k of children(el)) {
    const id = srIndex(attr(k, "sr"), "arg");
    if (id !== undefined) {
      const a = argToJson(
        k,
        id,
        spec?.args.find((s) => s.id === id),
      );
      args.push(a);
      continue;
    }
    if (!ACTION_KNOWN.has(k.name)) understood = false;
    if (k.name === "ConditionList") {
      const cl = attr(k, "sr") === "if" ? conditionListToJson(k, opts.opName) : undefined;
      if (cl === undefined) understood = false;
      else action.condition = cl;
    }
  }
  args.sort((a, b) => a.id - b.id);
  // Re-add args after the scalar fields so they read last.
  delete (action as { args?: ArgJson[] }).args;
  action.args = args;

  if (spec === undefined && !plugin) {
    understood = false;
    opts.warnings?.push(
      `action ${opts.index ?? "?"}: unknown action code ${code}; kept as raw XML`,
    );
  }
  if (!understood) action.raw = serializeElement(el);
  return action;
}

/** A `<Task>` as JSON, actions in numeric `actN` order with depth from If/For nesting. */
export function taskToJson(el: XmlElement, lookup: SpecLookup, opts: ToJsonOptions = {}): TaskJson {
  const warnings: string[] = [];
  const actionEls = children(el, "Action")
    .map((a, docIdx) => ({
      a,
      n: srIndex(attr(a, "sr"), "act") ?? Number.MAX_SAFE_INTEGER,
      docIdx,
    }))
    .sort((x, y) => x.n - y.n || x.docIdx - y.docIdx)
    .map((x) => x.a);
  const actions = actionEls.map((a, index) =>
    actionToJson(a, lookup, { ...opts, warnings, index }),
  );
  const depths = computeDepths(actions.map((a) => a.code));
  actions.forEach((a, i) => (a.depth = depths[i] ?? 0));

  const task: TaskJson = { name: "", actions: [] };
  const id = intText(el, "id");
  if (id !== undefined) task.id = id;
  task.name = childText(el, "nme") ?? "";
  if (opts.project !== undefined) task.project = opts.project;
  const pri = intText(el, "pri");
  if (pri !== undefined) task.priority = pri;
  const rty = intText(el, "rty");
  if (rty !== undefined) task.collision = rty;
  const pc = childText(el, "pc");
  if (pc !== undefined) task.comment = pc;
  delete (task as { actions?: ActionJson[] }).actions;
  task.actions = actions;
  if (warnings.length > 0) task.warnings = warnings;
  return task;
}

export interface ContextNames {
  event?: (code: number) => string | undefined;
  state?: (code: number) => string | undefined;
  /** Task id -> name, to report entry/exit tasks by name; anonymous tasks stay ids. */
  taskName?: (id: number) => string | undefined;
}

const CONTEXT_TAGS = new Set(["Event", "State", "App", "Time", "Day", "Loc"]);

/**
 * A `<Profile>` as JSON. Enabled is the absence of `<limit>true</limit>`:
 * MapTasker (profiles.py "Is the Profile disabled?", objprops.py "<limit> ...
 * identifies a disabled Tasker object") reads and writes the Enabled switch
 * there; `<flags>` is an unrelated bitfield (notification, collapsed,
 * restore-settings, ...).
 */
export function profileToJson(
  el: XmlElement,
  names: ContextNames = {},
  opts: { project?: string } = {},
): ProfileJson {
  const contexts: ProfileContextJson[] = [];
  for (const k of children(el)) {
    if (!CONTEXT_TAGS.has(k.name) || srIndex(attr(k, "sr"), "con") === undefined) continue;
    const ctx: ProfileContextJson = { kind: k.name, raw: serializeElement(k) };
    const code = intText(k, "code");
    if (code !== undefined) {
      ctx.code = code;
      const nm = k.name === "Event" ? names.event?.(code) : names.state?.(code);
      if (nm !== undefined) ctx.name = nm;
    }
    contexts.push(ctx);
  }
  const p: ProfileJson = { name: childText(el, "nme") ?? "", contexts };
  const id = intText(el, "id");
  if (id !== undefined) p.id = id;
  if (opts.project !== undefined) p.project = opts.project;
  p.enabled = childText(el, "limit") !== "true";
  const ref = (n: number | undefined): string | number | undefined =>
    n === undefined ? undefined : (names.taskName?.(n) ?? n);
  const entry = ref(intText(el, "mid0"));
  if (entry !== undefined) p.entryTask = entry;
  const exit = ref(intText(el, "mid1"));
  if (exit !== undefined) p.exitTask = exit;
  return p;
}

/**
 * A `<Project>` as JSON. Without resolvers, tasks and profiles are listed as
 * id strings; with them, by name (anonymous ones stay ids).
 */
export function projectToJson(
  el: XmlElement,
  resolve: {
    taskName?: (id: number) => string | undefined;
    profileName?: (id: number) => string | undefined;
  } = {},
): ProjectJson {
  const nameOr = (f: ((id: number) => string | undefined) | undefined, id: number): string => {
    const n = f?.(id);
    return n === undefined || n === "" ? String(id) : n;
  };
  const p: ProjectJson = {
    name: childText(el, "name") ?? "",
    tasks: parseIdList(childText(el, "tids")).map((id) => nameOr(resolve.taskName, id)),
    profiles: parseIdList(childText(el, "pids")).map((id) => nameOr(resolve.profileName, id)),
    scenes: parseNameList(childText(el, "scenes")),
  };
  const id = childText(el, "id");
  if (id !== undefined) p.id = id;
  return p;
}

// ---------------------------------------------------------------------------
// JSON -> XML
// ---------------------------------------------------------------------------

export interface ToElementOptions {
  /** Position in the task; becomes `sr="act<index>"`. Defaults to action.index, then 0. */
  index?: number;
  /** Emit spec args the caller omitted with their defaults (default true). */
  fillDefaults?: boolean;
  /** Collects notes (duplicate arg ids, defaults that could not be filled). */
  warnings?: string[];
  /** Indentation depth of the Action element (default 2, its depth in any TaskerData file). */
  depth?: number;
}

/**
 * Default value of an Int arg from its MapTasker spec string "min:max:default"
 * (e.g. Variable Set's Max Rounding Digits "0:10:3" -> 3), else 0 clamped to min.
 */
export function intDefault(spec: ArgSpec): number {
  const parts = (spec.spec ?? "").split(":");
  if (parts.length >= 3 && INT_RE.test(parts[2]!)) return Number(parts[2]);
  if (parts.length >= 2 && INT_RE.test(parts[0]!) && Number(parts[0]) > 0) return Number(parts[0]);
  return 0;
}

/** Default of a Boolean arg: MapTasker writes "true"/"false" in the spec string; else false. */
export function boolDefault(spec: ArgSpec): boolean {
  return spec.spec === "true";
}

/**
 * The element a spec arg takes when the caller omitted it, or undefined when
 * there is no known empty form (Bundle: no empty Bundle appears in any real
 * export, so it is left out for Tasker to fill).
 */
export function defaultArgElement(spec: ArgSpec): XmlElement | undefined {
  const sr = `arg${spec.id}`;
  switch (spec.type) {
    case T_STRING:
    case T_SCENE:
      return createElement("Str", { sr, ve: "3" });
    case T_INT:
      return createElement("Int", { sr, val: String(intDefault(spec)) });
    case T_BOOLEAN:
      return createElement("Int", { sr, val: boolDefault(spec) ? "1" : "0" });
    case T_APP:
      return createElement("App", { sr });
    case T_ICON:
      return createElement("Img", { sr, ve: "2" });
    default:
      return undefined;
  }
}

function rawElement(raw: string, sr: string): XmlElement {
  const el = parseFragment(raw);
  setAttr(el, "sr", sr);
  return markVerbatim(el);
}

/** One ArgJson as its Tasker element. */
export function argToElement(arg: ArgJson): XmlElement {
  const sr = `arg${arg.id}`;
  switch (arg.kind) {
    case "Str": {
      const el = createElement(
        "Str",
        { sr, ve: "3" },
        arg.value === "" ? [] : [textNode(arg.value)],
      );
      return el;
    }
    case "Int": {
      const v = String(arg.value);
      if (INT_RE.test(v)) return createElement("Int", { sr, val: v });
      const el = createElement("Int", { sr }, [leaf("var", v)]);
      el.selfClosing = false;
      return el;
    }
    case "Bool":
      return createElement("Int", { sr, val: arg.value ? "1" : "0" });
    case "Raw": {
      const el = rawElement(arg.raw, sr);
      if (el.name !== arg.tag) {
        throw new Error(
          `arg${arg.id}: raw XML is a <${el.name}> element but its tag says ${JSON.stringify(arg.tag)}`,
        );
      }
      return el;
    }
  }
}

/** Joiner element text: "and" -> "And". */
function joinText(j: string): string {
  return capitalize(j.trim());
}

/** ConditionListJson as `<ConditionList sr="if">`. */
export function conditionListToElement(cl: ConditionListJson): XmlElement {
  const kids: XmlElement[] = [];
  const n = cl.conditions.length;
  for (let i = 0; i < n - 1; i++) {
    kids.push(leaf(`bool${i}`, joinText(cl.joins?.[i] ?? "and")));
  }
  cl.conditions.forEach((c, i) => {
    kids.push(
      createElement("Condition", { sr: `c${i}`, ve: "3" }, [
        leaf("lhs", c.lhs),
        leaf("op", String(c.op)),
        leaf("rhs", c.rhs ?? ""),
      ]),
    );
  });
  const el = createElement("ConditionList", { sr: "if" }, kids);
  sortChildren(el);
  return el;
}

/**
 * An ActionJson as an `<Action>` element laid out exactly like Tasker writes
 * it: `code`, `label`, `on` (only when disabled), `se` (only when continuing
 * after error), args sorted lexicographically by `sr`, `ConditionList` last.
 * With `action.raw` the raw XML is used verbatim (only its `sr` is fixed)
 * when code, enabled, label, continueOnError, collapsed, condition and args
 * all agree with it; otherwise those edits are applied onto the raw element
 * (args the JSON omits are kept) and anything unmodelled stays as it was.
 * Throws when the raw XML is not an `<Action>`, the code was changed, or a
 * Raw arg's XML root does not match its `tag`.
 */
export function actionToElement(
  action: ActionJson,
  lookup: SpecLookup,
  opts: ToElementOptions = {},
): XmlElement {
  const index = opts.index ?? action.index ?? 0;
  const depth = opts.depth ?? ACTION_DEPTH;
  const sr = `act${index}`;
  if (action.raw !== undefined) return rawActionToElement(action, action.raw, lookup, index, depth);

  const kids: XmlElement[] = [leaf("code", String(action.code))];
  if (action.collapsed !== undefined) kids.push(leaf("coll", String(action.collapsed)));
  if (action.label !== undefined) kids.push(leaf("label", action.label, true));
  if (action.enabled === false) kids.push(leaf("on", "false"));
  if (action.continueOnError === true) kids.push(leaf("se", "false"));

  const seen = new Set<number>();
  for (const a of action.args) {
    if (seen.has(a.id)) {
      opts.warnings?.push(`action ${index}: duplicate arg${a.id}; first one kept`);
      continue;
    }
    seen.add(a.id);
    kids.push(argToElement(a));
  }
  const spec = lookup(action.code);
  if (opts.fillDefaults !== false && spec !== undefined) {
    for (const s of spec.args) {
      if (seen.has(s.id)) continue;
      const d = defaultArgElement(s);
      if (d === undefined) {
        opts.warnings?.push(
          `action ${index} (${spec.name}): arg${s.id} "${s.name}" omitted; no default for its type, Tasker fills it on import`,
        );
        continue;
      }
      kids.push(d);
    }
  }
  if (action.condition !== undefined && action.condition.conditions.length > 0) {
    kids.push(conditionListToElement(action.condition));
  }
  const el = createElement("Action", { sr, ve: "7" }, kids);
  sortChildren(el);
  return formatElement(el, depth);
}

/** Comparable form of an arg: Bool and numeric Int collapse, raw XML ignores inter-tag whitespace. */
function argCompareKey(a: ArgJson): string {
  switch (a.kind) {
    case "Str":
      return `Str:${a.value}`;
    case "Int":
      return `Int:${String(a.value)}`;
    case "Bool":
      return `Int:${a.value ? 1 : 0}`;
    case "Raw":
      return `Raw:${a.tag}:${normalizeRaw(a.raw)}`;
  }
}

/** Collapse inter-tag whitespace and drop the root `sr`, so raw XML compares by content. */
export function normalizeRaw(raw: string): string {
  return raw
    .trim()
    .replace(/>\s+</g, "><")
    .replace(/^(<[A-Za-z][\w.-]*)\s+sr="[^"]*"/, "$1");
}

function conditionKey(c: ConditionListJson | undefined): string {
  if (c === undefined || c.conditions.length === 0) return "";
  const joins = c.conditions.slice(1).map((_, i) => (c.joins?.[i] ?? "and").toLowerCase());
  return JSON.stringify({ c: c.conditions.map((x) => [x.lhs, x.op, x.rhs ?? ""]), j: joins });
}

/** Parse an action's raw XML, insisting on an `<Action>` root. */
function parseRawAction(raw: string, index: number): XmlElement {
  const el = parseFragment(raw);
  if (el.name !== "Action") {
    throw new Error(`action ${index}: raw XML must be an <Action> element, got <${el.name}>`);
  }
  return el;
}

/**
 * What is left of a raw action once everything the structured layer models
 * (code, label, on, se, coll, args, a parseable ConditionList) and the root
 * `sr` are removed, normalized for comparison. verify.ts compares this so a
 * correctly applied structured edit does not read as a raw XML difference.
 */
export function rawActionResidue(raw: string): string {
  const el = parseFragment(raw);
  el.children = el.children.filter((c) => {
    if (c.type !== "element") return !isWhitespace(c);
    if (srIndex(attr(c, "sr"), "arg") !== undefined) return false;
    if (c.name === "ConditionList") {
      return attr(c, "sr") !== "if" || conditionListToJson(c) === undefined;
    }
    return !ACTION_KNOWN.has(c.name);
  });
  return normalizeRaw(serializeElement(el));
}

/**
 * An action that carries `raw`: the raw XML verbatim when the structured
 * fields agree with it, else the raw element with the structured edits
 * applied (unknown children kept, Tasker child order restored). Throws when
 * an edit cannot be applied safely.
 */
function rawActionToElement(
  action: ActionJson,
  raw: string,
  lookup: SpecLookup,
  index: number,
  depth: number,
): XmlElement {
  const el = parseRawAction(raw, index);
  const fail = (why: string): Error =>
    new Error(`cannot apply structured edits to action ${index}: ${why}; edit its raw XML instead`);
  const from = actionToJson(el, lookup);
  const edits: Array<() => void> = [];
  const drop = (pred: (k: XmlElement) => boolean): void => {
    el.children = el.children.filter((c) => c.type !== "element" || !pred(c));
  };

  if (action.code !== from.code) {
    throw fail(`code ${action.code} does not match the raw XML's code ${from.code}`);
  }
  const enabled = action.enabled ?? true;
  if (enabled !== from.enabled) {
    edits.push(() => {
      drop((k) => k.name === "on");
      if (!enabled) el.children.push(leaf("on", "false"));
    });
  }
  if (action.label !== from.label) {
    const label = action.label;
    edits.push(() => {
      drop((k) => k.name === "label");
      if (label !== undefined) el.children.push(leaf("label", label, true));
    });
  }
  const cont = action.continueOnError ?? false;
  if (cont !== from.continueOnError) {
    edits.push(() => {
      drop((k) => k.name === "se");
      if (cont) el.children.push(leaf("se", "false"));
    });
  }
  const collapsed = action.collapsed;
  if (collapsed !== undefined && collapsed !== from.collapsed) {
    edits.push(() => {
      drop((k) => k.name === "coll");
      el.children.push(leaf("coll", String(collapsed)));
    });
  }
  if (conditionKey(action.condition) !== conditionKey(from.condition)) {
    const cond = action.condition;
    edits.push(() => {
      drop((k) => k.name === "ConditionList" && attr(k, "sr") === "if");
      if (cond !== undefined && cond.conditions.length > 0) {
        el.children.push(conditionListToElement(cond));
      }
    });
  }
  const seen = new Set<number>();
  for (const a of action.args) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    const old = from.args.find((x) => x.id === a.id);
    if (old !== undefined && argCompareKey(old) === argCompareKey(a)) continue;
    const next = argToElement(a);
    edits.push(() => {
      drop((k) => attr(k, "sr") === `arg${a.id}`);
      el.children.push(next);
    });
  }

  if (edits.length === 0) {
    setAttr(el, "sr", `act${index}`);
    return markVerbatim(el);
  }
  // Only element children and indentation can be re-laid out safely.
  if (el.children.some((c) => c.type !== "element" && !isWhitespace(c))) {
    throw fail("its raw XML holds text or comments between child elements");
  }
  el.children = el.children.filter((c) => c.type === "element");
  for (const apply of edits) apply();
  setAttr(el, "sr", `act${index}`);
  sortChildren(el);
  el.selfClosing = false;
  return formatElement(el, depth);
}

export interface TaskFromJsonOptions {
  id: number;
  /** Creation date (ms since epoch, as Tasker writes it). Defaults to base's, then now. */
  cdate?: string | number;
  /** Edit date; defaults to now. */
  edate?: string | number;
  /**
   * Existing Task element being replaced. Its children the JSON does not model
   * (ProfileVariable task variables, Img icon, stayawake, unknown tags) are
   * carried over unchanged, and its cdate is kept.
   */
  base?: XmlElement;
  fillDefaults?: boolean;
  warnings?: string[];
  /** Clock for cdate/edate defaults (tests). */
  now?: () => number;
}

const TASK_MODELED = new Set(["cdate", "edate", "id", "nme", "pc", "pri", "rty", "Action"]);

/** A TaskJson as a `<Task sr="task<id>">` element, formatted for depth 1. */
export function taskFromJson(
  task: TaskJson,
  lookup: SpecLookup,
  opts: TaskFromJsonOptions,
): XmlElement {
  const now = String((opts.now ?? Date.now)());
  const baseCdate = opts.base === undefined ? undefined : childText(opts.base, "cdate");
  const kids: XmlElement[] = [
    leaf("cdate", String(opts.cdate ?? baseCdate ?? now)),
    leaf("edate", String(opts.edate ?? now)),
    leaf("id", String(opts.id)),
  ];
  if (task.name !== "") kids.push(leaf("nme", task.name));
  if (task.comment !== undefined) kids.push(leaf("pc", task.comment));
  if (task.priority !== undefined) kids.push(leaf("pri", String(task.priority)));
  if (task.collision !== undefined) kids.push(leaf("rty", String(task.collision)));
  if (opts.base !== undefined) {
    for (const k of children(opts.base)) {
      if (!TASK_MODELED.has(k.name)) kids.push(markVerbatim(cloneNode(k)));
    }
  }
  task.actions.forEach((a, index) => {
    const ao: ToElementOptions = { index, depth: ACTION_DEPTH };
    if (opts.fillDefaults !== undefined) ao.fillDefaults = opts.fillDefaults;
    if (opts.warnings !== undefined) ao.warnings = opts.warnings;
    kids.push(markVerbatim(actionToElement(a, lookup, ao)));
  });
  const el = createElement("Task", { sr: `task${opts.id}` }, kids);
  sortChildren(el);
  return formatElement(el, OBJECT_DEPTH);
}

const ROOT_ORDER = ["dmetric", "Profile", "Project", "Scene", "Task"];

/**
 * A complete TaskerData document (string) holding `elements`, in the order
 * Tasker writes them (dmetric, Profile, Project, Scene, Task, then anything
 * else), ready for Tasker's Import. Elements are written as they serialize
 * now, so pass elements formatted for depth 1 (as taskFromJson returns, or as
 * parsed from another TaskerData file).
 */
export function wrapForImport(elements: XmlElement[], tv: string): string {
  const rank = (e: XmlElement): number => {
    const i = ROOT_ORDER.indexOf(e.name);
    return i < 0 ? ROOT_ORDER.length : i;
  };
  const sorted = elements
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i)
    .map((x) => x.e);
  const body = sorted.map((e) => `\t${serializeElement(e)}\n`).join("");
  return `<TaskerData sr="" dvi="1" tv="${escapeAttr(tv)}">\n${body}</TaskerData>\n`;
}
