/**
 * Lossless XML DOM for Tasker data. Parsing then serializing any input must
 * reproduce it byte for byte: attribute order and quoting, whitespace text
 * nodes, entity spelling, self-closing vs empty elements, the XML declaration,
 * comments, and trailing newlines are all preserved. Tasker semantics live in
 * src/model on top of this layer; nothing here knows what a Task is.
 */

export interface XmlAttr {
  name: string;
  /** Decoded value. */
  value: string;
  /** Exact source spelling of the value (between the quotes), when parsed. */
  raw?: string;
  quote?: '"' | "'";
}

export interface XmlElement {
  type: "element";
  name: string;
  attrs: XmlAttr[];
  children: XmlNode[];
  /** `<x/>` vs `<x></x>`; only meaningful when children is empty. */
  selfClosing: boolean;
  /** Whitespace inside the start tag before `>` or `/>`, e.g. `<x a="1" />`. */
  tagTail?: string;
}

export interface XmlText {
  type: "text";
  /** Decoded text. */
  text: string;
  /** Exact source spelling (entities left encoded), when parsed. */
  raw?: string;
}

export interface XmlCData {
  type: "cdata";
  text: string;
}

/** Comments, processing instructions, the XML declaration, DOCTYPE: kept verbatim. */
export interface XmlVerbatim {
  type: "comment" | "pi" | "doctype";
  raw: string;
}

export type XmlNode = XmlElement | XmlText | XmlCData | XmlVerbatim;

export interface XmlDocument {
  /** Everything before the root element (declaration, comments, whitespace). */
  prolog: XmlNode[];
  root: XmlElement;
  /** Everything after the root element (usually a trailing newline or nothing). */
  epilog: XmlNode[];
}
