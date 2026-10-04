/**
 * Serializer for the lossless DOM. Parsed nodes are written from their source
 * spelling; programmatic (or edited) nodes get standard escaping. See
 * docs/xml-roundtrip.md.
 */

import type { XmlAttr, XmlDocument, XmlElement, XmlNode } from "./dom.ts";
import { decodeEntities } from "./parse.ts";

/** Escape text content: `&`, `<`, `>`. */
export function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

/** Escape an attribute value for the given quote: `&`, `<`, `>`, and the quote character. */
export function escapeAttr(s: string, quote: '"' | "'" = '"'): string {
  const out = escapeText(s);
  return quote === '"' ? out.replace(/"/g, "&quot;") : out.replace(/'/g, "&apos;");
}

/** A stored raw spelling is used only while it still decodes to the current value. */
function rawIsCurrent(raw: string | undefined, value: string): raw is string {
  return raw !== undefined && decodeEntities(raw) === value;
}

function attrToString(a: XmlAttr): string {
  const quote = a.quote ?? '"';
  const value =
    rawIsCurrent(a.raw, a.value) && !a.raw.includes(quote) ? a.raw : escapeAttr(a.value, quote);
  return `${a.pre ?? " "}${a.name}${a.eq ?? "="}${quote}${value}${quote}`;
}

function write(node: XmlNode, out: string[]): void {
  switch (node.type) {
    case "text":
      out.push(rawIsCurrent(node.raw, node.text) ? node.raw : escapeText(node.text));
      return;
    case "cdata":
      out.push(`<![CDATA[${node.text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`);
      return;
    case "comment":
    case "pi":
    case "doctype":
      out.push(node.raw);
      return;
    case "element":
      writeElement(node, out);
      return;
  }
}

function writeElement(el: XmlElement, out: string[]): void {
  out.push("<", el.name);
  for (const a of el.attrs) out.push(attrToString(a));
  out.push(el.tagTail ?? "");
  if (el.children.length === 0 && el.selfClosing) {
    out.push("/>");
    return;
  }
  out.push(">");
  for (const c of el.children) write(c, out);
  out.push("</", el.name, el.closeTail ?? "", ">");
}

/** Serialize any node (element subtree, text, comment, ...). */
export function serializeNode(node: XmlNode): string {
  const out: string[] = [];
  write(node, out);
  return out.join("");
}

/** Serialize a document. For a parsed, unmodified document this returns the input exactly. */
export function serializeXml(doc: XmlDocument): string {
  const out: string[] = [];
  for (const n of doc.prolog) write(n, out);
  write(doc.root, out);
  for (const n of doc.epilog) write(n, out);
  return out.join("");
}
