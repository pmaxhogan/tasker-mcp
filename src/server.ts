import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VERSION } from "./version.ts";

/** Builds the MCP server with every tool registered. */
export function createServer(): McpServer {
  const server = new McpServer({ name: "tasker-mcp", version: VERSION });
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
  return server;
}
