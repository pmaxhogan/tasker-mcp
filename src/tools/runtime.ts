/**
 * The production ToolContext: one per server process. Everything expensive
 * (the adb forward, the HTTP client, the spec index) is created lazily on
 * first use so `tasker-mcp` starts instantly and a phone that is not yet
 * connected only fails the tool call that needs it.
 */
import { join } from "node:path";
import { defaultExec, forward, FORWARD_PORT, listDevices, pickDevice, type Exec } from "../adb.ts";
import { TaskerClient } from "../client/index.ts";
import { DEFAULT_URL, type Config } from "../config.ts";
import { DocsStore } from "../docs/index.ts";
import { log } from "../log.ts";
import { TaskerDoc } from "../model/document.ts";
import { SnapshotStore } from "../snapshots.ts";
import { getSpec, type SpecIndex } from "../spec/table.ts";
import {
  ToolError,
  type ObjectKind,
  type Snapshot,
  type ToolContext,
  type WritePolicy,
} from "./context.ts";

export const TOKEN_HINT =
  "set TASKER_TOKEN or --token-file; run the TaskerMCP.Setup task on the phone to get one";

/** How long replaceConfig waits for the phone to answer /ping again. */
export const CONFIG_RESTART_TIMEOUT_MS = 30_000;
export const SNAPSHOT_KEEP = 20;

export interface RuntimeDeps {
  exec?: Exec;
  fetch?: typeof fetch;
  /** Use this client instead of building one (tests). */
  client?: TaskerClient;
  spec?: SpecIndex;
  snapshots?: SnapshotStore;
  docs?: DocsStore;
  /** Poll interval for waitForPing after a config import (default 500 ms). */
  pingIntervalMs?: number;
  onToolsChanged?: () => void;
}

/** A ToolContext whose toolsChanged hook the server wiring sets after connecting. */
export interface RuntimeContext extends ToolContext {
  onToolsChanged(fn: (() => void) | undefined): void;
}

/** Human description of the write policy, for error hints. */
export function describePolicy(policy: WritePolicy): string {
  const parts: string[] = [];
  if (policy.allowPrefixes !== undefined) {
    parts.push(`writes are limited to names starting with ${policy.allowPrefixes.join(", ")}`);
  }
  parts.push(policy.allowConfigImport ? "config imports allowed" : "config imports disabled");
  return parts.join("; ");
}

/**
 * The write-scope check shared by every mutating tool. Pure, so tests and
 * other modules can call it with any policy.
 */
export function checkWritable(policy: WritePolicy, kind: ObjectKind, name: string): void {
  if (kind === "config") {
    if (!policy.allowConfigImport) {
      throw new ToolError(
        `This change needs a whole-configuration import${name ? ` (${name})` : ""}, which is disabled`,
        "set TASKER_ALLOW_CONFIG_IMPORT=true or pass --allow-config-import (pull a Data Backup first on a real phone)",
      );
    }
    return;
  }
  const prefixes = policy.allowPrefixes;
  if (prefixes === undefined) return;
  // Globals are written with or without the leading %; check the bare name.
  const bare = kind === "variable" ? name.replace(/^%/, "") : name;
  const ok = prefixes.some((p) => bare.startsWith(p.replace(/^%/, "")) || name.startsWith(p));
  if (!ok) {
    throw new ToolError(
      `Write to ${kind} "${name}" refused: the write allow list only permits names starting with ${prefixes
        .map((p) => JSON.stringify(p))
        .join(", ")}`,
      "rename the object to an allowed prefix or extend TASKER_WRITE_ALLOW / --write-allow",
    );
  }
}

/** Host part of a URL, for snapshot metadata. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function createToolContext(config: Config, deps: RuntimeDeps = {}): RuntimeContext {
  const exec = deps.exec ?? defaultExec;
  const policy = config.policy;
  let spec = deps.spec;
  let toolsChangedFn = deps.onToolsChanged;
  let clientPromise: Promise<TaskerClient> | undefined;
  let resolvedSerial: string | undefined;
  let resolvedUrl: string | undefined;

  async function connect(): Promise<TaskerClient> {
    if (deps.client !== undefined) {
      resolvedUrl ??= config.url ?? DEFAULT_URL;
      return deps.client;
    }
    if (config.token === undefined) {
      throw new ToolError("No Tasker token configured", TOKEN_HINT);
    }
    let baseUrl = config.url;
    if (baseUrl === undefined || config.autoForward) {
      const devices = await listDevices(exec, config.adbPath);
      const dev = pickDevice(devices, config.adbSerial);
      await forward(exec, config.adbPath, dev.serial, FORWARD_PORT, FORWARD_PORT);
      resolvedSerial = dev.serial;
      baseUrl = DEFAULT_URL;
      log(`adb forward tcp:${FORWARD_PORT} -> ${dev.serial}`);
    }
    resolvedUrl = baseUrl;
    return new TaskerClient({
      baseUrl,
      token: config.token,
      timeoutMs: config.timeoutMs,
      ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
    });
  }

  function client(): Promise<TaskerClient> {
    if (clientPromise === undefined) {
      const p = connect();
      clientPromise = p;
      // A failed connect (no device yet, missing token) must not poison later calls.
      p.catch(() => {
        if (clientPromise === p) clientPromise = undefined;
      });
    }
    return clientPromise;
  }

  async function backup(): Promise<{ xml: string; doc: TaskerDoc }> {
    const xml = await (await client()).backup();
    let doc: TaskerDoc;
    try {
      doc = TaskerDoc.parse(xml);
    } catch (e) {
      throw new ToolError(
        `The phone's /backup is not a Tasker configuration: ${(e as Error).message}`,
        "update the TaskerMCP project on the phone (tasker/TaskerMCP.prj.xml)",
      );
    }
    return { xml, doc };
  }

  const snapshots =
    deps.snapshots ??
    new SnapshotStore(join(config.home, "snapshots"), {
      keep: SNAPSHOT_KEEP,
    });
  const docs = deps.docs ?? new DocsStore({ home: config.home });

  const ctx: RuntimeContext = {
    config,
    policy,
    get spec(): SpecIndex {
      spec ??= getSpec();
      return spec;
    },
    snapshots,
    docs,
    exec,
    client,
    async serial() {
      if (resolvedSerial !== undefined) return resolvedSerial;
      if (config.autoForward) {
        await client();
        return resolvedSerial ?? config.adbSerial;
      }
      return config.adbSerial;
    },
    backup,
    async snapshot(tool: string, label: string): Promise<Snapshot> {
      const { xml, doc } = await backup();
      const device = resolvedSerial ?? config.adbSerial ?? hostOf(resolvedUrl ?? DEFAULT_URL);
      const info = await snapshots.save(xml, { label, tool, device });
      return { xml, doc, info };
    },
    assertWritable(kind: ObjectKind, name: string) {
      checkWritable(policy, kind, name);
    },
    async replaceConfig(xml: string) {
      checkWritable(policy, "config", "");
      const c = await client();
      await c.replaceConfig(xml);
      await c.waitForPing({
        timeoutMs: CONFIG_RESTART_TIMEOUT_MS,
        intervalMs: deps.pingIntervalMs ?? 500,
      });
    },
    toolsChanged() {
      try {
        toolsChangedFn?.();
      } catch (e) {
        log(`toolsChanged hook failed: ${(e as Error).message}`);
      }
    },
    onToolsChanged(fn) {
      toolsChangedFn = fn;
    },
  };
  return ctx;
}
