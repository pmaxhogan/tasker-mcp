/**
 * The action-spec table (data/actions.json). Vendored from MapTasker's
 * task_all_actions.json and enriched from the Tasker APK; see data/NOTICE.
 */

/** MapTasker arg type enum. */
export const ArgType = {
  Int: 0,
  String: 1,
  App: 2,
  Boolean: 3,
  Img: 4,
  Bundle: 5,
} as const;
export type ArgTypeCode = (typeof ArgType)[keyof typeof ArgType];

export interface ArgSpec {
  /** Positional id: arg<id> in the XML (`sr="arg3"`). */
  id: number;
  name: string;
  type: number;
  isMandatory: boolean;
  /** MapTasker spec string, e.g. "t:1:?", "0:50", "m:1". Optional. */
  spec?: string;
  sortOrder?: number;
  helpResId?: number;
  /** English label resolved from the APK (pl_* resources), when known. */
  label?: string;
}

export interface ActionSpec {
  code: number;
  name: string;
  categoryCode?: number;
  canFail?: boolean;
  args: ArgSpec[];
  /** APK resource name for the action, e.g. "an_perform_task". */
  resName?: string;
  /** English help text resolved from the APK, when known. */
  help?: string;
}

export interface CategorySpec {
  code: number;
  name: string;
}

export interface SpecTable {
  /** Provenance: sources, Tasker version the APK data came from, generated date. */
  meta: { generated: string; taskerVersion?: string; sources: string[] };
  actions: ActionSpec[];
  categories: CategorySpec[];
}
