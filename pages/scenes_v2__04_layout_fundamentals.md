# Tasker Scenes V2 Manual: Layout Fundamentals

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#layout-fundamentals

Section 4 of [Tasker Scenes V2 Manual](scenes_v2) (Building Layouts).

Most screens you build are made of three containers. Master these and you can build almost any layout. Several other containers exist for specialised cases - see [Components](scenes_v2__05_general#general) for the full list.

### The Three Building Blocks

**Column** - Arranges children vertically, from top to bottom. Think of it as a vertical stack. Most screens start with a Column as the root component.

**Row** - Arranges children horizontally, from left to right. Use Rows for toolbars, button bars, or any side-by-side content.

**Box** - Layers children on top of each other. The last child appears on top. Each child inside a Box can choose its own position freely (e.g. top-left, center, bottom-right) with the Align modifier, so Box is the way to build "place elements wherever you want on screen" layouts that don't have to follow a strict column or row flow. Use it for overlays, badges on icons, stacking text on images, or any layout where you want full control over element placement.

Diagram: Column stacks vertically, Row arranges horizontally, Box layers on top

Try it - copy this layout to see all three in action:

```
{"name":"Building Blocks","root":{"type":"Column","id":"root","horizontalAlignment":"Center","verticalArrangement":"SpaceEvenly","modifiers":[{"type":"FillSize"},{"type":"Padding","all":"16"}],"children":[{"type":"Text","id":"col_label","text":"Column (vertical)","textSize":"12","color":"primary"},{"type":"Column","id":"col_demo","horizontalAlignment":"Center","modifiers":[{"type":"FillWidth"},{"type":"Clip","shape":"Rounded","radius":"12"},{"type":"Background","color":"surfaceVariant"},{"type":"Padding","all":"12"}],"children":[{"type":"Text","id":"c1","text":"First"},{"type":"Text","id":"c2","text":"Second"},{"type":"Text","id":"c3","text":"Third"}]},{"type":"Text","id":"row_label","text":"Row (horizontal)","textSize":"12","color":"primary"},{"type":"Row","id":"row_demo","horizontalArrangement":"SpaceEvenly","modifiers":[{"type":"FillWidth"},{"type":"Clip","shape":"Rounded","radius":"12"},{"type":"Background","color":"surfaceVariant"},{"type":"Padding","all":"12"}],"children":[{"type":"Text","id":"r1","text":"Left"},{"type":"Text","id":"r2","text":"Center"},{"type":"Text","id":"r3","text":"Right"}]},{"type":"Text","id":"box_label","text":"Box (layered)","textSize":"12","color":"primary"},{"type":"Box","id":"box_demo","modifiers":[{"type":"FillWidth"},{"type":"Size","height":"100"},{"type":"Clip","shape":"Rounded","radius":"12"},{"type":"Background","color":"primaryContainer"}],"children":[{"type":"Text","id":"b1","text":"Behind","modifiers":[{"type":"Align","alignment":"TopStart"},{"type":"Padding","all":"8"}]},{"type":"Text","id":"b2","text":"On Top","textSize":"22","modifiers":[{"type":"Align","alignment":"Center"}]}]}]}}
```

### Nesting Creates Any Layout

The key insight is that nesting these containers creates any layout you can imagine:

- A **Column with Rows inside** - creates a grid-like layout
- A **Column with a Row header + Column body** - creates an app-like layout
- A **Box with an Image + Text overlay** - creates a card with overlay text

Screenshot: An app-style screen, a Row header above a scrolling Column body

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

Screenshot: Three Text items stacked by a Column

A horizontal button bar - a Row with Button children:

```
{
  "root": {
    "type": "Row", "id": "actions",
    "children": [
      { "type": "Button", "id": "cancel", "content": [ { "type": "Text", "id": "cancelText", "text": "Cancel" } ] },
      { "type": "Button", "id": "ok", "content": [ { "type": "Text", "id": "okText", "text": "OK" } ] }
    ]
  }
}
```

Screenshot: Cancel and OK buttons side by side in a Row

A card with overlay text - a Box with Image and Text layered:

```
{
  "root": {
    "type": "Box", "id": "card",
    "children": [
      { "type": "Image", "id": "photo", "url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1080&q=80" },
      { "type": "Text", "id": "title", "text": "Photo Title" }
    ]
  }
}
```

Screenshot: The title Text layered over the photo in a Box

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

Screenshot: A header Row above a scrolling Column body

### Alignment & Arrangement

Each container type lets you control how children are positioned. *Alignment* controls position on the axis the container does not lay children along; *arrangement* controls how the container distributes its children along its main axis.

**Column** has `horizontalAlignment` (`Start`, `Center`, `End`) to control left/right positioning, and `verticalArrangement` (`Top`, `Center`, `Bottom`, `SpaceBetween`, `SpaceAround`, `SpaceEvenly`, `SpacedBy`) to control how vertical space is distributed.

**Row** has `horizontalArrangement` (`Start`, `Center`, `End`, `SpaceBetween`, `SpaceAround`, `SpaceEvenly`, `SpacedBy`) and `verticalAlignment` (`Top`, `Center`, `Bottom`).

**Box** has `contentAlignment` with 9 positions: `TopStart`, `TopCenter`, `TopEnd`, `CenterStart`, `Center`, `CenterEnd`, `BottomStart`, `BottomCenter`, and `BottomEnd`. This is the default position for every child; an individual child can override it with the Align modifier.

Tip: Use `SpaceBetween` arrangement to push the first and last children to opposite edges, with equal space between the others. It's perfect for headers with a title on the left and a button on the right.

Screenshot: The same three items in a Row with each horizontalArrangement value

### The SpacedBy Arrangement

The `SpacedBy` arrangement value puts a fixed gap between every child. When you pick `SpacedBy` for a Column's `verticalArrangement` or a Row's `horizontalArrangement`, a **Spacing** field appears so you can set the gap in dp:

```
{
  "type": "Column", "id": "menu",
  "verticalArrangement": "SpacedBy", "spacing": "12",
  "children": [
    { "type": "Button", "id": "b1", "content": [ { "type": "Text", "id": "b1_text", "text": "One" } ] },
    { "type": "Button", "id": "b2", "content": [ { "type": "Text", "id": "b2_text", "text": "Two" } ] },
    { "type": "Button", "id": "b3", "content": [ { "type": "Text", "id": "b3_text", "text": "Three" } ] }
  ]
}
```

Screenshot: Three buttons in a Column with a 12dp gap between each

This is cleaner than inserting Spacer components between children. The `spacing` property is only used when the arrangement is `SpacedBy`.

### Lists from Tasker Arrays

Most screens show a list of something: rooms, contacts, to-dos, notifications. You don't build a list row by row. Put an [**Arrays Merge Template**](scenes_v2__05_general#component-arrays-merge-template) in a Column, give it a single child as the row **template**, and use Tasker arrays inside that row. The template is repeated once for every element of the arrays.

1. In a task, fill the arrays, for example with two **Array Set** actions: Variable Array `%room` with Values `Living Room,Kitchen,Bedroom`, and `%status` with `On,Off,On`.
2. In the template, use the array names without an index: `%room` and `%status`. The first row gets `%room1` and `%status1`, the second `%room2` and `%status2`, and so on.
3. Show the scene with **Show Scene v2** in that same task, so the scene can see the task's arrays.

```
{
  "name": "Rooms",
  "root": {
    "type": "Column", "id": "root",
    "verticalArrangement": "SpacedBy", "spacing": "8",
    "modifiers": [{ "type": "FillSize" }, { "type": "Padding", "all": "16" }],
    "children": [
      { "type": "Text", "id": "heading", "text": "Rooms", "textSize": "22" },
      {
        "type": "ArraysMergeTemplate", "id": "rooms",
        "template": [
          {
            "type": "Row", "id": "room_row",
            "horizontalArrangement": "SpaceBetween", "verticalAlignment": "Center",
            "modifiers": [
              { "type": "FillWidth" },
              { "type": "Clip", "shape": "Rounded", "radius": "12" },
              { "type": "Background", "color": "surfaceVariant" },
              { "type": "Padding", "all": "16" }
            ],
            "children": [
              { "type": "Text", "id": "room_name", "text": "%room", "textSize": "16" },
              { "type": "Text", "id": "room_status", "text": "%status", "color": "primary" }
            ]
          }
        ]
      }
    ]
  }
}
```

Screenshot: The scene running, with one row for each element of the %room and %status arrays

In the editor, the template is shown only once, because the arrays only exist when a task shows the scene. The Elements tree shows the structure: the Column holds the heading and the Arrays Merge Template, and the template holds the single row.

Screenshot: The editor with the Arrays Merge Template in the Elements tree and its single template row in the preview

- **Several arrays at once.** Use as many arrays as you like in the template; their elements line up by index. A variable that isn't an array is shared by every row.
- **Live updates.** Changing an element updates only its row, and **Array Push**, **Array Pop** or **Array Set** while the scene is showing add or remove rows.
- **Rows write to their own element.** A Switch in the template bound to `status` writes `%status3` when it's toggled in the third row.
- **Horizontal lists.** Put the Arrays Merge Template in a Row (or a FlowRow to wrap) instead of a Column.
- **Blank values?** An array that isn't set shows as empty text, not an error. Check that the task sets it (with the exact name, all lowercase for a local) before it shows the scene.

See [Arrays Merge Template](scenes_v2__05_general#component-arrays-merge-template) in the component reference for the full details.

### Beyond the Three Building Blocks

Column, Row, and Box cover most layouts, but other containers handle specific needs:

**Card** - a Column-like surface with elevation and a rounded Material 3 background.

```
{
  "root": {
    "type": "Card", "id": "card",
    "children": [
      {
        "type": "Column", "id": "card_body",
        "modifiers": [{ "type": "Padding", "all": "16" }],
        "children": [
          { "type": "Text", "id": "card_title", "text": "Living Room", "textSize": "18" },
          { "type": "Text", "id": "card_status", "text": "3 lights on" }
        ]
      }
    ]
  }
}
```

Screenshot: A Card with a title and a status line

**FlowRow** / **FlowColumn** - like Row/Column, but children wrap onto a new line (or column) when they run out of room.

```
{
  "root": {
    "type": "FlowRow", "id": "chips",
    "horizontalArrangement": "SpacedBy", "spacingHorizontal": "8",
    "verticalArrangement": "SpacedBy", "spacingVertical": "8",
    "modifiers": [{ "type": "Size", "width": "260" }],
    "children": [
      { "type": "Text", "id": "c1", "text": "Wi-Fi", "modifiers": [{ "type": "Clip", "shape": "Rounded", "radius": "16" }, { "type": "Background", "color": "secondaryContainer" }, { "type": "Padding", "horizontal": "12", "vertical": "6" }] },
      { "type": "Text", "id": "c2", "text": "Bluetooth", "modifiers": [{ "type": "Clip", "shape": "Rounded", "radius": "16" }, { "type": "Background", "color": "secondaryContainer" }, { "type": "Padding", "horizontal": "12", "vertical": "6" }] },
      { "type": "Text", "id": "c3", "text": "Location", "modifiers": [{ "type": "Clip", "shape": "Rounded", "radius": "16" }, { "type": "Background", "color": "secondaryContainer" }, { "type": "Padding", "horizontal": "12", "vertical": "6" }] },
      { "type": "Text", "id": "c4", "text": "Do Not Disturb", "modifiers": [{ "type": "Clip", "shape": "Rounded", "radius": "16" }, { "type": "Background", "color": "secondaryContainer" }, { "type": "Padding", "horizontal": "12", "vertical": "6" }] },
      { "type": "Text", "id": "c5", "text": "Flashlight", "modifiers": [{ "type": "Clip", "shape": "Rounded", "radius": "16" }, { "type": "Background", "color": "secondaryContainer" }, { "type": "Padding", "horizontal": "12", "vertical": "6" }] }
    ]
  }
}
```

Screenshot: Five chips in a FlowRow, wrapping onto a second line

**FlexBox** - a CSS-Flexbox-style container with wrapping, proportional sizing, and per-item alignment.

```
{
  "root": {
    "type": "FlexBox", "id": "flex", "gap": "8",
    "modifiers": [{ "type": "Size", "width": "280" }],
    "children": [
      { "type": "Text", "id": "one", "text": "grow 1", "color": "onPrimaryContainer", "modifiers": [{ "type": "Flex", "grow": "1", "basis": "0" }, { "type": "Clip", "shape": "Rounded", "radius": "8" }, { "type": "Background", "color": "primaryContainer" }, { "type": "Padding", "all": "12" }] },
      { "type": "Text", "id": "two", "text": "grow 2", "color": "onTertiaryContainer", "modifiers": [{ "type": "Flex", "grow": "2", "basis": "0" }, { "type": "Clip", "shape": "Rounded", "radius": "8" }, { "type": "Background", "color": "tertiaryContainer" }, { "type": "Padding", "all": "12" }] }
    ]
  }
}
```

Screenshot: Two items in a FlexBox, the second twice as wide as the first

**Scaffold**, **TopAppBar**, **BottomAppBar**, **NavigationBar** - structural pieces for full app-style screens.

```
{
  "root": {
    "type": "Scaffold", "id": "app",
    "modifiers": [{ "type": "FillSize" }],
    "topBar": [
      { "type": "TopAppBar", "id": "top", "containerColor": "primaryContainer", "contentColor": "onPrimaryContainer", "title": [{ "type": "Text", "id": "top_title", "text": "My App" }] }
    ],
    "bottomBar": [
      {
        "type": "NavigationBar", "id": "nav",
        "content": [
          { "type": "NavigationItem", "id": "nav_home", "icon": "icon:Home", "label": "Home" },
          { "type": "NavigationItem", "id": "nav_search", "icon": "icon:Search", "label": "Search" },
          { "type": "NavigationItem", "id": "nav_settings", "icon": "icon:Settings", "label": "Settings" }
        ]
      }
    ],
    "content": [
      { "type": "Text", "id": "page", "text": "Page content", "modifiers": [{ "type": "Padding", "all": "16" }] }
    ]
  }
}
```

Screenshot: A Scaffold with a TopAppBar above and a NavigationBar below the content

All of these are documented with their full property and slot lists in the [Components](scenes_v2__05_general#general) section.
