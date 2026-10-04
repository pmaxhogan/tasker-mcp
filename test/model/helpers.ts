import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SpecLookup } from "../../src/model/convert.ts";
import { TaskerDoc } from "../../src/model/document.ts";
import type { SpecTable } from "../../src/spec/types.ts";

export const FIXTURES = fileURLToPath(new URL("../fixtures", import.meta.url));
const DATA = fileURLToPath(new URL("../../data/actions.json", import.meta.url));

const table = JSON.parse(readFileSync(DATA, "utf8")) as SpecTable;
const byCode = new Map(table.actions.map((a) => [a.code, a]));

/** Stub spec lookup straight from data/actions.json (no dependency on src/spec/table.ts). */
export const lookup: SpecLookup = (code) => byCode.get(code);

/** Every TaskerData fixture (relative paths, forward slashes), sorted. */
export function taskerFixtures(): string[] {
  return readdirSync(FIXTURES, { recursive: true, encoding: "utf8" })
    .filter((p) => p.toLowerCase().endsWith(".xml"))
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => readFixture(p).includes("<TaskerData"))
    .sort();
}

export function readFixture(rel: string): string {
  return readFileSync(join(FIXTURES, rel), "utf8");
}

export function loadDoc(rel: string): TaskerDoc {
  return TaskerDoc.parse(readFixture(rel));
}
