#!/usr/bin/env node
// Discover and download the newest Tasker trial APK.
//
//   node scripts/download-tasker-apk.mjs [--out Tasker.apk] [--url <apk url>] [--discover-only]
//
// Discovery fetches https://tasker.joaoapps.com/download.html and the
// releases/playstore/ directory listing, regexes the Tasker.<version>.apk
// hrefs, and picks the highest plain numeric version (beta and bf builds are
// skipped). If discovery fails the pinned fallback is used. With --url the
// given URL is downloaded as-is. Prints "version=<v>" and "url=<u>" lines and,
// when $GITHUB_OUTPUT is set, appends them there too.
import { appendFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SITE = "https://tasker.joaoapps.com";
const PAGES = [`${SITE}/download.html`, `${SITE}/releases/playstore/`];
const FALLBACK = `${SITE}/releases/playstore/Tasker.6.6.20.apk`;

export function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Returns [{ version, url }] for every plain-numeric Tasker.<v>.apk href.
export function findApkLinks(html, base) {
  const out = new Map();
  for (const m of html.matchAll(/href="([^"]*?Tasker\.(\d+(?:\.\d+)+)\.apk)"/g)) {
    out.set(m[2], new URL(m[1], base).href);
  }
  return [...out].map(([version, url]) => ({ version, url }));
}

export async function discover() {
  const found = new Map();
  for (const page of PAGES) {
    try {
      const res = await fetch(page);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      for (const l of findApkLinks(await res.text(), page)) found.set(l.version, l.url);
    } catch (e) {
      console.error(`warn: could not read ${page}: ${e.message}`);
    }
  }
  const sorted = [...found].sort((a, b) => compareVersions(b[0], a[0]));
  if (sorted.length === 0) return undefined;
  return { version: sorted[0][0], url: sorted[0][1] };
}

function versionOf(url) {
  return /Tasker\.(\d+(?:\.\d+)+)\.apk/.exec(url)?.[1] ?? "unknown";
}

async function main() {
  const argv = process.argv.slice(2);
  let out = "Tasker.apk";
  let url;
  let discoverOnly = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out = argv[++i];
    else if (argv[i] === "--url") url = argv[++i];
    else if (argv[i] === "--discover-only") discoverOnly = true;
    else throw new Error(`unknown option ${argv[i]}`);
  }
  let version;
  if (url) {
    version = versionOf(url);
  } else {
    const found = await discover();
    if (found) ({ version, url } = found);
    else {
      console.error(`warn: discovery found nothing, using fallback ${FALLBACK}`);
      url = FALLBACK;
      version = versionOf(FALLBACK);
    }
  }
  // Values go to $GITHUB_OUTPUT as key=value lines: refuse anything that could
  // smuggle an extra line or a non-https source.
  if (!/^https:\/\/\S+$/.test(url) || !/^[0-9.]+$/.test(version)) {
    throw new Error(`refusing unexpected apk url/version: ${JSON.stringify({ url, version })}`);
  }
  console.log(`version=${version}`);
  console.log(`url=${url}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nurl=${url}\n`);
  }
  if (discoverOnly) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024 * 1024 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error(`${url} did not return an APK (${buf.length} bytes)`);
  }
  writeFileSync(out, buf);
  console.log(`saved ${out} (${buf.length} bytes)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
