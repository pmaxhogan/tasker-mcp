# Tasker Screen Builder Manual: Colors & Theming

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#colors-theming

Section 7 of [Tasker Screen Builder Manual](scenes_v2) (Building Layouts).

By default, all components use **Material You** colors from the device's system theme. Text uses `onSurface`, buttons use `primary`, and so on - everything looks native with zero configuration. Colors automatically adapt to light and dark mode.

When you override a color (e.g. setting a custom background on a container), child components don't automatically adjust - you'll need to set their colors too to ensure they remain readable against the new background.

Anywhere a color is accepted, you can supply a hex value, a Material You theme color name, the keyword `transparent`, or a `@{key}` reference.

### Hex Colors

Fixed colors that always look the same. Two hex formats are accepted:

- `#RRGGBB` - e.g. `#FF5722` for a deep orange
- `#AARRGGBB` - with alpha (transparency), e.g. `#80000000` for 50% transparent black

The shorthand keyword `transparent` is also accepted and is equivalent to a fully transparent color.

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

The name is matched case-insensitively against the scheme, so `primary` and `Primary` both work. If a name doesn't match any scheme role, the color falls back to magenta so the mistake is obvious on screen.

Tip: Use theme colors like `surface` for backgrounds and `onSurface` for text. They automatically adapt to the user's device theme and look correct in both light and dark mode.

These theme colors are also available inside **WebView** components. Each role is exposed to your web content as a `--tasker-<role>` CSS custom property and on the `window.taskerColors` / `Tasker.colors` JavaScript object, and they update live when the device theme changes (with a `tasker-colors-changed` event). See [WebView -> Theme colors](scenes_v2__05_general#webview-theme-colors) for examples.

### Color References

A color field also accepts a `@{key}` reference, the same provides/reference syntax used elsewhere in the layout. This lets a parent define a color once and have descendants reuse it, so a single edit re-themes the whole subtree.

### When to Use Which

**Theme colors** are recommended for most UI elements - backgrounds, text, borders, buttons. They ensure your layout looks native and respects the user's light/dark mode preference.

**Hex colors** are best for brand-specific colors, decorative accents, or when you need an exact color regardless of theme.
