# Tasker Screen Builder Manual: Modifiers

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#modifiers

Section 6 of [Tasker Screen Builder Manual](scenes_v2) (Building Layouts).

Modifiers are visual styles applied to a component. They control sizing, spacing, colors, borders, and more. Each modifier wraps the result of the previous one, so their order determines how the final result looks.

### How Modifier Stacking Works

Modifiers are applied in order from top to bottom in the list. Each modifier wraps around everything that came before it - think of it like wrapping a gift in layers of paper. The *innermost* modifier (top of the list) is closest to the component's content, and the *outermost* modifier (bottom of the list) is the final wrapper.

This means the same set of modifiers in a different order produces a different result:

```
// Padding THEN Background:
// → Content has 16dp breathing room, then the background
//   color fills behind both the content AND the padding.
"modifiers": [
  { "type": "Padding", "all": "16" },
  { "type": "Background", "color": "primary" }
]

// Background THEN Padding:
// → Background color wraps tightly around content,
//   then 16dp of transparent space surrounds the colored area.
"modifiers": [
  { "type": "Background", "color": "primary" },
  { "type": "Padding", "all": "16" }
]
```

For example, to create a card with internal padding, a colored background, rounded corners, and external margin, you'd order them like this:

```
"modifiers": [
  { "type": "Padding", "all": "16" },
  { "type": "Background", "color": "surfaceVariant" },
  { "type": "Clip", "shape": "Rounded", "radius": "16" },
  { "type": "Padding", "all": "8" }
]
```

Reading top to bottom: 16dp inner padding → background fill → rounded clipping → 8dp outer margin. The outer Padding creates spacing between this card and its siblings.

You can reorder modifiers by dragging them in the editor, or using the up/down arrow buttons. If something doesn't look right, the first thing to check is modifier order.

### Parent-Scoped Modifiers

Three modifiers - **Align**, **Weight**, and **Flex** - only appear when the component is inside a parent that supports them. They show up in the "+ Add Modifier" menu under the "Parent" category:

- **Align** is available inside Box, Column, Row, FlowRow, and FlowColumn parents. The alignment values it offers depend on the parent type - Box gives 9-position alignment (TopStart through BottomEnd), Column and FlowColumn give horizontal alignment (Start/Center/End), and Row and FlowRow give vertical alignment (Top/Center/Bottom).
- **Weight** is only available inside a Row, Column, FlowRow, or FlowColumn. It distributes the parent's remaining space proportionally among weighted children.
- **Flex** is only available inside a FlexBox. It controls how the child grows, shrinks, and aligns within the flex layout.

If a parent-scoped modifier is left on a component whose parent doesn't support it, the modifier is simply ignored at render time.

### Sizing

Control how much space a component takes up:

| Modifier | Properties | Description |
| --- | --- | --- |
| `Size` | `all`, `width`, `height` | Set explicit dimensions in dp. Use `all` for a square, or `width`/`height` independently. |
| `SizeIn` | `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | Constrain size within min/max bounds. Any omitted bound is left unconstrained. |
| `FillWidth` | `fraction` (default `1.0`) | Expand to fill available width (fraction = portion, e.g. 0.5 = half) |
| `FillHeight` | `fraction` (default `1.0`) | Expand to fill available height |
| `FillSize` | `fraction` (default `1.0`) | Fill all available space in both directions |
| `Weight` | `amount` | Distribute space proportionally inside Row, Column, FlowRow, or FlowColumn. Two children with Weight 1 each split 50/50. Parent-scoped. |

### Spacing & Position

| Modifier | Properties | Description |
| --- | --- | --- |
| `Padding` | `all`, `horizontal`, `vertical`, `start`, `top`, `end`, `bottom` | Adds space inside the component. Set `all` for uniform padding, `horizontal`/`vertical` for axes, or each side independently. More specific sides override broader ones. |
| `Offset` | `x` (default `0`), `y` (default `0`) | Shifts the component from its natural position by x/y dp |
| `Align` | `alignment` | Position within parent. Values depend on parent type - Box: 9-position grid; Column/FlowColumn: Start/Center/End; Row/FlowRow: Top/Center/Bottom. Parent-scoped. |

### Visual Style

| Modifier | Properties | Description |
| --- | --- | --- |
| `Background` | `color` | Fill with a color (hex or theme color name) |
| `Border` | `width` (default `1`), `color` (default `#000000`), `shape`, `radius` | Add a border. `shape` is `Rectangle`, `Rounded`, or `Circle`; set `radius` when the shape is `Rounded`. |
| `Clip` | `shape`, `radius` | Clip to a shape. `shape` is `Rectangle`, `Rounded`, or `Circle`; `radius` applies to `Rounded`. |
| `Shadow` | `elevation` (default `4`), `shape`, `radius` | Add an elevation shadow for visual depth |
| `Alpha` | `value` | Set transparency (0.0 = invisible, 1.0 = fully visible) |
| `Rotate` | `degrees` | Rotate the component by an angle in degrees |
| `Scale` | `all`, `x`, `y` | Stretch or squash the rendered pixels on each axis. Use `all` for both axes, or `x`/`y` independently. Values above 1 enlarge, below 1 shrink, negative flip. The layout size does not change. |
| `Blur` | `radiusX` (default `3`), `radiusY` (default `3`), `uniform` (default `true`) | Apply a Gaussian blur. With `uniform` true, `radiusX` and `radiusY` stay equal. Requires Android 12 (API 31) or higher; ignored on older devices. |

### Animation

| Modifier | Properties | Description |
| --- | --- | --- |
| `Marquee` | `iterations` (default unlimited), `velocity` (default `30`), `spacing` (default `0.33`) | Scrolls content horizontally when it overflows its container, creating a ticker effect. `iterations` is the loop count (blank or 0 = unlimited), `velocity` is the scroll speed in dp, `spacing` is the gap between repetitions as a fraction of the container width. |

### Flex (FlexBox children)

The **Flex** modifier is only available on direct children of a FlexBox. It controls how the child behaves within the flex layout:

| Property | Description |
| --- | --- |
| `basis` | The starting size before grow/shrink. `Auto` (default), a dp value (`"100"`), or a percentage of the container (`"50%"`). |
| `grow` | Share of extra space this child claims. Children with higher grow take proportionally more. |
| `shrink` | Share of any space deficit this child absorbs when the container is too small. |
| `alignSelf` | Overrides the container's cross-axis alignment for this child. One of `Auto`, `Start`, `Center`, `End`, `Stretch`, `Baseline`. |
| `order` | Controls visual ordering without changing the JSON structure. Lower values appear first. |

### Scrolling

These modifiers belong to the "Behavior" category. Each is singular - only one instance can be added to a component.

| Modifier | Properties | Description |
| --- | --- | --- |
| `VerticalScroll` | `enabled` (default `true`) | Make content scrollable vertically when it overflows. Set `enabled` to `false` to turn scrolling off without removing the modifier. |
| `HorizontalScroll` | `enabled` (default `true`) | Make content scrollable horizontally when it overflows. Set `enabled` to `false` to turn scrolling off without removing the modifier. |

### Conditional Modifiers: applyWhen

Every modifier accepts an optional `applyWhen` property: a conditional expression that decides whether the modifier is applied at all. When the expression evaluates to false, the modifier is skipped as if it weren't in the list; when it's true (or absent), the modifier applies normally.

`applyWhen` uses the same expression syntax as a component's `showWhen` - comparisons (`==`, `!=`, `>`, `<`, `>=`, `<=`) and logical operators (`&`, `|`, `!`). In the editor it appears as the first field on every modifier, labelled "Apply When".

```
// A red border that only shows while %hasError is true:
"modifiers": [
  { "type": "Border", "width": "2", "color": "error",
    "applyWhen": "%hasError == true" }
]

// A highlight background applied only to the selected row:
"modifiers": [
  { "type": "Background", "color": "primaryContainer",
    "applyWhen": "%selectedId == row3" }
]
```

This lets a single layout react to state without duplicating components. The component itself stays visible; only the styling toggles on and off.

Note: Window dragging is not a modifier you add from this list. To make an overlay window draggable by a component, use the **Drag to Move** toggle on the Modifiers tab. See [Drag to Move](scenes_v2__11_interactions#interactions-drag).
