import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DATA_DIR,
  ELSE,
  END_FOR,
  END_IF,
  FOR,
  IF,
  SpecIndex,
  editDistance,
  getSpec,
  loadSpecIndex,
  loadSpecTable,
  normName,
} from "../../src/spec/table.ts";
import type { SpecTable } from "../../src/spec/types.ts";

const repoRoot = resolvePath(fileURLToPath(new URL("../../", import.meta.url)));
const spec = getSpec();

describe("data location", () => {
  it("resolves data/ at the package root from src/", () => {
    expect(resolvePath(fileURLToPath(DATA_DIR))).toBe(resolvePath(repoRoot, "data"));
    expect(existsSync(new URL("actions.json", DATA_DIR))).toBe(true);
  });

  it("resolves the same data/ from dist/spec/table.js", () => {
    const distModule = pathToFileURL(resolvePath(repoRoot, "dist/spec/table.js"));
    const fromDist = new URL("../../data/actions.json", distModule);
    expect(resolvePath(fileURLToPath(fromDist))).toBe(resolvePath(repoRoot, "data/actions.json"));
  });

  it("loads the table and caches the index", () => {
    const t = loadSpecTable();
    expect(t.actions.length).toBe(418);
    expect(t.meta.sources.length).toBeGreaterThan(0);
    expect(getSpec()).toBe(spec);
    expect(loadSpecIndex().actions.length).toBe(418);
  });

  it("accepts an explicit path", () => {
    const t = loadSpecTable(resolvePath(repoRoot, "data/actions.json"));
    expect(t.categories.length).toBeGreaterThan(0);
  });
});

describe("block codes", () => {
  it("match the spec table names", () => {
    expect(spec.byCode(IF)?.name).toBe("If");
    expect(spec.byCode(ELSE)?.name).toBe("Else");
    expect(spec.byCode(END_IF)?.name).toBe("End If");
    expect(spec.byCode(FOR)?.name).toBe("For");
    expect(spec.byCode(END_FOR)?.name).toBe("End For");
  });
});

describe("helpers", () => {
  it("normName strips case and punctuation", () => {
    expect(normName("Perform  Task!")).toBe("performtask");
    expect(normName("an_perform_task")).toBe("anperformtask");
  });

  it("editDistance", () => {
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("", "ab")).toBe(2);
    expect(editDistance("ab", "")).toBe(2);
    expect(editDistance("kitten", "sitting")).toBe(3);
  });
});

describe("lookup", () => {
  it("byCode", () => {
    expect(spec.byCode(130)?.name).toBe("Perform Task");
    expect(spec.byCode(99999)).toBeUndefined();
  });

  it.each([
    "Perform Task",
    "perform task",
    "perform_task",
    "PERFORM-TASK",
    "an_run_task",
    "run task",
  ])("byName(%s)", (q) => {
    expect(spec.byName(q)?.code).toBe(130);
  });

  it("every display name resolves to its own action", () => {
    for (const a of spec.actions) expect(spec.byName(a.name)?.code).toBe(a.code);
  });

  it("byName misses", () => {
    expect(spec.byName("no such action")).toBeUndefined();
    expect(spec.byName("")).toBeUndefined();
  });

  it("argById", () => {
    const pt = spec.byCode(130)!;
    expect(spec.argById(pt, 0)?.name).toBe("Name");
    expect(spec.argById(pt, 99)).toBeUndefined();
  });

  it("categoryName", () => {
    expect(spec.categoryName(105)).toBe("Task");
    expect(spec.categoryName(undefined)).toBeUndefined();
    expect(spec.categoryName(-5)).toBeUndefined();
  });
});

describe("resolve", () => {
  it("by number and numeric string", () => {
    expect(spec.resolve(547)).toEqual({ spec: spec.byCode(547) });
    expect(spec.resolve(" 547 ")).toEqual({ spec: spec.byCode(547) });
  });

  it("by name", () => {
    const r = spec.resolve("variable set");
    expect("spec" in r && r.spec.code).toBe(547);
  });

  it("plugin codes", () => {
    for (const code of [1000, 107361459, 1732635924]) {
      const r = spec.resolve(code);
      expect("error" in r && r.error).toMatch(/plugin/);
    }
  });

  it("deprecated extra codes", () => {
    const r = spec.resolve(151);
    expect("error" in r && r.error).toMatch(/Unknown action code 151 \(Deprecated action\)/);
  });

  it("unknown code", () => {
    const r = spec.resolve(990);
    expect(r).toEqual({
      error: "Unknown action code 990; use search_actions or pass raw XML",
      suggestions: [],
    });
  });

  it("APK action with no code in the table", () => {
    const r = spec.resolve("Encrypt File");
    expect("error" in r && r.error).toMatch(/Tasker GUI/);
    const r2 = spec.resolve("an_encrypt_file");
    expect("error" in r2 && r2.error).toMatch(/Encrypt File/);
  });

  it("misspelling gives up to 5 suggestions", () => {
    const r = spec.resolve("Varable St");
    if (!("error" in r)) throw new Error("expected error");
    expect(r.error).toBe('Unknown action "Varable St"');
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions.length).toBeLessThanOrEqual(5);
    expect(r.suggestions[0]).toEqual({ code: 547, name: "Variable Set" });
  });

  it("substring suggestions", () => {
    expect(spec.suggest("notifi")[0]?.name).toMatch(/^Notif/);
    expect(spec.suggest("photo").map((s) => s.name)).toContain("Take Photo");
    expect(spec.suggest("!!!")).toEqual([]);
    expect(spec.suggest("zzzzzzzzzzzzzzzzzzzzzzzzz")).toEqual([]);
  });
});

describe("search", () => {
  it("ranks exact name first", () => {
    const hits = spec.search("flash");
    expect(hits[0]?.spec.name).toBe("Flash");
    expect(hits[0]?.category).toBe("Alert");
  });

  it("requires every token to hit", () => {
    const hits = spec.search("http request");
    expect(hits[0]?.spec.code).toBe(339);
    expect(spec.search("http qwertyuiop")).toEqual([]);
  });

  it("matches arg names and help text", () => {
    const byArg = spec.search("passthrough", { limit: 50 }).map((h) => h.spec.code);
    expect(byArg).toContain(130);
    const withHelp = spec.actions.find((a) => a.help)!;
    const word = withHelp.help!.split(/\s+/).find((w) => /^[a-z]{6,}$/i.test(w))!;
    expect(spec.search(word, { limit: 500 }).length).toBeGreaterThan(0);
  });

  it("prefix matches", () => {
    expect(spec.search("vari", { limit: 5 }).every((h) => h.score > 0)).toBe(true);
    expect(spec.search("passth", { limit: 50 }).map((h) => h.spec.code)).toContain(130);
  });

  it("respects limit and category by name or code", () => {
    expect(spec.search("set", { limit: 3 })).toHaveLength(3);
    const task = spec.search("", { category: "task", limit: 500 });
    expect(task.length).toBeGreaterThan(0);
    expect(task.every((h) => h.spec.categoryCode === 105)).toBe(true);
    expect(spec.search("", { category: 105, limit: 500 })).toHaveLength(task.length);
    expect(spec.search("", { category: "105", limit: 500 })).toHaveLength(task.length);
    expect(spec.search("", { category: "", limit: 1 })).toHaveLength(1);
    expect(spec.search("wait", { category: "nonexistent" })).toEqual([]);
  });

  it("scores category name tokens", () => {
    const hits = spec.search("zoom", { limit: 100 });
    expect(hits.some((h) => h.category === "Zoom")).toBe(true);
  });
});

describe("categories and names", () => {
  it("categories() counts every action", () => {
    const cats = spec.categories();
    expect(cats.reduce((n, c) => n + c.count, 0)).toBe(418);
    expect(cats.find((c) => c.name === "Task")?.count).toBeGreaterThan(5);
    expect(cats.find((c) => c.code === 140)).toEqual({ code: 140, name: "Category 140", count: 1 });
  });

  it("event and state names", () => {
    expect(spec.eventName(2089)).toBe("HTTP Request");
    expect(spec.eventName(599)).toBe("Intent Received");
    expect(spec.eventName(1000)).toBe("Display Unlocked");
    expect(spec.eventName(-1)).toBeUndefined();
    expect(spec.stateName(3)).toBe("BT Connected");
    expect(spec.stateName(-1)).toBeUndefined();
    expect(spec.extraActionName(1000)).toBe("Plugin");
  });

  it("isPlugin", () => {
    expect(spec.isPlugin(1000)).toBe(true);
    expect(spec.isPlugin(107361459)).toBe(true);
    expect(spec.isPlugin(11820)).toBe(true);
    expect(spec.isPlugin(999)).toBe(false);
    expect(spec.isPlugin(130)).toBe(false);
  });

  it("works without extras and tolerates actions missing a category", () => {
    const table: SpecTable = {
      meta: { generated: "x", sources: [] },
      categories: [{ code: 1, name: "One" }],
      actions: [
        { code: 5, name: "Alpha", args: [] },
        { code: 6, name: "Beta", categoryCode: 1, args: [] },
        { code: 2000, name: "Big", args: [] },
      ],
    };
    const idx = new SpecIndex(table);
    expect(idx.categories()).toEqual([{ code: 1, name: "One", count: 1 }]);
    expect(idx.eventName(1)).toBeUndefined();
    expect(idx.isPlugin(2000)).toBe(false);
    expect(idx.search("alpha")[0]?.category).toBeUndefined();
  });
});
