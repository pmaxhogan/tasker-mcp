# Tasker Scenes V2 Manual: Number Formatting

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#number-format

Section 20 of [Tasker Scenes V2 Manual](scenes_v2) (Advanced).

In a Text, a button label, or almost any other text a layout shows, you can format a number inline so an ugly decimal like `73.68410` becomes `73.7`, or `1234.5` becomes `1,234.5`. Formatting happens automatically - no per-component setup - by wrapping a value in a format span. The exceptions are a **Text Input**'s `text` and a **WebView**'s `content`: they are used exactly as written, so a span there is left untouched.

### Syntax

The format span is:

```
${value:pattern}
```

It runs *after* variables are substituted, so a field containing `${%progress:0.0}` first becomes `${73.6841:0.0}` and then renders as `73.7`. You can put a span anywhere in a string:

```
Loading ${%progress:0}%      →   Loading 74%
Total: ${%amount:$#,##0.00}    →   Total: $1,234.50
```

`pattern` is a standard **DecimalFormat** pattern (the same syntax Java and Android use). You do not have to memorize it - the examples below cover almost everything, and any pattern you type is applied literally.

Tip: When you insert a variable into a text field in the editor, Tasker offers a **Format** dialog. The presets there are just examples - the Format box accepts *any* pattern, and a live preview shows exactly what the value will look like. If you turned the prompt off with **Don't remind me again**, tap **Format…** at the bottom of the variable picker to format a single variable.

Screenshot: The Format dialog for a variable in the editor, with a pattern entered and the live preview of the result

### Common patterns

Results shown for the sample value `1234.567`:

| Pattern | Meaning | `1234.567` → |
| --- | --- | --- |
| `0` | Whole number (rounded) | `1235` |
| `0.0` | One decimal place | `1234.6` |
| `0.00` | Two decimal places | `1234.57` |
| `#,##0.##` | Grouped thousands, up to two decimals | `1,234.57` |
| `#,##0` | Grouped thousands, whole number | `1,235` |
| `00000` | Zero-padded to at least 5 digits | `01235` |
| `0.000` | Exactly three decimals | `1234.567` |

### Pattern symbols

| Symbol | Meaning |
| --- | --- |
| `0` | A digit. Always shown, padded with `0` when the number is shorter. |
| `#` | A digit, but shown only when present - trailing/leading zeros are dropped. |
| `.` | Decimal separator. |
| `,` | Grouping (thousands) separator. |
| `'text'` | Literal text. Wrap any special character in single quotes to show it as-is, e.g. `'%'`. |
| `%` | Percent: multiplies the value by 100 and appends a percent sign. |

Percent vs literal %: An unquoted `%` scales the value: `0%` turns `0.75` into `75%`. A quoted `'%'` is just the character with no scaling: `0'%'` turns `1234.567` into `1235%`. Pick `%` when your value is a 0-1 fraction, `'%'` when it is already a percentage number.

### Rules & edge cases

- **Numbers only.** If the value is not a number, or the pattern is not valid, the span is left exactly as written - nothing is changed or hidden.
- **Locale-independent.** Formatting always uses `.` for the decimal point and `,` for grouping, regardless of the device's locale, so a layout looks the same everywhere.
- **Rounding** is half-to-even (banker's rounding): `2.5` with pattern `0` becomes `2`, and `3.5` becomes `4`.
- **Escaping.** To show a literal `${` in your text, write `$${`. To put a currency sign before a number, include it in the pattern instead: `${%amount:$#,##0.00}` shows `$1,234.50`.

Tip: Combine formatting with a [Variable](scenes_v2__09_variables#variables) reference almost anywhere - a Text component, a Button label, even inside a longer sentence. Only the `${…:…}` span is touched; the rest of your text is left alone.
