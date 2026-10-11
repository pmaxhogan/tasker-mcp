/**
 * GUI conformance regression (docs/conformance.md).
 *
 * test/fixtures/emulator/conformance-gui.xml holds tasks Conf.A1..Conf.A7, built by hand in the
 * Tasker 6.6.20 task editor on the emulator and exported through get_task_xml. The expectations
 * below are what the task editor showed for them (uiautomator dumps of the Task Edit list and of
 * the Action Edit screens): action names in order, indentation, the arg summaries on each row,
 * labels, disabled rows, condition text, and the checkboxes set in Action Edit. Each one is
 * checked against the structured JSON (taskToJson) so CI keeps the GUI ground truth.
 */
import { describe, expect, it } from "vitest";
import { taskToJson } from "../src/model/convert.ts";
import { opByCode } from "../src/model/ops.ts";
import type { ActionJson, ConditionListJson, TaskJson } from "../src/model/types.ts";
import { conditionFromInput, joinByName } from "../src/tools/mutate.ts";
import { lookup, loadDoc, readFixture } from "./model/helpers.ts";

const FIXTURE = "emulator/conformance-gui.xml";

/** One row of the Task Edit list as the GUI showed it. */
interface Row {
  /** Action number shown on the row (1-based). */
  n: number;
  /** Action name on the row. */
  name: string;
  /** Indentation level (the row number moves 67px right per level). */
  depth: number;
  /** Greyed out with a bar on the left. */
  disabled?: boolean;
  /** Label shown above the row. */
  label?: string;
  /** Condition text on If / Else If rows. */
  condition?: string;
  /** Arg summary on the row: arg label -> value text. */
  args?: Record<string, string>;
  /** Wait shows one unlabelled summary instead of args. */
  summary?: string;
}

/** Action Edit facts set in the GUI that the row does not show: index -> expected JSON subset. */
type EditorFacts = Record<number, Partial<ActionJson> & { argValues?: Record<string, unknown> }>;

interface GuiTask {
  name: string;
  rows: Row[];
  editor?: EditorFacts;
}

/** Condition joiner as the task editor prints it between conditions. */
const JOIN_TEXT: Record<string, string> = {
  and: "&",
  or: "|",
  and2: "&+",
  or2: "|+",
  xor2: "X|+",
};

/** Show Scene "Display As" list, in the order of the editor's picker (index = stored value). */
const DISPLAY_AS = [
  "Overlay",
  "Overlay, Blocking",
  "Overlay, Blocking, Full Window",
  "Dialog",
  "Dialog, Dim Behind Heavy",
  "Dialog, Dim Behind",
  "Activity",
  "Activity, No Bar",
  "Activity, No Status",
  "Activity, No Bar, No Status",
  "Activity, No Bar, No Status, No Nav",
];

const GUI: GuiTask[] = [
  {
    name: "Conf.A1",
    rows: [
      { n: 1, name: "For", depth: 0, args: { Variable: "%item", Items: "1,2,3" } },
      { n: 2, name: "If", depth: 1, condition: "%item eq 2" },
      { n: 3, name: "Flash", depth: 2, args: { Text: "two" } },
      { n: 4, name: "Else", depth: 1 },
      { n: 5, name: "Flash", depth: 2, args: { Text: "other" } },
      { n: 6, name: "End If", depth: 1 },
      { n: 7, name: "Wait", depth: 1, summary: "1 Second, 3 MS" },
      { n: 8, name: "End For", depth: 0 },
    ],
    editor: {
      2: { argValues: { Long: 1 } },
      4: { argValues: { Long: 0 } },
      6: { argValues: { MS: 3, Seconds: 1 } },
    },
  },
  {
    name: "Conf.A2",
    rows: [
      { n: 1, name: "If", depth: 0, condition: "%aaa ~ foo* & %bbb Set | %ccc < 5" },
      { n: 2, name: "Variable Set", depth: 1, args: { Name: "%result", To: "yes" } },
      { n: 3, name: "Else If", depth: 0, condition: "%ddd neq x" },
      { n: 4, name: "Variable Set", depth: 1, args: { Name: "%result", To: "maybe" } },
      { n: 5, name: "End If", depth: 0 },
      { n: 6, name: "Return", depth: 0, args: { Value: "%result", Stop: "On" } },
    ],
  },
  {
    name: "Conf.A3",
    rows: [
      {
        n: 1,
        name: "Variable Set",
        depth: 0,
        label: "start here",
        args: { Name: "%counter", To: "1" },
      },
      { n: 2, name: "Flash", depth: 0, disabled: true, args: { Text: "disabled flash" } },
      {
        n: 3,
        name: "Read File",
        depth: 0,
        args: { File: "Download/conf-missing.txt", "To Var": "%content" },
      },
      { n: 4, name: "Wait", depth: 0, label: "pause", summary: "2 Seconds" },
    ],
    editor: { 2: { continueOnError: true }, 0: { continueOnError: false } },
  },
  {
    name: "Conf.A4",
    rows: [
      { n: 1, name: "Variable Set", depth: 0, args: { Name: "%csv", To: "a,b,c" } },
      { n: 2, name: "Variable Split", depth: 0, args: { Name: "%csv", Splitter: "," } },
      {
        n: 3,
        name: "Array Push",
        depth: 0,
        args: { "Variable Array": "%csv", Position: "1", Value: "zz" },
      },
      { n: 4, name: "Variable Set", depth: 0, args: { Name: "%text", To: "foo and foo" } },
      {
        n: 5,
        name: "Variable Search Replace",
        depth: 0,
        args: { Variable: "%text", Search: "foo", "Replace With": "bar" },
      },
      { n: 6, name: "Return", depth: 0, args: { Value: "%csv(#)/%text", Stop: "On" } },
    ],
    editor: {
      1: { argValues: { "Delete Base": 1 } },
      4: { argValues: { "Store Matches In Array": "%hits", "Replace Matches": 1 } },
    },
  },
  {
    name: "Conf.A5",
    rows: [
      {
        n: 1,
        name: "Perform Task",
        depth: 0,
        args: { Name: "Conf.A4", "Parameter 1 (%par1)": "first" },
      },
      { n: 2, name: "Show Scene", depth: 0, args: { Name: "ConfScene", "Display As": "Dialog" } },
      { n: 3, name: "Flash", depth: 0, args: { Text: "got %ret" } },
      { n: 4, name: "Return", depth: 0, args: { Value: "%ret", Stop: "On" } },
    ],
    editor: {
      0: {
        argValues: {
          Priority: "%priority",
          "Parameter 2 (%par2)": "second value",
          "Return Value Variable": "%ret",
        },
      },
      1: { continueOnError: true },
      2: { argValues: { "Tasker Layout": 1, Title: "Conf", Long: 0 } },
    },
  },
  {
    name: "Conf.A6",
    rows: [
      { n: 1, name: "If", depth: 0, condition: "%xxx !Set X|+ %yyy ~R ^a.*" },
      { n: 2, name: "Wait", depth: 1, summary: "2 Mins" },
      { n: 3, name: "Beep", depth: 1, args: { Frequency: "8000", Duration: "900" } },
      { n: 4, name: "End If", depth: 0 },
    ],
    // Folded in the editor (only row 1 was visible), then saved.
    editor: { 0: { collapsed: true } },
  },
  {
    name: "Conf.A7",
    rows: [
      { n: 1, name: "If", depth: 0, condition: "%num = 4 &+ %num Even |+ %num > 10" },
      { n: 2, name: "Variable Set", depth: 1, args: { Name: "%out", To: "%num*2" } },
      { n: 3, name: "Else", depth: 0 },
      { n: 4, name: "Variable Set", depth: 1, args: { Name: "%out", To: "small" } },
      { n: 5, name: "End If", depth: 0 },
      { n: 6, name: "Return", depth: 0, args: { Value: "%out", Stop: "On" } },
    ],
    // Folded and unfolded again in the editor before saving.
    editor: {
      0: { collapsed: false },
      1: { argValues: { "Do Maths": 1 } },
      3: { argValues: { Append: 1 } },
    },
  },
];

/** The condition text the task editor prints for a ConditionList. */
function conditionText(c: ConditionListJson): string {
  const parts: string[] = [];
  c.conditions.forEach((x, i) => {
    if (i > 0) parts.push(JOIN_TEXT[c.joins?.[i - 1] ?? "and"] ?? `?${c.joins?.[i - 1]}`);
    parts.push(x.lhs, opByCode(x.op)?.symbol ?? `?${x.op}`);
    if (opByCode(x.op)?.takesRhs === true) parts.push(x.rhs ?? "");
  });
  return parts.join(" ");
}

/** The Wait summary ("1 Second, 3 MS", "2 Mins"), for the units the fixture uses. */
function waitSummary(a: ActionJson): string {
  const v = (name: string): number => {
    const arg = a.args.find((x) => x.name === name);
    return arg?.kind === "Int" ? Number(arg.value) : 0;
  };
  const out: string[] = [];
  const m = v("Minutes");
  if (m > 0) out.push(m === 1 ? "1 Minute" : `${m} Mins`);
  const s = v("Seconds");
  if (s > 0) out.push(s === 1 ? "1 Second" : `${s} Seconds`);
  if (v("MS") > 0) out.push(`${v("MS")} MS`);
  return out.join(", ");
}

/** An arg value as the row summary prints it. */
function argText(a: ActionJson, label: string): string | undefined {
  const arg = a.args.find((x) => x.name === label);
  if (arg === undefined || arg.kind === "Raw") return undefined;
  if (a.name === "Show Scene" && label === "Display As") return DISPLAY_AS[Number(arg.value)];
  if (arg.kind === "Int" && /^(Stop)$/.test(label)) return arg.value === 1 ? "On" : "Off";
  return String(arg.value);
}

const doc = loadDoc(FIXTURE);
const tasks = new Map<string, TaskJson>(
  doc.tasks().map((el) => {
    const t = taskToJson(el, lookup);
    return [t.name, t];
  }),
);

describe("GUI conformance: the structured view matches the Tasker task editor", () => {
  it("has every GUI-built task and nothing else", () => {
    expect([...tasks.keys()].sort()).toEqual(GUI.map((g) => g.name));
    for (const t of tasks.values()) {
      expect(t.warnings, t.name).toBeUndefined();
      expect(
        t.actions.every((a) => a.raw === undefined),
        t.name,
      ).toBe(true);
    }
  });

  it("carries no token-like secret", () => {
    const xml = readFixture(FIXTURE);
    expect(xml).not.toMatch(/[0-9a-fA-F]{64}/);
  });

  describe.each(GUI)("$name", (g) => {
    const task = tasks.get(g.name)!;

    it("has the GUI's actions, in order, with the GUI's names and indentation", () => {
      expect(task.actions.length).toBe(g.rows.length);
      expect(task.actions.map((a) => a.name)).toEqual(g.rows.map((r) => r.name));
      expect(task.actions.map((a) => a.depth)).toEqual(g.rows.map((r) => r.depth));
    });

    it.each(g.rows)("row $n $name: enabled, label, condition and arg summary", (r) => {
      const a = task.actions[r.n - 1]!;
      expect(a.index).toBe(r.n - 1);
      expect(a.enabled).toBe(r.disabled !== true);
      expect(a.label).toBe(r.label);
      expect(a.condition === undefined ? undefined : conditionText(a.condition)).toBe(r.condition);
      for (const [label, text] of Object.entries(r.args ?? {})) {
        expect(argText(a, label), `${label}`).toBe(text);
      }
      if (r.summary !== undefined) expect(waitSummary(a)).toBe(r.summary);
    });

    it("matches what Action Edit showed", () => {
      for (const [i, facts] of Object.entries(g.editor ?? {})) {
        const a = task.actions[Number(i)]!;
        const { argValues, ...fields } = facts;
        expect(a, `action ${i}`).toMatchObject(fields);
        for (const [name, value] of Object.entries(argValues ?? {})) {
          expect(a.args.find((x) => x.name === name)?.["value" as never], `${i} ${name}`).toBe(
            value,
          );
        }
      }
    });

    it("feeds back into create/edit_task unchanged (joins and operators are accepted)", () => {
      for (const a of task.actions) {
        if (a.condition === undefined) continue;
        for (const j of a.condition.joins ?? []) expect(joinByName(j), j).toBe(j);
        const back = conditionFromInput(
          {
            conditions: a.condition.conditions.map((c) => ({ lhs: c.lhs, op: c.op, rhs: c.rhs })),
            ...(a.condition.joins === undefined ? {} : { joins: a.condition.joins }),
          },
          "test",
        );
        expect(back).toEqual(a.condition);
      }
    });
  });

  it("names an Else with a condition Else If and a bare Else Else", () => {
    expect(tasks.get("Conf.A2")!.actions[2]).toMatchObject({ code: 43, name: "Else If" });
    const a7 = tasks.get("Conf.A7")!;
    expect(a7.actions[2]).toMatchObject({ code: 43, name: "Else" });
  });
});
