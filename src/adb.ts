import { execFile } from "node:child_process";
import type { Config } from "./config.ts";
import { DEFAULT_URL } from "./config.ts";

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export type Exec = (
  file: string,
  args: string[],
  opts?: { timeoutMs?: number },
) => Promise<ExecResult>;

export type AdbErrorCode =
  | "adb-missing"
  | "adb-failed"
  | "no-device"
  | "multiple-devices"
  | "device-unusable"
  | "serial-not-found";

export class AdbError extends Error {
  readonly code: AdbErrorCode;
  readonly hint: string;
  constructor(code: AdbErrorCode, message: string, hint: string) {
    super(`${message} ${hint}`);
    this.name = "AdbError";
    this.code = code;
    this.hint = hint;
  }
}

export interface AdbDevice {
  serial: string;
  state: string;
  model?: string;
  product?: string;
  transport?: string;
}

/** Exit code the default Exec reports when the binary cannot be spawned (ENOENT etc). */
export const SPAWN_FAILED = 127;

/** Default Exec: child_process.execFile with no shell. Never rejects. */
export const defaultExec: Exec = (file, args, opts) =>
  new Promise((resolve) => {
    execFile(
      file,
      args,
      { timeout: opts?.timeoutMs ?? 30000, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          const code = typeof err.code === "number" ? err.code : SPAWN_FAILED;
          resolve({ stdout, stderr: stderr || err.message, code });
          return;
        }
        resolve({ stdout, stderr, code: 0 });
      },
    );
  });

async function runAdb(
  exec: Exec,
  adbPath: string,
  args: string[],
  timeoutMs = 15000,
): Promise<ExecResult> {
  const res = await exec(adbPath, args, { timeoutMs });
  if (res.code === SPAWN_FAILED) {
    throw new AdbError(
      "adb-missing",
      `Could not run "${adbPath}": ${res.stderr.trim()}.`,
      "Install Android platform-tools and put adb on PATH, or set TASKER_ADB to its full path.",
    );
  }
  return res;
}

const MDNS_RE = /^adb-([^-]+)-[^.]+\._adb-tls-(?:connect|pairing)\._tcp\.?$/;

/** Parse `adb devices -l`. An mDNS entry whose embedded serial matches another entry is dropped. */
export function parseDevices(stdout: string): AdbDevice[] {
  const devices: AdbDevice[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("List of devices") || line.startsWith("*")) continue;
    const parts = line.split(/\s+/);
    const serial = parts[0] as string;
    const state = parts[1];
    if (state === undefined) continue;
    const dev: AdbDevice = { serial, state };
    for (const kv of parts.slice(2)) {
      const idx = kv.indexOf(":");
      if (idx === -1) continue;
      const k = kv.slice(0, idx);
      const v = kv.slice(idx + 1);
      if (k === "model") dev.model = v;
      else if (k === "product") dev.product = v;
      else if (k === "transport_id") dev.transport = v;
    }
    devices.push(dev);
  }
  const serials = new Set(devices.map((d) => d.serial));
  return devices.filter((d) => {
    const m = MDNS_RE.exec(d.serial);
    return !(m && serials.has(m[1] as string));
  });
}

export async function listDevices(exec: Exec, adbPath: string): Promise<AdbDevice[]> {
  const res = await runAdb(exec, adbPath, ["devices", "-l"]);
  if (res.code !== 0) {
    throw new AdbError(
      "adb-failed",
      `"adb devices -l" failed (exit ${res.code}): ${res.stderr.trim()}.`,
      "Check that adb works from a terminal (try `adb kill-server`).",
    );
  }
  return parseDevices(res.stdout);
}

const SELECT_HINT = "Set TASKER_ADB_SERIAL to the device serial, or set TASKER_URL to skip adb.";

function describe(d: AdbDevice): string {
  return `${d.serial} (${d.state}${d.model ? `, ${d.model}` : ""})`;
}

export function pickDevice(devices: AdbDevice[], preferredSerial?: string): AdbDevice {
  if (preferredSerial) {
    const hit = devices.find((d) => d.serial === preferredSerial);
    if (!hit) {
      const known = devices.length ? devices.map(describe).join(", ") : "none";
      throw new AdbError(
        "serial-not-found",
        `Device "${preferredSerial}" is not connected. Connected: ${known}.`,
        "Fix TASKER_ADB_SERIAL, or unset it and set TASKER_URL instead.",
      );
    }
    if (hit.state !== "device") {
      throw new AdbError(
        "device-unusable",
        `Device ${describe(hit)} is not ready.`,
        hit.state === "unauthorized"
          ? "Accept the USB debugging prompt on the phone."
          : "Reconnect the device or run `adb reconnect`.",
      );
    }
    return hit;
  }
  const usable = devices.filter((d) => d.state === "device");
  if (usable.length === 1) return usable[0] as AdbDevice;
  if (usable.length === 0) {
    throw new AdbError(
      "no-device",
      devices.length
        ? `No usable adb device. Found: ${devices.map(describe).join(", ")}.`
        : "No adb devices found.",
      `Connect a phone with USB debugging and accept the prompt. ${SELECT_HINT}`,
    );
  }
  throw new AdbError(
    "multiple-devices",
    `Several adb devices are connected: ${usable.map(describe).join(", ")}.`,
    SELECT_HINT,
  );
}

export async function forward(
  exec: Exec,
  adbPath: string,
  serial: string,
  localPort: number,
  remotePort: number,
): Promise<void> {
  const res = await runAdb(exec, adbPath, [
    "-s",
    serial,
    "forward",
    `tcp:${localPort}`,
    `tcp:${remotePort}`,
  ]);
  if (res.code !== 0) {
    throw new AdbError(
      "adb-failed",
      `adb forward tcp:${localPort} tcp:${remotePort} failed for ${serial}: ${res.stderr.trim()}.`,
      `Check that port ${localPort} is free on this machine and the device is still connected.`,
    );
  }
}

export interface LogcatOptions {
  seconds: number;
  filter?: string;
  tags?: string[];
  /** Injectable clock in epoch milliseconds. */
  now?: () => number;
}

const DEFAULT_TAGS = ["Tasker", "TaskerAction"];
export const MAX_LOGCAT_LINES = 2000;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Tasker log lines from the last N seconds, newest last. Uses `-T <epoch.mmm>`, which works on
 * Android 7+ and avoids timezone issues of the date-string form.
 */
export async function logcat(
  exec: Exec,
  adbPath: string,
  serial: string,
  opts: LogcatOptions,
): Promise<string[]> {
  const nowMs = (opts.now ?? Date.now)();
  const since = ((nowMs - opts.seconds * 1000) / 1000).toFixed(3);
  const res = await runAdb(
    exec,
    adbPath,
    ["-s", serial, "logcat", "-d", "-v", "time", "-T", since],
    30000,
  );
  if (res.code !== 0) {
    throw new AdbError(
      "adb-failed",
      `adb logcat failed for ${serial}: ${res.stderr.trim()}.`,
      "Check that the device is connected and authorized (adb devices -l).",
    );
  }
  const tags = opts.tags ?? DEFAULT_TAGS;
  const tagRes = tags.map((t) => new RegExp(`^\\S+ \\S+\\s+[VDIWEFS]/${escapeRe(t)}\\s*\\(`));
  const filter = opts.filter?.toLowerCase();
  const lines = res.stdout.split(/\r?\n/).filter((line) => {
    if (!line || line.startsWith("---------")) return false;
    const tagged = tagRes.some((re) => re.test(line)) || line.includes("taskerm");
    if (!tagged) return false;
    return filter === undefined || line.toLowerCase().includes(filter);
  });
  return lines.slice(-MAX_LOGCAT_LINES);
}

export const FORWARD_PORT = 1821;

/** Resolve the Tasker URL: config.url if set, else adb-forward tcp:1821 to the chosen device. */
export async function ensureForward(
  config: Pick<Config, "url" | "adbSerial" | "adbPath">,
  exec: Exec = defaultExec,
): Promise<string> {
  if (config.url) return config.url;
  const devices = await listDevices(exec, config.adbPath);
  const dev = pickDevice(devices, config.adbSerial);
  await forward(exec, config.adbPath, dev.serial, FORWARD_PORT, FORWARD_PORT);
  return DEFAULT_URL;
}
