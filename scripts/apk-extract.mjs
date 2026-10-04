#!/usr/bin/env node
// Extract English (default locale) strings from a Tasker APK with aapt2.
//
//   node scripts/apk-extract.mjs <apk> [--aapt2 <path>] [--out data]
//
// Writes into --out (default "data"):
//   action-names.json  { an_*: "Action Name" }
//   arg-labels.json    { pl_*: "Param Label" }
//   help.json          { help_* and *_help: "Help text" }
//   event-names.json   { en_*: "Event Name" }
//   state-names.json   { sn_*: "State Name" }
//   res-ids.json       { "<decimal id>": "<resName>" } for the string resources above
//   apk-meta.json      { package, versionName, versionCode, date }
//
// Output is deterministic (sorted keys, 2-space JSON) so CI diffs are
// meaningful. aapt2 is found via --aapt2, $AAPT2, $ANDROID_HOME,
// $ANDROID_SDK_ROOT, %LOCALAPPDATA%\Android\Sdk, then PATH.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MAX_BUFFER = 1024 * 1024 * 1024;

function parseArgs(argv) {
  const opts = { apk: undefined, aapt2: undefined, out: "data" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--aapt2") opts.aapt2 = argv[++i];
    else if (a === "--out") opts.out = argv[++i];
    else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
    else opts.apk = a;
  }
  if (!opts.apk) throw new Error("usage: apk-extract.mjs <apk> [--aapt2 path] [--out data]");
  return opts;
}

function newestBuildTools(sdk) {
  const dir = join(sdk, "build-tools");
  if (!existsSync(dir)) return undefined;
  const versions = readdirSync(dir)
    .filter((v) => /^\d/.test(v))
    .sort((a, b) => {
      const pa = a.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
      const pb = b.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
      for (let i = 0; i < 4; i++)
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
      return 0;
    });
  const exe = process.platform === "win32" ? "aapt2.exe" : "aapt2";
  for (const v of versions) {
    const p = join(dir, v, exe);
    if (existsSync(p)) return p;
  }
  return undefined;
}

export function findAapt2(explicit, env = process.env) {
  if (explicit) return explicit;
  if (env.AAPT2) return env.AAPT2;
  const sdks = [
    env.ANDROID_HOME,
    env.ANDROID_SDK_ROOT,
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Android", "Sdk"),
    env.HOME && join(env.HOME, "Android", "Sdk"),
  ].filter(Boolean);
  for (const sdk of sdks) {
    const p = newestBuildTools(sdk);
    if (p) return p;
  }
  return "aapt2"; // hope it is on PATH
}

function aapt2(bin, args) {
  return execFileSync(bin, args, {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const RESOURCE_RE = /^\s+resource 0x([0-9a-f]{8}) string\/(\S+)$/;
// "      () "text"" / "      (ja) "..."" / "      () (styled string) "..."".
const VALUE_RE = /^ {6}\(([^)]*)\) (?:\(styled string\) )?"/;

/**
 * Parse `aapt2 dump resources` into { resName: { id, text } } for string
 * resources, keeping only the default-config (`()`) value.
 */
// The repo bans non-ASCII dashes (scripts/check-ascii.mjs); Tasker strings use some.
const DASHES = new RegExp(
  "[" +
    String.fromCharCode(0x2010) +
    "-" +
    String.fromCharCode(0x2015) +
    String.fromCharCode(0x2212) +
    "]",
  "g",
);
const asciiDashes = (t) => t.replace(DASHES, "-");

export function parseStrings(dump) {
  const lines = dump.split(/\r?\n/);
  const isBoundary = (l) => VALUE_RE.test(l) || /^\s+resource 0x/.test(l) || /^ {2}type /.test(l);
  const out = {};
  let i = 0;
  while (i < lines.length) {
    const m = RESOURCE_RE.exec(lines[i]);
    i++;
    if (!m) continue;
    const id = parseInt(m[1], 16);
    const name = m[2];
    // Walk every config value of this resource; keep only the default one.
    while (i < lines.length && !/^\s+resource 0x/.test(lines[i]) && !/^ {2}type /.test(lines[i])) {
      const v = VALUE_RE.exec(lines[i]);
      if (!v) {
        i++;
        continue;
      }
      const parts = [lines[i].slice(v[0].length)];
      i++;
      while (i < lines.length && !isBoundary(lines[i])) {
        parts.push(lines[i].startsWith("      ") ? lines[i].slice(6) : lines[i]);
        i++;
      }
      if (v[1] === "") {
        const text = asciiDashes(parts.join("\n").replace(/\s+$/, "").replace(/"$/, ""));
        out[name] = { id, text };
      }
    }
  }
  return out;
}

function sortedObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function badging(bin, apk) {
  const text = aapt2(bin, ["dump", "badging", apk]);
  const m = /package: name='([^']*)' versionCode='(\d+)' versionName='([^']*)'/.exec(text);
  if (!m) throw new Error("could not read package line from aapt2 dump badging");
  return { package: m[1], versionCode: Number(m[2]), versionName: m[3] };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const bin = findAapt2(opts.aapt2);
  const apk = resolve(opts.apk);
  const outDir = resolve(opts.out);
  mkdirSync(outDir, { recursive: true });

  const meta = badging(bin, apk);
  const strings = parseStrings(aapt2(bin, ["dump", "resources", apk]));

  const pick = (pred) => {
    const r = {};
    for (const [name, { text }] of Object.entries(strings)) if (pred(name)) r[name] = text;
    return sortedObject(r);
  };
  const isHelp = (n) => n.startsWith("help_") || (n.endsWith("_help") && !n.startsWith("ml_"));
  const actionNames = pick((n) => n.startsWith("an_"));
  const argLabels = pick((n) => n.startsWith("pl_"));
  const help = pick(isHelp);
  const eventNames = pick((n) => n.startsWith("en_"));
  const stateNames = pick((n) => n.startsWith("sn_"));

  const ids = {};
  for (const [name, { id }] of Object.entries(strings)) {
    if (
      name.startsWith("an_") ||
      name.startsWith("pl_") ||
      name.startsWith("en_") ||
      name.startsWith("sn_") ||
      isHelp(name)
    ) {
      ids[String(id)] = name;
    }
  }
  const idsSorted = Object.fromEntries(
    Object.entries(ids).sort(([a], [b]) => Number(a) - Number(b)),
  );

  // Keep the date stable when the APK version did not change, so CI re-runs
  // produce no diff.
  const metaPath = join(outDir, "apk-meta.json");
  let date = new Date().toISOString().slice(0, 10);
  if (existsSync(metaPath)) {
    try {
      const prev = JSON.parse(readFileSync(metaPath, "utf8"));
      if (prev.versionCode === meta.versionCode && prev.date) date = prev.date;
    } catch {
      /* ignore */
    }
  }

  writeJson(join(outDir, "action-names.json"), actionNames);
  writeJson(join(outDir, "arg-labels.json"), argLabels);
  writeJson(join(outDir, "help.json"), help);
  writeJson(join(outDir, "event-names.json"), eventNames);
  writeJson(join(outDir, "state-names.json"), stateNames);
  writeJson(join(outDir, "res-ids.json"), idsSorted);
  writeJson(metaPath, {
    package: meta.package,
    versionName: meta.versionName,
    versionCode: meta.versionCode,
    date,
  });

  process.stderr.write(
    `apk-extract: ${meta.package} ${meta.versionName} (${meta.versionCode}): ` +
      `${Object.keys(actionNames).length} actions, ${Object.keys(argLabels).length} labels, ` +
      `${Object.keys(help).length} help, ${Object.keys(eventNames).length} events, ` +
      `${Object.keys(stateNames).length} states -> ${outDir}\n`,
  );
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`apk-extract: ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  }
}
