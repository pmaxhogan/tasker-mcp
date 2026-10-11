/**
 * Global variable tools: get_global, set_global, list_globals.
 *
 * The phone's /vars routes take names without the leading `%`; a `%` the
 * agent passes is stripped. Tasker globals need at least one upper case
 * letter (an all lower case name is a task local), which set_global checks
 * before calling the phone.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolError, handler, ok, type ToolContext } from "./context.ts";

const NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

/** "%MyVar" or "MyVar" -> "MyVar"; throws a ToolError for invalid names. */
export function globalName(raw: string, forWrite = false): string {
  const name = raw.trim().replace(/^%/, "");
  if (!NAME_RE.test(name)) {
    throw new ToolError(
      `Invalid variable name "${raw}"`,
      "use letters, digits and _ starting with a letter, e.g. MyVar",
    );
  }
  if (forWrite && !/[A-Z]/.test(name)) {
    throw new ToolError(
      `"${name}" is not a global variable name`,
      "Tasker globals need at least one upper case letter, e.g. MyVar",
    );
  }
  return name;
}

export function register(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "get_global",
    {
      title: "Get global variable",
      description:
        "Read a Tasker global variable. Returns {name, value?, set}; set is false when the " +
        'variable is unset. The leading % is optional. Example: get_global {"name": "MyVar"}',
      inputSchema: { name: z.string().describe("Global variable name, e.g. MyVar or %MyVar") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ name }) => {
      const client = await ctx.client();
      return ok(await client.getVar(globalName(name)));
    }),
  );

  server.registerTool(
    "set_global",
    {
      title: "Set global variable",
      description:
        "Set a Tasker global variable (the name needs an upper case letter). Subject to the " +
        'write policy. Example: set_global {"name": "MyVar", "value": "hello"}',
      inputSchema: {
        name: z.string().describe("Global variable name, e.g. MyVar"),
        value: z.string().describe("New value; an empty string clears it"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    handler(async ({ name, value }) => {
      const n = globalName(name, true);
      ctx.assertWritable("variable", n);
      const client = await ctx.client();
      await client.setVar(n, value);
      return ok({ ok: true, name: n, value });
    }),
  );

  server.registerTool(
    "list_globals",
    {
      title: "List global variables",
      description:
        "List the names of all user-defined Tasker global variables. Read values with " +
        "get_global. Example: list_globals {}",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async () => {
      const client = await ctx.client();
      const res = await client.listVars();
      // Tasker's Test Tasker action reports names with the leading %; tools
      // take and return names without it.
      const globals = [...(res.globals ?? [])]
        .map((g) => g.replace(/^%/, ""))
        .sort((a, b) => a.localeCompare(b));
      return ok({ count: globals.length, globals });
    }),
  );
}
