/**
 * A small, forgiving HTML to Markdown converter for the Tasker userguide.
 *
 * The userguide is hand-written 2010s HTML: upper-case tags, unclosed <P> and
 * <LI>, stray </P>, XML prologs. This is a tolerant single-pass tag scanner, not
 * a spec-compliant parser. It handles headings, paragraphs, nested lists,
 * tables, preformatted code, inline emphasis/code, and links.
 */
import { asciiDashes } from "./tokenize.ts";

export interface ConvertOptions {
  /** Absolute URL of the page, used to resolve relative links. */
  baseUrl: string;
  /** Maps an absolute link target to the string placed in the Markdown. */
  rewriteLink?: (absoluteUrl: string) => string;
}

export interface ConvertResult {
  /** Text of <title> (with a leading "Tasker:" removed), else the first heading, else "". */
  title: string;
  /** Markdown body (no title line). */
  markdown: string;
  /** Every distinct absolute link target found (fragments kept). */
  links: string[];
}

const SKIP = new Set(["script", "style", "nav", "noscript", "svg", "template", "iframe", "head"]);

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "(c)",
  reg: "(R)",
  hellip: "...",
  mdash: "-",
  ndash: "-",
  minus: "-",
  hyphen: "-",
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  laquo: "<<",
  raquo: ">>",
  bull: "*",
  middot: "*",
  rarr: "->",
  larr: "<-",
  times: "x",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code =
        (body[1] as string).toLowerCase() === "x"
          ? parseInt(body.slice(2), 16)
          : Number(body.slice(1));
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return "";
      return String.fromCodePoint(code);
    }
    return ENTITIES[body.toLowerCase()] ?? m;
  });
}

interface Tag {
  name: string;
  closing: boolean;
  attrs: Record<string, string>;
  end: number;
}

function parseTag(html: string, start: number): Tag | null {
  const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(start, start + 64));
  if (!m) return null;
  let i = start + m[0].length;
  let quote = "";
  const attrStart = i;
  for (; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ">") break;
  }
  const attrText = html.slice(attrStart, i);
  const attrs: Record<string, string> = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
  let am: RegExpExecArray | null;
  while ((am = re.exec(attrText))) {
    const v = am[2] ?? "";
    attrs[(am[1] as string).toLowerCase()] = decodeEntities(/^["']/.test(v) ? v.slice(1, -1) : v);
  }
  return { name: (m[2] as string).toLowerCase(), closing: m[1] === "/", attrs, end: i + 1 };
}

function normalize(s: string): string {
  return s
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlToMarkdown(html: string, opts: ConvertOptions): ConvertResult {
  const blocks: { text: string; li: boolean }[] = [];
  const links = new Set<string>();
  let inline = "";
  let inPre = false;
  let pre = "";
  let headingLevel = 0;
  let headingText = "";
  let firstHeading = "";
  let titleText = "";
  const listStack: { ordered: boolean; n: number }[] = [];
  let pendingPrefix = "";
  let liIndent = "";
  let inLi = false;
  let table: string[][] | null = null;
  let row: string[] | null = null;
  let cellOpen = false;
  const anchorStack: { start: number; href: string }[] = [];

  const resolve = (href: string): string | null => {
    const h = href.trim();
    if (!h || h.startsWith("#") || /^(javascript|data):/i.test(h)) return null;
    try {
      return new URL(h, opts.baseUrl).href;
    } catch {
      return null;
    }
  };

  const flush = (): void => {
    const text = normalize(inline);
    inline = "";
    if (!text) return;
    if (inLi) {
      const cont = liIndent + "  ";
      const lines = text.split("\n").map((l, idx) => (idx === 0 || !l ? l : cont + l));
      lines[0] = (pendingPrefix || cont) + lines[0];
      pendingPrefix = "";
      blocks.push({ text: lines.join("\n"), li: true });
    } else {
      blocks.push({ text, li: false });
    }
  };

  const closeCell = (): void => {
    if (!row) return;
    const t = normalize(inline).replace(/\n+/g, " ").replace(/\|/g, "\\|");
    inline = "";
    if (cellOpen) row.push(t);
    cellOpen = false;
  };

  const flushTable = (): void => {
    if (!table) return;
    const rows = table.filter((r) => r.length);
    table = null;
    if (!rows.length) return;
    const cols = Math.max(...rows.map((r) => r.length));
    const fmt = (r: string[]): string =>
      "| " + Array.from({ length: cols }, (_, i) => r[i] ?? "").join(" | ") + " |";
    const lines = [fmt(rows[0] as string[]), "| " + Array(cols).fill("---").join(" | ") + " |"];
    for (const r of rows.slice(1)) lines.push(fmt(r));
    blocks.push({ text: lines.join("\n"), li: false });
  };

  const addText = (raw: string): void => {
    if (inPre) {
      pre += decodeEntities(raw);
      return;
    }
    const t = decodeEntities(raw).replace(/\s+/g, " ");
    if (headingLevel) headingText += t;
    else inline += t;
  };

  const lower = html.toLowerCase();
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      addText(html.slice(i));
      break;
    }
    if (lt > i) addText(html.slice(i, lt));
    if (html.startsWith("<!--", lt)) {
      const e = html.indexOf("-->", lt + 4);
      i = e < 0 ? n : e + 3;
      continue;
    }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      const e = html.indexOf(">", lt);
      i = e < 0 ? n : e + 1;
      continue;
    }
    const tag = parseTag(html, lt);
    if (!tag) {
      addText("<");
      i = lt + 1;
      continue;
    }
    i = tag.end;
    const { name, closing, attrs } = tag;

    if (SKIP.has(name)) {
      if (!closing) {
        const e = lower.indexOf(`</${name}`, i);
        if (name === "head" && e >= 0) {
          const tm = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html.slice(i, e));
          if (tm)
            titleText = decodeEntities(tm[1] as string)
              .replace(/\s+/g, " ")
              .trim();
        }
        const g = e < 0 ? -1 : html.indexOf(">", e);
        i = g < 0 ? n : g + 1;
      }
      continue;
    }
    if (name === "title") {
      const e = lower.indexOf("</title", i);
      if (!closing && e >= 0) {
        titleText = decodeEntities(html.slice(i, e)).replace(/\s+/g, " ").trim();
        const g = html.indexOf(">", e);
        i = g < 0 ? n : g + 1;
      }
      continue;
    }

    if (inPre) {
      if (name === "pre" && closing) {
        inPre = false;
        const body = pre.replace(/^\n+|\s+$/g, "");
        pre = "";
        if (body) blocks.push({ text: "```\n" + body + "\n```", li: false });
      } else if (name === "br") pre += "\n";
      continue;
    }

    if (/^h[1-6]$/.test(name)) {
      if (!closing) {
        flush();
        headingLevel = Number(name[1]);
        headingText = "";
      } else if (headingLevel) {
        const text = normalize(headingText);
        const level = headingLevel;
        headingLevel = 0;
        headingText = "";
        if (text) {
          if (!firstHeading) firstHeading = text;
          blocks.push({ text: "#".repeat(Math.max(2, level)) + " " + text, li: false });
        }
      }
      continue;
    }

    switch (name) {
      case "a":
        if (!closing) {
          const abs = attrs.href === undefined ? null : resolve(attrs.href);
          if (abs) {
            links.add(abs);
            if (headingLevel) anchorStack.push({ start: -1, href: abs });
            else {
              anchorStack.push({ start: inline.length, href: abs });
              inline += "[";
            }
          }
        } else {
          const a = anchorStack.pop();
          if (a && a.start >= 0) {
            const label = inline.slice(a.start + 1);
            if (!label.trim()) inline = inline.slice(0, a.start) + label;
            else {
              const target = opts.rewriteLink ? opts.rewriteLink(a.href) : a.href;
              inline += `](${target.replace(/\)/g, "%29").replace(/ /g, "%20")})`;
            }
          }
        }
        break;
      case "b":
      case "strong":
        if (!headingLevel) inline += "**";
        break;
      case "i":
      case "em":
        if (!headingLevel) inline += "*";
        break;
      case "code":
      case "tt":
        if (!headingLevel) inline += "`";
        break;
      case "br":
        if (headingLevel) headingText += " ";
        else inline += row ? " " : "\n";
        break;
      case "pre":
        if (!closing) {
          flush();
          inPre = true;
          pre = "";
        }
        break;
      case "ul":
      case "ol":
        flush();
        if (!closing) listStack.push({ ordered: name === "ol", n: 0 });
        else listStack.pop();
        liIndent = "  ".repeat(Math.max(0, listStack.length - 1));
        if (listStack.length === 0) inLi = false;
        break;
      case "li":
        flush();
        if (!closing) {
          const top = listStack[listStack.length - 1] ?? { ordered: false, n: 0 };
          top.n++;
          liIndent = "  ".repeat(Math.max(0, listStack.length - 1));
          pendingPrefix = liIndent + (top.ordered ? `${top.n}. ` : "- ");
          inLi = true;
        }
        break;
      case "table":
        if (!closing) {
          flush();
          table ??= [];
        } else {
          closeCell();
          flush();
          if (row && table) table.push(row);
          row = null;
          flushTable();
        }
        break;
      case "tr":
        closeCell();
        if (row && table) table.push(row);
        row = closing ? null : [];
        if (!closing) table ??= [];
        break;
      case "td":
      case "th":
        if (!table) break;
        closeCell();
        if (!closing) {
          row ??= [];
          cellOpen = true;
        }
        break;
      case "p":
      case "div":
      case "blockquote":
      case "hr":
      case "dl":
      case "dt":
      case "dd":
      case "body":
      case "center":
        if (!row) flush();
        break;
      default:
        break;
    }
  }
  flush();
  flushTable();
  if (inPre && pre.trim()) blocks.push({ text: "```\n" + pre.trim() + "\n```", li: false });

  let out = "";
  blocks.forEach((b, idx) => {
    if (idx === 0) out = b.text;
    else out += (b.li && blocks[idx - 1]?.li ? "\n" : "\n\n") + b.text;
  });
  out = asciiDashes(out);

  let title = titleText.replace(/^tasker:\s*/i, "").trim();
  if (!title) title = firstHeading;
  return { title: asciiDashes(title), markdown: out, links: [...links] };
}
