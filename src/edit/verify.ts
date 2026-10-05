/**
 * Post-import verification: compare the task an agent asked for with the task
 * Tasker actually holds after import (re-exported and converted to JSON).
 *
 * Tasker fills in args the request left out, so an arg that is present in
 * `actual` with its default value but absent from `expected` is not a
 * difference. Defaults come from the spec when a lookup is given
 * (Int "min:max:default", Boolean "true"/"false"), else Str "", Int 0, false.
 * A Bundle (output variables), empty App, or empty Img the phone added is
 * likewise accepted.
 */

import { intDefault, normalizeRaw, rawActionResidue, type SpecLookup } from "../model/convert.ts";
import { TaskerDoc } from "../model/document.ts";
import type { ActionJson, ArgJson, ConditionListJson, TaskJson } from "../model/types.ts";
import type { ArgSpec } from "../spec/types.ts";

export interface TaskDiff {
  equal: boolean;
  differences: string[];
}

const normRaw = normalizeRaw;

/** Residue of a raw action, or the normalized text when it does not parse. */
function residue(raw: string): string {
  try {
    return rawActionResidue(raw);
  } catch {
    return normRaw(raw);
  }
}

/** Comparable form of an arg value: Bool and numeric Int collapse to the same string. */
function argKey(a: ArgJson): string {
  switch (a.kind) {
    case "Str":
      return `Str:${a.value}`;
    case "Int":
      return `Int:${String(a.value)}`;
    case "Bool":
      return `Int:${a.value ? 1 : 0}`;
    case "Raw":
      return `Raw:${normRaw(a.raw)}`;
  }
}

function describe(a: ArgJson): string {
  switch (a.kind) {
    case "Raw":
      return `${a.tag} ${normRaw(a.raw).slice(0, 80)}`;
    default:
      return `${a.kind} ${JSON.stringify(a.value)}`;
  }
}

/** True when `a` is what Tasker writes for an arg nobody set. */
export function isDefaultArg(a: ArgJson, spec?: ArgSpec): boolean {
  switch (a.kind) {
    case "Str":
      return a.value === "";
    case "Int": {
      const v = String(a.value);
      if (spec?.type === 3) return v === (spec.spec === "true" ? "1" : "0");
      const d = spec === undefined ? 0 : intDefault(spec);
      return v === String(d);
    }
    case "Bool":
      return a.value === (spec?.spec === "true");
    case "Raw": {
      if (a.tag === "Bundle") return true;
      // Empty App / Img: self-closing with no content.
      return /^<(App|Img)\b[^>]*\/>$/.test(a.raw.trim());
    }
  }
}

function condKey(c: ConditionListJson | undefined): string {
  if (c === undefined || c.conditions.length === 0) return "";
  const joins = c.conditions.slice(1).map((_, i) => (c.joins?.[i] ?? "and").toLowerCase());
  return JSON.stringify({
    c: c.conditions.map((x) => [x.lhs, x.op, x.rhs ?? ""]),
    j: joins,
  });
}

function diffAction(
  i: number,
  e: ActionJson,
  a: ActionJson,
  lookup: SpecLookup | undefined,
  out: string[],
): void {
  const at = `action ${i}`;
  if (e.code !== a.code) {
    out.push(`${at}: code ${e.code} expected, got ${a.code}`);
    return;
  }
  if ((e.enabled ?? true) !== (a.enabled ?? true)) {
    out.push(`${at}: enabled ${e.enabled ?? true} expected, got ${a.enabled ?? true}`);
  }
  if ((e.label ?? "") !== (a.label ?? "")) {
    out.push(
      `${at}: label ${JSON.stringify(e.label ?? "")} expected, got ${JSON.stringify(a.label ?? "")}`,
    );
  }
  if ((e.continueOnError ?? false) !== (a.continueOnError ?? false)) {
    out.push(
      `${at}: continueOnError ${e.continueOnError ?? false} expected, got ${a.continueOnError ?? false}`,
    );
  }
  if (condKey(e.condition) !== condKey(a.condition)) {
    out.push(`${at}: condition differs`);
  }
  // Raw actions: compare only what the structured fields do not cover, so a
  // structured edit applied onto the raw XML (enabled, args, ...) is not
  // reported twice, and arg changes are still compared below.
  if (e.raw !== undefined && a.raw !== undefined && residue(e.raw) !== residue(a.raw)) {
    out.push(`${at}: raw XML differs outside the structured fields`);
  }
  const spec = lookup?.(e.code);
  const ids = new Set([...e.args.map((x) => x.id), ...a.args.map((x) => x.id)]);
  for (const id of [...ids].sort((x, y) => x - y)) {
    const ea = e.args.find((x) => x.id === id);
    const aa = a.args.find((x) => x.id === id);
    const s = spec?.args.find((x) => x.id === id);
    if (ea === undefined && aa !== undefined) {
      if (!isDefaultArg(aa, s)) out.push(`${at}: arg${id} unexpected ${describe(aa)}`);
    } else if (ea !== undefined && aa === undefined) {
      // A Bundle is only ignorable when the phone added it; one we sent (plugin config) must arrive.
      const sentBundle = ea.kind === "Raw" && ea.tag === "Bundle";
      if (sentBundle || !isDefaultArg(ea, s)) {
        out.push(`${at}: arg${id} missing, expected ${describe(ea)}`);
      }
    } else if (ea !== undefined && aa !== undefined && argKey(ea) !== argKey(aa)) {
      out.push(`${at}: arg${id} expected ${describe(ea)}, got ${describe(aa)}`);
    }
  }
}

/** Compare an intended task with what Tasker holds. Only fields `expected` sets are compared at task level. */
export function diffTasks(expected: TaskJson, actual: TaskJson, lookup?: SpecLookup): TaskDiff {
  const out: string[] = [];
  if (expected.name !== actual.name) {
    out.push(`name ${JSON.stringify(expected.name)} expected, got ${JSON.stringify(actual.name)}`);
  }
  if (expected.priority !== undefined && expected.priority !== actual.priority) {
    out.push(`priority ${expected.priority} expected, got ${actual.priority}`);
  }
  if (expected.collision !== undefined && expected.collision !== (actual.collision ?? 0)) {
    out.push(`collision ${expected.collision} expected, got ${actual.collision ?? 0}`);
  }
  if (expected.comment !== undefined && expected.comment !== (actual.comment ?? "")) {
    out.push(`comment differs`);
  }
  const n = Math.max(expected.actions.length, actual.actions.length);
  if (expected.actions.length !== actual.actions.length) {
    out.push(`action count ${expected.actions.length} expected, got ${actual.actions.length}`);
  }
  for (let i = 0; i < n; i++) {
    const e = expected.actions[i];
    const a = actual.actions[i];
    if (e === undefined || a === undefined) continue;
    diffAction(i, e, a, lookup, out);
  }
  return { equal: out.length === 0, differences: out };
}

/**
 * Ids of every task (or profile) named `name`, ascending. More than one means
 * an import created a second copy instead of replacing in place; the caller
 * deletes the stale one.
 */
export function findDuplicates(doc: TaskerDoc, kind: "task" | "profile", name: string): number[] {
  if (name === "") return [];
  const els = kind === "task" ? doc.tasks() : doc.profiles();
  return els
    .filter((el) => TaskerDoc.nameOf(el) === name)
    .map((el) => TaskerDoc.idOf(el))
    .filter((id): id is number => id !== undefined)
    .sort((a, b) => a - b);
}
