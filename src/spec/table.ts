/**
 * Loading and indexing the action-spec table (data/actions.json) plus the event, state and
 * extra-action name lists that sit next to it.
 */
import { readFileSync } from "node:fs";
import type { ActionSpec, ArgSpec, SpecTable } from "./types.ts";

/** Block-structure action codes. Else and Else If share 43; Else If carries a ConditionList. */
export const IF = 37;
export const ELSE = 43;
export const END_IF = 38;
export const FOR = 39;
export const END_FOR = 40;
/** What the task editor calls an Else (43) with a condition. */
export const ELSE_IF_NAME = "Else If";

/**
 * Tasker writes plugin actions as code 1000 (Tasker-XML-Info) or, in real exports, as large
 * hashed integers (107361459, 1732635924, 11820, ...). Every built-in action code is below 1000.
 */
export const PLUGIN_CODE_MIN = 1000;

/**
 * `data/` relative to this module. From `src/spec/table.ts` (vitest) and from
 * `dist/spec/table.js` (after build) both resolve to the package root `data/`.
 */
export const DATA_DIR = new URL("../../data/", import.meta.url);

export interface NamedCode {
  code: number;
  name: string;
}

export interface SpecExtras {
  events?: NamedCode[];
  states?: NamedCode[];
  /** Codes Tasker-XML-Info knows that the spec table does not (Plugin 1000, deprecated ones). */
  extraActions?: NamedCode[];
  /** APK action resource names (`an_*`) with no code in the table, mapped to their labels. */
  unmatchedAnNames?: Record<string, string>;
}

export type ResolveResult = { spec: ActionSpec } | { error: string; suggestions: NamedCode[] };

export interface SearchOptions {
  limit?: number;
  /** Category name (case-insensitive) or code. */
  category?: string | number;
}

export interface SearchHit {
  spec: ActionSpec;
  score: number;
  category?: string;
}

export interface CategoryCount {
  code: number;
  name: string;
  count: number;
}

function readJson<T>(path: string | URL): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** Read a SpecTable. Defaults to the package's `data/actions.json`. */
export function loadSpecTable(path?: string | URL): SpecTable {
  return readJson<SpecTable>(path ?? new URL("actions.json", DATA_DIR));
}

/** Lower case, letters and digits only: "Perform Task" / "perform_task" -> "performtask". */
export function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter((t) => t.length > 0);
}

/** Plain Levenshtein distance; inputs are short action names. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[b.length]!;
}

export class SpecIndex {
  readonly table: SpecTable;
  private readonly codes = new Map<number, ActionSpec>();
  private readonly names = new Map<string, ActionSpec>();
  private readonly categoryNames = new Map<number, string>();
  private readonly events = new Map<number, string>();
  private readonly states = new Map<number, string>();
  private readonly extraActions = new Map<number, string>();
  private readonly unmatchedAn = new Map<string, string>();

  constructor(table: SpecTable, extras: SpecExtras = {}) {
    this.table = table;
    for (const c of table.categories) this.categoryNames.set(c.code, c.name);
    for (const a of table.actions) {
      this.codes.set(a.code, a);
      this.addName(a.name, a);
      if (a.resName) {
        this.addName(a.resName, a);
        this.addName(a.resName.replace(/^an_/, ""), a);
      }
    }
    // The task editor shows an Else that carries a condition as "Else If"; it is code 43 too.
    const elseSpec = this.codes.get(ELSE);
    if (elseSpec) this.addName(ELSE_IF_NAME, elseSpec);
    // First entry wins: events.json lists code 1000 twice (Display Unlocked, Plugin).
    for (const e of extras.events ?? [])
      if (!this.events.has(e.code)) this.events.set(e.code, e.name);
    for (const s of extras.states ?? [])
      if (!this.states.has(s.code)) this.states.set(s.code, s.name);
    for (const x of extras.extraActions ?? []) this.extraActions.set(x.code, x.name);
    for (const [res, label] of Object.entries(extras.unmatchedAnNames ?? {})) {
      this.unmatchedAn.set(normName(res), label);
      this.unmatchedAn.set(normName(res.replace(/^an_/, "")), label);
      this.unmatchedAn.set(normName(label), label);
    }
  }

  private addName(name: string, spec: ActionSpec): void {
    const k = normName(name);
    if (k && !this.names.has(k)) this.names.set(k, spec);
  }

  get actions(): readonly ActionSpec[] {
    return this.table.actions;
  }

  byCode(code: number): ActionSpec | undefined {
    return this.codes.get(code);
  }

  /** Case, space and punctuation insensitive; accepts `an_*` resource names too. */
  byName(nameOrResName: string): ActionSpec | undefined {
    return this.names.get(normName(nameOrResName));
  }

  categoryName(code: number | undefined): string | undefined {
    return code === undefined ? undefined : this.categoryNames.get(code);
  }

  /** Up to `limit` closest action names, for "did you mean" hints. */
  suggest(query: string, limit = 5): NamedCode[] {
    const q = normName(query);
    if (!q) return [];
    const scored: { spec: ActionSpec; d: number }[] = [];
    for (const a of this.table.actions) {
      const n = normName(a.name);
      let d = editDistance(q, n);
      // Substring hits ("photo" in "takephoto") rank ahead of edit-distance neighbours.
      if (n.includes(q) || (n.length >= 4 && q.includes(n)))
        d = Math.min(d, Math.abs(n.length - q.length) / 4);
      scored.push({ spec: a, d });
    }
    scored.sort((x, y) => x.d - y.d || x.spec.name.localeCompare(y.spec.name));
    const maxD = Math.max(2, Math.ceil(q.length / 2));
    return scored
      .filter((s) => s.d <= maxD)
      .slice(0, limit)
      .map((s) => ({ code: s.spec.code, name: s.spec.name }));
  }

  /** Resolve an action code, numeric string, name or `an_*` resource name. */
  resolve(codeOrName: string | number): ResolveResult {
    const raw = typeof codeOrName === "number" ? String(codeOrName) : codeOrName.trim();
    if (/^-?\d+$/.test(raw)) {
      const code = Number(raw);
      const spec = this.byCode(code);
      if (spec) return { spec };
      if (this.isPlugin(code)) {
        return {
          error: `Action code ${code} is a plugin action; plugin actions have no spec. Pass raw XML.`,
          suggestions: [],
        };
      }
      const extra = this.extraActions.get(code);
      const why = extra ? ` (${extra} action)` : "";
      return {
        error: `Unknown action code ${code}${why}; use search_actions or pass raw XML`,
        suggestions: [],
      };
    }
    const spec = this.byName(raw);
    if (spec) return { spec };
    const apkLabel = this.unmatchedAn.get(normName(raw));
    const error = apkLabel
      ? `Tasker has an action "${apkLabel}" but its code is not in the spec table; build it in ` +
        `the Tasker GUI, export, and pass raw XML`
      : `Unknown action "${raw}"`;
    return { error, suggestions: this.suggest(raw) };
  }

  /**
   * Token-scored search over names, resource names, arg names/labels, help text and category.
   * Every query token must hit somewhere; ties break by name.
   */
  search(query: string, opts: SearchOptions = {}): SearchHit[] {
    const limit = opts.limit ?? 20;
    const qTokens = tokens(query);
    const qNorm = normName(query);
    const catFilter = this.categoryFilter(opts.category);
    const hits: SearchHit[] = [];
    for (const a of this.table.actions) {
      if (catFilter !== undefined && a.categoryCode !== catFilter) continue;
      const category = this.categoryName(a.categoryCode);
      if (qTokens.length === 0) {
        hits.push({ spec: a, score: 0, category });
        continue;
      }
      const nameTokens = tokens(a.name);
      const resTokens = a.resName ? tokens(a.resName) : [];
      const argTokens = new Set(a.args.flatMap((g) => tokens(`${g.name} ${g.label ?? ""}`)));
      const helpTokens = new Set(a.help ? tokens(a.help) : []);
      const catTokens = category ? tokens(category) : [];
      let score = 0;
      let allHit = true;
      for (const t of qTokens) {
        let s = 0;
        if (nameTokens.includes(t)) s += 10;
        else if (nameTokens.some((n) => n.startsWith(t))) s += 6;
        if (resTokens.includes(t)) s += 2;
        if (argTokens.has(t)) s += 3;
        else if (t.length >= 3 && [...argTokens].some((n) => n.startsWith(t))) s += 1;
        if (helpTokens.has(t)) s += 1;
        if (catTokens.includes(t)) s += 2;
        if (s === 0) allHit = false;
        score += s;
      }
      if (!allHit) continue;
      const nameNorm = normName(a.name);
      if (nameNorm === qNorm) score += 50;
      else if (qNorm.length >= 3 && nameNorm.includes(qNorm)) score += 15;
      hits.push({ spec: a, score, category });
    }
    hits.sort((x, y) => y.score - x.score || x.spec.name.localeCompare(y.spec.name));
    return hits.slice(0, limit);
  }

  private categoryFilter(cat: string | number | undefined): number | undefined {
    if (cat === undefined || cat === "") return undefined;
    if (typeof cat === "number") return cat;
    if (/^\d+$/.test(cat.trim())) return Number(cat.trim());
    const want = normName(cat);
    for (const c of this.table.categories) if (normName(c.name) === want) return c.code;
    // Unknown category: match nothing rather than everything.
    return -1;
  }

  /** Every category with the number of actions in it, in table order. */
  categories(): CategoryCount[] {
    const counts = new Map<number, number>();
    for (const a of this.table.actions) {
      if (a.categoryCode !== undefined) {
        counts.set(a.categoryCode, (counts.get(a.categoryCode) ?? 0) + 1);
      }
    }
    const out = this.table.categories.map((c) => ({ ...c, count: counts.get(c.code) ?? 0 }));
    // Some actions point at a category the table does not name (Test, 115, is in 140).
    for (const [code, count] of counts) {
      if (!this.categoryNames.has(code)) out.push({ code, name: `Category ${code}`, count });
    }
    return out;
  }

  eventName(code: number): string | undefined {
    return this.events.get(code);
  }

  stateName(code: number): string | undefined {
    return this.states.get(code);
  }

  /** Name for a code Tasker-XML-Info lists but the spec table lacks ("Plugin", "Deprecated"). */
  extraActionName(code: number): string | undefined {
    return this.extraActions.get(code);
  }

  /** Plugin action: code 1000 or any code >= 1000 that is not a built-in action. */
  isPlugin(code: number): boolean {
    return code >= PLUGIN_CODE_MIN && !this.codes.has(code);
  }

  argById(spec: ActionSpec, id: number): ArgSpec | undefined {
    return spec.args.find((g) => g.id === id);
  }
}

/**
 * Event codes missing from events.json (Tasker-XML-Info covers Tasker 5.15), observed in real
 * exports; see docs/tasker-xml-format.md.
 */
const EXTRA_EVENTS: NamedCode[] = [{ code: 2089, name: "HTTP Request" }];

let cached: SpecIndex | undefined;

/** Build a SpecIndex from the package `data/` directory (or another directory URL). */
export function loadSpecIndex(dataDir: URL = DATA_DIR): SpecIndex {
  return new SpecIndex(loadSpecTable(new URL("actions.json", dataDir)), {
    events: [...readJson<NamedCode[]>(new URL("events.json", dataDir)), ...EXTRA_EVENTS],
    states: readJson<NamedCode[]>(new URL("states.json", dataDir)),
    extraActions: readJson<NamedCode[]>(new URL("xml-info-extra-actions.json", dataDir)),
    unmatchedAnNames: readJson<Record<string, string>>(new URL("unmatched-an-names.json", dataDir)),
  });
}

/** Process-wide SpecIndex over the bundled data, loaded on first use. */
export function getSpec(): SpecIndex {
  cached ??= loadSpecIndex();
  return cached;
}
