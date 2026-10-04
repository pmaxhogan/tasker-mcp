import { describe, expect, it } from "vitest";
import type { XmlDocument, XmlText } from "../../src/xml/index.ts";
import {
  createElement,
  escapeAttr,
  escapeText,
  parseXml,
  serializeNode,
  serializeXml,
  textNode,
} from "../../src/xml/index.ts";

describe("escaping", () => {
  it("escapes text", () => {
    expect(escapeText(`a & b < c > d "e" 'f'`)).toBe(`a &amp; b &lt; c &gt; d "e" 'f'`);
  });
  it("escapes attributes for the quote in use", () => {
    expect(escapeAttr(`<&>"'`)).toBe(`&lt;&amp;&gt;&quot;'`);
    expect(escapeAttr(`<&>"'`, "'")).toBe(`&lt;&amp;&gt;"&apos;`);
  });
});

describe("programmatic nodes", () => {
  it("serializes a built document with standard escaping", () => {
    const doc: XmlDocument = {
      prolog: [],
      root: createElement("Str", { sr: "arg0", note: `a"b<c&d` }, [textNode("x < y & z > w")]),
      epilog: [],
    };
    expect(serializeXml(doc)).toBe(
      '<Str sr="arg0" note="a&quot;b&lt;c&amp;d">x &lt; y &amp; z &gt; w</Str>',
    );
  });

  it("writes empty elements self-closing by default and as a pair when asked", () => {
    expect(serializeNode(createElement("Int", { sr: "arg1", val: "1" }))).toBe(
      '<Int sr="arg1" val="1"/>',
    );
    const pair = createElement("x");
    pair.selfClosing = false;
    expect(serializeNode(pair)).toBe("<x></x>");
  });

  it("ignores selfClosing when there are children", () => {
    expect(serializeNode(createElement("a", {}, [textNode("t")]))).toBe("<a>t</a>");
  });

  it("splits CDATA that contains the terminator", () => {
    expect(serializeNode({ type: "cdata", text: "a]]>b" })).toBe("<![CDATA[a]]]]><![CDATA[>b]]>");
  });

  it("writes verbatim nodes as stored", () => {
    expect(serializeNode({ type: "comment", raw: "<!-- c -->" })).toBe("<!-- c -->");
    expect(serializeNode({ type: "pi", raw: "<?p?>" })).toBe("<?p?>");
    expect(serializeNode({ type: "doctype", raw: "<!DOCTYPE a>" })).toBe("<!DOCTYPE a>");
  });

  it("honors a single-quote style on a new attribute", () => {
    const el = createElement("a");
    el.attrs.push({ name: "b", value: "it's", quote: "'" });
    expect(serializeNode(el)).toBe("<a b='it&apos;s'/>");
  });
});

describe("edited parsed nodes", () => {
  it("keeps raw spelling while the decoded value is unchanged", () => {
    const src = "<a b='&#39;x'>&apos;y&#10;</a>";
    expect(serializeXml(parseXml(src))).toBe(src);
  });

  it("re-escapes only an edited text node", () => {
    const doc = parseXml("<a><b>&#65;</b><c>&#66;</c></a>");
    const b = doc.root.children[0];
    if (b?.type !== "element") throw new Error("expected element");
    (b.children[0] as XmlText).text = "<new>";
    expect(serializeXml(doc)).toBe("<a><b>&lt;new&gt;</b><c>&#66;</c></a>");
  });

  it("re-escapes an edited attribute but keeps its spacing and quote", () => {
    const doc = parseXml("<a  b = 'old' c=\"&#65;\"/>");
    doc.root.attrs[0]!.value = "it's";
    expect(serializeXml(doc)).toBe("<a  b = 'it&apos;s' c=\"&#65;\"/>");
  });

  it("re-escapes when the quote style changed under a raw value", () => {
    const doc = parseXml(`<a b='say "hi"'/>`);
    doc.root.attrs[0]!.quote = '"';
    expect(serializeXml(doc)).toBe('<a b="say &quot;hi&quot;"/>');
  });

  it("keeps CRLF raw text when unchanged", () => {
    const src = "<a>x\r\ny</a>";
    const doc = parseXml(src);
    expect((doc.root.children[0] as XmlText).text).toBe("x\ny");
    expect(serializeXml(doc)).toBe(src);
  });
});
