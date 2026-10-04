/**
 * Tasker condition operators: the integer in `<Condition><op>N</op>` and its names.
 *
 * Sources:
 * - Tasker userguide, Flow Control > Conditions
 *   (https://tasker.joaoapps.com/userguide/en/flowcontrol.html): the operator list, labels and
 *   short forms, in the same order as the codes.
 * - MapTasker `maptasker/src/action.py` `evaluate_condition` (github.com/mctinker/Map-Tasker, MIT):
 *   the code -> symbol table for 0-9, 12 and 13 ("0": " = " there is string Equals; Tasker shows
 *   it as `eq`).
 * - Real exports in test/fixtures: op 12 / 13 always carry an empty `<rhs>`, op 0 compares text.
 *
 * Codes 10 (Even) and 11 (Odd) are missing from MapTasker's table; they follow the userguide
 * order, which matches every other code.
 */

export interface OpInfo {
  /** Integer as written in `<op>`. */
  code: number;
  /** Stable machine name, used as `ConditionJson.opName`. */
  name: string;
  /** Short form Tasker shows in the task editor, e.g. "~", "!~R", "Set". */
  symbol: string;
  /** Long label from the Tasker userguide. */
  label: string;
  /** False for unary operators (Even, Odd, Set, Not Set): `<rhs>` is written empty. */
  takesRhs: boolean;
}

export const OPS: readonly OpInfo[] = [
  { code: 0, name: "eq", symbol: "eq", label: "Equals", takesRhs: true },
  { code: 1, name: "neq", symbol: "neq", label: "Doesn't Equal", takesRhs: true },
  { code: 2, name: "matches", symbol: "~", label: "Matches", takesRhs: true },
  { code: 3, name: "not_matches", symbol: "!~", label: "Not Matches", takesRhs: true },
  { code: 4, name: "matches_regex", symbol: "~R", label: "Matches Regex", takesRhs: true },
  {
    code: 5,
    name: "not_matches_regex",
    symbol: "!~R",
    label: "Doesn't Match Regex",
    takesRhs: true,
  },
  { code: 6, name: "lt", symbol: "<", label: "Maths: Less Than", takesRhs: true },
  { code: 7, name: "gt", symbol: ">", label: "Maths: Greater Than", takesRhs: true },
  { code: 8, name: "math_eq", symbol: "=", label: "Maths: Equals", takesRhs: true },
  { code: 9, name: "math_neq", symbol: "!=", label: "Maths: Isn't Equal To", takesRhs: true },
  { code: 10, name: "even", symbol: "Even", label: "Maths: Is Even", takesRhs: false },
  { code: 11, name: "odd", symbol: "Odd", label: "Maths: Is Odd", takesRhs: false },
  { code: 12, name: "set", symbol: "Set", label: "Is Set", takesRhs: false },
  { code: 13, name: "not_set", symbol: "!Set", label: "Isn't Set", takesRhs: false },
];

/** Extra spellings an agent is likely to use. Keys are normalized with `normOp`. */
const ALIASES: Record<string, string> = {
  equals: "eq",
  "==": "math_eq",
  "not equals": "neq",
  "not equal": "neq",
  "doesnt equal": "neq",
  ne: "neq",
  match: "matches",
  "doesnt match": "not_matches",
  "not match": "not_matches",
  "does not match": "not_matches",
  regex: "matches_regex",
  "matches regex": "matches_regex",
  "not matches regex": "not_matches_regex",
  "doesnt match regex": "not_matches_regex",
  "less than": "lt",
  "greater than": "gt",
  "<": "lt",
  ">": "gt",
  "maths equals": "math_eq",
  "math equals": "math_eq",
  "math eq": "math_eq",
  "maths not equal": "math_neq",
  "maths isnt equal to": "math_neq",
  "math neq": "math_neq",
  "<>": "math_neq",
  "is even": "even",
  "maths is even": "even",
  "is odd": "odd",
  "maths is odd": "odd",
  "is set": "set",
  isset: "set",
  "not set": "not_set",
  "isnt set": "not_set",
  "is not set": "not_set",
  "!set": "not_set",
  unset: "not_set",
};

/** Lower case, drop apostrophes, underscores to spaces, collapse whitespace, drop "maths:" colon. */
function normOp(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/_/g, " ")
    .replace(/:/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_CODE = new Map<number, OpInfo>(OPS.map((o) => [o.code, o]));
const BY_NAME = new Map<string, OpInfo>();
for (const o of OPS) {
  BY_NAME.set(normOp(o.name), o);
  BY_NAME.set(normOp(o.label), o);
  // Symbols are matched case-insensitively too ("~r" is unambiguous).
  if (!BY_NAME.has(normOp(o.symbol))) BY_NAME.set(normOp(o.symbol), o);
}
for (const [alias, name] of Object.entries(ALIASES)) {
  const op = BY_NAME.get(normOp(name));
  if (op) BY_NAME.set(normOp(alias), op);
}

export function opByCode(code: number): OpInfo | undefined {
  return BY_CODE.get(code);
}

/**
 * Look up an operator by machine name ("eq", "not_set"), symbol ("~", "!~R", "=", "<"), userguide
 * label ("Matches", "Is Set", "Maths: Equals") or a common alias. A numeric string is treated as a
 * code. Note "=" is Maths: Equals (8), and "eq" / "Equals" is the text comparison (0).
 */
export function opByName(nameOrSymbol: string): OpInfo | undefined {
  const raw = nameOrSymbol.trim();
  if (/^\d+$/.test(raw)) return BY_CODE.get(Number(raw));
  return BY_NAME.get(normOp(raw));
}
