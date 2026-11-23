# Tasker Scenes V2 Manual: Colors & Theming

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#colors-theming

Section 7 of [Tasker Scenes V2 Manual](scenes_v2) (Building Layouts).

By default, all components use **Material You** colors from the device's system theme. Text uses `onSurface`, buttons use `primary`, and so on - everything looks native with zero configuration. Colors automatically adapt to light and dark mode.

A Background on its own doesn't change the colors of what's inside it, so text and icons could become hard to read against a new background. To re-color a whole area at once, add a [**ContentColor**](scenes_v2__06_modifiers#modifiers-visual-style) modifier to the container: every text and icon inside it that doesn't set its own color uses that color. Its companion **ContainerColor** sets the fill of buttons, app bars and similar components. Together with [`applyWhen`](scenes_v2__06_modifiers#modifiers-apply-when), they let you restyle a section, for example a selected tab, by changing a single variable.

Anywhere a color is accepted, you can supply a hex value, a Material You theme color name, the keywords `transparent` or `contentColor`, a [`@{key}`](scenes_v2__08_provides#provides-reference-syntax) reference, or a Tasker variable holding any of those (such as `%accent`), which updates the color live when the variable changes.

### Hex Colors

Fixed colors that always look the same. Two hex formats are accepted:

- `#RRGGBB` - e.g. `#FF5722` for a deep orange
- `#AARRGGBB` - with alpha (transparency), e.g. `#80000000` for 50% transparent black

The shorthand keyword `transparent` is also accepted and is equivalent to a fully transparent color.

The keyword `contentColor` uses the text/icon color the element inherits from its parent. For example, an Image inside a Button with `tint` set to `contentColor` always matches the button's text, even when a `ContentColor` modifier changes it.

### Theme Colors

Dynamic colors that adapt to the device's Material You theme and automatically switch between light and dark mode. Supply one by name. A theme color name is resolved against the active Material 3 color scheme, so the full set of Material 3 scheme roles is available:

- **primary**, **onPrimary**, **primaryContainer**, **onPrimaryContainer**
- **secondary**, **onSecondary**, **secondaryContainer**, **onSecondaryContainer**
- **tertiary**, **onTertiary**, **tertiaryContainer**, **onTertiaryContainer**
- **background**, **onBackground**
- **surface**, **onSurface**, **surfaceVariant**, **onSurfaceVariant**
- **surfaceTint**, **surfaceBright**, **surfaceDim**
- **surfaceContainer**, **surfaceContainerLowest**, **surfaceContainerLow**, **surfaceContainerHigh**, **surfaceContainerHighest**
- **inverseSurface**, **inverseOnSurface**, **inversePrimary**
- **error**, **onError**, **errorContainer**, **onErrorContainer**
- **outline**, **outlineVariant**
- **scrim**
- the "fixed" accent roles - **primaryFixed**, **primaryFixedDim**, **onPrimaryFixed**, **onPrimaryFixedVariant**, and the matching **secondaryFixed*** and **tertiaryFixed*** roles

Most roles come in pairs: an "on" color such as `onPrimary` is meant for text and icons drawn on top of its partner (`primary`). The exact colors vary from device to device, because they come from the device's Material You theme and change between light and dark mode.

Screenshot: The main theme color role pairs, each swatch filled with a role and labeled in its on-color (colors vary by device)

Write the name exactly as listed. Only the case of the first letter doesn't matter, so `primary` and `Primary` both work, but `PRIMARY` or `onsurface` don't. If a name doesn't match any scheme role, the color falls back to magenta so the mistake is obvious on screen.

Tip: Use theme colors like `surface` for backgrounds and `onSurface` for text. They automatically adapt to the user's device theme and look correct in both light and dark mode.

These theme colors are also available inside **WebView** components. Each role is exposed to your web content as a `--tasker-<role>` CSS custom property and on the `window.taskerColors` / `Tasker.colors` JavaScript object, and they update live when the device theme changes (with a `tasker-colors-changed` event). See [WebView -> Theme colors](scenes_v2__05_general#webview-theme-colors) for examples.

### Color References

A color field also accepts a [`@{key}`](scenes_v2__08_provides#provides-reference-syntax) reference, the same [provides](scenes_v2__08_provides#provides)/reference syntax used elsewhere in the layout. This lets a parent define a color once and have descendants reuse it, so a single edit re-themes the whole subtree.

### When to Use Which

**Theme colors** are recommended for most UI elements - backgrounds, text, borders, buttons. They ensure your layout looks native and respects the user's light/dark mode preference.

**Hex colors** are best for brand-specific colors, decorative accents, or when you need an exact color regardless of theme.
