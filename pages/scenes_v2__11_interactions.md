# Tasker Screen Builder Manual: Event Handlers & Actions

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#interactions

Section 11 of [Tasker Screen Builder Manual](scenes_v2) (Making It Interactive).

Make your layouts respond to user input by attaching event handlers to components, or to the screen itself. A handler listens for one or more events and runs a list of actions when any of them fires.

### The Handler Model

Every component, and the screen, has an `eventHandlers` object:

```
"eventHandlers": {
  "handlers": [ ... ],
  "stopPropagation": false
}
```

Each entry in `handlers` is one handler:

```
{
  "events": [ { "type": "click" } ],
  "condition": "%count < 10",
  "actions": [
    { "type": "ToggleVariable", "variable": "isOpen" }
  ]
}
```

A handler has three parts:

- **events** - One or more events that can fire this handler. If *any* listed event occurs, the handler runs. Each event entry is an object with a `type` discriminator and optional type-specific properties.
- **condition** - Optional. A boolean expression. When set, the handler only runs if the expression is `true` at the moment the event fires. The expression uses the same syntax as [Conditional Visibility](scenes_v2__10_show_when#show-when), and can reference screen variables *and* the firing event's own output values by their key name.
- **actions** - An ordered list of actions. When the handler fires (and the condition passes), every action runs in order, top to bottom.

A single component can have several handlers. Use separate handlers when different events need different actions - for example one handler for `click` that runs a task, and another for `swipe` that sets a variable.

#### Stop Propagation

`stopPropagation` is a boolean on the `eventHandlers` object (default `false`). When a component sits inside a container that also has handlers, an event on the child normally also reaches the parent. Set `stopPropagation` to `true` on the child to stop the event there, so the parent's handlers do not fire for it.

### Setting Up Handlers in the Editor

Handlers are configured on the **Event Handling** tab:

1. Select a component in the Elements tree, or deselect everything to edit the screen's own handlers.
2. Switch to the **Event Handling** tab.
3. Tap **Add handler**.
4. Tap the event chips to pick one or more events. Only events that apply to the selected component are shown.
5. If an event has properties (for example Multi Click's count), an input for them appears below the chips.
6. Optionally fill in the **Only trigger when** condition.
7. Add one or more actions. Tap **Add action**, pick an action type, and configure it. Reorder actions by dragging.

The **Stop propagation** toggle sits at the top of the tab when a component is selected.

### Event Types

Each component supports a different set of events. **Every** component supports the pointer/gesture events. Input components add their own value events, and some components add their own state events. The screen supports only the screen-level events.

#### Pointer & Gesture Events

Available on every component.

| Event (`type`) | Name | Fires when | Properties | Output values |
| --- | --- | --- | --- | --- |
| `click` | Click | The component is tapped. | None | None |
| `multi_click` | Multi Click | The component is tapped a specific number of times in quick succession. | `count` - number of taps required (default `2`) | None |
| `hold` | Hold | The component is pressed and held. | `duration` - hold time in milliseconds before the event fires (default `500`) | None |
| `swipe` | Swipe | A swipe gesture is performed on the component. | None | `direction` (`Up`, `Down`, `Left`, `Right`), `length` (swipe distance in dp) |

#### Input-Value Events

Fire when an input component's value changes. Each is available only on the matching component.

| Event (`type`) | Name | Fires when | Output values | Component |
| --- | --- | --- | --- | --- |
| `checked_changed` | Checked Changed | A Switch or Checkbox is toggled. | `checked` (boolean) | Switch, Checkbox |
| `text_changed` | Text Changed | The text in a TextInput changes. | `text` (string) | TextInput |
| `slider_value_changed` | Slider Value Changed | A Slider is moved. | `value` (number), `percent` (number) | Slider |
| `range_slider_value_changed` | Range Value Changed | A RangeSlider's start or end thumb is moved. | `start`, `end`, `start_percent`, `end_percent` (numbers) | RangeSlider |
| `selection_changed` | Selection Changed | An item is selected or deselected. | `selected_index` (number), `selected` (boolean) | SegmentedButtonRow, Dropdown |
| `nav_selection_changed` | Selection Changed | A different item in a NavigationBar is selected. | `selected_index` (number) | NavigationBar |

#### Component-State Events

| Event (`type`) | Name | Fires when | Output values | Component |
| --- | --- | --- | --- | --- |
| `expanded_changed` | Expanded Changed | A Dropdown opens or closes. | `expanded` (boolean) | Dropdown |
| `animation_completed` | Animation Completed | A ProgressBar's value animation finishes. | None | ProgressBar |
| `ready` | Camera Ready | The Camera binds a lens and the preview goes live. | `lens` (string - the bound lens) | Camera |
| `error` | Error | A Camera fails to open or bind a lens (permission denied, no camera, and similar), or a Video fails to play after its fallback engine is exhausted. | `code` (string), `message` (string) | Camera, Video |
| `page_loaded` | Page Loaded | A WebView page finishes loading. | `url` (string), `title` (string) | WebView |
| `page_error` | Page Error | A WebView load fails. | `url` (string), `error_code` (string), `description` (string) | WebView |
| `url_changed` | URL Changed | A WebView's current URL changes (navigation, redirect, history). | `url` (string) | WebView |
| `console_message` | Console Message | A WebView page logs to the JavaScript console. | `message` (string), `level` (string), `line_number` (string) | WebView |
| `progress_changed` | Progress Changed | A WebView's load progress updates. | `progress` (number, 0-100) | WebView |
| `scroll_changed` | Scroll Changed | A WebView is scrolled. | `scroll_x` (number), `scroll_y` (number) | WebView |
| `loaded` | Loaded | A Video's media becomes ready to play. | `duration` (number - milliseconds, 0 for GIFs) | Video |
| `ended` | Ended | A Video reaches the end of playback. | None | Video |
| `buffering` | Buffering | A Video's buffering state changes. | `is_buffering` (boolean) | Video |

#### Key Events

| Event (`type`) | Name | Fires when | Properties | Output values | Component |
| --- | --- | --- | --- | --- | --- |
| `key_pressed` | Key Pressed | A hardware or software key is pressed while the TextInput is focused. | `key` - key name to match (e.g. `Enter`, `Tab`); empty matches any key. `consume` - `true` to swallow the key so the field does not also process it (default `false`). | `key` (string - the pressed key's name) | TextInput |

The editor offers a key picker covering editing, navigation, function, modifier, media, system, and numpad keys. The matched key name in `key` always equals the name reported in the `key` output value.

#### Screen-Level Events

These belong to the screen itself, not to a component. Edit them by deselecting all components and opening the Event Handling tab.

| Event (`type`) | Name | Fires when | Properties | Output values |
| --- | --- | --- | --- | --- |
| `screen_shown` | Screen Shown | The layout becomes visible. | None | None |
| `screen_hidden` | Screen Hidden | The layout is hidden or closed. | None | None |
| `screen_back_pressed` | Back Pressed | The system Back gesture or button is used. | `cancelEvent` - a boolean expression. When it evaluates to `true`, the back press is consumed (the screen does not close) and only the handler runs. When `false` (the default), the handler runs and the screen still closes normally. | None |
| `screen_variable_changed` | Variable Changed | The named screen variable changes value. | `variableName` - the variable to watch, without the `%` prefix. | `value` (string - the new value) |

Note: New components and event types are added regularly. The Event Handling tab always shows the events that apply to the currently selected component, so you can discover new ones there.

### Event Output Values

Many events produce typed **output values** - data describing what happened. A `text_changed` event produces `text`; a `swipe` produces `direction` and `length`; a `slider_value_changed` produces `value` and `percent`. Output values are listed per event in the tables above.

Output values are not variables on their own. They are available to the handler in two places:

- In the handler's **condition** - reference an output value by its key name, exactly like a variable. For example, a handler on a swipe with condition `%direction == "Left"` only runs for left swipes.
- In the **OutputToVariable** action - it copies output values into screen variables so the rest of the layout (and Tasker) can use them.

This replaces the old "Output Variables" setting that input components used to carry. To turn an event's data into a variable, add an `OutputToVariable` action to the handler.

### Event Actions

Actions are what a handler does. Every handler runs its actions in order. Like events, each action is an object with a `type` discriminator.

#### Variable Actions

| Action (`type`) | Name | Does | Fields |
| --- | --- | --- | --- |
| `SetVariable` | Set Variable | Sets a screen variable to a value. | `variable` - variable name, no `%` prefix. `value` - the value to set; supports `%variable` interpolation. |
| `ToggleVariable` | Toggle Variable | Inverts a boolean screen variable. The current value is read with truthy rules (`true`/`1`/`yes`/`on` are true) and the opposite is written. | `variable` - variable name, no `%` prefix. |
| `OutputToVariable` | Output to Variable | Copies the firing event's output values into screen variables. Only offered for events that produce output values. | `bindings` - a map from each output key to one or more variable names (no `%` prefix). |

#### Component Actions

| Action (`type`) | Name | Does | Fields |
| --- | --- | --- | --- |
| `RunComponentAction` | Run Component Action | Invokes a named action on another component, found by its element ID. Use it to drive a component imperatively - focus a TextInput, animate a ProgressBar, switch a Camera lens, reload a WebView or play a Video, and so on. | `targetId` - the other component's ID. `action` - the action name (e.g. `focus`, `animate`). `params` - optional map of arguments; values support `%variable` interpolation. `resultPrefix` - optional; when set, the action's result entries are stored as variables named `%{prefix}_{key}`. |
| `SimulateInteraction` | Trigger Event | Fires the event handlers configured on another component, as if that event had really happened. No ripple or visual feedback is produced - only the handlers run. | `targetId` - the other component's ID. `eventId` - the event to simulate (e.g. `click`, `text_changed`). All handlers on the target whose `events` include that id run. `eventParams` - optional map that narrows the match to handlers whose event properties match (e.g. `{"count":"2"}` for a Multi Click of 2). `outputs` - optional map of output values to feed the simulated event; values support `%variable` interpolation. |

#### Feedback & Screen Actions

| Action (`type`) | Name | Does | Fields |
| --- | --- | --- | --- |
| `HapticFeedback` | Haptic Feedback | Triggers device vibration. See [Haptic Feedback](scenes_v2__11_interactions#interactions-haptic). | `feedbackType` - `Click` (light tap), `Heavy` (strong tap), or `Double` (double tap). Default `Click`. |
| `DismissLayout` | Dismiss Screen | Closes the layout. See [Dismissing Layouts](scenes_v2__11_interactions#interactions-dismissing). | None |

#### Tasker Actions

| Action (`type`) | Name | Does | Fields |
| --- | --- | --- | --- |
| `RunTask` | Run Task | Runs a Tasker task. See [Variables Sent to a Task](scenes_v2__11_interactions#interactions-variables). | `task` - the task name. `variables` - optional key-value map passed to the task as local variables; values support `%variable` interpolation. `priority` - optional integer; leave blank to run at maximum priority. |
| `TaskerCommand` | Tasker Command | Sends a named command string to Tasker. React to it with the Tasker **Command** event. | `command` - the command string. |

Tip: Order matters. Place `HapticFeedback` near the top of a handler so the user feels the response immediately, and `DismissLayout` last, after any `SetVariable` or `OutputToVariable` actions have recorded their values.

### Haptic Feedback

Haptic feedback is the `HapticFeedback` event action, not a standalone toggle. To make a component vibrate when tapped, add a handler for the `click` event with a `HapticFeedback` action. The `feedbackType` field controls intensity: `Click` for a light tap, `Heavy` for a strong tap, `Double` for a double tap.

```
{
  "events": [ { "type": "click" } ],
  "actions": [
    { "type": "HapticFeedback", "feedbackType": "Heavy" },
    { "type": "ToggleVariable", "variable": "isOpen" }
  ]
}
```

Because it is just an action, you can also fire it from a hold, a swipe, or any other event, and combine it with any other actions.

### Drag to Move

For [overlay](scenes_v2__15_overlay_features#overlay-features) layouts, you can make a component act as a drag handle - pressing and dragging it moves the whole overlay window. This is the **Drag to Move** toggle on the **Modifiers** tab (it is not an event handler, and not a modifier you add from the modifier list). Select the component, open the Modifiers tab, and turn on **Drag to Move**.

Drag to Move only has an effect in overlay mode. Fullscreen and dialog layouts cannot be dragged.

Note: If a component has both **Drag to Move** and a `swipe` handler, and no `hold` handler, the toggle switches to a hold-then-drag behavior: a quick swipe runs the swipe handler, while a press-and-hold starts dragging the window. This keeps both gestures usable on the same component.

WebView content can also provide its own drag handles from inside the page - see [the WebView component](scenes_v2__05_general#general-reference) (the `tasker-drag-handle` classes). That is independent of this Drag to Move toggle.

### Dismissing Layouts

To close a layout from inside it, add a `DismissLayout` action to a handler. There is no separate "dismiss gesture" or "result value" setting - dismissal is just an action, so it runs on whatever event you attach it to and alongside whatever other actions you add.

```
{
  "type": "Button", "id": "close_button", "text": "Close",
  "eventHandlers": {
    "handlers": [
      {
        "events": [ { "type": "click" } ],
        "actions": [ { "type": "DismissLayout" } ]
      }
    ]
  }
}
```

`DismissLayout` carries no result payload of its own. When the layout closes, any screen variables it wrote during its lifetime (via `SetVariable` or `OutputToVariable`) are returned to the Tasker task that showed it through the **Show Scene v2** action. To capture a TextInput's value on dismissal, give the field a `text_changed` handler with an `OutputToVariable` action so its text is always recorded into a variable before the user closes the screen.

Note: When the same event runs a `RunTask` action **and** a `DismissLayout` action, the triggered task and the task that called **Show Scene v2** run **concurrently** - there is no guaranteed order between them. If the triggered task must finish before the calling task continues, do not use `RunTask` here. Instead let the calling task continue after dismissal, or have a single task dismiss the layout itself using the **Dismiss Scene v2** action.

### Variables Sent to a Task

When a handler runs a `RunTask` action, the triggered Tasker task receives a set of local variables describing the interaction:

- `%sv2_interaction_type` - which event fired: `single` for a click, `multi_2` (the number is the click count) for a multi-click, `long_press` for a hold, `swipe` for a swipe, or the event id for other events.
- `%sv2_scene_name` - the screen name of the layout.
- `%sv2_screen_id` - the layout/screen ID.
- `%sv2_element_id` - the ID of the component whose handler ran.
- `%sv2_element_value` - that component's current value (e.g. a Switch's state).
- `%sv2_element_path` - the dotted path of the component in the layout tree.

For a `swipe` event, additional swipe variables are set:

- `%sv2_swipe_direction` - `Up`, `Down`, `Left`, or `Right`.
- `%sv2_swipe_length` - the swipe distance in dp.
- `%sv2_swipe_path_x()` - array of X coordinates along the swipe path.
- `%sv2_swipe_path_y()` - array of Y coordinates along the swipe path.

Any screen variables written during the layout's lifetime are also passed to the task as local variables. So if a `checked_changed` handler used `OutputToVariable` to map `checked` into a variable named `switch_state`, the triggered task receives `%switch_state`.

On top of all that, `RunTask` passes the entries from its own `variables` map to the task as local variables, with the values you configured.

```
{
  "events": [ { "type": "click" } ],
  "actions": [
    {
      "type": "RunTask",
      "task": "Save Settings",
      "variables": {
        "source": "settings_screen",
        "current_name": "%name_value"
      }
    }
  ]
}
```

This task can read `%source`, `%current_name`, the `%sv2_*` variables above, and any screen variables the layout wrote.

### Examples

A Switch that mirrors its state into a variable and conditionally runs a task:

```
{
  "type": "Switch", "id": "notify_switch", "checked": false,
  "eventHandlers": {
    "handlers": [
      {
        "events": [ { "type": "checked_changed" } ],
        "actions": [
          { "type": "OutputToVariable", "bindings": { "checked": [ "notify_on" ] } }
        ]
      },
      {
        "events": [ { "type": "checked_changed" } ],
        "condition": "%checked",
        "actions": [
          { "type": "TaskerCommand", "command": "notifications_enabled" }
        ]
      }
    ]
  }
}
```

A Box that vibrates and sends a command on a left swipe only:

```
{
  "type": "Box", "id": "card",
  "eventHandlers": {
    "handlers": [
      {
        "events": [ { "type": "swipe" } ],
        "condition": "%direction == \"Left\"",
        "actions": [
          { "type": "HapticFeedback", "feedbackType": "Click" },
          { "type": "TaskerCommand", "command": "card_dismissed" }
        ]
      }
    ]
  }
}
```
