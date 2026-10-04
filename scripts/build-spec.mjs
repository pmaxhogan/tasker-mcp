#!/usr/bin/env node
// Build data/actions.json (a SpecTable, see src/spec/types.ts) from the
// vendored MapTasker tables plus the APK-derived JSON from apk-extract.mjs.
//
//   node scripts/build-spec.mjs [--data data]
//
// Inputs (all under --data):
//   vendor/maptasker-task_all_actions.json      (MapTasker, MIT, unmodified)
//   vendor/maptasker-category_descriptions.json (MapTasker, MIT, unmodified)
//   vendor/Tasker_XML_Codes.md                  (Tasker-XML-Info, MIT, unmodified)
//   action-names.json arg-labels.json help.json res-ids.json apk-meta.json
//
// Outputs (deterministic, 2-space JSON, trailing newline):
//   actions.json              the SpecTable
//   unmatched-an-names.json   an_* APK names no action matched (new-action candidates)
//   events.json states.json   [{code, name}] from Tasker-XML-Info
//   xml-info-extra-actions.json  task action codes Tasker-XML-Info lists that MapTasker lacks
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * MapTasker action code -> an_* resource name, for actions whose English
 * name differs from the APK string. Keep this small and verified.
 */
export const NAME_OVERRIDES = {
  // Tasker renamed "Interrupt Mode" to "Do Not Disturb".
  312: "an_do_not_disturb",
};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function parseArgs(argv) {
  let data = "data";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--data") data = argv[++i];
    else throw new Error(`unknown option ${argv[i]}`);
  }
  return resolve(data);
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const sortKeys = (o) =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** Parse the `code`: `name` lines of one "### Heading" section. */
export function parseCodeSection(md, heading) {
  const start = md.indexOf(`### ${heading}`);
  if (start < 0) return [];
  const rest = md.slice(start + 4);
  const end = rest.search(/^### /m);
  const body = end < 0 ? rest : rest.slice(0, end);
  const out = [];
  for (const m of body.matchAll(/^`(\d+)`: `(.*)`\s*$/gm))
    out.push({ code: Number(m[1]), name: m[2] });
  return out.sort((a, b) => a.code - b.code);
}

/** Candidate help resource names for an arg whose label resource is pl_<x>. */
function helpCandidates(plName) {
  const x = plName.slice(3);
  return [`help_${x}`, `pl_${x}_help`, `${x}_help`, `dc_${x}_help`];
}

function main() {
  const dir = parseArgs(process.argv.slice(2));
  const p = (f) => join(dir, f);

  const actions = readJson(p("vendor/maptasker-task_all_actions.json"));
  const categories = readJson(p("vendor/maptasker-category_descriptions.json"));
  const actionNames = readJson(p("action-names.json"));
  const argLabels = readJson(p("arg-labels.json"));
  const help = readJson(p("help.json"));
  const resIds = readJson(p("res-ids.json"));
  const apkMeta = readJson(p("apk-meta.json"));
  const md = readFileSync(p("vendor/Tasker_XML_Codes.md"), "utf8");

  // an_ name text -> resource names (normalized).
  const byText = new Map();
  for (const [res, text] of Object.entries(actionNames)) {
    const k = norm(text);
    if (!byText.has(k)) byText.set(k, []);
    byText.get(k).push(res);
  }
  // pl_ label text -> resource names.
  const plByText = new Map();
  for (const [res, text] of Object.entries(argLabels)) {
    const k = text.trim().toLowerCase();
    if (!plByText.has(k)) plByText.set(k, []);
    plByText.get(k).push(res);
  }

  const used = new Set();
  const stats = {
    actions: actions.length,
    matched: 0,
    ambiguous: 0,
    args: 0,
    labels: 0,
    helpArgs: 0,
    helpActions: 0,
  };
  const idStats = { total: 0, resolvedRaw: 0, resolvedTypeAdjusted: 0, helpLike: 0 };

  const outActions = [...actions]
    .sort((a, b) => a.code - b.code)
    .map((src) => {
      let resName = NAME_OVERRIDES[src.code];
      if (!resName) {
        const cand = byText.get(norm(src.name)) ?? [];
        if (cand.length === 1) resName = cand[0];
        else if (cand.length > 1) stats.ambiguous++;
      }
      if (resName && !(resName in actionNames)) resName = undefined;
      if (resName) {
        stats.matched++;
        used.add(resName);
      }

      const helpLines = [];
      const args = [...src.args]
        .sort((a, b) => a.id - b.id)
        .map((arg) => {
          stats.args++;
          const o = { id: arg.id, name: arg.name, type: arg.type, isMandatory: arg.isMandatory };
          if (arg.spec !== undefined) o.spec = arg.spec;
          if (arg.sortOrder !== undefined) o.sortOrder = arg.sortOrder;
          if (arg.helpResId !== undefined) {
            o.helpResId = arg.helpResId;
            idStats.total++;
            // MapTasker's ids come from a different Tasker build (string type
            // 0x7f13 there, 0x7f12 here), so raw ids never line up.
            if (String(arg.helpResId) in resIds) idStats.resolvedRaw++;
            const adj = resIds[String(arg.helpResId - 0x10000)];
            if (adj) {
              idStats.resolvedTypeAdjusted++;
              if (/help/.test(adj)) idStats.helpLike++;
            }
          }
          const pls = plByText.get(arg.name.trim().toLowerCase()) ?? [];
          if (pls.length > 0) {
            o.label = argLabels[pls[0]];
            stats.labels++;
            for (const pl of pls) {
              const hit = helpCandidates(pl).find((h) => h in help);
              if (hit) {
                helpLines.push(`${arg.name}: ${help[hit]}`);
                stats.helpArgs++;
                break;
              }
            }
          }
          return o;
        });

      const o = { code: src.code, name: src.name };
      if (src.categoryCode !== undefined) o.categoryCode = src.categoryCode;
      if (src.canFail !== undefined) o.canFail = src.canFail;
      o.args = args;
      if (resName) o.resName = resName;
      if (helpLines.length > 0) {
        o.help = helpLines.join("\n\n");
        stats.helpActions++;
      }
      return o;
    });

  const table = {
    meta: {
      generated: apkMeta.date,
      taskerVersion: apkMeta.versionName,
      sources: [
        "MapTasker task_all_actions.json and category_descriptions.json (MIT, github.com/mctinker/Map-Tasker)",
        `Tasker ${apkMeta.versionName} (${apkMeta.package}) APK string resources, tasker.joaoapps.com`,
        "Tasker-XML-Info Tasker_XML_Codes.md (MIT, github.com/Taskomater/Tasker-XML-Info)",
      ],
    },
    actions: outActions,
    categories: [...categories]
      .sort((a, b) => a.code - b.code)
      .map((c) => ({ code: c.code, name: c.name })),
  };
  writeJson(p("actions.json"), table);

  const unmatched = {};
  for (const [res, text] of Object.entries(sortKeys(actionNames)))
    if (!used.has(res)) unmatched[res] = text;
  writeJson(p("unmatched-an-names.json"), unmatched);

  writeJson(p("events.json"), parseCodeSection(md, "Profile Events"));
  writeJson(p("states.json"), parseCodeSection(md, "Profile States"));

  const known = new Set(actions.map((a) => a.code));
  const extra = [
    ...parseCodeSection(md, "Task Actions"),
    ...parseCodeSection(md, "Deprecated Task Actions"),
  ].filter((a) => !known.has(a.code));
  writeJson(p("xml-info-extra-actions.json"), extra);

  const log = (s) => process.stderr.write(s + "\n");
  log(
    `build-spec: ${stats.actions} actions, ${stats.matched} matched an_ names, ${stats.ambiguous} ambiguous, ` +
      `${Object.keys(unmatched).length} unmatched an_ names`,
  );
  log(
    `build-spec: ${stats.labels}/${stats.args} args labelled, help on ${stats.helpActions} actions (${stats.helpArgs} args)`,
  );
  log(
    `build-spec: helpResId ${idStats.total} ids: raw hits ${idStats.resolvedRaw}, type-adjusted hits ` +
      `${idStats.resolvedTypeAdjusted} (help-like ${idStats.helpLike}); id mapping is not used`,
  );
  log(`build-spec: ${extra.length} Tasker-XML-Info task action codes missing from MapTasker`);
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`build-spec: ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  }
}
