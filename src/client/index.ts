import { log } from "../log.ts";
import { TaskerConnectionError, TaskerHttpError, hintForStatus } from "./errors.ts";

export { TaskerConnectionError, TaskerHttpError } from "./errors.ts";

export interface TaskerClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  fetch?: typeof fetch;
}

export interface PingResult {
  ok: boolean;
  tasker: string;
  project: string;
  device: string;
}

export interface ListResult {
  projects?: string[];
  profiles?: string[];
  tasks?: string[];
  scenes?: string[];
  globals?: string[];
}

export interface RunOptions {
  task: string;
  par1?: string;
  par2?: string;
  variables?: Record<string, string>;
  timeoutSec?: number;
  debug?: boolean;
}

export interface RunResult {
  ok: boolean;
  return?: string;
  durationMs: number;
  error?: string;
  debug?: string[];
}

export interface VarResult {
  name: string;
  value?: string;
  set: boolean;
}

export interface OkResult {
  ok: boolean;
}

export interface WaitForPingOptions {
  timeoutMs: number;
  intervalMs: number;
}

interface RequestOptions {
  body?: string;
  contentType?: string;
  timeoutMs?: number;
}

const XML = "text/xml";

export class TaskerClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: TaskerClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.token = opts.token;
    this.timeoutMs = opts.timeoutMs;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
  }

  ping(): Promise<PingResult> {
    return this.json<PingResult>("GET", "/ping");
  }

  backup(): Promise<string> {
    return this.text("GET", "/backup");
  }

  list(): Promise<ListResult> {
    return this.json<ListResult>("GET", "/list");
  }

  importXml(xml: string): Promise<OkResult> {
    return this.json<OkResult>("POST", "/import", { body: xml, contentType: XML });
  }

  /** Replaces the whole configuration. The phone's server restarts afterwards; see waitForPing. */
  replaceConfig(xml: string): Promise<OkResult & { restarting?: boolean }> {
    return this.json("POST", "/config", { body: xml, contentType: XML });
  }

  run(opts: RunOptions): Promise<RunResult> {
    const timeoutMs =
      opts.timeoutSec === undefined
        ? this.timeoutMs
        : Math.max(this.timeoutMs, (opts.timeoutSec + 15) * 1000);
    return this.postJson<RunResult>("/run", opts, timeoutMs);
  }

  stop(task: string): Promise<OkResult> {
    return this.postJson("/stop", { task });
  }

  getVar(name: string): Promise<VarResult> {
    return this.postJson("/vars/get", { name });
  }

  setVar(name: string, value: string): Promise<OkResult> {
    return this.postJson("/vars/set", { name, value });
  }

  listVars(): Promise<{ globals: string[] }> {
    return this.json("POST", "/vars/list");
  }

  setProfileEnabled(name: string, enabled: boolean): Promise<OkResult> {
    return this.postJson("/profile", { name, enabled });
  }

  command(command: string): Promise<OkResult> {
    return this.postJson("/command", { command });
  }

  runLog(): Promise<string> {
    return this.text("GET", "/runlog");
  }

  rotateToken(): Promise<{ token: string }> {
    return this.json("POST", "/token/rotate");
  }

  /** Polls /ping until the phone answers (used after replaceConfig restarts its server). */
  async waitForPing(opts: WaitForPingOptions): Promise<PingResult> {
    const deadline = Date.now() + opts.timeoutMs;
    let last: TaskerConnectionError | TaskerHttpError | undefined;
    for (;;) {
      try {
        const remaining = Math.max(1, deadline - Date.now());
        return await this.json<PingResult>("GET", "/ping", {
          timeoutMs: Math.min(this.timeoutMs, remaining),
        });
      } catch (err) {
        if (!(err instanceof TaskerConnectionError || err instanceof TaskerHttpError)) throw err;
        // A rejected token will not fix itself by waiting.
        if (err instanceof TaskerHttpError && err.status === 401) throw err;
        last = err;
      }
      if (Date.now() + opts.intervalMs >= deadline) break;
      await new Promise<void>((resolve) => setTimeout(resolve, opts.intervalMs));
    }
    throw (
      last ??
      new TaskerConnectionError({
        route: "/ping",
        cause: undefined,
        reason: `no answer within ${opts.timeoutMs} ms`,
      })
    );
  }

  private postJson<T>(path: string, payload: unknown, timeoutMs?: number): Promise<T> {
    return this.json<T>("POST", path, {
      body: JSON.stringify(payload),
      contentType: "application/json",
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });
  }

  private async json<T>(method: string, route: string, opts: RequestOptions = {}): Promise<T> {
    const { status, text } = await this.request(method, route, opts);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      parsed = undefined;
    }
    if (parsed === null || typeof parsed !== "object") {
      throw new TaskerHttpError({
        status,
        route,
        body: text,
        hint: `expected a JSON object but the phone sent: ${snippet(text)}`,
      });
    }
    return parsed as T;
  }

  private async text(method: string, route: string): Promise<string> {
    return (await this.request(method, route, {})).text;
  }

  private async request(
    method: string,
    route: string,
    opts: RequestOptions,
  ): Promise<{ status: number; text: string }> {
    const timeoutMs = opts.timeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}` };
    if (opts.contentType !== undefined) headers["Content-Type"] = opts.contentType;
    const init: RequestInit = { method, headers, signal: controller.signal };
    if (opts.body !== undefined) init.body = opts.body;

    log(`${method} ${route}`);
    try {
      let res: Response;
      let text: string;
      try {
        res = await this.fetchImpl(this.baseUrl + route, init);
        text = await res.text();
      } catch (err) {
        const reason = timedOut ? `timed out after ${timeoutMs} ms` : describe(err);
        throw new TaskerConnectionError({ route, cause: err, reason });
      }
      const body = this.redact(text);
      if (res.status < 200 || res.status >= 300) {
        throw new TaskerHttpError({
          status: res.status,
          route,
          body,
          hint: hintForStatus(res.status, errorText(body)),
        });
      }
      return { status: res.status, text: body };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Never let the token leak, even if the phone echoes it back. */
  private redact(s: string): string {
    return this.token === "" ? s : s.split(this.token).join("[redacted]");
  }
}

/** Pull `{"error": "..."}` out of a body, else fall back to the raw text. */
function errorText(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body.trim());
    if (parsed !== null && typeof parsed === "object" && "error" in parsed) {
      const e = (parsed as { error: unknown }).error;
      if (typeof e === "string") return e;
    }
  } catch {
    // not JSON
  }
  return snippet(body);
}

function snippet(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t === "") return "(empty body)";
  return t.length > 200 ? `${t.slice(0, 200)}...` : t;
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    const causeCode = (err.cause as { code?: unknown } | undefined)?.code;
    const ownCode = (err as { code?: unknown }).code;
    if (typeof causeCode === "string") return causeCode;
    if (typeof ownCode === "string") return ownCode;
    return err.message;
  }
  return String(err);
}
