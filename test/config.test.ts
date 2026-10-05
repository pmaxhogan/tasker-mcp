import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_POLICY, HELP_TEXT, loadConfig } from "../src/config.ts";

const home = () => "/home/u";
const load = (argv: string[], env: NodeJS.ProcessEnv = {}, read?: (p: string) => string) =>
  loadConfig(argv, env, read, home);

describe("loadConfig", () => {
  it("applies defaults", () => {
    const { action, config } = load([]);
    expect(action).toBe("run");
    expect(config).toMatchObject({
      url: undefined,
      token: undefined,
      adbSerial: undefined,
      timeoutMs: 30000,
      adbPath: "adb",
      autoForward: true,
    });
    expect(config.home.replaceAll("\\", "/")).toBe("/home/u/.tasker-mcp");
  });

  it("uses the real homedir by default", () => {
    const { config } = loadConfig([], {});
    expect(config.home).toContain(".tasker-mcp");
  });

  it("reads env vars", () => {
    const { config } = load([], {
      TASKER_URL: "http://10.0.0.5:1821/",
      TASKER_TOKEN: "abc",
      TASKER_ADB_SERIAL: "S1",
      TASKER_MCP_HOME: "/data",
      TASKER_TIMEOUT_MS: "5000",
      TASKER_ADB: "/opt/adb",
    });
    expect(config).toEqual({
      url: "http://10.0.0.5:1821",
      token: "abc",
      adbSerial: "S1",
      home: "/data",
      timeoutMs: 5000,
      adbPath: "/opt/adb",
      autoForward: false,
      policy: { allowConfigImport: true },
    });
  });

  it("lets flags override env, in both flag forms", () => {
    const { config } = load(
      ["--url", "http://a:1", "--token=t2", "--serial", "S2", "--timeout-ms=9", "--adb", "x"],
      { TASKER_URL: "http://b:2", TASKER_TOKEN: "t1", TASKER_ADB_SERIAL: "S1" },
    );
    expect(config.url).toBe("http://a:1");
    expect(config.token).toBe("t2");
    expect(config.adbSerial).toBe("S2");
    expect(config.timeoutMs).toBe(9);
    expect(config.adbPath).toBe("x");
  });

  it("treats empty env values as unset", () => {
    const { config } = load([], { TASKER_URL: "", TASKER_TOKEN: "" });
    expect(config.url).toBeUndefined();
    expect(config.autoForward).toBe(true);
  });

  it("returns help and version actions without printing", () => {
    expect(load(["--help"]).action).toBe("help");
    expect(load(["-h"]).action).toBe("help");
    expect(load(["--version"]).action).toBe("version");
    expect(load(["-v"]).action).toBe("version");
    expect(load(["--help", "--version"]).action).toBe("help");
    expect(HELP_TEXT).toContain("TASKER_URL");
    expect(HELP_TEXT).toContain("--token-file");
  });

  it("reads and trims a token file", () => {
    const read = (p: string) => (p === "/tok" ? "  secret\n" : "");
    expect(load(["--token-file", "/tok"], {}, read).config.token).toBe("secret");
    expect(load([], { TASKER_TOKEN_FILE: "/tok" }, read).config.token).toBe("secret");
  });

  it("orders token sources: --token, --token-file, TASKER_TOKEN, TASKER_TOKEN_FILE", () => {
    const read = () => "fromfile";
    expect(load(["--token", "flag", "--token-file", "/f"], {}, read).config.token).toBe("flag");
    expect(load(["--token-file", "/f"], { TASKER_TOKEN: "env" }, read).config.token).toBe(
      "fromfile",
    );
    expect(load([], { TASKER_TOKEN: "env", TASKER_TOKEN_FILE: "/f" }, read).config.token).toBe(
      "env",
    );
  });

  it("reports an unreadable token file", () => {
    const read = () => {
      throw new Error("ENOENT");
    };
    expect(() => load(["--token-file", "/nope"], {}, read)).toThrow(/Cannot read token file/);
  });

  it("uses the default file reader", () => {
    expect(() => load(["--token-file", "/definitely/not/here/xyz"])).toThrow(ConfigError);
  });

  it("validates the url", () => {
    expect(() => load(["--url", "not a url"])).toThrow(/Invalid Tasker URL/);
    expect(() => load(["--url", "ftp://x"])).toThrow(/http or https/);
    expect(load(["--url", "https://x.example///"]).config.url).toBe("https://x.example");
  });

  it("validates the timeout", () => {
    expect(() => load(["--timeout-ms", "abc"])).toThrow(/positive integer/);
    expect(() => load(["--timeout-ms", "0"])).toThrow(/positive integer/);
    expect(() => load([], { TASKER_TIMEOUT_MS: "1.5" })).toThrow(/positive integer/);
  });

  it("rejects bad argv", () => {
    expect(() => load(["--nope", "x"])).toThrow(/Unknown option/);
    expect(() => load(["positional"])).toThrow(/Unexpected argument/);
    expect(() => load(["--url"])).toThrow(/needs a value/);
  });
});

describe("write policy", () => {
  it("defaults to everything writable with config imports", () => {
    expect(load([]).config.policy).toEqual({ allowConfigImport: true });
    expect(load(["--help"]).config.policy).toEqual({ allowConfigImport: true });
    expect(DEFAULT_POLICY).toEqual({ allowConfigImport: true });
    expect(HELP_TEXT).toContain("--write-allow");
    expect(HELP_TEXT).toContain("TASKER_ALLOW_CONFIG_IMPORT");
    expect(HELP_TEXT).toContain("--no-config-import");
  });

  it("reads the allow list; config imports then default to off", () => {
    expect(load([], { TASKER_WRITE_ALLOW: " TaskerMCP., MCPTest. ,," }).config.policy).toEqual({
      allowPrefixes: ["TaskerMCP.", "MCPTest."],
      allowConfigImport: false,
    });
    expect(
      load(["--write-allow", "A."], { TASKER_WRITE_ALLOW: "B." }).config.policy.allowPrefixes,
    ).toEqual(["A."]);
    expect(() => load(["--write-allow", " , "])).toThrow(/write allow list/);
  });

  it("lets the config import switch override the default", () => {
    expect(
      load(["--write-allow=A.", "--allow-config-import"]).config.policy.allowConfigImport,
    ).toBe(true);
    expect(load(["--no-config-import"]).config.policy.allowConfigImport).toBe(false);
    expect(
      load([], { TASKER_WRITE_ALLOW: "A.", TASKER_ALLOW_CONFIG_IMPORT: "yes" }).config.policy
        .allowConfigImport,
    ).toBe(true);
    expect(load([], { TASKER_ALLOW_CONFIG_IMPORT: "false" }).config.policy.allowConfigImport).toBe(
      false,
    );
    expect(
      load(["--allow-config-import"], { TASKER_ALLOW_CONFIG_IMPORT: "0" }).config.policy
        .allowConfigImport,
    ).toBe(true);
    expect(() => load([], { TASKER_ALLOW_CONFIG_IMPORT: "maybe" })).toThrow(
      /TASKER_ALLOW_CONFIG_IMPORT/,
    );
    expect(() => load(["--allow-config-import=1"])).toThrow(/Unknown option/);
  });
});
