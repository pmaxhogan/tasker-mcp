# Tasker Screen Builder Manual: Tasker Actions

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#tasker-actions

Section 12 of [Tasker Screen Builder Manual](scenes_v2) (Making It Interactive).

Tasker has seven actions for working with Scene v2 layouts. They live in the **Scene v2** action category. Use them to show layouts, update them at runtime, run component actions, read element values, and react to user interaction.

### Variables

Use Tasker `%variables` to display dynamic data in your layouts:

- Add a **Variable** component and set its key (e.g., `%content`) - Tasker can replace it with text or even entire component trees at runtime
- Use `%variables` directly in text content and other string properties for runtime replacement (e.g., `Battery: %BATT%%`)

See [Variables](scenes_v2__09_variables#variables) for full details. For layout-internal shared values, see the [Provides System](scenes_v2__08_provides#provides).

### Show Scene v2

Shows a layout. This is the main action. Key arguments:

- **Name/JSON** - the saved scene to show, or raw layout JSON.
- **Screen ID** - the runtime ID for this display. Showing a layout with the ID of an already-active display updates it in place; a new ID launches a new display. If left empty, the scene's own ID is used.
- **Display Mode** - how the layout appears. See [Display Modes](scenes_v2__14_display_modes#display-modes). If left empty, the scene's own default display mode is used.
- **Overlay arguments** - X/Y position, width, height, blocking, show/dismiss animation, long-click-root-to-dismiss, and show-over-everything. These only apply when the display mode is an overlay mode. See [Overlay Features](scenes_v2__15_overlay_features#overlay-features).
- **Auto Dismiss (ms)** - dismiss the layout automatically after this many milliseconds. Leave empty or set to 0 to keep it until dismissed manually.
- **Physical Display** - the ID of the display to show on. Leave empty for the primary display.

Whether the action waits for a result is decided by the display mode, not by a separate toggle. See [Display Modes](scenes_v2__14_display_modes#display-modes) for details.

### Show Scene v2 Output Variables

When the chosen display mode is a "WithResult" mode (or the scene's default display mode waits for a result), the **Show Scene v2** action blocks until the layout is dismissed and then sets these output variables:

- `%sv2_element_id` - the ID of the element that dismissed the layout
- `%sv2_scene_name` - the scene name
- `%sv2_screen_id` - the runtime Screen ID of the display
- `%sv2_element_path` - the element's path in the component tree (e.g., `root.header.confirm_btn`)
- `%sv2_interaction_type` - the interaction that dismissed the layout (e.g., `single`, `long_press`, `swipe`, `multi_2`)

If the layout has swipe event handlers, the action also sets:

- `%sv2_swipe_path_x()` - array of X coordinates (dp) of each point in the swipe path
- `%sv2_swipe_path_y()` - array of Y coordinates (dp) of each point in the swipe path
- `%sv2_swipe_length` - total swipe length
- `%sv2_swipe_direction` - the swipe direction

For the swipe arrays, index 1 is the start point and the last index is the end point. Intermediate indices represent simplified waypoints along the gesture.

In addition, any **output variables** defined by the layout are set with the values they hold when the layout is dismissed. Output variables are named by the scene; the action picks them up by name. See [Variables](scenes_v2__09_variables#variables).

### Updating Layouts Dynamically

Two actions change an already-displayed layout without closing and re-showing it:

- **Update Scene v2** - Change a property of a component by its ID: text content, colors, visibility, modifiers, and more. Set Element ID, Property, and Value. The Property and Value fields are hidden until an Element ID is entered. You can also enable **Local Variable Passthrough** to send all current task variables to the scene, optionally restricted with **Limit Passthrough To** (a comma-separated list of variable names). Passthrough runs even when no Element ID is set. If Screen ID is empty, the update applies to every active Scene v2 display. This also works for elements inside Variable component expansions - use the suffixed ID (e.g. `title_2`) to target a specific sibling. See [Variables](scenes_v2__09_variables#variables).
- **Update Scene v2 Overlay** - Change the [overlay](scenes_v2__15_overlay_features#overlay-features) window configuration: position (X/Y), size (width/height), and blocking mode. Changes can be animated with a transition duration and easing curve. Screen ID is required.

### Dismiss Scene v2

Closes a displayed layout. Set **Screen ID** to the ID of the display to close. If Screen ID is empty, every active Scene v2 display is dismissed.

### Run Scene v2 Action

Invokes a named action on a component in an active layout and collects any output the action produces. This is the imperative counterpart to component event handlers - instead of waiting for the user to interact, the task drives the component directly (for example, focusing a text input). Arguments:

- **Screen ID** - the active display containing the component (required).
- **Element ID** - the component to act on (required).
- **Action Name** - the action to run (required). Component types support different actions; use the magnifying glass to browse available actions for the picked component.
- **Names** / **Values** - optional comma-separated parameter names and matching values. They only appear when the chosen action takes parameters, and the two lists must have the same number of entries.

The action fails if no scene is active with the given Screen ID, or if the parameter name and value counts differ. If the invoked action returns values, each is set as an output variable named by the action.

### Get Scene v2 Values

Reads the current output variable values from an active layout without waiting for the user to dismiss it. Arguments:

- **Screen ID** - the active display to read from (required).
- **Element ID** - optional; identifies a specific element to read (for example, a TextInput or a Switch). Use the magnifying glass to browse the elements in the picked layout.
- **Property** - optional; the specific property of the chosen element to read (for example a TextInput's text or a Switch's checked state). The magnifying glass lists the properties available on the selected element.

The action fails if no scene is active with the given Screen ID. With no Element ID it sets every output variable currently held by the layout, named by the scene. When both Element ID **and** Property are supplied, it instead reads that one property's current live value and returns it in the action's **Value** output variable (an array when the element resolves to multiple values). Use this to poll a long-lived overlay's state on demand.

### Wait For Scene v2 Result

Blocks the calling task until a layout returns a result, then sets result output variables. Use it with a layout that was shown by a non-"WithResult" display mode (so the **Show Scene v2** action did not block): show the layout, do other work, then call this action when you need its result. Arguments:

- **Screen ID** - the active display to wait on (required).
- **Timeout (ms)** - the maximum time to wait. If the layout is not dismissed within this time, the action fails. Leave empty or set to 0 to wait indefinitely.

The action fails if no scene is active with the given Screen ID, or if the layout is dismissed without a result or times out. On success it sets the same output variables as **Show Scene v2**: `%sv2_element_id`, `%sv2_scene_name`, `%sv2_screen_id`, `%sv2_element_path`, `%sv2_interaction_type`, the `%sv2_swipe_*` variables when relevant, and any output variables defined by the layout.

### Triggering Tasker Tasks From a Layout

To run a Tasker task from inside a layout:

1. Select a component and go to the Event Handling tab
2. Add a handler with action type **Run Task**
3. Enter the Tasker task name
4. Optionally set variables to be sent to that task with the values you want - these are accessible as local variables in the Tasker task
5. Optionally set a priority; leave it blank to run at maximum priority

The called task also automatically receives these scoped local variables:

- `%sv2_scene_name` - the scene name
- `%sv2_screen_id` - the runtime Screen ID of the display
- `%sv2_element_id` - the ID of the element that triggered the action
- `%sv2_element_path` - the element's path in the component tree (e.g., `root.header.confirm_btn`)
- `%sv2_element_value` - the element's current value (e.g., text content, switch state)
- `%sv2_interaction_type` - the interaction that triggered the handler (e.g., `single`, `long_press`, `swipe`)

For **swipe** interactions, the task additionally receives the swipe path:

- `%sv2_swipe_path_x()` - array of X coordinates (dp) of each point in the swipe path
- `%sv2_swipe_path_y()` - array of Y coordinates (dp) of each point in the swipe path
- `%sv2_swipe_length` - total swipe length
- `%sv2_swipe_direction` - the swipe direction

Index 1 is the start point and the last index is the end point. Intermediate indices represent simplified waypoints along the gesture. Any output variables the layout defines are also passed to the task as local variables.
