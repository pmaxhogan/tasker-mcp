# XML round trip

`src/xml/` is a hand-written, dependency-free XML layer built for one
guarantee:

> For any well-formed input `s`, `serializeXml(parseXml(s)) === s`, byte for byte.

There is no canonicalization of parsed input. The parser records the source
spelling of everything a generic XML library would normalize away, and the
serializer writes it back:

- the XML declaration, comments, processing instructions, and the DOCTYPE
  (including an internal subset), all kept verbatim;
- a leading BOM, whitespace between prolog nodes, and anything after the root
  element (trailing newline or not, trailing comments);
- whitespace-only text nodes and CRLF vs LF line endings;
- attribute order, quote style (`'` vs `"`), whitespace before each attribute
  and around `=`;
- entity spelling: `&apos;`, `&#39;`, `&#x27;`, and a literal `'` all decode
  to the same value but each is written back as it was;
- `<x/>` vs `<x />` vs `<x></x>`, and whitespace inside an end tag (`</x >`);
- CDATA sections, and named entities the parser does not know (`&nbsp;` is
  kept as written and decodes to itself).

Tasker element names with dots and dashes
(`<com.twofortyfouram.locale.intent.extra.BLURB-type>`) are ordinary names.

The test suite asserts this guarantee on every `test/fixtures/**/*.xml` file.

## Decoded values

Each text node and attribute carries both a decoded value (`text` / `value`)
and its source spelling (`raw`). Decoding resolves the five predefined
entities and numeric character references, and normalizes literal CRLF and lone
CR to LF as an XML processor does. Attribute values are not whitespace
normalized (a literal tab or newline stays as is). CDATA text is stored as
written.

## Edited and programmatic nodes

The serializer uses a node's `raw` spelling only while it still decodes to the
node's current value (and, for an attribute, does not contain the current quote
character). Editing a value in place therefore needs no extra bookkeeping: only
the edited node is re-escaped, and every other byte of the document is
unchanged. The `src/xml/query.ts` mutators (`setAttr`, `setChildText`, ...)
work this way.

Nodes without `raw` (created with `createElement` / `textNode`, or edited) are
escaped with this policy:

| Context                  | Escaped                                           |
| ------------------------ | ------------------------------------------------- |
| Text                     | `&` -> `&amp;`, `<` -> `&lt;`, `>` -> `&gt;`      |
| Attribute, `"` (default) | as text, plus `"` -> `&quot;`                     |
| Attribute, `'`           | as text, plus `'` -> `&apos;`                     |
| CDATA                    | written as is; `]]>` is split across two sections |

A new element with no children is written `<name/>`; set `selfClosing: false`
for `<name></name>`. A new attribute is written ` name="value"`.

## Errors

Malformed input throws `XmlParseError` with a 1-based `line` and `column`
(also in the message, e.g. `XML parse error at 3:7: mismatched close tag
</b>, expected </a> (opened at 1:1)`). Detected: unclosed and mismatched tags,
unquoted or unterminated attribute values, missing `=`, duplicate attributes,
`<` in an attribute value, a bare `&`, invalid character references,
unterminated comments / CDATA / PIs / DOCTYPE, text or a second element outside
the root, and an empty document.
