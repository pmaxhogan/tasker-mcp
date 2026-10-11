# Tasker Screen Builder Manual: Overlay Features

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#overlay-features

Section 15 of [Tasker Screen Builder Manual](scenes_v2) (Display & Overlays).

Overlay mode offers the most configuration options for how your layout appears and behaves.

### Position & Size

Overlays support flexible positioning and sizing with two unit types:

- **dp (density-independent pixels)** - Fixed pixel position. Positive values position the left/top edge from the left/top edge of the screen. Negative values position the right/bottom edge from the right/bottom edge. Examples: `100` = 100dp from left, `-20` = 20dp from right edge.
- **% (percentage)** - Position as a percentage of the screen. The overlay's center is placed at the given percentage. Examples: `50%` = centered, `-25%` = center placed 25% from the right edge.

Position is set via the X and Y arguments. Width and height can be set explicitly (dp or %) or left empty to wrap content. A blank X or Y is treated as 0 (the top-left origin).

Each of the four values (X, Y, Width, Height) can also be a comma-separated `portrait,landscape` pair (e.g. `300,500`) to use a different value per orientation. A single value applies to both orientations; if one side of the pair is left empty it inherits the other side.

### Blocking Overlay

By default, overlays **block** touches - tapping the overlay interacts with it, not the app behind it. Disable the **Blocking Overlay** option to let touches pass through the overlay to the underlying app. This is useful for informational overlays (like a clock or battery indicator) that shouldn't block interaction with the app behind them.

Note: On Android 12+, non-blocking overlays require a special system setting (`block_untrusted_touches = 0`). Tasker sets this automatically when you show a non-blocking overlay if you have granted the WRITE_SECURE_SETTINGS permission.

### Animations

Overlays support a show animation and a dismiss animation. Both are chosen from the same preset list. The dismiss animation runs the chosen preset in reverse, so for example `SlideFromBottom` slides out toward the bottom on dismiss.

| Preset | Description |
| --- | --- |
| `None` | No animation - the overlay appears/disappears instantly |
| `SlideFromBottom` | Slide in from the bottom edge of the screen |
| `SlideFromTop` | Slide in from the top edge of the screen |
| `SlideFromLeft` | Slide in from the left edge of the screen |
| `SlideFromRight` | Slide in from the right edge of the screen |
| `FadeIn` | Fade in from transparent to fully visible |
| `ZoomIn` | Scale up from small to full size |
| `BounceIn` | Spring-like bounce entrance effect |

Set a show animation and/or a dismiss animation independently. Each is one preset from the list above.

### Config Transitions

When you change an overlay's configuration while it is active with the **Update Scene v2 Overlay** action (position, size, or blocking mode), the change can be animated smoothly. Set a transition duration (in milliseconds) and an easing curve to make position/size changes fluid instead of abrupt.

Available easing curves: `Linear`, `EaseIn`, `EaseOut`, `EaseInOut`, `Overshoot`, `Bounce`.

### Draggable Overlays

Make any component act as a drag handle with the **Drag to Move** toggle on the Modifiers tab. Users can then press and drag that component to move the entire overlay window around the screen. See [Drag to Move](scenes_v2__11_interactions#interactions-drag).

For overlays built from a WebView, the page's own HTML can supply drag handles with the `tasker-drag-handle` CSS classes - see [the WebView component reference](scenes_v2__05_general#webview-drag-handles).

### Show Over Everything

By default, overlays use the standard Android overlay window, which requires the "Display over other apps" permission. Enable the **Show Over Everything** option to use the accessibility service overlay instead. This allows the overlay to appear over restricted surfaces like the lock screen and notification tray.

Warning: The "Show Over Everything" option requires the Tasker accessibility service to be running. If it's not active, the action will fail with an error notification.

### Limitations

Due to Android restrictions, **TextInput components do not work in overlay mode** - the system does not allow keyboard input in overlay windows. If your layout needs text input, use fullscreen or dialog mode instead.
