/**
 * The contract every tool module codes against. Tool modules export a
 * `register(server, ctx)` function (type RegisterTools) and never construct
 * clients, stores, or indexes themselves: they get them from the ToolContext,
 * which src/tools/runtime.ts builds once at startup and tests replace with
 * fakes.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Exec } from "../adb.ts";
import type { TaskerClient } from "../client/index.ts";
import type { Config } from "../config.ts";
import type { DocsStore } from "../docs/index.ts";
import type { TaskerDoc } from "../model/document.ts";
import type { SnapshotInfo, SnapshotStore } from "../snapshots.ts";
import type { SpecIndex } from "../spec/table.ts";

/** What kind of object a mutation touches; used by the write-scope check. */
export type ObjectKind = "task" | "profile" | "project" | "scene" | "variable" | "config";

export interface WritePolicy {
  /**
   * When set, mutating tools only touch objects whose name starts with one of
   * these prefixes (env TASKER_WRITE_ALLOW, comma separated). Used on a real
   * phone to confine writes to e.g. "TaskerMCP.Test".
   */
  allowPrefixes?: string[];
  /**
   * Whether tools may replace the whole Tasker configuration (POST /config).
   * Needed for delete, rename, profile/project edits, move_to_project, and
   * restore_snapshot. Env TASKER_ALLOW_CONFIG_IMPORT (default true, false
   * whenever allowPrefixes is set unless explicitly enabled).
   */
  allowConfigImport: boolean;
}

/** A backup fetched (and saved as a snapshot) before a mutation. */
export interface Snapshot {
  xml: string;
  doc: TaskerDoc;
  info: SnapshotInfo;
}

export interface ToolContext {
  config: Config;
  policy: WritePolicy;
  spec: SpecIndex;
  snapshots: SnapshotStore;
  docs: DocsStore;
  /** adb runner (child_process.execFile in production). */
  exec: Exec;
  /** The phone client; the first call sets up `adb forward` when needed. */
  client(): Promise<TaskerClient>;
  /** The adb serial in use, when adb is involved at all. */
  serial(): Promise<string | undefined>;
  /** Fetch a fresh backup without saving a snapshot (read-only tools). */
  backup(): Promise<{ xml: string; doc: TaskerDoc }>;
  /** Fetch a fresh backup and save it as a snapshot before a mutation. */
  snapshot(tool: string, label: string): Promise<Snapshot>;
  /**
   * Throws a ToolError when the write policy forbids touching `name` of
   * `kind`, or (for "config") when config imports are disabled.
   */
  assertWritable(kind: ObjectKind, name: string): void;
  /**
   * POST /config with a full configuration, then wait until the phone answers
   * /ping again. Calls assertWritable("config", ...) first.
   */
  replaceConfig(xml: string): Promise<void>;
  /** Tell the client that the per-task tool list changed (listChanged). */
  toolsChanged(): void;
}

export type RegisterTools = (server: McpServer, ctx: ToolContext) => void;

/** An expected failure with a fix hint; becomes an isError tool result. */
export class ToolError extends Error {
  readonly hint: string | undefined;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = "ToolError";
    this.hint = hint;
  }
}

/** Compact JSON success result. */
export function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

/** Error result in the row 10 style: message plus a fix hint. */
export function fail(message: string, hint?: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: hint ? `${message}; ${hint}` : message }],
  };
}

/** Errors that carry a `hint` field (ToolError, client errors, adb errors). */
function hintOf(e: unknown): string | undefined {
  if (e && typeof e === "object" && "hint" in e) {
    const h = (e as { hint?: unknown }).hint;
    if (typeof h === "string" && h !== "") return h;
  }
  return undefined;
}

/**
 * Wraps a tool handler so every thrown error becomes an isError result with
 * its hint instead of a protocol error.
 */
export function handler<A>(
  fn: (args: A) => Promise<CallToolResult>,
): (args: A) => Promise<CallToolResult> {
  return async (args: A) => {
    try {
      return await fn(args);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const hint = hintOf(e);
      // Client and adb errors already embed their hint in the message.
      return fail(message, hint !== undefined && !message.includes(hint) ? hint : undefined);
    }
  };
}
