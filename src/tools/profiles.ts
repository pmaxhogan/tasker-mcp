/**
 * set_profile_enabled and send_command: small live-state tools that do not
 * touch the configuration's structure. Tasker saves a Profile Status change
 * to disk itself (verified on 6.6.20), but that save does not include other
 * unsaved changes, so a profile that was created over the API and never
 * persisted is still lost on restart. set_profile_enabled therefore reports
 * `persisted` like every other mutation (see src/tools/persist.ts).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TaskerHttpError } from "../client/index.ts";
import { fail, handler, ok, type ToolContext } from "./context.ts";
import { exclusive, finishMutation } from "./mutate.ts";

export function register(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "set_profile_enabled",
    {
      title: "Enable or disable a profile",
      description:
        "Turn a Tasker profile on or off by its exact name (Tasker's Profile Status action). " +
        'Subject to the write policy. Example: set_profile_enabled {"name": "Night Mode", ' +
        '"enabled": false}',
      inputSchema: {
        name: z.string().min(1).describe("Exact profile name"),
        enabled: z.boolean().describe("true to enable, false to disable"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    handler(async ({ name, enabled }) => {
      ctx.assertWritable("profile", name);
      return exclusive(async () => {
        const client = await ctx.client();
        try {
          await client.setProfileEnabled(name, enabled);
        } catch (e) {
          if (e instanceof TaskerHttpError && e.status === 404) {
            return fail(`No profile named "${name}"`, "use list_profiles to see the exact names");
          }
          throw e;
        }
        const warnings: string[] = [];
        const persist = await finishMutation(ctx, warnings);
        return ok({
          ok: true,
          name,
          enabled,
          ...(warnings.length > 0 ? { warnings } : {}),
          ...persist,
        });
      });
    }),
  );

  server.registerTool(
    "send_command",
    {
      title: "Send a Tasker command",
      description:
        "Send a command through Tasker's Command System (the Command action). Profiles with a " +
        "Command event matching the prefix fire; the text after =:= is the payload. " +
        'Example: send_command {"command": "mytag=:=payload"}',
      inputSchema: {
        command: z.string().min(1).describe('Command text, e.g. "mytag=:=payload"'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    handler(async ({ command }) => {
      const client = await ctx.client();
      await client.command(command);
      return ok({ ok: true, command });
    }),
  );
}
