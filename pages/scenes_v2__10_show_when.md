# Tasker Screen Builder Manual: Conditional Visibility

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#show-when

Section 10 of [Tasker Screen Builder Manual](scenes_v2) (Data & Variables).

The `showWhen` property lets you show or hide any component based on a boolean expression. When the expression evaluates to `false`, the component is hidden. By default that means the component and all its children are removed from the layout, but the [`showWhenMode`](scenes_v2__10_show_when#show-when-mode) property can change that. An absent or blank `showWhen` means the component is always visible.

### Syntax

Expressions support variables, comparisons, and boolean operators.

#### Values & Literals

These are the building blocks you can use on either side of an operator:

| Type | Syntax | Examples | Details |
| --- | --- | --- | --- |
| Variable reference | `%name` | `%is_logged_in`, `%VOLM`, `%screen_width` | References a variable. The `%` prefix is required, and the first character after it must be a letter or underscore; the rest can be letters, digits, underscores, or dots. When used alone (without a comparison operator) the value is coerced to a boolean: the string `"true"` is true, any non-zero number is true, anything else is false. If the variable does not exist, the result is `false`. A bare word with no `%` prefix (and not `true`/`false`) is also read as a variable name, just without a prefix. |
| String literal | `"text"` | `"admin"`, `"super admin"`, `"on"` | A quoted text value. Enclose in double quotes. Can contain spaces and special characters. Used on the right side of comparisons like `%role == "admin"`. |
| Number literal | `123` or `3.5` | `0`, `600`, `-10`, `99.5` | An integer or decimal number. Negative numbers are supported (e.g., `-10`). Used in numeric comparisons. When a variable holds a numeric string (e.g., `"800"`), it is automatically parsed as a number for comparisons. |
| Boolean literal | `true` / `false` | `%enabled == true` | The bare keywords `true` and `false` (without quotes). Rarely needed since a bare variable reference is already shorthand for `== true`. |

#### Comparison Operators

Compare a variable against a value. Both sides can be variables or literals.

| Operator | Name | Example | Details |
| --- | --- | --- | --- |
| `==` | Equals | `%role == "admin"` | True if both sides are equal. Works with strings, numbers, and booleans. If both sides can be parsed as numbers, they are compared numerically (so `%count == 10` works when `%count` is `"10"`). Otherwise, compared as strings. If either side is a missing variable, the result is `false`. |
| `!=` | Not equals | `%count != 0` | True if the two sides are **not** equal. Exact inverse of `==`: uses the same numeric-then-string comparison logic. For example, `%role != "user"` is true when `%role` is anything other than `"user"`. If either side is a missing variable, the result is `false`. |
| `>` | Greater than | `%VOLM > 50` | True if the left side is numerically greater than the right side. **Both sides must be numeric** - if either side cannot be parsed as a number, the result is `false`. For example, `%name > 5` is always false if `%name` is `"alice"`. |
| `<` | Less than | `%battery < 20` | True if the left side is numerically less than the right side. Both sides must be numeric; non-numeric values return `false`. |
| `>=` | Greater than or equal | `%width >= 800` | True if the left side is numerically greater than or equal to the right side. Both sides must be numeric; non-numeric values return `false`. |
| `<=` | Less than or equal | `%height <= 400` | True if the left side is numerically less than or equal to the right side. Both sides must be numeric; non-numeric values return `false`. |
| `contains` | Contains (case-insensitive) | `%role contains "adm"` | True if the left side contains the right side as a substring, ignoring case. So `%role contains "ADM"` matches `"admin"`. |
| `ccontains` | Contains (case-sensitive) | `%tags ccontains "Pro"` | True if the left side contains the right side as a substring, matching case exactly. |
| `matches` | Matches (pattern) | `%file matches "*.png"` | True if the **whole** left side matches the right side as a Tasker pattern: `*` matches any run of characters and `+` matches one or more, while every other character is literal. Matching is case-insensitive unless the pattern contains an uppercase letter. This is the same pattern matching Tasker uses elsewhere, so `%file matches "*.png"` is true for `"photo.png"`. |
| `matchesr` | Matches Regex | `%code matchesr "^\d{4}$"` | True if the left side matches the right side as a regular expression, found anywhere in the value (anchor with `^` and `$` to require a full-value match). Case-sensitive unless you add an inline flag such as `(?i)`. Mirrors Tasker's *Matches Regex* (`~R`) operator. |

#### Boolean Operators

Combine multiple conditions into a single expression. Operators are listed in order of precedence (highest to lowest).

| Operator | Name | Example | Details |
| --- | --- | --- | --- |
| `!` | NOT | `!%is_hidden` | Negates the expression that follows it. If `%is_hidden` is `"true"`, then `!%is_hidden` evaluates to `false`, and vice versa. Can be chained: `!!%val` is a double negation. NOT binds tighter than AND and OR, but **looser than comparisons** - it negates the whole comparison that follows it. So `!%role == "admin"` is read as `!(%role == "admin")`, true whenever `%role` is not `"admin"`. To negate a single value inside a comparison, put it on its own side, e.g. `%a == !%b`. |
| `&` | AND | `%is_logged_in & %is_premium` | True only if **both** sides are true. You can chain multiple: `%a & %b & %c` requires all three to be true. AND has **higher precedence than OR**, meaning `%a \| %b & %c` is evaluated as `%a \| (%b & %c)`, not `(%a \| %b) & %c`. |
| `\|` | OR | `%is_admin \| %is_moderator` | True if **at least one** side is true. Can be chained: `%a \| %b \| %c` is true if any of the three is true. Has the **lowest precedence** of all operators. |
| `( )` | Grouping | `(%a \| %b) & %c` | Parentheses override the default operator precedence. Without parentheses, `%a \| %b & %c` means "a, or (b and c)." With parentheses, `(%a \| %b) & %c` means "(a or b), and c" - both the OR group and `%c` must be true. You can nest parentheses: `((%a \| %b) & %c) \| %d`. |

#### Operator Precedence

When multiple operators appear in the same expression without parentheses, they bind in this order (tightest first):

| Priority | Operator | Description |
| --- | --- | --- |
| 1 (tightest) | `==` `!=` `>` `<` `>=` `<=` `contains` `ccontains` `matches` `matchesr` | Comparisons bind first, joining the two values around them |
| 2 | `!` (NOT) | Negates the comparison (or value) to its right |
| 3 | `&` (AND) | AND is grouped before OR |
| 4 (loosest) | `\|` (OR) | OR is grouped last |

For example, `%a | %b & %c > 5` is evaluated as `%a | (%b & (%c > 5))`: the comparison `%c > 5` forms first, then AND joins it with `%b`, then OR joins that with `%a`. Note that NOT sits below comparisons, so `!%c > 5` means `!(%c > 5)`. When in doubt, use parentheses to make your intent explicit.

### Examples

```
{
  "root": {
    "type": "Column", "id": "root",
    "children": [
      {
        "type": "Text", "id": "welcome",
        "text": "Welcome, premium user!",
        "showWhen": "%is_premium"
      },
      {
        "type": "Button", "id": "admin_btn",
        "text": "Admin Panel",
        "showWhen": "%role == \"admin\" & %is_logged_in"
      },
      {
        "type": "Column", "id": "wide_only",
        "showWhen": "%screen_width > 600",
        "children": [
          { "type": "Text", "id": "wide_msg", "text": "This only shows on wide screens" }
        ]
      }
    ]
  }
}
```

### When Hidden: Gone vs Invisible

By default a hidden component is removed from the layout entirely - it occupies no space, and surrounding components close up as if it were never there. The `showWhenMode` property changes what "hidden" does. It takes one of two values:

| Value | Behavior when `showWhen` is false |
| --- | --- |
| `Gone` | **Default.** The component and its entire subtree are removed from the layout. It takes up no space; siblings reflow to fill the gap. |
| `Invisible` | The component keeps its place in the layout but is not drawn. Its space is reserved, so siblings do not move. Use this when you want the layout to stay stable as a component appears and disappears. |

Set it alongside `showWhen` on the same component:

```
{
  "type": "Text", "id": "status",
  "text": "Saved",
  "showWhen": "%was_saved",
  "showWhenMode": "Invisible"
}
```

The value is case-insensitive. Any unrecognized value falls back to `Gone`. `showWhenMode` can also be a `%variable` reference, in which case its resolved value is matched against the mode names; if that variable is missing, the mode falls back to `Gone`. The property only has an effect when `showWhen` is set - in the editor it appears as the **When Hidden** field, shown only once a `showWhen` expression has been entered.

Note: `showWhenMode` only controls what happens when a component is hidden. When the component is in a container with a content transition, a hidden child may be kept briefly so the transition can animate it out, regardless of the mode.

### How Variables Are Resolved

The `showWhen` *evaluator* reads variables only - it does not treat [provides](scenes_v2__08_provides#provides) keys as values to compare against. A bare provides key name in an expression is not looked up the way a `%variable` is. However, a `@{key}` provides reference *is* still substituted into a `showWhen` string before evaluation, exactly like in any other string property: the provides system runs first and replaces `@{key}` with its text, then the resulting expression is evaluated. So `"showWhen": "@{flag}"`, with a provided `flag` of `%enabled`, evaluates as `%enabled`.

Two kinds of variables feed `showWhen`:

- **Tasker `%variables`** - both local task variables and global variables, resolved from the task that showed the scene.
- **Screen variables** - values set from inside the layout by the event-action system ([SetVariable](scenes_v2__11_interactions#interactions) and ToggleVariable event actions). When an event action writes a variable, any `showWhen` that references it re-evaluates immediately.

Both kinds share one namespace: a `showWhen` reference like `%is_open` is satisfied whether `%is_open` came from Tasker or was set by a SetVariable event action. If a referenced variable doesn't exist in either source, the expression evaluates to `false`. Expressions re-evaluate reactively when any referenced value changes.

### Testing in the Editor

To preview how `showWhen` expressions behave, open the editor's overflow menu and choose **Variables** (flask icon) to open the [**Test Variables**](scenes_v2__03_editor_overview#editor-overview-test-variables) panel. Set variable values there (e.g., `%is_logged_in` = `true`) and the preview updates immediately - components appear or disappear based on your test values. Note that test variables only affect `showWhen` evaluation; text and other properties will still show the raw variable names in the preview. These values are editor-only and are not used at runtime.

Tip: In the editor, the `showWhen` field shows auto-complete suggestions for available Tasker variables.
