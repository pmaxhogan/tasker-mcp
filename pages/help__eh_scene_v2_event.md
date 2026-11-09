# Scene V2 Event

Source: https://tasker.joaoapps.com/userguide/en/help/eh_scene_v2_event.html

Triggers when the user interacts with an element in a Scene V2 (taps, long-presses, swipes, or changes its value).

Use this event to react to interactions on scenes shown via the **Show Scene V2** action without having to wire each component up to its own task.

Set **Scene Name** to only react to interactions on a specific scene. Leave empty to match any scene. Pattern matching is supported (see [Pattern Matching](matching) in the Userguide).

Set **Element ID** to only react to interactions on a specific element. Leave empty to match any element on the scene. Pattern matching is supported.

Set **Interaction Type** to only react to a specific kind of interaction. Leave empty to match any interaction. Generic gesture types apply to almost any element:

- **single** - a single tap
- **multi_2**, **multi_3**, ... - a double tap, triple tap, and so on
- **long_press** - a long press
- **swipe** - a swipe gesture (when the swipe ends, swipe-related output variables are populated)

On top of the generic gestures, each component type defines its own interaction types for things that only make sense for it. A few examples:

- **text_changed** - fired by **TextInput** when its text changes
- **checked_changed** - fired by **Switch** / **Checkbox** when toggled
- **slider_value_changed** - fired by **Slider** when its value changes

To find out exactly which interaction types are supported by a given component, open the scene in the Scenes V2 editor, select the component, and look at its **Interaction** tab: every entry there corresponds to one interaction type that this event can match. New component types added in future versions will expose their own types in the same place.

Pattern matching works on this field too, so you can use values like **single/long_press** to match more than one interaction type at once.

Output variables are added dynamically based on the selected **Scene Name** and **Element ID**: each component on the scene that produces a value contributes its own variable, and swipe interactions add extra variables describing the gesture (start/end positions, direction, distance, etc.). The full list is shown in the event's configuration screen.

Check [Scenes V2 (Screen Builder) Manual](scenes_v2) for full details on how Scenes V2 work.
