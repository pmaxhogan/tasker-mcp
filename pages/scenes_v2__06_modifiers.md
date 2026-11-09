# Tasker Scenes V2 Manual: Modifiers

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#modifiers

Section 6 of [Tasker Scenes V2 Manual](scenes_v2) (Building Layouts).

Modifiers are visual styles applied to a component. They control sizing, spacing, colors, borders, and more. Each modifier wraps the ones that come after it in the list, so their order determines how the final result looks.

### Essentials

These are the modifiers you'll reach for most often:

| Modifier | Use it for |
| --- | --- |
| [`Padding`](scenes_v2__06_modifiers#modifier-padding) | Space around a component's content, or between it and its neighbours (depending on [where it sits in the stack](scenes_v2__06_modifiers#modifiers-stacking)). |
| [`Size`](scenes_v2__06_modifiers#modifier-size) | An exact width and height. |
| [`FillSize`](scenes_v2__06_modifiers#modifier-fill-size) / [`FillWidth`](scenes_v2__06_modifiers#modifier-fill-width) | Taking up all the available space, or all the width. |
| [`Weight`](scenes_v2__06_modifiers#modifier-weight) | Sharing the space in a Row or Column, like two buttons of equal width. |
| [`Align`](scenes_v2__06_modifiers#modifier-align) | Placing a component inside its parent, like the bottom-right corner of a Box. |
| [`Background`](scenes_v2__06_modifiers#modifier-background) | A color or gradient behind the component. |
| [`Clip`](scenes_v2__06_modifiers#modifier-clip) | Rounded corners, circles, or any shape from an SVG ("Crop Shape" in the editor). |
| [`Border`](scenes_v2__06_modifiers#modifier-border) | An outline around the component. |
| [`VerticalScroll`](scenes_v2__06_modifiers#modifier-vertical-scroll) | Letting content that doesn't fit scroll. |
| [`applyWhen`](scenes_v2__06_modifiers#modifiers-apply-when) | Applying any modifier only when a condition is true, like highlighting the selected item. |

### How Modifier Stacking Works

Modifiers are applied in order from top to bottom in the list, and each one wraps everything that comes after it. Read the list top to bottom as outside to inside: the *first* modifier is the outermost layer, and the *last* one sits closest to the component's content. Think of wrapping a gift: the first modifier is the outer layer of paper. This is the same order as a Jetpack Compose modifier chain, so `[Padding, Background]` works like `Modifier.padding().background()`.

This means the same set of modifiers in a different order produces a different result:

```
// Padding THEN Background:
// → 16dp of transparent space surrounds the component,
//   then the background color fills only behind the content.
"modifiers": [
  { "type": "Padding", "all": "16" },
  { "type": "Background", "color": "primary" }
]

// Background THEN Padding:
// → The background color fills the whole component,
//   and the 16dp padding sits inside it, around the content.
"modifiers": [
  { "type": "Background", "color": "primary" },
  { "type": "Padding", "all": "16" }
]
```

Screenshot: The same Text with Padding then Background, and with Background then Padding

For example, to create a card with an outer margin, a rounded background, and internal padding, you'd order them like this:

```
"modifiers": [
  { "type": "Padding", "all": "8" },
  { "type": "Clip", "shape": "Rounded", "radius": "16" },
  { "type": "Background", "color": "surfaceVariant" },
  { "type": "Padding", "all": "16" }
]
```

Screenshot: The card between two sibling bars, with the 8dp margin around it

Reading top to bottom, outside to inside: 8dp outer margin → rounded crop → background fill → 16dp inner padding. The first Padding creates spacing between this card and its siblings. Clip comes before Background, so the background is cut to the rounded shape. The last Padding keeps the content away from the card's edges. For a raised card, add a [Shadow](scenes_v2__06_modifiers#modifier-shadow) with the same shape right before the Clip.

One exception: [Marquee](scenes_v2__06_modifiers#modifier-marquee) is always applied last, as the innermost modifier, wherever it sits in the list.

You can reorder modifiers by dragging them in the editor, or using the up/down arrow buttons.

Order changes the result: This is the part most people miss. If a component doesn't look the way you wanted, it's probably the modifier order. Check it before changing any values, and remember that the first modifier in the list is the outermost.

### Parent-Scoped Modifiers

Four modifiers only appear when the component is inside a parent that supports them. **Align**, **Weight**, and **Flex** show up in the "+ Add Modifier" menu under the "Parent" category; **MatchParentSize** is listed with the sizing modifiers:

- **Align** is available inside Box, Column, Row, FlowRow, and FlowColumn parents. The alignment values it offers depend on the parent type - Box gives 9-position alignment (TopStart through BottomEnd), Column and FlowColumn give horizontal alignment (Start/Center/End), and Row and FlowRow give vertical alignment (Top/Center/Bottom).
- **Weight** is only available inside a Row, Column, FlowRow, or FlowColumn. It distributes the parent's remaining space proportionally among weighted children.
- **Flex** is only available inside a FlexBox. It controls how the child grows, shrinks, and aligns within the flex layout.
- **MatchParentSize** is only available inside a Box. It sizes the child to match the Box.

If a parent-scoped modifier is left on a component whose parent doesn't support it, the modifier is simply ignored at render time.

In the tables below, a property marked *required* has no default. A modifier written in JSON without it makes the layout fail to parse. Modifiers added from the editor always start with a value.

### Sizing

Control how much space a component takes up:

| Modifier | Properties | Description |
| --- | --- | --- |
| `Size` | `all`, `width`, `height` | Set explicit dimensions in dp. Use `all` for a square, or `width`/`height` independently. |
| `SizeIn` | `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | Constrain size within min/max bounds. Any omitted bound is left unconstrained. |
| `FillWidth` | `fraction` (default `1.0`) | Expand to fill available width (fraction = portion, e.g. 0.5 = half) |
| `FillHeight` | `fraction` (default `1.0`) | Expand to fill available height |
| `FillSize` | `fraction` (default `1.0`) | Fill all available space in both directions |
| `MatchParentSize` | - | Take exactly the size of the parent Box without making it any bigger, so the Box is still measured by its other children. Use it for a background or overlay layer behind content whose size you don't know up front. Box-scoped, and ignored if every child of the Box uses it. Can only be added once. |
| `AspectRatio` | `ratio` (default `1`) | Forces a fixed width-to-height ratio, as a number: `1` is a square, `1.78` about 16:9, `0.5` twice as tall as wide. Inside a container that gives it bounded space, the component grows to the largest size that keeps the ratio and fits, which makes it great for a square that scales to any screen. It has no effect along a direction with unlimited space, such as inside a vertical scroll. |
| `Weight` | `amount` (*required*) | Distribute space proportionally inside Row, Column, FlowRow, or FlowColumn. Two children with Weight 1 each split 50/50. An amount of 0 or less is ignored. Parent-scoped. |

### Spacing & Position

| Modifier | Properties | Description |
| --- | --- | --- |
| `Padding` | `all`, `horizontal`, `vertical`, `start`, `top`, `end`, `bottom` | Adds empty space around everything after it in the list. Before a Background it works as an outer margin; after it, as inner padding. Set `all` for uniform padding, `horizontal`/`vertical` for axes, or each side independently. More specific sides override broader ones. |
| `Offset` | `x` (default `0`), `y` (default `0`) | Shifts the component from its natural position by x/y dp |
| `Align` | `alignment` (*required*) | Position within parent. Values depend on parent type - Box: 9-position grid; Column/FlowColumn: Start/Center/End; Row/FlowRow: Top/Center/Bottom. Parent-scoped. |

### Visual Style

| Modifier | Properties | Description |
| --- | --- | --- |
| `Background` | `color` (*required*), `gradientEndColor`, `gradientAngleDegrees` | Fill with a color (hex or theme color name). Set `gradientEndColor` to fill with a linear gradient from `color` to it instead; the angle is in degrees, where `0` puts `color` on the left, `90` at the top and `180` on the right. Use `transparent` as `gradientEndColor` to fade `color` out smoothly, for example over the edge of a scrolling strip. |
| `ContentColor` | `color` (*required*) | Color of text and icons in this component and everything inside it that doesn't set its own color. On a Text, Image, Icon Button, Button, Floating Action Button, Top/Bottom App Bar, Navigation Bar or Scaffold it also replaces that component's own text, tint or content color. Images only change color if they already have a `tint` or are icons. When more than one applies, the last one wins. See [applyWhen](scenes_v2__06_modifiers#modifiers-apply-when) to switch colors from a variable. |
| `ContainerColor` | `color` (*required*) | Fill color of a Button, Icon Button, Floating Action Button, Top/Bottom App Bar, Navigation Bar or Scaffold, replacing its own button or container color. Has no effect on other components; use `Background` there. When more than one applies, the last one wins. |
| `Border` | `width` (default `1`), `color` (default `#000000`), `shape`, `radius`, `horizontal`, `vertical`, `start`, `top`, `end`, `bottom` | Add a border. Like a CSS border it takes up space: the content is moved inward by the border width, so it never draws over the content. `shape` is `Rectangle`, `Rounded`, or `Circle`; set `radius` when the shape is `Rounded`. On a `Rectangle`, the side fields set each side's width like `Padding` does (side, then `horizontal`/`vertical`, then `width`); `0` hides a side, so `"width": "0", "bottom": "1"` draws only a bottom line. Rounded and circle borders ignore them. |
| `Clip` | `shape` (*required*), `radius` | Crops the component to a shape (editor name: "Crop Shape"); anything outside it is hidden. `shape` is `Rectangle`, `Rounded` (uses `radius`) or `Circle`, or the path to an `.svg` file for a custom shape - use the crop button next to the field to pick one. An SVG crop also changes where the component can be tapped: taps outside the shape don't count, so you can make buttons of any shape. Use SVG files made of `<path>` elements (convert rectangles, circles and polygons to paths first). The file has to exist on the device that shows the scene; if it's missing, the component is shown uncropped. `shape` also accepts a variable. |
| `Shadow` | `elevation` (default `4`), `shape`, `radius` | Add an elevation shadow for visual depth. `shape` is `Rectangle` (default), `Rounded`, or `Circle`; set `radius` when the shape is `Rounded`. With an elevation above 0, the shadow also crops the component to that shape, like a `Clip`. |
| `Alpha` | `value` (*required*) | Set transparency (0.0 = invisible, 1.0 = fully visible) |
| `Rotate` | `degrees` (*required*) | Rotate the component by an angle in degrees |
| `Scale` | `all`, `x`, `y` | Stretch or squash the rendered pixels on each axis. Use `all` for both axes, or `x`/`y` independently. Values above 1 enlarge, below 1 shrink, negative flip. The layout size does not change. |
| `Blur` | `radiusX` (default `3`), `radiusY` (default `3`), `uniform` (default `true`) | Apply a Gaussian blur. With `uniform` true, `radiusX` and `radiusY` stay equal. Can only be added once. Requires Android 12 (API 31) or higher: on older devices it isn't offered in the "+ Add Modifier" menu, and a Blur already in the layout is ignored. |

Screenshot: One tile styled with gradients, crops, a bottom border, Shadow, Alpha, Rotate, a mirrored Scale and Blur

`Alpha`, `Rotate`, `Scale`, and `Blur` affect the content and every modifier after them in the list, but not the ones before them. Put them first to affect the whole component, background included.

### Animation

| Modifier | Properties | Description |
| --- | --- | --- |
| `Marquee` | `iterations` (default unlimited), `velocity` (default `30`), `spacing` (default `0.33`) | Scrolls content horizontally when it overflows its container, creating a ticker effect. `iterations` is the loop count (blank or 0 = unlimited), `velocity` is the scroll speed in dp per second, `spacing` is the gap between repetitions as a fraction of the container width. Marquee is always applied last, as the innermost modifier, no matter where it sits in the list. |

### Flex (FlexBox children)

The **Flex** modifier is only available on direct children of a FlexBox. It controls how the child behaves within the flex layout:

| Property | Description |
| --- | --- |
| `basis` | The starting size before grow/shrink. `Auto` (default), a dp value (`"100"`), or a percentage of the container (`"50%"`). |
| `grow` | Share of extra space this child claims (default `0`, no growing). Children with higher grow take proportionally more. |
| `shrink` | Share of any space deficit this child absorbs when the container is too small (default `1`). |
| `alignSelf` | Overrides the container's cross-axis alignment for this child. One of `Auto` (default), `Start`, `Center`, `End`, `Stretch`, `Baseline`. |
| `order` | Controls visual ordering without changing the JSON structure. Lower values appear first (default `0`). |

### Scrolling

These modifiers belong to the "Behavior" category. Each is singular - only one instance can be added to a component.

| Modifier | Properties | Description |
| --- | --- | --- |
| `VerticalScroll` | `enabled` (default `true`), `userScrollEnabled` (default `true`) | Make content scrollable vertically when it overflows. Set `enabled` to `false` in JSON to turn scrolling off without removing the modifier; it has no editor field and must be a plain `true` or `false`, not a variable. Set `userScrollEnabled` to `false` to stop the user from scrolling it while the `scrollToIndex` action still can; it accepts a variable, so you can lock and unlock it at runtime. |
| `HorizontalScroll` | `enabled` (default `true`), `userScrollEnabled` (default `true`) | Make content scrollable horizontally when it overflows. Set `enabled` to `false` in JSON to turn scrolling off without removing the modifier; it has no editor field and must be a plain `true` or `false`, not a variable. Set `userScrollEnabled` to `false` to stop the user from scrolling it while the `scrollToIndex` action still can; it accepts a variable, so you can lock and unlock it at runtime. |

A `VerticalScroll` on an element that is already inside another `VerticalScroll` element is ignored, and the same goes for `HorizontalScroll` inside `HorizontalScroll`. Scrolls in different directions can be nested, for example a horizontal strip inside a vertical page.

#### Scrolling to a child

An element with `VerticalScroll` or `HorizontalScroll` gets a `scrollToIndex` component action. Run it with the **Run Component Action** event action or Tasker's **Run Scene v2 Action** action.

| Action ID | Parameters | Result | Description |
| --- | --- | --- | --- |
| `scrollToIndex` | `index`, `animate` (default `true`), `align` (`Start`, `Center` or `End`; default `Start`) | - | Scrolls so the child at `index` (the first child is 1) sits at the start, center or end of the visible area, as set by `align`. Children of an Arrays Merge Template or Variable element count one by one. Near either end of the list it scrolls as far as possible, so to center the first or last child, add blank children before and after the real ones. Does nothing if the index is out of range, the child is hidden, or scrolling is off. With `animate` on, the animation starts and the action finishes right away, without waiting for it to end. |

To keep an hourly strip on the current hour, add a screen-level **Variable Changed** handler that watches a 1-based index variable (enter its name, such as `hour_index`, without `%` in the handler's variable field; it also runs once when the scene opens) with a Run Component Action of `scrollToIndex` and `index` set to `%hour_index`. Parameters cannot do arithmetic, so keep that variable alongside the hour, for example by setting `%hour_index` to the hour plus one in a task.

### Conditional Modifiers: applyWhen

Every modifier accepts an optional `applyWhen` property: a conditional expression that decides whether the modifier is applied at all. When the expression evaluates to false, the modifier is skipped as if it weren't in the list; when it's true (or absent), the modifier applies normally.

`applyWhen` uses the same expression syntax as a component's `showWhen` - comparisons (`==`, `!=`, `>`, `<`, `>=`, `<=`) logical operators (`&`, `|`, `!`), and the text operators `contains`, `ccontains`, `matches` and `matchesr` - see [Conditional Visibility](scenes_v2__10_show_when#show-when-syntax). In the editor it appears as the first field on every modifier, labelled "Apply When".

```
// A red border that only shows while %hasError is true:
"modifiers": [
  { "type": "Border", "width": "2", "color": "error",
    "applyWhen": "%hasError == true" }
]

// A highlight background applied only to the selected row:
"modifiers": [
  { "type": "Background", "color": "primaryContainer",
    "applyWhen": "%selectedId == \"row3\"" }
]

// A tab button styled from a single %tab variable: the plain colors
// come first, the selected ones last so they win while they apply.
"modifiers": [
  { "type": "ContainerColor", "color": "surfaceVariant" },
  { "type": "ContentColor", "color": "onSurfaceVariant" },
  { "type": "ContainerColor", "color": "primary",
    "applyWhen": "%tab == \"numbers\"" },
  { "type": "ContentColor", "color": "onPrimary",
    "applyWhen": "%tab == \"numbers\"" }
]
```

Text you compare against goes in double quotes, escaped as `\"` inside JSON (in the editor's Apply When field, just type `%selectedId == "row3"`). A bare word without quotes is read as a variable name.

Screenshot: Three rows using the highlight example, previewed with %selectedId set to row3

This lets a single layout react to state without duplicating components. The component itself stays visible; only the styling toggles on and off. Because colors such as a Button's fill or a Text's color are set with the `ContainerColor` and `ContentColor` modifiers, they can change with `applyWhen` too: clicking a tab only needs to set `%tab`.

Note: Window dragging is not a modifier you add from this list. To make an overlay window draggable by a component, use the **Drag to Move** toggle on the Modifiers tab. See [Drag to Move](scenes_v2__11_interactions#interactions-drag).
