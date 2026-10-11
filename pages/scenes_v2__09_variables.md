# Tasker Screen Builder Manual: Variables

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#variables

Section 9 of [Tasker Screen Builder Manual](scenes_v2) (Data & Variables).

Variables connect your layouts to dynamic data from Tasker. There are two mechanisms: **Variable components**, which are structural placeholders that get replaced with entire component trees at runtime, and **string variable replacement**, where `%variable` references in text and properties are substituted with their current values.

### Variable Component

The **Variable** component is a structural placeholder that gets replaced with content at runtime. It has exactly one editable property: `key`, which holds a Tasker variable name (with `%` prefix, e.g. `%content`). At runtime that variable's value is parsed and the Variable node is replaced with the result.

```
{
  "root": {
    "type": "Column", "id": "root",
    "children": [
      { "type": "Text", "id": "label", "text": "Dynamic Content Below:" },
      { "type": "Variable", "id": "slot", "key": "%content" }
    ]
  }
}
```

The variable's value is parsed as JSON. It can be:

- A **single component object** - `{ "type": "Text", "text": "Hi" }` - the Variable becomes that one component.
- An **array of component objects** - `[ { "type": "Text", ... }, { "type": "Button", ... } ]` - the Variable expands into those components as siblings.

If the value is not valid component JSON, it is treated as plain text and rendered as a Text component instead. If the `key` is empty or is not a valid Tasker variable name, the Variable is left as a Text component showing the raw key. This lets you build truly dynamic layouts where entire sections change based on Tasker data.

For example, you could fetch a list of Reddit posts via **HTTP Request**, merge each post's data into individual components (like Columns with title, thumbnail, and score) using **Array Merge**, and then pass the result into a Variable component to build a scrollable list - all without hardcoding how many items appear.

#### ID Suffixing

When a Variable's value parses to more than one component, those components are rendered as siblings. To stop duplicate IDs - which happen when the same component template is repeated, for example by Array Merge - the system suffixes every ID in each sibling's subtree with the sibling's 1-based index: `_1` for the first, `_2` for the second, and so on. The suffix is appended to all `id` values in the entire subtree, not just the top-level component. Even when there is a single sibling it still gets `_1`, so suffixing is consistent.

For example, if your component template has elements with IDs `card` and `title`, and the variable holds an array of 3 copies:

- Sibling 1: `card_1`, `title_1`
- Sibling 2: `card_2`, `title_2`
- Sibling 3: `card_3`, `title_3`

References between elements in the same subtree (such as a modifier's source element ID) are suffixed with the same index, so they keep pointing at the correct sibling after expansion.

Note: At runtime the suffix also carries a marker tying each subtree back to the Variable component that expanded it, so two Variable components reusing the same template IDs never collide. The `_1` / `_2` index is the user-facing part you reason about; the full runtime ID is an internal detail.

### String Variable Replacement

Tasker variables (prefixed with `%`) can be used directly in text content and other string properties. Tasker replaces them with their current values at runtime:

- `%battery_level` - replaced with the battery percentage
- `Hello %name, you have %count messages` - multiple variables in one string

To round or group a number as it is shown - for example `${%progress:0.0}` to show one decimal place - see [Number Formatting](scenes_v2__20_number_format#number-format).

**Global variables** (names with at least one uppercase letter, like `%VOLM`) update automatically - the layout always reflects the latest value with no extra effort. For example, if you use `%VOLM` in a Scene v2, it will always show the current media volume.

**Local variables** (all lowercase, like `%name` or `%count`) are scoped to the task that showed the scene. To update them, set the new values in the task and then run the **Update Scene v2** action - the scene will pick up the updated local variables from that task's scope.

Note: The `%` variables come from Tasker and are replaced at runtime. The `@{key}` [provides](scenes_v2__08_provides#provides) references are resolved within the layout itself. Both can be used together - for example, a provides value can contain a `%` variable.
