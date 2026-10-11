# Tasker Screen Builder Manual: Layout Fundamentals

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#layout-fundamentals

Section 4 of [Tasker Screen Builder Manual](scenes_v2) (Building Layouts).

Most screens you build are made of three containers. Master these and you can build almost any layout. Several other containers exist for specialised cases - see [Components](scenes_v2__05_general#general) for the full list.

### The Three Building Blocks

**Column** - Arranges children vertically, from top to bottom. Think of it as a vertical stack. Most screens start with a Column as the root component.

**Row** - Arranges children horizontally, from left to right. Use Rows for toolbars, button bars, or any side-by-side content.

**Box** - Layers children on top of each other. The last child appears on top. Each child inside a Box can choose its own position freely (e.g. top-left, center, bottom-right) with the Align modifier, so Box is the way to build "place elements wherever you want on screen" layouts that don't have to follow a strict column or row flow. Use it for overlays, badges on icons, stacking text on images, or any layout where you want full control over element placement.

Try it - copy this layout to see all three in action:

```
{"name":"Building Blocks","root":{"type":"Column","id":"root","horizontalAlignment":"Center","verticalArrangement":"SpaceEvenly","modifiers":[{"type":"FillSize"},{"type":"Padding","all":"16"}],"children":[{"type":"Text","id":"col_label","text":"Column (vertical)","textSize":"12","color":"primary"},{"type":"Column","id":"col_demo","horizontalAlignment":"Center","modifiers":[{"type":"FillWidth"},{"type":"Clip","shape":"Rounded","radius":"12"},{"type":"Background","color":"surfaceVariant"},{"type":"Padding","all":"12"}],"children":[{"type":"Text","id":"c1","text":"First"},{"type":"Text","id":"c2","text":"Second"},{"type":"Text","id":"c3","text":"Third"}]},{"type":"Text","id":"row_label","text":"Row (horizontal)","textSize":"12","color":"primary"},{"type":"Row","id":"row_demo","horizontalArrangement":"SpaceEvenly","modifiers":[{"type":"FillWidth"},{"type":"Clip","shape":"Rounded","radius":"12"},{"type":"Background","color":"surfaceVariant"},{"type":"Padding","all":"12"}],"children":[{"type":"Text","id":"r1","text":"Left"},{"type":"Text","id":"r2","text":"Center"},{"type":"Text","id":"r3","text":"Right"}]},{"type":"Text","id":"box_label","text":"Box (layered)","textSize":"12","color":"primary"},{"type":"Box","id":"box_demo","modifiers":[{"type":"FillWidth"},{"type":"Size","height":"100"},{"type":"Clip","shape":"Rounded","radius":"12"},{"type":"Background","color":"primaryContainer"}],"children":[{"type":"Text","id":"b1","text":"Behind","modifiers":[{"type":"Align","alignment":"TopStart"},{"type":"Padding","all":"8"}]},{"type":"Text","id":"b2","text":"On Top","textSize":"22","modifiers":[{"type":"Align","alignment":"Center"}]}]}]}}
```

Diagram: Column stacks vertically, Row arranges horizontally, Box layers on top

### Nesting Creates Any Layout

The key insight is that nesting these containers creates any layout you can imagine:

- A **Column with Rows inside** - creates a grid-like layout
- A **Column with a Row header + Column body** - creates an app-like layout
- A **Box with an Image + Text overlay** - creates a card with overlay text

Here's a simple vertical list - just a Column with Text children:

```
{
  "root": {
    "type": "Column", "id": "list",
    "children": [
      { "type": "Text", "id": "t1", "text": "Item 1" },
      { "type": "Text", "id": "t2", "text": "Item 2" },
      { "type": "Text", "id": "t3", "text": "Item 3" }
    ]
  }
}
```

A horizontal button bar - a Row with Button children:

```
{
  "root": {
    "type": "Row", "id": "actions",
    "children": [
      { "type": "Button", "id": "cancel", "text": "Cancel" },
      { "type": "Button", "id": "ok", "text": "OK" }
    ]
  }
}
```

A card with overlay text - a Box with Image and Text layered:

```
{
  "root": {
    "type": "Box", "id": "card",
    "children": [
      { "type": "Image", "id": "photo", "url": "https://example.com/photo.jpg" },
      { "type": "Text", "id": "title", "text": "Photo Title" }
    ]
  }
}
```

An app-style layout with a header and scrollable body:

```
{
  "root": {
    "type": "Column", "id": "root",
    "children": [
      {
        "type": "Row", "id": "header",
        "children": [
  { "type": "Text", "id": "app_title", "text": "My App" }
        ]
      },
      {
        "type": "Column", "id": "body",
        "modifiers": [{ "type": "VerticalScroll" }],
        "children": [
  { "type": "Text", "id": "content", "text": "Scrollable content here..." }
        ]
      }
    ]
  }
}
```

### Alignment & Arrangement

Each container type lets you control how children are positioned. *Alignment* controls position on the axis the container does not lay children along; *arrangement* controls how the container distributes its children along its main axis.

**Column** has `horizontalAlignment` (`Start`, `Center`, `End`) to control left/right positioning, and `verticalArrangement` (`Top`, `Center`, `Bottom`, `SpaceBetween`, `SpaceAround`, `SpaceEvenly`, `SpacedBy`) to control how vertical space is distributed.

**Row** has `horizontalArrangement` (`Start`, `Center`, `End`, `SpaceBetween`, `SpaceAround`, `SpaceEvenly`, `SpacedBy`) and `verticalAlignment` (`Top`, `Center`, `Bottom`).

**Box** has `contentAlignment` with 9 positions: `TopStart`, `TopCenter`, `TopEnd`, `CenterStart`, `Center`, `CenterEnd`, `BottomStart`, `BottomCenter`, and `BottomEnd`. This is the default position for every child; an individual child can override it with the Align modifier.

Tip: Use `SpaceBetween` arrangement to push the first and last children to opposite edges, with equal space between the others. It's perfect for headers with a title on the left and a button on the right.

### The SpacedBy Arrangement

The `SpacedBy` arrangement value puts a fixed gap between every child. When you pick `SpacedBy` for a Column's `verticalArrangement` or a Row's `horizontalArrangement`, a **Spacing** field appears so you can set the gap in dp:

```
{
  "type": "Column", "id": "menu",
  "verticalArrangement": "SpacedBy", "spacing": "12",
  "children": [
    { "type": "Button", "id": "b1", "text": "One" },
    { "type": "Button", "id": "b2", "text": "Two" },
    { "type": "Button", "id": "b3", "text": "Three" }
  ]
}
```

This is cleaner than inserting Spacer components between children. The `spacing` property is only used when the arrangement is `SpacedBy`.

### Beyond the Three Building Blocks

Column, Row, and Box cover most layouts, but other containers handle specific needs:

- **Card** - a Column-like surface with elevation and a rounded Material 3 background.
- **FlowRow** / **FlowColumn** - like Row/Column, but children wrap onto a new line (or column) when they run out of room.
- **FlexBox** - a CSS-Flexbox-style container with wrapping, proportional sizing, and per-item alignment.
- **Scaffold**, **TopAppBar**, **BottomAppBar**, **NavigationBar** - structural pieces for full app-style screens.

All of these are documented with their full property and slot lists in the [Components](scenes_v2__05_general#general) section.
