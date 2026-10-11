# Tasker Screen Builder Manual: Proportional Scaling

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#proportional-scaling

Section 19 of [Tasker Screen Builder Manual](scenes_v2) (Advanced).

Proportional scaling lets you design a layout on one screen size and have it look proportionally identical on any other screen size. Dimension values automatically scale up or down based on the device's screen width.

### How It Works

Two things are needed:

1. **Set a reference width** - In Screen Properties > Scaling, enter the screen width (in dp) you're designing for. This is stored on the screen as the `referenceDp` field. For example, `360` is a common phone width.
2. **Use the `pr` suffix** - Append `pr` to any supported dimension value. For example, `16pr` means "16 dp on the reference screen, scaled proportionally on other screens."

At runtime, values with the `pr` suffix are multiplied by a scale factor of `(currentScreenWidth / referenceWidth)`, both measured in dp. On the reference device the factor is 1, so `16pr` equals exactly `16`. On a device twice as wide it becomes `32`. The suffix is matched case-insensitively, so `16pr` and `16PR` behave the same.

Tip

Without a reference width set (or if it can't be parsed, or is zero or negative), the scale factor is `1`, so `16pr` behaves identically to `16` - no scaling is applied. You can safely add `pr` suffixes before deciding on a reference width.

### Supported Properties

The `pr` suffix is honored only on properties that the framework resolves as screen-dependent dimensions:

- **Text** - `textSize`
- **Text Input** - `textSize`, `shape` (corner radius)
- **Padding** - `all`, `horizontal`, `vertical`, `start`, `top`, `end`, `bottom`
- **Size** - `all`, `width`, `height`
- **Size Constraints** (SizeIn) - `minWidth`, `maxWidth`, `minHeight`, `maxHeight`
- **Offset** - `x`, `y`
- **Border** - `width`
- **Shadow** - `elevation`
- **Blur** - `radiusX`, `radiusY`
- **Divider** - `thickness`
- **Spacer** - `width`, `height`
- **Progress Bar** - `strokeWidth`
- **Flow Row** / **Flow Column** - `spacingHorizontal`, `spacingVertical`

Properties that are not dimensions - alpha, weight, fill fractions, rotation degrees, scale factors, color values - are unaffected. Adding a `pr` suffix to one of those has no effect; the suffix is only stripped and applied where the framework parses the value as a screen-dependent dimension.

### Example

A layout designed for a 360dp-wide phone:

```
{
  "referenceDp": "360",
  "root": {
    "type": "Column", "id": "root",
    "modifiers": [{"type": "FillSize"}, {"type": "Padding", "all": "16pr"}],
    "children": [
      {
        "type": "Text", "id": "title",
        "text": "Hello World",
        "textSize": "24pr"
      },
      {
        "type": "Spacer", "id": "gap", "height": "12pr"
      },
      {
        "type": "Text", "id": "body",
        "text": "This layout scales proportionally.",
        "textSize": "14pr"
      }
    ]
  }
}
```

On a 360dp screen, this renders at the exact values specified. On a 720dp screen (2x wider), all `pr` values double: padding becomes 32, title text becomes 48, spacing becomes 24, body text becomes 28.

### Setting the Reference Width

In the editor, deselect all components to see the Screen Properties panel. Open the **Scaling** section and enter a value in the **Reference Width (dp)** field. Common values:

- `360` - Standard phone (most common)
- `400` - Larger phone
- `600` - Small tablet
- `840` - Large tablet

Note

You can mix `pr` and regular values in the same layout. For instance, use `pr` for text sizes and padding but a fixed `1` for border width if you want borders to stay thin regardless of screen size.
