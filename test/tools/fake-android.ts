/**
 * A fake adb for the uiautomator driver and persist_config: an Exec that
 * plays Tasker's editor as a screen state machine over the real dumps in
 * test/fixtures/ui (captured on the emulator, Tasker 6.6.20).
 *
 *   const android = new FakeAndroid();
 *   createFakeContext({ exec: android.exec, config: { adbSerial: "emulator-5554" } });
 *
 * `am start` shows the main screen (or the nag first, with nagOnStart); a tap
 * at a node's center follows TRANSITIONS; BACK on the restored editor saves
 * (logcat gains the save lines and onSave runs). Every adb call is recorded
 * in `calls` without the leading "-s <serial>".
 */
import { readFileSync } from "node:fs";
import type { Exec, ExecResult } from "../../src/adb.ts";
import { parseUiDump } from "../../src/device/ui.ts";

export function uiFixture(name: string): string {
  return readFileSync(new URL(`../fixtures/ui/${name}.xml`, import.meta.url), "utf8");
}

/** A titled nag dialog like Tasker's trial and battery reminders. */
export const NAG_XML = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">
<node index="0" text="" resource-id="android:id/content" class="android.widget.FrameLayout" content-desc="" clickable="false" bounds="[0,0][1080,2400]">
<node index="0" text="Battery Optimisation" resource-id="android:id/alertTitle" class="android.widget.TextView" content-desc="" clickable="false" bounds="[100,800][980,900]" />
<node index="1" text="Tasker &amp; your battery &lt;info&gt; &#10;&quot;quoted&quot; &apos;x&apos; &#x41;" resource-id="android:id/message" class="android.widget.TextView" content-desc="" clickable="false" bounds="[100,900][980,1200]" />
<node index="2" text="OK" resource-id="android:id/button1" class="android.widget.Button" content-desc="" clickable="true" bounds="[700,1300][900,1400]" />
<node index="3" text="Don't Show Again" resource-id="android:id/button3" class="android.widget.Button" content-desc="" clickable="true" bounds="[100,1300][500,1400]" />
</node></hierarchy>`;

/** The launcher, as far as the tests care. */
export const HOME_XML = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">
<node index="0" text="" resource-id="" class="android.widget.FrameLayout" content-desc="Home" clickable="false" bounds="[0,0][1080,2400]" />
</hierarchy>`;

export type Screen =
  | "home"
  | "nag"
  | "01-start"
  | "02-menu"
  | "03-data"
  | "04-restore"
  | "05-picker"
  | "06-confirm"
  | "07-after"
  | "blank";

/** screen -> label of the tapped node (text, else desc) -> next screen. */
export const TRANSITIONS: Partial<Record<Screen, Record<string, Screen>>> = {
  nag: { "Don't Show Again": "01-start", OK: "01-start" },
  "01-start": { "More options": "02-menu" },
  "02-menu": { Data: "03-data" },
  "03-data": { Restore: "04-restore" },
  "04-restore": { "User Local Backup": "05-picker" },
  "05-picker": { "tasker-mcp-live": "06-confirm", backup: "06-confirm" },
  "06-confirm": { OK: "07-after", CANCEL: "01-start" },
};

export const SAVE_LOG =
  "D/Tasker  ( 1234): 21.26.07#b#T: EXIT: from back: save: true dirty: true must save: false\n" +
  "D/Tasker  ( 1234): 21.26.07#b#T: saveData: ok: true: pCount: 2\n";

export class FakeAndroid {
  screen: Screen = "home";
  readonly calls: string[][] = [];
  /** The picker entry tapped, if any. */
  picked: string | undefined;
  nagOnStart = false;
  windowDump = "    mShowingDream=false mDreamingLockscreen=false\n    isKeyguardShowing=false\n";
  powerDump = "  mWakefulness=Awake\n  mWakefulnessChanging=false\n";
  /** What `logcat -d` prints; BACK on the restored editor sets it to saveLog. */
  logcat = "";
  saveLog = SAVE_LOG;
  /** Fail the next N `uiautomator dump` calls with an ERROR line. */
  dumpErrors = 0;
  /** Exit code for every call whose args include this string. */
  failOn: { match: string; code: number; stderr?: string } | undefined;
  /** Runs when BACK leaves the restored editor (the save). */
  onSave: (() => void) | undefined;
  /** Replace the screen to show for a fixture name (e.g. a picker without the entry). */
  overrides: Partial<Record<Screen, string>> = {};

  xml(screen: Screen = this.screen): string {
    const o = this.overrides[screen];
    if (o !== undefined) return o;
    if (screen === "home") return HOME_XML;
    if (screen === "nag") return NAG_XML;
    if (screen === "blank") return `<hierarchy rotation="0"></hierarchy>`;
    return uiFixture(screen);
  }

  /** Commands as strings, e.g. "shell input keyevent KEYCODE_BACK". */
  commands(): string[] {
    return this.calls.map((c) => c.join(" "));
  }

  private tap(x: number, y: number): void {
    const nodes = parseUiDump(this.xml());
    const table = TRANSITIONS[this.screen] ?? {};
    for (const n of nodes) {
      if (n.x !== x || n.y !== y) continue;
      const label = n.text || n.desc;
      const next = table[label];
      if (next === undefined) continue;
      if (this.screen === "05-picker") this.picked = label;
      this.screen = next;
      return;
    }
  }

  private key(code: string): void {
    if (code === "KEYCODE_HOME") {
      this.screen = "home";
      return;
    }
    if (code === "KEYCODE_BACK") {
      if (this.screen === "07-after") {
        this.logcat += this.saveLog;
        this.onSave?.();
        this.screen = "home";
      } else if (this.screen === "01-start") {
        this.screen = "home";
      } else if (this.screen !== "home") {
        this.screen = "01-start";
      }
    }
  }

  readonly exec: Exec = async (_file, rawArgs): Promise<ExecResult> => {
    const args = rawArgs[0] === "-s" ? rawArgs.slice(2) : rawArgs;
    this.calls.push(args);
    const out = (stdout: string): ExecResult => ({ stdout, stderr: "", code: 0 });
    const f = this.failOn;
    if (f !== undefined && args.join(" ").includes(f.match)) {
      return { stdout: "", stderr: f.stderr ?? "boom", code: f.code };
    }
    if (args[0] !== "shell") return out("");
    const cmd = args.slice(1);
    switch (cmd[0]) {
      case "dumpsys":
        return out(cmd[1] === "window" ? this.windowDump : this.powerDump);
      case "date":
        return out("1791167655\n");
      case "am":
        if (cmd[1] === "start") this.screen = this.nagOnStart ? "nag" : "01-start";
        if (cmd[1] === "force-stop") this.screen = "home";
        return out("Starting: Intent { ... }\n");
      case "uiautomator":
        if (this.dumpErrors > 0) {
          this.dumpErrors--;
          return out("ERROR: could not get idle state.\n");
        }
        return out(`UI hierchary dumped to: ${cmd[3]}\n`);
      case "cat":
        return out(this.xml());
      case "input":
        if (cmd[1] === "tap") this.tap(Number(cmd[2]), Number(cmd[3]));
        if (cmd[1] === "keyevent") this.key(cmd[2] as string);
        return out("");
      case "logcat":
        return out(this.logcat);
      default:
        return out("");
    }
  };
}

/** Timing for tests: no real sleeps, a clock that advances only when slept. */
export function fakeTiming(): {
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  slept: () => number;
} {
  let t = 0;
  return {
    sleep: async (ms: number) => {
      t += ms;
    },
    now: () => t,
    slept: () => t,
  };
}
