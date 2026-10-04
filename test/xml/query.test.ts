import { describe, expect, it } from "vitest";
import {
  XmlParseError,
  attr,
  child,
  childText,
  children,
  cloneNode,
  createElement,
  elementText,
  insertChildElement,
  parseFragment,
  parseXml,
  removeAttr,
  removeChild,
  serializeElement,
  serializeXml,
  setAttr,
  setChildText,
  textNode,
} from "../../src/xml/index.ts";

const TASK = [
  '<TaskerData sr="" dvi="1" tv="6.7.6-beta">',
  '\t<Task sr="task1">',
  "\t\t<id>1</id>",
  "\t\t<nme>Old &amp; Name</nme>",
  '\t\t<Action sr="act0" ve="7">',
  "\t\t\t<code>130</code>",
  '\t\t\t<Str sr="arg0" ve="3">Name</Str>',
  '\t\t\t<Int sr="arg1" val="100"/>',
  '\t\t\t<Int sr="arg2">',
  "\t\t\t\t<var>%foo</var>",
  "\t\t\t</Int>",
  "\t\t</Action>",
  "\t</Task>",
  "</TaskerData>",
  "",
].join("\n");

function task() {
  const doc = parseXml(TASK);
  return { doc, task: child(doc.root, "Task")! };
}

describe("read helpers", () => {
  it("children and child", () => {
    const { doc, task: t } = task();
    expect(children(doc.root).map((e) => e.name)).toEqual(["Task"]);
    expect(children(t).map((e) => e.name)).toEqual(["id", "nme", "Action"]);
    expect(children(child(t, "Action")!, "Int")).toHaveLength(2);
    expect(child(t, "missing")).toBeUndefined();
  });

  it("childText and elementText decode", () => {
    const { task: t } = task();
    expect(childText(t, "nme")).toBe("Old & Name");
    expect(childText(t, "missing")).toBeUndefined();
    const action = child(t, "Action")!;
    expect(elementText(children(action, "Int")[1]!).trim()).toBe("%foo");
    const el = parseFragment("<a>x<!--c--><![CDATA[<y>]]><?p?><b>z</b></a>");
    expect(elementText(el)).toBe("x<y>z");
  });

  it("attr", () => {
    const { doc } = task();
    expect(attr(doc.root, "tv")).toBe("6.7.6-beta");
    expect(attr(doc.root, "sr")).toBe("");
    expect(attr(doc.root, "nope")).toBeUndefined();
  });
});

describe("write helpers", () => {
  it("setChildText updates an existing child, leaving the rest byte-identical", () => {
    const { doc, task: t } = task();
    setChildText(t, "nme", "New <Name>");
    expect(serializeXml(doc)).toBe(TASK.replace("Old &amp; Name", "New &lt;Name&gt;"));
  });

  it("setChildText creates a missing child with sibling indentation", () => {
    const { doc, task: t } = task();
    const pri = setChildText(t, "pri", "100");
    expect(pri.name).toBe("pri");
    expect(serializeXml(doc)).toBe(
      TASK.replace("\t\t</Action>\n", "\t\t</Action>\n\t\t<pri>100</pri>\n"),
    );
  });

  it("setChildText with empty text empties the child", () => {
    const { doc, task: t } = task();
    setChildText(t, "nme", "");
    expect(serializeXml(doc)).toContain("\t\t<nme></nme>\n");
    setChildText(t, "fresh", "");
    expect(serializeXml(doc)).toContain("\t\t<fresh/>\n\t</Task>");
  });

  it("setChildText into an element with no element children", () => {
    const el = parseFragment("<a>\n</a>");
    setChildText(el, "b", "x");
    expect(serializeElement(el)).toBe("<a><b>x</b>\n</a>");
    const bare = createElement("a");
    setChildText(bare, "b", "y");
    expect(serializeElement(bare)).toBe("<a><b>y</b></a>");
  });

  it("insertChildElement without indentation before the last element", () => {
    const el = parseFragment("<a>t<b/></a>");
    insertChildElement(el, createElement("c"));
    expect(serializeElement(el)).toBe("<a>t<b/><c/></a>");
  });

  it("setAttr edits in place, appends, and skips no-op writes", () => {
    const el = parseFragment("<a x='&#49;' y=\"2\"/>");
    setAttr(el, "x", "1");
    expect(serializeElement(el)).toBe("<a x='&#49;' y=\"2\"/>");
    setAttr(el, "x", "<3");
    setAttr(el, "z", "new");
    expect(serializeElement(el)).toBe('<a x=\'&lt;3\' y="2" z="new"/>');
  });

  it("removeAttr", () => {
    const el = parseFragment('<a x="1" y="2"/>');
    expect(removeAttr(el, "x")).toBe(true);
    expect(removeAttr(el, "x")).toBe(false);
    expect(serializeElement(el)).toBe('<a y="2"/>');
  });

  it("removeChild drops the node and its indentation", () => {
    const { doc, task: t } = task();
    expect(removeChild(t, child(t, "nme")!)).toBe(true);
    expect(serializeXml(doc)).toBe(TASK.replace("\t\t<nme>Old &amp; Name</nme>\n", ""));
    expect(removeChild(t, createElement("ghost"))).toBe(false);
    const el = parseFragment("<a><b/>x</a>");
    removeChild(el, el.children[0]!);
    expect(serializeElement(el)).toBe("<a>x</a>");
  });
});

describe("construction and cloning", () => {
  it("createElement and textNode", () => {
    const el = createElement("Str", { sr: "arg0", ve: "3" }, [textNode("a & b")]);
    expect(serializeElement(el)).toBe('<Str sr="arg0" ve="3">a &amp; b</Str>');
    expect(serializeElement(createElement("x"))).toBe("<x/>");
  });

  it("cloneNode is deep and serializes identically", () => {
    const { task: t } = task();
    const action = child(t, "Action")!;
    const copy = cloneNode(action);
    expect(copy).not.toBe(action);
    expect(serializeElement(copy)).toBe(serializeElement(action));
    setChildText(copy, "code", "548");
    expect(childText(action, "code")).toBe("130");
  });
});

describe("fragments", () => {
  it("serializeElement returns the exact source subtree", () => {
    const { task: t } = task();
    const out = serializeElement(child(t, "Action")!);
    expect(out.startsWith('<Action sr="act0" ve="7">\n\t\t\t<code>130</code>')).toBe(true);
    expect(out.endsWith("\t\t\t</Int>\n\t\t</Action>")).toBe(true);
    expect(TASK).toContain(out);
  });

  it("parseFragment round-trips through serializeElement", () => {
    const xml =
      '<Bundle sr="arg0">\n\t<Vals sr="val">\n' +
      "\t\t<com.twofortyfouram.locale.intent.extra.BLURB>t &lt;x&gt;</com.twofortyfouram.locale.intent.extra.BLURB>\n" +
      "\t\t<com.twofortyfouram.locale.intent.extra.BLURB-type>java.lang.String</com.twofortyfouram.locale.intent.extra.BLURB-type>\n" +
      "\t</Vals>\n</Bundle>";
    const el = parseFragment(xml);
    expect(serializeElement(el)).toBe(xml);
    const vals = child(el, "Vals")!;
    expect(childText(vals, "com.twofortyfouram.locale.intent.extra.BLURB")).toBe("t <x>");
    expect(childText(vals, "com.twofortyfouram.locale.intent.extra.BLURB-type")).toBe(
      "java.lang.String",
    );
  });

  it("parseFragment tolerates surrounding whitespace and rejects two elements", () => {
    expect(parseFragment("\n  <a/>\n").name).toBe("a");
    expect(() => parseFragment("<a/><b/>")).toThrow(XmlParseError);
  });
});
