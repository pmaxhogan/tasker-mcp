import { describe, expect, it } from "vitest";
import { computeDepths, closesBlock, opensBlock } from "../../src/edit/blocks.ts";
import { DEFAULT_TV, planReplaceTask } from "../../src/edit/plan.ts";
import { applyPatch, reindex } from "../../src/edit/splice.ts";
import { diffTasks, findDuplicates, isDefaultArg } from "../../src/edit/verify.ts";
import { taskToJson } from "../../src/model/convert.ts";
import { TaskerDoc } from "../../src/model/document.ts";
import type { ActionJson, TaskJson } from "../../src/model/types.ts";
import { childText, children, parseXml } from "../../src/xml/index.ts";
import { loadDoc, lookup } from "../model/helpers.ts";

const now = (): number => 1700000000000;
const flash = (text: string): ActionJson => ({
  code: 548,
  args: [{ id: 0, kind: "Str", value: text }],
});

describe("blocks", () => {
  it("depths for nested If/Else/For with unbalanced ends clamped", () => {
    expect(computeDepths([37, 547, 43, 547, 39, 547, 40, 38, 38, 43, 547])).toEqual([
      0, 1, 0, 1, 1, 2, 1, 0, 0, 0, 0,
    ]);
    expect(opensBlock(39)).toBe(true);
    expect(closesBlock(40)).toBe(true);
    expect(opensBlock(547)).toBe(false);
  });
});

describe("planReplaceTask", () => {
  const rho = loadDoc("public/rho.prj.xml");

  it("replaces an existing task in place: same id, cdate, project, base children", () => {
    const current = taskToJson(rho.taskByName("RhoOpenUrl")!, lookup);
    const next: TaskJson = { ...current, actions: [...current.actions, flash("done")] };
    const plan = planReplaceTask(rho, next, lookup, { now });
    expect(plan.isNew).toBe(false);
    expect(plan.taskId).toBe(151);
    expect(plan.project).toBe("Rho");
    expect(
      plan.xml.startsWith('<TaskerData sr="" dvi="1" tv="6.6.17-rc">\n\t<Task sr="task151">'),
    ).toBe(true);
    const back = new TaskerDoc(parseXml(plan.xml));
    const t = back.taskById(151)!;
    expect(childText(t, "cdate")).toBe("1770066138409");
    expect(childText(t, "edate")).toBe("1700000000000");
    const j = taskToJson(t, lookup);
    expect(j.actions).toHaveLength(3);
    expect(diffTasks(next, j, lookup).equal).toBe(true);
    expect(plan.warnings).toEqual([]);
  });

  it("new name gets a fresh id above every task and profile id", () => {
    const plan = planReplaceTask(
      rho,
      { name: "Brand New", project: "Elsewhere", actions: [flash("x")] },
      lookup,
      { now, tv: "6.6.20", fillDefaults: false },
    );
    expect(plan.isNew).toBe(true);
    expect(plan.taskId).toBe(182);
    expect(plan.project).toBe("Elsewhere");
    expect(plan.xml).toContain('tv="6.6.20"');
    expect(children(plan.element, "Action")).toHaveLength(1);
    expect(plan.xml).not.toContain('sr="arg1"');
  });

  it("falls back to DEFAULT_TV and refuses an anonymous task", () => {
    const empty = TaskerDoc.parse("<TaskerData/>");
    const plan = planReplaceTask(empty, { name: "A", actions: [] }, lookup, { now });
    expect(plan.xml).toContain(`tv="${DEFAULT_TV}"`);
    expect(plan.project).toBeUndefined();
    expect(plan.taskId).toBe(1);
    expect(() => planReplaceTask(empty, { name: " ", actions: [] }, lookup)).toThrow(/name/);
  });

  it("collects default-fill warnings (Bundle args)", () => {
    const empty = TaskerDoc.parse("<TaskerData/>");
    const plan = planReplaceTask(empty, { name: "H", actions: [{ code: 339, args: [] }] }, lookup);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });
});

describe("applyPatch", () => {
  const base: TaskJson = {
    name: "T",
    priority: 6,
    comment: "c",
    actions: [{ code: 37, args: [] }, flash("a"), { code: 38, args: [] }],
  };

  it("replaces actions and reindexes depth", () => {
    const out = applyPatch(base, { actions: [flash("x"), flash("y")] });
    expect(out.actions.map((a) => [a.index, a.depth])).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(base.actions).toHaveLength(3);
  });

  it("splices", () => {
    const out = applyPatch(base, {
      splice: { index: 1, deleteCount: 1, insert: [flash("b"), flash("c")] },
    });
    expect(out.actions.map((a) => a.code)).toEqual([37, 548, 548, 38]);
    expect(out.actions.map((a) => a.depth)).toEqual([0, 1, 1, 0]);
    const appended = applyPatch(base, {
      splice: { index: 3, deleteCount: 0, insert: [flash("z")] },
    });
    expect(appended.actions).toHaveLength(4);
    const deleted = applyPatch(base, { splice: { index: 0, deleteCount: 3 } });
    expect(deleted.actions).toEqual([]);
  });

  it("rejects bad splices", () => {
    expect(() => applyPatch(base, { splice: { index: 4, deleteCount: 0 } })).toThrow(RangeError);
    expect(() => applyPatch(base, { splice: { index: -1, deleteCount: 0 } })).toThrow(RangeError);
    expect(() => applyPatch(base, { splice: { index: 1, deleteCount: 3 } })).toThrow(RangeError);
    expect(() => applyPatch(base, { splice: { index: 0, deleteCount: -1 } })).toThrow(RangeError);
    expect(() => applyPatch(base, { splice: { index: 0.5, deleteCount: 0 } })).toThrow(RangeError);
  });

  it("sets and clears scalar fields; arrays apply in order", () => {
    const out = applyPatch(base, [
      { set: { name: "U", priority: null, collision: 2, comment: null } },
      { set: { comment: "new" } },
    ]);
    expect(out.name).toBe("U");
    expect(out.priority).toBeUndefined();
    expect("priority" in out).toBe(false);
    expect(out.collision).toBe(2);
    expect(out.comment).toBe("new");
    expect(() => applyPatch(base, { set: { name: "" } })).toThrow(/empty/);
    expect(applyPatch(base, {}).actions.map((a) => a.index)).toEqual([0, 1, 2]);
  });

  it("combined keys apply actions, then splice, then set", () => {
    const out = applyPatch(base, {
      actions: [flash("1")],
      splice: { index: 1, deleteCount: 0, insert: [flash("2")] },
      set: { priority: 9 },
    });
    expect(out.actions.map((a) => a.args[0])).toEqual([
      { id: 0, kind: "Str", value: "1" },
      { id: 0, kind: "Str", value: "2" },
    ]);
    expect(out.priority).toBe(9);
    expect(reindex([])).toEqual([]);
  });
});

describe("diffTasks", () => {
  const expected: TaskJson = {
    name: "T",
    priority: 6,
    collision: 1,
    comment: "c",
    actions: [
      {
        code: 547,
        label: "L",
        continueOnError: true,
        condition: {
          conditions: [
            { lhs: "%a", op: 0, rhs: "1" },
            { lhs: "%b", op: 12 },
          ],
        },
        args: [
          { id: 0, kind: "Str", value: "%x" },
          { id: 1, kind: "Str", value: "1" },
          { id: 2, kind: "Bool", value: true },
        ],
      },
      { code: 5, args: [], raw: '<Action sr="act1" ve="7">\n<code>5</code></Action>' },
    ],
  };
  const actual: TaskJson = {
    id: 3,
    name: "T",
    priority: 6,
    collision: 1,
    comment: "c",
    actions: [
      {
        index: 0,
        code: 547,
        enabled: true,
        label: "L",
        continueOnError: true,
        condition: {
          conditions: [
            { lhs: "%a", op: 0, opName: "eq", rhs: "1" },
            { lhs: "%b", op: 12, rhs: "" },
          ],
          joins: ["And"],
        },
        args: [
          { id: 0, kind: "Str", value: "%x" },
          { id: 1, kind: "Str", value: "1" },
          { id: 2, kind: "Int", value: 1 },
          { id: 3, kind: "Int", value: 0 },
          { id: 5, kind: "Int", value: 3 },
          { id: 7, kind: "Raw", tag: "Bundle", raw: "<Bundle/>" },
          { id: 8, kind: "Raw", tag: "App", raw: '<App sr="arg8"/>' },
        ],
      },
      { code: 5, args: [], raw: '<Action sr="act9" ve="7"><code>5</code></Action>' },
    ],
  };

  it("equal modulo phone-filled defaults, Bool vs Int, join case, raw whitespace", () => {
    expect(diffTasks(expected, actual, lookup)).toEqual({ equal: true, differences: [] });
  });

  it("reports every kind of difference", () => {
    const changed: TaskJson = structuredClone(actual);
    changed.name = "X";
    changed.priority = 7;
    changed.collision = 0;
    changed.comment = "d";
    const a0 = changed.actions[0]!;
    a0.enabled = false;
    a0.label = "M";
    a0.continueOnError = false;
    a0.condition = { conditions: [{ lhs: "%a", op: 1, rhs: "1" }] };
    a0.args[1] = { id: 1, kind: "Str", value: "2" };
    a0.args.push({ id: 6, kind: "Int", value: 1 });
    a0.args = a0.args.filter((x) => x.id !== 0);
    changed.actions[1]!.raw = "<Action><code>6</code></Action>";
    const d = diffTasks(expected, changed, lookup);
    expect(d.equal).toBe(false);
    expect(d.differences).toEqual([
      'name "T" expected, got "X"',
      "priority 6 expected, got 7",
      "collision 1 expected, got 0",
      "comment differs",
      "action 0: enabled true expected, got false",
      'action 0: label "L" expected, got "M"',
      "action 0: continueOnError true expected, got false",
      "action 0: condition differs",
      'action 0: arg0 missing, expected Str "%x"',
      'action 0: arg1 expected Str "1", got Str "2"',
      "action 0: arg6 unexpected Int 1",
      "action 1: raw XML differs",
    ]);
  });

  it("code mismatch and count mismatch", () => {
    const d = diffTasks(
      { name: "T", actions: [flash("a"), flash("b")] },
      { name: "T", actions: [{ code: 547, args: [] }] },
    );
    expect(d.differences).toEqual([
      "action count 2 expected, got 1",
      "action 0: code 548 expected, got 547",
    ]);
  });

  it("a Bundle we sent that the phone dropped is a difference", () => {
    const bundle = '<Bundle sr="arg0"><Vals sr="val"><k>v</k></Vals></Bundle>';
    const d = diffTasks(
      {
        name: "T",
        actions: [{ code: 107361459, args: [{ id: 0, kind: "Raw", tag: "Bundle", raw: bundle }] }],
      },
      { name: "T", actions: [{ code: 107361459, args: [] }] },
    );
    expect(d.equal).toBe(false);
    expect(d.differences[0]).toMatch(/^action 0: arg0 missing, expected Bundle/);
  });

  it("without a lookup uses generic defaults; Raw args compare by content", () => {
    const e: TaskJson = {
      name: "T",
      actions: [
        {
          code: 1,
          args: [
            { id: 0, kind: "Raw", tag: "Img", raw: '<Img sr="arg0" ve="2"><nme>a</nme></Img>' },
          ],
        },
      ],
    };
    const a: TaskJson = {
      name: "T",
      actions: [
        {
          code: 1,
          args: [
            {
              id: 0,
              kind: "Raw",
              tag: "Img",
              raw: '<Img sr="arg0" ve="2">\n\t<nme>b</nme>\n</Img>',
            },
            { id: 1, kind: "Int", value: 0 },
            { id: 2, kind: "Bool", value: false },
            { id: 3, kind: "Raw", tag: "Img", raw: '<Img sr="arg3" ve="2"/>' },
          ],
        },
      ],
    };
    const d = diffTasks(e, a);
    expect(d.differences).toEqual([
      'action 0: arg0 expected Img <Img ve="2"><nme>a</nme></Img>, got Img <Img ve="2"><nme>b</nme></Img>',
    ]);
  });

  it("isDefaultArg respects spec defaults", () => {
    const vs = lookup(547)!;
    const spec = (id: number) => vs.args.find((a) => a.id === id);
    expect(isDefaultArg({ id: 5, kind: "Int", value: 3 }, spec(5))).toBe(true);
    expect(isDefaultArg({ id: 5, kind: "Int", value: 0 }, spec(5))).toBe(false);
    expect(isDefaultArg({ id: 2, kind: "Int", value: 0 }, spec(2))).toBe(true);
    expect(isDefaultArg({ id: 2, kind: "Bool", value: false }, spec(2))).toBe(true);
    expect(isDefaultArg({ id: 0, kind: "Raw", tag: "App", raw: "<App><x/></App>" })).toBe(false);
    const trueSpec = { id: 0, name: "b", type: 3, isMandatory: true, spec: "true" };
    expect(isDefaultArg({ id: 0, kind: "Int", value: 1 }, trueSpec)).toBe(true);
    expect(isDefaultArg({ id: 0, kind: "Bool", value: true }, trueSpec)).toBe(true);
  });
});

describe("findDuplicates", () => {
  it("returns every id with the name", () => {
    const d = TaskerDoc.parse(
      [
        "<TaskerData>",
        '<Task sr="task5"><id>5</id><nme>A</nme></Task>',
        '<Task sr="task2"><id>2</id><nme>A</nme></Task>',
        '<Task sr="task3"><id>3</id><nme>B</nme></Task>',
        '<Profile sr="prof4"><id>4</id><nme>A</nme></Profile>',
        "</TaskerData>",
      ].join(""),
    );
    expect(findDuplicates(d, "task", "A")).toEqual([2, 5]);
    expect(findDuplicates(d, "task", "B")).toEqual([3]);
    expect(findDuplicates(d, "profile", "A")).toEqual([4]);
    expect(findDuplicates(d, "task", "")).toEqual([]);
  });
});
