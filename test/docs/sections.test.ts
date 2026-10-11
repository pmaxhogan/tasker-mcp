import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildOutputs, crawl } from "../../src/docs/crawl.ts";
import { htmlToMarkdown } from "../../src/docs/html2md.ts";
import {
  MAX_SECTIONS,
  buildSectionedManual,
  remapAnchors,
  sectionFileUrl,
  sectionsDirOf,
} from "../../src/docs/sections.ts";
import { DocsStore } from "../../src/docs/store.ts";

const ROOT = "https://tasker.joaoapps.com/userguide/en/";
const shell = readFileSync(new URL("../fixtures/docs/sectioned.html", import.meta.url), "utf8");

const PROP_TABLE = `<table class="prop-table">
    <tr><th>Property</th><th>Default</th><th>Description</th></tr>
    <tr><td><code>textSize</code></td><td><code>14</code></td><td>Font size in sp</td></tr>
    <tr><td><code>mode</code></td><td><code>Determinate</code></td><td>Determinate or Indeterminate (animated loading). See <code>a|b</code>.</td></tr>
  </table>`;

const S1 = `<section id="introduction" data-part="Getting Started" data-nav-title="Introduction">
  <h1>Introduction</h1>
  <p>Build screens without code. See the <a href="#gauge-props">gauge properties</a>,
  the <a href="manual/extra.html">extra reference</a> and <a href="other.html#top">another page</a>.</p>
  <h3 id="introduction-learn">What you will <em>learn</em></h3>
  <p>Everything.</p>
</section>`;

const S2 = `<section id="parts-list" data-part="Building &amp; Layouts" data-nav-title="Parts &amp; Pieces">
  <h2>All The Parts</h2>
  <p><strong>Gauge</strong> - A linear or circular indicator.</p>
  <h3 id="gauge-props">Gauge [props]</h3>
  ${PROP_TABLE}
  <pre><code>{ "type": "Gauge", "mode": "Indeterminate" }</code></pre>
  <h3>No anchor here</h3>
</section>`;

const S3 = `<section data-part="Building &amp; Layouts">
  <h2>Untitled Tail</h2>
  <p>Back to the <a href="#introduction">start</a> and a <a href="#nowhere">dead anchor</a>.</p>
</section>`;

interface Site {
  [url: string]: { status?: number; body?: string; throws?: string } | undefined;
}

function fakeFetch(site: Site, calls: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const e = site[url];
    if (!e) return new Response("nf", { status: 404 });
    if (e.throws) throw new Error(e.throws);
    return new Response(e.body ?? "", { status: e.status ?? 200 });
  }) as typeof fetch;
}

const noSleep = async () => {};

function siteOf(extra: Site = {}): Site {
  return {
    [`${ROOT}index.html`]: {
      body:
        '<html><head><title>Tasker: Userguide</title></head><body><a href="manual.html">The Manual</a> ' +
        '<a href="manual.html#gauge-props">Gauge</a> <a href="manual.html#nope">Nope</a></body></html>',
    },
    [`${ROOT}manual.html`]: { body: shell },
    [`${ROOT}manual/01.html`]: { body: S1 },
    [`${ROOT}manual/02.html`]: { body: S2 },
    [`${ROOT}manual/03.html`]: { body: S3 },
    [`${ROOT}manual/extra.html`]: {
      body: "<html><head><title>Extra Reference</title></head><body><p>Extra text.</p></body></html>",
    },
    [`${ROOT}other.html`]: { body: "<html><body><h2>Other</h2><p>o</p></body></html>" },
    ...extra,
  };
}

const run = (site: Site, calls: string[] = [], more: Parameters<typeof crawl>[0] = {}) =>
  crawl({
    fetch: fakeFetch(site, calls),
    sleep: noSleep,
    startUrls: [`${ROOT}index.html`],
    ...more,
  });

describe("sectionsDirOf", () => {
  it("finds the sections directory of a loader shell", () => {
    expect(sectionsDirOf(shell, `${ROOT}manual.html`)).toBe(`${ROOT}manual/`);
    expect(
      sectionsDirOf(
        'var SECTIONS_DIR = "parts"; x = SECTIONS_DIR + pad(n) + ".html";',
        `${ROOT}a.html`,
      ),
    ).toBe(`${ROOT}parts/`);
    expect(sectionFileUrl(`${ROOT}manual/`, 7)).toBe(`${ROOT}manual/07.html`);
    expect(sectionFileUrl(`${ROOT}manual/`, 12)).toBe(`${ROOT}manual/12.html`);
  });

  it("needs both the variable and the numbered-file loop", () => {
    expect(sectionsDirOf("<p>plain page</p>", `${ROOT}a.html`)).toBeNull();
    expect(sectionsDirOf("var SECTIONS_DIR = 'x/';", `${ROOT}a.html`)).toBeNull();
    expect(sectionsDirOf("f(SECTIONS_DIR + n + '.html')", `${ROOT}a.html`)).toBeNull();
    expect(
      sectionsDirOf("var SECTIONS_DIR = 'http://[bad'; SECTIONS_DIR + n + '.html'", `${ROOT}a`),
    ).toBeNull();
  });
});

describe("crawl of a sectioned manual", () => {
  it("fetches the numbered sections in order and stops at the first missing one", async () => {
    const calls: string[] = [];
    const out = await run(siteOf(), calls);
    const sectionCalls = calls.filter((u) => /manual\/\d+\.html$/.test(u));
    expect(sectionCalls).toEqual([
      `${ROOT}manual/01.html`,
      `${ROOT}manual/02.html`,
      `${ROOT}manual/03.html`,
      `${ROOT}manual/04.html`,
    ]);
    // The terminating 404 is the normal end of a manual, not a skipped page.
    expect(out.skipped).toEqual([]);
    expect(out.pages.map((p) => p.slug)).toEqual([
      "index",
      "manual",
      "manual__01_introduction",
      "manual__02_parts_list",
      "manual__03",
      "manual__extra",
      "other",
    ]);
  });

  it("gives each section a slug, a title, a source URL and a link back to the manual", async () => {
    const out = await run(siteOf());
    const s1 = out.pages.find((p) => p.slug === "manual__01_introduction")!;
    expect(s1.title).toBe("Tasker Sample Builder Manual: Introduction");
    expect(s1.url).toBe(`${ROOT}manual.html#introduction`);
    // The heading that repeats the nav title is dropped.
    expect(
      s1.markdown.startsWith(
        "Section 1 of [Tasker Sample Builder Manual](manual) (Getting Started).\n\nBuild screens",
      ),
    ).toBe(true);
    const s2 = out.pages.find((p) => p.slug === "manual__02_parts_list")!;
    expect(s2.title).toBe("Tasker Sample Builder Manual: Parts & Pieces");
    expect(s2.markdown).toContain("(Building & Layouts).\n\n## All The Parts");
    expect(s2.markdown).toContain('```\n{ "type": "Gauge", "mode": "Indeterminate" }\n```');
    const s3 = out.pages.find((p) => p.slug === "manual__03")!;
    expect(s3.title).toBe("Tasker Sample Builder Manual: Untitled Tail");
    expect(s3.url).toBe(`${ROOT}manual/03.html`);
  });

  it("turns the shell page into an index of its sections", async () => {
    const out = await run(siteOf());
    const m = out.pages.find((p) => p.slug === "manual")!;
    expect(m.title).toBe("Tasker Sample Builder Manual");
    expect(m.markdown).not.toContain("Loading sections");
    expect(m.markdown).toBe(
      [
        "This manual has 3 sections, each a page of its own. Every link below is the slug of a section page.",
        "## Getting Started",
        "- [Introduction](manual__01_introduction)\n" +
          "  - [What you will learn](manual__01_introduction#introduction-learn)",
        "## Building & Layouts",
        "- [Parts & Pieces](manual__02_parts_list)\n" +
          "  - [Gauge props](manual__02_parts_list#gauge-props)\n" +
          "- [Untitled Tail](manual__03)",
      ].join("\n\n"),
    );
  });

  it("resolves links against the shell and points anchors at the owning section", async () => {
    const out = await run(siteOf());
    const s1 = out.pages.find((p) => p.slug === "manual__01_introduction")!;
    expect(s1.markdown).toContain("[gauge properties](manual__02_parts_list#gauge-props)");
    // "manual/extra.html" is relative to manual.html, not to manual/01.html.
    expect(s1.markdown).toContain("[extra reference](manual__extra)");
    expect(s1.markdown).toContain("[another page](other#top)");
    const s3 = out.pages.find((p) => p.slug === "manual__03")!;
    expect(s3.markdown).toContain("[start](manual__01_introduction#introduction)");
    expect(s3.markdown).toContain("[dead anchor](manual#nowhere)");
    // Links from other pages into the manual follow the anchor too.
    const idx = out.pages.find((p) => p.slug === "index")!;
    expect(idx.markdown).toContain("[The Manual](manual)");
    expect(idx.markdown).toContain("[Gauge](manual__02_parts_list#gauge-props)");
    expect(idx.markdown).toContain("[Nope](manual#nope)");
    expect(out.pages.find((p) => p.slug === "manual__extra")?.title).toBe("Extra Reference");
  });

  it("keeps the sections already read when a later one fails", async () => {
    const calls: string[] = [];
    const out = await run(siteOf({ [`${ROOT}manual/02.html`]: { status: 503 } }), calls, {
      retries: 1,
    });
    expect(out.pages.map((p) => p.slug)).toContain("manual__01_introduction");
    expect(out.pages.some((p) => p.slug.startsWith("manual__02"))).toBe(false);
    expect(out.skipped).toEqual([{ url: `${ROOT}manual/02.html`, reason: "HTTP 503" }]);
    expect(calls.filter((u) => u.endsWith("manual/02.html"))).toHaveLength(2);
    expect(calls.some((u) => u.endsWith("manual/03.html"))).toBe(false);
    expect(out.pages.find((p) => p.slug === "manual")?.markdown).toContain("has 1 sections");
    // The rest of the guide is unaffected.
    expect(out.pages.map((p) => p.slug)).toContain("other");
  });

  it("keeps the shell as a plain page when no section can be read", async () => {
    const out = await run(
      siteOf({
        [`${ROOT}manual/01.html`]: { throws: "socket hang up" },
      }),
      [],
      { retries: 0 },
    );
    expect(out.pages.find((p) => p.slug === "manual")?.markdown).toContain("Loading sections");
    expect(out.pages.some((p) => p.slug.startsWith("manual__0"))).toBe(false);
    expect(out.skipped).toEqual([{ url: `${ROOT}manual/01.html`, reason: "socket hang up" }]);
    const none = await run(siteOf({ [`${ROOT}manual/01.html`]: undefined }));
    expect(none.pages.find((p) => p.slug === "manual")?.markdown).toContain("Loading sections");
    expect(none.skipped).toEqual([]);
  });

  it("does not fetch sections twice, honors robots.txt and never loops forever", async () => {
    // A direct link to a section file must not produce a second copy of it.
    const calls: string[] = [];
    const linked = siteOf();
    linked[`${ROOT}other.html`] = { body: '<p>o <a href="manual/01.html">raw</a></p>' };
    const out = await run(linked, calls);
    expect(calls.filter((u) => u.endsWith("manual/01.html"))).toHaveLength(1);
    expect(out.pages.filter((p) => p.slug.startsWith("manual__01"))).toHaveLength(1);

    const blocked = await run(
      siteOf({
        "https://tasker.joaoapps.com/robots.txt": {
          body: "User-agent: *\nDisallow: /userguide/en/manual/",
        },
      }),
    );
    expect(blocked.pages.some((p) => p.slug.startsWith("manual__"))).toBe(false);

    // A server that answers every numbered file is cut off at MAX_SECTIONS.
    const endless: string[] = [];
    const always = (async (input: string | URL | Request) => {
      const url = String(input);
      endless.push(url);
      if (url.endsWith("robots.txt")) return new Response("nf", { status: 404 });
      if (url.endsWith("manual.html")) return new Response(shell);
      return new Response(`<section id="s"><h2>S</h2><p>text</p></section>`);
    }) as typeof fetch;
    const big = await crawl({ fetch: always, sleep: noSleep, startUrls: [`${ROOT}manual.html`] });
    expect(endless.filter((u) => /manual\/\d+\.html$/.test(u))).toHaveLength(MAX_SECTIONS);
    expect(big.pages).toHaveLength(MAX_SECTIONS + 1);
  });

  it("waits between section fetches", async () => {
    const waits: number[] = [];
    await crawl({
      fetch: fakeFetch(siteOf()),
      sleep: async (ms) => void waits.push(ms),
      delayMs: 7,
      startUrls: [`${ROOT}manual.html`],
    });
    // 4 section requests (3 hits and the terminating miss), then 2 linked pages.
    expect(waits).toEqual([7, 7, 7, 7, 7, 7]);
  });
});

describe("buildSectionedManual", () => {
  const parent = { slug: "manual", title: "Manual", url: `${ROOT}manual.html` };
  const rewrite = (u: string) => u;

  it("skips empty fragments and copes with fragments that have no section tag", () => {
    const m = buildSectionedManual(
      parent,
      [
        { n: 1, url: `${ROOT}manual/01.html`, html: "<section id='a'> </section>" },
        { n: 2, url: `${ROOT}manual/02.html`, html: "<p>Bare text only.</p>" },
        { n: 3, url: `${ROOT}manual/03.html`, html: '<section id="--"><h2>Only</h2></section>' },
      ],
      rewrite,
    );
    expect(m.pages.map((p) => [p.slug, p.title])).toEqual([
      ["manual__02", "Manual: Section 2"],
      ["manual__03", "Manual: Only"],
    ]);
    expect(m.pages[0]!.markdown).toBe("Section 2 of [Manual](manual).\n\nBare text only.");
    expect(m.pages[1]!.markdown).toBe("Section 3 of [Manual](manual).");
    expect(m.indexMarkdown).toContain("- [Section 2](manual__02)\n- [Only](manual__03)");
    expect(m.indexMarkdown).not.toContain("##");
  });

  it("maps every element id to the first section that has it", () => {
    const m = buildSectionedManual(
      parent,
      [
        { n: 1, url: "u1", html: '<section id="a"><h2>A</h2><p id="x">one</p></section>' },
        { n: 2, url: "u2", html: '<section id="b"><h2>B</h2><p id="x">two</p></section>' },
      ],
      rewrite,
    );
    expect([...m.anchors]).toEqual([
      ["a", "manual__01_a"],
      ["x", "manual__01_a"],
      ["b", "manual__02_b"],
    ]);
  });

  it("remapAnchors leaves unknown slugs and anchors alone", () => {
    const anchors = new Map([["manual", new Map([["x", "manual__01_a"]])]]);
    const md = "[a](manual#x) [b](manual#y) [c](other#x) [d](manual)";
    expect(remapAnchors(md, anchors)).toBe(
      "[a](manual__01_a#x) [b](manual#y) [c](other#x) [d](manual)",
    );
    expect(remapAnchors(md, new Map())).toBe(md);
  });
});

describe("property tables", () => {
  it("keeps name, default and description in separate cells", () => {
    const md = htmlToMarkdown(PROP_TABLE, { baseUrl: `${ROOT}manual.html` }).markdown;
    expect(md).toBe(
      [
        "| Property | Default | Description |",
        "| --- | --- | --- |",
        "| `textSize` | `14` | Font size in sp |",
        "| `mode` | `Determinate` | Determinate or Indeterminate (animated loading). See `a\\|b`. |",
      ].join("\n"),
    );
    expect(md).not.toContain("textSize14");
  });

  it("separates block content inside one cell", () => {
    const md = htmlToMarkdown(
      "<table><tr><td><p>first</p><p>second</p><ul><li>one</li><li>two</li></ul></td><td>x<div>y</div></td></tr></table>",
      { baseUrl: `${ROOT}manual.html` },
    ).markdown;
    expect(md).toBe("| first second one two | x y |\n| --- | --- |");
  });
});

describe("search over section content", () => {
  it("finds words that only occur in a section and reads the section and the index", async () => {
    const out = await run(siteOf());
    const built = buildOutputs(out.pages, new Date("2026-01-01T00:00:00Z"));
    const files = new Map<string, string>([
      ["index.json", JSON.stringify(built.index)],
      ["search.json", JSON.stringify(built.search)],
      ...built.files,
    ]);
    const BASE = "https://example.test/docs-data/";
    const home = await mkdtemp(join(tmpdir(), "tasker-mcp-sections-"));
    try {
      const store = new DocsStore({
        home,
        baseUrl: BASE,
        fetch: (async (input: string | URL | Request) => {
          const body = files.get(String(input).slice(BASE.length));
          return body === undefined ? new Response("nf", { status: 404 }) : new Response(body);
        }) as typeof fetch,
      });
      const hits = await store.search("Gauge Indeterminate");
      expect(hits[0]).toMatchObject({ slug: "manual__02_parts_list", section: "guide" });
      expect((await store.search("textSize"))[0]?.slug).toBe("manual__02_parts_list");

      const page = await store.get("manual__02_parts_list#gauge-props");
      expect(page.slug).toBe("manual__02_parts_list");
      expect(page.url).toBe(`${ROOT}manual.html#parts-list`);
      expect(page.markdown).toContain("| `textSize` | `14` | Font size in sp |");
      expect((await store.search("Gauge Indeterminate"))[0]?.snippet).toContain(
        "**Gauge** - A linear",
      );

      const index = await store.get("manual");
      expect(index.markdown).toContain("- [Parts & Pieces](manual__02_parts_list)");
      const listed = (await store.list("guide")).map((p) => p.slug);
      expect(listed).toEqual(expect.arrayContaining(["manual", "manual__01_introduction"]));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
