import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildOutputs } from "../../src/docs/crawl.ts";
import { DEFAULT_DOCS_BASE_URL, DocsStore } from "../../src/docs/store.ts";
import * as barrel from "../../src/docs/index.ts";

const BASE = "https://example.test/docs-data/";

const crawled = [
  {
    slug: "help__ah_import_data",
    title: "Import Data",
    url: "https://tasker.joaoapps.com/userguide/en/help/ah_import_data.html",
    markdown:
      "Dynamically load a task into the active configuration. Read the file first, then import the data.",
  },
  {
    slug: "help__eh_http_request",
    title: "HTTP Request Event",
    url: "https://tasker.joaoapps.com/userguide/en/help/eh_http_request.html",
    markdown: "Tasker creates an HTTP server. Use %http_request_id to respond.",
  },
  {
    slug: "help__sh_import_data",
    title: "Import Data State",
    url: "https://tasker.joaoapps.com/userguide/en/help/sh_import_data.html",
    markdown: "A state about importing.",
  },
  {
    slug: "help__ah_wifi_tether",
    title: "WiFi Tether",
    url: "https://tasker.joaoapps.com/userguide/en/help/ah_wifi_tether.html",
    markdown: "Enable the hotspot.",
  },
  {
    slug: "help__other_notes",
    title: "Notes",
    url: "https://tasker.joaoapps.com/userguide/en/help/other_notes.html",
    markdown: "Misc notes about import.",
  },
  {
    slug: "variables",
    title: "Variables",
    url: "https://tasker.joaoapps.com/userguide/en/variables.html",
    markdown:
      "A variable is a named value.\n\nGlobal variables have capitals. Variables everywhere.",
  },
];

const built = buildOutputs(crawled, new Date("2026-01-01T00:00:00Z"));
const remote = new Map<string, string>([
  ["index.json", JSON.stringify(built.index)],
  ["search.json", JSON.stringify(built.search)],
  ...built.files,
]);

function makeFetch(
  opts: { fail?: string; counts?: Record<string, number>; files?: Map<string, string> } = {},
) {
  const files = opts.files ?? remote;
  return (async (input: string | URL | Request) => {
    const url = String(input);
    expect(url.startsWith(BASE)).toBe(true);
    const rel = url.slice(BASE.length);
    if (opts.counts) opts.counts[rel] = (opts.counts[rel] ?? 0) + 1;
    if (opts.fail) throw new Error(opts.fail);
    const body = files.get(rel);
    return body === undefined ? new Response("nf", { status: 404 }) : new Response(body);
  }) as typeof fetch;
}

let home: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "tasker-mcp-docs-"));
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

const store = (o: Partial<ConstructorParameters<typeof DocsStore>[0]> = {}) =>
  new DocsStore({ home, baseUrl: BASE, fetch: makeFetch(), ...o });

describe("DocsStore download and cache", () => {
  it("downloads the index on first use and caches it under <home>/docs", async () => {
    const counts: Record<string, number> = {};
    const s = store({ fetch: makeFetch({ counts }) });
    await s.ensure();
    await s.ensure();
    expect(counts).toEqual({ "index.json": 1, "search.json": 1 });
    expect(existsSync(join(home, "docs", "index.json"))).toBe(true);
    expect(existsSync(join(home, "docs", "search.json"))).toBe(true);
    // A fresh instance reads the disk cache without touching the network.
    const counts2: Record<string, number> = {};
    const s2 = store({ fetch: makeFetch({ counts: counts2 }) });
    expect((await s2.list()).length).toBe(6);
    expect(counts2).toEqual({});
  });

  it("shares one download between concurrent ensure() calls", async () => {
    const counts: Record<string, number> = {};
    const s = store({ fetch: makeFetch({ counts }) });
    await Promise.all([s.ensure(), s.list(), s.search("import")]);
    expect(counts["index.json"]).toBe(1);
  });

  it("downloads pages lazily and caches them", async () => {
    const counts: Record<string, number> = {};
    const s = store({ fetch: makeFetch({ counts }) });
    const doc = await s.get("help__ah_import_data");
    expect(doc.markdown).toContain("# Import Data\n\nSource: https://tasker.joaoapps.com");
    expect(doc.url).toContain("ah_import_data.html");
    await s.get("help__ah_import_data");
    await store({ fetch: makeFetch({ counts }) }).get("help__ah_import_data");
    expect(counts["pages/help__ah_import_data.md"]).toBe(1);
    expect(counts["pages/variables.md"]).toBeUndefined();
  });

  it("dedupes concurrent downloads of the same page", async () => {
    const counts: Record<string, number> = {};
    const s = store({ fetch: makeFetch({ counts }) });
    await s.ensure();
    await Promise.all([s.get("variables"), s.get("variables")]);
    expect(counts["pages/variables.md"]).toBe(1);
  });

  it("normalizes a baseUrl without trailing slash and has the documented default", async () => {
    const s = store({ baseUrl: "https://example.test/docs-data" });
    expect((await s.list()).length).toBe(6);
    expect(DEFAULT_DOCS_BASE_URL).toBe(
      "https://raw.githubusercontent.com/pmaxhogan/tasker-mcp/docs-data/",
    );
  });

  it("uses the global fetch by default", () => {
    const s = new DocsStore({ home });
    expect(s.dir).toBe(join(home, "docs"));
  });

  it("re-downloads on a corrupt cache", async () => {
    mkdirSync(join(home, "docs"), { recursive: true });
    writeFileSync(join(home, "docs", "index.json"), "{not json");
    writeFileSync(join(home, "docs", "search.json"), "{}");
    expect((await store().list()).length).toBe(6);
    writeFileSync(join(home, "docs", "index.json"), '{"pages": 1}');
    expect((await store().list()).length).toBe(6);
  });

  it("survives an unwritable cache directory", async () => {
    writeFileSync(join(home, "docs"), "i am a file, not a directory");
    const s = store();
    expect((await s.list()).length).toBe(6);
    expect((await s.get("variables")).title).toBe("Variables");
  });
});

describe("DocsStore errors", () => {
  it("reports an offline first use with the contract message", async () => {
    const s = store({ fetch: makeFetch({ fail: "getaddrinfo ENOTFOUND" }) });
    await expect(s.ensure()).rejects.toThrow(
      "Docs not cached yet and download failed (getaddrinfo ENOTFOUND); check network or run refresh_docs later",
    );
    await expect(s.search("x")).rejects.toThrow(/^Docs not cached yet and download failed/);
  });

  it("includes the cause code and HTTP status in the reason", async () => {
    const withCause = (async () => {
      throw new Error("fetch failed", { cause: { code: "ECONNREFUSED" } });
    }) as unknown as typeof fetch;
    await expect(store({ fetch: withCause }).ensure()).rejects.toThrow(
      "download failed (fetch failed: ECONNREFUSED)",
    );
    const notFound = makeFetch({ files: new Map() });
    await expect(store({ fetch: notFound }).ensure()).rejects.toThrow("HTTP 404 for index.json");
    const nonError = (async () => {
      throw "plain string";
    }) as unknown as typeof fetch;
    await expect(store({ fetch: nonError }).ensure()).rejects.toThrow("(plain string)");
  });

  it("rejects malformed downloads", async () => {
    const bad = new Map(remote);
    bad.set("index.json", "<html>captive portal</html>");
    await expect(store({ fetch: makeFetch({ files: bad }) }).ensure()).rejects.toThrow(
      "not valid JSON",
    );
    bad.set("index.json", '{"pages": "no"}');
    await expect(store({ fetch: makeFetch({ files: bad }) }).ensure()).rejects.toThrow(
      "unexpected shape",
    );
    bad.set("index.json", JSON.stringify(built.index));
    bad.set("search.json", "null");
    await expect(store({ fetch: makeFetch({ files: bad }) }).ensure()).rejects.toThrow(
      "unexpected shape",
    );
  });

  it("fails a page download offline with the contract message and does not cache", async () => {
    await store().ensure();
    const s = store({ fetch: makeFetch({ fail: "offline" }) });
    await expect(s.get("variables")).rejects.toThrow(
      "Docs not cached yet and download failed (offline); check network or run refresh_docs later",
    );
    expect(existsSync(join(home, "docs", "pages", "variables.md"))).toBe(false);
  });

  it("refuses unsafe slugs that sneak into a tampered index", async () => {
    const tampered = new Map(remote);
    const idx = structuredClone(built.index);
    idx.pages.push({ slug: "../evil", title: "Evil", url: "x", section: "guide", words: 1 });
    tampered.set("index.json", JSON.stringify(idx));
    const s = store({ fetch: makeFetch({ files: tampered }) });
    await expect(s.get("../evil")).rejects.toThrow("Invalid doc slug");
  });
});

describe("DocsStore.refresh", () => {
  it("re-downloads the index", async () => {
    const counts: Record<string, number> = {};
    const s = store({ fetch: makeFetch({ counts }) });
    await s.ensure();
    const r = await s.refresh();
    expect(r).toEqual({ pages: 6, generated: "2026-01-01T00:00:00.000Z" });
    expect(counts["index.json"]).toBe(2);
  });

  it("downloads when nothing is cached yet", async () => {
    expect((await store().refresh()).pages).toBe(6);
    expect(readFileSync(join(home, "docs", "index.json"), "utf8")).toContain("generated");
  });

  it("keeps the cache when the refresh fails", async () => {
    await store().ensure();
    const s = store({ fetch: makeFetch({ fail: "offline" }) });
    await expect(s.refresh()).rejects.toThrow(
      "Docs refresh failed (offline); keeping the cached copy",
    );
    expect((await s.list()).length).toBe(6);
  });

  it("reports the offline contract message when there is no cache at all", async () => {
    const s = store({ fetch: makeFetch({ fail: "offline" }) });
    await expect(s.refresh()).rejects.toThrow(
      "Docs not cached yet and download failed (offline); check network or run refresh_docs later",
    );
  });
});

describe("DocsStore.list and search", () => {
  it("lists all pages or one section", async () => {
    const s = store();
    expect((await s.list("action")).map((p) => p.slug)).toEqual([
      "help__ah_import_data",
      "help__ah_wifi_tether",
    ]);
    expect((await s.list("event")).map((p) => p.slug)).toEqual(["help__eh_http_request"]);
    expect((await s.list("state")).length).toBe(1);
    expect((await s.list("other")).length).toBe(1);
    expect((await s.list("guide")).length).toBe(1);
    expect(await s.list("bogus")).toEqual([]);
  });

  it("ranks title matches first and filters by section", async () => {
    const s = store();
    const hits = await s.search("import data");
    expect(hits[0]!.slug).toBe("help__ah_import_data");
    expect(hits.map((h) => h.slug)).toContain("help__sh_import_data");
    expect(hits[0]!).toMatchObject({ title: "Import Data", section: "action" });
    expect(hits[0]!.score).toBeGreaterThan(hits[hits.length - 1]!.score - 1e-9);
    const onlyState = await s.search("import data", { section: "state" });
    expect(onlyState.map((h) => h.slug)).toEqual(["help__sh_import_data"]);
    expect(await s.search("import", { limit: 1 })).toHaveLength(1);
  });

  it("matches prefixes, variable names and plurals", async () => {
    const s = store();
    expect((await s.search("tether"))[0]!.slug).toBe("help__ah_wifi_tether");
    expect((await s.search("%http_request_id"))[0]!.slug).toBe("help__eh_http_request");
    expect((await s.search("variable"))[0]!.slug).toBe("variables");
    expect((await s.search("impo"))[0]!.slug).toContain("import_data");
  });

  it("returns nothing for stopword-only, empty or unknown queries", async () => {
    const s = store();
    expect(await s.search("the of and")).toEqual([]);
    expect(await s.search("")).toEqual([]);
    expect(await s.search("qqqqzzzz")).toEqual([]);
  });

  it("uses the title as the snippet until the page is cached, then a context excerpt", async () => {
    const s = store();
    const before = await s.search("hotspot");
    expect(before[0]!.snippet).toBe("WiFi Tether");
    await s.get("help__ah_wifi_tether");
    const after = await s.search("hotspot");
    expect(after[0]!.snippet).toBe("Enable the hotspot.");
    await s.get("variables");
    const v = (await s.search("capitals"))[0]!;
    expect(v.snippet).toContain("Global variables have capitals");
    expect(v.snippet).not.toContain("Source:");
  });

  it("truncates long snippets with ellipses and falls back to the title with no text hit", async () => {
    const long = {
      slug: "long",
      title: "Long Page",
      url: "https://tasker.joaoapps.com/userguide/en/long.html",
      markdown: "x ".repeat(300) + "needle " + "y ".repeat(300),
    };
    const b = buildOutputs([long, ...crawled]);
    const files = new Map<string, string>([
      ["index.json", JSON.stringify(b.index)],
      ["search.json", JSON.stringify(b.search)],
      ...b.files,
    ]);
    const s = store({ fetch: makeFetch({ files }) });
    await s.get("long");
    const hit = (await s.search("needle"))[0]!;
    expect(hit.snippet.startsWith("...")).toBe(true);
    expect(hit.snippet.endsWith("...")).toBe(true);
    expect(hit.snippet.length).toBeLessThan(215);
    expect(hit.snippet).toContain("needle");
    // Cached page where the match is only via the stemmed/title term, not in the body text.
    await s.get("help__ah_wifi_tether");
    const t = (await s.search("wifi"))[0]!;
    expect(t.snippet).toBe("WiFi Tether");
  });
  it("never reads a snippet through an unsafe slug from a tampered index", async () => {
    const page = {
      slug: "zebrapage",
      title: "Zebra",
      url: "https://tasker.joaoapps.com/userguide/en/zebra.html",
      markdown: "zebra stripes",
    };
    const b = buildOutputs([page, ...crawled]);
    const idx = structuredClone(b.index);
    const entry = idx.pages.find((p) => p.slug === "zebrapage")!;
    entry.slug = "../secret";
    const files = new Map<string, string>([
      ["index.json", JSON.stringify(idx)],
      ["search.json", JSON.stringify(b.search)],
    ]);
    mkdirSync(join(home, "docs"), { recursive: true });
    writeFileSync(join(home, "docs", "secret.md"), "# S\n\nSource: x\n\nzebra private text");
    const hit = (await store({ fetch: makeFetch({ files }) }).search("zebra"))[0]!;
    expect(hit.slug).toBe("../secret");
    expect(hit.snippet).toBe("Zebra");
  });
});

describe("DocsStore.get fuzzy matching", () => {
  it("accepts the full slug, bare name, spaced words, a title and any case", async () => {
    const s = store();
    for (const q of [
      "help__ah_import_data",
      "ah_import_data",
      "AH_Import_Data",
      "ah import data",
      "Import Data",
      "  help__AH_IMPORT_DATA ",
    ]) {
      expect((await s.get(q)).slug).toBe("help__ah_import_data");
    }
    expect((await s.get("eh_http_request")).slug).toBe("help__eh_http_request");
    expect((await s.get("HTTP Request Event")).slug).toBe("help__eh_http_request");
    expect((await s.get("notes")).slug).toBe("help__other_notes");
    expect((await s.get("wifi tether")).slug).toBe("help__ah_wifi_tether");
    expect((await s.get("variables")).slug).toBe("variables");
  });

  it("reports ambiguity", async () => {
    const two = structuredClone(built.index);
    const base = two.pages[0]!;
    two.pages.push({ ...base, slug: "help__ah_foo", title: "Foo Action" });
    two.pages.push({ ...base, slug: "help__sh_foo", title: "Foo State" });
    const twoFiles = new Map(remote);
    twoFiles.set("index.json", JSON.stringify(two));
    await expect(store({ fetch: makeFetch({ files: twoFiles }) }).get("foo")).rejects.toThrow(
      /ambiguous: help__ah_foo, help__sh_foo/,
    );
    const dup = structuredClone(built.index);
    dup.pages.push({ ...dup.pages[0]!, slug: "help__ah_dup_import" });
    const files = new Map(remote);
    files.set("index.json", JSON.stringify(dup));
    const s2 = store({ home: join(home, "b"), fetch: makeFetch({ files }) });
    await expect(s2.get("Import Data")).rejects.toThrow(/ambiguous: help__ah_import_data/);
  });

  it("lists close slugs for a miss", async () => {
    const s = store();
    await expect(s.get("import dat")).rejects.toThrow(
      /No doc page matches "import dat"\. Close slugs: .*help__ah_import_data.*search_docs/,
    );
    await expect(s.get("zzzz")).rejects.toThrow(/^No doc page matches "zzzz"\. Use search_docs/);
  });
});

describe("barrel", () => {
  it("exports the public API", () => {
    expect(barrel.DocsStore).toBe(DocsStore);
    expect(barrel.DOC_SECTIONS).toEqual(["guide", "action", "event", "state", "other"]);
    expect(barrel.DEFAULT_DOCS_BASE_URL).toBe(DEFAULT_DOCS_BASE_URL);
  });
});
