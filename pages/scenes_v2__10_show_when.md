# Tasker Scenes V2 Manual: Conditional Visibility

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#show-when

Section 10 of [Tasker Scenes V2 Manual](scenes_v2) (Data & Variables).

The `showWhen` property lets you show or hide any component based on a boolean expression. When the expression evaluates to `false`, the component is hidden. By default that means the component and all its children are removed from the layout, but the [`showWhenMode`](scenes_v2__10_show_when#show-when-mode) property can change that. An absent or blank `showWhen` means the component is always visible.

The `enabled` property of interactive components (buttons, switches, text inputs and so on) takes the same expressions, with one difference: a value that doesn't read as true or false, including a variable that doesn't exist, leaves the component enabled. Only an explicit false value (`false`, `off`, `no`, `0`) or a false condition disables it.

### Syntax

Expressions support variables, comparisons, and boolean operators.

#### Values & Literals

These are the building blocks you can use on either side of an operator:

| Type | Syntax | Examples | Details |
| --- | --- | --- | --- |
| Variable reference | `%name` | `%is_logged_in`, `%VOLM`, `%sv2_render_width` | References a variable. The `%` prefix is required, and the first character after it must be a letter or underscore; the rest can be letters, digits, underscores, or dots. When used alone (without a comparison operator) the value is read as true or false the same way as every other true/false property: `true`, `on`, `yes` or `1` (any capitalization) and any non-zero number are true; `false`, `off`, `no` and `0` are false. Any other text, or a variable that does not exist, is `false` (for `enabled`, it leaves the component enabled). A bare word with no `%` prefix that isn't a boolean word is also read as a variable name, just without a prefix. |
| String literal | `"text"` | `"admin"`, `"super admin"`, `"on"` | A quoted text value. Enclose in double quotes. Can contain spaces and special characters. Used on the right side of comparisons like `%role == "admin"`. |
| Number literal | `123` or `3.5` | `0`, `600`, `-10`, `99.5` | An integer or decimal number. Negative numbers are supported (e.g., `-10`). Used in numeric comparisons. When a variable holds a numeric string (e.g., `"800"`), it is automatically parsed as a number for comparisons. |
| Boolean literal | `true` / `false` | `%enabled == true` | The bare keywords `true` and `false` (without quotes), plus `on`/`off` and `yes`/`no`, in any capitalization. Comparing against one compares both sides as true/false, so `%enabled == true` also matches `"on"` or `"Yes"`. Rarely needed since a bare variable reference is already shorthand for `== true`. |

#### Comparison Operators

Compare a variable against a value. Both sides can be variables or literals.

| Operator | Name | Example | Details |
| --- | --- | --- | --- |
| `==` | Equals | `%role == "admin"` | True if both sides are equal. Works with strings, numbers, and booleans. If one side is a boolean literal and the other reads as true or false, they are compared as booleans. If both sides can be parsed as numbers, they are compared numerically (so `%count == 10` works when `%count` is `"10"`). Otherwise, compared as strings. If either side is a missing variable, the result is `false`. |
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
        "showWhen": "%role == \"admin\" & %is_logged_in",
        "content": [ { "type": "Text", "id": "admin_btn_text", "text": "Admin Panel" } ]
      },
      {
        "type": "Column", "id": "landscape_only",
        "showWhen": "%sv2_render_is_landscape",
        "children": [
          { "type": "Text", "id": "landscape_msg", "text": "This only shows in landscape" }
        ]
      }
    ]
  }
}
```

### Built-in Size Variables

Every scene gets these variables automatically, with no setup in Tasker. They work in `showWhen` and anywhere else a `%variable` works, and anything that uses them updates on its own when they change.

| Variable | Value |
| --- | --- |
| `%sv2_display_width`, `%sv2_display_height` | The full size of the device's display, in pixels (not dp). Updated when the window size changes, for example when the device rotates. |
| `%sv2_display_proportion` | The display's width divided by its height, as a decimal number. Below `1` means taller than wide, above `1` means wider than tall. |
| `%sv2_display_is_landscape`, `%sv2_display_is_portrait` | `true` when the display is wider than tall (landscape) or taller than wide (portrait), otherwise `false`. |
| `%sv2_render_width`, `%sv2_render_height` | The size of the area the scene itself is drawn in, in pixels. For a dialog or an overlay that's the size of its window, not of the screen. Updated every time that area changes size. |
| `%sv2_render_is_landscape`, `%sv2_render_is_portrait` | The same landscape and portrait checks, made on the render size. |

Use the **display** variables to react to the device and the **render** variables to react to the space your scene actually has. Because the sizes are in pixels, a number like `600` is small on most phones; the landscape and portrait variables are often simpler. In the editor, the render variables follow the size of the preview area.

### When Hidden: Gone vs Invisible

By default a hidden component is removed from the layout entirely - it occupies no space, and surrounding components close up as if it were never there. The `showWhenMode` property changes what "hidden" does. It takes one of two values:

| Value | Behavior when `showWhen` is false |
| --- | --- |
| `Gone` | **Default.** The component and its entire subtree are removed from the layout. It takes up no space; siblings reflow to fill the gap. |
| `Invisible` | The component keeps its place in the layout but is not drawn. Its space is reserved, so siblings do not move. Use this when you want the layout to stay stable as a component appears and disappears. |

Screenshot: Two rows of A, B, C with B hidden: Gone closes the gap, Invisible keeps it

Set it alongside `showWhen` on the same component:

```
{
  "type": "Text", "id": "status",
  "text": "Saved",
  "showWhen": "%was_saved",
  "showWhenMode": "Invisible"
}
```

Write the value exactly as shown: `Gone` or `Invisible`, with a capital first letter. Any other spelling, including `invisible`, is treated as `Gone`. `showWhenMode` can also be a `%variable` reference; its value must then also be exactly `Gone` or `Invisible`, and a missing variable means `Gone`. The property only has an effect when `showWhen` is set - in the editor it appears as the **When Hidden** field, shown only once a `showWhen` expression has been entered.

Note: `showWhenMode` only controls what happens when a component is hidden. When the component is in a container with a content transition, a hidden child may be kept briefly so the transition can animate it out, regardless of the mode.

### Show and Hide Animations

By default a component appears and disappears instantly when its `showWhen` changes. To animate it, select the component and open the **Animation** tab: under **Visibility transition**, add an **Enter** effect (played when it appears) and optionally an **Exit** effect (played when it goes away). If you only set Enter, Exit mirrors it; if you only set Exit, Enter defaults to Fade.

| Effect | Settings | Description |
| --- | --- | --- |
| `Fade` | - | Fades the component in or out. |
| `Scale` | `initialScale` (default `0.8`), `transformOrigin` ("Pivot", default `Center`), `fade` (default on) | Grows from (or shrinks to) the given size around the pivot point. |
| `Slide` | `direction` (`Bottom`, `Top`, `Start` or `End`; default `Bottom`), `fade` (default on) | Slides in from (or out to) that edge. |
| `Expand` | `axis` (`Vertical`, `Horizontal` or `Both`; default `Vertical`), `fade` (default on) | Unfolds the component, pushing its neighbours aside smoothly instead of making them jump. |

Every effect also has a duration (`durationMs`, default `220`), an easing curve (`easing`: `Linear`, `EaseIn`, `EaseOut`, `EaseInOut`, `Overshoot` or `Bounce`) and an optional extra delay before it starts (`delayMs`, default `0`). Delays let you stagger several components, for example a dark background that fades in first and a dialog that slides up right after it, for an Android-style popup.

```
{ "type": "Card", "id": "popup", "showWhen": "%show_popup",
  "visibilityTransition": {
    "enter": { "type": "Slide", "direction": "Bottom", "delayMs": "100" },
    "exit": { "type": "Fade" }
  } }
```

Things to know about these animations:

- They only play when the scene runs. The editor preview shows and hides the component instantly.
- A component that is already visible when the scene opens just appears; the Enter effect plays the next time it goes from hidden to shown.
- The `Align`, `Weight`, `MatchParentSize` and `Offset` modifiers don't animate: they stay on an outer wrapper that keeps the component's place, while everything else (background, padding, size and so on) animates with the component.
- `Expand` grows from the top edge (`Vertical`) or the start edge (`Horizontal`), and shrinks back towards that edge.
- With a visibility transition set, a hidden component always gives up its space once the Exit effect ends, even if `showWhenMode` is `Invisible`.
- A direct child of a container that has a [content transition](scenes_v2__05_general#general-content-transition) doesn't play its own show and hide animation. The container's content transition animates it instead.

These are different from a container's [content transition](scenes_v2__05_general#general-content-transition), which animates its children when they change.

### How Variables Are Resolved

The `showWhen` *evaluator* reads variables only - it does not treat [provides](scenes_v2__08_provides#provides) keys as values to compare against. A bare provides key name in an expression is not looked up the way a `%variable` is. However, a [`@{key}`](scenes_v2__08_provides#provides-reference-syntax) provides reference *is* still substituted into a `showWhen` string before evaluation, exactly like in any other string property: the provides system runs first and replaces `@{key}` with its text, then the resulting expression is evaluated. So `"showWhen": "@{flag}"`, with a provided `flag` of `%enabled`, evaluates as `%enabled`.

Two kinds of variables feed `showWhen`:

- **Tasker `%variables`** - both local task variables and global variables, resolved from the task that showed the scene.
- **Screen variables** - values set from inside the layout by the event-action system ([SetVariable](scenes_v2__11_interactions#interactions) and ToggleVariable event actions). When an event action writes a variable, any `showWhen` that references it re-evaluates immediately.

Both kinds share one namespace: a `showWhen` reference like `%is_open` is satisfied whether `%is_open` came from Tasker or was set by a SetVariable event action. If a referenced variable doesn't exist in either source, the expression evaluates to `false`. Expressions re-evaluate reactively when any referenced value changes.

### Testing in the Editor

To preview how `showWhen` expressions behave, open the editor's overflow menu and choose **Variables** (flask icon) to open the [**Test Variables**](scenes_v2__03_editor_overview#editor-overview-test-variables) panel. Set variable values there (e.g., `%is_logged_in` = `true`) and the preview updates immediately - components appear or disappear based on your test values. While **Resolve in Preview** is on (the default), test values are used everywhere in the preview, so text and other properties show them too. With it off, the preview shows raw variable names and doesn't evaluate `showWhen` at all: every component is shown, except one whose `showWhen` is the literal `false`. These values are editor-only and are not used at runtime.

Tip: In the editor, the `showWhen` field shows auto-complete suggestions for available Tasker variables.
