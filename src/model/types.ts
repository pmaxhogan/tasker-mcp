/**
 * The structured JSON view an agent sees. Produced from the lossless DOM
 * (src/xml) plus the spec table (src/spec), and converted back to XML for
 * create/edit. Anything the structured layer does not understand travels as
 * raw XML so nothing is ever lost.
 */

/** One positional argument of an action. */
export type ArgJson =
  | { id: number; name?: string; kind: "Str"; value: string }
  | { id: number; name?: string; kind: "Int"; value: number | string }
  | { id: number; name?: string; kind: "Bool"; value: boolean }
  /** Bundle, App, Img, and any unknown arg element: kept as raw XML. */
  | { id: number; name?: string; kind: "Raw"; tag: string; raw: string };

export interface ConditionJson {
  lhs: string;
  /** Tasker operator code (numeric) as it appears in the XML. */
  op: number;
  /** Human operator name when known, e.g. "eq", "neq", "matches", "set". */
  opName?: string;
  rhs?: string;
}

export interface ConditionListJson {
  conditions: ConditionJson[];
  /** Boolean joiners between conditions, e.g. ["and"], from `<bool0>And</bool0>`. */
  joins?: string[];
}

export interface ActionJson {
  /** 0-based position in the task. */
  index?: number;
  code: number;
  /** Resolved action name from the spec table; absent for unknown codes. */
  name?: string;
  enabled?: boolean;
  label?: string;
  /** Continue task after error (`<se>`). */
  continueOnError?: boolean;
  condition?: ConditionListJson;
  /**
   * Editor fold state of an If/For block (`<coll>true|false</coll>`), kept so
   * a round trip is byte-identical. Absent when the XML has no `<coll>`.
   */
  collapsed?: boolean;
  args: ArgJson[];
  /**
   * The original XML of an action this layer does not fully model (unknown
   * code, unmodelled child, non-7 ve). Edits to code-independent structured
   * fields (enabled, label, continueOnError, collapsed, condition, args) are
   * applied onto it when converting back; changing `code` is refused.
   * Omitted fields mean what they mean on any action: `enabled` true,
   * `continueOnError` false, no `label`, no `condition` (so `{code, raw}`
   * whose raw has `<on>false</on>` comes back enabled). Omitted args are the
   * exception: an arg the JSON leaves out is kept from the raw XML.
   */
  raw?: string;
  /** Nesting depth from If/For blocks, for display only. */
  depth?: number;
}

export interface TaskJson {
  id?: number;
  name: string;
  project?: string;
  priority?: number;
  /** Collision handling: 0 abort new, 1 abort existing, 2 run both. */
  collision?: number;
  /** Task comment (`<pc>`), used as the description for per-task MCP tools. */
  comment?: string;
  actions: ActionJson[];
  /** Validation warnings (unknown codes etc), never fatal. */
  warnings?: string[];
}

export interface ProfileContextJson {
  /** Element tag: Event, State, App, Time, Day, Loc, ... */
  kind: string;
  code?: number;
  name?: string;
  raw: string;
}

export interface ProfileJson {
  id?: number;
  name: string;
  project?: string;
  enabled?: boolean;
  entryTask?: string | number;
  exitTask?: string | number;
  contexts: ProfileContextJson[];
}

export interface ProjectJson {
  id?: string;
  name: string;
  tasks: string[];
  profiles: string[];
  scenes: string[];
}

export interface SceneSummary {
  name: string;
  project?: string;
}
