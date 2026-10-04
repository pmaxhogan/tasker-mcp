export type * from "./dom.ts";
export { XmlParseError, decodeEntities, parseXml } from "./parse.ts";
export { escapeAttr, escapeText, serializeNode, serializeXml } from "./serialize.ts";
export {
  attr,
  child,
  childText,
  children,
  cloneNode,
  createElement,
  elementText,
  insertChildElement,
  parseFragment,
  removeAttr,
  removeChild,
  serializeElement,
  setAttr,
  setChildText,
  textNode,
} from "./query.ts";
