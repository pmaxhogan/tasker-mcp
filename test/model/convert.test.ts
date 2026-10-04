import { describe, expect, it } from "vitest";
import {
  actionToElement,
  actionToJson,
  argToElement,
  argToJson,
  boolDefault,
  conditionListToElement,
  conditionListToJson,
  defaultArgElement,
  formatElement,
  intDefault,
  isPluginCode,
  parseIdList,
  parseNameList,
  profileToJson,
  projectToJson,
  sortChildren,
  srIndex,
  taskFromJson,
  taskToJson,
  wrapForImport,
} from "../../src/model/convert.ts";
import { TaskerDoc } from "../../src/model/document.ts";
import type { ActionJson, TaskJson } from "../../src/model/types.ts";
import {
  children,
  childText,
  createElement,
  parseFragment,
  parseXml,
  serializeElement,
  serializeXml,
  textNode,
  type XmlElement,
} from "../../src/xml/index.ts";
import { loadDoc, lookup } from "./helpers.ts";

const now = (): number => 1700000000000;

function actions(rel: string): XmlElement[] {
  return loadDoc(rel)
    .tasks()
    .flatMap((t) => children(t, "Action"));
}

function regen(el: XmlElement, fillDefaults?: boolean): string {
  const j = actionToJson(el, lookup);
  const index = srIndex(el.attrs[0]?.value, "act") ?? 0;
  return serializeElement(
    actionToElement(j, lookup, fillDefaults === undefined ? { index } : { index, fillDefaults }),
  );
}

/** First action in `rel` whose original XML matches `re`. */
function pick(rel: string, re: RegExp): XmlElement {
  const found = actions(rel).find((a) => re.test(serializeElement(a)));
  if (found === undefined) throw new Error(`no action matching ${re} in ${rel}`);
  return found;
}

describe("golden: actionToElement reproduces real actions byte for byte", () => {
  const D = "dceluis-mcp-server.prj.xml";
  const R = "public/rho.prj.xml";
  const K = "public/ktools-alarm.prj.xml";
  const B = "public/taskerbchsdk-bch-monitor.prj.xml";
  // Tasker 5.9.2 (bch) predates Notify's spec args 12..15, so those run without default filling.
  const cases: Array<[string, string, RegExp, boolean?]> = [
    ["Str + empty App + Int", R, /<code>104<\/code>/],
    ["plugin with se and Bundle", R, /<se>false<\/se>[\s\S]*<Bundle/],
    ["If with single condition", R, /<code>37<\/code>\s*<ConditionList/],
    ["variable Int", D, /<Int sr="arg\d+">\s*<var>/],
    ["full App", D, /<App sr="arg\d+">\s*<appClass>/],
    ["Img with nme", B, /<Img sr="arg\d+" ve="2">\s*<nme>/, false],
    ["empty Img", K, /<Img sr="arg\d+" ve="2"\/>/],
    ["disabled action", K, /<on>false<\/on>/],
    ["label", D, /<label>NO_PADDING/],
    ["Or joined condition", B, /<bool0>Or<\/bool0>/, false],
    ["args plus ConditionList", D, /<Str sr="arg0"[\s\S]*<ConditionList/],
    ["Int without val (raw)", K, /<Int sr="arg\d+"\/>/],
    ["multi-line Str", D, /<code>129<\/code>\s*<label>/],
  ];
  it.each(cases)("%s", (_title, rel, re, fill) => {
    const el = pick(rel, re);
    expect(regen(el, fill)).toBe(serializeElement(el));
  });

  it.each([
    "dceluis-mcp-server.prj.xml",
    "public/rho.prj.xml",
    "public/ktools-alarm.prj.xml",
    "public/taskerbchsdk-bch-monitor.prj.xml",
  ])("every action in %s except collapsed blocks (fillDefaults off)", (rel) => {
    for (const el of actions(rel)) {
      const orig = serializeElement(el);
      if (orig.includes("<coll>")) continue;
      expect(regen(el, false)).toBe(orig);
    }
  });

  it.each(["public/rho.prj.xml", "public/ktools-alarm.prj.xml"])(
    "every whole task in %s, defaults on",
    (rel) => {
      for (const t of loadDoc(rel).tasks()) {
        const j = taskToJson(t, lookup);
        const out = taskFromJson(j, lookup, {
          id: TaskerDoc.idOf(t) ?? 0,
          base: t,
          edate: childText(t, "edate") ?? "",
          now,
        });
        expect(serializeElement(out)).toBe(serializeElement(t));
      }
    },
  );

  it("drops <coll> (editor UI state, not modelled)", () => {
    const el = pick("dceluis-mcp-server.prj.xml", /<coll>/);
    expect(regen(el)).not.toContain("<coll>");
  });
});

describe("taskToJson", () => {
  it("orders actions numerically, not lexicographically, and computes depth", () => {
    const xml = [
      '<Task sr="task9">',
      "<id>9</id><nme>T</nme>",
      ...[0, 1, 10, 11, 2, 3, 4, 5, 6, 7, 8, 9].map(
        (i) =>
          `<Action sr="act${i}" ve="7"><code>${[37, 547, 547, 38, 39, 43, 547, 40, 38, 547, 547, 547][i]}</code></Action>`,
      ),
      "</Task>",
    ].join("");
    const j = taskToJson(parseFragment(xml), lookup);
    expect(j.actions.map((a) => a.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(j.actions.map((a) => a.code)).toEqual([
      37, 547, 547, 38, 39, 43, 547, 40, 38, 547, 547, 547,
    ]);
    expect(j.actions.map((a) => a.depth)).toEqual([0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
  });

  it("reads name, priority, collision, comment, project", () => {
    const el = parseFragment(
      '<Task sr="task3"><id>3</id><nme>N</nme><pc>doc</pc><pri>7</pri><rty>2</rty></Task>',
    );
    expect(taskToJson(el, lookup, { project: "P" })).toEqual({
      id: 3,
      name: "N",
      project: "P",
      priority: 7,
      collision: 2,
      comment: "doc",
      actions: [],
    });
  });

  it("anonymous task has name '' and unknown codes keep raw XML with a warning", () => {
    const el = parseFragment(
      '<Task sr="task4"><id>4</id><Action sr="act0" ve="7"><code>5</code><Str sr="arg0" ve="3">x</Str></Action></Task>',
    );
    const j = taskToJson(el, lookup);
    expect(j.name).toBe("");
    expect(j.actions[0]?.raw).toContain("<code>5</code>");
    expect(j.actions[0]?.args).toEqual([{ id: 0, kind: "Str", value: "x" }]);
    expect(j.warnings).toEqual(["action 0: unknown action code 5; kept as raw XML"]);
  });

  it("plugin codes are named Plugin and not raw", () => {
    const el = parseFragment(
      '<Action sr="act0" ve="7"><code>107361459</code><se>false</se><Str sr="arg1" ve="3">pkg</Str></Action>',
    );
    const a = actionToJson(el, lookup);
    expect(a.name).toBe("Plugin");
    expect(a.continueOnError).toBe(true);
    expect(a.raw).toBeUndefined();
    expect(isPluginCode(107361459, lookup)).toBe(true);
    expect(isPluginCode(547, lookup)).toBe(false);
  });

  it("an unmodelled child or odd ConditionList keeps the action raw", () => {
    const odd = parseFragment('<Action sr="act0" ve="7"><code>547</code><weird>1</weird></Action>');
    expect(actionToJson(odd, lookup).raw).toContain("<weird>");
    const badCond = parseFragment(
      '<Action sr="act0" ve="7"><code>37</code><ConditionList sr="if"><x/></ConditionList></Action>',
    );
    expect(actionToJson(badCond, lookup).raw).toBeDefined();
    const badVe = parseFragment('<Action sr="act0" ve="6"><code>37</code></Action>');
    expect(actionToJson(badVe, lookup).raw).toBeDefined();
  });
});

describe("args", () => {
  it("Str, Int, var Int, and anything else Raw", () => {
    expect(argToJson(parseFragment('<Str sr="arg0" ve="3">a&amp;b</Str>'), 0)).toEqual({
      id: 0,
      kind: "Str",
      value: "a&b",
    });
    expect(argToJson(parseFragment('<Int sr="arg1" val="-4"/>'), 1)).toEqual({
      id: 1,
      kind: "Int",
      value: -4,
    });
    expect(argToJson(parseFragment('<Int sr="arg1" val="x"/>'), 1)).toEqual({
      id: 1,
      kind: "Int",
      value: "x",
    });
    expect(argToJson(parseFragment('<Int sr="arg2"><var>%v</var></Int>'), 2)).toEqual({
      id: 2,
      kind: "Int",
      value: "%v",
    });
    expect(argToJson(parseFragment('<Str sr="arg0" ve="2">a</Str>'), 0).kind).toBe("Raw");
    expect(argToJson(parseFragment('<Int sr="arg0"/>'), 0)).toEqual({
      id: 0,
      kind: "Raw",
      tag: "Int",
      raw: '<Int sr="arg0"/>',
    });
  });

  it("argToElement writes Tasker shapes", () => {
    const s = (a: Parameters<typeof argToElement>[0]): string => serializeElement(argToElement(a));
    expect(s({ id: 5, kind: "Str", value: "" })).toBe('<Str sr="arg5" ve="3"/>');
    expect(s({ id: 0, kind: "Str", value: "a<b" })).toBe('<Str sr="arg0" ve="3">a&lt;b</Str>');
    expect(s({ id: 1, kind: "Int", value: 1821 })).toBe('<Int sr="arg1" val="1821"/>');
    expect(s({ id: 1, kind: "Int", value: "12" })).toBe('<Int sr="arg1" val="12"/>');
    expect(s({ id: 1, kind: "Bool", value: true })).toBe('<Int sr="arg1" val="1"/>');
    expect(s({ id: 1, kind: "Bool", value: false })).toBe('<Int sr="arg1" val="0"/>');
    expect(s({ id: 0, kind: "Int", value: "%level" })).toBe(
      '<Int sr="arg0"><var>%level</var></Int>',
    );
    expect(s({ id: 3, kind: "Raw", tag: "App", raw: '<App sr="arg9"/>' })).toBe('<App sr="arg3"/>');
  });

  it("defaults follow the spec string", () => {
    const vs = lookup(547)!;
    expect(intDefault(vs.args.find((a) => a.id === 5)!)).toBe(3);
    expect(intDefault({ id: 0, name: "x", type: 0, isMandatory: true, spec: "2:9" })).toBe(2);
    expect(intDefault({ id: 0, name: "x", type: 0, isMandatory: true })).toBe(0);
    expect(boolDefault({ id: 0, name: "x", type: 3, isMandatory: true, spec: "true" })).toBe(true);
    expect(boolDefault({ id: 0, name: "x", type: 3, isMandatory: true })).toBe(false);
    const d = (type: number, spec?: string): string | undefined => {
      const el = defaultArgElement({
        id: 4,
        name: "x",
        type,
        isMandatory: true,
        ...(spec ? { spec } : {}),
      });
      return el === undefined ? undefined : serializeElement(el);
    };
    expect(d(1)).toBe('<Str sr="arg4" ve="3"/>');
    expect(d(6)).toBe('<Str sr="arg4" ve="3"/>');
    expect(d(0, "0:10:3")).toBe('<Int sr="arg4" val="3"/>');
    expect(d(3, "true")).toBe('<Int sr="arg4" val="1"/>');
    expect(d(2)).toBe('<App sr="arg4"/>');
    expect(d(4)).toBe('<Img sr="arg4" ve="2"/>');
    expect(d(5)).toBeUndefined();
    expect(d(42)).toBeUndefined();
  });
});

describe("actionToElement", () => {
  it("fills spec defaults, warns about Bundles, keeps first of duplicate ids", () => {
    const warnings: string[] = [];
    const a: ActionJson = {
      code: 547,
      args: [
        { id: 0, kind: "Str", value: "%x" },
        { id: 0, kind: "Str", value: "%dup" },
        { id: 1, kind: "Str", value: "1" },
      ],
    };
    const xml = serializeElement(actionToElement(a, lookup, { index: 3, warnings }));
    expect(xml).toBe(
      [
        '<Action sr="act3" ve="7">',
        "\t\t\t<code>547</code>",
        '\t\t\t<Str sr="arg0" ve="3">%x</Str>',
        '\t\t\t<Str sr="arg1" ve="3">1</Str>',
        '\t\t\t<Int sr="arg2" val="0"/>',
        '\t\t\t<Int sr="arg3" val="0"/>',
        '\t\t\t<Int sr="arg4" val="0"/>',
        '\t\t\t<Int sr="arg5" val="3"/>',
        '\t\t\t<Int sr="arg6" val="0"/>',
        "\t\t</Action>",
      ].join("\n"),
    );
    expect(warnings).toEqual(["action 3: duplicate arg0; first one kept"]);

    const w2: string[] = [];
    const http = serializeElement(
      actionToElement({ code: 339, args: [] }, lookup, { warnings: w2 }),
    );
    expect(http).not.toContain("<Bundle");
    expect(w2.some((w) => w.includes("Output Variables"))).toBe(true);
  });

  it("writes label, on, se in Tasker order and sorts args lexicographically", () => {
    const args = Array.from({ length: 12 }, (_, i) => ({ id: i, kind: "Str" as const, value: "" }));
    const xml = serializeElement(
      actionToElement(
        { code: 999, enabled: false, continueOnError: true, label: "", args },
        lookup,
      ),
    );
    expect(xml.indexOf("<label/>")).toBeLessThan(xml.indexOf("<on>false</on>"));
    expect(xml.indexOf("<on>")).toBeLessThan(xml.indexOf("<se>false</se>"));
    const order = [...xml.matchAll(/sr="(arg\d+)"/g)].map((m) => m[1]);
    expect(order.slice(0, 4)).toEqual(["arg0", "arg1", "arg10", "arg11"]);
  });

  it("writes conditions with joins, defaulting missing joins to And", () => {
    const cl = conditionListToElement({
      conditions: [
        { lhs: "%a", op: 0, rhs: "1" },
        { lhs: "%b", op: 12 },
        { lhs: "%c", op: 2, rhs: "x" },
      ],
      joins: ["or"],
    });
    const json = conditionListToJson(cl);
    expect(json).toEqual({
      conditions: [
        { lhs: "%a", op: 0, opName: "eq", rhs: "1" },
        { lhs: "%b", op: 12, opName: "set", rhs: "" },
        { lhs: "%c", op: 2, opName: "matches", rhs: "x" },
      ],
      joins: ["or", "and"],
    });
    expect(serializeElement(cl)).toContain("<rhs></rhs>");
    const noCond = actionToElement({ code: 37, args: [], condition: { conditions: [] } }, lookup);
    expect(serializeElement(noCond)).not.toContain("ConditionList");
  });

  it("uses raw verbatim, fixing only sr", () => {
    const raw = '<Action sr="act7" ve="7"><code>999</code></Action>';
    const out = actionToElement({ code: 999, args: [], raw, index: 2 }, lookup);
    expect(serializeElement(out)).toBe('<Action sr="act2" ve="7"><code>999</code></Action>');
  });
});

describe("taskFromJson", () => {
  const task: TaskJson = {
    name: "New",
    priority: 100,
    collision: 1,
    comment: "what it does",
    actions: [{ code: 548, args: [{ id: 0, kind: "Str", value: "hi" }] }],
  };

  it("builds a Task in export layout", () => {
    const el = taskFromJson(task, lookup, { id: 12, cdate: 5, now });
    expect(serializeElement(el)).toBe(
      [
        '<Task sr="task12">',
        "\t\t<cdate>5</cdate>",
        "\t\t<edate>1700000000000</edate>",
        "\t\t<id>12</id>",
        "\t\t<nme>New</nme>",
        "\t\t<pc>what it does</pc>",
        "\t\t<pri>100</pri>",
        "\t\t<rty>1</rty>",
        '\t\t<Action sr="act0" ve="7">',
        "\t\t\t<code>548</code>",
        '\t\t\t<Str sr="arg0" ve="3">hi</Str>',
        '\t\t\t<Int sr="arg1" val="0"/>',
        '\t\t\t<Str sr="arg10" ve="3"/>',
        '\t\t\t<Int sr="arg11" val="1"/>',
        '\t\t\t<Int sr="arg12" val="0"/>',
        '\t\t\t<Str sr="arg13" ve="3"/>',
        '\t\t\t<Int sr="arg14" val="0"/>',
        '\t\t\t<Str sr="arg15" ve="3"/>',
        '\t\t\t<Int sr="arg2" val="0"/>',
        '\t\t\t<Str sr="arg3" ve="3"/>',
        '\t\t\t<Str sr="arg4" ve="3"/>',
        '\t\t\t<Str sr="arg5" ve="3"/>',
        '\t\t\t<Str sr="arg6" ve="3"/>',
        '\t\t\t<Str sr="arg7" ve="3"/>',
        '\t\t\t<Str sr="arg8" ve="3"/>',
        '\t\t\t<Int sr="arg9" val="1"/>',
        "\t\t</Action>",
        "\t</Task>",
      ].join("\n"),
    );
  });

  it("carries over task variables and icon from base, keeping its cdate", () => {
    const base = loadDoc("public/ktools-alarm.prj.xml")
      .tasks()
      .find((t) => children(t, "Img").length > 0)!;
    const el = taskFromJson({ name: "X", actions: [] }, lookup, { id: 1, base, now });
    expect(childText(el, "cdate")).toBe(childText(base, "cdate"));
    expect(children(el, "Img")).toHaveLength(1);
    expect(childText(el, "stayawake")).toBe("true");
    const dv = loadDoc("dceluis-mcp-server.prj.xml")
      .tasks()
      .find((t) => children(t, "ProfileVariable").length > 0)!;
    const el2 = taskFromJson(taskToJson(dv, lookup), lookup, { id: 1, base: dv, now });
    expect(serializeElement(el2)).toContain('<ProfileVariable sr="pv0">');
    expect(children(el2).at(-1)?.name).toBe("ProfileVariable");
  });

  it("anonymous task omits nme; defaults to now for cdate", () => {
    const el = taskFromJson({ name: "", actions: [] }, lookup, { id: 2, now });
    expect(childText(el, "nme")).toBeUndefined();
    expect(childText(el, "cdate")).toBe("1700000000000");
  });
});

describe("profiles and projects", () => {
  const doc = loadDoc("public/rho.prj.xml");

  it("profileToJson reads contexts, entry task, enabled", () => {
    const p = profileToJson(
      doc.profileByName("Launch App")!,
      {
        event: (c) => (c === 599 ? "Intent Received" : undefined),
        taskName: (id) => doc.taskName(id),
      },
      { project: "Rho" },
    );
    expect(p).toMatchObject({
      id: 160,
      name: "Launch App",
      project: "Rho",
      enabled: true,
      entryTask: "RhoLaunchApp",
    });
    expect(p.contexts[0]).toMatchObject({ kind: "Event", code: 599, name: "Intent Received" });
    expect(p.contexts[0]?.raw).toContain("rho.tasker.launch_app");
  });

  it("disabled profile is <limit>true</limit>; states, exit tasks, ids", () => {
    const el = parseFragment(
      '<Profile sr="prof1" ve="2"><id>1</id><limit>true</limit><mid0>5</mid0><mid1>6</mid1><State sr="con0" ve="2"><code>120</code></State><Time sr="con1"><fh>7</fh></Time></Profile>',
    );
    const p = profileToJson(el, { state: () => "Display State" });
    expect(p).toMatchObject({ id: 1, name: "", enabled: false, entryTask: 5, exitTask: 6 });
    expect(p.contexts.map((c) => [c.kind, c.code, c.name])).toEqual([
      ["State", 120, "Display State"],
      ["Time", undefined, undefined],
    ]);
    expect(profileToJson(el).contexts[0]?.name).toBeUndefined();
  });

  it("projectToJson lists ids or names", () => {
    const proj = doc.projectByName("Rho")!;
    const plain = projectToJson(proj);
    expect(plain.name).toBe("Rho");
    expect(plain.tasks[0]).toBe("161");
    const named = projectToJson(proj, {
      taskName: (id) => doc.taskName(id),
      profileName: (id) => doc.profileName(id),
    });
    expect(named.tasks).toContain("RhoOpenUrl");
    expect(named.profiles).toContain("Launch App");
    expect(named.profiles).toContain("152");
    const withScenes = projectToJson(
      parseFragment("<Project><id>u-1</id><name>S</name><scenes>A, B</scenes></Project>"),
    );
    expect(withScenes).toEqual({
      id: "u-1",
      name: "S",
      tasks: [],
      profiles: [],
      scenes: ["A", "B"],
    });
  });
});

describe("helpers", () => {
  it("srIndex / id lists", () => {
    expect(srIndex("act12", "act")).toBe(12);
    expect(srIndex("actx", "act")).toBeUndefined();
    expect(srIndex(undefined, "act")).toBeUndefined();
    expect(srIndex("arg1", "act")).toBeUndefined();
    expect(parseIdList(" 1,2,,x,3 ")).toEqual([1, 2, 3]);
    expect(parseIdList(undefined)).toEqual([]);
    expect(parseNameList("a,,b ")).toEqual(["a", "b"]);
    expect(parseNameList(undefined)).toEqual([]);
  });

  it("sortChildren puts plain tags first alphabetically, then sr lexicographically", () => {
    const el = createElement("Task", {}, [
      createElement("Action", { sr: "act2" }),
      createElement("pri"),
      createElement("Img", { sr: "icn" }),
      createElement("Action", { sr: "act10" }),
      createElement("cdate"),
    ]);
    sortChildren(el);
    expect(children(el).map((c) => c.attrs[0]?.value ?? c.name)).toEqual([
      "cdate",
      "pri",
      "act10",
      "act2",
      "icn",
    ]);
  });

  it("formatElement leaves mixed content alone", () => {
    const el = createElement("a", {}, [textNode("x"), createElement("b")]);
    formatElement(el, 0);
    expect(serializeElement(el)).toBe("<a>x<b/></a>");
  });

  it("wrapForImport writes a TaskerData file in Tasker root order", () => {
    const t = taskFromJson({ name: "T", actions: [] }, lookup, { id: 1, cdate: 1, edate: 2 });
    const prj = parseFragment('<Project sr="proj0" ve="2"><name>P</name></Project>');
    const other = parseFragment("<Zed/>");
    const xml = wrapForImport([other, t, prj], 'v"1');
    expect(xml.startsWith('<TaskerData sr="" dvi="1" tv="v&quot;1">\n\t<Project')).toBe(true);
    expect(xml.indexOf("<Project")).toBeLessThan(xml.indexOf("<Task "));
    expect(xml.indexOf("<Task ")).toBeLessThan(xml.indexOf("<Zed"));
    expect(xml.endsWith("</TaskerData>\n")).toBe(true);
    const back = parseXml(xml);
    expect(serializeXml(back)).toBe(xml);
    expect(taskToJson(children(back.root, "Task")[0]!, lookup).name).toBe("T");
  });
});
