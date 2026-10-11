# Tasker Screen Builder Manual: Screen Properties

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#screen-properties

Section 13 of [Tasker Screen Builder Manual](scenes_v2) (Display & Overlays).

When no component is selected in the editor, the Settings tab shows screen-level settings that apply to the entire layout. They are stored as top-level fields in the layout JSON.

### General

- **Name** - An optional name for the screen. It appears in the editor title bar and in the Tasker action picker when choosing which layout to show. If left empty, it falls back to the file name, then to "Screen". Stored as `name`. If you opened the layout from a Tasker action, the name field may be locked to prevent renames that would break the reference in the action.
- **Description** - An optional free-text description of the screen. Stored as `description`.
- **Default Display Mode** - The [display mode](scenes_v2__14_display_modes#display-modes) the **Show Scene v2** action uses when its Display Mode argument is left empty. Stored as `defaultDisplayMode`. Options match the action's display modes: `Fullscreen`, `FullscreenWithResult`, `Dialog`, `DialogWithResult`, `Overlay`, `OverlayWithResult`, `AccessibilityOverlay`, `AccessibilityOverlayWithResult`, `Dream`. This lets a scene carry its own display mode so the action does not have to specify one.

When the default display mode is an overlay mode, the General section also shows default overlay geometry. These let the scene carry its own overlay defaults so the **Show Scene v2** action can leave the overlay arguments blank:

- **Default Overlay X** / **Default Overlay Y** - Default position. Stored as `defaultOverlayX` / `defaultOverlayY`. Same units as the action arguments - see [Overlay Features](scenes_v2__15_overlay_features#overlay-features).
- **Default Overlay Width** / **Default Overlay Height** - Default size. Stored as `defaultOverlayWidth` / `defaultOverlayHeight`. Leave empty to wrap content.
- **Default Overlay Blocking** - Whether the overlay blocks touches by default. Stored as `defaultOverlayBlocking`.
- **Default Overlay Animation** - Default show/dismiss animation. Stored as `defaultOverlayAnimation`. One of `Fade`, `Slide`, `Zoom`, `Bounce`.

### Scaling

The **Reference Width (dp)** field sets the screen width your layout is designed for, enabling proportional `pr`-suffixed dimensions. Stored as `referenceDp`. See [Proportional Scaling](scenes_v2__19_proportional_scaling#proportional-scaling) for the full explanation.

### Provides

Screen-level provides - key-value pairs available to the entire component tree. Stored as `provides`. This is the top of the scope chain: every component in the layout can reference these values with `@{key}`. See [Provides System](scenes_v2__08_provides#provides) for a thorough explanation of scoping, shadowing, and transitive resolution.

Screen-level provides are the natural place to put data that Tasker injects into the layout. When Tasker shows a layout, it can set provides values that the layout then renders. This keeps the layout generic - the same layout can display different data each time it's shown.

### Display

- **Keep Screen On** - When `true`, the device screen stays on while the layout is displayed. Stored as `keepScreenOn`. Defaults to `false`.

### System Bars

Control the appearance of the Android status bar (top of screen, shows clock/battery/notifications) and navigation bar (bottom of screen, shows back/home/recent buttons) when showing the layout as a fullscreen activity or dialog.

| Property | Default | Description |
| --- | --- | --- |
| `statusBarColor` | unset | Background color of the status bar. Accepts hex (`#RRGGBB`, `#AARRGGBB`) or theme names (`surface`, `primary`, etc.). When unset, Android uses its default. Supports `@{key}` provides references. |
| `navigationBarColor` | unset | Background color of the navigation bar. Same formats as status bar color. |
| `isLightStatusBars` | unset | When `true`, the status bar icons and text are drawn in dark colors. Use this when your status bar color is light (e.g., white or a light theme color) so the icons remain visible. When `false`, icons are white (for dark backgrounds). |
| `isLightNavigationBars` | unset | Same as above but for the navigation bar buttons. Set to `true` when the nav bar background is light. |
| `hideSystemBars` | `false` | When `true`, both bars are hidden entirely and your layout takes up the full screen edge-to-edge (immersive mode). The bars reappear temporarily if the user swipes from the edge. This is useful for media players, games, or any layout that benefits from maximum screen space. |

A common pattern is to match the status bar to your header background:

```
{
  "statusBarColor": "primary",
  "isLightStatusBars": "false",
  "navigationBarColor": "surface",
  "isLightNavigationBars": "true",
  "root": {
    "type": "Column", "id": "root",
    "children": [
      {
"type": "Row", "id": "header",
"modifiers": [
  { "type": "FillWidth" },
  { "type": "Background", "color": "primary" },
  { "type": "Padding", "all": "16" }
],
"children": [
  { "type": "Text", "id": "title", "text": "My App", "color": "onPrimary" }
]
      }
    ]
  }
}
```

Note: System bar settings only apply to [Fullscreen and Dialog](scenes_v2__14_display_modes#display-modes) display modes. [Overlays](scenes_v2__15_overlay_features#overlay-features) float above other apps and don't have their own system bars - the bars belong to whatever app is behind the overlay.

### Other Stored Fields

The layout JSON carries a few more screen-level fields that are not edited in the Settings tab. They are managed by other parts of the editor and persisted with the layout:

- `pinnedTestVariableEntries` - Test variables (name, value, enabled) used to preview the layout with sample data. The older `pinnedTestVariables` key is read for backward compatibility.
- `resolveVariablesInPreview` - Whether `%variables` are resolved in the editor preview. Defaults to `true`.
- `eventHandlers` - Screen-level event handlers, the layout-wide counterpart to per-component handlers on the Event Handling tab.
