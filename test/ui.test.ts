import { describe, expect, it } from "vitest";
import { AdbError, SPAWN_FAILED, type Exec } from "../src/adb.ts";
import {
  DUMP_PATH,
  findNodes,
  isAlertShowing,
  matches,
  parseScreenState,
  parseUiDump,
  UiDriver,
} from "../src/device/ui.ts";
import { FakeAndroid, fakeTiming, NAG_XML, uiFixture } from "./tools/fake-android.ts";

function driver(android: FakeAndroid, opts: { now?: () => number } = {}): UiDriver {
  const t = fakeTiming();
  return new UiDriver({
    exec: android.exec,
    adbPath: "adb",
    serial: "emulator-5554",
    sleep: t.sleep,
    now: opts.now ?? t.now,
  });
}

describe("parseUiDump", () => {
  it("parses the Tasker main screen", () => {
    const nodes = parseUiDump(uiFixture("01-start"));
    const more = findNodes(nodes, "desc:More options")[0];
    expect(more).toMatchObject({ cls: "ImageButton", desc: "More options" });
    expect(more?.x).toBeGreaterThan(0);
    const task = findNodes(nodes, "text=TaskerMCP.Dispatch")[0];
    expect(task?.id).toBe("net.dinglisch.android.taskerm:id/name");
  });

  it("decodes entities and computes centers", () => {
    const nodes = parseUiDump(NAG_XML);
    expect(nodes[2]?.text).toBe("Tasker & your battery <info> \n\"quoted\" 'x' A");
    const ok = findNodes(nodes, "text=OK")[0];
    expect(ok).toMatchObject({
      x: 800,
      y: 1350,
      clickable: true,
      bounds: { left: 700, top: 1300, right: 900, bottom: 1400 },
    });
  });

  it("skips nodes without bounds and missing attributes", () => {
    const nodes = parseUiDump(
      `<hierarchy><node text="a" /><node bounds="[0,0][10,20]" /></hierarchy>`,
    );
    expect(nodes).toEqual([
      {
        text: "",
        id: "",
        desc: "",
        cls: "",
        clickable: false,
        x: 5,
        y: 10,
        bounds: { left: 0, top: 0, right: 10, bottom: 20 },
      },
    ]);
  });
});

describe("matches", () => {
  const [node] = parseUiDump(
    `<node text="Restore Data" resource-id="pkg:id/name" content-desc="Undo It" bounds="[0,0][2,2]"/>`,
  );
  it("supports every query form", () => {
    const n = node as NonNullable<typeof node>;
    expect(matches(n, "id:id/name")).toBe(true);
    expect(matches(n, "id:id/other")).toBe(false);
    expect(matches(n, "desc:undo")).toBe(true);
    expect(matches(n, "desc:redo")).toBe(false);
    expect(matches(n, "text=Restore Data")).toBe(true);
    expect(matches(n, "text=Restore")).toBe(false);
    expect(matches(n, "restore")).toBe(true);
    expect(matches(n, "UNDO")).toBe(true);
    expect(matches(n, "nothing")).toBe(false);
  });
});

describe("isAlertShowing and parseScreenState", () => {
  it("detects titled alerts only", () => {
    expect(isAlertShowing(parseUiDump(NAG_XML))).toBe(true);
    expect(isAlertShowing(parseUiDump(uiFixture("06-confirm")))).toBe(false);
    expect(
      isAlertShowing(parseUiDump(`<node resource-id="x:id/title_template" bounds="[0,0][1,1]"/>`)),
    ).toBe(true);
  });

  it("reads lock and sleep state", () => {
    const awake = "mWakefulness=Awake";
    expect(parseScreenState("isKeyguardShowing=false", awake)).toEqual({
      locked: false,
      asleep: false,
    });
    expect(parseScreenState("isKeyguardShowing=true", awake).locked).toBe(true);
    expect(parseScreenState("mDreamingLockscreen=true", awake).locked).toBe(true);
    expect(parseScreenState("", "mWakefulness=Asleep").asleep).toBe(true);
    expect(parseScreenState("", "mWakefulness=Dozing").asleep).toBe(true);
  });
});

describe("UiDriver", () => {
  it("prefixes every command with the serial and taps node centers", async () => {
    const android = new FakeAndroid();
    android.screen = "01-start";
    const calls: string[][] = [];
    const exec: Exec = async (file, args, opts) => {
      calls.push([file, ...args]);
      return android.exec(file, args, opts);
    };
    const ui = new UiDriver({ exec, adbPath: "/opt/adb", serial: "S1", sleep: async () => {} });
    const hit = await ui.tap("desc:More options");
    expect(android.screen).toBe("02-menu");
    expect(calls.at(0)).toEqual([
      "/opt/adb",
      "-s",
      "S1",
      "shell",
      "uiautomator",
      "dump",
      DUMP_PATH,
    ]);
    expect(calls.at(-1)).toEqual([
      "/opt/adb",
      "-s",
      "S1",
      "shell",
      "input",
      "tap",
      String(hit.x),
      String(hit.y),
    ]);
    expect(ui.lastDump.length).toBeGreaterThan(0);
  });

  it("retries a failed dump, then gives up", async () => {
    const android = new FakeAndroid();
    android.screen = "01-start";
    android.dumpErrors = 2;
    const ui = driver(android);
    expect((await ui.dump()).length).toBeGreaterThan(0);
    android.dumpErrors = 3;
    await expect(ui.dump()).rejects.toThrow(/uiautomator dump failed: ERROR: could not get idle/);
    android.screen = "blank";
    await expect(ui.dump()).rejects.toThrow(/empty hierarchy/);
  });

  it("turns a failing uiautomator into a retry", async () => {
    const android = new FakeAndroid();
    android.failOn = { match: "uiautomator", code: 1, stderr: "device offline" };
    await expect(driver(android).dump(2)).rejects.toThrow(/device offline/);
  });

  it("maps adb failures to AdbError", async () => {
    const android = new FakeAndroid();
    const ui = driver(android);
    android.failOn = { match: "keyevent", code: SPAWN_FAILED, stderr: "spawn adb ENOENT" };
    const missing = await ui.key("HOME").catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(AdbError);
    expect((missing as AdbError).code).toBe("adb-missing");
    android.failOn = { match: "keyevent", code: 1, stderr: "error: device offline" };
    const failed = await ui.key("BACK").catch((e: unknown) => e);
    expect((failed as AdbError).code).toBe("adb-failed");
    expect((failed as Error).message).toMatch(/device offline/);
  });

  it("sends key events with or without the KEYCODE_ prefix", async () => {
    const android = new FakeAndroid();
    const ui = driver(android);
    await ui.key("HOME");
    await ui.key("KEYCODE_BACK");
    expect(android.commands()).toEqual([
      "shell input keyevent KEYCODE_HOME",
      "shell input keyevent KEYCODE_BACK",
    ]);
  });

  it("throws when nothing matches a tap", async () => {
    const android = new FakeAndroid();
    android.screen = "01-start";
    await expect(driver(android).tap("text=Nope", 0)).rejects.toThrow(
      /no node matches "text=Nope"/,
    );
    await expect(driver(android).tap("desc:More options", 5)).rejects.toThrow(/index 5/);
  });

  it("waitFor polls until a node appears", async () => {
    const android = new FakeAndroid();
    android.screen = "home";
    let polls = 0;
    const ui = driver(android);
    const hit = await ui.waitFor("text=Data", 10_000, async () => {
      polls++;
      if (polls === 2) android.screen = "02-menu";
      return false;
    });
    expect(hit.text).toBe("Data");
    // The change made during poll 2 is seen by the dump of poll 3.
    expect(polls).toBe(3);
  });

  it("waitFor re-dumps at once when onPoll changed the screen", async () => {
    const android = new FakeAndroid();
    android.screen = "nag";
    const ui = driver(android);
    const hit = await ui.waitFor("desc:More options", 10_000, (nodes) => ui.dismissNag(nodes));
    expect(hit.desc).toBe("More options");
    expect(android.commands()).toContain("shell input tap 300 1350");
  });

  it("waitFor times out naming what the screen shows", async () => {
    const android = new FakeAndroid();
    android.screen = "03-data";
    const ui = driver(android);
    await expect(ui.waitFor((n) => n.text === "Nope", 2000)).rejects.toThrow(
      /timed out waiting for the expected screen; the screen shows: .*Restore/,
    );
    android.screen = "home";
    await expect(ui.waitFor("text=Nope", 0)).rejects.toThrow(
      /timed out waiting for "text=Nope"; the screen shows: Home/,
    );
    android.screen = "blank";
    android.overrides.blank = `<node bounds="[0,0][1,1]"/>`;
    await expect(ui.waitFor("text=Nope", 0)).rejects.toThrow(/the screen shows: nothing/);
  });

  it("dismisses nags but leaves untitled dialogs alone", async () => {
    const android = new FakeAndroid();
    android.screen = "06-confirm";
    const ui = driver(android);
    expect(await ui.dismissNag()).toBe(false);
    expect(android.screen).toBe("06-confirm");
    android.screen = "nag";
    expect(await ui.dismissNags()).toBe(1);
    expect(android.screen).toBe("01-start");
    // A titled alert with no known button stays.
    android.screen = "blank";
    android.overrides.blank = `<node resource-id="android:id/alertTitle" text="Hm" bounds="[0,0][1,1]"/>`;
    expect(await ui.dismissNag()).toBe(false);
  });

  it("dismissNags stops at max", async () => {
    const android = new FakeAndroid();
    android.screen = "nag";
    android.overrides["01-start"] = NAG_XML;
    expect(await driver(android).dismissNags(3)).toBe(3);
  });

  it("reads the screen state", async () => {
    const android = new FakeAndroid();
    const ui = driver(android);
    expect(await ui.screenState()).toEqual({ locked: false, asleep: false });
    android.windowDump = "isKeyguardShowing=true";
    android.powerDump = "mWakefulness=Asleep";
    expect(await ui.screenState()).toEqual({ locked: true, asleep: true });
  });

  it("uses real defaults when no timing is injected", async () => {
    const android = new FakeAndroid();
    android.screen = "01-start";
    const ui = new UiDriver({ exec: android.exec, adbPath: "adb", serial: "S", settleMs: 0 });
    const start = Date.now();
    await ui.sleep(5);
    expect(Date.now() - start).toBeGreaterThanOrEqual(4);
    expect((await ui.find("text=TASKS")).length).toBe(1);
  });
});
