import { afterEach, describe, expect, it } from "vitest";
import type { Exec } from "../../src/adb.ts";
import { TaskerHttpError } from "../../src/client/index.ts";
import {
  ADB_HINT,
  REDACTED,
  makeRedactor,
  redactLines,
  register,
  secretsFor,
} from "../../src/tools/logs.ts";
import {
  connectTools,
  createFakeContext,
  type FakeContext,
  type FakeContextOptions,
  type ToolHarness,
} from "./fake-context.ts";

const TOKEN = "0123456789abcdef0123456789abcdef" + "fedcba9876543210fedcba9876543210"; // gitleaks:allow (synthetic test token)
const UUID1 = "01234567-89ab-cdef-0123-456789abcdef";
const UUID2 = "fedcba98-7654-3210-fedc-ba9876543210";
const OTHER64 = "a".repeat(64);

function line(msg: string, tag = "Tasker"): string {
  return `10-04 12:00:00.000 I/${tag}(  123): ${msg}`;
}

interface ExecLog {
  calls: string[][];
}

function fakeExec(stdout: string, devices = "List of devices attached\nemulator-5554 device\n") {
  const log: ExecLog = { calls: [] };
  const exec: Exec = async (_file, args) => {
    log.calls.push(args);
    if (args[0] === "devices") return { stdout: devices, stderr: "", code: 0 };
    return { stdout, stderr: "", code: 0 };
  };
  return { exec, log };
}

let fc: FakeContext;
let t: ToolHarness;

async function setup(opts: FakeContextOptions = {}): Promise<void> {
  fc = await createFakeContext({ ...opts, config: { token: TOKEN, ...opts.config } });
  t = await connectTools(fc.ctx, [register]);
}

afterEach(async () => {
  await t?.close();
  t = undefined as unknown as ToolHarness;
  await fc?.cleanup();
  fc = undefined as unknown as FakeContext;
});

describe("redaction", () => {
  it("derives the token, its halves and their UUID forms", () => {
    expect(secretsFor(undefined)).toEqual([]);
    expect(secretsFor("  ")).toEqual([]);
    expect(secretsFor("short-token")).toEqual(["short-token"]);
    expect(secretsFor(TOKEN)).toEqual([TOKEN, UUID1, TOKEN.slice(0, 32), UUID2, TOKEN.slice(32)]);
  });

  it("removes the known token anywhere, case-insensitively", () => {
    const r = makeRedactor(TOKEN);
    expect(r(`x ${TOKEN.toUpperCase()} y`, false)).toBe(`x ${REDACTED} y`);
    expect(r(`uuid ${UUID1} and ${UUID2}`, false)).toBe(`uuid ${REDACTED} and ${REDACTED}`);
    expect(r(`plain ${OTHER64}`, false)).toBe(`plain ${OTHER64}`);
    expect(makeRedactor(undefined)("nothing", false)).toBe("nothing");
  });

  it("removes unknown 64-hex values and UUIDs next to a token mention", () => {
    const lines = [
      "unrelated " + OTHER64,
      "gap",
      "Variable Set %TaskerMCP_Token",
      "value " + OTHER64,
      "%mcp_uuid1 = 11111111-2222-3333-4444-555555555555",
      "far away " + "b".repeat(32),
      "later " + "c".repeat(64),
    ];
    const out = redactLines(lines, undefined);
    expect(out[0]).toContain(OTHER64);
    expect(out[3]).toBe(`value ${REDACTED}`);
    expect(out[4]).toBe(`%mcp_uuid1 = ${REDACTED}`);
    expect(out[5]).toBe(`far away ${REDACTED}`);
    expect(out[6]).toContain("c".repeat(64));
  });
});

describe("get_logcat", () => {
  it("returns redacted Tasker lines, filtered and limited", async () => {
    const stdout = [
      "--------- beginning of main",
      line("Setup: %TaskerMCP_Token set to " + TOKEN),
      line("uuid " + UUID1, "TaskerAction"),
      line("run MyTask"),
      line("not tasker", "ActivityManager"),
      line("run MyTask again"),
    ].join("\n");
    const { exec, log } = fakeExec(stdout);
    await setup({ exec, config: { adbSerial: "emulator-5554" } });
    const r = await t.call("get_logcat", { seconds: 30 });
    expect(r.isError).toBe(false);
    expect(r.json.count).toBe(4);
    expect(r.text).not.toContain(TOKEN);
    expect(r.text).not.toContain(UUID1);
    expect(r.text).toContain(REDACTED);
    const args = log.calls.at(-1) as string[];
    expect(args.slice(0, 3)).toEqual(["-s", "emulator-5554", "logcat"]);

    const f = await t.call("get_logcat", { filter: "mytask", lines: 1 });
    expect(f.json).toEqual({ count: 1, lines: [line("run MyTask again")] });
  });

  it("does not let a filter probe the token", async () => {
    const { exec } = fakeExec(line("token " + TOKEN));
    await setup({ exec, config: { adbSerial: "emulator-5554" } });
    const r = await t.call("get_logcat", { filter: TOKEN.slice(0, 10) });
    expect(r.json.count).toBe(0);
  });

  it("picks the only adb device when no serial is configured", async () => {
    const { exec, log } = fakeExec("");
    await setup({ exec });
    const r = await t.call("get_logcat");
    expect(r.json.count).toBe(0);
    expect(r.json.note).toMatch(/Debug To System Log/);
    expect(log.calls[0]).toEqual(["devices", "-l"]);
    expect(log.calls[1]?.slice(0, 2)).toEqual(["-s", "emulator-5554"]);
  });

  it("fails with the adb hint when there is no device", async () => {
    const { exec } = fakeExec("", "List of devices attached\n\n");
    await setup({ exec });
    const r = await t.call("get_logcat");
    expect(r.isError).toBe(true);
    expect(r.text).toContain("No adb devices found.");
    expect(r.text.endsWith(ADB_HINT)).toBe(true);
  });

  it("passes non-adb errors through", async () => {
    const exec: Exec = async () => {
      throw new Error("spawn exploded");
    };
    await setup({ exec, config: { adbSerial: "emulator-5554" } });
    const r = await t.call("get_logcat");
    expect(r.isError).toBe(true);
    expect(r.text).toBe("spawn exploded");
  });
});

describe("get_run_log", () => {
  it("explains the 501", async () => {
    await setup();
    const r = await t.call("get_run_log");
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/Tasker has no action that exports it; use get_logcat/);
  });

  it("returns a run log if the phone ever sends one, redacted", async () => {
    await setup();
    fc.phone.runLog = async () => `line one\ntoken ${TOKEN}`;
    const r = await t.call("get_run_log");
    expect(r.json).toEqual({ runLog: `line one\ntoken ${REDACTED}` });
  });

  it("passes other errors through", async () => {
    await setup();
    fc.phone.runLog = async () => {
      throw new TaskerHttpError({ status: 500, route: "/runlog", body: "", hint: "boom" });
    };
    const r = await t.call("get_run_log");
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/HTTP 500/);
  });
});
