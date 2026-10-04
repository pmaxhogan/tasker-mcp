/**
 * Hand-written lossless XML parser. Every node keeps enough source spelling
 * (raw text, attribute quoting and spacing, tag tails) that serializeXml
 * reproduces the input byte for byte. See docs/xml-roundtrip.md.
 */

import type { XmlAttr, XmlDocument, XmlElement, XmlNode } from "./dom.ts";

/** Malformed input. `line` and `column` are 1-based; `offset` is a string index. */
export class XmlParseError extends Error {
  readonly line: number;
  readonly column: number;
  readonly offset: number;

  constructor(message: string, src: string, offset: number) {
    const { line, column } = lineColumn(src, offset);
    super(`XML parse error at ${line}:${column}: ${message}`);
    this.name = "XmlParseError";
    this.line = line;
    this.column = column;
    this.offset = offset;
  }
}

function lineColumn(src: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

const PREDEFINED: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
};

const REF_RE = /&(#[0-9]+|#x[0-9a-fA-F]+|[A-Za-z_:][-A-Za-z0-9_:.]*);/y;

/**
 * Decode entity and character references in `raw`, after normalizing literal
 * CRLF and lone CR to LF (as an XML processor does). Unknown named entities
 * (which only a DOCTYPE could define) are left as written. With `onError`, a
 * bare `&` or an out-of-range character reference is reported; without it the
 * text is left as written. Reported indexes are into the CR-normalized text.
 */
export function decodeEntities(
  raw: string,
  onError?: (msg: string, index: number) => void,
): string {
  const s = raw.includes("\r") ? raw.replace(/\r\n?/g, "\n") : raw;
  if (!s.includes("&")) return s;
  let out = "";
  let i = 0;
  while (i < s.length) {
    const amp = s.indexOf("&", i);
    if (amp < 0) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, amp);
    REF_RE.lastIndex = amp;
    const m = REF_RE.exec(s);
    if (!m) {
      onError?.("'&' must start an entity or character reference (write &amp;)", amp);
      out += "&";
      i = amp + 1;
      continue;
    }
    const body = m[1]!;
    let decoded: string | undefined;
    if (body.startsWith("#")) {
      const cp = body[1] === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)) {
        decoded = String.fromCodePoint(cp);
      } else {
        onError?.(`invalid character reference '${m[0]}'`, amp);
      }
    } else {
      decoded = PREDEFINED[body];
    }
    out += decoded ?? m[0];
    i = amp + m[0].length;
  }
  return out;
}

const NAME_START = /[A-Za-z_:À-ÖØ-öø-˿Ͱ-ͽͿ-῿‌-‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�\uD800-\uDBFF]/;
const NAME_RE =
  /[A-Za-z_:À-ÖØ-öø-˿Ͱ-ͽͿ-῿‌-‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�\uD800-\uDBFF][-.0-9A-Za-z_:·À-ÖØ-öø-ͽͿ-῿‌-‍‿-⁀⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�\uD800-\uDFFF]*/y;
const WS_RE = /[ \t\r\n]*/y;

function isWs(s: string): boolean {
  return /^[ \t\r\n]*$/.test(s);
}

interface OpenFrame {
  el: XmlElement;
  start: number;
}

class Parser {
  private pos = 0;

  constructor(private readonly src: string) {}

  private fail(msg: string, at: number = this.pos): never {
    throw new XmlParseError(msg, this.src, at);
  }

  private startsWith(s: string): boolean {
    return this.src.startsWith(s, this.pos);
  }

  private readWs(): string {
    WS_RE.lastIndex = this.pos;
    const m = WS_RE.exec(this.src)!;
    this.pos += m[0].length;
    return m[0];
  }

  private readName(what: string): string {
    NAME_RE.lastIndex = this.pos;
    const m = NAME_RE.exec(this.src);
    if (!m) this.fail(`expected ${what}`);
    this.pos += m[0].length;
    return m[0];
  }

  /** Read up to and including `end`, returning the whole span starting at `start`. */
  private readUntil(start: number, end: string, what: string): string {
    const idx = this.src.indexOf(end, this.pos);
    if (idx < 0) this.fail(`unterminated ${what}`, start);
    this.pos = idx + end.length;
    return this.src.slice(start, this.pos);
  }

  private decode(raw: string, rawStart: number): string {
    return decodeEntities(raw, (msg, index) => {
      // Re-locate the offending '&' in the raw source (CR normalization may
      // have shifted the index inside the decoder).
      const shift = raw.includes("\r") ? findRawAmp(raw, index) : index;
      this.fail(msg, rawStart + shift);
    });
  }

  private readDoctype(start: number): string {
    let depth = 0;
    let quote = "";
    for (let i = this.pos; i < this.src.length; i++) {
      const c = this.src[i];
      if (quote) {
        if (c === quote) quote = "";
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === "[") {
        depth++;
      } else if (c === "]") {
        depth--;
      } else if (c === ">" && depth <= 0) {
        this.pos = i + 1;
        return this.src.slice(start, this.pos);
      }
    }
    return this.fail("unterminated DOCTYPE", start);
  }

  /** Parse a misc node (comment, PI, DOCTYPE, whitespace) outside the root. */
  private readMisc(nodes: XmlNode[], allowDoctype: boolean): boolean {
    const start = this.pos;
    if (this.startsWith("<?")) {
      this.pos += 2;
      nodes.push({ type: "pi", raw: this.readUntil(start, "?>", "processing instruction") });
      return true;
    }
    if (this.startsWith("<!--")) {
      this.pos += 4;
      nodes.push({ type: "comment", raw: this.readUntil(start, "-->", "comment") });
      return true;
    }
    if (this.startsWith("<!DOCTYPE")) {
      if (!allowDoctype) this.fail("DOCTYPE is only allowed before the root element");
      this.pos += 9;
      nodes.push({ type: "doctype", raw: this.readDoctype(start) });
      return true;
    }
    if (this.src[this.pos] !== "<") {
      const lt = this.src.indexOf("<", this.pos);
      const end = lt < 0 ? this.src.length : lt;
      const raw = this.src.slice(this.pos, end);
      const check = start === 0 && raw.startsWith("﻿") ? raw.slice(1) : raw;
      if (!isWs(check)) {
        const bad = start + raw.length - check.length + check.search(/[^ \t\r\n]/);
        this.fail("text is not allowed outside the root element", bad);
      }
      nodes.push({ type: "text", text: decodeEntities(raw), raw });
      this.pos = end;
      return true;
    }
    return false;
  }

  parseDocument(): XmlDocument {
    const prolog: XmlNode[] = [];
    while (this.pos < this.src.length && this.readMisc(prolog, true)) {
      // keep reading prolog nodes
    }
    if (this.pos >= this.src.length) this.fail("no root element");
    const root = this.parseElement();
    const epilog: XmlNode[] = [];
    while (this.pos < this.src.length) {
      if (!this.readMisc(epilog, false)) {
        this.fail("only one root element is allowed");
      }
    }
    return { prolog, root, epilog };
  }

  /** Parse a start tag at `<`. Returns the element; `selfClosing` says whether it is complete. */
  private parseStartTag(): XmlElement {
    this.pos++; // '<'
    const name = this.readName("element name after '<'");
    const attrs: XmlAttr[] = [];
    const seen = new Set<string>();
    for (;;) {
      const ws = this.readWs();
      if (this.startsWith("/>")) {
        this.pos += 2;
        return { type: "element", name, attrs, children: [], selfClosing: true, tagTail: ws };
      }
      if (this.startsWith(">")) {
        this.pos += 1;
        return { type: "element", name, attrs, children: [], selfClosing: false, tagTail: ws };
      }
      if (this.pos >= this.src.length) this.fail(`unclosed start tag <${name}>`);
      if (!NAME_START.test(this.src[this.pos]!)) {
        this.fail(`unexpected character '${this.src[this.pos]}' in start tag <${name}>`);
      }
      if (ws === "") this.fail("expected whitespace before attribute name");
      const nameAt = this.pos;
      const attrName = this.readName("attribute name");
      if (seen.has(attrName)) this.fail(`duplicate attribute '${attrName}'`, nameAt);
      seen.add(attrName);
      const eqStart = this.pos;
      this.readWs();
      if (this.src[this.pos] !== "=") this.fail(`expected '=' after attribute '${attrName}'`);
      this.pos++;
      this.readWs();
      const eq = this.src.slice(eqStart, this.pos);
      const quote = this.src[this.pos];
      if (quote !== '"' && quote !== "'") {
        this.fail(`value of attribute '${attrName}' must be quoted`);
      }
      const valStart = this.pos + 1;
      const close = this.src.indexOf(quote, valStart);
      if (close < 0) this.fail(`unterminated value for attribute '${attrName}'`, this.pos);
      const raw = this.src.slice(valStart, close);
      const lt = raw.indexOf("<");
      if (lt >= 0) this.fail("'<' is not allowed in an attribute value", valStart + lt);
      const value = this.decode(raw, valStart);
      this.pos = close + 1;
      attrs.push({ name: attrName, value, raw, quote, pre: ws, eq });
    }
  }

  private parseElement(): XmlElement {
    const rootStart = this.pos;
    if (this.src[this.pos] !== "<" || this.startsWith("</")) {
      this.fail("expected an element");
    }
    const root = this.parseStartTag();
    if (root.selfClosing) return root;
    const stack: OpenFrame[] = [{ el: root, start: rootStart }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const kids = frame.el.children;
      const start = this.pos;
      if (this.pos >= this.src.length) {
        this.fail(`unclosed tag <${frame.el.name}>`, frame.start);
      }
      const c = this.src[this.pos];
      if (c !== "<") {
        const lt = this.src.indexOf("<", this.pos);
        const end = lt < 0 ? this.src.length : lt;
        const raw = this.src.slice(this.pos, end);
        kids.push({ type: "text", text: this.decode(raw, this.pos), raw });
        this.pos = end;
        continue;
      }
      if (this.startsWith("</")) {
        this.pos += 2;
        const name = this.readName("element name after '</'");
        if (name !== frame.el.name) {
          const opened = lineColumn(this.src, frame.start);
          this.fail(
            `mismatched close tag </${name}>, expected </${frame.el.name}> ` +
              `(opened at ${opened.line}:${opened.column})`,
            start,
          );
        }
        const tail = this.readWs();
        if (this.src[this.pos] !== ">") this.fail(`expected '>' to end close tag </${name}>`);
        this.pos++;
        if (tail !== "") frame.el.closeTail = tail;
        stack.pop();
        continue;
      }
      if (this.startsWith("<!--")) {
        this.pos += 4;
        kids.push({ type: "comment", raw: this.readUntil(start, "-->", "comment") });
        continue;
      }
      if (this.startsWith("<![CDATA[")) {
        this.pos += 9;
        const span = this.readUntil(start, "]]>", "CDATA section");
        kids.push({ type: "cdata", text: span.slice(9, -3) });
        continue;
      }
      if (this.startsWith("<?")) {
        this.pos += 2;
        kids.push({ type: "pi", raw: this.readUntil(start, "?>", "processing instruction") });
        continue;
      }
      if (this.startsWith("<!")) this.fail("unexpected markup declaration inside an element");
      const el = this.parseStartTag();
      kids.push(el);
      if (!el.selfClosing) stack.push({ el, start });
    }
    return root;
  }
}

/** Map an index in the CR-normalized string back to the raw string. */
function findRawAmp(raw: string, normalizedIndex: number): number {
  let n = 0;
  for (let i = 0; i < raw.length; i++) {
    if (n === normalizedIndex) return i;
    if (raw[i] === "\r" && raw[i + 1] === "\n") i++;
    n++;
  }
  return raw.length;
}

/**
 * Parse an XML document losslessly. Throws XmlParseError (with 1-based
 * line:column) on malformed input.
 */
export function parseXml(src: string): XmlDocument {
  return new Parser(src).parseDocument();
}
