/**
 * Log tools: get_logcat (Tasker lines from adb logcat) and get_run_log (the
 * phone has no way to export Tasker's Run Log, so it explains that).
 *
 * Security: with "Debug To System Log" on, Tasker logs variable values. While
 * TaskerMCP.Setup runs that includes the bearer token (%TaskerMCP_Token) and
 * the two UUIDs it is built from (%mcp_uuid1, %mcp_uuid2, %uuid; see
 * tasker/js/setup.js). Every returned line goes through redactLine(), which
 * removes the configured token, its two halves in plain and UUID form, and
 * any 64 hex string (or UUID) on or next to a line that names the token or
 * the Setup UUID variables, so a rotated or unknown token is covered too.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AdbError, listDevices, logcat, pickDevice } from "../adb.ts";
import { TaskerHttpError } from "../client/index.ts";
import { fail, handler, ok, type ToolContext } from "./context.ts";

export const REDACTED = "[redacted]";

export const ADB_HINT =
  "connect the device over adb or set TASKER_ADB_SERIAL; enable Tasker > Preferences > Misc > " +
  "Debug To System Log";

const HEX64 = /(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])/gi;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HEX32 = /(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])/gi;
const SENSITIVE_MARK = /TaskerMCP_Token|mcp_uuid|mcp_new|%uuid\b|TaskerMCP\.Setup/i;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uuidForm(hex32: string): string {
  return [
    hex32.slice(0, 8),
    hex32.slice(8, 12),
    hex32.slice(12, 16),
    hex32.slice(16, 20),
    hex32.slice(20),
  ].join("-");
}

/** Literal secrets to remove for a token: the token itself and, for a 64-hex token, its halves. */
export function secretsFor(token: string | undefined): string[] {
  if (token === undefined || token.trim() === "") return [];
  const t = token.trim();
  const out = [t];
  if (/^[0-9a-f]{64}$/i.test(t)) {
    for (const half of [t.slice(0, 32), t.slice(32)]) out.push(uuidForm(half), half);
  }
  return out;
}

/**
 * Builds a function that redacts one log line. `context` says whether the
 * line or a neighbour mentions the token or the Setup UUID variables.
 */
export function makeRedactor(
  token: string | undefined,
): (line: string, context: boolean) => string {
  const secrets = secretsFor(token);
  const literal =
    secrets.length > 0 ? new RegExp(secrets.map(escapeRe).join("|"), "gi") : undefined;
  return (line, context) => {
    let out = literal ? line.replace(literal, REDACTED) : line;
    if (context) {
      out = out.replace(HEX64, REDACTED).replace(UUID, REDACTED).replace(HEX32, REDACTED);
    }
    return out;
  };
}

/** Redact every line; lines next to one naming the token get the pattern rule too. */
export function redactLines(lines: string[], token: string | undefined): string[] {
  const redact = makeRedactor(token);
  const marked = lines.map((l) => SENSITIVE_MARK.test(l));
  return lines.map((line, i) =>
    redact(line, marked[i] === true || marked[i - 1] === true || marked[i + 1] === true),
  );
}

async function resolveSerial(ctx: ToolContext): Promise<string> {
  const serial = (await ctx.serial()) ?? ctx.config.adbSerial;
  if (serial !== undefined && serial !== "") return serial;
  return pickDevice(await listDevices(ctx.exec, ctx.config.adbPath)).serial;
}

export function register(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "get_logcat",
    {
      title: "Get Tasker logcat",
      description:
        "Tasker's lines from the device log (adb logcat) for the last N seconds, newest last. " +
        "Needs adb and Tasker > Preferences > Misc > Debug To System Log. The bearer token is " +
        'redacted. Example: get_logcat {"seconds": 120, "filter": "MyTask", "lines": 200}',
      inputSchema: {
        seconds: z
          .number()
          .int()
          .min(1)
          .max(86_400)
          .default(60)
          .describe("How far back to read (default 60)"),
        filter: z
          .string()
          .optional()
          .describe("Keep only lines containing this (case-insensitive)"),
        lines: z
          .number()
          .int()
          .min(1)
          .max(2000)
          .optional()
          .describe("Return only the last N lines"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ seconds, filter, lines }) => {
      let raw: string[];
      try {
        const serial = await resolveSerial(ctx);
        raw = await logcat(ctx.exec, ctx.config.adbPath, serial, { seconds });
      } catch (e) {
        if (e instanceof AdbError) return fail(e.message, ADB_HINT);
        throw e;
      }
      // Filter after redacting, so a filter cannot probe the token's characters.
      const needle = filter?.toLowerCase();
      const redacted = redactLines(raw, ctx.config.token).filter(
        (l) => needle === undefined || needle === "" || l.toLowerCase().includes(needle),
      );
      const out = lines === undefined ? redacted : redacted.slice(-lines);
      const result: Record<string, unknown> = { count: out.length, lines: out };
      if (raw.length === 0) {
        result.note =
          "no Tasker lines; enable Tasker > Preferences > Misc > Debug To System Log, or widen seconds";
      }
      return ok(result);
    }),
  );

  server.registerTool(
    "get_run_log",
    {
      title: "Get Tasker run log",
      description:
        "Tasker's Run Log. Tasker has no action that exports it, so the phone answers 501 and " +
        "this explains that; use get_logcat instead. Example: get_run_log {}",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async () => {
      const client = await ctx.client();
      let text: string;
      try {
        text = await client.runLog();
      } catch (e) {
        if (e instanceof TaskerHttpError && e.status === 501) {
          return fail(
            "The Run Log is not available: Tasker has no action that exports it",
            "use get_logcat with Tasker > Preferences > Misc > Debug To System Log enabled",
          );
        }
        throw e;
      }
      const runLog = redactLines(text.split(/\r?\n/), ctx.config.token).join("\n");
      return ok({ runLog });
    }),
  );
}
