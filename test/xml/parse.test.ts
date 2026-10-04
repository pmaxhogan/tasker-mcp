import { describe, expect, it } from "vitest";
import type { XmlElement, XmlText } from "../../src/xml/index.ts";
import {
  XmlParseError,
  child,
  decodeEntities,
  elementText,
  parseXml,
  serializeXml,
} from "../../src/xml/index.ts";

function rt(s: string): void {
  expect(serializeXml(parseXml(s))).toBe(s);
}

function parseError(s: string): XmlParseError {
  try {
    parseXml(s);
  } catch (e) {
    expect(e).toBeInstanceOf(XmlParseError);
    return e as XmlParseError;
  }
  throw new Error("expected a parse error");
}

describe("round trip edge cases", () => {
  it.each([
    ["minimal", "<a/>"],
    ["self-closing with space", "<a />"],
    ["empty pair", "<a></a>"],
    ["xml declaration", '<?xml version="1.0" encoding="UTF-8"?>\n<a/>\n'],
    ["single-quoted declaration", "<?xml version='1.0'?><a/>"],
    ["comments everywhere", "<!--x--><a><!-- y --></a><!--z-->"],
    ["processing instructions", "<?p1 d?><a><?p2?></a><?p3 x?>"],
    ["doctype with subset", '<!DOCTYPE a [<!ENTITY e "x>y">]><a>&e;</a>'],
    ["doctype simple", '<!DOCTYPE a SYSTEM "a.dtd"><a/>'],
    ["cdata", "<a><![CDATA[<b>&amp; ]] ]]></a>"],
    ["whitespace-only text", "<a>\n\t \n<b/>\n</a>"],
    ["attribute order", '<a z="1" a="2" m="3"/>'],
    ["single quotes", "<a b='x\"y'/>"],
    ["mixed quotes", "<a b='1' c=\"2\"/>"],
    ["attribute spacing", '<a\n\tb = "1"\tc="2"   />'],
    ["close tag whitespace", "<a><b></b \n></a >"],
    ["apos spellings", "<a>&apos; &#39; &#x27; '</a>"],
    ["entities in attributes", '<a b="&lt;&amp;&#10;&quot;"/>'],
    ["CRLF", '<?xml version="1.0"?>\r\n<a>\r\n  <b>x\r\ny</b>\r\n</a>\r\n'],
    ["lone CR", "<a>x\ry</a>"],
    ["BOM", "﻿<a/>"],
    ["BOM and declaration", '﻿<?xml version="1.0"?>\n<a/>\n'],
    ["trailing whitespace and comment", "<a/>\n\n<!-- end -->\n"],
    ["no trailing newline", "<a>b</a>"],
    ["unicode and emoji", '<a t="日">café \u{1F600} &#x1F600;</a>'],
    ["dotted and dashed names", "<x.y-z><x.y-z-type>s</x.y-z-type></x.y-z>"],
    ["unknown entity kept", "<a>&nbsp;</a>"],
    ["gt literal in text", "<a>a > b</a>"],
    ["deep nesting", `${"<d>".repeat(500)}x${"</d>".repeat(500)}`],
  ])("%s", (_name, s) => rt(s));
});

describe("decoded values", () => {
  it("decodes text and attribute entities", () => {
    const doc = parseXml('<a b="&lt;&amp;&#10;&quot;&apos;">a &lt; b &#x41;&#66;</a>');
    expect(doc.root.attrs[0]).toMatchObject({
      name: "b",
      value: "<&\n\"'",
      raw: "&lt;&amp;&#10;&quot;&apos;",
      quote: '"',
      pre: " ",
      eq: "=",
    });
    expect(elementText(doc.root)).toBe("a < b AB");
  });

  it("normalizes CRLF to LF in decoded text but not in raw", () => {
    const doc = parseXml("<a>x\r\ny\rz&#13;</a>");
    const t = doc.root.children[0] as XmlText;
    expect(t.text).toBe("x\ny\nz\r");
    expect(t.raw).toBe("x\r\ny\rz&#13;");
  });

  it("parses Tasker-shaped actions", () => {
    const doc = parseXml(
      '<Action sr="act0" ve="7"><code>130</code><Str sr="arg0" ve="3">Name</Str>' +
        '<Int sr="arg1" val="100"/><Int sr="arg2"><var>%foo</var></Int></Action>',
    );
    expect(doc.root.name).toBe("Action");
    expect(elementText(child(doc.root, "code")!)).toBe("130");
    const ints = doc.root.children.filter((c): c is XmlElement => c.type === "element");
    expect(ints.map((e) => e.name)).toEqual(["code", "Str", "Int", "Int"]);
    expect(ints[2]!.selfClosing).toBe(true);
    expect(ints[3]!.selfClosing).toBe(false);
  });

  it("keeps CDATA text verbatim", () => {
    const doc = parseXml("<a><![CDATA[&lt;x]]></a>");
    expect(doc.root.children[0]).toEqual({ type: "cdata", text: "&lt;x" });
  });

  it("records prolog and epilog nodes", () => {
    const doc = parseXml('<?xml version="1.0"?>\n<!--c-->\n<a/>\n<!--d-->');
    expect(doc.prolog.map((n) => n.type)).toEqual(["pi", "text", "comment", "text"]);
    expect(doc.epilog.map((n) => n.type)).toEqual(["text", "comment"]);
  });
});

describe("decodeEntities", () => {
  it("leaves bad references literal without onError", () => {
    expect(decodeEntities("a & b &#0; &#xD800; &#1114112; &bogus;")).toBe(
      "a & b &#0; &#xD800; &#1114112; &bogus;",
    );
  });
  it("passes plain text through", () => {
    expect(decodeEntities("plain")).toBe("plain");
  });
});

describe("errors", () => {
  it.each([
    ["empty input", "", "no root element", 1, 1],
    ["only whitespace", "  \n ", "no root element", 2, 2],
    ["unclosed root", "<a>\n  <b/>", "unclosed tag <a>", 1, 1],
    ["unclosed nested", "<a>\n  <b>x", "unclosed tag <b>", 2, 3],
    ["mismatched close", "<a>\n  <b></c>\n</a>", "mismatched close tag </c>, expected </b>", 2, 6],
    ["unclosed start tag", '<a b="1"', "unclosed start tag <a>", 1, 9],
    ["missing equals", "<a b/>", "expected '=' after attribute 'b'", 1, 5],
    ["unquoted value", "<a b=1/>", "must be quoted", 1, 6],
    ["unterminated value", '<a b="1/>', "unterminated value for attribute 'b'", 1, 6],
    ["lt in attribute", '<a b="<"/>', "'<' is not allowed in an attribute value", 1, 7],
    ["duplicate attribute", '<a b="1" b="2"/>', "duplicate attribute 'b'", 1, 10],
    [
      "no space between attributes",
      '<a b="1"c="2"/>',
      "expected whitespace before attribute",
      1,
      9,
    ],
    ["bad char in tag", '<a "x"/>', "unexpected character '\"'", 1, 4],
    ["bad element name", "<1a/>", "expected element name after '<'", 1, 2],
    ["bad close name", "<a></ >", "expected element name after '</'", 1, 6],
    ["close tag junk", "<a></a x>", "expected '>' to end close tag </a>", 1, 8],
    ["bare ampersand", "<a>\n x & y</a>", "'&' must start an entity", 2, 4],
    ["bare ampersand in attr", '<a b="&"/>', "'&' must start an entity", 1, 7],
    ["ampersand after CRLF", "<a>\r\nx\r\n&</a>", "'&' must start an entity", 3, 1],
    ["bad char ref", "<a>&#0;</a>", "invalid character reference '&#0;'", 1, 4],
    ["unterminated comment", "<a><!-- x</a>", "unterminated comment", 1, 4],
    ["unterminated cdata", "<a><![CDATA[x</a>", "unterminated CDATA section", 1, 4],
    ["unterminated pi", "<?xml version", "unterminated processing instruction", 1, 1],
    ["unterminated doctype", "<!DOCTYPE a [", "unterminated DOCTYPE", 1, 1],
    ["markup decl in element", "<a><!ELEMENT x></a>", "unexpected markup declaration", 1, 4],
    ["text before root", "hi<a/>", "text is not allowed outside the root element", 1, 1],
    ["text after root", "<a/>\n  x", "text is not allowed outside the root element", 2, 3],
    ["two roots", "<a/><b/>", "only one root element is allowed", 1, 5],
    ["stray close at top", "</a>", "expected an element", 1, 1],
    ["doctype after root", "<a/><!DOCTYPE a>", "DOCTYPE is only allowed before the root", 1, 5],
  ])("%s", (_name, src, msg, line, column) => {
    const e = parseError(src);
    expect(e.message).toContain(msg);
    expect(e.message).toContain(`at ${line}:${column}:`);
    expect(e.line).toBe(line);
    expect(e.column).toBe(column);
    expect(e.name).toBe("XmlParseError");
  });

  it("reports where a mismatched element was opened", () => {
    expect(parseError("<a>\n<b>\n</a>").message).toContain("(opened at 2:1)");
  });

  it("accepts a BOM before the root but not text", () => {
    expect(() => parseXml("﻿<a/>")).not.toThrow();
    expect(parseError("﻿x<a/>").column).toBe(2);
  });
});
