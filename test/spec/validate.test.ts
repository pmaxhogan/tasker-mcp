import { describe, expect, it } from "vitest";
import type { ActionJson, ArgJson, TaskJson } from "../../src/model/types.ts";
import { ELSE, END_FOR, END_IF, FOR, IF, SpecIndex, getSpec } from "../../src/spec/table.ts";
import type { SpecTable } from "../../src/spec/types.ts";
import { parseRange, validateTask } from "../../src/spec/validate.ts";

/** Synthetic table: one action per arg type, plus the block actions. */
const table: SpecTable = {
  meta: { generated: "test", sources: [] },
  categories: [{ code: 1, name: "Test" }],
  actions: [
    { code: IF, name: "If", args: [] },
    { code: END_IF, name: "End If", args: [] },
    { code: FOR, name: "For", args: [] },
    { code: END_FOR, name: "End For", args: [] },
    { code: ELSE, name: "Else", args: [] },
    {
      code: 500,
      name: "Everything",
      categoryCode: 1,
      args: [
        { id: 0, name: "Count", type: 0, isMandatory: true, spec: "0:50" },
        { id: 1, name: "Text", type: 1, isMandatory: true },
        { id: 2, name: "App", type: 2, isMandatory: false },
        { id: 3, name: "Flag", type: 3, isMandatory: true },
        { id: 4, name: "Icon", type: 4, isMandatory: false },
        { id: 5, name: "Extras", type: 5, isMandatory: false },
        { id: 6, name: "Scene", type: 6, isMandatory: false, label: "Scene Name" },
        { id: 7, name: "Level", type: 0, isMandatory: false, spec: "1:10:5" },
        { id: 8, name: "Odd", type: 7, isMandatory: false },
      ],
    },
  ],
};
const idx = new SpecIndex(table, { extraActions: [{ code: 151, name: "Deprecated" }] });

const goodArgs: ArgJson[] = [
  { id: 0, kind: "Int", value: 3 },
  { id: 1, kind: "Str", value: "" },
  { id: 3, kind: "Int", value: 0 },
];

function act(code: number, extra: Partial<ActionJson> = {}): ActionJson {
  return { code, args: [], ...extra };
}
function cond(): ActionJson["condition"] {
  return { conditions: [{ lhs: "%a", op: 0, rhs: "b" }] };
}
function task(...actions: ActionJson[]): TaskJson {
  return { name: "T", actions };
}
function everything(args: ArgJson[], extra: Partial<ActionJson> = {}): ActionJson {
  return act(500, { args, ...extra });
}
function run(...actions: ActionJson[]) {
  return validateTask(task(...actions), idx);
}

describe("parseRange", () => {
  it("parses min:max and min:max:default", () => {
    expect(parseRange("0:50")).toEqual({ min: 0, max: 50 });
    expect(parseRange("-60:60:0")).toEqual({ min: -60, max: 60 });
  });
  it("ignores other forms", () => {
    expect(parseRange(undefined)).toBeUndefined();
    expect(parseRange("t:1:?")).toBeUndefined();
    expect(parseRange("0:0:3")).toBeUndefined();
  });
});

describe("block structure", () => {
  it("accepts balanced If / Else If / Else / End If inside For", () => {
    const r = run(
      act(FOR),
      act(IF, { condition: cond() }),
      act(ELSE, { condition: cond() }),
      act(ELSE),
      act(END_IF),
      act(END_FOR),
    );
    expect(r).toEqual({ errors: [], warnings: [] });
  });

  it("Else without If", () => {
    const r = run(act(ELSE));
    expect(r.errors).toEqual([{ index: 0, code: ELSE, message: "Else without an open If" }]);
    expect(run(act(ELSE, { condition: cond() })).errors[0]?.message).toBe(
      "Else If without an open If",
    );
  });

  it("Else inside a For", () => {
    const r = run(act(FOR), act(ELSE), act(END_FOR));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ index: 1, code: ELSE });
    expect(r.errors[0]?.message).toMatch(/inside For at action 0/);
  });

  it("End If closing a For and End For closing an If", () => {
    const a = run(act(FOR), act(END_IF));
    expect(a.errors.map((e) => e.message)).toEqual([
      "End If closes For at action 0; expected End For",
      "For at action 0 is never closed",
    ]);
    const b = run(act(IF, { condition: cond() }), act(END_FOR), act(END_IF));
    expect(b.errors.map((e) => e.message)).toEqual([
      "End For closes If at action 0; expected End If",
    ]);
  });

  it("stray End If / End For", () => {
    expect(run(act(END_IF)).errors[0]?.message).toBe("End If without an open If");
    expect(run(act(END_FOR)).errors[0]?.message).toBe("End For without an open For");
  });

  it("unclosed For is an error, unclosed If only a warning", () => {
    const f = run(act(FOR));
    expect(f.errors[0]).toMatchObject({ index: 0, code: FOR, hint: "Add an End For (40) action" });
    const i = run(act(IF, { condition: cond() }));
    expect(i.errors).toEqual([]);
    expect(i.warnings[0]).toMatchObject({
      index: 0,
      message: "If at action 0 is never closed",
      hint: "Add an End If (38) action",
    });
  });

  it("If without a condition warns", () => {
    const r = run(act(IF), act(END_IF));
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]?.message).toBe("If has no condition; it always runs");
    expect(run(act(IF, { condition: { conditions: [] } }), act(END_IF)).warnings).toHaveLength(1);
  });

  it("anything after a plain Else is unreachable", () => {
    const r = run(
      act(IF, { condition: cond() }),
      act(ELSE),
      act(ELSE, { condition: cond() }),
      act(END_IF),
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]?.message).toMatch(/Else If after an Else/);
    expect(r.warnings[0]?.index).toBe(2);
  });

  it("uses ActionJson.index when present", () => {
    const r = run(act(END_IF, { index: 7 }));
    expect(r.errors[0]?.index).toBe(7);
  });
});

describe("unknown and plugin codes", () => {
  it("unknown code warns with a hint when there is no raw XML", () => {
    const r = run(act(999));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([
      {
        index: 0,
        code: 999,
        message: "Unknown action code 999; use get_action_spec or pass raw XML",
        hint: "Without raw XML the args cannot be checked or round-tripped safely",
      },
    ]);
    const withRaw = run(act(999, { raw: "<Action/>" }));
    expect(withRaw.warnings[0]?.hint).toBeUndefined();
  });

  it("names deprecated codes", () => {
    expect(run(act(151)).warnings[0]?.message).toBe(
      "Unknown action code 151 (Deprecated); use get_action_spec or pass raw XML",
    );
  });

  it("plugin codes are not checked at all", () => {
    const r = run(act(107361459, { args: [{ id: 0, kind: "Str", value: "x" }] }), act(1000));
    expect(r).toEqual({ errors: [], warnings: [] });
  });
});

describe("args", () => {
  it("a fully valid action is clean", () => {
    const r = run(
      everything([
        ...goodArgs,
        { id: 2, kind: "Raw", tag: "App", raw: '<App sr="arg2"/>' },
        { id: 4, kind: "Raw", tag: "Img", raw: '<Img sr="arg4"/>' },
        { id: 5, kind: "Raw", tag: "Bundle", raw: '<Bundle sr="arg5"/>' },
        { id: 6, kind: "Str", value: "My Scene" },
        { id: 7, kind: "Int", value: "%level" },
        { id: 8, kind: "Str", value: "runtime-only type is not checked" },
      ]),
    );
    expect(r).toEqual({ errors: [], warnings: [] });
  });

  it("missing mandatory String / Int is an error, missing Boolean a warning", () => {
    const r = run(everything([]));
    expect(r.errors.map((e) => e.message)).toEqual([
      'Everything is missing mandatory arg0 "Count"',
      'Everything is missing mandatory arg1 "Text"',
    ]);
    expect(r.errors[0]?.hint).toMatch(/kind: "Int"/);
    expect(r.errors[1]?.hint).toMatch(/kind: "Str"/);
    expect(r.warnings.map((w) => w.message)).toEqual([
      'Everything is missing mandatory arg3 "Flag"',
    ]);
  });

  it("missing args are fine when the action carries raw XML", () => {
    expect(run(everything([], { raw: "<Action/>" }))).toEqual({ errors: [], warnings: [] });
  });

  it("duplicate arg ids", () => {
    const r = run(everything([...goodArgs, { id: 1, kind: "Str", value: "again" }]));
    expect(r.errors.map((e) => e.message)).toEqual(["Duplicate arg1 in Everything"]);
  });

  it("args not in the spec warn", () => {
    const r = run(everything([...goodArgs, { id: 42, kind: "Str", value: "?" }]));
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]?.message).toBe(
      "Everything has no arg42 in the spec table; it will be written as-is",
    );
  });

  describe("Int", () => {
    const withCount = (a: ArgJson) => run(everything([a, ...goodArgs.filter((g) => g.id !== 0)]));

    it.each(["", "%v", "%priority+1", "12", " 7 "])("accepts %j", (value) => {
      expect(withCount({ id: 0, kind: "Int", value }).errors).toEqual([]);
    });

    it("rejects non-numeric text", () => {
      const r = withCount({ id: 0, kind: "Int", value: "abc" });
      expect(r.errors[0]?.message).toBe(
        'arg0 "Count" must be an integer or a %variable, got "abc"',
      );
    });

    it("rejects the wrong kind", () => {
      const r = withCount({ id: 0, kind: "Str", value: "3" });
      expect(r.errors[0]?.message).toBe(
        'arg0 "Count" is Int and must be written as <Int>, got kind Str',
      );
      expect(r.errors[0]?.hint).toMatch(/kind: "Int"/);
    });

    it("warns when out of a min:max range, numeric or numeric string", () => {
      expect(withCount({ id: 0, kind: "Int", value: 51 }).warnings[0]?.message).toBe(
        'arg0 "Count" value 51 is outside the usual range 0..50',
      );
      expect(withCount({ id: 0, kind: "Int", value: "-1" }).warnings).toHaveLength(1);
      expect(withCount({ id: 0, kind: "Int", value: 50 }).warnings).toEqual([]);
      const lvl = run(everything([...goodArgs, { id: 7, kind: "Int", value: 0 }]));
      expect(lvl.errors).toEqual([]);
      expect(lvl.warnings[0]?.message).toMatch(/range 1\.\.10/);
    });

    it("accepts a Raw <Int>", () => {
      expect(withCount({ id: 0, kind: "Raw", tag: "Int", raw: '<Int sr="arg0"/>' }).errors).toEqual(
        [],
      );
    });
  });

  describe("String", () => {
    it("rejects Int", () => {
      const r = run(everything([goodArgs[0]!, { id: 1, kind: "Int", value: 1 }, goodArgs[2]!]));
      expect(r.errors[0]?.message).toBe(
        'arg1 "Text" is String and must be written as <Str>, got kind Int',
      );
    });
  });

  describe("Boolean", () => {
    const withFlag = (a: ArgJson) => run(everything([goodArgs[0]!, goodArgs[1]!, a]));

    it.each([0, 1, "0", "1"])("accepts Int %j", (value) => {
      expect(withFlag({ id: 3, kind: "Int", value }).errors).toEqual([]);
    });

    it("accepts Bool", () => {
      expect(withFlag({ id: 3, kind: "Bool", value: true }).errors).toEqual([]);
    });

    it("rejects other Int values and the wrong kind", () => {
      expect(withFlag({ id: 3, kind: "Int", value: 2 }).errors[0]?.message).toBe(
        'arg3 "Flag" is Boolean and must be 0 or 1, got "2"',
      );
      const s = withFlag({ id: 3, kind: "Str", value: "true" });
      expect(s.errors[0]?.message).toMatch(/is Boolean and must be written as <Int>, got kind Str/);
      expect(s.errors[0]?.hint).toMatch(/kind: "Bool"/);
    });
  });

  describe("App / Icon / Bundle / Scene", () => {
    it.each([
      [2, "App"],
      [4, "Img"],
      [5, "Bundle"],
    ])("arg%i needs Raw <%s>", (id, tag) => {
      const asStr = run(everything([...goodArgs, { id, kind: "Str", value: "x" }]));
      expect(asStr.errors[0]?.message).toMatch(
        new RegExp(`must be written as <${tag}>, got kind Str`),
      );
      expect(asStr.errors[0]?.hint).toContain(`tag: "${tag}"`);
      const wrongTag = run(
        everything([...goodArgs, { id, kind: "Raw", tag: "Str", raw: "<Str/>" }]),
      );
      expect(wrongTag.errors[0]?.message).toMatch(
        new RegExp(`must be written as <${tag}>, got <Str>`),
      );
    });

    it("Scene names are Str", () => {
      const r = run(everything([...goodArgs, { id: 6, kind: "Int", value: 1 }]));
      expect(r.errors[0]?.message).toBe(
        'arg6 "Scene Name" is Scene and must be written as <Str>, got kind Int',
      );
    });
  });
});

describe("against the real spec table", () => {
  const spec = getSpec();

  it("a typical Perform Task / Variable Set / Flash task is clean", () => {
    const t: TaskJson = {
      name: "Real",
      actions: [
        {
          code: 547,
          args: [
            { id: 0, kind: "Str", value: "%x" },
            { id: 1, kind: "Str", value: "1" },
            { id: 2, kind: "Int", value: 0 },
            { id: 3, kind: "Int", value: 0 },
            { id: 4, kind: "Int", value: 0 },
            { id: 5, kind: "Int", value: 3 },
            { id: 6, kind: "Int", value: 0 },
          ],
        },
        { code: IF, args: [], condition: { conditions: [{ lhs: "%x", op: 12 }] } },
        { code: 548, args: [{ id: 0, kind: "Str", value: "hi" }] },
        { code: END_IF, args: [] },
      ],
    };
    const r = validateTask(t, spec);
    expect(r.errors).toEqual([]);
    // Flash has Boolean args that were left out: warnings only.
    expect(r.warnings.every((w) => w.index === 2)).toBe(true);
  });
});
