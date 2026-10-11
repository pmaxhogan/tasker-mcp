import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TaskerDoc } from "../../src/model/document.ts";
import { exclusive } from "../../src/tools/mutate.ts";
import {
  canPersist,
  classifySaveLog,
  compareConfigs,
  MANUAL_STEPS,
  PERSIST_HINT,
  persistConfig,
  persistDefaults,
  type PersistTiming,
} from "../../src/tools/persist.ts";
import { FakeAndroid, fakeTiming } from "./fake-android.ts";
import {
  connectTools,
  createFakeContext,
  EMPTY_BACKUP,
  type FakeContext,
  type FakeContextOptions,
  type ToolHarness,
} from "./fake-context.ts";

const SERIAL = "emulator-5554";
const TASK_XML = (name: string): string =>
  `<TaskerData sr="" dvi="1" tv="6.6.20"><Task sr="task1"><id>1</id><nme>${name}</nme><Action sr="act0" ve="7"><code>548</code><Str sr="arg0" ve="3">hi</Str><Int sr="arg1" val="0"/></Action></Task></TaskerData>`;

let fc: FakeContext | undefined;
let t: ToolHarness | undefined;
let android: FakeAndroid;
const savedDefaults: PersistTiming = { ...persistDefaults };

beforeEach(() => {
  android = new FakeAndroid();
  // The auto-persist path calls persistConfig without options: make it instant.
  const ft = fakeTiming();
  Object.assign(persistDefaults, { sleep: ft.sleep, now: ft.now });
});

afterEach(async () => {
  Object.assign(persistDefaults, savedDefaults);
  await t?.close();
  await fc?.cleanup();
  t = undefined;
  fc = undefined;
});

async function setup(
  opts: FakeContextOptions & { autoPersist?: boolean; serial?: string | null } = {},
): Promise<FakeContext> {
  const serial = opts.serial === null ? undefined : (opts.serial ?? SERIAL);
  fc = await createFakeContext({
    exec: android.exec,
    ...opts,
    config: { adbSerial: serial, autoPersist: opts.autoPersist ?? false, ...opts.config },
  });
  t = await connectTools(fc.ctx);
  return fc;
}

function timing(): Partial<PersistTiming> {
  const ft = fakeTiming();
  return { sleep: ft.sleep, now: ft.now };
}

describe("persistConfig", () => {
  it("restores tasker-mcp-live in the editor, saves on Back, and verifies", async () => {
    const { ctx, phone } = await setup();
    const r = await persistConfig(ctx, timing());
    expect(r).toEqual({ persisted: true, durationMs: expect.any(Number), warnings: [] });
    expect(android.picked).toBe("tasker-mcp-live");
    expect(android.screen).toBe("home");
    const cmds = android.commands();
    expect(cmds).toContain("shell am start -n net.dinglisch.android.taskerm/.Tasker -f 0x10008000");
    expect(cmds.filter((c) => c.startsWith("shell input keyevent"))).toEqual([
      "shell input keyevent KEYCODE_BACK",
      "shell input keyevent KEYCODE_HOME",
    ]);
    expect(cmds).toContain("shell logcat -d -v brief -T 1791167655.000");
    // Screen check comes first, before anything is touched.
    expect(cmds.slice(0, 2)).toEqual(["shell dumpsys window", "shell dumpsys power"]);
    // /backup refreshes the file before the GUI, and is read again to verify.
    expect(phone.routes()).toEqual(["/backup", "/ping", "/backup"]);
  });

  it("dismisses a nag dialog on the way", async () => {
    android.nagOnStart = true;
    const { ctx } = await setup();
    await persistConfig(ctx, timing());
    expect(android.picked).toBe("tasker-mcp-live");
  });

  it("refuses without adb, with the manual steps", async () => {
    const { ctx } = await setup({ serial: null });
    const e = await persistConfig(ctx, timing()).catch((x: unknown) => x);
    expect((e as Error).message).toMatch(/needs adb/);
    expect((e as { hint: string }).hint).toContain(MANUAL_STEPS);
    expect(android.calls).toEqual([]);
  });

  it("refuses under a write policy without config imports, with the manual steps", async () => {
    const { ctx } = await setup({ policy: { allowPrefixes: ["X."], allowConfigImport: false } });
    const e = await persistConfig(ctx, timing()).catch((x: unknown) => x);
    expect((e as Error).message).toMatch(/refused by the write policy/);
    expect((e as { hint: string }).hint).toContain(MANUAL_STEPS);
    expect(android.calls).toEqual([]);
  });

  it.each([
    ["locked", "isKeyguardShowing=true", "mWakefulness=Awake"],
    ["locked", "mDreamingLockscreen=true", "mWakefulness=Awake"],
    ["off", "isKeyguardShowing=false", "mWakefulness=Asleep"],
  ])("never unlocks: a %s screen fails with the manual steps", async (word, win, power) => {
    android.windowDump = win;
    android.powerDump = power;
    const { ctx, phone } = await setup();
    const e = await persistConfig(ctx, timing()).catch((x: unknown) => x);
    expect((e as Error).message).toContain(`screen is ${word}`);
    expect((e as { hint: string }).hint).toContain(MANUAL_STEPS);
    expect(android.commands().some((c) => c.includes("am start"))).toBe(false);
    expect(phone.routes()).toEqual([]);
  });

  it("never taps another backup: a picker without tasker-mcp-live fails and backs out", async () => {
    android.overrides["05-picker"] = android
      .xml("05-picker")
      .replace('text="tasker-mcp-live"', 'text="something-else"');
    const { ctx } = await setup();
    const e = await persistConfig(ctx, { ...timing(), stepTimeoutMs: 2000 }).catch(
      (x: unknown) => x,
    );
    expect((e as Error).message).toMatch(/could not drive Tasker's editor: timed out/);
    expect((e as { hint: string }).hint).toContain(MANUAL_STEPS);
    expect(android.picked).toBeUndefined();
    expect(android.commands().slice(-4)).toEqual([
      "shell input keyevent KEYCODE_BACK",
      "shell input keyevent KEYCODE_BACK",
      "shell input keyevent KEYCODE_BACK",
      "shell input keyevent KEYCODE_HOME",
    ]);
  });

  it("fails when the confirmation has no OK button", async () => {
    android.overrides["06-confirm"] =
      `<node text="This will overwrite existing data." bounds="[0,0][9,9]"/>`;
    const { ctx } = await setup();
    await expect(persistConfig(ctx, timing())).rejects.toThrow(/has no OK button/);
  });

  it("bails out quietly even when adb dies mid-way", async () => {
    android.overrides["05-picker"] = `<node text="empty" bounds="[0,0][9,9]"/>`;
    const { ctx } = await setup();
    const p = persistConfig(ctx, { ...timing(), stepTimeoutMs: 0 });
    android.failOn = { match: "keyevent", code: 1 };
    await expect(p).rejects.toThrow(/could not drive Tasker's editor/);
  });

  it("fails when Tasker reports the save failed", async () => {
    android.saveLog = "D/Tasker: saveData: ok: false: pCount: 2\n";
    const { ctx } = await setup();
    await expect(persistConfig(ctx, timing())).rejects.toThrow(/saving its configuration failed/);
  });

  it("fails when the editor left without saving", async () => {
    android.saveLog = "D/Tasker: T: EXIT: from back: save: true dirty: false must save: false\n";
    const { ctx } = await setup();
    await expect(persistConfig(ctx, timing())).rejects.toThrow(/without saving/);
  });

  it("warns when logcat shows nothing (or fails) but the re-read matches", async () => {
    android.saveLog = "";
    const { ctx } = await setup();
    const r = await persistConfig(ctx, { ...timing(), logTimeoutMs: 1000 });
    expect(r.warnings).toEqual([expect.stringMatching(/not confirmed in logcat/)]);
    android.failOn = { match: "logcat", code: 1 };
    const r2 = await persistConfig(ctx, { ...timing(), logTimeoutMs: 0 });
    expect(r2.warnings).toHaveLength(1);
  });

  it("retries the verify read while Tasker restarts", async () => {
    const { ctx, phone } = await setup();
    let failures = 2;
    const real = phone.backup.bind(phone);
    android.onSave = () => {
      phone.backup = async () => {
        if (failures-- > 0) throw new Error("ECONNRESET");
        return real();
      };
    };
    const r = await persistConfig(ctx, timing());
    expect(r.persisted).toBe(true);
    expect(failures).toBe(-1);
  });

  it("gives up on the verify read after the restart timeout", async () => {
    const { ctx, phone } = await setup();
    android.onSave = () => {
      phone.backup = async () => {
        throw new Error("ECONNRESET");
      };
    };
    await expect(
      persistConfig(ctx, { ...timing(), restartTimeoutMs: 1000, pingIntervalMs: 400 }),
    ).rejects.toThrow(/ECONNRESET/);
  });

  it("fails loudly with a snapshot when the configuration changed", async () => {
    const { ctx, phone } = await setup();
    android.onSave = () => {
      phone.doc = TaskerDoc.parse(EMPTY_BACKUP);
    };
    const e = await persistConfig(ctx, timing()).catch((x: unknown) => x);
    expect((e as Error).message).toMatch(/differs from before: tasks missing: MCP\.T1/);
    expect((e as { hint: string }).hint).toMatch(
      /restore_snapshot \{"id": "[^"]+before-persist[^"]*"\} puts/,
    );
    const snaps = await ctx.snapshots.list();
    expect(snaps.map((s) => s.tool)).toContain("persist_config");
  });

  it("holds the mutation lock", async () => {
    const { ctx } = await setup();
    const order: string[] = [];
    let release!: () => void;
    const blocker = exclusive(
      () =>
        new Promise<void>((r) => {
          release = () => {
            order.push("mutation done");
            r();
          };
        }),
    );
    const p = persistConfig(ctx, timing()).then(() => order.push("persist done"));
    await new Promise((r) => setTimeout(r, 5));
    expect(android.calls).toEqual([]);
    release();
    await Promise.all([blocker, p]);
    expect(order).toEqual(["mutation done", "persist done"]);
  });
});

describe("helpers", () => {
  it("the default timing uses the real clock", async () => {
    const start = savedDefaults.now();
    await savedDefaults.sleep(5);
    expect(savedDefaults.now() - start).toBeGreaterThanOrEqual(4);
  });

  it("classifySaveLog", () => {
    expect(classifySaveLog("saveData: ok: true")).toBe("saved");
    expect(classifySaveLog("EXIT: x dirty: true\nsaveData: ok: false")).toBe("failed");
    expect(classifySaveLog("T: EXIT: from back: save: true dirty: false")).toBe("not-dirty");
    expect(classifySaveLog("")).toBe("unknown");
  });

  it("compareConfigs reports missing and unexpected names of every kind", () => {
    const a = TaskerDoc.parse(EMPTY_BACKUP);
    const b = TaskerDoc.parse(
      `<TaskerData sr="" dvi="1" tv="6.6.20"><Profile sr="prof2"><id>2</id><nme>P</nme></Profile><Project sr="proj0"><name>Other</name></Project><Scene sr="sceneS"><nme>S</nme></Scene><Task sr="task1"><id>1</id><nme>T</nme></Task></TaskerData>`,
    );
    expect(compareConfigs(a, a)).toEqual([]);
    expect(compareConfigs(a, b)).toEqual([
      "unexpected tasks: T",
      "unexpected profiles: P",
      "projects missing: Base",
      "unexpected projects: Other",
      "unexpected scenes: S",
    ]);
  });

  it("canPersist needs config imports and an adb serial", async () => {
    const { ctx } = await setup();
    expect(await canPersist(ctx)).toBe(true);
    await fc?.cleanup();
    await t?.close();
    const noAdb = await setup({ serial: null });
    expect(await canPersist(noAdb.ctx)).toBe(false);
    await t?.close();
    const confined = await setup({ policy: { allowConfigImport: false } });
    expect(await canPersist(confined.ctx)).toBe(false);
    const broken = {
      ...confined.ctx,
      policy: { allowConfigImport: true },
      serial: async () => {
        throw new Error("no device");
      },
    };
    expect(await canPersist(broken)).toBe(false);
  });
});

describe("persist_config tool", () => {
  it("returns {persisted, durationMs}", async () => {
    await setup();
    const r = await t!.call("persist_config");
    expect(r.isError).toBe(false);
    expect(r.json).toEqual({ persisted: true, durationMs: expect.any(Number) });
  });

  it("passes warnings through", async () => {
    android.saveLog = "";
    Object.assign(persistDefaults, { logTimeoutMs: 0 });
    await setup();
    const r = await t!.call("persist_config");
    expect(r.json.warnings).toHaveLength(1);
  });

  it("fails with the manual steps without adb", async () => {
    await setup({ serial: null });
    const r = await t!.call("persist_config");
    expect(r.isError).toBe(true);
    expect(r.text).toContain(MANUAL_STEPS);
  });
});

describe("persisted on mutating tool results", () => {
  it("reports persisted: false with the hint when auto-persist is off", async () => {
    await setup();
    const r = await t!.call("create_task", {
      name: "MCP.New",
      actions: [{ action: "Flash", args: { Text: "x" } }],
    });
    expect(r.json).toMatchObject({ ok: true, persisted: false, persistHint: PERSIST_HINT });
    const d = await t!.call("delete_task", { name: "MCP.New" });
    expect(d.json).toMatchObject({ ok: true, persisted: false, persistHint: PERSIST_HINT });
    expect(android.calls).toEqual([]);
  });

  it("auto-persists task and config edits", async () => {
    await setup({ autoPersist: true });
    const r = await t!.call("create_task", {
      name: "MCP.New",
      actions: [{ action: "Flash", args: { Text: "x" } }],
    });
    expect(r.json).toMatchObject({ ok: true, persisted: true });
    expect(r.json.persistHint).toBeUndefined();
    expect(android.picked).toBe("tasker-mcp-live");
    android.picked = undefined;
    const d = await t!.call("delete_task", { name: "MCP.New" });
    expect(d.json).toMatchObject({ ok: true, persisted: true, warnings: [] });
    expect(android.picked).toBe("tasker-mcp-live");
  });

  it("reports a failed auto-persist as a warning, not an error", async () => {
    android.windowDump = "isKeyguardShowing=true";
    await setup({ autoPersist: true });
    const r = await t!.call("create_task", {
      name: "MCP.New",
      actions: [{ action: "Flash", args: { Text: "x" } }],
    });
    expect(r.isError).toBe(false);
    expect(r.json).toMatchObject({ ok: true, persisted: false, persistHint: PERSIST_HINT });
    expect(r.json.warnings).toEqual([
      expect.stringMatching(/^auto-persist failed: .*locked.*Tasker > menu > Data > Restore/),
    ]);
  });

  it("skips auto-persist with a warning when there is no adb", async () => {
    await setup({ autoPersist: true, serial: null });
    const r = await t!.call("rename", { kind: "task", from: "MCP.T1", to: "MCP.T2" });
    expect(r.json).toMatchObject({ ok: true, persisted: false, persistHint: PERSIST_HINT });
    expect(r.json.warnings).toEqual([expect.stringMatching(/auto-persist skipped/)]);
  });

  it("persists a multi-task import_xml once", async () => {
    await setup({ autoPersist: true });
    const xml = `<TaskerData sr="" dvi="1" tv="6.6.20"><Task sr="task1"><id>1</id><nme>MCP.A</nme></Task><Task sr="task2"><id>2</id><nme>MCP.B</nme></Task></TaskerData>`;
    const r = await t!.call("import_xml", { xml, validate: false });
    expect(r.json).toMatchObject({ ok: true, persisted: true });
    expect(r.json.results.map((x: { persisted: boolean }) => x.persisted)).toEqual([true, true]);
    const starts = android.commands().filter((c) => c.includes("am start"));
    expect(starts).toHaveLength(1);
  });

  it("a single-task import_xml without auto-persist keeps the hint", async () => {
    await setup();
    const r = await t!.call("import_xml", { xml: TASK_XML("MCP.One") });
    expect(r.json).toMatchObject({ ok: true, persisted: false, persistHint: PERSIST_HINT });
  });

  it("covers profile, project, snapshot and run tools", async () => {
    await setup();
    const prof = await t!.call("create_profile", {
      name: "MCP.P",
      contexts: ['<Time sr="con0"><fh>7</fh></Time>'],
      entryTask: "MCP.T1",
    });
    expect(prof.json).toMatchObject({ persisted: false, persistHint: PERSIST_HINT });
    for (const [tool, args] of [
      ["edit_profile", { name: "MCP.P", set: { enabled: false } }],
      ["edit_profile", { name: "MCP.P", set: { name: "MCP.P2", enabled: true } }],
      ["set_profile_enabled", { name: "MCP.P2", enabled: false }],
      ["move_to_project", { kind: "task", name: "MCP.T1", project: "Other" }],
      ["delete_profile", { name: "MCP.P2" }],
    ] as const) {
      const r = await t!.call(tool, args);
      expect(r.isError, `${tool}: ${r.text}`).toBe(false);
      expect(r.json, tool).toMatchObject({ persisted: false, persistHint: PERSIST_HINT });
    }
    const snaps = await fc!.ctx.snapshots.list();
    const id = snaps.at(-1)?.id as string;
    const cfg = await t!.call("restore_snapshot", { id, mode: "config" });
    expect(cfg.json).toMatchObject({ ok: true, persisted: false, persistHint: PERSIST_HINT });
    const tasks = await t!.call("restore_snapshot", { id, mode: "tasks" });
    expect(tasks.json).toMatchObject({ ok: true, persisted: false, persistHint: PERSIST_HINT });
    // run_actions' scratch task never auto-persists and carries no persist fields.
    const run = await t!.call("run_actions", {
      actions: [{ action: "Flash", args: { Text: "x" } }],
    });
    expect(run.json.persisted).toBeUndefined();
  });

  it("auto-persists restore_snapshot and profile toggles", async () => {
    await setup({ autoPersist: true });
    const snap = await t!.call("snapshot_now", { label: "x" });
    const id = snap.json.snapshot.id as string;
    for (const [tool, args] of [
      ["restore_snapshot", { id, mode: "config" }],
      ["restore_snapshot", { id, mode: "tasks" }],
      ["set_profile_enabled", { name: "TaskerMCP HTTP", enabled: true }],
      ["edit_profile", { name: "TaskerMCP HTTP", set: { enabled: true } }],
    ] as const) {
      const r = await t!.call(tool, args);
      expect(r.json, tool).toMatchObject({ persisted: true });
      expect(r.json.persistHint, tool).toBeUndefined();
    }
    android.windowDump = "isKeyguardShowing=true";
    for (const [tool, args] of [
      ["restore_snapshot", { id, mode: "config" }],
      ["restore_snapshot", { id, mode: "tasks" }],
      ["set_profile_enabled", { name: "TaskerMCP HTTP", enabled: true }],
    ] as const) {
      const r = await t!.call(tool, args);
      expect(r.json, tool).toMatchObject({ persisted: false, warnings: [expect.any(String)] });
    }
  });

  it("restore_snapshot tasks mode that restores nothing does not persist", async () => {
    await setup({ autoPersist: true });
    const snap = await t!.call("snapshot_now", { label: "x" });
    fc!.phone.importXml = async () => {
      throw new Error("nope");
    };
    const r = await t!.call("restore_snapshot", { id: snap.json.snapshot.id, mode: "tasks" });
    expect(r.isError).toBe(true);
    expect(r.json).toMatchObject({ persisted: false, persistHint: PERSIST_HINT });
    expect(android.commands().some((c) => c.includes("am start"))).toBe(false);
  });
});
