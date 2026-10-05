/**
 * Snapshot tools: list_snapshots, snapshot_now, restore_snapshot.
 *
 * Every mutating tool saves a snapshot (a full Data Backup) first; these tools
 * list them, take one on demand, and roll back. A restore takes a fresh
 * snapshot first, so the restore itself can be undone.
 *
 * restore_snapshot modes:
 * - "config": replace the whole configuration with the snapshot (POST
 *   /config). Default when the write policy allows config imports.
 * - "tasks": re-import each named Task of the snapshot through /import, which
 *   replaces same-named tasks in place. Profiles, projects, scenes and tasks
 *   created after the snapshot are left alone. Default on a write-confined
 *   phone; tasks the policy does not allow are skipped and reported.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapForImport } from "../model/convert.ts";
import { TaskerDoc } from "../model/document.ts";
import type { XmlElement } from "../xml/index.ts";
import { ToolError, handler, ok, type ToolContext } from "./context.ts";
import { exclusive, finishMutation } from "./mutate.ts";
import { PERSIST_HINT } from "./persist.ts";

/** Fallback Tasker version for the import wrapper when the snapshot has none. */
const DEFAULT_TV = "6.6.20";

export function register(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_snapshots",
    {
      title: "List snapshots",
      description:
        "List saved configuration snapshots, newest first (id, label, tool, createdAt, " +
        "bytes). Every mutation saves one; restore with restore_snapshot. " +
        "Example: list_snapshots {}",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handler(async () => {
      const snapshots = await ctx.snapshots.list();
      return ok({ count: snapshots.length, snapshots });
    }),
  );

  server.registerTool(
    "snapshot_now",
    {
      title: "Take a snapshot",
      description:
        "Fetch a full backup from the phone and save it as a snapshot with a label. " +
        'Example: snapshot_now {"label": "before cleanup"}',
      inputSchema: { label: z.string().min(1).max(200).describe("Short description") },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    handler(async ({ label }) => {
      const snap = await ctx.snapshot("snapshot_now", label);
      return ok({ ok: true, snapshot: snap.info });
    }),
  );

  server.registerTool(
    "restore_snapshot",
    {
      title: "Restore a snapshot",
      description:
        'Roll the phone back to a snapshot. mode "config" (default when config imports are ' +
        'allowed) replaces the whole configuration; "tasks" re-imports each task of the ' +
        "snapshot by name (for write-confined phones; profiles and projects are not touched). " +
        "A fresh snapshot is taken first so the restore can be undone. " +
        'Example: restore_snapshot {"id": "20261004T120000000Z-before-cleanup"}',
      inputSchema: {
        id: z.string().min(1).describe("Snapshot id from list_snapshots"),
        mode: z.enum(["config", "tasks"]).optional().describe('"config" or "tasks"'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    handler(async ({ id, mode }) => {
      const { info, xml } = await ctx.snapshots.get(id);
      const chosen = mode ?? (ctx.policy.allowConfigImport ? "config" : "tasks");
      const doc = TaskerDoc.parse(xml);

      if (chosen === "config") {
        // Check before taking the safety snapshot, so a refusal leaves nothing behind.
        ctx.assertWritable("config", `restore ${info.id}`);
        return exclusive(async () => {
          const before = await ctx.snapshot("restore_snapshot", `before restore ${info.id}`);
          await ctx.replaceConfig(xml);
          const warnings: string[] = [];
          const persist = await finishMutation(ctx, warnings);
          return ok({
            ok: true,
            mode: chosen,
            restored: info.id,
            undo: before.info.id,
            ...(warnings.length > 0 ? { warnings } : {}),
            ...persist,
          });
        });
      }

      const allowed: { name: string; el: XmlElement }[] = [];
      const skipped: { name: string; reason: string }[] = [];
      for (const el of doc.tasks()) {
        const name = TaskerDoc.nameOf(el);
        if (name === "") continue;
        try {
          ctx.assertWritable("task", name);
          allowed.push({ name, el });
        } catch (e) {
          skipped.push({ name, reason: e instanceof Error ? e.message : String(e) });
        }
      }
      if (allowed.length === 0) {
        throw new ToolError(
          `Snapshot ${info.id} has no named task the write policy allows`,
          "check TASKER_WRITE_ALLOW, or restore with mode config",
        );
      }
      return exclusive(async () => {
        const before = await ctx.snapshot("restore_snapshot", `before restore ${info.id}`);
        const client = await ctx.client();
        const tv = doc.taskerVersion ?? DEFAULT_TV;
        const restored: string[] = [];
        const failed: { name: string; error: string }[] = [];
        for (const { name, el } of allowed) {
          try {
            await client.importXml(wrapForImport([el], tv));
            restored.push(name);
          } catch (e) {
            failed.push({ name, error: e instanceof Error ? e.message : String(e) });
          }
        }
        const warnings: string[] = [];
        const persist =
          restored.length > 0
            ? await finishMutation(ctx, warnings)
            : { persisted: false, persistHint: PERSIST_HINT };
        const result: Record<string, unknown> = {
          ok: failed.length === 0,
          mode: chosen,
          restored: info.id,
          undo: before.info.id,
          tasks: restored,
        };
        if (skipped.length > 0) result.skipped = skipped;
        if (failed.length > 0) result.failed = failed;
        if (warnings.length > 0) result.warnings = warnings;
        Object.assign(result, persist);
        return failed.length === 0 ? ok(result) : { ...ok(result), isError: true };
      });
    }),
  );
}
