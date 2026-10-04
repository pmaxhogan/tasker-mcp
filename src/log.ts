/**
 * Diagnostics go to stderr: stdout carries the MCP stdio protocol.
 */
export function log(msg: string, extra?: unknown): void {
  const line = extra === undefined ? msg : `${msg} ${JSON.stringify(extra)}`;
  process.stderr.write(`[tasker-mcp] ${line}\n`);
}
