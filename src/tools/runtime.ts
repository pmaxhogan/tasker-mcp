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
import { childText, type XmlElement } from "../xml/index.ts";
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
  const scopes: string[] = [];
  if (policy.allowPrefixes !== undefined) {
    scopes.push(`names starting with ${policy.allowPrefixes.join(", ")}`);
  }
  if (policy.allowProjects !== undefined) {
    scopes.push(`projects starting with ${policy.allowProjects.join(", ")}`);
  }
  if (scopes.length > 0) parts.push(`writes are limited to ${scopes.join(" and ")}`);
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
  if (policy.allowPrefixes === undefined && policy.allowProjects === undefined) return;
  const prefixes = policy.allowPrefixes ?? [];
  // Globals are written with or without the leading %; check the bare name.
  const bare = kind === "variable" ? name.replace(/^%/, "") : name;
  const ok = prefixes.some((p) => bare.startsWith(p.replace(/^%/, "")) || name.startsWith(p));
  if (ok || (kind === "project" && inAllowedProject(policy, name))) return;
  throw new ToolError(`Write to ${kind} "${name}" refused: ${scopeText(policy)}`, SCOPE_HINT);
}

const SCOPE_HINT =
  "rename the object to an allowed prefix, move it into an allowed project, or extend TASKER_WRITE_ALLOW / TASKER_WRITE_ALLOW_PROJECTS";

function scopeText(policy: WritePolicy): string {
  const list = (xs: string[]): string => xs.map((p) => JSON.stringify(p)).join(", ");
  const parts: string[] = [];
  if (policy.allowPrefixes !== undefined) {
    parts.push(`names starting with ${list(policy.allowPrefixes)}`);
  }
  if (policy.allowProjects !== undefined) {
    parts.push(`objects in projects starting with ${list(policy.allowProjects)}`);
  }
  return `the write allow list only permits ${parts.join(" and ")}`;
}

/** True when `project` starts with one of the policy's allowed project prefixes. */
export function inAllowedProject(policy: WritePolicy, project: string | undefined): boolean {
  return project !== undefined && (policy.allowProjects ?? []).some((p) => project.startsWith(p));
}

/** Name of the project that lists the named task, profile or scene, when it exists in one. */
export function projectOfObject(
  doc: TaskerDoc,
  kind: ObjectKind,
  name: string,
): string | undefined {
  const idOf = (el: XmlElement | undefined): number =>
    el === undefined ? -1 : (TaskerDoc.idOf(el) ?? -1);
  const p =
    kind === "task"
      ? doc.projectOfTask(idOf(doc.taskByName(name)))
      : kind === "profile"
        ? doc.projectOfProfile(idOf(doc.profileByName(name)))
        : kind === "scene"
          ? doc.projectOfScene(name)
          : undefined;
  return p === undefined ? undefined : (childText(p, "name") ?? "");
}

function objectExists(doc: TaskerDoc, kind: ObjectKind, name: string): boolean {
  if (kind === "task") return doc.taskByName(name) !== undefined;
  if (kind === "profile") return doc.profileByName(name) !== undefined;
  return kind === "scene" && doc.sceneByName(name) !== undefined;
}

/**
 * checkWritable, plus the project scope (allowProjects), which needs the
 * current configuration: an object whose name is not allowed is still writable
 * when it sits in an allowed project. One that does not exist yet is writable
 * when it is headed for an allowed project (`destination`); that takes a
 * config import, since every new object lands in Base first.
 */
export function checkWritableIn(
  policy: WritePolicy,
  kind: ObjectKind,
  name: string,
  doc: TaskerDoc,
  destination?: string,
): void {
  try {
    checkWritable(policy, kind, name);
    return;
  } catch (e) {
    if (policy.allowProjects === undefined || !["task", "profile", "scene"].includes(kind)) {
      throw e;
    }
  }
  if (objectExists(doc, kind, name)) {
    const current = projectOfObject(doc, kind, name);
    if (inAllowedProject(policy, current)) return;
    throw new ToolError(
      `Write to ${kind} "${name}" refused: it is in project ${JSON.stringify(current ?? "(none)")}, and ${scopeText(policy)}`,
      SCOPE_HINT,
    );
  }
  if (!inAllowedProject(policy, destination)) {
    throw new ToolError(
      `Write to ${kind} "${name}" refused: ${scopeText(policy)}`,
      `${SCOPE_HINT}; a new ${kind} is allowed when it is created in an allowed project`,
    );
  }
  if (!policy.allowConfigImport) {
    throw new ToolError(
      `Creating ${kind} "${name}" in project "${destination}" needs a whole-configuration import (new objects land in Base first), which is disabled`,
      "set TASKER_ALLOW_CONFIG_IMPORT=true or pass --allow-config-import, or give it an allowed name prefix",
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
