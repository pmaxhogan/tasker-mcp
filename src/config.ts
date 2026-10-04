import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
  url: string | undefined;
  token: string | undefined;
  adbSerial: string | undefined;
  home: string;
  timeoutMs: number;
  adbPath: string;
  autoForward: boolean;
}

export type ConfigAction = "run" | "help" | "version";

export interface LoadedConfig {
  action: ConfigAction;
  config: Config;
}

export const DEFAULT_URL = "http://localhost:1821";
export const DEFAULT_TIMEOUT_MS = 30000;

export const HELP_TEXT = `tasker-mcp - MCP server for Tasker on Android (stdio)

Usage: tasker-mcp [options]

Options:
  --url <url>           Tasker HTTP server URL (env TASKER_URL). When unset, the
                        server uses adb to forward tcp:1821 to the phone.
  --token <token>       Bearer token (env TASKER_TOKEN)
  --token-file <path>   Read the bearer token from a file (env TASKER_TOKEN_FILE)
  --serial <serial>     adb device serial (env TASKER_ADB_SERIAL)
  --home <dir>          State directory (env TASKER_MCP_HOME, default ~/.tasker-mcp)
  --timeout-ms <ms>     Request timeout (env TASKER_TIMEOUT_MS, default 30000)
  --adb <path>          adb executable (env TASKER_ADB, default "adb")
  --help                Show this help
  --version             Show the version

Command line flags override environment variables.
`;

const VALUE_FLAGS = new Set(["url", "token", "token-file", "serial", "home", "timeout-ms", "adb"]);

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

interface ParsedArgv {
  flags: Map<string, string>;
  help: boolean;
  version: boolean;
}

function parseArgv(argv: string[]): ParsedArgv {
  const flags = new Map<string, string>();
  let help = false;
  let version = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--version" || arg === "-v") {
      version = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new ConfigError(`Unexpected argument "${arg}". Run with --help for usage.`);
    }
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (!VALUE_FLAGS.has(name)) {
      throw new ConfigError(`Unknown option "--${name}". Run with --help for usage.`);
    }
    let value: string | undefined;
    if (eq === -1) {
      value = argv[++i];
      if (value === undefined) {
        throw new ConfigError(`Option "--${name}" needs a value.`);
      }
    } else {
      value = arg.slice(eq + 1);
    }
    flags.set(name, value);
  }
  return { flags, help, version };
}

function normalizeUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ConfigError(
      `Invalid Tasker URL "${raw}". Use a full URL such as http://192.168.1.50:1821.`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConfigError(`Invalid Tasker URL "${raw}": the scheme must be http or https.`);
  }
  return raw.replace(/\/+$/, "");
}

function nonEmpty(v: string | undefined): string | undefined {
  return v === undefined || v === "" ? undefined : v;
}

export function loadConfig(
  argv: string[],
  env: NodeJS.ProcessEnv,
  readFile: (path: string) => string = (p) => readFileSync(p, "utf8"),
  homeDir: () => string = homedir,
): LoadedConfig {
  const { flags, help, version } = parseArgv(argv);
  const pick = (flag: string, envName: string): string | undefined =>
    nonEmpty(flags.get(flag)) ?? nonEmpty(env[envName]);
  const defaultHome = (): string => join(homeDir(), ".tasker-mcp");

  if (help || version) {
    return {
      action: help ? "help" : "version",
      config: {
        url: undefined,
        token: undefined,
        adbSerial: undefined,
        home: defaultHome(),
        timeoutMs: DEFAULT_TIMEOUT_MS,
        adbPath: "adb",
        autoForward: true,
      },
    };
  }

  const rawUrl = pick("url", "TASKER_URL");
  const url = rawUrl === undefined ? undefined : normalizeUrl(rawUrl);

  // Precedence: --token, --token-file, TASKER_TOKEN, TASKER_TOKEN_FILE.
  let token = nonEmpty(flags.get("token"));
  if (token === undefined) {
    const fileFlag = nonEmpty(flags.get("token-file"));
    const envToken = nonEmpty(env["TASKER_TOKEN"]);
    const tokenFile =
      fileFlag ?? (envToken === undefined ? nonEmpty(env["TASKER_TOKEN_FILE"]) : undefined);
    if (tokenFile !== undefined) {
      try {
        token = nonEmpty(readFile(tokenFile).trim());
      } catch (err) {
        throw new ConfigError(
          `Cannot read token file "${tokenFile}": ${(err as Error).message}. Check the path or use --token.`,
        );
      }
    } else {
      token = envToken;
    }
  }

  const rawTimeout = pick("timeout-ms", "TASKER_TIMEOUT_MS");
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (rawTimeout !== undefined) {
    timeoutMs = Number(rawTimeout);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new ConfigError(
        `Invalid timeout "${rawTimeout}": --timeout-ms / TASKER_TIMEOUT_MS must be a positive integer of milliseconds.`,
      );
    }
  }

  return {
    action: "run",
    config: {
      url,
      token,
      adbSerial: pick("serial", "TASKER_ADB_SERIAL"),
      home: pick("home", "TASKER_MCP_HOME") ?? defaultHome(),
      timeoutMs,
      adbPath: pick("adb", "TASKER_ADB") ?? "adb",
      autoForward: url === undefined,
    },
  };
}
