/**
 * Pure edits on a TaskJson. The result is a new TaskJson with action `index`
 * and `depth` recomputed; the input is not mutated.
 *
 * A rename is `set.name` here, then planReplaceTask(current, next, lookup,
 * { baseName: oldName }) so the old task is the base, then (after the import)
 * deleting the old task by name as reported in the plan's `renamedFrom`, and
 * moving the new one to `targetProject`. Without `baseName` a renamed task is
 * planned as a brand-new task and the old one is left on the phone.
 */

import type { ActionJson, TaskJson } from "../model/types.ts";
import { computeDepths } from "./blocks.ts";

export interface TaskSplice {
  /** Position of the first action to delete / insert at, 0-based. */
  index: number;
  deleteCount: number;
  insert?: ActionJson[];
}

export interface TaskSet {
  /** New name. Pass the old name as planReplaceTask's `baseName`; see the module doc. */
  name?: string;
  /** null removes the field (Tasker default). */
  priority?: number | null;
  collision?: number | null;
  comment?: string | null;
}

/**
 * One patch. Several keys may be combined; they apply in the order actions
 * (replace the whole list), splice, set. An array of patches applies in order.
 */
export interface TaskPatch {
  actions?: ActionJson[];
  splice?: TaskSplice;
  set?: TaskSet;
}

/** Renumber `index` and recompute `depth` for display. */
export function reindex(actions: ActionJson[]): ActionJson[] {
  const depths = computeDepths(actions.map((a) => a.code));
  return actions.map((a, i) => ({ ...a, index: i, depth: depths[i] ?? 0 }));
}

function applyOne(task: TaskJson, patch: TaskPatch): TaskJson {
  const next: TaskJson = { ...task, actions: [...task.actions] };
  if (patch.actions !== undefined) next.actions = [...patch.actions];
  if (patch.splice !== undefined) {
    const { index, deleteCount, insert } = patch.splice;
    const len = next.actions.length;
    if (!Number.isInteger(index) || index < 0 || index > len) {
      throw new RangeError(`splice index ${index} out of range 0..${len}`);
    }
    if (!Number.isInteger(deleteCount) || deleteCount < 0 || index + deleteCount > len) {
      throw new RangeError(
        `splice deleteCount ${deleteCount} at index ${index} exceeds the ${len} actions`,
      );
    }
    next.actions.splice(index, deleteCount, ...(insert ?? []));
  }
  if (patch.set !== undefined) {
    const s = patch.set;
    if (s.name !== undefined) {
      if (s.name.trim() === "") throw new Error("task name cannot be empty");
      next.name = s.name;
    }
    for (const key of ["priority", "collision", "comment"] as const) {
      const v = s[key];
      if (v === undefined) continue;
      if (v === null) delete next[key];
      else (next as unknown as Record<string, unknown>)[key] = v;
    }
  }
  next.actions = reindex(next.actions);
  return next;
}

export function applyPatch(task: TaskJson, patch: TaskPatch | TaskPatch[]): TaskJson {
  const list = Array.isArray(patch) ? patch : [patch];
  return list.reduce(applyOne, task);
}
