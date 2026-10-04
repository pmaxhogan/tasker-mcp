import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskerClient, TaskerConnectionError, TaskerHttpError } from "../../src/client/index.ts";

const TOKEN = "s3cr3t-token-value";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

type Responder = (call: Call, signal: AbortSignal | undefined) => Response | Promise<Response>;

function makeClient(responder: Responder, timeoutMs = 1000) {
  const calls: Call[] = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body as string | undefined,
    };
    calls.push(call);
    return responder(call, init?.signal ?? undefined);
  }) as typeof fetch;
  const client = new TaskerClient({
    baseUrl: "http://127.0.0.1:1821/",
    token: TOKEN,
    timeoutMs,
    fetch: fakeFetch,
  });
  return { client, calls };
}

const json = (obj: unknown, init?: ResponseInit & { type?: string }) =>
  new Response(JSON.stringify(obj) + "\n", {
    status: init?.status ?? 200,
    headers: { "content-type": init?.type ?? "application/json" },
  });

let stderr: string[];
beforeEach(() => {
  stderr = [];
  vi.spyOn(process.stderr, "write").mockImplementation(((chunk: string | Uint8Array) => {
    stderr.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("routes", () => {
  it("ping", async () => {
    const { client, calls } = makeClient(() =>
      json({ ok: true, tasker: "6.6", project: "TaskerMCP", device: "Pixel" }),
    );
    expect(await client.ping()).toEqual({
      ok: true,
      tasker: "6.6",
      project: "TaskerMCP",
      device: "Pixel",
    });
    expect(calls[0]?.url).toBe("http://127.0.0.1:1821/ping");
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0]?.body).toBeUndefined();
  });

  it("backup returns raw XML", async () => {
    const xml = "<TaskerData><Task/></TaskerData>\n";
    const { client } = makeClient(
      () => new Response(xml, { headers: { "content-type": "text/xml" } }),
    );
    expect(await client.backup()).toBe(xml);
  });

  it("list tolerates missing fields", async () => {
    const { client } = makeClient(() => json({ tasks: ["A"] }));
    expect(await client.list()).toEqual({ tasks: ["A"] });
  });

  it("importXml posts xml", async () => {
    const { client, calls } = makeClient(() => json({ ok: true }));
    expect(await client.importXml("<x/>")).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ method: "POST", body: "<x/>" });
    expect(calls[0]?.url).toMatch(/\/import$/);
    expect(calls[0]?.headers["Content-Type"]).toBe("text/xml");
  });

  it("replaceConfig accepts 202", async () => {
    const { client, calls } = makeClient(() =>
      json({ ok: true, restarting: true }, { status: 202 }),
    );
    expect(await client.replaceConfig("<TaskerData/>")).toEqual({ ok: true, restarting: true });
    expect(calls[0]?.url).toMatch(/\/config$/);
  });

  it("run sends the payload as JSON", async () => {
    const { client, calls } = makeClient(() => json({ ok: true, return: "hi", durationMs: 5 }));
    const res = await client.run({ task: "T", par1: "a", variables: { "%x": "1" }, debug: true });
    expect(res).toEqual({ ok: true, return: "hi", durationMs: 5 });
    expect(JSON.parse(calls[0]?.body ?? "")).toEqual({
      task: "T",
      par1: "a",
      variables: { "%x": "1" },
      debug: true,
    });
    expect(calls[0]?.headers["Content-Type"]).toBe("application/json");
  });

  it("stop, getVar, setVar, listVars, setProfileEnabled, command", async () => {
    const { client, calls } = makeClient((c) => {
      if (c.url.endsWith("/vars/get")) return json({ name: "%A", value: "v", set: true });
      if (c.url.endsWith("/vars/list")) return json({ globals: ["%A"] });
      return json({ ok: true });
    });
    expect(await client.stop("T")).toEqual({ ok: true });
    expect(await client.getVar("%A")).toEqual({ name: "%A", value: "v", set: true });
    expect(await client.setVar("%A", "z")).toEqual({ ok: true });
    expect(await client.listVars()).toEqual({ globals: ["%A"] });
    expect(await client.setProfileEnabled("P", false)).toEqual({ ok: true });
    expect(await client.command("echo")).toEqual({ ok: true });
    expect(calls.map((c) => c.url.replace("http://127.0.0.1:1821", ""))).toEqual([
      "/stop",
      "/vars/get",
      "/vars/set",
      "/vars/list",
      "/profile",
      "/command",
    ]);
    expect(JSON.parse(calls[0]?.body ?? "")).toEqual({ task: "T" });
    expect(JSON.parse(calls[1]?.body ?? "")).toEqual({ name: "%A" });
    expect(JSON.parse(calls[2]?.body ?? "")).toEqual({ name: "%A", value: "z" });
    expect(calls[3]?.body).toBeUndefined();
    expect(JSON.parse(calls[4]?.body ?? "")).toEqual({ name: "P", enabled: false });
    expect(JSON.parse(calls[5]?.body ?? "")).toEqual({ command: "echo" });
  });

  it("runLog returns text", async () => {
    const { client } = makeClient(() => new Response("line1\nline2"));
    expect(await client.runLog()).toBe("line1\nline2");
  });

  it("rotateToken", async () => {
    const { client } = makeClient(() => json({ token: "new" }));
    expect(await client.rotateToken()).toEqual({ token: "new" });
  });
});

describe("JSON tolerance", () => {
  it("accepts JSON sent as text/plain with trailing newline", async () => {
    const { client } = makeClient(() => json({ ok: true }, { type: "text/plain" }));
    expect(await client.stop("T")).toEqual({ ok: true });
  });

  it("throws TaskerHttpError with the text when a JSON route returns prose", async () => {
    const { client } = makeClient(() => new Response("Tasker is sleeping"));
    const err = await client.ping().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TaskerHttpError);
    expect((err as TaskerHttpError).hint).toContain("Tasker is sleeping");
    expect((err as TaskerHttpError).status).toBe(200);
  });

  it("rejects JSON that is not an object and empty bodies", async () => {
    const a = makeClient(() => new Response("42"));
    await expect(a.client.ping()).rejects.toBeInstanceOf(TaskerHttpError);
    const b = makeClient(() => new Response(""));
    await expect(b.client.ping()).rejects.toThrow(/empty body/);
    const c = makeClient(() => new Response("null"));
    await expect(c.client.ping()).rejects.toBeInstanceOf(TaskerHttpError);
  });
});

describe("http errors", () => {
  it("401 hints at the token", async () => {
    const { client } = makeClient(() => json({ error: "unauthorized" }, { status: 401 }));
    const err = (await client.ping().catch((e: unknown) => e)) as TaskerHttpError;
    expect(err).toBeInstanceOf(TaskerHttpError);
    expect(err.status).toBe(401);
    expect(err.route).toBe("/ping");
    expect(err.body).toContain("unauthorized");
    expect(err.hint).toContain("TaskerMCP.Setup");
    expect(err.hint).toContain("TASKER_TOKEN");
    expect(err.hint).toContain("--token-file");
    expect(err.message).toContain("token rejected");
  });

  it("404 hints at updating the project", async () => {
    const { client } = makeClient(() => new Response("nope", { status: 404 }));
    const err = (await client.list().catch((e: unknown) => e)) as TaskerHttpError;
    expect(err.status).toBe(404);
    expect(err.hint).toContain("tasker/TaskerMCP.prj.xml");
  });

  it("5xx includes the phone's error text", async () => {
    const { client } = makeClient(() => json({ error: "task not found: Foo" }, { status: 500 }));
    const err = (await client.run({ task: "Foo" }).catch((e: unknown) => e)) as TaskerHttpError;
    expect(err.status).toBe(500);
    expect(err.hint).toContain("task not found: Foo");
  });

  it("5xx with a non-JSON or empty body still reports something", async () => {
    const a = makeClient(() => new Response("kaboom", { status: 503 }));
    await expect(a.client.ping()).rejects.toThrow(/kaboom/);
    const b = makeClient(() => new Response("", { status: 500 }));
    await expect(b.client.ping()).rejects.toThrow(/empty body/);
    const c = makeClient(() => json({ error: 5 }, { status: 500 }));
    await expect(c.client.ping()).rejects.toThrow(/HTTP 500/);
  });

  it("other 4xx uses the error text, or a generic message", async () => {
    const a = makeClient(() => json({ error: "bad xml" }, { status: 400 }));
    const err = (await a.client.importXml("<").catch((e: unknown) => e)) as TaskerHttpError;
    expect(err.hint).toBe("bad xml");
    const long = makeClient(() => new Response("x".repeat(500), { status: 400 }));
    const e2 = (await long.client.ping().catch((e: unknown) => e)) as TaskerHttpError;
    expect(e2.hint.length).toBeLessThan(250);
    expect(e2.body.length).toBe(500);
  });
});

describe("connection errors", () => {
  function refused(code: string) {
    return () => {
      const cause = Object.assign(new Error(`connect ${code}`), { code });
      throw new TypeError("fetch failed", { cause });
    };
  }

  it.each(["ECONNREFUSED", "ENOTFOUND"])("%s", async (code) => {
    const { client } = makeClient(refused(code));
    const err = (await client.ping().catch((e: unknown) => e)) as TaskerConnectionError;
    expect(err).toBeInstanceOf(TaskerConnectionError);
    expect(err.message).toContain(code);
    expect(err.hint).toContain("TaskerMCP HTTP");
    expect(err.hint).toContain("adb forward tcp:1821 tcp:1821");
    expect(err.hint).toContain("TASKER_URL");
    expect(err.cause).toBeInstanceOf(TypeError);
  });

  it("falls back to the message, a direct code, or String()", async () => {
    const a = makeClient(() => {
      throw new Error("boom");
    });
    await expect(a.client.ping()).rejects.toThrow(/boom/);
    const b = makeClient(() => {
      throw Object.assign(new Error("x"), { code: "ECONNRESET" });
    });
    await expect(b.client.ping()).rejects.toThrow(/ECONNRESET/);
    const c = makeClient(() => {
      throw "weird";
    });
    await expect(c.client.ping()).rejects.toThrow(/weird/);
  });

  it("times out via AbortController", async () => {
    const { client } = makeClient(
      (_c, signal) =>
        new Promise<Response>((_res, rej) => {
          signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
        }),
      20,
    );
    const err = (await client.ping().catch((e: unknown) => e)) as TaskerConnectionError;
    expect(err).toBeInstanceOf(TaskerConnectionError);
    expect(err.message).toContain("timed out after 20 ms");
    expect(err.hint).toContain("TaskerMCP HTTP");
  });

  it("run extends the timeout to timeoutSec + 15s", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const { client } = makeClient(
      (_c, signal) =>
        new Promise<Response>((_res, rej) => {
          signal?.addEventListener("abort", () => {
            aborted = true;
            rej(new DOMException("aborted", "AbortError"));
          });
        }),
      1000,
    );
    const p = client.run({ task: "Slow", timeoutSec: 10 }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(24_900);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(aborted).toBe(true);
    const err = (await p) as TaskerConnectionError;
    expect(err.message).toContain("timed out after 25000 ms");
  });

  it("run without timeoutSec uses the client timeout; small timeoutSec never shrinks it", async () => {
    vi.useFakeTimers();
    const hang = (_c: Call, signal: AbortSignal | undefined) =>
      new Promise<Response>((_res, rej) => {
        signal?.addEventListener("abort", () => rej(new Error("aborted")));
      });
    const a = makeClient(hang, 60_000);
    const pa = a.client.run({ task: "T", timeoutSec: 1 }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(((await pa) as Error).message).toContain("60000 ms");
    const b = makeClient(hang, 500);
    const pb = b.client.run({ task: "T" }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(500);
    expect(((await pb) as Error).message).toContain("500 ms");
  });
});

describe("waitForPing", () => {
  const pingBody = { ok: true, tasker: "6", project: "P", device: "D" };

  it("retries until the phone answers", async () => {
    vi.useFakeTimers();
    let n = 0;
    const { client } = makeClient(() => {
      n++;
      if (n < 3) throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
      return json(pingBody);
    });
    const p = client.waitForPing({ timeoutMs: 10_000, intervalMs: 500 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toEqual(pingBody);
    expect(n).toBe(3);
  });

  it("retries on 5xx too", async () => {
    vi.useFakeTimers();
    let n = 0;
    const { client } = makeClient(() =>
      ++n < 2 ? json({ error: "starting" }, { status: 503 }) : json(pingBody),
    );
    const p = client.waitForPing({ timeoutMs: 10_000, intervalMs: 100 });
    await vi.advanceTimersByTimeAsync(200);
    expect(await p).toEqual(pingBody);
  });

  it("gives up with the last error at the deadline", async () => {
    vi.useFakeTimers();
    const { client } = makeClient(() => {
      throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
    });
    const p = client.waitForPing({ timeoutMs: 1000, intervalMs: 300 }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(2000);
    const err = await p;
    expect(err).toBeInstanceOf(TaskerConnectionError);
    expect((err as Error).message).toContain("ECONNREFUSED");
  });

  it("fails immediately on 401", async () => {
    const { client, calls } = makeClient(() => json({ error: "no" }, { status: 401 }));
    await expect(client.waitForPing({ timeoutMs: 5000, intervalMs: 100 })).rejects.toThrow(
      /token rejected/,
    );
    expect(calls).toHaveLength(1);
  });

  it("throws a connection error when the deadline passes with no attempt result", async () => {
    const { client } = makeClient(() => json(pingBody));
    // timeoutMs 0 still makes one attempt and returns it.
    expect(await client.waitForPing({ timeoutMs: 0, intervalMs: 10 })).toEqual(pingBody);
  });

  it("rethrows unexpected errors", async () => {
    const { client } = makeClient(() => new Response("not json"));
    // Non-JSON 200 is a TaskerHttpError, which is retried until the deadline then rethrown.
    await expect(client.waitForPing({ timeoutMs: 0, intervalMs: 10 })).rejects.toBeInstanceOf(
      TaskerHttpError,
    );
  });
});

describe("token redaction", () => {
  it("never appears in error messages, hints, bodies, or log lines", async () => {
    const cases: Responder[] = [
      () => json({ error: `bad token ${TOKEN}` }, { status: 401 }),
      () => json({ error: `boom ${TOKEN}` }, { status: 500 }),
      () => new Response(`echo ${TOKEN}`, { status: 404 }),
      () => new Response(`echo ${TOKEN}`),
      () => {
        throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
      },
    ];
    for (const responder of cases) {
      const { client } = makeClient(responder);
      const err = (await client.ping().catch((e: unknown) => e)) as Error;
      expect(err).toBeInstanceOf(Error);
      const dump = JSON.stringify({
        message: err.message,
        stack: err.stack,
        status: (err as { status?: number }).status,
        body: (err as { body?: string }).body,
        hint: (err as { hint?: string }).hint,
      });
      expect(dump).not.toContain(TOKEN);
    }
    expect(stderr.length).toBeGreaterThan(0);
    expect(stderr.join("")).not.toContain(TOKEN);
  });

  it("redacts the token from successful bodies too", async () => {
    const { client } = makeClient(() => new Response(`xml ${TOKEN}`));
    expect(await client.backup()).toBe("xml [redacted]");
  });

  it("tolerates an empty token", async () => {
    const client = new TaskerClient({
      baseUrl: "http://h",
      token: "",
      timeoutMs: 100,
      fetch: (async () => new Response("ok")) as typeof fetch,
    });
    expect(await client.runLog()).toBe("ok");
  });

  it("uses global fetch when none is injected", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("hello"));
    const client = new TaskerClient({ baseUrl: "http://h", token: "t", timeoutMs: 100 });
    expect(await client.runLog()).toBe("hello");
    expect(spy).toHaveBeenCalled();
  });
});
