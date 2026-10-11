/**
 * Sectioned manuals: userguide pages whose body is not in the page itself.
 *
 * Such a page (scenes_v2.html is the one known today) is a shell. Its script
 * sets `var SECTIONS_DIR = 'scenes_v2/';` and loads `01.html`, `02.html`, ...
 * from that directory until one is missing. Each file is an HTML fragment
 * holding one `<section id data-part data-nav-title>`. A crawler that does not
 * run scripts sees only the shell's "Loading sections..." placeholder.
 *
 * These are pure helpers; the fetching is done by crawl.ts. Every section
 * becomes its own doc page, and the shell page becomes an index of them.
 */
import { decodeEntities, htmlToMarkdown } from "./html2md.ts";

/** Upper bound on numbered files tried for one manual, whatever the site answers. */
export const MAX_SECTIONS = 99;

export interface RawSection {
  /** 1-based position, the number in the file name. */
  n: number;
  /** URL the fragment was fetched from. */
  url: string;
  html: string;
}

export interface SectionPage {
  slug: string;
  title: string;
  url: string;
  markdown: string;
}

export interface SectionedManual {
  /** Replacement body for the shell page: an index of the sections. */
  indexMarkdown: string;
  pages: SectionPage[];
  /** Absolute link targets found in the sections. */
  links: string[];
  /** Element id -> slug of the section page that contains it. */
  anchors: Map<string, string>;
}

/**
 * Absolute URL of the sections directory when `html` is a loader shell, else
 * null. Both halves of the loader must be present: the SECTIONS_DIR assignment
 * and a `.html` file name built from it.
 */
export function sectionsDirOf(html: string, pageUrl: string): string | null {
  const m = /\bSECTIONS_DIR\s*=\s*(["'])([^"'\n]+)\1/.exec(html);
  if (!m || !/\bSECTIONS_DIR\s*\+[^;\n]*\.html/.test(html)) return null;
  const dir = m[2] as string;
  try {
    return new URL(dir.endsWith("/") ? dir : dir + "/", pageUrl).href;
  } catch {
    return null;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** URL of numbered section file `n` (two digits, zero padded, as the loader builds it). */
export function sectionFileUrl(dirUrl: string, n: number): string {
  return new URL(`${pad(n)}.html`, dirUrl).href;
}

function attr(tagAttrs: string, name: string): string {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i").exec(tagAttrs);
  return m ? decodeEntities(m[2] as string).trim() : "";
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function label(text: string): string {
  return text.replace(/[[\]]/g, "");
}

/**
 * Rewrites `](parent#id)` links to `](section#id)` for every id that lives in
 * a section page, so a link into a manual opens the section that has the
 * anchor instead of the manual's index.
 */
export function remapAnchors(markdown: string, anchors: Map<string, Map<string, string>>): string {
  if (!anchors.size) return markdown;
  return markdown.replace(/\]\(([A-Za-z0-9_.-]+)#([^)\s]+)\)/g, (m, slug: string, id: string) => {
    const target = anchors.get(slug)?.get(id);
    return target ? `](${target}#${id})` : m;
  });
}

/**
 * Converts the fetched fragments of one manual into section pages plus the
 * index body for the shell page. `rewriteLink` is the crawler's own link
 * rewriter, so links leaving the manual look like every other page's.
 */
export function buildSectionedManual(
  parent: { slug: string; title: string; url: string },
  sections: RawSection[],
  rewriteLink: (absoluteUrl: string) => string,
): SectionedManual {
  const anchors = new Map<string, string>();
  const links = new Set<string>();
  const pages: SectionPage[] = [];
  const outline: { part: string; lines: string[] }[] = [];

  for (const s of sections) {
    const tag = /<section\b([^>]*)>/i.exec(s.html);
    const id = tag ? attr(tag[1] as string, "id") : "";
    const part = tag ? attr(tag[1] as string, "data-part") : "";
    const idSlug = id.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const slug = `${parent.slug}__${pad(s.n)}${idSlug ? "_" + idSlug : ""}`;

    // The browser injects fragments into the shell, so relative and "#id"
    // links resolve against the shell URL, not the fragment's own URL.
    const html = s.html.replace(
      /(\shref\s*=\s*["'])#/gi,
      (_m, pre: string) => `${pre}${parent.url}#`,
    );
    const conv = htmlToMarkdown(html, { baseUrl: parent.url, rewriteLink });
    for (const l of conv.links) links.add(l);
    const navTitle = (tag ? attr(tag[1] as string, "data-nav-title") : "") || conv.title;
    let body = conv.markdown.trim();
    if (!body) continue;
    const nl = body.indexOf("\n");
    const first = nl < 0 ? body : body.slice(0, nl);
    if (
      /^#+\s/.test(first) &&
      first.replace(/^#+\s*/, "").toLowerCase() === navTitle.toLowerCase()
    ) {
      body = nl < 0 ? "" : body.slice(nl + 1).trim();
    }

    for (const m of s.html.matchAll(/\sid\s*=\s*(["'])([^"']+)\1/gi)) {
      const anchor = decodeEntities(m[2] as string);
      if (!anchors.has(anchor)) anchors.set(anchor, slug);
    }

    const name = navTitle || `Section ${s.n}`;
    const where = `Section ${s.n} of [${label(parent.title)}](${parent.slug})`;
    pages.push({
      slug,
      title: `${parent.title}: ${name}`,
      url: id ? `${parent.url}#${id}` : s.url,
      markdown: `${where}${part ? ` (${part})` : ""}.${body ? "\n\n" + body : ""}`,
    });

    const lines = [`- [${label(name)}](${slug})`];
    for (const h of s.html.matchAll(
      /<h3\b[^>]*?\sid\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/h3>/gi,
    )) {
      const text = label(plainText(h[3] as string));
      if (text) lines.push(`  - [${text}](${slug}#${h[2] as string})`);
    }
    const group = outline[outline.length - 1];
    if (group && group.part === part) group.lines.push(...lines);
    else outline.push({ part, lines });
  }

  const blocks = [
    `This manual has ${pages.length} sections, each a page of its own. ` +
      "Every link below is the slug of a section page.",
  ];
  for (const g of outline) {
    if (g.part) blocks.push(`## ${g.part}`);
    blocks.push(g.lines.join("\n"));
  }
  return { indexMarkdown: blocks.join("\n\n"), pages, links: [...links], anchors };
}
