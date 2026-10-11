import { afterEach, describe, expect, it } from "vitest";
import { globalName, register } from "../../src/tools/variables.ts";
import {
  connectTools,
  createFakeContext,
  type FakeContext,
  type FakeContextOptions,
  type ToolHarness,
} from "./fake-context.ts";

let fc: FakeContext;
let t: ToolHarness;

async function setup(opts: FakeContextOptions = {}): Promise<void> {
  fc = await createFakeContext(opts);
  t = await connectTools(fc.ctx, [register]);
}

afterEach(async () => {
  await t?.close();
  t = undefined as unknown as ToolHarness;
  await fc?.cleanup();
  fc = undefined as unknown as FakeContext;
});

describe("globalName", () => {
  it("strips % and validates", () => {
    expect(globalName("%MyVar")).toBe("MyVar");
    expect(globalName(" lower ")).toBe("lower");
    expect(() => globalName("1bad")).toThrow(/Invalid variable name/);
    expect(() => globalName("lower", true)).toThrow(/not a global/);
  });
});

describe("variable tools", () => {
  it("get_global reads set and unset globals", async () => {
    await setup();
    fc.phone.globals.set("MyVar", "hello");
    const hit = await t.call("get_global", { name: "%MyVar" });
    expect(hit.isError).toBe(false);
    expect(hit.json).toEqual({ name: "MyVar", value: "hello", set: true });
    expect(fc.phone.calls.at(-1)).toEqual({ route: "/vars/get", body: { name: "MyVar" } });
    const miss = await t.call("get_global", { name: "Other" });
    expect(miss.json).toMatchObject({ set: false });
  });

  it("get_global rejects bad names with a hint", async () => {
    await setup();
    const r = await t.call("get_global", { name: "a b" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/Invalid variable name.*; use letters/);
  });

  it("set_global writes and list_globals lists", async () => {
    await setup();
    const r = await t.call("set_global", { name: "MCPTestVar", value: "42" });
    expect(r.json).toEqual({ ok: true, name: "MCPTestVar", value: "42" });
    expect(fc.phone.globals.get("MCPTestVar")).toBe("42");
    fc.phone.globals.set("Alpha", "1");
    const l = await t.call("list_globals");
    expect(l.json).toEqual({ count: 2, globals: ["Alpha", "MCPTestVar"] });
  });

  it("set_global refuses local names and policy violations", async () => {
    await setup({ policy: { allowPrefixes: ["TaskerMCP.Test"], allowConfigImport: false } });
    const lower = await t.call("set_global", { name: "lower", value: "x" });
    expect(lower.isError).toBe(true);
    expect(lower.text).toMatch(/upper case/);
    const denied = await t.call("set_global", { name: "Other", value: "x" });
    expect(denied.isError).toBe(true);
    expect(fc.phone.globals.has("Other")).toBe(false);
  });
});
