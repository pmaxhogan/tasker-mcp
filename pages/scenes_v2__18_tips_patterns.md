# Tasker Scenes V2 Manual: Tips & Patterns

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#tips-patterns

Section 18 of [Tasker Scenes V2 Manual](scenes_v2) (Advanced).

Common layout recipes and best practices to help you build faster.

### Common Layout Patterns

**App screen with Scaffold** - The recommended starting point for full-screen layouts. Scaffold provides a top bar, bottom bar, FAB, and content area that automatically avoids overlapping the bars. The four areas are named slots: `topBar`, `bottomBar`, `floatingActionButton`, and `content` (required). Each slot is an array that normally holds a single element (the FAB slot accepts at most one):

```
{
  "root": {
    "type": "Scaffold", "id": "root",
    "topBar": [{
      "type": "TopAppBar", "id": "top_bar",
      "title": [{ "type": "Text", "id": "title", "text": "My App", "textSize": "22" }],
      "navigationIcon": [{
        "type": "IconButton", "id": "nav_icon", "icon": "icon:Menu"
      }],
      "actions": [{
        "type": "IconButton", "id": "settings_icon", "icon": "icon:Settings"
      }]
    }],
    "floatingActionButton": [{
      "type": "FloatingActionButton", "id": "fab",
      "content": [{
        "type": "Image", "id": "fab_icon", "url": "icon:Add",
        "modifiers": [{ "type": "Size", "width": "24", "height": "24" }]
      }]
    }],
    "content": [{
      "type": "Column", "id": "body",
      "verticalArrangement": "SpaceBetween",
      "modifiers": [{ "type": "FillSize" }, { "type": "VerticalScroll" }, { "type": "Padding", "all": "16" }],
      "children": [
        { "type": "Text", "id": "content", "text": "Your content goes here..." }
      ]
    }]
  }
}
```

**Scaffold with bottom bar** - A full app layout with a top bar, a bottom bar holding navigation icons, and a FAB. The bottom bar's `content` slot is a Row, so weighting each IconButton spreads them evenly:

```
{
  "root": {
    "type": "Scaffold", "id": "root",
    "topBar": [{
      "type": "TopAppBar", "id": "top_bar",
      "title": [{ "type": "Text", "id": "title", "text": "Dashboard", "textSize": "22" }],
      "navigationIcon": [{ "type": "IconButton", "id": "nav_icon", "icon": "icon:Menu" }]
    }],
    "bottomBar": [{
      "type": "BottomAppBar", "id": "bottom_bar",
      "content": [
        { "type": "IconButton", "id": "nav_home", "icon": "icon:Home", "modifiers": [{ "type": "Weight", "amount": "1" }] },
        { "type": "IconButton", "id": "nav_search", "icon": "icon:Search", "modifiers": [{ "type": "Weight", "amount": "1" }] },
        { "type": "IconButton", "id": "nav_profile", "icon": "icon:Person", "modifiers": [{ "type": "Weight", "amount": "1" }] }
      ]
    }],
    "floatingActionButton": [{
      "type": "FloatingActionButton", "id": "fab",
      "content": [{
        "type": "Image", "id": "fab_icon", "url": "icon:Add",
        "modifiers": [{ "type": "Size", "width": "24", "height": "24" }]
      }]
    }],
    "content": [{
      "type": "Column", "id": "body",
      "modifiers": [{ "type": "FillSize" }, { "type": "VerticalScroll" }, { "type": "Padding", "all": "16" }],
      "children": [
        { "type": "Text", "id": "welcome", "text": "Welcome back!", "textSize": "24" },
        { "type": "Text", "id": "subtitle", "text": "Here's what's happening today", "textSize": "14", "color": "onSurfaceVariant" }
      ]
    }]
  }
}
```

**Card** - The Card component is a rounded, elevated container. Its children go in a `"children"` array. Use the `"style"` property to pick `"Filled"`, `"Elevated"`, or `"Outlined"`:

```
{
  "root": {
    "type": "Card", "id": "card", "style": "Elevated",
    "modifiers": [{ "type": "FillWidth" }, { "type": "Padding", "all": "16" }],
    "children": [
      { "type": "Text", "id": "card_title", "text": "Card Title", "textSize": "22" },
      { "type": "Spacer", "id": "card_gap", "height": "8" },
      { "type": "Text", "id": "card_body", "text": "Card content goes here.", "color": "onSurfaceVariant" }
    ]
  }
}
```

You can also build a card-like container by hand with a Column - useful when you want a specific background color:

```
{
  "root": {
    "type": "Column", "id": "panel",
    "modifiers": [
      { "type": "FillWidth" },
      { "type": "Clip", "shape": "Rounded", "radius": "16" },
      { "type": "Background", "color": "surfaceContainer" },
      { "type": "Padding", "all": "16" }
    ],
    "children": [
      { "type": "Text", "id": "panel_title", "text": "Panel Title", "textSize": "22" },
      { "type": "Text", "id": "panel_body", "text": "Panel content goes here.", "color": "onSurfaceVariant" }
    ]
  }
}
```

Screenshot: A hand-built card: a full-width Column with rounded corners on a surfaceContainer background

**Settings panel** - Labeled rows with switches, ideal for quick-settings overlays. Each Switch binds its Checked [state](scenes_v2__05_general#general-states) to a variable (`%wifi_on`, `%bt_on`), so the variable always holds `true` or `false` and is returned to the task when the screen closes. Setting the variable also flips the switch:

```
{
  "root": {
    "type": "Column", "id": "root",
    "modifiers": [{ "type": "FillSize" }, { "type": "Padding", "all": "16" }],
    "children": [
      { "type": "Text", "id": "heading", "text": "Settings", "textSize": "24" },
      { "type": "Spacer", "id": "gap", "height": "16" },
      {
        "type": "Row", "id": "wifi_row", "verticalAlignment": "Center",
        "horizontalArrangement": "SpaceBetween",
        "modifiers": [{ "type": "FillWidth" }, { "type": "Padding", "vertical": "8" }],
        "children": [
          { "type": "Text", "id": "wifi_label", "text": "Wi-Fi", "textSize": "16" },
          {
            "type": "Switch", "id": "wifi_switch", "checked": "true",
            "checkedState": { "outputVariableBindings": { "checked": ["wifi_on"] } }
          }
        ]
      },
      { "type": "Divider", "id": "div1" },
      {
        "type": "Row", "id": "bt_row", "verticalAlignment": "Center",
        "horizontalArrangement": "SpaceBetween",
        "modifiers": [{ "type": "FillWidth" }, { "type": "Padding", "vertical": "8" }],
        "children": [
          { "type": "Text", "id": "bt_label", "text": "Bluetooth", "textSize": "16" },
          {
            "type": "Switch", "id": "bt_switch", "checked": "false",
            "checkedState": { "outputVariableBindings": { "checked": ["bt_on"] } }
          }
        ]
      }
    ]
  }
}
```

Screenshot: A Settings heading above Wi-Fi (on) and Bluetooth (off) rows with switches, separated by a divider

**Grid layout** - Equal-width columns using Weight. Weight only works on the direct children of a Row or Column:

```
{
  "root": {
    "type": "Column", "id": "grid",
    "modifiers": [{ "type": "Padding", "all": "16" }],
    "verticalArrangement": "SpaceBetween",
    "children": [
      {
        "type": "Row", "id": "row1", "horizontalArrangement": "SpaceBetween",
        "children": [
          { "type": "Text", "id": "c1", "text": "Cell 1", "modifiers": [{ "type": "Weight", "amount": "1" }] },
          { "type": "Text", "id": "c2", "text": "Cell 2", "modifiers": [{ "type": "Weight", "amount": "1" }] }
        ]
      },
      {
        "type": "Row", "id": "row2", "horizontalArrangement": "SpaceBetween",
        "children": [
          { "type": "Text", "id": "c3", "text": "Cell 3", "modifiers": [{ "type": "Weight", "amount": "1" }] },
          { "type": "Text", "id": "c4", "text": "Cell 4", "modifiers": [{ "type": "Weight", "amount": "1" }] }
        ]
      }
    ]
  }
}
```

**Centered content** - Vertically and horizontally centered:

```
{
  "root": {
    "type": "Box", "id": "center_box",
    "contentAlignment": "Center",
    "modifiers": [{ "type": "FillSize" }],
    "children": [
      { "type": "Text", "id": "hello", "text": "Hello, World!", "textSize": "24" }
    ]
  }
}
```

**Data-driven list** - Use a Variable component as a slot for dynamic content from Tasker. The `key` names a Tasker variable holding component JSON:

```
{
  "root": {
    "type": "Scaffold", "id": "root",
    "topBar": [{
      "type": "TopAppBar", "id": "top_bar",
      "title": [{ "type": "Text", "id": "title", "text": "Dashboard", "textSize": "22" }],
      "navigationIcon": [{ "type": "IconButton", "id": "nav_icon", "icon": "icon:Menu" }]
    }],
    "content": [{
      "type": "Column", "id": "body",
      "modifiers": [{ "type": "FillSize" }, { "type": "VerticalScroll" }, { "type": "Padding", "all": "16" }],
      "children": [
        { "type": "Variable", "id": "items", "key": "%dashboard_content" }
      ]
    }]
  }
}
```

**Conditional content** - Show different content based on state. Use the [Test Variables](scenes_v2__03_editor_overview#editor-overview-test-variables) panel (flask icon) to set `%is_logged_in` to `true` or `false` and see the result in the preview:

```
{
  "root": {
    "type": "Column", "id": "root",
    "modifiers": [{ "type": "FillSize" }, { "type": "Padding", "all": "16" }],
    "horizontalAlignment": "Center",
    "verticalArrangement": "Center",
    "children": [
      {
        "type": "Text", "id": "welcome",
        "text": "Welcome back!",
        "textSize": "24",
        "showWhen": "%is_logged_in"
      },
      {
        "type": "Button", "id": "login_btn",
        "showWhen": "!%is_logged_in",
        "content": [ { "type": "Text", "id": "login_btn_text", "text": "Log In" } ]
      }
    ]
  }
}
```

**Image background with text** - A full-screen photo with a dark scrim and centered white text. The trick is using a Box to stack the image, scrim, and text on top of each other:

```
{
  "root": {
    "type": "Box", "id": "hero",
    "contentAlignment": "Center",
    "modifiers": [{ "type": "FillSize" }],
    "children": [
      {
        "type": "Image", "id": "bg_photo",
        "url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1080&q=80",
        "contentScale": "Crop",
        "modifiers": [{ "type": "FillSize" }]
      },
      {
        "type": "Spacer", "id": "scrim",
        "modifiers": [
          { "type": "FillSize" },
          { "type": "Background", "color": "#55000000" }
        ]
      },
      {
        "type": "Column", "id": "text_overlay",
        "horizontalAlignment": "Center",
        "modifiers": [{ "type": "Padding", "all": "20" }],
        "children": [
          { "type": "Text", "id": "heading", "text": "Mountain Peaks", "textSize": "28", "color": "#FFFFFFFF" },
          { "type": "Spacer", "id": "gap", "height": "4" },
          { "type": "Text", "id": "subtitle", "text": "Explore the world's most breathtaking views", "textSize": "14", "color": "#CCFFFFFF" }
        ]
      }
    ]
  }
}
```

Screenshot: A full-screen mountain photo under a dark scrim, with a centered white title and subtitle

**Compact overlay** - A small floating panel for overlay mode. The close button is an IconButton with an `eventHandlers` block: a `click` event runs a `DismissLayout` action that closes the overlay. (The old `Clickable` modifier no longer exists - tap-to-dismiss is now done with an event handler.)

```
{
  "root": {
    "type": "Column", "id": "root",
    "modifiers": [
      { "type": "Clip", "shape": "Rounded", "radius": "16" },
      { "type": "Background", "color": "surfaceContainer" },
      { "type": "Padding", "all": "16" }
    ],
    "children": [
      {
        "type": "Row", "id": "header",
        "horizontalArrangement": "SpaceBetween", "verticalAlignment": "Center",
        "modifiers": [{ "type": "FillWidth" }],
        "children": [
          { "type": "Text", "id": "title", "text": "Now Playing", "textSize": "16" },
          {
            "type": "IconButton", "id": "close", "icon": "icon:Close",
            "eventHandlers": { "handlers": [
              { "events": [{ "type": "click" }],
                "actions": [{ "type": "DismissLayout" }] }
            ] }
          }
        ]
      },
      { "type": "Spacer", "id": "gap", "height": "8" },
      { "type": "Text", "id": "track", "text": "%track_name", "color": "onSurfaceVariant" },
      { "type": "Spacer", "id": "gap2", "height": "12" },
      {
        "type": "Row", "id": "controls", "horizontalArrangement": "SpaceEvenly",
        "modifiers": [{ "type": "FillWidth" }],
        "children": [
          { "type": "IconButton", "id": "prev", "icon": "icon:SkipPrevious" },
          { "type": "IconButton", "id": "play", "icon": "icon:PlayArrow" },
          { "type": "IconButton", "id": "next", "icon": "icon:SkipNext" }
        ]
      }
    ]
  }
}
```

Screenshot: The compact Now Playing overlay with a track name filled in, a close button, and playback controls

**Table layout** - A Column with multiple Rows forms a table. Each cell uses Weight to share space equally across the row:

```
{
  "root": {
    "type": "Column", "id": "table",
    "modifiers": [{ "type": "FillWidth" }, { "type": "Padding", "all": "16" }],
    "children": [
      {
        "type": "Row", "id": "header_row",
        "modifiers": [
          { "type": "FillWidth" },
          { "type": "Background", "color": "primaryContainer" },
          { "type": "Padding", "all": "12" }
        ],
        "children": [
          { "type": "Text", "id": "h1", "text": "Name", "color": "onPrimaryContainer", "modifiers": [{ "type": "Weight", "amount": "1" }] },
          { "type": "Text", "id": "h2", "text": "Role", "color": "onPrimaryContainer", "modifiers": [{ "type": "Weight", "amount": "1" }] },
          { "type": "Text", "id": "h3", "text": "Status", "color": "onPrimaryContainer", "modifiers": [{ "type": "Weight", "amount": "1" }] }
        ]
      },
      { "type": "Divider", "id": "div1" },
      {
        "type": "Row", "id": "row1",
        "modifiers": [{ "type": "FillWidth" }, { "type": "Padding", "all": "12" }],
        "children": [
          { "type": "Text", "id": "r1c1", "text": "Alice", "modifiers": [{ "type": "Weight", "amount": "1" }] },
          { "type": "Text", "id": "r1c2", "text": "Engineer", "modifiers": [{ "type": "Weight", "amount": "1" }] },
          { "type": "Text", "id": "r1c3", "text": "Active", "modifiers": [{ "type": "Weight", "amount": "1" }] }
        ]
      },
      { "type": "Divider", "id": "div2" },
      {
        "type": "Row", "id": "row2",
        "modifiers": [{ "type": "FillWidth" }, { "type": "Padding", "all": "12" }],
        "children": [
          { "type": "Text", "id": "r2c1", "text": "Bob", "modifiers": [{ "type": "Weight", "amount": "1" }] },
          { "type": "Text", "id": "r2c2", "text": "Designer", "modifiers": [{ "type": "Weight", "amount": "1" }] },
          { "type": "Text", "id": "r2c3", "text": "Away", "modifiers": [{ "type": "Weight", "amount": "1" }] }
        ]
      }
    ]
  }
}
```

### Best Practices

- **Start with Scaffold for full screens** - Scaffold gives you a top bar, bottom bar, FAB, and content area out of the box. For simpler layouts or overlays, a plain Column works fine.
- **Skip specifying colors** - Layouts use Material You colors by default, automatically adapting to light/dark mode and the user's device theme. Only set colors when you want something custom.
- **Use IconButton for clickable icons** - IconButton gives you a proper 48dp touch target and ripple effect. Use Image only when you need a non-interactive icon or want precise size control.
- **Make things interactive with event handlers** - To react to a tap, give a component an `eventHandlers` block with a `click` event and one or more actions (`SetVariable`, `DismissLayout`, and others). See [Interactions](scenes_v2__11_interactions#interactions) for the full list.
- **Prefer [Weight](scenes_v2__06_modifiers#modifiers) over fixed sizes** - Weight-based sizing adapts to different screen sizes. Fixed pixel sizes look right on one device but wrong on another.
- **Keep the tree shallow** - Deeply nested layouts are harder to understand and maintain. If your tree is 6+ levels deep, consider whether you can simplify.
- **Name your components** - Give meaningful IDs to components you'll reference in [interactions](scenes_v2__11_interactions#interactions) (like "confirm_button" or "email_input"). Auto-generated IDs are hard to work with.
- **Use Spacer for flexible gaps** - A Spacer with Weight pushes content apart. Put one between a title and a button in a Row to push the button to the far right.
- **Use [provides](scenes_v2__08_provides#provides) for shared data** - Instead of hardcoding the same color or text in multiple places, put it in provides and reference it with [`@{key}`](scenes_v2__08_provides#provides-reference-syntax). Change it once, change it everywhere.
- **Use [showWhen](scenes_v2__10_show_when#show-when) for conditional UI** - Instead of building separate layouts for different states, use one layout with `showWhen` expressions to show/hide sections based on data.
- **Bind states to get values back** - To know what the user picked or typed, bind the component's [state](scenes_v2__05_general#general-states) to a variable on the State tab instead of wiring an event handler. The variable stays up to date and is returned to the task when the screen closes.
- **Build lists from arrays** - Use an [Arrays Merge Template](scenes_v2__05_general#general-layout-components) to repeat one row design for every item in your Tasker arrays, instead of building rows by hand.
