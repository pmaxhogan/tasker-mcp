import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeEntities, htmlToMarkdown } from "../../src/docs/html2md.ts";
import { asciiDashes, tokenize } from "../../src/docs/tokenize.ts";

const BASE = "https://tasker.joaoapps.com/userguide/en/guide.html";
const fixture = readFileSync(new URL("../fixtures/docs/guide.html", import.meta.url), "utf8");

describe("htmlToMarkdown", () => {
  const r = htmlToMarkdown(fixture, {
    baseUrl: BASE,
    rewriteLink: (u) => (u.includes("tasker.joaoapps.com") ? "slug:" + u.split("/").pop() : u),
  });

  it("takes the title from <title> and strips the Tasker prefix", () => {
    expect(r.title).toBe("Sample Guide");
  });

  it("drops scripts, styles, comments, nav and images", () => {
    expect(r.markdown).not.toMatch(/not content|hidden|nav link|color:red|icon\.png/);
  });

  it("converts inline emphasis, code and entities with ASCII dashes only", () => {
    expect(r.markdown).toContain(
      "**bold**, *italic* and `code` & an entity here - dash - again -.",
    );
    expect(r.markdown).not.toMatch(/[\u2010-\u2015\u2212]/);
  });

  it("rewrites and collects links, skipping anchors and empty labels", () => {
    expect(r.markdown).toContain("[another page](slug:other.html#frag)");
    expect(r.markdown).toContain("[outside](https://example.com/x(1%29)");
    expect(r.markdown).not.toContain("empty.html");
    expect(r.links).toContain("https://tasker.joaoapps.com/userguide/en/help/ah_sample.html");
    expect(r.links).toContain("https://tasker.joaoapps.com/userguide/en/empty.html");
    expect(r.links.some((l) => l.includes("nav.html"))).toBe(false);
  });

  it("renders headings (links inside headings are text only)", () => {
    expect(r.markdown).toContain("## Sample Guide");
    expect(r.markdown).toContain("#### List heading link");
  });

  it("handles unclosed list items, nesting and ordered lists", () => {
    expect(r.markdown).toContain("- one\n- two with\n  break\n  - nested a\n  - nested b\n- para");
    expect(r.markdown).toContain("1. first\n2. second");
  });

  it("renders tables with a header separator and pipe escaping", () => {
    expect(r.markdown).toContain(
      "| Name | Value |\n| --- | --- |\n| a\\|b | 1 2 |\n| only one |  |",
    );
  });

  it("keeps preformatted blocks verbatim in a fence", () => {
    expect(r.markdown).toContain("```\nline 1 <tag>\n  line 2\nline 3\n```");
  });

  it("tolerates unknown entities and stray angle brackets", () => {
    expect(r.markdown).toContain("a &unknown; entity and 5 < 6 and and");
  });
});

describe("htmlToMarkdown edge cases", () => {
  const conv = (html: string, base = BASE) => htmlToMarkdown(html, { baseUrl: base });

  it("falls back to the first heading, then empty, for the title", () => {
    expect(conv("<body><H3>Import Data</H3><P>x</P></body>").title).toBe("Import Data");
    expect(conv("<p>no title</p>").title).toBe("");
  });

  it("reads a <title> that is outside <head>", () => {
    expect(conv("<title>Tasker: Loose</title><p>x</p>").title).toBe("Loose");
  });

  it("copes with unterminated constructs", () => {
    expect(conv("<p>a<!-- never closed").markdown).toBe("a");
    expect(conv("<p>a<?php b").markdown).toBe("a");
    expect(conv("<p>x</p><script>never closed").markdown).toBe("x");
    expect(conv("<head><title>T</title>").title).toBe("");
    expect(conv("<title>unterminated").title).toBe("");
    expect(conv("<pre>open pre\n").markdown).toBe("```\nopen pre\n```");
    expect(conv("1 <2 <3 <b>b</b>").markdown).toContain("1 <2 <3 **b**");
  });

  it("handles a tag split by quoted attributes containing >", () => {
    const r = conv('<p><a href="x.html" title="a > b">lnk</a> and <a href=y.html>bare</a></p>');
    expect(r.markdown).toBe(
      "[lnk](https://tasker.joaoapps.com/userguide/en/x.html) and [bare](https://tasker.joaoapps.com/userguide/en/y.html)",
    );
  });

  it("ignores javascript links, bad URLs and fragment-only links", () => {
    const r = conv('<a href="javascript:x()">j</a><a href="#a">f</a><a href="http://[bad">b</a>');
    expect(r.links).toEqual([]);
    expect(r.markdown).toBe("jfb");
  });

  it("keeps heading-only and table-only content, headings in tables and br in headings", () => {
    expect(conv("<h1>Top<br>Line</h1>").markdown).toBe("## Top Line");
    expect(conv("<h2></h2>").markdown).toBe("");
    expect(conv("<table><tr><td>a<td>b</table>").markdown).toBe("| a | b |\n| --- | --- |");
    expect(conv("<tr><td>x</td></tr>").markdown).toBe("| x |\n| --- |");
    expect(conv("<td>stray</td>").markdown).toBe("stray");
    expect(conv("<table><tr></tr></table>").markdown).toBe("");
    expect(conv("<b>x</b><i>y</i><tt>z</tt>").markdown).toBe("**x***y*`z`");
    expect(conv("<h2><b>b</b><i>i</i><code>c</code></h2>").markdown).toBe("## bic");
  });

  it("treats li outside a list as a bullet and ul nesting restores indentation", () => {
    expect(conv("<li>solo").markdown).toBe("- solo");
    const r = conv("<ul><li>a<ul><li>b</ul>tail</ul>after");
    expect(r.markdown).toBe("- a\n  - b\n  tail\n\nafter");
  });

  it("drops a self-closing pre block that is empty", () => {
    expect(conv("<pre>\n</pre>x").markdown).toBe("x");
  });

  it("does not leak list indent into following text and collapses blank lines", () => {
    expect(conv("<p>a<br><br><br><br>b</p>").markdown).toBe("a\n\nb");
  });
});

describe("decodeEntities / tokenize / asciiDashes", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("&lt;&#65;&#x42;&AMP;&copy;&nope;&#99999999;")).toBe("<AB&(c)&nope;");
  });

  it("tokenizes with stopwords, stemming and underscore compounds", () => {
    expect(tokenize("The %http_request_id of Actions, is a Class!")).toEqual([
      "http_request_id",
      "http",
      "request",
      "id",
      "action",
      "class",
    ]);
    expect(tokenize("_x_ __ a 1 22")).toEqual(["22"]);
    expect(tokenize("")).toEqual([]);
  });

  it("maps dash-like characters to ASCII", () => {
    expect(asciiDashes("a\u2010b\u2011c\u2012d\u2013e\u2014f\u2015g\u2212h")).toBe(
      "a-b-c-d-e-f-g-h",
    );
  });
});
