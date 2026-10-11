import { afterEach, describe, expect, it } from "vitest";
import { buildOutputs } from "../../src/docs/crawl.ts";
import { DocsStore } from "../../src/docs/index.ts";
import { register } from "../../src/tools/docs.ts";
import {
  connectTools,
  createFakeContext,
  type FakeContext,
  type ToolHarness,
} from "./fake-context.ts";

const BASE = "https://example.test/docs-data/";
const built = buildOutputs(
  [
    {
      slug: "help__ah_import_data",
      title: "Import Data",
      url: "https://tasker.joaoapps.com/userguide/en/help/ah_import_data.html",
      markdown: "Dynamically load a task into the active configuration. Import the data.",
    },
    {
      slug: "help__eh_http_request",
      title: "HTTP Request Event",
      url: "https://tasker.joaoapps.com/userguide/en/help/eh_http_request.html",
      markdown: "Tasker creates an HTTP server.",
    },
    {
      slug: "variables",
      title: "Variables",
      url: "https://tasker.joaoapps.com/userguide/en/variables.html",
      markdown: "A variable is a named value. See Import Data.",
    },
  ],
  new Date("2026-01-01T00:00:00Z"),
);
const remote = new Map<string, string>([
  ["index.json", JSON.stringify(built.index)],
  ["search.json", JSON.stringify(built.search)],
  ...built.files,
]);

let online = true;
const fakeFetch = (async (input: string | URL | Request) => {
  if (!online) throw new Error("offline");
  const body = remote.get(String(input).slice(BASE.length));
  return body === undefined ? new Response("nf", { status: 404 }) : new Response(body);
}) as typeof fetch;

let fc: FakeContext;
let t: ToolHarness;

async function setup(): Promise<void> {
  online = true;
  fc = await createFakeContext();
  fc.ctx.docs = new DocsStore({ home: fc.home, baseUrl: BASE, fetch: fakeFetch });
  t = await connectTools(fc.ctx, [register]);
}

afterEach(async () => {
  await t?.close();
  t = undefined as unknown as ToolHarness;
  await fc?.cleanup();
  fc = undefined as unknown as FakeContext;
});

describe("docs tools", () => {
  it("search_docs finds pages and filters by section", async () => {
    await setup();
    const r = await t.call("search_docs", { query: "import data", limit: 5 });
    expect(r.isError).toBe(false);
    expect(r.json.hits[0]).toMatchObject({ slug: "help__ah_import_data", section: "action" });
    const ev = await t.call("search_docs", { query: "import", section: "event" });
    expect(ev.json.count).toBe(0);
  });

  it("list_docs lists all or one section", async () => {
    await setup();
    const all = await t.call("list_docs");
    expect(all.json.count).toBe(3);
    expect(all.json.pages[0]).toHaveProperty("words");
    const guide = await t.call("list_docs", { section: "guide" });
    expect(guide.json.pages.map((p: { slug: string }) => p.slug)).toEqual(["variables"]);
    const bad = await t.call("list_docs", { section: "nope" });
    expect(bad.isError).toBe(true);
  });

  it("get_doc accepts a slug, a bare help name and a title", async () => {
    await setup();
    for (const slug of ["help__ah_import_data", "ah_import_data", "Import Data"]) {
      const r = await t.call("get_doc", { slug });
      expect(r.isError).toBe(false);
      expect(r.json.slug).toBe("help__ah_import_data");
      expect(r.json.markdown).toMatch(/Dynamically load/);
    }
    const miss = await t.call("get_doc", { slug: "nothing like it" });
    expect(miss.isError).toBe(true);
    expect(miss.text).toMatch(/No doc page matches/);
  });

  it("refresh_docs reports pages and keeps the cache when offline", async () => {
    await setup();
    const r = await t.call("refresh_docs");
    expect(r.json).toEqual({ pages: 3, generated: built.index.generated });
    online = false;
    const f = await t.call("refresh_docs");
    expect(f.isError).toBe(true);
    expect(f.text).toMatch(/keeping the cached copy/);
  });
});
