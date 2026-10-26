# Tasker Scenes V2 Manual: Provides System

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#provides

Section 8 of [Tasker Scenes V2 Manual](scenes_v2) (Data & Variables).

The Provides system lets you inject named values into a component tree. Parent containers declare key-value pairs, and any descendant can reference them with the `@{key}` syntax. While [Tasker variables](scenes_v2__09_variables#variables) (`%var`) are the primary way to pass data into layouts at runtime, provides gives your layout self-contained defaults - making it more independent and shareable without relying on external Tasker configurations to work.

### Screen-Level Provides

Set provides at the screen level (in Screen Properties when no component is selected) to make values available to the *entire* layout. Screen-level provides are resolved first, before any component-level provides, so they form the base scope for the whole tree.

Screen-level provides also apply to the screen's own settings and to its screen event handlers (Screen Shown, Screen Hidden, Back Pressed and so on). Those handlers sit outside the root element, so they only see screen-level provides, never ones declared on a container. To use a provides key as the **Variable** of a Set Variable action, give it the bare variable name (e.g. `accent`), not `%accent`: a leading `%` in that field writes to the variable whose *name* is stored in `%accent`.

This is the right place for:

- Theme values you want consistent across the layout (accent colors, font sizes)
- Default values that make the layout work standalone, without relying on Tasker variables
- Configuration flags that control layout behavior (via [`showWhen`](scenes_v2__10_show_when#show-when) expressions)

```
{
  "provides": {
    "accentColor": "primary",
    "cardBg": "surfaceVariant",
    "%show_footer": "true"
  },
  "root": {
    "type": "Column", "id": "root",
    "children": [
      { "type": "Text", "id": "title", "text": "Dashboard", "color": "@{accentColor}" },
      { "type": "Text", "id": "footer", "text": "v1.0", "showWhen": "%show_footer" }
    ]
  }
}
```

### Component-Level Provides

Container components (Column, Row, FlowRow, FlowColumn, Box, FlexBox, Card, Scaffold) can also declare their own provides. These are scoped to the container's children only - sibling components or ancestors cannot see them.

When a child container declares a provides key that already exists in a parent's scope, the child's value **shadows** (overrides) the parent's value for all of its descendants. The parent's value remains unchanged for everything outside the child container.

```
{
  "root": {
    "type": "Column", "id": "outer",
    "provides": { "textColor": "#FF0000" },
    "children": [
      { "type": "Text", "id": "red", "text": "Red text", "color": "@{textColor}" },
      {
        "type": "Column", "id": "inner",
        "provides": { "textColor": "#0000FF" },
        "children": [
  { "type": "Text", "id": "blue", "text": "Blue text (shadowed)", "color": "@{textColor}" }
        ]
      },
      { "type": "Text", "id": "still_red", "text": "Still red", "color": "@{textColor}" }
    ]
  }
}
```

In this example, the inner Column shadows `textColor` to blue for its children. But the last Text is a sibling of the inner Column, not a child, so it still sees the outer red value.

### Transitive Resolution

Provides values can reference other provides keys. The system resolves them transitively - if key A references key B, and key B has a concrete value, A resolves to that value. This works across scope levels too.

```
{
  "provides": {
    "brandColor": "#6750A4",
    "headerBg": "@{brandColor}",
    "headerText": "onPrimary"
  },
  "root": {
    "type": "Row", "id": "header",
    "modifiers": [
      { "type": "Background", "color": "@{headerBg}" }
    ],
    "children": [
      { "type": "Text", "id": "title", "text": "My App", "color": "@{headerText}" }
    ]
  }
}
```

Here `headerBg` references `brandColor`, so it resolves to `#6750A4`. Resolution runs in repeated passes until the values stop changing. Circular references are guarded only for termination: if A references B and B references A, the resolver stops after it detects the loop and returns the last pass it computed. It does not blow up, but a circular reference does not produce a useful value - one side ends up holding the other's unresolved `@{...}` text. Avoid circular provides.

### Reference Syntax

Use `@{key}` in any string property to reference a provided value. This works everywhere a string is accepted - component properties (text, color, textSize, placeholder, etc.) and modifier properties (color, width, radius, etc.).

- `@{userName}` - replaced with the full value of the "userName" key
- `Hello, @{name}!` - inline replacement, the rest of the string is preserved
- `@{size}` in a `textSize` field - works for numeric properties too
- Multiple references in one string: `@{firstName} @{lastName}` - each one is replaced independently

If a referenced key doesn't exist in the current scope, the `@{key}` text is left as-is (not replaced). This makes it easy to spot missing provides - you'll see the literal `@{...}` in the preview.

### Fallback Values

Add a fallback inside the braces with `?:` - if the key is not in scope, the literal fallback text is used instead of leaving the reference unresolved. The form is `@{key ?: fallback}`. Whitespace around `?:` is trimmed, so `@{key?:fallback}` works too.

- `@{accentColor ?: primary}` - resolves to the `accentColor` provides value, or the literal `primary` if no such key is in scope
- `Hello, @{name ?: there}!` - prints `Hello, there!` when `name` is not provided

The fallback is plain literal text, not another reference. Both the key part and the fallback part must be non-empty; if either is empty the whole `@{...}` is treated as a normal reference with no fallback.

### Escaping a Reference

To render the literal text `@{key}` without it being resolved, double the first `@`: write `@@{key}`. An escaped reference is never looked up in any scope; it always renders as the literal string `@{key}` (the second `@` is removed, the braces and key are kept verbatim).

- `@@{userName}` - renders the literal text `@{userName}`
- Use this when you need to show the provides syntax itself in a Text component, for example in a help screen.

### Scope Resolution Order

When resolving a `@{key}` reference, the system looks through scopes from innermost to outermost:

1. The component's own parent container's provides
2. Grandparent container's provides
3. ... up through all ancestors ...
4. Screen-level provides

The first match wins. This is why inner containers can shadow outer values - they're checked first.

Tip: In the editor, when a provides scope is active, text fields show auto-complete suggestions for available `@{key}` references. The suggestions include all keys visible from the current component's position in the tree.
