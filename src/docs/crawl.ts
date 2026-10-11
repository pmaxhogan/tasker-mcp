/**
 * Polite sequential crawler for the Tasker userguide. Used by
 * scripts/docs-scrape.mjs (CI only). Never imported by the MCP server at
 * runtime, and its output is never committed to main.
 */
import { createHash } from "node:crypto";
import { htmlToMarkdown } from "./html2md.ts";
import {
  GUIDE_ROOT_PATH,
  buildSearchIndex,
  countWords,
  sectionOf,
  slugFromUrl,
  type DocsIndex,
  type SearchIndex,
} from "./pages.ts";
import {
  MAX_SECTIONS,
  buildSectionedManual,
  remapAnchors,
  sectionFileUrl,
  sectionsDirOf,
  type RawSection,
} from "./sections.ts";
import { asciiDashes } from "./tokenize.ts";

export const USER_AGENT = "tasker-mcp-docs-sync (+https://github.com/pmaxhogan/tasker-mcp)";
export const START_URLS = [
  "https://tasker.joaoapps.com/userguide/en/index.html",
  // Apache directory listing: the A-Z help pages are only reachable through it.
  "https://tasker.joaoapps.com/userguide/en/help/",
];

export interface CrawlOptions {
  fetch?: typeof fetch;
  startUrls?: string[];
  limit?: number;
  delayMs?: number;
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
}

export interface CrawledPage {
  slug: string;
  title: string;
  url: string;
  markdown: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  skipped: { url: string; reason: string }[];
}

/** Parsed robots.txt rules that apply to us ("*" and our own UA token). */
export function parseRobots(text: string): { allow: string[]; disallow: string[] } {
  const allow: string[] = [];
  const disallow: string[] = [];
  let applies = false;
  let sawRule = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = (m[1] as string).toLowerCase();
    const val = (m[2] as string).trim();
    if (key === "user-agent") {
      if (sawRule) {
        applies = false;
        sawRule = false;
      }
      const ua = val.toLowerCase();
      if (ua === "*" || USER_AGENT.toLowerCase().startsWith(ua)) applies = true;
    } else if (key === "allow" || key === "disallow") {
      sawRule = true;
      if (applies && val) (key === "allow" ? allow : disallow).push(val);
    }
  }
  return { allow, disallow };
}

export function robotsAllows(
  rules: { allow: string[]; disallow: string[] },
  path: string,
): boolean {
  const longest = (list: string[]): number =>
    list.reduce((best, p) => (path.startsWith(p) && p.length > best ? p.length : best), -1);
  const d = longest(rules.disallow);
  return d < 0 || longest(rules.allow) >= d;
}

/** Normalized crawl key: no fragment, no query. */
function normalizeUrl(href: string): string {
  const u = new URL(href);
  u.hash = "";
  u.search = "";
  return u.href;
}

function isCrawlable(url: string): boolean {
  const u = new URL(url);
  if (u.hostname !== "tasker.joaoapps.com") return false;
  if (!u.pathname.startsWith(GUIDE_ROOT_PATH)) return false;
  return u.pathname.endsWith("/") || /\.html?$/i.test(u.pathname);
}

export async function crawl(opts: CrawlOptions = {}): Promise<CrawlResult> {
  const doFetch = opts.fetch ?? fetch;
  const delay = opts.delayMs ?? 250;
  const retries = opts.retries ?? 2;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const say = opts.log ?? (() => {});
  const start = opts.startUrls ?? START_URLS;
  const skipped: CrawlResult["skipped"] = [];

  /** One polite GET with retries. A 4xx is final and is reported as `missing`. */
  const request = async (url: string): Promise<{ body: string } | { missing: string }> => {
    let lastErr = "";
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(delay * 2 ** attempt);
      try {
        const res = await doFetch(url, {
          headers: { "user-agent": USER_AGENT },
          signal: AbortSignal.timeout(30_000),
        });
        if (res.status >= 400 && res.status < 500) return { missing: `HTTP ${res.status}` };
        if (!res.ok) {
          lastErr = `HTTP ${res.status}`;
          continue;
        }
        return { body: new TextDecoder("utf-8").decode(await res.arrayBuffer()) };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
    throw new Error(lastErr);
  };

  const get = async (url: string): Promise<string | null> => {
    try {
      const res = await request(url);
      if ("body" in res) return res.body;
      skipped.push({ url, reason: res.missing });
    } catch (e) {
      skipped.push({ url, reason: (e as Error).message });
    }
    return null;
  };

  // robots.txt: a missing file means everything is allowed.
  let rules = { allow: [] as string[], disallow: [] as string[] };
  const robotsUrl = new URL("/robots.txt", start[0]).href;
  try {
    const res = await doFetch(robotsUrl, { headers: { "user-agent": USER_AGENT } });
    if (res.ok) rules = parseRobots(await res.text());
  } catch {
    // unreachable robots.txt: proceed, the page fetches will surface real outages
  }

  const queue: string[] = [];
  const seen = new Set<string>();
  const enqueue = (href: string): void => {
    let key: string;
    try {
      key = normalizeUrl(href);
    } catch {
      return;
    }
    if (seen.has(key) || !isCrawlable(key)) return;
    if (!robotsAllows(rules, new URL(key).pathname)) {
      seen.add(key);
      skipped.push({ url: key, reason: "robots.txt" });
      return;
    }
    seen.add(key);
    queue.push(key);
  };
  start.forEach(enqueue);

  /**
   * Fetches the numbered fragments of a sectioned manual, in order, the way
   * the page's own loader does: stop at the first file that is missing. A
   * fragment that fails for another reason also ends the run, keeping the
   * sections already fetched, so one bad file never costs the whole manual.
   */
  const fetchSections = async (dirUrl: string): Promise<RawSection[]> => {
    const out: RawSection[] = [];
    for (let n = 1; n <= MAX_SECTIONS; n++) {
      const url = sectionFileUrl(dirUrl, n);
      if (!isCrawlable(url) || !robotsAllows(rules, new URL(url).pathname)) break;
      seen.add(url);
      await sleep(delay);
      try {
        const res = await request(url);
        if (!("body" in res)) break;
        out.push({ n, url, html: res.body });
      } catch (e) {
        skipped.push({ url, reason: (e as Error).message });
        break;
      }
    }
    return out;
  };

  const rewriteLink = (abs: string): string => {
    const t = new URL(abs);
    const s = t.hostname === "tasker.joaoapps.com" ? slugFromUrl(abs) : null;
    return s ? s + (t.hash || "") : abs;
  };

  const pages: CrawledPage[] = [];
  const slugs = new Set<string>();
  const anchors = new Map<string, Map<string, string>>();
  let fetched = 0;
  while (queue.length && (opts.limit === undefined || pages.length < opts.limit)) {
    const url = queue.shift() as string;
    if (fetched++ > 0) await sleep(delay);
    const html = await get(url);
    if (html === null) continue;
    const isDir = new URL(url).pathname.endsWith("/");
    const slug = isDir ? null : slugFromUrl(url);
    const conv = htmlToMarkdown(html, { baseUrl: url, rewriteLink });
    conv.links.forEach(enqueue);
    if (isDir || !slug) continue;
    const sectionsDir = slugs.has(slug) ? null : sectionsDirOf(html, url);
    if (sectionsDir) {
      const title = conv.title || slug;
      const manual = buildSectionedManual(
        { slug, title, url },
        await fetchSections(sectionsDir),
        rewriteLink,
      );
      const fresh = manual.pages.filter((p) => !slugs.has(p.slug));
      if (fresh.length) {
        manual.links.forEach(enqueue);
        anchors.set(slug, manual.anchors);
        slugs.add(slug);
        say(`${pages.length + 1} ${slug} (${fresh.length} sections)`);
        pages.push({ slug, title, url, markdown: asciiDashes(manual.indexMarkdown) });
        for (const p of fresh) {
          slugs.add(p.slug);
          pages.push({ ...p, title: asciiDashes(p.title), markdown: asciiDashes(p.markdown) });
        }
        continue;
      }
      // No section could be read: fall through and keep the shell as a plain page.
    }
    if (!conv.markdown.trim()) {
      skipped.push({ url, reason: "empty page" });
      continue;
    }
    if (slugs.has(slug)) continue;
    slugs.add(slug);
    const title = conv.title || slug;
    const nl = conv.markdown.indexOf("\n");
    const firstLine = (nl < 0 ? conv.markdown : conv.markdown.slice(0, nl)).replace(/^#+\s*/, "");
    if (conv.markdown.startsWith("#") && firstLine.trim().toLowerCase() === title.toLowerCase()) {
      conv.markdown = nl < 0 ? "" : conv.markdown.slice(nl + 1).trim();
    }
    say(`${pages.length + 1} ${slug}`);
    pages.push({ slug, title, url, markdown: asciiDashes(conv.markdown) });
  }
  for (const p of pages) p.markdown = remapAnchors(p.markdown, anchors);
  pages.sort((a, b) => (a.slug < b.slug ? -1 : 1));
  return { pages, skipped };
}

/** The markdown file body for a page: title line, Source line, then content. */
export function renderPageFile(p: CrawledPage): string {
  return `# ${p.title}\n\nSource: ${p.url}\n\n${p.markdown}\n`;
}

export function buildOutputs(
  pages: CrawledPage[],
  now: Date = new Date(),
): { index: DocsIndex; search: SearchIndex; files: Map<string, string> } {
  const files = new Map<string, string>();
  const hash = createHash("sha256");
  const entries = pages.map((p) => {
    const body = renderPageFile(p);
    files.set(`pages/${p.slug}.md`, body);
    hash.update(p.slug).update("\0").update(body).update("\0");
    return {
      slug: p.slug,
      title: p.title,
      url: p.url,
      section: sectionOf(p.slug),
      words: countWords(p.markdown),
    };
  });
  const search = buildSearchIndex(pages);
  hash.update(JSON.stringify(search));
  const index: DocsIndex = {
    generated: now.toISOString(),
    source: "https://tasker.joaoapps.com/userguide/en/",
    hash: hash.digest("hex"),
    pages: entries,
  };
  return { index, search, files };
}
