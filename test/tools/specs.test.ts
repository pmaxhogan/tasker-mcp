import { afterEach, describe, expect, it } from "vitest";
import { SpecIndex, getSpec } from "../../src/spec/table.ts";
import { argTypeName, register, unknownCode } from "../../src/tools/specs.ts";
import {
  connectTools,
  createFakeContext,
  type FakeContext,
  type ToolHarness,
} from "./fake-context.ts";

let fc: FakeContext;
let t: ToolHarness;

async function setup(): Promise<void> {
  fc = await createFakeContext();
  t = await connectTools(fc.ctx, [register]);
}

afterEach(async () => {
  await t?.close();
  t = undefined as unknown as ToolHarness;
  await fc?.cleanup();
  fc = undefined as unknown as FakeContext;
});

describe("helpers", () => {
  it("names arg types", () => {
    expect(argTypeName(0)).toBe("Int");
    expect(argTypeName(7)).toBe("ConditionList");
    expect(argTypeName(99)).toBe("Type 99");
  });

  it("explains plugin and extra-action codes", () => {
    expect(unknownCode(getSpec(), 123456789).warning).toMatch(/plugin action/);
    const idx = new SpecIndex(
      { meta: { generated: "x", sources: [] }, actions: [], categories: [] },
      { extraActions: [{ code: 77, name: "Deprecated" }] },
    );
    const v = unknownCode(idx, 77);
    expect(v).toMatchObject({ code: 77, known: false, name: "Deprecated" });
    expect(v.warning).toMatch(/\(Deprecated\) is not in the spec table/);
  });
});

describe("get_action_spec", () => {
  it("returns a known action by code", async () => {
    await setup();
    const r = await t.call("get_action_spec", { codeOrName: 548 });
    expect(r.isError).toBe(false);
    expect(r.json).toMatchObject({ code: 548, name: "Flash", known: true });
    expect(typeof r.json.category).toBe("string");
    const arg0 = r.json.args[0];
    expect(arg0).toMatchObject({ id: 0, type: "String" });
    expect(typeof arg0.mandatory).toBe("boolean");
  });

  it("returns a known action by name and numeric string", async () => {
    await setup();
    const byName = await t.call("get_action_spec", { codeOrName: "perform task" });
    expect(byName.json).toMatchObject({ code: 130, known: true });
    const byStr = await t.call("get_action_spec", { codeOrName: "130" });
    expect(byStr.json.name).toBe(byName.json.name);
  });

  it("treats an unknown code as a warning, not an error", async () => {
    await setup();
    const r = await t.call("get_action_spec", { codeOrName: 990 });
    expect(r.isError).toBe(false);
    expect(r.json).toEqual({
      code: 990,
      known: false,
      warning:
        "Unknown action code 990; it can still be used as raw XML (copy it from a Tasker export)",
      suggestions: [],
    });
  });

  it("fails an unknown name with suggestions", async () => {
    await setup();
    const r = await t.call("get_action_spec", { codeOrName: "Flsh" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/Unknown action "Flsh"; did you mean: .*Flash \(548\)/);
    const none = await t.call("get_action_spec", { codeOrName: "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqq" });
    expect(none.isError).toBe(true);
    expect(none.text).toMatch(/; use search_actions$/);
  });
});

describe("search_actions and list_action_categories", () => {
  it("searches with limit and category", async () => {
    await setup();
    const r = await t.call("search_actions", { query: "flash", limit: 3 });
    expect(r.json.count).toBeGreaterThan(0);
    expect(r.json.hits[0]).toMatchObject({ code: 548, name: "Flash" });
    expect(r.json.hits.length).toBeLessThanOrEqual(3);

    const cats = await t.call("list_action_categories");
    expect(cats.json.count).toBeGreaterThan(5);
    const cat = cats.json.categories.find(
      (c: { count: number; name: string }) => c.count > 0 && !c.name.startsWith("Category "),
    );
    const byName = await t.call("search_actions", { query: "", category: cat.name });
    expect(byName.json.count).toBeGreaterThan(0);
    expect(byName.json.hits.every((h: { category?: string }) => h.category === cat.name)).toBe(
      true,
    );
    const byCode = await t.call("search_actions", { query: "", category: cat.code });
    expect(byCode.json.count).toBe(byName.json.count);
  });
});
