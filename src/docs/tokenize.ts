/**
 * Shared text helpers for the docs pipeline. Used both by the scraper (to build
 * the search index) and by DocsStore (to tokenize queries), so the two always
 * agree on what a term is.
 */

const STOPWORDS = new Set(
  (
    "a an and are as at be but by for from has have if in into is it its of on or " +
    "that the their then there these this to was were will with you your can may " +
    "not no so than too very when which who how what also any all each such per " +
    "use used using via"
  ).split(" "),
);

/** Replace every dash-like character (U+2010 to U+2015, U+2212) with ASCII "-". */
export function asciiDashes(s: string): string {
  return s.replace(/[\u2010-\u2015\u2212]/g, "-");
}

function stem(t: string): string {
  if (t.length > 3 && t.endsWith("s") && !/(ss|us|is)$/.test(t)) return t.slice(0, -1);
  return t;
}

/**
 * Lower-cased index terms: alphanumerics and underscores. A token containing
 * underscores (a variable name such as http_request_id) is emitted whole and as
 * its parts. Stopwords and single characters are dropped. A trailing plural "s"
 * is stripped.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  const raw = text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
  const push = (t: string): void => {
    t = stem(t);
    if (t.length >= 2 && !STOPWORDS.has(t)) out.push(t);
  };
  for (const tok of raw) {
    const trimmed = tok.replace(/^_+|_+$/g, "");
    if (!trimmed) continue;
    if (trimmed.includes("_")) {
      push(trimmed);
      for (const part of trimmed.split("_")) if (part) push(part);
    } else {
      push(trimmed);
    }
  }
  return out;
}
