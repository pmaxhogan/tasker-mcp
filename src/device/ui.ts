/**
 * A small uiautomator driver over adb, for the few Tasker GUI steps the HTTP
 * API cannot do (persist_config drives the editor's Data > Restore). Typed
 * port of scripts/device/ui.mjs on the injectable Exec, so tests feed it
 * canned dumps.
 *
 * A query is a case-insensitive substring of text or content-desc, or
 * `id:<resource-id suffix>`, `desc:<content-desc substring>`, `text=<exact text>`.
 */
import { AdbError, SPAWN_FAILED, type Exec, type ExecResult } from "../adb.ts";

export interface UiNode {
  text: string;
  /** Full resource-id, e.g. "net.dinglisch.android.taskerm:id/name". */
  id: string;
  desc: string;
  /** Last segment of the class name, e.g. "TextView". */
  cls: string;
  clickable: boolean;
  /** Center of the bounds. */
  x: number;
  y: number;
  bounds: { left: number; top: number; right: number; bottom: number };
}

/** Where `uiautomator dump` writes on the device. */
export const DUMP_PATH = "/sdcard/tasker-mcp-ui.xml";

const ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  amp: "&",
};

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|quot|apos|lt|gt|amp);/g, (_m, e: string) => {
    if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith("#")) return String.fromCodePoint(Number(e.slice(1)));
    return ENTITIES[e] as string;
  });
}

const BOUNDS_RE = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/;

/** Parse a `uiautomator dump` hierarchy into flat nodes (document order). */
export function parseUiDump(xml: string): UiNode[] {
  const nodes: UiNode[] = [];
  for (const m of xml.matchAll(/<node\b([^>]*?)\/?>/g)) {
    const attrs: Record<string, string> = {};
    for (const a of (m[1] as string).matchAll(/([\w-]+)="([^"]*)"/g)) {
      attrs[a[1] as string] = decode(a[2] as string);
    }
    const b = BOUNDS_RE.exec(attrs["bounds"] ?? "");
    if (!b) continue;
    const [left, top, right, bottom] = [b[1], b[2], b[3], b[4]].map(Number) as [
      number,
      number,
      number,
      number,
    ];
    nodes.push({
      text: attrs["text"] ?? "",
      id: attrs["resource-id"] ?? "",
      desc: attrs["content-desc"] ?? "",
      cls: (attrs["class"] ?? "").split(".").pop() as string,
      clickable: attrs["clickable"] === "true",
      x: Math.round((left + right) / 2),
      y: Math.round((top + bottom) / 2),
      bounds: { left, top, right, bottom },
    });
  }
  return nodes;
}

export function matches(node: UiNode, q: string): boolean {
  if (q.startsWith("id:")) return node.id.endsWith(q.slice(3));
  if (q.startsWith("desc:")) return node.desc.toLowerCase().includes(q.slice(5).toLowerCase());
  if (q.startsWith("text=")) return node.text === q.slice(5);
  const l = q.toLowerCase();
  return node.text.toLowerCase().includes(l) || node.desc.toLowerCase().includes(l);
}

export function findNodes(nodes: UiNode[], q: string): UiNode[] {
  return nodes.filter((n) => matches(n, q));
}

/** Whether an AlertDialog with a title is on screen (the nag dialogs are). */
export function isAlertShowing(nodes: UiNode[]): boolean {
  return nodes.some((n) => n.id === "android:id/alertTitle" || n.id.endsWith(":id/title_template"));
}

/** Buttons that dismiss Tasker's nag dialogs, in preference order. */
export const NAG_BUTTONS = ["text=Don't Show Again", "text=STOP REMINDING", "text=OK"];

export interface ScreenState {
  /** Keyguard (lock screen) showing. */
  locked: boolean;
  /** Screen off, dozing, or dreaming. */
  asleep: boolean;
}

/** Parse `dumpsys window` and `dumpsys power` for the lock and sleep state. */
export function parseScreenState(windowDump: string, powerDump: string): ScreenState {
  return {
    locked:
      /isKeyguardShowing=true/.test(windowDump) || /mDreamingLockscreen=true/.test(windowDump),
    asleep: /mWakefulness=(Asleep|Dozing|Dreaming)/.test(powerDump),
  };
}

export interface UiDriverOptions {
  exec: Exec;
  adbPath: string;
  serial: string;
  /** Injectable sleep (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable clock for waitFor timeouts. */
  now?: () => number;
  /** waitFor poll interval (default 500 ms). */
  pollMs?: number;
  /** Pause after a tap or key so the screen settles (default 400 ms). */
  settleMs?: number;
}

const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class UiDriver {
  readonly serial: string;
  private readonly exec: Exec;
  private readonly adbPath: string;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly pollMs: number;
  private readonly settleMs: number;
  /** The nodes of the most recent successful dump (a dump costs about 2 s). */
  lastDump: UiNode[] = [];

  constructor(opts: UiDriverOptions) {
    this.exec = opts.exec;
    this.adbPath = opts.adbPath;
    this.serial = opts.serial;
    this.sleepFn = opts.sleep ?? realSleep;
    this.now = opts.now ?? Date.now;
    this.pollMs = opts.pollMs ?? 500;
    this.settleMs = opts.settleMs ?? 400;
  }

  sleep(ms: number): Promise<void> {
    return this.sleepFn(ms);
  }

  /** Run `adb -s <serial> <args>`; throws an AdbError on a non-zero exit. */
  async adb(args: string[], timeoutMs = 30_000): Promise<ExecResult> {
    const res = await this.exec(this.adbPath, ["-s", this.serial, ...args], { timeoutMs });
    if (res.code === SPAWN_FAILED) {
      throw new AdbError(
        "adb-missing",
        `Could not run "${this.adbPath}": ${res.stderr.trim()}.`,
        "Install Android platform-tools and put adb on PATH, or set TASKER_ADB to its full path.",
      );
    }
    if (res.code !== 0) {
      throw new AdbError(
        "adb-failed",
        `adb ${args.join(" ")} failed on ${this.serial} (exit ${res.code}): ${(res.stderr || res.stdout).trim()}.`,
        "Check that the device is connected and authorized (adb devices -l).",
      );
    }
    return res;
  }

  /** `adb shell <args>`, returning stdout. */
  async shell(...args: string[]): Promise<string> {
    return (await this.adb(["shell", ...args])).stdout;
  }

  /**
   * Dump the current screen. uiautomator fails now and then ("could not get
   * idle state", "null root node") while the screen animates, so it retries.
   */
  async dump(attempts = 3): Promise<UiNode[]> {
    let last = "";
    for (let i = 0; i < attempts; i++) {
      const out = await this.adb(["shell", "uiautomator", "dump", DUMP_PATH]).then(
        (r) => r.stdout + r.stderr,
        (e: unknown) => `ERROR: ${(e as Error).message}`,
      );
      if (!/ERROR|Exception/i.test(out)) {
        const xml = await this.shell("cat", DUMP_PATH);
        const nodes = parseUiDump(xml);
        if (nodes.length > 0) {
          this.lastDump = nodes;
          return nodes;
        }
        last = "empty hierarchy";
      } else {
        last = out.trim();
      }
      await this.sleep(this.pollMs);
    }
    throw new Error(`uiautomator dump failed: ${last}`);
  }

  async find(q: string, nodes?: UiNode[]): Promise<UiNode[]> {
    return findNodes(nodes ?? (await this.dump()), q);
  }

  async tapXY(x: number, y: number): Promise<void> {
    await this.shell("input", "tap", String(x), String(y));
    await this.sleep(this.settleMs);
  }

  async tapNode(node: UiNode): Promise<UiNode> {
    await this.tapXY(node.x, node.y);
    return node;
  }

  /** Tap the n-th node matching `q` on the current screen. */
  async tap(q: string, n = 0): Promise<UiNode> {
    const hit = (await this.find(q))[n];
    if (hit === undefined) throw new Error(`no node matches ${JSON.stringify(q)} (index ${n})`);
    return this.tapNode(hit);
  }

  /** Send a key event; `code` may omit the KEYCODE_ prefix. */
  async key(code: string): Promise<void> {
    await this.shell("input", "keyevent", code.startsWith("KEYCODE_") ? code : `KEYCODE_${code}`);
    await this.sleep(this.settleMs);
  }

  /**
   * Poll until a node satisfies `pred` (a query string or a predicate) and
   * return it. `onPoll` runs on each screen first (e.g. nag dismissal); when
   * it returns true the screen changed and is dumped again at once.
   */
  async waitFor(
    pred: string | ((n: UiNode) => boolean),
    timeoutMs: number,
    onPoll?: (nodes: UiNode[]) => Promise<boolean>,
  ): Promise<UiNode> {
    const test = typeof pred === "string" ? (n: UiNode) => matches(n, pred) : pred;
    const what = typeof pred === "string" ? JSON.stringify(pred) : "the expected screen";
    const end = this.now() + timeoutMs;
    for (;;) {
      const nodes = await this.dump();
      if (onPoll !== undefined && (await onPoll(nodes))) continue;
      const hit = nodes.find(test);
      if (hit !== undefined) return hit;
      if (this.now() >= end) {
        const seen = nodes
          .map((n) => n.text || n.desc)
          .filter((s) => s !== "")
          .slice(0, 12)
          .join(", ");
        throw new Error(`timed out waiting for ${what}; the screen shows: ${seen || "nothing"}`);
      }
      await this.sleep(this.pollMs);
    }
  }

  /**
   * If a titled alert is showing, tap its nag button ("Don't Show Again",
   * "STOP REMINDING", else "OK"). Returns true when it tapped something.
   * Untitled dialogs (like Restore's overwrite confirmation) are left alone.
   */
  async dismissNag(nodes?: UiNode[]): Promise<boolean> {
    const screen = nodes ?? (await this.dump());
    if (!isAlertShowing(screen)) return false;
    for (const q of NAG_BUTTONS) {
      const btn = findNodes(screen, q)[0];
      if (btn !== undefined) {
        await this.tapNode(btn);
        return true;
      }
    }
    return false;
  }

  /** Dismiss nag dialogs until none is showing (at most `max`). Returns how many. */
  async dismissNags(max = 5): Promise<number> {
    let n = 0;
    while (n < max && (await this.dismissNag())) n++;
    return n;
  }

  /** Lock and sleep state from dumpsys. */
  async screenState(): Promise<ScreenState> {
    const [win, power] = [
      await this.shell("dumpsys", "window"),
      await this.shell("dumpsys", "power"),
    ];
    return parseScreenState(win, power);
  }
}
