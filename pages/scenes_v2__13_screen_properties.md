# Tasker Scenes V2 Manual: Screen Properties

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#screen-properties

Section 13 of [Tasker Scenes V2 Manual](scenes_v2) (Display & Overlays).

When no component is selected in the editor, the Settings tab shows screen-level settings that apply to the entire layout. They are stored as top-level fields in the layout JSON.

### General

- **Name** - An optional name for the screen. It appears in the editor title bar and in the Tasker action picker when choosing which layout to show. If left empty, it falls back to the file name, then to "Screen". Stored as `name`. If you opened the layout from a Tasker action, the name field may be locked to prevent renames that would break the reference in the action.
- **Description** - An optional free-text description of the screen. Stored as `description`.
- **Default Display Mode** - The [display mode](scenes_v2__14_display_modes#display-modes) the **Show Scene v2** action uses when its Display Mode argument is left empty. Stored as `defaultDisplayMode`. Options match the action's display modes: `Fullscreen`, `FullscreenWithResult`, `Dialog`, `DialogWithResult`, `Overlay`, `OverlayWithResult`, `AccessibilityOverlay`, `AccessibilityOverlayWithResult`, `Dream`. This lets a scene carry its own display mode so the action does not have to specify one.

When the default display mode is an overlay mode, the General section also shows default overlay geometry. These let the scene carry its own overlay settings. They are used when the **Show Scene v2** action's Display Mode is left empty; in that case the action's own overlay arguments are ignored:

- **Default Overlay X** / **Default Overlay Y** - Default position. Stored as `defaultOverlayX` / `defaultOverlayY`. Same units as the action arguments (dp, or `%`, with a leading `-` to measure from the right or bottom edge) - see [Overlay Features](scenes_v2__15_overlay_features#overlay-features). Empty means `0`.
- **Default Overlay Width** / **Default Overlay Height** - Default size. Stored as `defaultOverlayWidth` / `defaultOverlayHeight`. Leave empty to wrap content.
- **Default Overlay Blocking** - Whether the overlay blocks touches by default. Stored as `defaultOverlayBlocking`. If it isn't set, the overlay doesn't block touches.
- **Default Overlay Animation** - Default show/dismiss animation. Stored as `defaultOverlayAnimation`. One of `Fade`, `Slide`, `Zoom`, `Bounce`.

Each of these fields takes a single value. Unlike the action arguments, they don't accept a `portrait,landscape` pair: a value with a comma is read as `0`. When you pick an overlay mode as the default display mode, the editor fills any empty fields with X `50%`, Y `50%`, Width `50%`, Height `200`, Blocking on and the `Zoom` animation. Switching to a mode that isn't an overlay clears them.

### Scaling

The **Reference Width (dp)** field sets the screen width your layout is designed for, enabling proportional `pr`-suffixed dimensions. Stored as `referenceDp`. See [Proportional Scaling](scenes_v2__19_proportional_scaling#proportional-scaling) for the full explanation.

### Provides

Screen-level provides - key-value pairs available to the entire component tree. Stored as `provides`. This is the top of the scope chain: every component in the layout can reference these values with [`@{key}`](scenes_v2__08_provides#provides-reference-syntax). See [Provides System](scenes_v2__08_provides#provides) for a thorough explanation of scoping, shadowing, and transitive resolution.

[Screen-level provides](scenes_v2__08_provides#screen_provides) are a good place for values you reuse all over the screen, like accent colors or sizes, so a single edit restyles everything. A provides value can also hold a Tasker variable (for example `"title": "%title"`), which keeps the layout generic: each component uses [`@{title}`](scenes_v2__08_provides#provides-reference-syntax), and the task that shows the scene decides what it says.

### Display

- **Keep Screen On** - When `true`, the device screen stays on while the layout is displayed. Stored as `keepScreenOn`. Defaults to `false`.
- **Show Unset Variables as Empty** - When `true`, a variable that has no value shows as empty text instead of its name (such as `%name`), both when the scene runs and in the editor's interactive mode; while you edit, variables that have no value still show their names. A variable that is set to an empty value always shows as empty, whatever this setting. Turn it off if the scene shows text where a percent sign is directly followed by letters that is not a variable (for example `50%off`), or escape it as `\%off`. Stored as `unsetVariablesAsEmpty`. Defaults to `true`.

### System Bars

Control the appearance of the Android status bar (top of screen, shows clock/battery/notifications) and navigation bar (bottom of screen, shows back/home/recent buttons) when showing the layout as a fullscreen activity or dialog.

| Property | Default | Description |
| --- | --- | --- |
| `statusBarColor` | unset | Background color of the status bar. Accepts hex (`#RRGGBB`, `#AARRGGBB`) or theme names (`surface`, `primary`, etc.). When unset, Android uses its default. Supports [`@{key}`](scenes_v2__08_provides#provides-reference-syntax) provides references. |
| `navigationBarColor` | unset | Background color of the navigation bar. Same formats as status bar color. |
| `isLightStatusBars` | unset | Editor name: **Light Status Bar Icons**. When `true`, the status bar icons and text are drawn in light (white) colors, for a dark status bar color. When `false`, they are drawn dark, for a light status bar color. When unset, Android decides. |
| `isLightNavigationBars` | unset | Editor name: **Light Navigation Bar Icons**. Same as above but for the navigation bar buttons: `true` for light buttons on a dark nav bar, `false` for dark buttons on a light one. |
| `hideSystemBars` | `false` | When `true`, both bars are hidden entirely and your layout takes up the full screen edge-to-edge (immersive mode). The bars reappear temporarily if the user swipes from the edge. This is useful for media players, games, or any layout that benefits from maximum screen space. |

A common pattern is to match the status bar to your header background. The icon settings below suit a light theme, where `primary` is dark and `surface` is light; in a dark theme those colors are reversed, so flip both settings (or leave them unset).

```
{
  "statusBarColor": "primary",
  "isLightStatusBars": "true",
  "navigationBarColor": "surface",
  "isLightNavigationBars": "false",
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

Screenshot: The scene in fullscreen, with a primary-colored status bar above the header and a light navigation bar

Note: System bar settings only apply to [Fullscreen and Dialog](scenes_v2__14_display_modes#display-modes) display modes. [Overlays](scenes_v2__15_overlay_features#overlay-features) float above other apps and don't have their own system bars - the bars belong to whatever app is behind the overlay.

### Other Stored Fields

The layout JSON carries a few more screen-level fields that are not edited in the Settings tab. They are managed by other parts of the editor and persisted with the layout:

- `pinnedTestVariableEntries` - Test variables (name, value, enabled) used to preview the layout with sample data.
- `resolveVariablesInPreview` - Whether `%variables` are resolved in the editor preview. Defaults to `true`.
- `eventHandlers` - Screen-level event handlers, the layout-wide counterpart to per-component handlers on the Event Handling tab.
