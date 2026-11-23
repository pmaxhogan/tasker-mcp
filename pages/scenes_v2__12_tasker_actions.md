# Tasker Scenes V2 Manual: Tasker Actions

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#tasker-actions

Section 12 of [Tasker Scenes V2 Manual](scenes_v2) (Making It Interactive).

Scenes V2 aren't just a way to draw a screen: every part of a scene can be controlled from your tasks. Tasker has eight actions for working with Scene v2 layouts, all in the **Scene v2** action category, plus a [Scene V2 Event](scenes_v2__12_tasker_actions#tasker-actions-event) to react to them from a profile:

- [**Show Scene v2**](scenes_v2__12_tasker_actions#tasker-actions-show) - show a scene in full screen, as a dialog or as an overlay, or set it as the screen saver
- [**Update Scene v2**](scenes_v2__12_tasker_actions#tasker-actions-updating) - change anything in a scene while it's showing
- [**Update Scene v2 Overlay**](scenes_v2__12_tasker_actions#tasker-actions-updating) - move and resize an overlay
- [**Get Scene v2 Values**](scenes_v2__12_tasker_actions#tasker-actions-get-values) - read its values at any time
- [**Wait For Scene v2 Result**](scenes_v2__12_tasker_actions#tasker-actions-wait-result) - wait for the user to finish and get the result
- [**Run Scene v2 Action**](scenes_v2__12_tasker_actions#tasker-actions-run-action) - control a component, like focusing a text box or seeking a video
- [**Trigger Scene v2 Event**](scenes_v2__12_tasker_actions#tasker-actions-trigger-event) - fire a component's event handlers, like "clicking" a button from a task
- [**Dismiss Scene v2**](scenes_v2__12_tasker_actions#tasker-actions-dismiss) - close it

Most of this is also available from the [Java Code](scenes_v2__12_tasker_actions#tasker-actions-java-code) action, and WebView components can call Tasker actions directly from JavaScript (see [JavaScript Bridge](scenes_v2__05_general#webview-js-bridge)).

### Variables

Use Tasker `%variables` to display dynamic data in your layouts:

- Add a **Variable** component and set its key (e.g., `%content`) - Tasker can replace it with text or even entire component trees at runtime
- Use `%variables` directly in text content and other string properties for runtime replacement (e.g., `Battery: %BATT%%`)

See [Variables](scenes_v2__09_variables#variables) for full details. For layout-internal shared values, see the [Provides System](scenes_v2__08_provides#provides).

### Show Scene v2

Shows a layout. This is the main action. Key arguments:

- **Name/JSON** - the saved scene to show (use the magnifying glass to pick one), or a layout's JSON, for a scene that isn't saved separately.
- **Screen ID** - the runtime ID for this display. Showing a layout with the ID of an already-active display updates it in place; a new ID launches a new display, so give each copy of the same scene its own ID if you want to show several at once. If left empty, the scene name is used (for inline JSON, the screen's `name`).
- **Display Mode** - how the layout appears: Fullscreen, Dialog or Overlay (each also "With Result"), or Dream to set it as the screen saver. See [Display Modes](scenes_v2__14_display_modes#display-modes). If left empty, the scene's own default display mode is used.
- **Overlay arguments** - X/Y position, width, height, blocking, show/dismiss animation, Long-Click Root To Dismiss, Show Over Everything and Drag Off Screen. These only apply when the action's Display Mode is set to **Overlay** or **Overlay With Result**. If Display Mode is left empty, the scene's own defaults are used and these arguments are ignored, even when the scene's default mode is an overlay and the action shows them. See [Overlay Features](scenes_v2__15_overlay_features#overlay-features).
- **Auto Dismiss (ms)** - dismiss the layout automatically after this many milliseconds. Leave empty or set to 0 to keep it until dismissed manually. With a "With Result" mode, an auto dismiss counts as closing without a result: the action fails with "Scene dismissed without result or timed out" (turn on **Continue Task After Error** to handle it).
- **Physical Display** - the ID of the display to show on. Leave empty for the primary display.

The action's output variable list shows every variable the picked scene can return, so you can pick them in later actions.

Screenshot: The Show Scene v2 action with Display Mode set to Overlay, with the overlay itself running on top, centered by X and Y Position 50%

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

The tap position variables `%sv2_tap_x` and `%sv2_tap_y` are not set by this action (or by **Wait For Scene v2 Result**), even though they can appear in its output variable list. They are set for a task run by a [Run Task](scenes_v2__12_tasker_actions#tasker-actions-triggering) event action and for the [Scene V2 Event](scenes_v2__12_tasker_actions#tasker-actions-event).

If the scene closes with a [Cancel Screen](scenes_v2__11_interactions#interactions-dismissing) event action, the action fails instead, with the cancel message in `%errmsg`. Turn on **Continue Task After Error** to handle that in the task.

In addition, any **output variables** defined by the layout are set with the values they hold when the layout is dismissed. Output variables are named by the scene; the action picks them up by name. See [Variables](scenes_v2__09_variables#variables).

### Updating Layouts Dynamically

Two actions change an already-displayed layout without closing and re-showing it:

- **Update Scene v2** - Change a property of a component by its ID: text content, colors, visibility, modifiers, and more. Set Element ID, Property, and Value. The Property and Value fields are hidden until an Element ID is entered. You can also enable **Local Variable Passthrough** to send all current task variables to the scene, optionally restricted with **Limit Passthrough To**: a comma-separated list of variable names (like `%name,%count`), or, without a comma, a Tasker pattern matched against each variable name (like `%item*`, or `%name/%count` for either one). Passthrough runs even when no Element ID is set. Changing a local variable in the task does nothing to the scene on its own: run Update Scene v2 with Local Variable Passthrough on (it is off by default). With passthrough off and no Element ID, the action changes nothing. If Screen ID is empty, the update applies to every active Scene v2 display. This also works for elements inside Variable component expansions - use the suffixed ID (e.g. `title_2`) to target a specific sibling. See [Variables](scenes_v2__09_variables#variables).
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

### Trigger Scene v2 Event

Fires the event handlers set up on an element of an active layout, as if the event had really happened - the task-side version of the [Trigger Event](scenes_v2__11_interactions#interactions) event action. Use it to "click" a button, mark an input as changed and so on, without anyone touching the screen. Only the element's handlers run; there's no ripple or other visual feedback. Arguments:

- **Screen ID** - the active display containing the element (required).
- **Element ID** - the element whose handlers should run (required). Use the magnifying glass to pick one.
- **Event ID** - the event to fire, such as `click`, `hold`, `multi_click` or `text_changed`. Every handler on the element that listens for it runs. The magnifying glass lists the events configured on the element.
- **Event Param Names / Values** - optional comma-separated lists that pick one handler when several listen for the same event. For example, `count` = `2` fires only the handler for a double `multi_click`.
- **Event Output Names / Values** - optional comma-separated lists of values to hand to the handlers as if the event had produced them, for example `text` = `hello`. Tasker arrays can be used in the values.

The action fails if no scene is active with the given Screen ID, the element isn't found or has no handler for that event (or none matching the params), or a Names list doesn't have the same number of items as its Values list. Variables set by the handlers, including in a Screen Hidden handler when the event closes the scene, are available to the task right after the action.

### Get Scene v2 Values

Reads the current output variable values from an active layout without waiting for the user to dismiss it. Arguments:

- **Screen ID** - the active display to read from (required).
- **Element ID** - optional; identifies a specific element to read (for example, a TextInput or a Switch). Use the magnifying glass to browse the elements in the picked layout.
- **Property** - optional; the specific property of the chosen element to read (for example a TextInput's text or a Switch's checked state). The magnifying glass lists the properties available on the selected element.

The action fails if no scene is active with the given Screen ID. It always sets every output variable currently held by the layout, named by the scene. When both Element ID **and** Property are supplied, it also reads that one property's current live value into `%sv2_value` (when the element resolves to several values, `%sv2_value` holds the first and the `%sv2_value()` array holds them all). Use this to poll a long-lived overlay's state on demand.

### Wait For Scene v2 Result

Blocks the calling task until a layout returns a result, then sets result output variables. Use it with a layout that was shown by a non-"WithResult" display mode (so the **Show Scene v2** action did not block): show the layout, do other work, then call this action when you need its result. Arguments:

- **Screen ID** - the active display to wait on (required).
- **Timeout (ms)** - the maximum time to wait. If the layout is not dismissed within this time, the action fails. Leave empty or set to 0 to wait indefinitely.

The action fails if no scene is active with the given Screen ID, or if the layout is dismissed without a result or times out. On success it sets the same output variables as **Show Scene v2**: `%sv2_element_id`, `%sv2_scene_name`, `%sv2_screen_id`, `%sv2_element_path`, `%sv2_interaction_type`, the `%sv2_swipe_*` variables when relevant, and any output variables defined by the layout.

### Scene V2 Event

The **Scene V2 Event** is a Tasker event (in the event list when you add a profile) that triggers when someone interacts with an element in any Scene V2 - taps, long-presses, swipes or changes a value. It lets a profile react to a scene without wiring each component to its own task. Its filters:

- **Scene Name** - only react to this scene. Empty matches any scene.
- **Element ID** - only react to this element. Empty matches any element.
- **Interaction Type** - only react to this kind of interaction. Empty matches any. The generic gestures are `single` (tap), `multi_2`, `multi_3`, ... (double tap, triple tap, ...), `long_press` and `swipe`; components add their own, like `text_changed`, `checked_changed` or `slider_value_changed`. The events on a component's Event Handling tab are the types it supports.

All three fields support Tasker pattern matching, so `single/long_press` matches either. The task gets the same `%sv2_*` variables as a task run from the layout (see below), plus a variable for each value the scene's components produce. The full list depends on the scene and element you pick and is shown in the event's configuration screen.

### Java Code

The **Java Code** action has functions to show, update, dismiss and listen to scenes, so you can drive a scene from code as fast as you need - fast enough to update one 60 times per second for a smooth timer or animation:

- `tasker.showSceneV2(...)` and `tasker.showSceneV2ForResult(...)` - show a scene by name or JSON, with optional Screen ID, display mode and overlay options; the second returns the result when the scene closes
- `tasker.updateSceneV2(elementId, property, value[, screenId])` and `tasker.updateSceneV2Overlay(screenId, x, y[, width, height, ...])`
- `tasker.dismissSceneV2(screenId)`, `tasker.dismissAllScenesV2()` and `tasker.isSceneV2Active(screenId)`
- `tasker.waitForSceneV2Result(screenId[, timeoutMs])`, `tasker.waitForSceneV2Event(...)` and `tasker.getSceneV2Events(...)` - wait for, or keep listening to, interactions with a scene

There are no Java Code functions for **Get Scene v2 Values**, **Run Scene v2 Action** or **Trigger Scene v2 Event**; use those actions in the task instead.

See the [Java Code help](help__ah_java_code) for every variant and examples.

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

Index 1 is the start point and the last index is the end point. Intermediate indices represent simplified waypoints along the gesture. For taps (click, multi-click and hold) the task also gets `%sv2_tap_x` and `%sv2_tap_y`, the touch position in dp within the element. Any output variables the layout defines are also passed to the task as local variables.
