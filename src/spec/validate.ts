/**
 * Structural and spec validation of a TaskJson before it is turned into XML.
 *
 * Errors block a write; warnings are reported but never fatal. Plugin actions and actions that
 * travel as raw XML are only checked as far as the spec allows.
 */
import type { ActionJson, ArgJson, TaskJson } from "../model/types.ts";
import { ELSE, END_FOR, END_IF, FOR, IF, type SpecIndex } from "./table.ts";
import { ArgType, type ActionSpec, type ArgSpec } from "./types.ts";

export interface Issue {
  /** 0-based action index in the task. */
  index?: number;
  code?: number;
  message: string;
  hint?: string;
}

export interface ValidationResult {
  errors: Issue[];
  warnings: Issue[];
}

const RANGE_RE = /^(-?\d+):(-?\d+)(?::(-?\d+))?$/;

/** Element tag Tasker writes for each spec arg type. */
const EXPECTED_TAG: Record<number, string> = {
  [ArgType.Int]: "Int",
  [ArgType.String]: "Str",
  [ArgType.App]: "App",
  [ArgType.Boolean]: "Int",
  [ArgType.Icon]: "Img",
  [ArgType.Bundle]: "Bundle",
  [ArgType.Scene]: "Str",
};

const TYPE_NAME: Record<number, string> = {
  [ArgType.Int]: "Int",
  [ArgType.String]: "String",
  [ArgType.App]: "App",
  [ArgType.Boolean]: "Boolean",
  [ArgType.Icon]: "Icon",
  [ArgType.Bundle]: "Bundle",
  [ArgType.Scene]: "Scene",
};

/** Parse a plain numeric `min:max` or `min:max:default` spec string; undefined otherwise. */
export function parseRange(spec: string | undefined): { min: number; max: number } | undefined {
  if (!spec) return undefined;
  const m = RANGE_RE.exec(spec);
  if (!m) return undefined;
  const min = Number(m[1]);
  const max = Number(m[2]);
  // "0:0:3" style specs carry no usable range.
  return min < max ? { min, max } : undefined;
}

function argLabel(a: ArgSpec): string {
  return `arg${a.id} "${a.label ?? a.name}"`;
}

/** Check one present arg against its spec. Pushes into `out`; returns nothing. */
function checkArg(
  arg: ArgJson,
  spec: ArgSpec,
  action: { index: number; code: number },
  out: ValidationResult,
): void {
  const where = { index: action.index, code: action.code };
  const expectedTag = EXPECTED_TAG[spec.type];
  if (expectedTag === undefined) return; // runtime-only types (ConditionList, Img 8): no rule
  const wrong = (got: string): void => {
    out.errors.push({
      ...where,
      message:
        `${argLabel(spec)} is ${TYPE_NAME[spec.type]} and must be written as <${expectedTag}>, ` +
        `got ${got}`,
      hint: hintFor(spec.type),
    });
  };

  if (arg.kind === "Raw") {
    if (arg.tag !== expectedTag) wrong(`<${arg.tag}>`);
    return;
  }

  switch (spec.type) {
    case ArgType.Int: {
      if (arg.kind !== "Int") return wrong(`kind ${arg.kind}`);
      if (typeof arg.value === "string") {
        const v = arg.value.trim();
        // Real exports carry empty `<Int sr="arg5"/>` and expressions like `%priority+1`.
        if (v === "" || v.includes("%")) return;
        if (!/^-?\d+$/.test(v)) {
          out.errors.push({
            ...where,
            message: `${argLabel(spec)} must be an integer or a %variable, got "${arg.value}"`,
          });
          return;
        }
        checkRange(Number(v), spec, where, out);
        return;
      }
      checkRange(arg.value, spec, where, out);
      return;
    }
    case ArgType.Boolean: {
      if (arg.kind === "Bool") return;
      if (arg.kind !== "Int") return wrong(`kind ${arg.kind}`);
      const v = String(arg.value).trim();
      if (v !== "0" && v !== "1") {
        out.errors.push({
          ...where,
          message: `${argLabel(spec)} is Boolean and must be 0 or 1, got "${arg.value}"`,
        });
      }
      return;
    }
    case ArgType.String:
    case ArgType.Scene:
      if (arg.kind !== "Str") return wrong(`kind ${arg.kind}`);
      checkVarName(arg.value, spec, where, out);
      return;
    default:
      // App / Icon / Bundle must arrive as Raw with the right tag.
      wrong(`kind ${arg.kind}`);
  }
}

/**
 * A variable-name arg (spec "uvar...") holding a plain name Tasker will not accept. The task
 * editor refuses "%xx" ("bad variable name: must start with % and be 3 or more alphanumeric
 * characters or _, not starting/ending in _"), and an imported one is silently not a variable at
 * run time (docs/conformance.md). Only plain `%name` values are checked; arrays, expressions
 * and nested variables pass.
 */
function checkVarName(
  value: string,
  spec: ArgSpec,
  where: { index: number; code: number },
  out: ValidationResult,
): void {
  if (!spec.spec?.startsWith("uvar")) return;
  const m = /^%(\w*)$/.exec(value.trim());
  if (m === null) return;
  const name = m[1]!;
  if (name.length >= 3 && !name.startsWith("_") && !name.endsWith("_")) return;
  out.warnings.push({
    ...where,
    message:
      `${argLabel(spec)} "${value}" is not a valid Tasker variable name: ` +
      "it needs 3 or more letters, digits or _ after the %, not starting or ending in _",
  });
}

function hintFor(type: number): string | undefined {
  switch (type) {
    case ArgType.Int:
      return 'Use {kind: "Int", value: <number or "%var">}';
    case ArgType.Boolean:
      return 'Use {kind: "Bool", value: true|false} or {kind: "Int", value: 0|1}';
    case ArgType.String:
    case ArgType.Scene:
      return 'Use {kind: "Str", value: "..."}';
    case ArgType.App:
      return 'Use {kind: "Raw", tag: "App", raw: "<App sr=\\"argN\\">...</App>"}';
    case ArgType.Icon:
      return 'Use {kind: "Raw", tag: "Img", raw: "<Img sr=\\"argN\\" ve=\\"2\\">...</Img>"}';
    case ArgType.Bundle:
      return 'Use {kind: "Raw", tag: "Bundle", raw: "<Bundle sr=\\"argN\\">...</Bundle>"}';
    /* v8 ignore next 2 */
    default:
      return undefined;
  }
}

function checkRange(
  value: number,
  spec: ArgSpec,
  where: { index: number; code: number },
  out: ValidationResult,
): void {
  const r = parseRange(spec.spec);
  if (!r) return;
  if (value < r.min || value > r.max) {
    out.warnings.push({
      ...where,
      message: `${argLabel(spec)} value ${value} is outside the usual range ${r.min}..${r.max}`,
    });
  }
}

function checkArgs(action: ActionJson, spec: ActionSpec, index: number, out: ValidationResult) {
  const where = { index, code: action.code };
  const byId = new Map<number, ArgJson>();
  for (const arg of action.args) {
    if (byId.has(arg.id)) {
      out.errors.push({ ...where, message: `Duplicate arg${arg.id} in ${spec.name}` });
    }
    byId.set(arg.id, arg);
  }
  for (const a of spec.args) {
    const arg = byId.get(a.id);
    if (!arg) {
      // A raw passthrough action carries its args in `raw`; nothing to check here.
      if (!a.isMandatory || action.raw !== undefined) continue;
      const issue = {
        ...where,
        message: `${spec.name} is missing mandatory ${argLabel(a)}`,
        hint: hintFor(a.type),
      };
      // Exports from older Tasker versions omit Boolean args added later (Perform Task arg6-10,
      // Return arg2-3, ...) and Tasker loads them with their default, so that is only a warning.
      if (a.type === ArgType.Boolean) out.warnings.push(issue);
      else out.errors.push(issue);
      continue;
    }
    checkArg(arg, a, where, out);
  }
  for (const arg of action.args) {
    if (!spec.args.some((a) => a.id === arg.id)) {
      out.warnings.push({
        ...where,
        message: `${spec.name} has no arg${arg.id} in the spec table; it will be written as-is`,
      });
    }
  }
}

interface Open {
  code: typeof IF | typeof FOR;
  index: number;
  sawElse: boolean;
}

const BLOCK_NAME: Record<number, string> = {
  [IF]: "If",
  [ELSE]: "Else",
  [END_IF]: "End If",
  [FOR]: "For",
  [END_FOR]: "End For",
};

function checkBlocks(task: TaskJson, out: ValidationResult): void {
  const stack: Open[] = [];
  task.actions.forEach((action, pos) => {
    const index = action.index ?? pos;
    const code = action.code;
    const top = stack[stack.length - 1];
    const err = (message: string, hint?: string) =>
      out.errors.push({ index, code, message, ...(hint ? { hint } : {}) });
    const describeTop = (t: Open) => `${BLOCK_NAME[t.code]} at action ${t.index}`;

    switch (code) {
      case IF:
        if (!action.condition || action.condition.conditions.length === 0) {
          out.warnings.push({ index, code, message: "If has no condition; it always runs" });
        }
        stack.push({ code: IF, index, sawElse: false });
        break;
      case FOR:
        stack.push({ code: FOR, index, sawElse: false });
        break;
      case ELSE: {
        const isElseIf = action.condition !== undefined && action.condition.conditions.length > 0;
        const kind = isElseIf ? "Else If" : "Else";
        if (!top) {
          err(`${kind} without an open If`);
        } else if (top.code !== IF) {
          err(`${kind} inside ${describeTop(top)}; close it with End For first`);
        } else {
          if (top.sawElse) {
            out.warnings.push({
              index,
              code,
              message: `${kind} after an Else in the If at action ${top.index} is never reached`,
            });
          }
          if (!isElseIf) top.sawElse = true;
        }
        break;
      }
      case END_IF:
        if (!top) err("End If without an open If");
        else if (top.code !== IF) err(`End If closes ${describeTop(top)}; expected End For`);
        else stack.pop();
        break;
      case END_FOR:
        if (!top) err("End For without an open For");
        else if (top.code !== FOR) err(`End For closes ${describeTop(top)}; expected End If`);
        else stack.pop();
        break;
    }
  });
  for (const open of stack) {
    const issue = {
      index: open.index,
      code: open.code,
      message: `${BLOCK_NAME[open.code]} at action ${open.index} is never closed`,
      hint: `Add an ${open.code === IF ? "End If (38)" : "End For (40)"} action`,
    };
    // Tasker closes an open If at the end of the task (the userguide only requires End If when
    // more actions follow), and real exports rely on it. An open For stays an error.
    if (open.code === IF) out.warnings.push(issue);
    else out.errors.push(issue);
  }
}

/**
 * Validate a task against the spec table: block balance, unknown codes, mandatory args,
 * arg kinds, unknown arg ids and simple numeric ranges.
 */
export function validateTask(task: TaskJson, index: SpecIndex): ValidationResult {
  const out: ValidationResult = { errors: [], warnings: [] };
  checkBlocks(task, out);
  task.actions.forEach((action, pos) => {
    const i = action.index ?? pos;
    const spec = index.byCode(action.code);
    if (!spec) {
      if (index.isPlugin(action.code)) return;
      const extra = index.extraActionName(action.code);
      out.warnings.push({
        index: i,
        code: action.code,
        message:
          `Unknown action code ${action.code}${extra ? ` (${extra})` : ""}; ` +
          `use get_action_spec or pass raw XML`,
        ...(action.raw === undefined
          ? { hint: "Without raw XML the args cannot be checked or round-tripped safely" }
          : {}),
      });
      return;
    }
    checkArgs(action, spec, i, out);
  });
  return out;
}
