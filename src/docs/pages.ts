/**
 * Page metadata and the compact search index: pure functions shared by the
 * scraper (which writes the files) and DocsStore (which reads them).
 */
import { tokenize } from "./tokenize.ts";

export const GUIDE_ROOT_PATH = "/userguide/en/";

export const DOC_SECTIONS = ["guide", "action", "event", "state", "other"] as const;
export type DocSection = (typeof DOC_SECTIONS)[number];

export interface PageEntry {
  slug: string;
  title: string;
  url: string;
  section: DocSection;
  words: number;
}

export interface DocsIndex {
  generated: string;
  source: string;
  /** Hash over all page content; lets the sync job skip a no-op push. */
  hash?: string;
  pages: PageEntry[];
}

/** term -> [[pageIdx, weightedTf], ...], highest weight first. */
export interface SearchIndex {
  v: 1;
  terms: Record<string, [number, number][]>;
}

/** Slug for a userguide URL, or null when the URL is not a page under the guide root. */
export function slugFromUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!u.pathname.startsWith(GUIDE_ROOT_PATH)) return null;
  const rest = u.pathname.slice(GUIDE_ROOT_PATH.length);
  if (!/\.html?$/i.test(rest)) return null;
  const slug = rest
    .replace(/\.html?$/i, "")
    .split("/")
    .filter(Boolean)
    .join("__")
    .replace(/[^A-Za-z0-9_.-]/g, "_");
  return slug && !slug.includes("..") ? slug : null;
}

export function sectionOf(slug: string): DocSection {
  if (!slug.startsWith("help__")) return "guide";
  const name = slug.slice("help__".length);
  if (/^[aes]h_index$/.test(name)) return "other"; // A-Z listing pages, not entries
  if (name.startsWith("ah_")) return "action";
  if (name.startsWith("eh_")) return "event";
  if (name.startsWith("sh_")) return "state";
  return "other";
}

/** Only slugs made of safe characters may touch the disk. */
export function isSafeSlug(slug: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(slug) && !slug.includes("..");
}

export function countWords(markdown: string): number {
  return (markdown.match(/\S+/g) ?? []).length;
}

const TITLE_BOOST = 5;

export function buildSearchIndex(
  pages: { slug: string; title: string; markdown: string }[],
  opts: { maxPostings?: number } = {},
): SearchIndex {
  const maxPostings = opts.maxPostings ?? 150;
  const byTerm = new Map<string, [number, number][]>();
  pages.forEach((p, idx) => {
    const tf = new Map<string, number>();
    for (const t of tokenize(p.markdown)) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tokenize(p.title + " " + p.slug.replace(/^help__/, "")))
      tf.set(t, (tf.get(t) ?? 0) + TITLE_BOOST);
    for (const [t, c] of tf) {
      let list = byTerm.get(t);
      if (!list) byTerm.set(t, (list = []));
      list.push([idx, c]);
    }
  });
  const terms: Record<string, [number, number][]> = {};
  const tooCommon = pages.length >= 20 ? pages.length * 0.5 : Infinity;
  for (const [t, list] of [...byTerm].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (list.length > tooCommon) continue;
    list.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    terms[t] = list.slice(0, maxPostings);
  }
  return { v: 1, terms };
}
