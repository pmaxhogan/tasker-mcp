/**
 * Replace-by-name planning: turn the desired TaskJson into a TaskerData import
 * payload that Tasker applies in place.
 *
 * ID reconciliation: when a task with that name exists, the payload reuses its
 * `<id>` and `<cdate>` (so the import targets the same task) and carries over
 * the children JSON does not model (task variables, icon, stayawake). A new
 * name gets a fresh id above every task and profile id in `current`, which
 * should be a full Data Backup so the id is free on the phone too. Whether the
 * import really replaces in place, rather than adding a second copy, is
 * checked afterwards with verify.findDuplicates.
 */

import { taskFromJson, wrapForImport, type SpecLookup } from "../model/convert.ts";
import { TaskerDoc } from "../model/document.ts";
import type { TaskJson } from "../model/types.ts";
import { childText, type XmlElement } from "../xml/index.ts";

/** Fallback `tv` when the current file has none. */
export const DEFAULT_TV = "6.6.20";

export interface ReplacePlan {
  /** Complete TaskerData document to hand to Tasker's import. */
  xml: string;
  taskId: number;
  /** True when no task had this name: a new task was planned. */
  isNew: boolean;
  /** Project holding the existing task, else the one named in the JSON. */
  project?: string;
  /** The generated Task element. */
  element: XmlElement;
  warnings: string[];
}

export interface PlanOptions {
  fillDefaults?: boolean;
  /** Overrides the `tv` written on the payload (default: current's, then DEFAULT_TV). */
  tv?: string;
  now?: () => number;
}

export function planReplaceTask(
  current: TaskerDoc,
  next: TaskJson,
  lookup: SpecLookup,
  opts: PlanOptions = {},
): ReplacePlan {
  if (next.name.trim() === "") throw new Error("a task needs a name to be replaced by name");
  const existing = current.taskByName(next.name);
  const existingId = existing === undefined ? undefined : TaskerDoc.idOf(existing);
  const isNew = existingId === undefined;
  const taskId = existingId ?? current.nextFreeId();
  const warnings: string[] = [];
  const element = taskFromJson(next, lookup, {
    id: taskId,
    ...(existing === undefined ? {} : { base: existing }),
    ...(opts.fillDefaults === undefined ? {} : { fillDefaults: opts.fillDefaults }),
    ...(opts.now === undefined ? {} : { now: opts.now }),
    warnings,
  });
  const tv = opts.tv ?? current.taskerVersion ?? DEFAULT_TV;
  const plan: ReplacePlan = {
    xml: wrapForImport([element], tv),
    taskId,
    isNew,
    element,
    warnings,
  };
  const projectEl = isNew ? undefined : current.projectOfTask(taskId);
  const project = (projectEl && childText(projectEl, "name")) ?? next.project;
  if (project !== undefined) plan.project = project;
  return plan;
}
