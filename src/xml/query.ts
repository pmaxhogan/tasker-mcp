/**
 * Small DOM helpers used by the Tasker model layer. Mutating helpers drop the
 * stored raw spelling of what they touch, so the serializer re-escapes only
 * the edited values and leaves everything else byte-identical.
 */

import type { XmlAttr, XmlElement, XmlNode, XmlText } from "./dom.ts";
import { parseXml } from "./parse.ts";
import { serializeNode } from "./serialize.ts";

function isElement(n: XmlNode): n is XmlElement {
  return n.type === "element";
}

function isWhitespaceText(n: XmlNode | undefined): n is XmlText {
  return n !== undefined && n.type === "text" && /^[ \t\r\n]*$/.test(n.text);
}

/** Element children of `el`, optionally only those named `name`. */
export function children(el: XmlElement, name?: string): XmlElement[] {
  return el.children.filter(
    (c): c is XmlElement => isElement(c) && (name === undefined || c.name === name),
  );
}

/** First element child named `name`. */
export function child(el: XmlElement, name: string): XmlElement | undefined {
  return el.children.find((c): c is XmlElement => isElement(c) && c.name === name);
}

/** Decoded text of the first child named `name`, or undefined when there is no such child. */
export function childText(el: XmlElement, name: string): string | undefined {
  const c = child(el, name);
  return c === undefined ? undefined : elementText(c);
}

/**
 * Decoded text content of `el`: all text and CDATA descendants concatenated in
 * document order (DOM textContent semantics). Comments and PIs are skipped.
 */
export function elementText(el: XmlElement): string {
  let out = "";
  for (const c of el.children) {
    if (c.type === "text" || c.type === "cdata") out += c.text;
    else if (c.type === "element") out += elementText(c);
  }
  return out;
}

/** A programmatic text node (serialized with standard escaping). */
export function textNode(text: string): XmlText {
  return { type: "text", text };
}

/**
 * A programmatic element. Attributes keep the object's key order. With no
 * children it serializes as `<name/>`.
 */
export function createElement(
  name: string,
  attrs?: Record<string, string>,
  kids?: XmlNode[],
): XmlElement {
  return {
    type: "element",
    name,
    attrs: Object.entries(attrs ?? {}).map(([n, value]) => ({ name: n, value })),
    children: kids ?? [],
    selfClosing: true,
  };
}

/**
 * Set the text of the first child named `name`, replacing all its content.
 * When the child is missing it is created after the last element child (so
 * before any trailing whitespace), with the indentation used by that sibling.
 * Empty text leaves the child empty (`<name/>` if it was or is new). Returns
 * the child.
 */
export function setChildText(el: XmlElement, name: string, text: string): XmlElement {
  let c = child(el, name);
  if (c === undefined) {
    c = createElement(name);
    insertChildElement(el, c);
  }
  c.children = text === "" ? [] : [textNode(text)];
  return c;
}

/**
 * Insert `newChild` after the last element child of `el`, copying the
 * whitespace text that precedes that sibling as indentation. With no element
 * children it goes before any trailing whitespace-only text.
 */
export function insertChildElement(el: XmlElement, newChild: XmlElement): void {
  const kids = el.children;
  let last = -1;
  for (let i = kids.length - 1; i >= 0; i--) {
    if (kids[i]!.type === "element") {
      last = i;
      break;
    }
  }
  if (last >= 0) {
    const before = kids[last - 1];
    const indent = isWhitespaceText(before) ? [textNode(before.text)] : [];
    kids.splice(last + 1, 0, ...indent, newChild);
    return;
  }
  let at = kids.length;
  while (at > 0 && isWhitespaceText(kids[at - 1])) at--;
  kids.splice(at, 0, newChild);
}

/** Decoded value of attribute `name`, or undefined. */
export function attr(el: XmlElement, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

/** Set attribute `name`, keeping its position and quote style if it exists, else appending it. */
export function setAttr(el: XmlElement, name: string, value: string): void {
  const existing = el.attrs.find((a) => a.name === name);
  if (existing === undefined) {
    el.attrs.push({ name, value });
    return;
  }
  if (existing.value === value) return;
  existing.value = value;
  delete existing.raw;
}

/** Remove attribute `name`. Returns whether it existed. */
export function removeAttr(el: XmlElement, name: string): boolean {
  const i = el.attrs.findIndex((a: XmlAttr) => a.name === name);
  if (i < 0) return false;
  el.attrs.splice(i, 1);
  return true;
}

/**
 * Remove `node` (by identity) from `el`'s children, along with the
 * whitespace-only text directly before it (its indentation). Returns whether
 * it was found.
 */
export function removeChild(el: XmlElement, node: XmlNode): boolean {
  const i = el.children.indexOf(node);
  if (i < 0) return false;
  const withIndent = i > 0 && isWhitespaceText(el.children[i - 1]);
  el.children.splice(withIndent ? i - 1 : i, withIndent ? 2 : 1);
  return true;
}

/** Deep copy of a node. Raw spellings are kept, so the copy serializes identically. */
export function cloneNode<T extends XmlNode>(node: T): T {
  return structuredClone(node);
}

/** Serialize one element subtree exactly as it appears in the source (for raw passthrough). */
export function serializeElement(el: XmlElement): string {
  return serializeNode(el);
}

/**
 * Parse a fragment holding exactly one element (e.g. one `<Action>`), with
 * optional surrounding whitespace, comments, or an XML declaration (all
 * discarded). Throws XmlParseError on anything else.
 */
export function parseFragment(xml: string): XmlElement {
  return parseXml(xml).root;
}
