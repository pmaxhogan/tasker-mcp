#!/usr/bin/env node
/**
 * Scrapes the Tasker userguide into Markdown pages plus a search index.
 *
 * Run by the docs-sync GitHub Actions job, which publishes the output to the
 * orphan `docs-data` branch. The userguide is (c) joaoapps: its text must never
 * land on main or in the npm tarball.
 *
 * Usage: node scripts/docs-scrape.mjs [--out dir] [--limit N] [--delay-ms 250]
 *
 * Imports TypeScript sources directly (Node type stripping), so no build step.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildOutputs, crawl } from "../src/docs/crawl.ts";

function parseArgs(argv) {
  const opts = { out: "out", limit: undefined, delayMs: 250 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--out") opts.out = val();
    else if (a === "--limit") opts.limit = Number(val());
    else if (a === "--delay-ms") opts.delayMs = Number(val());
    else throw new Error(`unknown argument: ${a}`);
  }
  if (opts.limit !== undefined && !(opts.limit > 0)) throw new Error("--limit must be positive");
  if (!(opts.delayMs >= 0)) throw new Error("--delay-ms must be >= 0");
  return opts;
}

const started = Date.now();
const opts = parseArgs(process.argv.slice(2));
const out = resolve(opts.out);

const { pages, skipped } = await crawl({
  limit: opts.limit,
  delayMs: opts.delayMs,
  log: (m) => console.error(m),
});
if (pages.length === 0) {
  console.error("no pages scraped; refusing to write output");
  process.exit(1);
}

const { index, search, files } = buildOutputs(pages);
rmSync(join(out, "pages"), { recursive: true, force: true });
mkdirSync(join(out, "pages"), { recursive: true });
for (const [rel, body] of files) {
  const dest = join(out, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body);
}
const indexJson = JSON.stringify(index);
const searchJson = JSON.stringify(search);
writeFileSync(join(out, "index.json"), indexJson);
writeFileSync(join(out, "search.json"), searchJson);

const pageBytes = [...files.values()].reduce((n, b) => n + Buffer.byteLength(b), 0);
console.error(
  `pages=${pages.length} skipped=${skipped.length} pagesBytes=${pageBytes} ` +
    `indexBytes=${indexJson.length} searchBytes=${searchJson.length} ` +
    `terms=${Object.keys(search.terms).length} seconds=${((Date.now() - started) / 1000).toFixed(1)}`,
);
for (const s of skipped) console.error(`skipped ${s.url}: ${s.reason}`);
