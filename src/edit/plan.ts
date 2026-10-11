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
 *
 * Verified on Tasker 6.6.20: Import Data replaces a task with the same NAME
 * in place and keeps that task's id whatever id the payload carries, and a
 * task whose name is new always lands in the default "Base" project.
 *
 * Renaming: pass the current name as `opts.baseName`. The old task is the
 * base (id, cdate, unmodelled children, project), but to Tasker the new name
 * is a new task, so it lands in Base next to the old one; the caller moves it
 * to `targetProject` and deletes the old task (`renamedFrom`).
 */

import { taskFromJson, wrapForImport, type SpecLookup } from "../model/convert.ts";
import { TaskerDoc } from "../model/document.ts";
import type { TaskJson } from "../model/types.ts";
import { childText, type XmlElement } from "../xml/index.ts";

/** Fallback `tv` when the current file has none. */
export const DEFAULT_TV = "6.6.20";

/** Tasker's default project, where every newly imported task lands. */
export const BASE_PROJECT = "Base";

export interface ReplacePlan {
  /** Complete TaskerData document to hand to Tasker's import. */
  xml: string;
  /** Id written in the payload (the existing or renamed task's, else a fresh one). */
  taskId: number;
  /** True when no task had this name and no rename base was given: a new task was planned. */
  isNew: boolean;
  /**
   * Project the task is in right after the import: the existing task's
   * project for an in-place replace (undefined when no project lists it),
   * "Base" for a new task or a rename.
   */
  project?: string;
  /**
   * Project the task should end up in, set only when it differs from
   * `project` and is not "Base": the caller moves the task there after the
   * import. For a new task it is `next.project`; for a rename, `next.project`
   * else the old task's project; for an in-place replace, `next.project` when
   * it names a different project.
   */
  targetProject?: string;
  /**
   * Set for a rename: the task the plan was based on. After the import the
   * phone holds both; the caller deletes this one BY NAME and re-resolves the
   * new task by name (the payload reuses this id, which the phone may not
   * keep, so the id is not a safe handle for the deletion).
   */
  renamedFrom?: { id: number; name: string };
  /** The generated Task element. */
  element: XmlElement;
  warnings: string[];
}

export interface PlanOptions {
  fillDefaults?: boolean;
  /** Overrides the `tv` written on the payload (default: current's, then DEFAULT_TV). */
  tv?: string;
  now?: () => number;
  /**
   * The task's current name when renaming it to `next.name`. That task is
   * used as the base. Throws when no task has this name, or when `next.name`
   * already names a different task (the import would overwrite it).
   */
  baseName?: string;
}

export function planReplaceTask(
  current: TaskerDoc,
  next: TaskJson,
  lookup: SpecLookup,
  opts: PlanOptions = {},
): ReplacePlan {
  if (next.name.trim() === "") throw new Error("a task needs a name to be replaced by name");
  const from = opts.baseName;
  const renaming = from !== undefined && from !== next.name;
  let existing: XmlElement | undefined;
  if (renaming) {
    existing = current.taskByName(from);
    if (existing === undefined || TaskerDoc.idOf(existing) === undefined) {
      throw new Error(`cannot rename: no task named ${JSON.stringify(from)}`);
    }
    if (current.taskByName(next.name) !== undefined) {
      throw new Error(
        `cannot rename ${JSON.stringify(from)} to ${JSON.stringify(next.name)}: a task with that name already exists`,
      );
    }
  } else {
    existing = current.taskByName(next.name);
  }
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
  const oldProjectEl = isNew ? undefined : current.projectOfTask(taskId);
  const oldProject = oldProjectEl === undefined ? undefined : childText(oldProjectEl, "name");
  let target: string | undefined;
  if (isNew || renaming) {
    plan.project = BASE_PROJECT;
    target = next.project ?? oldProject;
  } else {
    if (oldProject !== undefined) plan.project = oldProject;
    target = next.project;
  }
  if (target !== undefined && target !== BASE_PROJECT && target !== plan.project) {
    plan.targetProject = target;
  }
  if (renaming) plan.renamedFrom = { id: taskId, name: from };
  return plan;
}
