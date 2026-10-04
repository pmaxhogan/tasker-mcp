import { describe, expect, it, vi } from "vitest";
import {
  AdbError,
  defaultExec,
  ensureForward,
  forward,
  listDevices,
  logcat,
  parseDevices,
  pickDevice,
  type AdbDevice,
  type Exec,
} from "../src/adb.ts";

const DEVICES_OUT = `List of devices attached
2G0YC1ZG3X078G         unauthorized transport_id:2
43150DLJH001WK         device usb:1-2 product:shiba model:Pixel_8 device:shiba transport_id:5
adb-43150DLJH001WK-2PWRiv._adb-tls-connect._tcp device product:shiba model:Pixel_8 device:shiba transport_id:3
emulator-5554          device product:sdk_gphone model:sdk_gphone device:emu transport_id:4

`;

const ok = (stdout: string) => ({ stdout, stderr: "", code: 0 });
const fake = (res: { stdout?: string; stderr?: string; code?: number }): Exec =>
  vi.fn(async () => ({ stdout: "", stderr: "", code: 0, ...res }));

describe("parseDevices", () => {
  it("parses fields and dedupes the mDNS twin of a USB serial", () => {
    const devs = parseDevices(DEVICES_OUT);
    expect(devs.map((d) => d.serial)).toEqual([
      "2G0YC1ZG3X078G",
      "43150DLJH001WK",
      "emulator-5554",
    ]);
    expect(devs[1]).toMatchObject({
      state: "device",
      model: "Pixel_8",
      product: "shiba",
      transport: "5",
    });
  });

  it("keeps an mDNS entry that has no other matching entry", () => {
    const devs = parseDevices(
      "List of devices attached\nadb-AAA-xyz._adb-tls-connect._tcp device model:P\n",
    );
    expect(devs).toHaveLength(1);
    expect(devs[0]?.serial).toBe("adb-AAA-xyz._adb-tls-connect._tcp");
  });

  it("skips daemon noise, blank and malformed lines", () => {
    const devs = parseDevices(
      "* daemon not running\n* daemon started\nList of devices attached\nlonely\r\nS1 offline\r\n",
    );
    expect(devs).toEqual([{ serial: "S1", state: "offline" }]);
  });
});

describe("listDevices", () => {
  it("runs adb devices -l", async () => {
    const exec = fake({ stdout: DEVICES_OUT });
    const devs = await listDevices(exec, "adb");
    expect(devs).toHaveLength(3);
    expect(exec).toHaveBeenCalledWith("adb", ["devices", "-l"], { timeoutMs: 15000 });
  });

  it("raises adb-missing when the binary cannot spawn", async () => {
    const err = await listDevices(fake({ code: 127, stderr: "spawn adb ENOENT" }), "adb").catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AdbError);
    expect((err as AdbError).code).toBe("adb-missing");
    expect((err as AdbError).message).toContain("TASKER_ADB");
  });

  it("raises adb-failed on non-zero exit", async () => {
    await expect(listDevices(fake({ code: 1, stderr: "boom" }), "adb")).rejects.toMatchObject({
      code: "adb-failed",
    });
  });
});

describe("pickDevice", () => {
  const dev = (serial: string, state = "device"): AdbDevice => ({ serial, state });

  it("returns the single usable device, ignoring unauthorized ones", () => {
    expect(pickDevice([dev("a", "unauthorized"), dev("b")]).serial).toBe("b");
  });

  it("honors a preferred serial among several", () => {
    expect(pickDevice([dev("a"), dev("b")], "b").serial).toBe("b");
  });

  it("errors when several are usable, naming the env vars", () => {
    const run = () => pickDevice([dev("a"), dev("b")]);
    expect(run).toThrow(/TASKER_ADB_SERIAL/);
    expect(run).toThrow(/TASKER_URL/);
    expect(run).toThrow(AdbError);
  });

  it("errors with zero devices", () => {
    expect(() => pickDevice([])).toThrow(/No adb devices found/);
    expect(() => pickDevice([dev("a", "unauthorized")])).toThrow(/No usable adb device.*a/);
  });

  it("errors on a missing or unready preferred serial", () => {
    expect(() => pickDevice([dev("a")], "zzz")).toThrow(/"zzz" is not connected/);
    expect(() => pickDevice([], "zzz")).toThrow(/Connected: none/);
    expect(() => pickDevice([dev("a", "unauthorized")], "a")).toThrow(/USB debugging prompt/);
    expect(() => pickDevice([dev("a", "offline")], "a")).toThrow(/reconnect/);
  });
});

describe("forward", () => {
  it("runs adb -s serial forward", async () => {
    const exec = fake({});
    await forward(exec, "adb", "S1", 1821, 1821);
    expect(exec).toHaveBeenCalledWith(
      "adb",
      ["-s", "S1", "forward", "tcp:1821", "tcp:1821"],
      expect.anything(),
    );
  });

  it("fails with a hint", async () => {
    await expect(forward(fake({ code: 1, stderr: "in use" }), "adb", "S1", 1, 2)).rejects.toThrow(
      /port 1 is free/,
    );
  });
});

describe("logcat", () => {
  const NOW = 1_800_000_000_000;
  const out = [
    "--------- beginning of main",
    "10-04 18:21:48.929 I/Tasker( 123): Task started",
    "10-04 18:21:49.000 D/Other( 5): nope",
    "10-04 18:21:50.000 E/TaskerAction( 123): bad action",
    "10-04 18:21:51.000 I/Foo( 9): ran taskerm thing",
    "10-04 18:21:52.000 I/TaskerData( 9): not an exact tag",
    "",
  ].join("\n");

  it("uses an epoch -T and filters to Tasker tags", async () => {
    const exec = fake({ stdout: out });
    const lines = await logcat(exec, "adb", "S1", { seconds: 60, now: () => NOW });
    expect(exec).toHaveBeenCalledWith(
      "adb",
      ["-s", "S1", "logcat", "-d", "-v", "time", "-T", "1799999940.000"],
      expect.anything(),
    );
    expect(lines).toEqual([
      "10-04 18:21:48.929 I/Tasker( 123): Task started",
      "10-04 18:21:50.000 E/TaskerAction( 123): bad action",
      "10-04 18:21:51.000 I/Foo( 9): ran taskerm thing",
    ]);
  });

  it("applies custom tags and a text filter", async () => {
    const exec = fake({ stdout: out });
    expect(await logcat(exec, "adb", "S", { seconds: 5, tags: ["Other"] })).toEqual([
      "10-04 18:21:49.000 D/Other( 5): nope",
      "10-04 18:21:51.000 I/Foo( 9): ran taskerm thing",
    ]);
    expect(await logcat(exec, "adb", "S", { seconds: 5, filter: "BAD" })).toEqual([
      "10-04 18:21:50.000 E/TaskerAction( 123): bad action",
    ]);
  });

  it("escapes regex characters in tags", async () => {
    const exec = fake({
      stdout: "10-04 18:21:49.000 D/a.b( 5): x\n10-04 18:21:49.000 D/aXb( 5): y",
    });
    expect(await logcat(exec, "adb", "S", { seconds: 5, tags: ["a.b"] })).toHaveLength(1);
  });

  it("caps at 2000 lines keeping the newest", async () => {
    const many = Array.from({ length: 2500 }, (_, i) => `10-04 00:00:00.000 I/Tasker( 1): n${i}`);
    const lines = await logcat(fake({ stdout: many.join("\n") }), "adb", "S", { seconds: 5 });
    expect(lines).toHaveLength(2000);
    expect(lines.at(-1)).toContain("n2499");
    expect(lines[0]).toContain("n500");
  });

  it("fails with adb-failed", async () => {
    await expect(
      logcat(fake({ code: 1, stderr: "x" }), "adb", "S", { seconds: 5 }),
    ).rejects.toMatchObject({ code: "adb-failed" });
  });
});

describe("ensureForward", () => {
  it("returns config.url without touching adb", async () => {
    const exec = fake({});
    expect(
      await ensureForward({ url: "http://h:1", adbSerial: undefined, adbPath: "adb" }, exec),
    ).toBe("http://h:1");
    expect(exec).not.toHaveBeenCalled();
  });

  it("lists, picks, forwards and returns the localhost url", async () => {
    const calls: string[][] = [];
    const exec: Exec = async (_f, args) => {
      calls.push(args);
      return args[0] === "devices" ? ok(DEVICES_OUT) : ok("");
    };
    const url = await ensureForward(
      { url: undefined, adbSerial: "emulator-5554", adbPath: "adb" },
      exec,
    );
    expect(url).toBe("http://localhost:1821");
    expect(calls[1]).toEqual(["-s", "emulator-5554", "forward", "tcp:1821", "tcp:1821"]);
  });

  it("propagates ambiguity errors", async () => {
    const exec: Exec = async () => ok(DEVICES_OUT);
    await expect(
      ensureForward({ url: undefined, adbSerial: undefined, adbPath: "adb" }, exec),
    ).rejects.toMatchObject({ code: "multiple-devices" });
  });

  it("defaults to the real exec and reports a missing binary", async () => {
    await expect(
      ensureForward({
        url: undefined,
        adbSerial: undefined,
        adbPath: "definitely-no-such-adb-xyz",
      }),
    ).rejects.toMatchObject({ code: "adb-missing" });
  });
});

describe("defaultExec", () => {
  it("captures stdout and a zero exit code", async () => {
    const res = await defaultExec(process.execPath, ["-e", "process.stdout.write('hi')"], {
      timeoutMs: 20000,
    });
    expect(res).toEqual({ stdout: "hi", stderr: "", code: 0 });
  });

  it("returns the child's non-zero exit code", async () => {
    const res = await defaultExec(process.execPath, [
      "-e",
      "process.stderr.write('e');process.exit(3)",
    ]);
    expect(res.code).toBe(3);
    expect(res.stderr).toBe("e");
  });

  it("reports spawn failure as 127", async () => {
    const res = await defaultExec("definitely-no-such-binary-xyz", []);
    expect(res.code).toBe(127);
    expect(res.stderr).not.toBe("");
  });
});
