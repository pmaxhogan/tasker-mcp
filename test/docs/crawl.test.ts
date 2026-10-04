import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildOutputs,
  crawl,
  parseRobots,
  renderPageFile,
  robotsAllows,
  USER_AGENT,
} from "../../src/docs/crawl.ts";
import {
  buildSearchIndex,
  countWords,
  isSafeSlug,
  sectionOf,
  slugFromUrl,
} from "../../src/docs/pages.ts";

const ROOT = "https://tasker.joaoapps.com/userguide/en/";
const listing = readFileSync(
  new URL("../fixtures/docs/help-listing.html", import.meta.url),
  "utf8",
);
const guide = readFileSync(new URL("../fixtures/docs/guide.html", import.meta.url), "utf8");

function page(title: string, body: string): string {
  return `<html><head><title>${title}</title></head><body><H2>${title}</H2><P>${body}</P></body></html>`;
}

interface Site {
  [url: string]: { status?: number; body?: string; throws?: string } | undefined;
}

function fakeFetch(site: Site, calls: { url: string; ua?: string }[] = []): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, ua: (init?.headers as Record<string, string> | undefined)?.["user-agent"] });
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
      body: `<html><head><title>Tasker: Userguide</title></head><body>
        <a href="guide.html">g</a> <a href="${ROOT}help/ah_sample.html#x">a</a>
        <a href="https://example.com/off.html">off</a> <a href="/other/area.html">area</a>
        <a href="pic.png">pic</a> <a href="help/auto_index.html#sh">A-Z</a><a href="guide.html?x=1">dup</a>
        <a href="http://[bad">bad</a>
        </body></html>`,
    },
    [`${ROOT}guide.html`]: { body: guide },
    [`${ROOT}help/`]: { body: listing },
    [`${ROOT}help/ah_sample.html`]: {
      body: "<html><body><H3>Sample Action</H3><P>Does the sample thing with http requests.</P></body></html>",
    },
    [`${ROOT}help/eh_sample.html`]: { body: page("Sample Event", "An event.") },
    [`${ROOT}help/sh_sample.html`]: { body: page("Sample State", "A state.") },
    [`${ROOT}help/other_page.html`]: { body: page("Other Page", "Something else.") },
    [`${ROOT}help/auto_index.html`]: { body: "<html><body><script>x</script></body></html>" },
    [`${ROOT}other.html`]: { body: page("Other", "o") },
    [`${ROOT}empty.html`]: { body: "<p></p>" },
    ...extra,
  };
}

describe("slug helpers", () => {
  it("maps URLs to slugs", () => {
    expect(slugFromUrl(`${ROOT}help/ah_import_data.html`)).toBe("help__ah_import_data");
    expect(slugFromUrl(`${ROOT}index.html#x`)).toBe("index");
    expect(slugFromUrl(`${ROOT}a b/c%20d.html`)).toBe("a_20b__c_20d");
    expect(slugFromUrl(`${ROOT}help/`)).toBeNull();
    expect(slugFromUrl("https://tasker.joaoapps.com/other/x.html")).toBeNull();
    expect(slugFromUrl("not a url")).toBeNull();
    expect(slugFromUrl(`${ROOT}.html`)).toBeNull();
    expect(slugFromUrl(`${ROOT}a..b.html`)).toBeNull();
  });

  it("derives sections", () => {
    expect(sectionOf("variables")).toBe("guide");
    expect(sectionOf("help__ah_x")).toBe("action");
    expect(sectionOf("help__eh_x")).toBe("event");
    expect(sectionOf("help__sh_x")).toBe("state");
    expect(sectionOf("help__auto_index")).toBe("other");
    expect(sectionOf("help__ah_index")).toBe("other");
  });

  it("validates slugs and counts words", () => {
    expect(isSafeSlug("help__ah_x")).toBe(true);
    expect(isSafeSlug("../x")).toBe(false);
    expect(isSafeSlug("a/b")).toBe(false);
    expect(isSafeSlug("a..b")).toBe(false);
    expect(countWords(" a b\n c ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});

describe("robots.txt", () => {
  const txt = [
    "# comment",
    "User-agent: badbot",
    "Disallow: /",
    "",
    "User-agent: *",
    "User-agent: tasker-mcp-docs-sync",
    "Disallow: /userguide/en/help/secret",
    "Disallow: /private",
    "Allow: /private/ok",
    "Crawl-delay: 5",
    "garbage line",
    "Disallow:",
  ].join("\n");

  it("parses rules for * and our UA only", () => {
    const rules = parseRobots(txt);
    expect(rules.disallow).toEqual(["/userguide/en/help/secret", "/private"]);
    expect(rules.allow).toEqual(["/private/ok"]);
  });

  it("applies longest match with allow winning ties", () => {
    const rules = parseRobots(txt);
    expect(robotsAllows(rules, "/userguide/en/help/secret.html")).toBe(false);
    expect(robotsAllows(rules, "/private/x")).toBe(false);
    expect(robotsAllows(rules, "/private/ok/x")).toBe(true);
    expect(robotsAllows(rules, "/userguide/en/index.html")).toBe(true);
    expect(robotsAllows({ allow: [], disallow: [] }, "/x")).toBe(true);
  });
});

describe("crawl", () => {
  it("follows same-site links, handles the help listing and skips junk", async () => {
    const calls: { url: string; ua?: string }[] = [];
    const out = await crawl({ fetch: fakeFetch(siteOf(), calls), sleep: noSleep });
    const slugs = out.pages.map((p) => p.slug);
    expect(slugs).toEqual([
      "guide",
      "help__ah_sample",
      "help__eh_sample",
      "help__other_page",
      "help__sh_sample",
      "index",
      "other",
    ]);
    expect(calls.every((c) => !c.url.includes("example.com") && !c.url.includes("pic.png"))).toBe(
      true,
    );
    expect(calls.find((c) => c.url.endsWith("index.html"))?.ua).toBe(USER_AGENT);
    expect(out.skipped.map((s) => s.reason)).toContain("empty page");
    expect(out.skipped.some((s) => s.url.endsWith("secret.html") && s.reason === "HTTP 404")).toBe(
      true,
    );
    const act = out.pages.find((p) => p.slug === "help__ah_sample");
    expect(act?.title).toBe("Sample Action");
    // The duplicate leading heading is dropped; the body remains.
    expect(act?.markdown).toBe("Does the sample thing with http requests.");
    const idx = out.pages.find((p) => p.slug === "index");
    expect(idx?.markdown).toContain("[g](guide)");
    expect(idx?.markdown).toContain("[a](help__ah_sample#x)");
    expect(idx?.markdown).toContain("https://example.com/off.html");
  });

  it("honors robots.txt Disallow", async () => {
    const site = siteOf({
      "https://tasker.joaoapps.com/robots.txt": {
        body: "User-agent: *\nDisallow: /userguide/en/help/secret\nDisallow: /userguide/en/other",
      },
    });
    const calls: { url: string }[] = [];
    const out = await crawl({ fetch: fakeFetch(site, calls), sleep: noSleep });
    expect(out.pages.map((p) => p.slug)).not.toContain("help__secret");
    expect(out.pages.map((p) => p.slug)).not.toContain("other");
    expect(calls.some((c) => c.url.includes("secret"))).toBe(false);
    expect(out.skipped.filter((s) => s.reason === "robots.txt")).toHaveLength(2);
  });

  it("proceeds when robots.txt cannot be fetched", async () => {
    const site = siteOf();
    const base = fakeFetch(site);
    const f = (async (u: string | URL | Request, i?: RequestInit) => {
      if (String(u).endsWith("robots.txt")) throw new Error("boom");
      return base(u, i);
    }) as typeof fetch;
    const out = await crawl({ fetch: f, sleep: noSleep });
    expect(out.pages.length).toBeGreaterThan(3);
  });

  it("retries 5xx and network errors, then gives up", async () => {
    let flaky = 0;
    let dead = 0;
    const site = siteOf();
    const base = fakeFetch(site);
    const f = (async (u: string | URL | Request, i?: RequestInit) => {
      const url = String(u);
      if (url.endsWith("other.html")) {
        flaky++;
        return flaky < 3 ? new Response("x", { status: 503 }) : base(u, i);
      }
      if (url.endsWith("help/eh_sample.html")) {
        dead++;
        throw new Error("ECONNRESET");
      }
      return base(u, i);
    }) as typeof fetch;
    const sleeps: number[] = [];
    const out = await crawl({
      fetch: f,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      delayMs: 10,
    });
    expect(flaky).toBe(3);
    expect(out.pages.map((p) => p.slug)).toContain("other");
    expect(dead).toBe(3);
    expect(out.pages.map((p) => p.slug)).not.toContain("help__eh_sample");
    expect(out.skipped).toContainEqual({
      url: `${ROOT}help/eh_sample.html`,
      reason: "ECONNRESET",
    });
    expect(sleeps).toContain(20);
  });

  it("reports a persistent 5xx and non-Error throws", async () => {
    const f = (async (u: string | URL | Request) => {
      if (String(u).endsWith("index.html")) throw "weird";
      return new Response("", { status: 500 });
    }) as typeof fetch;
    const out = await crawl({
      fetch: f,
      sleep: noSleep,
      retries: 1,
      startUrls: [`${ROOT}index.html`, `${ROOT}x.html`],
    });
    expect(out.pages).toEqual([]);
    expect(out.skipped.map((s) => s.reason).sort()).toEqual(["HTTP 500", "weird"]);
  });

  it("stops at the limit, dedupes slugs and logs progress", async () => {
    const lines: string[] = [];
    const out = await crawl({
      fetch: fakeFetch(siteOf()),
      sleep: noSleep,
      limit: 2,
      log: (m) => lines.push(m),
    });
    expect(out.pages).toHaveLength(2);
    expect(lines).toHaveLength(2);
    // index.html and index.htm map to one slug
    const site = siteOf({
      [`${ROOT}index.html`]: { body: '<a href="index.htm">x</a><p>hi</p>' },
      [`${ROOT}index.htm`]: { body: "<p>dupe</p>" },
    });
    const dup = await crawl({
      fetch: fakeFetch(site),
      sleep: noSleep,
      startUrls: [`${ROOT}index.html`],
    });
    expect(dup.pages.filter((p) => p.slug === "index")).toHaveLength(1);
  });

  it("uses the default sleep and global fetch signature when not injected", async () => {
    const out = await crawl({
      fetch: fakeFetch({ [`${ROOT}index.html`]: { body: page("Solo", "x") } }),
      delayMs: 1,
      startUrls: [`${ROOT}index.html`, `${ROOT}index.html`],
    });
    expect(out.pages).toHaveLength(1);
  });

  it("keeps a title-only page's title and falls back to the slug without one", async () => {
    const out = await crawl({
      fetch: fakeFetch({
        [`${ROOT}index.html`]: { body: '<a href="t.html">t</a><a href="u.html">u</a>x' },
        [`${ROOT}t.html`]: { body: "<h3>Only Title</h3>" },
        [`${ROOT}u.html`]: { body: "just text" },
      }),
      sleep: noSleep,
      startUrls: [`${ROOT}index.html`],
    });
    expect(out.pages.find((p) => p.slug === "t")).toMatchObject({
      title: "Only Title",
      markdown: "",
    });
    expect(out.pages.find((p) => p.slug === "u")?.title).toBe("u");
  });
});

describe("outputs", () => {
  const pages = [
    {
      slug: "help__ah_import_data",
      title: "Import Data",
      url: `${ROOT}help/ah_import_data.html`,
      markdown: "Load a task into the configuration.",
    },
    {
      slug: "variables",
      title: "Variables",
      url: `${ROOT}variables.html`,
      markdown: "variables store values; %http_request_id",
    },
  ];

  it("renders page files with title and Source lines", () => {
    expect(renderPageFile(pages[0]!)).toBe(
      `# Import Data\n\nSource: ${pages[0]!.url}\n\nLoad a task into the configuration.\n`,
    );
  });

  it("builds index, search index and files with a stable hash", () => {
    const a = buildOutputs(pages, new Date("2026-01-01T00:00:00Z"));
    const b = buildOutputs(pages, new Date("2027-01-01T00:00:00Z"));
    expect(a.index.hash).toBe(b.index.hash);
    expect(a.index.generated).toBe("2026-01-01T00:00:00.000Z");
    expect(a.index.pages[0]).toMatchObject({
      slug: "help__ah_import_data",
      section: "action",
      words: 6,
    });
    expect([...a.files.keys()]).toEqual(["pages/help__ah_import_data.md", "pages/variables.md"]);
    const c = buildOutputs([{ ...pages[0]!, markdown: "changed" }, pages[1]!]);
    expect(c.index.hash).not.toBe(a.index.hash);
    expect(buildOutputs(pages).index.generated).toMatch(/^\d{4}-/);
  });

  it("boosts title terms, caps postings and drops ubiquitous terms", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      slug: `p${i}`,
      title: i === 0 ? "Zebra" : `Page ${i}`,
      markdown: `common word ${i % 2 ? "odd" : "even"}${i < 4 ? " zebra" : ""}`,
    }));
    const idx = buildSearchIndex(many, { maxPostings: 3 });
    expect(idx.terms.common).toBeUndefined();
    expect(idx.terms.zebra![0]).toEqual([0, 6]);
    expect(idx.terms.zebra).toHaveLength(3);
    expect(idx.terms.odd).toHaveLength(3);
    const small = buildSearchIndex(many.slice(0, 3));
    expect(small.terms.common).toHaveLength(3);
  });
});
