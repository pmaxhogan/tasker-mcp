# Tasker Scenes V2 Manual: Components

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#general

Section 5 of [Tasker Scenes V2 Manual](scenes_v2) (Building Layouts).

Components are the individual elements you assemble into your layout. Each one has a unique ID, an optional [`showWhen`](scenes_v2__10_show_when#show-when) expression for conditional visibility, and type-specific properties. Components the user can interact with, like buttons, switches and text inputs, also have an optional [`enabled`](scenes_v2__05_general#general-enabled) expression that disables them while it's false. The General section of the Settings tab groups the core identity and content of the selected element.

### Essentials

There are over 30 components, but most screens are built from a handful of them. Start with these:

| Component | Use it for |
| --- | --- |
| [`Column`](scenes_v2__05_general#component-column) | Stacking things top to bottom. The usual root of a screen. |
| [`Row`](scenes_v2__05_general#component-row) | Putting things side by side, like a toolbar or a label next to a switch. |
| [`Box`](scenes_v2__05_general#component-box) | Layering things on top of each other, like text over an image or a badge on an icon. |
| [`Scaffold`](scenes_v2__05_general#component-scaffold) | App-like full screens with a top bar, bottom bar and floating action button. |
| [`Text`](scenes_v2__05_general#component-text) | Showing any text, including values from Tasker variables. |
| [`Image`](scenes_v2__05_general#component-image) | Pictures, icons and [Material Symbols](scenes_v2__05_general#general-material-symbols). |
| [`Button`](scenes_v2__05_general#component-button) | The main things the user can tap. |
| [`IconButton`](scenes_v2__05_general#component-icon-button) | Tappable icons, like a close or settings button. |
| [`TextInput`](scenes_v2__05_general#component-text-input) | Letting the user type text, numbers, passwords and so on. |
| [`Switch`](scenes_v2__05_general#component-switch) | On/off settings. |
| [`ArraysMergeTemplate`](scenes_v2__05_general#component-arrays-merge-template) | Lists built from Tasker arrays, one row per item. |

### Adding Components

To add a component, tap the "+" button. Components are organized into four categories, which are the only top-level groups in the picker:

- **Layout** - Column, Row, FlowRow, FlowColumn, Box, FlexBox, Card, Scaffold, TopAppBar, BottomAppBar, NavigationBar, Dropdown, Spacer, Variable, ArraysMergeTemplate, Placeholder. Containers and structural pieces.
- **Display** - Text, Image, Divider, ProgressBar, WebView. For showing information.
- **Input** - Button, IconButton, FloatingActionButton, Switch, Checkbox, TextInput, Slider, RangeSlider, NavigationItem, SegmentedButtonRow, Segment, Camera. For collecting user interaction.
- **Media** - Video. For playing video, animated GIF, and embedded YouTube content.

The picker filters the list to components that are valid in the current position. Some components are restricted to a specific parent - for example, NavigationItem can only go inside a NavigationBar, Segment only inside a SegmentedButtonRow, and FloatingActionButton only inside a Scaffold.

Note: The component set grows over time. The Settings tab always shows every available property for the selected component, so you can discover new options as they are added. This page documents every component currently registered.

### Component IDs

Every component gets an auto-generated ID (a UUID). You can and should rename these to something meaningful. IDs serve several purposes:

- **Tree operations** - The editor uses IDs to find, select, update, move, and delete components. Each ID must be unique within the layout.
- **Event handlers** - Event actions that target another component (Run Component Action, Trigger Event) reference it by ID. See [Event Handlers & Actions](scenes_v2__11_interactions#interactions).
- **Live updates** - The **Update Scene v2** Tasker action targets a component by its ID. If your Text is named `status_label`, you can update its text from Tasker by targeting that ID.

Renaming an ID propagates automatically - the editor updates references to that ID in other components and in Tasker actions that reference the layout.

Note: When a Variable component expands into multiple siblings at runtime (e.g. via Array Merge), all element IDs in each sibling are automatically suffixed with `_1`, `_2`, etc. to keep them unique. See [Variables](scenes_v2__09_variables#variables) for details.

### The showWhen Property

Every component has an optional `showWhen` field that controls whether it appears. When the expression evaluates to `false`, the component and all its children are removed from the rendered layout entirely - they don't just become invisible, they stop taking up space. See [Conditional Visibility](scenes_v2__10_show_when#show-when) for the full expression syntax.

A companion `showWhenMode` setting controls what happens when `showWhen` is false. `Gone` (the default) removes the component and reclaims its space. `Invisible` keeps the component's space reserved but hides its content, so surrounding elements do not shift.

In the General section of the Settings tab, the `showWhen` field offers auto-complete suggestions for available variable names from both the [provides scope](scenes_v2__08_provides#provides-scope-order) and Tasker variables.

### Component Reference

#### Slots

Every component that accepts child components does so through **slots** - named areas that define where children go. Simple containers like Column and Row have a single `children` slot that accepts any component. More complex components like Scaffold and TopAppBar have multiple named slots, each with constraints on what it accepts and how many children it allows. The tables below list each component's slots, what they accept, and any child-count limit.

#### The provides Property

Container components (Column, Row, FlowRow, FlowColumn, Box, FlexBox, Card, Scaffold) support a [`provides`](scenes_v2__08_provides#provides) property - a key-value map that injects values into all descendants via [`@{key}`](scenes_v2__08_provides#provides-reference-syntax) references. See [Provides](scenes_v2__08_provides#provides) for details.

#### Layout Components

**Column** - Arranges children vertically. Editor name: "Vertical Column".

| Property | Default | Values |
| --- | --- | --- |
| `horizontalAlignment` | `Start` | Start, Center, End |
| `verticalArrangement` | `Top` | Top, Center, Bottom, SpaceBetween, SpaceAround, SpaceEvenly, SpacedBy |
| `spacing` | *unset* | Gap in dp between children. Used only when `verticalArrangement` is `SpacedBy`. |

| Slot | Accepts | Description |
| --- | --- | --- |
| `children` | Any component | Components arranged vertically |

**Row** - Arranges children horizontally. Editor name: "Horizontal Row".

| Property | Default | Values |
| --- | --- | --- |
| `horizontalArrangement` | `Start` | Start, Center, End, SpaceBetween, SpaceAround, SpaceEvenly, SpacedBy |
| `verticalAlignment` | `Top` | Top, Center, Bottom |
| `spacing` | *unset* | Gap in dp between children. Used only when `horizontalArrangement` is `SpacedBy`. |

| Slot | Accepts | Description |
| --- | --- | --- |
| `children` | Any component | Components arranged horizontally |

**Box** - Layers children on top of each other. Editor name: "Box (Z-Stack)".

| Property | Default | Values |
| --- | --- | --- |
| `contentAlignment` | `TopStart` | TopStart, TopCenter, TopEnd, CenterStart, Center, CenterEnd, BottomStart, BottomCenter, BottomEnd |

| Slot | Accepts | Description |
| --- | --- | --- |
| `children` | Any component | Components layered on top of each other |

**FlowRow** - Like Row, but children wrap onto the next line when they run out of horizontal space. Editor name: "Flow Row".

| Property | Default | Values |
| --- | --- | --- |
| `horizontalArrangement` | `Start` | Start, Center, End, SpaceBetween, SpaceAround, SpaceEvenly, SpacedBy |
| `verticalArrangement` | `Top` | Top, Center, Bottom, SpaceBetween, SpaceAround, SpaceEvenly, SpacedBy - distributes the wrapped lines |
| `itemVerticalAlignment` | `Top` | Top, Center, Bottom - aligns items within a line |
| `spacingHorizontal` | *unset* | Gap in dp between items on a line. Used when `horizontalArrangement` is `SpacedBy`. |
| `spacingVertical` | *unset* | Gap in dp between lines. Used when `verticalArrangement` is `SpacedBy`. |
| `maxItemsPerLine` | *unset* | Maximum items per line before wrapping |
| `maxLines` | *unset* | Maximum number of lines |
| `overflow` | `Clip` | Clip, Visible - how content past `maxLines` is handled |

| Slot | Accepts | Description |
| --- | --- | --- |
| `children` | Any component | Components arranged horizontally with wrapping |

**FlowColumn** - Like Column, but children wrap into the next column when they run out of vertical space. Editor name: "Flow Column".

| Property | Default | Values |
| --- | --- | --- |
| `verticalArrangement` | `Top` | Top, Center, Bottom, SpaceBetween, SpaceAround, SpaceEvenly, SpacedBy |
| `horizontalArrangement` | `Start` | Start, Center, End, SpaceBetween, SpaceAround, SpaceEvenly, SpacedBy - distributes the wrapped columns |
| `itemHorizontalAlignment` | `Start` | Start, Center, End - aligns items within a column |
| `spacingVertical` | *unset* | Gap in dp between items in a column. Used when `verticalArrangement` is `SpacedBy`. |
| `spacingHorizontal` | *unset* | Gap in dp between columns. Used when `horizontalArrangement` is `SpacedBy`. |
| `maxItemsPerLine` | *unset* | Maximum items per column before wrapping |
| `maxLines` | *unset* | Maximum number of columns |
| `overflow` | `Clip` | Clip, Visible |

| Slot | Accepts | Description |
| --- | --- | --- |
| `children` | Any component | Components arranged vertically with wrapping |

**FlexBox** - A CSS-Flexbox-style container with wrapping, proportional sizing, and per-item alignment. Best for a small number of items that need to wrap or share space proportionally. Not for large lists. Marked Experimental in the picker.

| Property | Default | Values |
| --- | --- | --- |
| `direction` | `Row` | Row or Column. Also accepts `true` (Column) or `false` (Row), so you can bind it to a variable and flip it live with the Toggle Variable event action. |
| `reverse` | `false` | Reverses the order children are laid out in: a reversed Row runs right to left, a reversed Column bottom to top. Accepts a variable, so it can also be toggled live. |
| `wrap` | `NoWrap` | NoWrap, Wrap, WrapReverse |
| `justifyContent` | `Start` | Start, Center, End, SpaceBetween, SpaceAround, SpaceEvenly - distribution along the main axis |
| `alignItems` | `Start` | Start, End, Center, Stretch, Baseline - alignment on the cross axis |
| `alignContent` | `Start` | Start, End, Center, Stretch, SpaceBetween, SpaceAround - distribution of wrapped lines |
| `gap` | *unset* | Gap in dp applied between all items. When set, hides `rowGap`/`columnGap`. |
| `rowGap` | *unset* | Gap in dp between rows. Available when `gap` is unset. |
| `columnGap` | *unset* | Gap in dp between columns. Available when `gap` is unset. |

| Slot | Accepts | Description |
| --- | --- | --- |
| `children` | Any component | Flex items. Each child can use the [Flex modifier](scenes_v2__06_modifiers#modifiers) for grow/shrink/basis control. |

**Card** - A Material 3 surface with elevation and a rounded background that holds a vertical stack of children. Use it to visually group related content.

| Property | Default | Values |
| --- | --- | --- |
| `style` | `Elevated` | Filled, Elevated, Outlined |
| `elevation` | `1` | Shadow elevation in dp. Shown only when `style` is `Elevated`. |
| `enabled` | `true` | Whether it reacts to the user. See [Enabled](scenes_v2__05_general#general-enabled). |

| Slot | Accepts | Description |
| --- | --- | --- |
| `children` | Any component | Components stacked vertically inside the card |

**Scaffold** - A full-page layout structure with dedicated [slots](scenes_v2__05_general#slots) for a top bar, bottom bar, floating action button, and main content. The content area automatically avoids overlapping the bars. Best for app-like screens.

| Property | Default | Description |
| --- | --- | --- |
| `containerColor` | *unset* | Background color of the scaffold (hex or theme name). Unset uses the Material 3 default. |
| `contentColor` | *unset* | Default content color for children (hex or theme name) |
| `fabPosition` | `End` | Floating action button position: End, Center |

| Slot | Accepts | Description |
| --- | --- | --- |
| `topBar` | Any component | Fixed header at the top. Typically a TopAppBar. |
| `bottomBar` | Any component | Fixed bar at the bottom. Typically a NavigationBar or BottomAppBar. |
| `floatingActionButton` | FloatingActionButton (max 1) | Floating button positioned by `fabPosition` |
| `content` | Any component | Main content area. Children placed here are layered on top of each other, like in a Box, not stacked. To stack several components, put a Column here and add them to it. |

The `floatingActionButton` slot only accepts FloatingActionButton; the other slots accept any non-FAB component. A new Scaffold starts pre-filled with a TopAppBar, a NavigationBar, and a FloatingActionButton so you have a working skeleton immediately.

**FloatingActionButton** - A Material 3 floating action button. Editor name: "Floating Action Button".

| Property | Default | Description |
| --- | --- | --- |
| `containerColor` | *unset* | FAB background color (hex or theme name). Unset uses the theme primary container color. |
| `contentColor` | *unset* | FAB icon/label color (hex or theme name) |
| `enabled` | `true` | Whether it reacts to the user. See [Enabled](scenes_v2__05_general#general-enabled). |

| Slot | Accepts | Description |
| --- | --- | --- |
| `content` | Any component (max 1) | Typically an Image used as the FAB icon |

A FloatingActionButton can only be placed in a Scaffold's `floatingActionButton` slot.

**TopAppBar** - A Material 3 top app bar with slots for a title, a navigation icon, and action buttons.

| Property | Default | Description |
| --- | --- | --- |
| `containerColor` | *unset* | Bar background color (hex or theme name) |
| `contentColor` | *unset* | Bar content color (hex or theme name) |

| Slot | Accepts | Description |
| --- | --- | --- |
| `title` | Any component (max 1) | Bar title content, usually a Text |
| `navigationIcon` | Any component (max 1, required) | Leading icon, e.g. a menu or back icon. New TopAppBars include an IconButton here. |
| `actions` | Any component | Trailing action buttons, arranged in a row |

Place it inside a Scaffold's `topBar` slot.

**BottomAppBar** - A Material 3 bottom app bar for actions.

| Property | Default | Description |
| --- | --- | --- |
| `containerColor` | *unset* | Bar background color (hex or theme name) |
| `contentColor` | *unset* | Bar content color (hex or theme name) |

| Slot | Accepts | Description |
| --- | --- | --- |
| `content` | Any component | Child components arranged in a row |

Place it inside a Scaffold's `bottomBar` slot.

**NavigationBar** - A Material 3 bottom navigation bar. It manages single-selection across its NavigationItem children for you. Editor name: "Navigation Bar".

| Property | Default | Description |
| --- | --- | --- |
| `containerColor` | *unset* | Bar background color (hex or theme name) |
| `contentColor` | *unset* | Bar content color (hex or theme name) |
| `selectedIndex` | *unset* (first item) | Which item starts selected, counting from 1 (`1` = first). Accepts a number or a variable; out-of-range values snap to the nearest item. |

| Slot | Accepts | Description |
| --- | --- | --- |
| `content` | NavigationItem only | The navigation destinations |

Tapping an unselected item selects it; tapping the already-selected item does nothing. NavigationItem has no "selected" property of its own - the bar owns selection. Place a NavigationBar in a Scaffold's `bottomBar` slot. It can fire a [selection-changed event](scenes_v2__11_interactions#interactions) and write the selected index to a variable.

**NavigationItem** - A single destination inside a NavigationBar, and it can only be placed there. It has no "selected" property - the parent NavigationBar manages selection. Editor name: "Navigation Item".

| Property | Default | Description |
| --- | --- | --- |
| `icon` | `""` | Material icon for the item (e.g. `icon:Home`) |
| `label` | `""` | Item label text |
| `alwaysShowLabel` | `true` | When `true`, the label always shows; when `false`, only the selected item shows its label |
| `selectedIconColor` | `""` | Icon color when this item is selected |
| `unselectedIconColor` | `""` | Icon color when this item is not selected |
| `selectedLabelColor` | `""` | Label color when selected |
| `unselectedLabelColor` | `""` | Label color when not selected |
| `indicatorColor` | `""` | Color of the selection pill behind the selected item |
| `unselectedIndicatorColor` | `""` | Color of the pill area when not selected |
| `textStyle` | *omitted* | Optional nested font object: `fontFamily` (a built-in name, or an absolute path to a `.ttf`/`.otf` file), `fontWeight`, `fontStyle`. Merged onto the Material label style. |
| `enabled` | `true` | Whether it reacts to the user. See [Enabled](scenes_v2__05_general#general-enabled). |

A NavigationItem can only be placed inside a NavigationBar.

**Dropdown** - A trigger element that opens a popup menu of content children. Works as a value picker or as a generic popup.

| Property | Default | Description |
| --- | --- | --- |
| `isExpanded` | `""` | Expansion expression. Blank means auto mode - tapping the trigger toggles the menu. Set an expression to control expansion yourself. |
| `triggerShowsSelected` | `true` | When `true` (Select mode), tapping a content child sets `selectedIndex`, closes the menu, and fires a selection-changed event; the closed trigger mirrors the selected child as a non-interactive preview. Set `false` for a generic popup whose children fire their own click handlers. |
| `selectedIndex` | `""` | Which content child starts selected, counting from 1 (`1` = first). Leave blank for none. Shown only when `triggerShowsSelected` is `true`. Accepts a variable expression. |
| `triggerMatchesContentWidth` | `true` | When `true`, the collapsed trigger is sized to match the width of the popup content menu. Set `false` to let the trigger size itself independently. |
| `enabled` | `true` | Whether it reacts to the user. See [Enabled](scenes_v2__05_general#general-enabled). |

| Slot | Accepts | Description |
| --- | --- | --- |
| `trigger` | Any component (max 1) | The element that opens the menu. Acts as a placeholder until something is selected. |
| `content` | Any component | The menu items, stacked vertically |

In Select mode (`triggerShowsSelected` on), the click handlers of the content children don't fire: a tap only selects the item. React to the choice with a [selection-changed](scenes_v2__11_interactions#interactions) event handler on the Dropdown, or bind its Selection [state](scenes_v2__05_general#general-states) to a variable.

Screenshot: A closed Dropdown whose trigger shows the selected item

Screenshot: The same Dropdown tapped open, listing every item

**Spacer** - Invisible spacing between siblings. A new Spacer is created with a 16dp Size modifier; adjust its dimensions with that [Size modifier](scenes_v2__06_modifiers#modifiers). In JSON (the [Code tab](scenes_v2__17_raw_json#raw-json)) a Spacer also accepts its own `width` and `height`; the editor doesn't show fields for them. Spacers also honor Background and Clip, so a sized Spacer can draw a simple colored shape.

| Property | Default | Description |
| --- | --- | --- |
| `width` | *unset* | Width in dp. Supports [proportional scaling](scenes_v2__19_proportional_scaling#proportional-scaling). |
| `height` | *unset* | Height in dp. Supports proportional scaling. |

**Variable** - A structural placeholder that is replaced at runtime with dynamic content from a Tasker variable. See [Variables](scenes_v2__09_variables#variables) for details.

| Property | Default | Description |
| --- | --- | --- |
| `key` | `""` | Tasker variable name (e.g. `%content`) holding JSON - a single component object or an array of components. The editor field shows the name without the `%` prefix and validates it. |

**ArraysMergeTemplate** - Builds a list from Tasker arrays. It has a single child, the **template**, which is repeated once for every element of the arrays you reference inside it. Editor name: "Arrays Merge Template". It has no properties of its own: there's no list of arrays to fill in, because the arrays are picked up from the template itself. Put it inside a Column, Row or another container to lay the rows out.

For example, with the arrays `%icon()` and `%item()` filled in a task, a template Row holding an Image with `url` `%icon` and a Text with `text` `%item` produces one row per item, each with its own icon and label. You can use several parallel arrays this way. A variable that isn't an array is shared by every row.

- **Each row is live.** When an element of an array changes, only its row updates. Adding or removing elements with **Array Push**, **Array Pop** or **Array Set** while the scene is showing adds or removes rows.
- **Each row writes to its own element.** A Set Variable, Toggle Variable or Variable Clear event action (or a state binding) inside the template that targets one of the referenced arrays changes only that row's element. For example, a Switch in the template bound to `state` writes `%state3` when it's toggled in the third row.
- Rows count one by one for actions like [Scroll To Index](scenes_v2__06_modifiers#modifiers-scrolling-actions).

| Slot | Accepts | Description |
| --- | --- | --- |
| `template` | One component | The row repeated once per array element (required) |

For a step-by-step walkthrough with screenshots, see [Lists from Tasker Arrays](scenes_v2__04_layout_fundamentals#layout-fundamentals-lists). This example uses icons, filled in a task with **Array Set**: `%icon` with `icon:Home,icon:Lock,icon:Notifications` and `%item` with `Home,Front Door,Alerts`.

```
{ "type": "Column", "id": "list", "children": [
  { "type": "ArraysMergeTemplate", "id": "rows", "template": [
    { "type": "Row", "id": "row", "verticalAlignment": "Center", "children": [
      { "type": "Image", "id": "rowIcon", "url": "%icon" },
      { "type": "Text", "id": "rowLabel", "text": "%item" }
    ] }
  ] }
] }
```

Screenshot: One Row per array element, each with its icon and label

**Placeholder** - An empty marker component with no properties. It renders nothing at runtime and shows a labelled box only in the editor preview. Use it as a stand-in slot inside reusable templates (element-mode layouts) where the real content is supplied later. Most layouts do not need it.

#### Display Components

**Text** - Displays text content.

| Property | Default | Description |
| --- | --- | --- |
| `text` | *required* | The text content to display. Has no default - a Text must have this property. |
| `textSize` | `14` | Font size in sp |
| `color` | `""` | Text color (hex or theme name). Empty inherits the surrounding content color. |
| `textAlign` | `Start` | Start, Center, End, Justify - horizontal alignment of the text |
| `verticalAlignment` | `Top` | Top, Center, Bottom - vertical alignment of the text within its bounds |
| `maxLines` | `""` | Maximum number of lines before the text is truncated. Empty means unlimited. |
| `minLines` | `""` | Minimum number of lines the text always reserves. Empty means 1. |
| `overflow` | `""` | Clip, Ellipsis, or Visible - how overflowing text is handled. Empty means Clip. |
| `softWrap` | `""` | `true`/`false` - whether text wraps at soft line breaks. Empty means true. |
| `selectable` | `""` | `true`/`false` - allow the user to select and copy the text. |
| `autoSize` | `""` | `true`/`false` - shrink the text to fit its bounds. When on, `textSize` is ignored and the size stays between `autoSizeMinSp` and `autoSizeMaxSp`. |
| `autoSizeMinSp` | `""` | Smallest size in sp that `autoSize` can shrink the text to. Empty means 8. Used only when `autoSize` is on. |
| `autoSizeMaxSp` | `""` | Largest size in sp that `autoSize` can use. Empty means 24. Used only when `autoSize` is on. |
| `contentFormat` | `""` | Plain, Html, or Markdown. Html renders inline markup, `<a href>` links (opened externally), and `[icon:Name]` inline icons. Markdown renders a lightweight subset (`#` headings, `**bold**`, `*italic*`, `~~strike~~`, ``code``, `[text](url)` links, line breaks) plus the same `[icon:Name]` icons. Empty means Plain. |
| `linkColor` | `""` | Color of tappable links when `contentFormat` is Html (hex or theme name). |
| `textStyle` | *omitted* | Optional nested typography object (see below). Omit entirely for a plain Text. |
| `enabled` | `true` | Whether it reacts to the user. See [Enabled](scenes_v2__05_general#general-enabled). |

The optional `textStyle` object bundles the full typography surface. Every axis is a string; a blank axis inherits. Set it in the editor through the **Text style** sheet, or in JSON:

| textStyle axis | Description |
| --- | --- |
| `typographyPreset` | A Material 3 role such as `TitleMedium` or `HeadlineSmall`. A preset owns the font size (the top-level `textSize` is ignored while a preset is set). |
| `fontWeight` | Thin, ExtraLight, Light, Normal, Medium, SemiBold, Bold, ExtraBold, Black. |
| `fontStyle` | Normal or Italic. |
| `fontFamily` | Default, SansSerif, Serif, Monospace, Cursive, or an absolute path to a `.ttf`/`.otf` font file. |
| `lineHeight`, `letterSpacing` | In sp. Letter spacing may be negative. |
| `textDecoration` | None, Underline, LineThrough, UnderlineLineThrough. |
| `shadowColor`, `shadowOffsetX`, `shadowOffsetY`, `shadowBlur` | Drop shadow; offsets and blur are in dp. |
| `gradientStartColor`, `gradientEndColor`, `gradientAngleDegrees` | Set both colors to fill the glyphs with a gradient at the given angle. |
| `strokeWidth` | Outlines the glyphs instead of filling them (dp). |
| `spanBackground` | Highlight color behind the text. |
| `baselineShift` | None, Superscript, Subscript. |
| `textIndentFirstLine`, `textIndentRestLine` | Paragraph indents (sp). |
| `lineBreak`, `hyphens`, `textDirection` | Line-break strategy (Simple/Heading/Paragraph), hyphenation (None/Auto), and direction (Content/Ltr/Rtl). |
| `lineHeightAlignment`, `lineHeightTrim` | How the line height is distributed. Only apply when `lineHeight` is set. |

Screenshot: Text styled with a gradient fill, an outline, a shadow, a span background, a superscript, a double decoration and two typography presets

Note: A plain Text (no `textStyle` and no behavior axes set) renders and serializes exactly as before - the typography features are fully additive. Button, TextInput, NavigationItem and Segment carry the same `textStyle` object, but expose only its font axes.

**Image** - Displays an image from a URL, a local file, a Material icon, a Material Symbol, base64 data or inline SVG. Animated GIFs play automatically.

| Property | Default | Description |
| --- | --- | --- |
| `url` | `""` | Image source: a URL (`https://...`), a file path on your device (`/sdcard/Pictures/photo.png`) or content URI, base64 image data, a Material icon (`icon:Settings`), a [Material Symbol](scenes_v2__05_general#general-material-symbols) (`symbol:home`), or inline SVG (`<svg>...</svg>`). The editor's image picker has URL, Device, Icons and Symbols tabs. |
| `errorUrl` | `""` | Fallback source shown when `url` fails to load. Same source formats as `url`. If it also fails, a broken-image icon is shown. |
| `contentScale` | `Fit` | Fit, Crop, FillBounds |
| `tint` | `""` | Optional tint color applied to icons, symbols and SVGs (hex or theme name) |
| `enabled` | `true` | Whether the image reacts to taps. See [Enabled](scenes_v2__05_general#general-enabled). |

Screenshot: The same wide photo in a square box with contentScale Fit, Crop and FillBounds

##### Material Symbols

Material Symbols are Google's icon font: almost 4000 icons whose style you can adjust. Pick one in the **Symbols** tab of the image picker, or write it as `symbol:` followed by the symbol's name, optionally followed by style settings separated by semicolons:

| Setting | Default | Description |
| --- | --- | --- |
| `fill` | `0` | `0` = outlined, `1` = filled |
| `weight` | `400` | Stroke thickness, from `100` (thin) to `700` (bold) |
| `grade` | `0` | Fine-tunes thickness without changing the size, from `-50` to `200` |
| `opsz` | `24` | Optical size, from `20` to `48`: matches the stroke detail to the size the icon is shown at |

For example, `symbol:favorite;fill:1` is a filled heart and `symbol:settings;weight:200` is a thin gear. Because the source is just text, a variable can switch the style live: `symbol:wifi;fill:%wifi_fill`. Material Symbols work anywhere an image source is accepted, including Icon Buttons and Switch thumbs.

Screenshot: One symbol drawn with different fill, weight, grade and opsz settings

**Divider** - A thin horizontal line for visual separation.

| Property | Default | Description |
| --- | --- | --- |
| `color` | `""` | Line color (hex or theme name). Empty uses the Material 3 default divider color. |
| `thickness` | `1` | Line thickness in dp |

**ProgressBar** - A linear or circular progress indicator. Editor name: "Progress Bar".

| Property | Default | Description |
| --- | --- | --- |
| `style` | `Linear` | Linear (horizontal bar) or Circular (ring) |
| `mode` | `Determinate` | Determinate (shows a specific value) or Indeterminate (animated loading) |
| `progress` | `0` | Current progress value. Shown only in Determinate mode. Accepts a variable expression. |
| `minProgress` | `0` | Low end of the progress range (Determinate mode) |
| `maxProgress` | `100` | High end of the progress range (Determinate mode) |
| `color` | `""` | Indicator color (hex or theme name) |
| `trackColor` | `""` | Track (background) color |
| `strokeCap` | `Round` | Round or Square - shape of the indicator ends |
| `strokeWidth` | `4` | Ring thickness in dp. Shown only when `style` is `Circular`. |
| `animateChanges` | `false` | When `true`, smoothly tweens the bar whenever `progress` changes. Determinate mode only. |
| `animationDuration` | `300` | Tween duration in milliseconds for `animateChanges`. Shown only when `animateChanges` is on. |
| `gapSize` | `4` | Space in dp between the filled part and the rest of the track. Set to 0 for one continuous track. Not used by Circular + Indeterminate. |
| `showStopIndicator` | `false` | Draws a small dot at the far end of the track, marking where the bar finishes. Editor name: "Show End Dot". Linear + Determinate only. |

ProgressBar has two actions and one event:

- **`animate`** action - Moves the bar at a steady pace. Parameters: `from` (optional; when left out, the bar starts from the value it shows), `to` (default `100`) and `duration` in milliseconds (default `5000`).
- **`stop`** action - Halts the bar where it is. It stops both an `animate` run and an `animateChanges` tween in progress.
- **`animation_completed`** event - Fires when an `animate` run finishes by itself. It doesn't fire when `stop` interrupts the run, or for `animateChanges` tweens.

Its two [states](scenes_v2__05_general#general-states) update at different times. **Progress** is written only when the bar comes to rest (after an `animate`, a `stop` or a change of `progress`), so use it in conditions. **Displayed Progress** follows the bar while it moves, about every 250ms, so it can drive a Text that counts up. Bind the two to different variables.

Screenshot: Linear and circular progress bars: determinate, indeterminate, Round and Square caps, gap sizes and the end dot

**WebView** - Renders live web content in a native Android WebView: a remote page, a local file, or inline HTML you write yourself. It is the richest component in the set, with a full settings panel, an imperative action set, lifecycle events, continuously-synced states, and an optional two-way JavaScript bridge. A new WebView is created with a [FillSize modifier](scenes_v2__06_modifiers#modifiers) so it fills the space it is given - constrain it with Size or Weight modifiers if you want it smaller. Editor group: Display.

##### Content & Load Modes

The single `content` property drives what loads. The load mode is auto-detected from its value - there is no separate "mode" switch:

| `content` looks like | How it loads |
| --- | --- |
| `http://...`, `https://...`, or any string containing `://` | Loaded as a remote URL. |
| Starts with `/` | Treated as a local file path and loaded as `file:///...`. |
| Starts with `file://` | Loaded as a local file URL. |
| Anything else | Treated as inline HTML and rendered directly (via `loadDataWithBaseURL`). |

Because detection keys off `://`, a bare host like `example.com` with no scheme is treated as inline HTML, not a URL. Use a full `https://example.com` to load a site.

##### WebView Properties

The Settings tab groups the WebView's many options into sections. Every property below accepts a variable expression unless noted; booleans take `true`/`false`.

*Content*

| Property | Editor label | Default | Description |
| --- | --- | --- | --- |
| `content` | Content | `""` | What to load: a URL, a local file path, or inline HTML. See [Content & Load Modes](scenes_v2__05_general#webview-content-modes). This is the primary property. When a `url` state binding exists, the current URL flows back into it. |
| `baseUrl` | Base URL | `""` | Base URL used only in inline-HTML mode, so relative links and relative resource paths (`src`, `href`) resolve against it. Ignored when `content` is a URL or file path. |

*Appearance*

| Property | Editor label | Default | Description |
| --- | --- | --- | --- |
| `darkMode` | Dark Mode | `Auto` | `Auto` (follow the system / WebView default), `AlgorithmicDark` (force the engine to darken light pages), or `ForceLight` (never darken). |
| `textZoom` | Text Zoom | `100` | Text scaling as a percentage. `100` is normal size; `150` is 1.5x. Minimum 1. |
| `backgroundColor` | Background Color | `""` | WebView background color (hex or theme name). Empty uses the page's own background. Useful to avoid a white flash before a dark page paints. |

*JavaScript & Storage*

| Property | Editor label | Default | Description |
| --- | --- | --- | --- |
| `javaScriptEnabled` | JavaScript | `true` | Enables JavaScript execution. Turning this off also disables the JS bridge and with it all live variable updates; variables then only apply via resolve-and-reload. |
| `domStorageEnabled` | DOM Storage | `true` | Enables the DOM `localStorage`/`sessionStorage` APIs. |
| `databaseEnabled` | Database | `false` | Enables the legacy WebSQL database API. |
| `jsBridgeEnabled` | JS Bridge | `true` | Injects the native bridge object (see [JavaScript Bridge](scenes_v2__05_general#webview-js-bridge)) so page JavaScript can talk back to Tasker. Also powers live variable updates: with it on, `%vars` in the page update in place with no reload; with it off, raw HTML content reloads on each change. Requires `javaScriptEnabled`. |

*Zoom & Viewport*

| Property | Editor label | Default | Description |
| --- | --- | --- | --- |
| `supportZoom` | Support Zoom | `true` | Master switch for pinch/zoom support. When `false`, the page cannot be zoomed at all. |
| `builtInZoomControls` | Built-in Zoom Controls | `false` | Enables the WebView's built-in zoom mechanism (pinch gestures and, optionally, on-screen buttons). |
| `displayZoomControls` | Display Zoom Controls | `false` | Shows the legacy on-screen +/- zoom buttons. Only relevant when `builtInZoomControls` is on. |
| `useWideViewPort` | Wide Viewport | `false` | Honors the page's `<meta name="viewport">` tag, letting a site lay itself out at its intended width. Recommended for normal mobile sites. |
| `loadWithOverviewMode` | Overview Mode | `false` | Zooms a wide page out to fit the WebView width on first load. Usually paired with `useWideViewPort`. |

*Security*

| Property | Editor label | Default | Description |
| --- | --- | --- | --- |
| `mixedContentMode` | Mixed Content | `CompatibilityMode` | How an HTTPS page may load HTTP sub-resources: `AlwaysAllow`, `NeverAllow`, or `CompatibilityMode` (the engine decides per resource type). |
| `allowFileAccess` | File Access | `false` | Allows pages to load `file://` URLs. You don't need it to show a local file: when `content` is a local file path or a `file://` URL, file access is turned on automatically. Turn it on only when other content needs to reach local files. Off by default for safety. |
| `allowContentAccess` | Content Access | `true` | Allows loading `content://` provider URLs. |

*Media & Network*

| Property | Editor label | Default | Description |
| --- | --- | --- | --- |
| `mediaPlaybackRequiresUserGesture` | Media Requires Gesture | `true` | When `true`, audio/video will not autoplay until the user interacts. Set `false` to allow autoplay. |
| `userAgentString` | User Agent | `""` | Custom User-Agent header. Empty uses the system default. Set this to make a site serve its desktop or mobile variant. |
| `cacheMode` | Cache Mode | `Default` | `Default` (normal HTTP caching), `NoCache` (always hit the network), `CacheOnly` (never hit the network), or `CacheElseNetwork` (use cache when present, otherwise load). |

*Location*

| Property | Editor label | Default | Description |
| --- | --- | --- | --- |
| `geolocationEnabled` | Geolocation | `false` | Allows pages to use the HTML5 Geolocation API. Tasker must also have the location permission. |

##### Reactive Variables

While the JS bridge is enabled (the default), Tasker variables are resolved live inside the page, whether the content is raw HTML, a file, or a URL. The page updates in place whenever a variable changes - no reload:

- In **text nodes, attributes, and `<style>` blocks**, write `%varName` directly. It is substituted with the value and re-substituted in place when the value changes. With the JS bridge off, only raw HTML content resolves variables, by reloading the page on each change.
- In **`<script>` blocks**, `%var` is treated as a value expression, not a string. Use it as a standalone token or in concatenation - `"Hello " + %name`, not `"Hello %name"`. Template literals work too: ``${%query}``. An ordinary modulo such as `x % 10` is left untouched. Raw-HTML content whose scripts reference variables keeps the resolve-and-reload behavior instead; for fully reactive scripts read values with `getVariable()` and subscribe with `onVariableChanged`.

For example, this inline-HTML content shows a name and a color from Tasker variables, then reads a count inside a script:

```
<!-- Text and a style attribute read %variables directly -->
<h1 style="color: %titleColor">Hello, %userName</h1>

<!-- Inside a script, %var is the resolved VALUE (a string): use it as a
     standalone token or in concatenation, never inside quotes -->
<script>
  var unread = %unreadCount;             // becomes e.g.  var unread = "7";
  document.title = unread + " unread";
</script>
```

##### JavaScript Bridge

When `jsBridgeEnabled` is on, an object called `Tasker` is available to the page's JavaScript. It lets page scripts read and write Tasker variables, drive other layouts, and invoke component actions. Available methods:

| Method | What it does |
| --- | --- |
| `setVariable(name, value)` | Sets a single Tasker variable on this screen. |
| `setVariables(variables)` | Sets several variables at once from name/value pairs (object or JSON string). |
| `clearVariable(name)` | Clears (unsets) a single Tasker variable on this screen. |
| `clearVariables(names)` | Clears several variables at once (array of names, or JSON string). |
| `getVariable(key)` | Returns the current value of a variable. |
| `getVariables()` | Returns all live variables in this screen's scope as a JavaScript object keyed by bare name (cleared variables omitted). |
| `getVariablesForScreen(screenId)` | Same as `getVariables()`, but for another screen, by its ID. Returns an empty object when there is no screen with that ID. |
| `updateElementProperties(elementId, property, value)` | Live-updates a single property of another component on this screen by its ID. |
| `executeAction(elementId, actionName, params)` | Returns a Promise that resolves to the action's result as a JavaScript object. `params` may be an object or a JSON string. |
| `showLayout(config)` | Shows another layout. Config (object or JSON string) carries `id`, `layoutJson`, and optional `mode`/`displayId`. |
| `showLayoutForResult(config, timeoutMs)` | Shows a layout and returns a Promise that resolves to its output variables as a JavaScript object (`null` when nothing came back) once it is dismissed or the timeout elapses. |
| `waitForLayoutResult(id, timeoutMs)` | Returns a Promise that resolves to the layout's output variables as a JavaScript object (`null` when nothing came back) once an already-shown layout is dismissed. |
| `dismissLayout(id)` / `dismissAllLayouts()` | Dismisses one layout by ID, or every active layout. |
| `cancelScreen(message)` | Ends the current screen in error, failing the task waiting on its result. The optional `message` is delivered to the caller as `%errmsg`. |
| `isLayoutActive(id)` | Returns whether a layout with that ID is currently shown. |
| `listDisplays()` | Returns the available displays as a JavaScript array of `{id, name}` objects. |
| `updateOverlayConfig(config)` | Repositions/resizes the overlay this WebView lives in (`x`, `y`, `width`, `height`, `passthrough`, and `configTransitionMs`/`configTransitionEasing` to animate the change); config may be an object or a JSON string. |
| `updateOverlayConfigForScreen(screenId, config)` | Same as `updateOverlayConfig`, but for the overlay of another screen, by its ID. |
| `moveOverlayBy(deltaXpx, deltaYpx)` | Moves the overlay this WebView lives in by a pixel delta (device pixels). Use it for programmatic moves; it is also what the `tasker-drag-handle` CSS classes call. Has no effect outside overlay mode. |
| `extractOutputVariables(layout)` | Returns the output-variable names a layout (object or JSON string) would produce, as a JavaScript array. |
| `getCurrentScreenId()` | Returns the ID of the screen this WebView belongs to. |
| `onVariableChanged(names, callback)` | Listens for variable changes: pass one name, an array of names, or just a callback to hear every change (see below). |
| `runTask({ name, variables, priority })` | Returns a Promise that resolves (to `{}`) once the task is dispatched and rejects if the task name is blank or unresolvable. `variables` is an object of input locals (keys bare or `%`-prefixed; values are strings and support `%var` interpolation). `priority` is optional; omit or `null` for maximum priority. |
| `sendCommand({ command })` | Returns a Promise that resolves when the command is dispatched and rejects if the command is blank. Triggers the Tasker **Command** event with `command` (supports `%var` interpolation). |
| `runTaskForResult({ name, variables, priority, timeoutMs })` | Returns a Promise that resolves to `{ returnValue, variables }` when the task completes, or rejects for a blank/unknown task name or an unsuccessful run. `timeoutMs` is the wait budget (`0` = default 60s). `returnValue` is the value passed by the task's **Return** action (a string, or `null` when there is no Return or its value is empty). `variables` holds any extra local variables sent back via Return's variable passthrough, keyed by bare name (without `%`); input variables and Tasker system variables are excluded. |

Several methods also have a `...OnScreen(screenId, ...)` / `...ForScreen(screenId, ...)` variant that targets a screen other than the current one (for example `setVariableOnScreen`, `clearVariableOnScreen`, `executeActionOnScreen`, `updateElementPropertiesOnScreen`).

Synchronous methods that exchange JSON have a raw `...Json` string variant (for example `getVariablesJson`, `showLayoutJson`) that accepts and returns plain JSON strings instead of JavaScript objects. The async Promise methods (`executeAction`, `showLayoutForResult`, `waitForLayoutResult`, `executeActionOnScreen`) do not have page-callable `...Json` counterparts.

**Worked examples.** The bridge is the `Tasker` object. One naming rule matters: in HTML, CSS, and `<script>` markup you reference a variable with a leading `%` (`%count`), but when you pass a name to a bridge method you use the bare name without it (`'count'`). All values are strings.

Read and write Tasker variables. Guard for `Tasker` first, since it is absent when the JS Bridge option is off:

```
if (window.Tasker) {
  var count = Tasker.getVariable('count');                // current value of %count
  Tasker.setVariable('count', String(Number(count) + 1)); // write %count back

  // Set several at once (object or JSON string):
  Tasker.setVariables({ status: 'ready', count: '0' });

  // Clear (unset) variables again, singly or several at once:
  Tasker.clearVariable('status');
  Tasker.clearVariables(['status', 'count']);
}
```

React whenever a Tasker variable changes. `onVariableChanged` sits on the bridge object next to the other variable methods (with `window.onVariableChanged` as an equivalent alias) while the bridge is on, in every load mode (raw HTML, file, or URL); its callback receives the bare name and the new value. Subscribe to one variable, several, or every variable change:

```
// One variable:
Tasker.onVariableChanged('count', function (name, value) {
  document.getElementById('badge').textContent = value;
});

// Several variables sharing one callback:
Tasker.onVariableChanged(['status', 'count'], function (name, value) {
  console.log(name + ' is now ' + value);
});

// Every variable change (just pass the callback):
Tasker.onVariableChanged(function (name, value) {
  console.log(name + ' is now ' + value);
});
```

Drive another component by its element ID and read what it returns. `executeAction` returns a Promise that resolves to the action's result object (keys from the Result column below):

```
// Run the `find` action on a WebView whose element ID is "browser":
try {
  const result = await Tasker.executeAction('browser', 'find', { text: 'hello' });
  console.log(result.match_count + ' matches');
} catch (e) {
  console.error('action failed', e.message);
}
```

Show another layout, or show one and await the values it returns. The result is an object with an `outputVariables` map, or `null` when nothing came back:

```
// Fire-and-forget: open a saved layout (its JSON) as a dialog.
Tasker.showLayout({ id: 'confirm', mode: 'Dialog', layoutJson: myLayoutJson });

// Await dismissal, then read what the layout produced (0 = no timeout):
try {
  const result = await Tasker.showLayoutForResult({ id: 'picker', layoutJson: pickerJson }, 0);
  if (result) {
    const out = result.outputVariables;  // { varName: ["value"], ... }
  }
} catch (e) {
  console.error('layout failed', e.message);
}
```

###### Running tasks and sending commands

A bridge-enabled WebView can run Tasker tasks, send commands, and run a task and wait for its result, all on the same `Tasker` object used for variables and layouts. Each method returns a Promise.

```
// Dispatch a task; rejects if the name is blank or unresolvable.
try {
  await Tasker.runTask({ name: 'My Task', variables: { foo: 'bar', '%num': '3' }, priority: 10 });
} catch (e) {
  console.error('task failed', e.message);
}

// Trigger the Command event; rejects on a blank command.
try {
  await Tasker.sendCommand({ command: 'next' });
} catch (e) {
  console.error('command failed', e.message);
}

// Run a task and await its Return value (0 = default 60s timeout).
// The task ends with a Return action; enable variable passthrough to
// return extra variables alongside the Return value.
try {
  const r = await Tasker.runTaskForResult({ name: 'Calc', variables: { x: '2' }, timeoutMs: 5000 });
  console.log(r.returnValue);           // e.g. "4" (null if no Return)
  console.log(r.variables.someVar);    // variables the task passed back, if any
} catch (e) {
  console.error('task rejected', e.message);
}
```

Note: `variables` values and the task name support `%variable` interpolation, resolved against the scene's variables first and Tasker's global variables otherwise. Object or array values are ignored; pass strings. Each key must also be a valid Tasker local variable name (all lower-case, like any local variable); keys that are not, such as `MyVar`, are silently skipped.

Security: Enabling the JavaScript bridge (`jsBridgeEnabled`) on a WebView grants *every* page it loads - including remote `http(s)` pages - the ability to read and write your scene variables and to run tasks and send commands via `Tasker.runTask`, `Tasker.sendCommand`, and `Tasker.runTaskForResult`. Only enable the bridge on content you trust. For untrusted or third-party pages, leave the bridge off.

###### In-HTML window drag handles

When a WebView is shown as a draggable [overlay](scenes_v2__15_overlay_features#overlay-features), you can turn any HTML element into a window drag handle by giving it a class:

- `tasker-drag-handle` - drag the window on both axes
- `tasker-drag-handle-x` - horizontal only
- `tasker-drag-handle-y` - vertical only

Tasker attaches the drag handling for you (no JavaScript required), and keeps watching for elements you add later. The rest of the page stays interactive and a tap on a handle still registers as a click. Tasker applies `touch-action: none` to each handle automatically; you can also set it in your own CSS so the browser honours it before the bridge finishes initialising. This requires the WebView's JS bridge to be enabled and only works in overlay mode.

```
<div class="tasker-drag-handle">drag me</div>
```

###### Calling Tasker Actions From JavaScript

In addition to the task and layout methods above, the bridge exposes individual Tasker actions as `await Tasker.<name>({ ...options })` Promises. Each call resolves to an object containing the action's output variables (bare-keyed, without the leading `%`) and rejects with an `Error` if the action fails.

```
// Show a toast message:
await Tasker.flash({ text: 'Saved', long: true });

// Run a shell command and read its output:
try {
  const o = await Tasker.runShell({ cmd: 'ls /sdcard' });
  console.log(o.stdout);
} catch (e) {
  console.error('shell failed', e.message);
}
```

Tasker exposes a large set of individual actions through the bridge, spanning connectivity and volume toggles, file operations, phone and call control, media playback, and system actions. Because the list is long, it lives on its own searchable page rather than inline here: [Tasker Actions Reference](scenes_v2__webview-actions). It lists every action with its option keys, accepted values, and a description.

**Editor autocomplete.** For autocomplete of every `Tasker.<name>()` action as you write your scene's JavaScript, download the [VS Code workspace](https://tasker.joaoapps.com/userguide/en/scenes_v2/workspace.zip), unzip it, and open the folder in VS Code. Type `Tasker.` in `main.js` to get action names, option keys, and descriptions inline. It also includes a starter `index.html` wired to the scene's theme colors.

##### Theme Colors

The scene's Material 3 theme colors are available to your WebView content so it can match the surrounding scene and the device theme (including dark/light and Material You). They update live while the scene is open. See also [Colors & Theming](scenes_v2__07_colors_theming#colors-theming-theme).

Two ways to use them:

- **CSS (recommended, no JavaScript):** every color role is a CSS custom property on `:root` named `--tasker-<role>`, for example `--tasker-primary`, `--tasker-onPrimary`, `--tasker-surface`. Styled elements re-render automatically when the theme changes.

```
button {
  background: var(--tasker-primary);
  color: var(--tasker-onPrimary);
}
```

- **JavaScript:** read any role from `Tasker.colors`, or from the guaranteed-present alias `window.taskerColors` (use the alias if you read at the very first document-start tick, before the bridge attaches). Listen for the `tasker-colors-changed` event on `document` to react in JS-driven content such as a `<canvas>`; its `detail` is the colors object.

```
// Read a colour (value is a CSS string like "#A3CCE3")
const c = window.taskerColors;          // or: Tasker.colors  (JS bridge on)
myEl.style.color      = c.primary;
myEl.style.background = c.surface;

// React to live theme changes (dark/light, Material You)
document.addEventListener('tasker-colors-changed', function (e) {
  myEl.style.color = e.detail.primary;
});
```

Color values are CSS strings (`#RRGGBB`, or `rgba(...)` when translucent). A role may rarely be absent on a given device, so supply a CSS fallback where it matters, for example `var(--tasker-onPrimary, #000)`.

**Available roles** - each is both a `--tasker-<role>` CSS variable and a `Tasker.colors.<role>` / `window.taskerColors.<role>` value (the full Material 3 color-scheme set):

```
primary           onPrimary           primaryContainer        onPrimaryContainer
secondary         onSecondary         secondaryContainer      onSecondaryContainer
tertiary          onTertiary          tertiaryContainer       onTertiaryContainer
error             onError             errorContainer          onErrorContainer
background        onBackground        surface                 onSurface
surfaceVariant    onSurfaceVariant    surfaceTint
surfaceDim        surfaceBright       surfaceContainerLowest
surfaceContainer  surfaceContainerLow surfaceContainerHigh    surfaceContainerHighest
inverseSurface    inverseOnSurface    inversePrimary
outline           outlineVariant      scrim
primaryFixed      primaryFixedDim     onPrimaryFixed          onPrimaryFixedVariant
secondaryFixed    secondaryFixedDim   onSecondaryFixed        onSecondaryFixedVariant
tertiaryFixed     tertiaryFixedDim    onTertiaryFixed         onTertiaryFixedVariant
```

**Light and dark mode:** every role exists in both. The role *name* is the same in light and dark; only the value it resolves to changes. In light mode `surface` is light and `onSurface` is dark; in dark mode they swap, and the accents (`primary`, `secondary`, `tertiary`) shift to lighter tones. Each `on<Role>` is always chosen to contrast with its base role, so pairing a role with its `on` counterpart stays legible in both modes. On Android 12+ the actual values come from the device's wallpaper-based Material You palette (so they differ per device); below Android 12 they are the Material 3 baseline palette. Load the *WebView Theme Colors* sample and toggle device dark/light to see every role's real value in each mode.

This requires the component's **JavaScript** setting to be enabled (the colors are applied by a small injected script). With JavaScript disabled, the colors and CSS variables are not available. The JS bridge does *not* need to be enabled for the CSS variables or `window.taskerColors`; the `Tasker.colors` alias appears only when the bridge is enabled.

Tip: If the WebView's **Dark Mode** is set to `Auto`, declare `<meta name="color-scheme" content="light dark">` in your page so the WebView's algorithmic darkening doesn't repaint the injected theme colors. A page that themes itself with these colors should always declare `color-scheme`.

##### WebView Actions

Run these actions from an event handler with the [Run Component Action](scenes_v2__11_interactions#interactions-actions-components) event action, from a task with the [Run Scene v2 Action](scenes_v2__12_tasker_actions#tasker-actions-run-action) Tasker action, or from page JavaScript via `executeAction`.

| Action ID | Parameters | Result | Description |
| --- | --- | --- | --- |
| `reload` | - | - | Reloads the current page. |
| `stop_loading` | - | - | Stops the current load. |
| `go_back` | - | - | Navigates back in history. |
| `go_forward` | - | - | Navigates forward in history. |
| `clear_cache` | - | - | Clears the WebView cache. |
| `clear_history` | - | - | Clears the back/forward history. |
| `page_up` | - | - | Scrolls up by roughly one viewport. |
| `page_down` | - | - | Scrolls down by roughly one viewport. |
| `page_top` | - | - | Jumps to the top of the page. |
| `page_bottom` | - | - | Jumps to the bottom of the page. |
| `load_url` | `url` | - | Loads a new URL into this WebView. |
| `find` | `text` | `match_count` | Highlights matches of `text` on the page and returns how many were found. |
| `find_next` | - | - | Advances to the next match from the last `find`. |
| `zoom` | `percent` | - | Sets the page zoom level as a percentage (minimum 1). |

##### WebView Events

Add these from the Event Handling tab. Each event exposes output keys you can read as variables (e.g. `%url`, `%title`) inside the handler's actions.

| Event | Output keys | Fires when |
| --- | --- | --- |
| `page_loaded` | `url`, `title` | A page finishes loading. |
| `page_error` | `url`, `error_code`, `description` | A load fails. |
| `url_changed` | `url` | The current URL changes (navigation, redirect, history). |
| `console_message` | `message`, `level`, `line_number` | The page logs to the JavaScript console. |
| `progress_changed` | `progress` | Load progress updates (0-100). |
| `scroll_changed` | `scroll_x`, `scroll_y` | The page is scrolled. |

##### WebView States

States continuously write a live value into one or more Tasker variables via output-variable bindings (configured like other [component states](scenes_v2__05_general#general-states)). They keep the variable in sync without an explicit event handler.

| State | Output keys | Description |
| --- | --- | --- |
| `url` | `url` | The current page URL. Binding this also feeds the URL back into `content`. |
| `progress` | `progress` | Current load progress, 0-100. |
| `scroll` | `scroll_x`, `scroll_y` | Current scroll offset in pixels. |
| `headers` | `headers` | The HTTP response headers of the page loaded from a web address, as JSON: each header name (in lowercase) holds a list of its values, for example `{"content-type":["text/html; charset=utf-8"]}`. Only filled for pages loaded from the internet. |

#### Input Components

**Button** - A clickable Material 3 button. Its label isn't a property: the button has a `content` slot, and a new Button arrives with a Text child that holds the label. Edit that Text to change the label, or put anything else in the slot - an Image before the Text for an icon button, a Spacer between them for a gap, or any other component.

| Property | Default | Description |
| --- | --- | --- |
| `buttonColor` | `""` | Button fill color (hex or theme name). Empty uses the theme primary color. |
| `contentColor` | `""` | Color of the text and icons inside the button, unless a child sets its own color. Empty uses the theme color. |
| `enabled` | `true` | Whether the button can be pressed. See [Enabled](scenes_v2__05_general#general-enabled). |

| Slot | Accepts | Description |
| --- | --- | --- |
| `content` | Any component | The button's content, laid out in a row (required) |

**IconButton** - A Material 3 icon button with a 48dp touch target. Use it for clickable icons in toolbars and app bars - it gives a proper hit area and ripple feedback. Editor name: "Icon Button".

| Property | Default | Description |
| --- | --- | --- |
| `icon` | `""` | Image source for the icon, normally a Material icon (`icon:Settings`) or a [Material Symbol](scenes_v2__05_general#general-material-symbols) (`symbol:settings`). Also accepts any other [Image](scenes_v2__05_general#general-display-components) source, like a URL, a file or inline SVG. |
| `tint` | `""` | Icon color (hex or theme name). Empty inherits from the parent. |
| `contentScale` | `Fit` | Fit, Crop, FillBounds - applied when the icon source is a URL or SVG rather than a Material icon |
| `enabled` | `true` | Whether it reacts to the user. See [Enabled](scenes_v2__05_general#general-enabled). |

Tip: Use IconButton instead of a bare Image when you need a clickable icon - it provides the standard 48dp touch target and ripple feedback that users expect.

**Switch** - A toggle switch for on/off values.

| Property | Default | Description |
| --- | --- | --- |
| `checked` | `false` | Initial toggle state (`true` or `false`). Accepts a variable expression. |
| `checkedThumbColor`, `uncheckedThumbColor` | `""` | Color of the thumb (the sliding circle) while the switch is on / off. |
| `checkedTrackColor`, `uncheckedTrackColor` | `""` | Color of the track (the pill background) while the switch is on / off. |
| `checkedBorderColor`, `uncheckedBorderColor` | `""` | Color of the track outline while the switch is on / off. |
| `enabled` | `true` | Whether the switch can be toggled. See [Enabled](scenes_v2__05_general#general-enabled). |

All colors accept a hex value or a theme color name; leave them empty to use the theme colors.

| Slot | Accepts | Description |
| --- | --- | --- |
| `thumbIcon` | One component (optional) | Shown inside the thumb, for example an Image with an icon or a Material Symbol. Bind its `url` to the switch's variable to show a different icon when it's on and off. |

To react to the user toggling a Switch, add a [checked-changed event handler](scenes_v2__11_interactions#interactions), or bind its state to a variable so the value is written out automatically. A Switch can write its checked state to a variable continuously. Its `toggle` action flips it from a task or another component without you needing to know its current state, and returns the new state as `new_checked`.

**Checkbox** - A checkbox for on/off values. Same model as Switch.

| Property | Default | Description |
| --- | --- | --- |
| `checked` | `false` | Initial checked state (`true` or `false`). Accepts a variable expression. |
| `checkedColor` | `""` | Fill color of the box while checked. |
| `uncheckedColor` | `""` | Color of the box border while unchecked. |
| `checkmarkColor` | `""` | Color of the check mark inside the box. |
| `enabled` | `true` | Whether the checkbox can be toggled. See [Enabled](scenes_v2__05_general#general-enabled). |

Colors accept a hex value or a theme color name; leave them empty to use the theme colors. Like Switch, a Checkbox fires a checked-changed event, can sync its state to a variable, and supports the `toggle` action.

**TextInput** - A text field where users can type. Editor name: "Text Input".

TextInput works in every display mode, including [overlays](scenes_v2__15_overlay_features#overlay-features-text-input).

| Property | Default | Description |
| --- | --- | --- |
| `label` | `""` | Floating label shown above the field |
| `placeholder` | `""` | Placeholder text shown inside the empty field |
| `text` | `""` | Initial text value. Accepts a variable expression. |
| `textSize` | `14` | Font size in sp |
| `color` | `""` | Text color (hex or theme name) |
| `multiLine` | `false` | Allows the field to wrap to multiple lines |
| `autoFocus` | `false` | Focuses the field and shows the keyboard when the layout opens |
| `style` | `Outlined` | Outlined or Normal - the Material 3 field style |
| `borderColor` | `""` | Border color when not focused |
| `focusedBorderColor` | `""` | Border color when focused |
| `labelColor` | `""` | Color of the floating label |
| `placeholderColor` | `""` | Color of the placeholder text |
| `backgroundColor` | `""` | Field background color |
| `cursorColor` | `""` | Text cursor color |
| `shape` | `""` | Corner radius in dp. Empty uses the Material 3 default shape. |
| `textStyle` | *omitted* | Optional nested font object (`fontFamily` - a built-in name or an absolute path to a `.ttf`/`.otf` file - `fontWeight`, `fontStyle`) applied to the typed text and the placeholder. |
| `labelTextStyle` | *omitted* | The same font object, applied independently to the floating label. Only the font axes apply, so Material keeps control of the label's sizing. |
| `inputType` | *omitted* | What kind of keyboard to show and how it behaves - see below. Editor name: "Input Type". |
| `enabled` | `true` | Whether the field can be edited. See [Enabled](scenes_v2__05_general#general-enabled). |

The `inputType` object has these optional fields:

| Field | Default | Values |
| --- | --- | --- |
| `keyboardType` | `Text` | `Text` (standard), `Number` (digits), `Decimal` (digits and point), `Phone` (dial pad), `Email`, `Uri` (web address), `Password` (masked text), `NumberPassword` (masked digits, "PIN" in the editor) |
| `capitalization` | `None` | `None`, `Sentences`, `Words`, `Characters` (all caps). Text, Email and Uri keyboards only. |
| `autoCorrect` | `true` | Lets the keyboard suggest and correct words. Text, Email and Uri keyboards only. |
| `maskText` | `false` | Hides the typed characters, like a password field. |
| `imeAction` | `Default` | The keyboard's action key: `Default`, `Go`, `Search`, `Send`, `Next`, `Previous` or `Done`. Any of them triggers the Enter [Key Pressed](scenes_v2__11_interactions#interactions) event. |

```
"inputType": { "keyboardType": "Email", "imeAction": "Send" }
```

TextInput fires a text-changed event and a key-pressed event, can sync its text to a variable, and supports `focus` and `unfocus` actions.

**Slider** - A draggable slider for picking a single numeric value.

| Property | Default | Description |
| --- | --- | --- |
| `value` | `0` | Initial value. Accepts a variable expression. |
| `min` | `0` | Low end of the range |
| `max` | `1` | High end of the range |
| `steps` | `0` | Number of discrete stops between `min` and `max`. 0 means continuous. |
| `thumbColor` | `""` | Color of the draggable thumb |
| `activeTrackColor` | `""` | Color of the track up to the thumb |
| `inactiveTrackColor` | `""` | Color of the track past the thumb |
| `activeTickColor` | `""` | Color of step ticks on the active track |
| `inactiveTickColor` | `""` | Color of step ticks on the inactive track |
| `enabled` | `true` | Whether it reacts to the user. See [Enabled](scenes_v2__05_general#general-enabled). |

Slider fires a value-changed event and can sync its value (and a 0-1 percent) to variables.

Screenshot: A Switch on, a Switch off and a Slider with steps, each color property set to a different, labelled color

**RangeSlider** - A slider with two thumbs for picking a numeric range. Editor name: "Range Slider".

| Property | Default | Description |
| --- | --- | --- |
| `start` | `0` | Initial start value. Accepts a variable expression. |
| `end` | `1` | Initial end value. Accepts a variable expression. |
| `min` | `0` | Low end of the range |
| `max` | `1` | High end of the range |
| `steps` | `0` | Number of discrete stops. 0 means continuous. |
| `thumbColor` | `""` | Color of the draggable thumbs |
| `activeTrackColor` | `""` | Color of the track between the thumbs |
| `inactiveTrackColor` | `""` | Color of the track outside the thumbs |
| `activeTickColor` | `""` | Color of step ticks on the active track |
| `inactiveTickColor` | `""` | Color of step ticks on the inactive track |
| `enabled` | `true` | Whether it reacts to the user. See [Enabled](scenes_v2__05_general#general-enabled). |

RangeSlider fires a value-changed event and can sync its start, end, and percent values to variables.

**SegmentedButtonRow** - A row of connected segment buttons with built-in single- or multi-select management. Editor name: "Segmented Button Row".

| Property | Default | Description |
| --- | --- | --- |
| `selectionMode` | `Single` | Single (radio behavior) or Multi (checkbox behavior) |
| `selectedIndices` | *first segment* | Which segments start selected, as positions counting from 1: comma-separated (`1,3`) or a JSON array (`[1,3]`). In Single mode only the first is used. Out-of-range values snap to the nearest segment. Leave blank for none, but only in Multi mode or in Single mode with `allowDeselect` on; otherwise the first segment is selected. Accepts a variable. |
| `allowDeselect` | `false` | In Single mode, when `true` the user can tap the active segment to deselect it. Shown only when `selectionMode` is `Single`. |

| Slot | Accepts | Description |
| --- | --- | --- |
| `content` | Segment only | The individual segment buttons |

The row owns selection; Segment children have no "checked" property. SegmentedButtonRow fires a selection-changed event, can sync the selected indices to a variable, and supports a `toggleItem` action. Its `index` parameter (counting from 1) picks the segment, which is toggled exactly like a user tap, following `selectionMode` and `allowDeselect`. The action returns `selected`: `true` when the segment ends up selected.

**Segment** - A single segment inside a SegmentedButtonRow. Component type name `SegmentedButtonItem`; shown as "Segment" in the editor.

| Property | Default | Description |
| --- | --- | --- |
| `label` | `""` | Segment label text |
| `icon` | `""` | Optional Material icon for the segment |
| `textStyle` | *omitted* | Optional nested font object: `fontFamily` (a built-in name, or an absolute path to a `.ttf`/`.otf` file), `fontWeight`, `fontStyle`. Merged onto the Material segment label style. |
| `enabled` | `true` | Whether it reacts to the user. See [Enabled](scenes_v2__05_general#general-enabled). |

A Segment can only be placed inside a SegmentedButtonRow.

**Camera** - A live camera preview. Tasker needs the camera permission; without it the component shows an error message instead (see `showErrorMessage`). Several Camera components can show different lenses at the same time.

| Property | Default | Description |
| --- | --- | --- |
| `lens` | *unset* | Which lens to use, as `<facing>[:<tier>]`, in any capitalization. The facing is `front`, `back` or `external`. Leave the tier out for the main lens, or use `wide`, `wide2` and so on, or `tele`, `tele2` and so on, for the other lenses. `wide>` and `tele>` pick the widest and the most telephoto lens on the device. Examples: `front`, `back:wide`, `back:tele>`. Unset uses the first available lens. A lens the device doesn't have falls back to another one; the `ready` event reports the lens actually used. |
| `contentScale` | `Crop` | Fit, Crop, FillBounds |
| `showErrorMessage` | `true` | When `true`, shows a friendly message if the camera fails (permission denied, no camera, etc.) |

Camera supports a `switchLens` action, which takes no parameters and moves to the next available camera. It fires a `ready` event, whose `lens` output is the lens in use, and an `error` event. For a mirrored selfie view, add a [Scale modifier](scenes_v2__06_modifiers#modifiers) with `x` set to `-1`.

#### Media Components

**Video** - Plays a video file, an animated GIF, or an embedded YouTube clip. The engine is chosen automatically from the `source`, so a single component covers all three. Editor group: Media.

| Property | Editor label | Default | Description |
| --- | --- | --- | --- |
| `source` | Source | `""` | The media to play: a remote URL, a local file path, or a data URI. The primary property. See [Source Detection](scenes_v2__05_general#video-detection) for how the engine is picked. |
| `autoPlay` | Auto Play | `false` | Starts playback as soon as the media is ready. Accepts a variable expression. |
| `loop` | Loop | `false` | Restarts from the beginning when playback ends. |
| `muted` | Muted | `false` | Mutes audio output. |
| `volume` | Volume | `1.0` | Playback volume from `0.0` (silent) to `1.0` (full). |
| `speed` | Speed | `1.0` | Playback rate, from `0.25` (quarter speed) to `4.0` (4x). YouTube videos are limited to between `0.25` and `2`. |
| `contentScale` | Scale | `Fit` | Fit, Crop, FillBounds - how the frame fills the component bounds. |
| `videoAspectRatio` | Aspect Ratio (YouTube Crop/Fit) | `""` | The shape of a YouTube video, like `16:9` or `9:16`, so Scale can fit or crop it correctly. Leave blank for regular videos and GIFs. |
| `positionFormat` | Position Format | `HH:mm:ss` | Pattern for the `positionFormatted` [state](scenes_v2__05_general#general-states). Tokens: `HH`/`H` hours, `mm`/`m` minutes, `ss`/`s` seconds (double letters pad to two digits), `SSS` milliseconds; any other character (like `:`) is shown as-is. The largest unit isn't capped: with `mm:ss`, `64:32` means 64 minutes. |

##### Source Detection

- **YouTube** - A `youtube.com` or `youtu.be` URL (including `watch`, `embed`, `shorts`, and `youtu.be` short links) is detected definitively and played in an embedded YouTube player.
- **GIF** - A source whose path ends in `.gif` is played as an animated GIF.
- **Video** - Anything else is played as a video file.

GIF and video detection is heuristic with an automatic fallback: if the chosen engine fails, the component silently retries with the other one before giving up and firing the `error` event. YouTube detection is definitive and has no fallback.

##### Video Actions

| Action ID | Parameters | Result | Description |
| --- | --- | --- | --- |
| `play` | - | - | Starts or resumes playback. |
| `pause` | - | - | Pauses playback. |
| `togglePlayback` | - | `is_playing` | Toggles between play and pause; returns the resulting state. |
| `seek` | `position` | - | Jumps to `position` milliseconds. Ignored for GIFs. |

##### Video Events

| Event | Output keys | Fires when |
| --- | --- | --- |
| `loaded` | `duration` | The media is ready; `duration` is in milliseconds (0 for GIFs). |
| `ended` | - | Playback reaches the end. |
| `error` | `code`, `message` | Playback fails after fallback is exhausted. |
| `buffering` | `is_buffering` | The buffering state changes. |

Note: GIF playback has limits. `seek`, `speed`, `volume`, and `muted` are silently ignored, and `play`/`pause`/`togglePlayback` require Android 9+ (older devices animate automatically and cannot be paused).

### Common Properties

Every component, regardless of type, carries the same set of shared properties:

- **id** - Unique identifier within the layout (auto-generated, editable). See [Component IDs](scenes_v2__05_general#general-ids).
- **modifiers** - The list of styling modifiers applied to the component. See [Modifiers](scenes_v2__06_modifiers#modifiers).
- **showWhen** - Conditional visibility expression. See [The showWhen Property](scenes_v2__05_general#general-show-when) and [Conditional Visibility](scenes_v2__10_show_when#show-when).
- **showWhenMode** - What happens when `showWhen` is false: `Gone` (reclaim the space, the default) or `Invisible` (keep the space, hide the content).
- **visibilityTransition** - An optional animation played when `showWhen` shows or hides the component. See [Show and Hide Animations](scenes_v2__10_show_when#show-when-animations).
- **eventHandlers** - The component's event handlers (click, hold, value changed, etc.) and the actions they run. Edited from the Event Handling tab. See [Event Handlers & Actions](scenes_v2__11_interactions#interactions).
- **contentTransition** - An optional animation a container plays when its children are shown or hidden. See [Content Transition](scenes_v2__05_general#general-content-transition).
- **treeLabel** - An optional friendly name shown for the component in the editor's element tree. When unset, the tree falls back to the component's content or its `id`.

#### Enabled

Components people interact with - Button, IconButton, FloatingActionButton, Card, Image, Text, Switch, Checkbox, Slider, RangeSlider, TextInput, Dropdown, NavigationItem and Segment - also have an **enabled** property (the **Enabled** field in the Settings tab). A disabled component looks dimmed and ignores taps, long-presses and swipes, so its event handlers don't fire.

Like `showWhen`, `enabled` accepts a variable or a full [condition](scenes_v2__10_show_when#show-when), such as `%name != ""` to only enable a Save button once a name is typed. It accepts `true`/`false`, `on`/`off`, `yes`/`no` and `1`/`0` in any capitalization. Anything else, including a variable that isn't set, leaves the component enabled.

#### Content Transition

A container's `contentTransition` animates the change when one of its direct children appears or disappears. It plays only when the `showWhen` result of a direct child changes; a variable that changes a child's text or another value doesn't trigger it. Configure it from the editor's [Animation tab](scenes_v2__03_editor_overview#editor-overview-animation).

Only these components play a content transition: Column, Row, Box, Card, Button, FlexBox, FlowRow and FlowColumn. Other components ignore the field.

```
{ "type": "Column", "id": "steps",
  "contentTransition": { "type": "Crossfade", "durationMs": "500" },
  "children": [
    { "type": "Text", "id": "stepOne", "text": "Step 1", "showWhen": "%step == \"1\"" },
    { "type": "Text", "id": "stepTwo", "text": "Step 2", "showWhen": "%step == \"2\"" }
  ] }
```

Every transition type has these settings:

| Setting | Description |
| --- | --- |
| `durationMs` | Length of the animation in milliseconds. The default depends on the type. |
| `easing` | Linear, EaseIn, EaseOut, EaseInOut, Overshoot or Bounce. Default `EaseInOut`. |
| `contentAlignment` | Where the content sits inside the container while its size animates: TopStart, TopCenter, TopEnd, CenterStart, Center, CenterEnd, BottomStart, BottomCenter or BottomEnd. The default depends on the type. |

Three transition types are available:

| Type | Defaults | Own settings | Description |
| --- | --- | --- | --- |
| `Crossfade` | `durationMs` `300`, `contentAlignment` `TopStart` | `clip` (default `true`) - clips the content while the container resizes | The old content fades out as the new content fades in. |
| `CardFlip` | `durationMs` `600`, `contentAlignment` `Center` | `flipType` - `Horizontal` (default, turns around the vertical axis) or `Vertical` | A 3D flip reveals the new content, as if turning a card. On a Card, the whole card flips, not just its content. |
| `Blur` | `durationMs` `400`, `contentAlignment` `Center` | `blurRadius` (default `20`, in dp), `sequential` (default `false`; when `true`, the old content blurs out completely before the new content blurs in), `blurOrigin` (one of the 9 alignments above, default `Center`; Center blurs evenly, the other positions stretch the blur along one axis or both) | The old content blurs out as the new content comes into focus. Needs Android 12 or later: on older versions Blur isn't offered in the editor, and an existing Blur plays a plain 300ms fade instead. |

Direct children of a container with a content transition don't play their own [show and hide animations](scenes_v2__10_show_when#show-when-animations): the container's transition animates them instead.

Content transitions are optional. A container with no `contentTransition` simply shows and hides its children with no animation.

### Component States

Many components have **states**: live values like a Switch's checked value, the text in a Text Input or a video's position. On the **State** tab you bind a state's output keys to variable names (without the `%`). The component then keeps those variables up to date by itself, with no event handler needed, and the values are returned to the task when the scene closes. If more than one component binds the same variable, the variable becomes a Tasker array with one element per component.

Binding works both ways: a component reads its current value from the bound variable, so setting that variable (from an event action, another component or a task) changes the component too. For example, a Switch and a Checkbox bound to the same `wifi_on` variable always show the same state.

| Component | State | Output keys | Description |
| --- | --- | --- | --- |
| Switch, Checkbox | Checked | `checked` | `true` or `false` |
| TextInput | Text | `text` | The text in the field, updated as the user types |
| Slider | Slider Value | `value`, `percent` | The current value, and where it sits between min and max as a fraction from `0` to `1` (`0.5` = halfway) |
| RangeSlider | Range Slider Value | `start`, `end`, `start_percent`, `end_percent` | Both ends of the range, as values and as fractions from `0` to `1` |
| Dropdown | Selection | `selected_index` | Which item is selected, counting from 1 |
| Dropdown | Expanded | `expanded` | Whether the menu is open |
| NavigationBar | Selection | `selected_index` | Which item is selected, counting from 1 |
| SegmentedButtonRow | Selection | `selected_indices` | The selected segments, counting from 1 (an array when several can be selected) |
| ProgressBar | Progress | `progress` | The value the bar settles on |
| ProgressBar | Displayed Progress | `displayed_progress` | The value the bar is showing right now, including while it animates. Bind a Text to it to show an animated counter. |
| Video | Playing | `playing` | Whether the video is playing |
| Video | Position | `position` | The playback position in milliseconds |
| Video | Position (Formatted) | `position_formatted` | The playback position as text, using the Video's `positionFormat` |
| WebView | URL, Progress, Scroll, Headers | see [WebView States](scenes_v2__05_general#webview-states) |  |

In JSON, each state is stored on the component under its name followed by `State` (`checkedState`, `textState`, `sliderValueState`, `rangeSliderValueState`, `selectionState`, `expandedState`, `progressState`, `displayedProgressState`, `playingState`, `positionState`, `positionFormattedState`, `urlState`, `scrollState`, `headersState`), mapping each output key to a list of variable names:

```
{ "type": "Switch", "id": "wifiSwitch",
  "checkedState": { "outputVariableBindings": { "checked": ["wifi_on"] } } }
```

Indexes are 1-based everywhere in Scenes V2, like Tasker arrays: the first item is `1`. That applies to state values, to properties like `selectedIndex`, and to event outputs and component actions that take or return an index.
