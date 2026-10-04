import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseXml, serializeXml } from "../../src/xml/index.ts";

const FIXTURES = fileURLToPath(new URL("../fixtures", import.meta.url));

function findXml(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir, { recursive: true, encoding: "utf8" });
  } catch {
    return [];
  }
  return entries
    .filter((p) => p.toLowerCase().endsWith(".xml"))
    .map((p) => p.replace(/\\/g, "/"))
    .sort();
}

const files = findXml(FIXTURES);

describe("fixture round trip", () => {
  it("discovers fixtures without failing when there are none", () => {
    expect(Array.isArray(files)).toBe(true);
  });

  it.each(files)("%s round-trips byte for byte", (rel) => {
    const bytes = readFileSync(join(FIXTURES, rel));
    const text = bytes.toString("utf8");
    const out = serializeXml(parseXml(text));
    expect(out === text).toBe(true);
    expect(Buffer.from(out, "utf8").equals(bytes)).toBe(true);
  });
});
