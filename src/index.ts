import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConfigError, HELP_TEXT, loadConfig, type LoadedConfig } from "./config.ts";
import { log } from "./log.ts";
import { createServer } from "./server.ts";
import { createToolContext } from "./tools/runtime.ts";
import { taskToolRegistryFor } from "./tools/tasktools.ts";
import { VERSION } from "./version.ts";

let loaded: LoadedConfig | undefined;
try {
  loaded = loadConfig(process.argv.slice(2), process.env);
} catch (e) {
  if (!(e instanceof ConfigError)) throw e;
  process.stderr.write(`tasker-mcp: ${e.message}\n`);
  process.exitCode = 2;
}

// Help and version end by letting the process exit on its own, so a piped
// stdout (`tasker-mcp --help | head`) is flushed completely.
if (loaded?.action === "help") {
  process.stdout.write(HELP_TEXT);
} else if (loaded?.action === "version") {
  process.stdout.write(`${VERSION}\n`);
} else if (loaded !== undefined) {
  const ctx = createToolContext(loaded.config);
  const server = createServer(ctx);
  // A mutation may have added, changed, or removed a #mcp task: re-read the
  // per-task tools; the registry sends tools/list_changed itself when the set
  // changed.
  ctx.onToolsChanged(() => {
    const registry = taskToolRegistryFor(server);
    if (registry) {
      registry
        .refresh()
        .catch((e: unknown) => log("refresh_tools after a mutation failed", String(e)));
    } else if (server.isConnected()) {
      server.sendToolListChanged();
    }
  });
  await server.connect(new StdioServerTransport());
  log(`tasker-mcp ${VERSION} ready (${loaded.config.url ?? "adb forward"})`);
}
