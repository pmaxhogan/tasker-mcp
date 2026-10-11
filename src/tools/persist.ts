/**
 * persist_config: save Tasker's running configuration to disk.
 *
 * Tasker keeps two copies of its configuration (verified on 6.6.20). "Active"
 * is the running service's copy, and Import Data (everything tasker-mcp does)
 * changes only that. "Passive" is the editor's copy, loaded from disk when the
 * editor opens, and the only copy ever saved: leaving the editor writes it
 * only when the editor is dirty. So a change made over the API is lost when
 * Tasker restarts, and an editor save made before persisting overwrites it.
 *
 * The fix, driven over adb:
 * 1. GET /backup: the phone project's Data Backup writes Active to
 *    /sdcard/Tasker/configs/user/tasker-mcp-live.xml.
 * 2. Open the editor fresh (CLEAR_TASK), menu > Data > Restore > User Local
 *    Backup > tasker-mcp-live > OK. The editor now holds the live data and is
 *    dirty; Back leaves it and Tasker saves (logcat: "saveData: ok: true").
 * 3. Wait for /ping (the restore may restart the monitor), then read /backup
 *    again and check nothing changed.
 */
import { UiDriver, type UiNode } from "../device/ui.ts";
import type { TaskerDoc } from "../model/document.ts";
import { handler, ok, ToolError, type RegisterTools, type ToolContext } from "./context.ts";
import { exclusive } from "./lock.ts";
import { CONFIG_RESTART_TIMEOUT_MS } from "./runtime.ts";

export const PERSIST_HINT =
  "changes are live in Tasker's running configuration only; call persist_config to save them to disk (opening Tasker's editor and saving before that discards them)";

/** What to do by hand when persist_config cannot. */
export const MANUAL_STEPS =
  "Tasker > menu > Data > Restore > User Local Backup > tasker-mcp-live > OK, then press Back";

/** File name (without .xml) the phone project's /backup writes, as the Restore picker lists it. */
export const LIVE_BACKUP_NAME = "tasker-mcp-live";
export const TASKER_PACKAGE = "net.dinglisch.android.taskerm";
const TASKER_ACTIVITY = `${TASKER_PACKAGE}/.Tasker`;
/** FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TASK: never reuse a stale editor. */
const CLEAR_TASK_FLAGS = "0x10008000";

export interface PersistTiming {
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  /** UI poll interval. */
  pollMs: number;
  /** Pause after each tap or key. */
  settleMs: number;
  /** How long each GUI step may take to show its screen. */
  stepTimeoutMs: number;
  /** How long to look for Tasker's save lines in logcat. */
  logTimeoutMs: number;
  /** How long to wait for /ping and a readable /backup afterwards. */
  restartTimeoutMs: number;
  pingIntervalMs: number;
}

/**
 * Timing defaults. Mutable so tests can make sleeps instant for the
 * auto-persist path, which calls persistConfig without options.
 */
export const persistDefaults: PersistTiming = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
  pollMs: 500,
  settleMs: 400,
  stepTimeoutMs: 15_000,
  logTimeoutMs: 6_000,
  restartTimeoutMs: CONFIG_RESTART_TIMEOUT_MS,
  pingIntervalMs: 500,
};

export interface PersistOutcome {
  persisted: true;
  durationMs: number;
  warnings: string[];
}

/** True when persist can run at all: config writes allowed and an adb serial known. */
export async function canPersist(ctx: ToolContext): Promise<boolean> {
  if (!ctx.policy.allowConfigImport) return false;
  try {
    return (await ctx.serial()) !== undefined;
  } catch {
    return false;
  }
}

const manual = (prefix: string): string => `${prefix}do it on the phone: ${MANUAL_STEPS}`;

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Drive the editor through Data > Restore > tasker-mcp-live and save on Back. */
async function restoreInEditor(ui: UiDriver, t: PersistTiming): Promise<void> {
  const nag = (nodes: UiNode[]): Promise<boolean> => ui.dismissNag(nodes);
  await ui.shell("am", "start", "-n", TASKER_ACTIVITY, "-f", CLEAR_TASK_FLAGS);
  await ui.tapNode(await ui.waitFor("desc:More options", t.stepTimeoutMs, nag));
  await ui.tapNode(await ui.waitFor("text=Data", t.stepTimeoutMs, nag));
  await ui.tapNode(await ui.waitFor("text=Restore", t.stepTimeoutMs));
  await ui.tapNode(await ui.waitFor("text=User Local Backup", t.stepTimeoutMs));
  // Exactly this file: tapping any other backup would replace the live configuration.
  const entry = await ui.waitFor(
    (n) => n.id.endsWith(":id/name") && n.text === LIVE_BACKUP_NAME,
    t.stepTimeoutMs,
  );
  await ui.tapNode(entry);
  await ui.waitFor("overwrite existing data", t.stepTimeoutMs);
  const nodes = ui.lastDump;
  const okBtn =
    nodes.find((n) => n.id === "android:id/button1") ?? nodes.find((n) => n.text === "OK");
  if (okBtn === undefined) throw new Error("the restore confirmation has no OK button");
  await ui.tapNode(okBtn);
  // The editor marks itself dirty after a restore and offers Apply; without it Back saves nothing.
  await ui.waitFor("desc:Apply", t.stepTimeoutMs);
  await ui.key("BACK");
  await ui.key("HOME");
}

/** Best effort: leave the editor (Back saves only when dirty) and go home. */
async function bailOut(ui: UiDriver): Promise<void> {
  for (const k of ["BACK", "BACK", "BACK", "HOME"]) {
    try {
      await ui.key(k);
    } catch {
      return;
    }
  }
}

export type SaveLog = "saved" | "failed" | "not-dirty" | "unknown";

/** Classify Tasker's editor-exit lines: "EXIT: ... dirty: X" and "saveData: ok: X". */
export function classifySaveLog(log: string): SaveLog {
  if (/saveData: ok: false/.test(log)) return "failed";
  if (/saveData: ok: true/.test(log)) return "saved";
  if (/EXIT:.*?\bdirty: false/.test(log)) return "not-dirty";
  return "unknown";
}

async function waitForSaveLog(ui: UiDriver, since: string, t: PersistTiming): Promise<SaveLog> {
  const end = t.now() + t.logTimeoutMs;
  for (;;) {
    let state: SaveLog = "unknown";
    try {
      state = classifySaveLog(await ui.shell("logcat", "-d", "-v", "brief", "-T", since));
    } catch {
      // logcat is a confirmation only; the /backup check below still runs.
    }
    if (state !== "unknown" || t.now() >= end) return state;
    await t.sleep(t.pollMs);
  }
}

/** Names that must be the same before and after: tasks, profiles, projects, scenes. */
export function compareConfigs(before: TaskerDoc, after: TaskerDoc): string[] {
  const a = before.summary();
  const b = after.summary();
  const lists: Array<[string, string[], string[]]> = [
    ["task", a.tasks.map((x) => x.name), b.tasks.map((x) => x.name)],
    ["profile", a.profiles.map((x) => x.name), b.profiles.map((x) => x.name)],
    ["project", a.projects.map((x) => x.name), b.projects.map((x) => x.name)],
    ["scene", a.scenes.map((x) => x.name), b.scenes.map((x) => x.name)],
  ];
  const out: string[] = [];
  for (const [kind, x, y] of lists) {
    const missing = x.filter((n) => !y.includes(n));
    const extra = y.filter((n) => !x.includes(n));
    if (missing.length > 0) out.push(`${kind}s missing: ${missing.join(", ")}`);
    if (extra.length > 0) out.push(`unexpected ${kind}s: ${extra.join(", ")}`);
  }
  return out;
}

async function backupWithRetry(
  ctx: ToolContext,
  t: PersistTiming,
): Promise<{ xml: string; doc: TaskerDoc }> {
  const end = t.now() + t.restartTimeoutMs;
  for (;;) {
    try {
      return await ctx.backup();
    } catch (e) {
      if (t.now() >= end) throw e;
      await t.sleep(t.pingIntervalMs);
    }
  }
}

/**
 * Save the running configuration to disk. See the module doc. Holds the
 * mutation lock. Throws a ToolError with the manual steps when it cannot.
 */
export async function persistConfig(
  ctx: ToolContext,
  opts: Partial<PersistTiming> = {},
): Promise<PersistOutcome> {
  const t: PersistTiming = { ...persistDefaults, ...opts };
  try {
    ctx.assertWritable("config", "persist_config");
  } catch (e) {
    throw new ToolError(
      `persist_config is refused by the write policy: ${msg(e)}`,
      manual("restoring the whole configuration is a config write; "),
    );
  }
  const serial = await ctx.serial();
  if (serial === undefined) {
    throw new ToolError(
      "persist_config needs adb to drive Tasker's editor, and no adb device is configured",
      manual("set TASKER_ADB_SERIAL (or leave TASKER_URL unset), or "),
    );
  }
  return exclusive(async () => {
    const start = t.now();
    const ui = new UiDriver({
      exec: ctx.exec,
      adbPath: ctx.config.adbPath,
      serial,
      sleep: t.sleep,
      now: t.now,
      pollMs: t.pollMs,
      settleMs: t.settleMs,
    });
    const screen = await ui.screenState();
    if (screen.locked || screen.asleep) {
      throw new ToolError(
        `The phone's screen is ${screen.locked ? "locked" : "off"}; persist_config drives Tasker's editor and never unlocks the phone`,
        manual("unlock it and call persist_config again, or "),
      );
    }
    const since = `${(await ui.shell("date", "+%s")).trim()}.000`;
    // Rewrites tasker-mcp-live.xml with the live configuration.
    const before = await ctx.backup();
    try {
      await restoreInEditor(ui, t);
    } catch (e) {
      await bailOut(ui);
      throw new ToolError(`persist_config could not drive Tasker's editor: ${msg(e)}`, manual(""));
    }
    const warnings: string[] = [];
    const save = await waitForSaveLog(ui, since, t);
    if (save === "failed") {
      throw new ToolError("Tasker reported that saving its configuration failed", manual(""));
    }
    if (save === "not-dirty") {
      throw new ToolError(
        "Tasker left the editor without saving (the restore did not mark it changed)",
        manual(""),
      );
    }
    if (save === "unknown") {
      warnings.push(
        "Tasker's save was not confirmed in logcat; the configuration was re-read instead",
      );
    }
    const client = await ctx.client();
    await client.waitForPing({ timeoutMs: t.restartTimeoutMs, intervalMs: t.pingIntervalMs });
    const after = await backupWithRetry(ctx, t);
    const diff = compareConfigs(before.doc, after.doc);
    if (diff.length > 0) {
      const info = await ctx.snapshots.save(before.xml, {
        label: "before persist_config (verify failed)",
        tool: "persist_config",
        device: serial,
      });
      throw new ToolError(
        `After persist_config Tasker's configuration differs from before: ${diff.join("; ")}`,
        `restore_snapshot {"id": "${info.id}"} puts the previous configuration back`,
      );
    }
    return { persisted: true, durationMs: t.now() - start, warnings };
  });
}

export const register: RegisterTools = (server, ctx) => {
  server.registerTool(
    "persist_config",
    {
      title: "Persist configuration",
      description:
        "Save Tasker's running configuration to disk so changes survive a Tasker restart or reboot. " +
        "Tasker only writes its configuration when its own editor saves, so every change made through tasker-mcp is live but unsaved until this runs (and saving in the editor first discards it). " +
        "It drives Tasker's editor over adb (Data > Restore > tasker-mcp-live, then Back to save), then re-reads the configuration to check it. " +
        "Needs adb and an unlocked, awake screen; takes about 25 seconds. Call it once after a batch of changes. " +
        "Example: persist_config {}",
      inputSchema: {},
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    handler(async () => {
      const r = await persistConfig(ctx);
      return ok(
        r.warnings.length > 0
          ? { persisted: true, durationMs: r.durationMs, warnings: r.warnings }
          : { persisted: true, durationMs: r.durationMs },
      );
    }),
  );
};
