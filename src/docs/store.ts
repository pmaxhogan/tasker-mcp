/**
 * DocsStore: lazy, disk-cached access to the Tasker userguide mirror.
 *
 * The userguide is (c) joaoapps and is NOT part of this repo or the npm
 * package. A scheduled GitHub Actions job publishes it to the `docs-data`
 * branch; this class downloads that branch's files on first use and caches
 * them under `<home>/docs/`.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { log } from "../log.ts";
import {
  isSafeSlug,
  type DocSection,
  type DocsIndex,
  type PageEntry,
  type SearchIndex,
} from "./pages.ts";
import { tokenize } from "./tokenize.ts";

export const DEFAULT_DOCS_BASE_URL =
  "https://raw.githubusercontent.com/pmaxhogan/tasker-mcp/docs-data/";

export interface DocsStoreOptions {
  /** The tasker-mcp state dir; docs are cached in `<home>/docs/`. */
  home: string;
  fetch?: typeof fetch;
  baseUrl?: string;
  /** Per-request timeout in ms (default 20000). */
  timeoutMs?: number;
}

export interface SearchHit {
  slug: string;
  title: string;
  section: DocSection;
  score: number;
  snippet: string;
}

export interface DocPage {
  slug: string;
  title: string;
  url: string;
  markdown: string;
}

export interface SearchOptions {
  limit?: number;
  section?: DocSection | string;
}

const SNIPPET_CHARS = 200;
const PREFIX_WEIGHT = 0.4;

function reason(e: unknown): string {
  if (e instanceof Error) {
    const code = (e.cause as { code?: string } | undefined)?.code;
    return code ? `${e.message}: ${code}` : e.message;
  }
  return String(e);
}

function offlineError(why: string): Error {
  return new Error(
    `Docs not cached yet and download failed (${why}); check network or run refresh_docs later`,
  );
}

function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export class DocsStore {
  readonly dir: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private index: DocsIndex | null = null;
  private searchIdx: SearchIndex | null = null;
  private loading: Promise<void> | null = null;
  private readonly pageInflight = new Map<string, Promise<string>>();

  constructor(opts: DocsStoreOptions) {
    this.dir = join(opts.home, "docs");
    this.fetchImpl = opts.fetch ?? fetch;
    const base = opts.baseUrl ?? DEFAULT_DOCS_BASE_URL;
    this.baseUrl = base.endsWith("/") ? base : base + "/";
    this.timeoutMs = opts.timeoutMs ?? 20_000;
  }

  /** Loads the index from the disk cache, downloading it first if there is none. */
  ensure(): Promise<void> {
    if (this.index && this.searchIdx) return Promise.resolve();
    this.loading ??= this.load().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  /** Re-downloads index.json and search.json. Keeps the old cache if that fails. */
  async refresh(): Promise<{ pages: number; generated: string }> {
    let idx: DocsIndex;
    let search: SearchIndex;
    try {
      [idx, search] = await this.downloadIndex();
    } catch (e) {
      if (this.index || this.readIndexFromDisk()) {
        throw new Error(`Docs refresh failed (${reason(e)}); keeping the cached copy`, {
          cause: e,
        });
      }
      throw offlineError(reason(e));
    }
    this.writeAtomic("index.json", JSON.stringify(idx));
    this.writeAtomic("search.json", JSON.stringify(search));
    this.index = idx;
    this.searchIdx = search;
    return { pages: idx.pages.length, generated: idx.generated };
  }

  async list(section?: string): Promise<PageEntry[]> {
    await this.ensure();
    const pages = (this.index as DocsIndex).pages;
    return section ? pages.filter((p) => p.section === section) : [...pages];
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
    await this.ensure();
    const index = this.index as DocsIndex;
    const terms = (this.searchIdx as SearchIndex).terms;
    const limit = Math.max(1, opts.limit ?? 10);
    const qTerms = [...new Set(tokenize(query))];
    if (!qTerms.length) return [];
    const n = index.pages.length;
    const scores = new Map<number, number>();
    const add = (list: [number, number][], weight: number): void => {
      const idf = Math.log(1 + n / list.length);
      for (const [idx, tf] of list) {
        scores.set(idx, (scores.get(idx) ?? 0) + weight * idf * (1 + Math.log(tf)));
      }
    };
    for (const t of qTerms) {
      const exact = terms[t];
      if (exact) add(exact, 1);
      if (t.length >= 3) {
        for (const key of Object.keys(terms)) {
          if (key !== t && key.startsWith(t)) add(terms[key] as [number, number][], PREFIX_WEIGHT);
        }
      }
    }
    const hits: SearchHit[] = [];
    for (const [idx, score] of scores) {
      const p = index.pages[idx];
      if (!p || (opts.section && p.section !== opts.section)) continue;
      hits.push({
        slug: p.slug,
        title: p.title,
        section: p.section,
        score: Math.round(score * 1000) / 1000,
        snippet: "",
      });
    }
    const qKey = normKey(query);
    for (const h of hits) {
      const tt = new Set(tokenize(h.title));
      if (qTerms.every((t) => tt.has(t))) h.score *= 1.5;
      if (normKey(h.title) === qKey) h.score *= 2;
      h.score = Math.round(h.score * 1000) / 1000;
    }
    hits.sort((a, b) => b.score - a.score || (a.title < b.title ? -1 : 1));
    const top = hits.slice(0, limit);
    for (const h of top) h.snippet = this.snippetFor(h, qTerms, query);
    return top;
  }

  async get(slugOrName: string): Promise<DocPage> {
    await this.ensure();
    const entry = this.resolve(slugOrName);
    const markdown = await this.pageMarkdown(entry.slug);
    return { slug: entry.slug, title: entry.title, url: entry.url, markdown };
  }

  // ---- internals ----

  private async load(): Promise<void> {
    const cached = this.readIndexFromDisk();
    if (cached) return;
    let idx: DocsIndex;
    let search: SearchIndex;
    try {
      [idx, search] = await this.downloadIndex();
    } catch (e) {
      throw offlineError(reason(e));
    }
    this.writeAtomic("index.json", JSON.stringify(idx));
    this.writeAtomic("search.json", JSON.stringify(search));
    this.index = idx;
    this.searchIdx = search;
  }

  private readIndexFromDisk(): boolean {
    try {
      const idx = JSON.parse(readFileSync(join(this.dir, "index.json"), "utf8")) as DocsIndex;
      const search = JSON.parse(readFileSync(join(this.dir, "search.json"), "utf8")) as SearchIndex;
      if (!Array.isArray(idx.pages) || typeof search.terms !== "object") return false;
      this.index = idx;
      this.searchIdx = search;
      return true;
    } catch {
      return false;
    }
  }

  private async fetchText(file: string): Promise<string> {
    const url = this.baseUrl + file;
    const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${file}`);
    return res.text();
  }

  private async downloadIndex(): Promise<[DocsIndex, SearchIndex]> {
    const [indexText, searchText] = await Promise.all([
      this.fetchText("index.json"),
      this.fetchText("search.json"),
    ]);
    let idx: DocsIndex;
    let search: SearchIndex;
    try {
      idx = JSON.parse(indexText) as DocsIndex;
      search = JSON.parse(searchText) as SearchIndex;
    } catch (e) {
      throw new Error("downloaded index is not valid JSON", { cause: e });
    }
    if (!Array.isArray(idx?.pages) || typeof search?.terms !== "object" || !search.terms) {
      throw new Error("downloaded index has an unexpected shape");
    }
    return [idx, search];
  }

  private pagePath(slug: string): string {
    return join(this.dir, "pages", `${slug}.md`);
  }

  private async pageMarkdown(slug: string): Promise<string> {
    if (!isSafeSlug(slug)) throw new Error(`Invalid doc slug: ${slug}`);
    try {
      return readFileSync(this.pagePath(slug), "utf8");
    } catch {
      // not cached yet
    }
    let inflight = this.pageInflight.get(slug);
    if (!inflight) {
      inflight = (async () => {
        let text: string;
        try {
          text = await this.fetchText(`pages/${slug}.md`);
        } catch (e) {
          throw offlineError(reason(e));
        }
        this.writeAtomic(`pages/${slug}.md`, text);
        return text;
      })().finally(() => this.pageInflight.delete(slug));
      this.pageInflight.set(slug, inflight);
    }
    return inflight;
  }

  private writeAtomic(rel: string, data: string): void {
    const dest = join(this.dir, rel);
    try {
      mkdirSync(dirname(dest), { recursive: true });
      const tmp = `${dest}.${process.pid}.tmp`;
      writeFileSync(tmp, data);
      renameSync(tmp, dest);
    } catch (e) {
      // A read-only home must not break lookups; we just re-download next time.
      log("docs cache write failed", { file: rel, error: reason(e) });
    }
  }

  private snippetFor(hit: SearchHit, qTerms: string[], query: string): string {
    // The index is downloaded data: never let a slug like "../x" reach the filesystem.
    if (!isSafeSlug(hit.slug)) return hit.title;
    let text: string;
    try {
      text = readFileSync(this.pagePath(hit.slug), "utf8");
    } catch {
      return hit.title;
    }
    // Skip the "# Title" and "Source:" header lines.
    const bodyStart = text.indexOf("\n\n", text.indexOf("Source:"));
    const body = bodyStart >= 0 ? text.slice(bodyStart).trim() : text;
    const lower = body.toLowerCase();
    let pos = -1;
    const needles = [
      ...query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 2),
      ...qTerms,
    ];
    for (const needle of needles) {
      pos = lower.indexOf(needle);
      if (pos >= 0) break;
    }
    if (pos < 0) return hit.title;
    const start = Math.max(0, pos - Math.floor(SNIPPET_CHARS / 3));
    const slice = body
      .slice(start, start + SNIPPET_CHARS)
      .replace(/\s+/g, " ")
      .trim();
    return (start > 0 ? "..." : "") + slice + (start + SNIPPET_CHARS < body.length ? "..." : "");
  }

  private suggestions(q: string, limit = 5): string[] {
    const index = this.index as DocsIndex;
    const key = normKey(q);
    const parts = key.split("_").filter(Boolean);
    const scored: [number, string][] = [];
    for (const p of index.pages) {
      const hay = normKey(p.slug + " " + p.title);
      let s = 0;
      if (key && hay.includes(key)) s += 10;
      for (const part of parts) if (hay.includes(part)) s += 1;
      if (s > 0) scored.push([s, p.slug]);
    }
    scored.sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1));
    return scored.slice(0, limit).map((x) => x[1]);
  }

  /** Fuzzy slug resolution: full slug, bare `ah_name`, "import data", or a title. */
  private resolve(input: string): PageEntry {
    const pages = (this.index as DocsIndex).pages;
    const key = normKey(input);
    const bySlug = new Map(pages.map((p) => [p.slug.toLowerCase(), p]));
    const exact = bySlug.get(input.trim().toLowerCase()) ?? bySlug.get(key);
    if (exact) return exact;

    const byTitle = pages.filter((p) => normKey(p.title) === key);
    if (byTitle.length === 1) return byTitle[0] as PageEntry;
    const candidates = new Map<string, PageEntry>(byTitle.map((p) => [p.slug, p]));
    if (!candidates.size) {
      for (const k of [`help__${key}`, `help__ah_${key}`, `help__eh_${key}`, `help__sh_${key}`]) {
        const p = bySlug.get(k);
        if (p) candidates.set(p.slug, p);
      }
    }
    if (candidates.size === 1) return [...candidates.values()][0] as PageEntry;
    if (candidates.size > 1) {
      throw new Error(
        `"${input}" is ambiguous: ${[...candidates.keys()].join(", ")}. Use one of these slugs.`,
      );
    }
    const close = this.suggestions(input);
    throw new Error(
      `No doc page matches "${input}".` +
        (close.length ? ` Close slugs: ${close.join(", ")}.` : "") +
        " Use search_docs to find pages.",
    );
  }
}
