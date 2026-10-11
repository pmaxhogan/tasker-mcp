import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./tools/context.ts";
import { TOOL_MODULES } from "./tools/index.ts";
import { VERSION } from "./version.ts";

export const SERVER_INSTRUCTIONS = `tasker-mcp drives Tasker on an Android phone or emulator.
Start with list_tasks / list_profiles / list_projects, read with get_task, change with create_task / edit_task (every mutation snapshots the configuration first; restore_snapshot undoes it), and run with run_task or run_actions.
Look up action codes and argument layouts with search_actions and get_action_spec before writing actions; unknown codes are allowed as raw XML.
Docs: search_docs / get_doc search the Tasker userguide.
Changes are live in Tasker's running configuration only: after a batch of changes call persist_config (or run the server with TASKER_AUTO_PERSIST=true), or the changes are lost when Tasker restarts.`;

/**
 * Builds the MCP server. Without a context only `ping` is registered (used by
 * tests and by `--help`-style smoke checks); with one, every tool module is.
 */
export function createServer(ctx?: ToolContext): McpServer {
  const server = new McpServer(
    { name: "tasker-mcp", version: VERSION },
    { capabilities: { tools: { listChanged: true } }, instructions: SERVER_INSTRUCTIONS },
  );
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Check that the tasker-mcp server itself is alive. Example: ping {}",
      inputSchema: {},
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify({ ok: true, server: VERSION }) }],
    }),
  );
  if (ctx) {
    for (const mod of TOOL_MODULES) mod.register(server, ctx);
  }
  return server;
}
