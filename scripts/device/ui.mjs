#!/usr/bin/env node
/**
 * Tiny uiautomator driver for the Tasker GUI on the emulator.
 *
 *   node scripts/device/ui.mjs dump [filter]       list visible nodes (text, id, desc, bounds)
 *   node scripts/device/ui.mjs tap <query>         tap the first node whose text/desc/id matches
 *   node scripts/device/ui.mjs tapn <n> <query>    tap the n-th (0-based) match
 *   node scripts/device/ui.mjs longtap <query>     long-press the first match
 *   node scripts/device/ui.mjs xy <x> <y>          tap coordinates
 *   node scripts/device/ui.mjs type <text>         type text into the focused field
 *   node scripts/device/ui.mjs key <KEYCODE>       e.g. BACK, ENTER, HOME
 *   node scripts/device/ui.mjs wait <query> [sec]  poll until a node matches
 *   node scripts/device/ui.mjs dismiss             dismiss known nag dialogs
 *
 * A query is a case-insensitive substring, or `id:<resource-id suffix>`,
 * `desc:<content-desc>`, or `text=<exact text>`.
 *
 * ANDROID_SERIAL defaults to emulator-5554 so a forgotten serial never lands
 * on a real phone.
 */
import { execFileSync } from "node:child_process";

const SERIAL = process.env.ANDROID_SERIAL ?? "emulator-5554";

export function adb(...args) {
  return execFileSync("adb", ["-s", SERIAL, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function dump() {
  // uiautomator fails ("could not get idle state", "null root node") while the
  // screen is still changing; a retry a moment later succeeds. Some of those
  // failures still exit 0, so the old file is removed first and a missing or
  // empty result counts as a failure instead of being read as the new screen.
  let xml;
  for (let attempt = 0; ; attempt++) {
    try {
      adb("shell", "rm", "-f", "/sdcard/ui.xml");
      adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
      xml = adb("shell", "cat", "/sdcard/ui.xml");
      if (xml.includes("<node")) break;
      throw new Error("uiautomator dump wrote no nodes");
    } catch (e) {
      if (attempt >= 4) throw e;
      adb("shell", "sleep", "1");
    }
  }
  const nodes = [];
  const re = /<node\b([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(xml))) {
    const attrs = {};
    for (const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = decode(a[2]);
    const b = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attrs.bounds ?? "");
    if (!b) continue;
    nodes.push({
      text: attrs.text ?? "",
      id: attrs["resource-id"] ?? "",
      desc: attrs["content-desc"] ?? "",
      cls: (attrs.class ?? "").split(".").pop(),
      clickable: attrs.clickable === "true",
      checked: attrs.checked === "true",
      x: Math.round((Number(b[1]) + Number(b[3])) / 2),
      y: Math.round((Number(b[2]) + Number(b[4])) / 2),
      bounds: attrs.bounds,
    });
  }
  return nodes;
}

function decode(s) {
  return s
    .replace(/&#10;/g, "\n")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function matches(node, q) {
  if (q.startsWith("id:")) return node.id.endsWith(q.slice(3));
  if (q.startsWith("desc:")) return node.desc.toLowerCase().includes(q.slice(5).toLowerCase());
  if (q.startsWith("text=")) return node.text === q.slice(5);
  const l = q.toLowerCase();
  return node.text.toLowerCase().includes(l) || node.desc.toLowerCase().includes(l);
}

export function find(q, nodes = dump()) {
  return nodes.filter((n) => matches(n, q));
}

export function tapXY(x, y) {
  adb("shell", "input", "tap", String(x), String(y));
}

export async function tap(q, n = 0) {
  const hits = find(q);
  const hit = hits[n];
  if (!hit) throw new Error(`no node matches ${JSON.stringify(q)} (index ${n})`);
  tapXY(hit.x, hit.y);
  await sleep(700);
  return hit;
}

export async function longtap(q) {
  const hit = find(q)[0];
  if (!hit) throw new Error(`no node matches ${JSON.stringify(q)}`);
  adb("shell", "input", "swipe", String(hit.x), String(hit.y), String(hit.x), String(hit.y), "900");
  await sleep(700);
  return hit;
}

export function typeText(text) {
  // input text needs spaces as %s and shell metacharacters escaped.
  const esc = text.replace(/ /g, "%s").replace(/([\\'"&|;<>()$`!*?#~])/g, "\\$1");
  adb("shell", "input", "text", esc);
}

export async function waitFor(q, sec = 15) {
  const end = Date.now() + sec * 1000;
  while (Date.now() < end) {
    const hit = find(q)[0];
    if (hit) return hit;
    await sleep(800);
  }
  throw new Error(`timed out waiting for ${JSON.stringify(q)}`);
}

/** Known nag/compat dialogs: tap through them until none is showing. */
export async function dismiss() {
  const buttons = [
    "text=Don't Show Again",
    "text=STOP REMINDING",
    "text=DISABLE",
    "text=OK",
    "text=Ok",
    "text=Dismiss",
    "text=Got it",
  ];
  for (let i = 0; i < 6; i++) {
    const nodes = dump();
    const isDialog = nodes.some(
      (n) => n.id === "android:id/alertTitle" || n.id.endsWith(":id/title_template"),
    );
    if (!isDialog) return;
    const btn = buttons.map((b) => find(b, nodes)[0]).find(Boolean);
    if (!btn) return;
    tapXY(btn.x, btn.y);
    await sleep(900);
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "dump": {
      const f = rest[0];
      for (const n of dump()) {
        if (!n.text && !n.desc && !n.clickable && !n.id) continue;
        if (f && !matches(n, f) && !n.id.includes(f)) continue;
        const parts = [
          n.cls,
          n.text && JSON.stringify(n.text),
          n.desc && `desc=${JSON.stringify(n.desc)}`,
          n.id && `id=${n.id.split("/").pop()}`,
          n.clickable ? "click" : "",
          n.checked ? "checked" : "",
          `@${n.x},${n.y}`,
        ];
        console.log(parts.filter(Boolean).join(" "));
      }
      break;
    }
    case "tap":
      console.log(JSON.stringify(await tap(rest.join(" "))));
      break;
    case "tapn":
      console.log(JSON.stringify(await tap(rest.slice(1).join(" "), Number(rest[0]))));
      break;
    case "longtap":
      console.log(JSON.stringify(await longtap(rest.join(" "))));
      break;
    case "xy":
      tapXY(rest[0], rest[1]);
      break;
    case "type":
      typeText(rest.join(" "));
      break;
    case "key":
      adb(
        "shell",
        "input",
        "keyevent",
        rest[0].startsWith("KEYCODE_") ? rest[0] : `KEYCODE_${rest[0]}`,
      );
      break;
    case "wait":
      console.log(JSON.stringify(await waitFor(rest[0], Number(rest[1] ?? 15))));
      break;
    case "dismiss":
      await dismiss();
      break;
    default:
      console.error("usage: ui.mjs dump|tap|tapn|longtap|xy|type|key|wait|dismiss ...");
      process.exit(2);
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/device/ui.mjs")) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
