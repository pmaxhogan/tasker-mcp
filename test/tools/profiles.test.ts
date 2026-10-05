import { afterEach, describe, expect, it } from "vitest";
import { TaskerHttpError } from "../../src/client/index.ts";
import { PERSIST_HINT } from "../../src/tools/persist.ts";
import { register } from "../../src/tools/profiles.ts";
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

describe("set_profile_enabled", () => {
  it("toggles a profile", async () => {
    await setup();
    const r = await t.call("set_profile_enabled", { name: "TaskerMCP HTTP", enabled: false });
    expect(r.json).toEqual({
      ok: true,
      name: "TaskerMCP HTTP",
      enabled: false,
      persisted: false,
      persistHint: PERSIST_HINT,
    });
    expect(fc.phone.calls.at(-1)).toEqual({
      route: "/profile",
      body: { name: "TaskerMCP HTTP", enabled: false },
    });
  });

  it("turns a 404 into a list_profiles hint", async () => {
    await setup();
    const r = await t.call("set_profile_enabled", { name: "Nope", enabled: true });
    expect(r.isError).toBe(true);
    expect(r.text).toBe('No profile named "Nope"; use list_profiles to see the exact names');
  });

  it("passes other errors through", async () => {
    await setup();
    fc.phone.setProfileEnabled = async () => {
      throw new TaskerHttpError({ status: 500, route: "/profile", body: "", hint: "boom" });
    };
    const r = await t.call("set_profile_enabled", { name: "X", enabled: true });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/HTTP 500: boom/);
  });

  it("respects the write policy", async () => {
    await setup({ policy: { allowPrefixes: ["TaskerMCP.Test"], allowConfigImport: false } });
    const r = await t.call("set_profile_enabled", { name: "TaskerMCP HTTP", enabled: false });
    expect(r.isError).toBe(true);
    expect(fc.phone.routes()).not.toContain("/profile");
  });
});

describe("send_command", () => {
  it("sends the command", async () => {
    await setup();
    const r = await t.call("send_command", { command: "mytag=:=payload" });
    expect(r.json).toEqual({ ok: true, command: "mytag=:=payload" });
    expect(fc.phone.calls.at(-1)).toEqual({
      route: "/command",
      body: { command: "mytag=:=payload" },
    });
  });
});
