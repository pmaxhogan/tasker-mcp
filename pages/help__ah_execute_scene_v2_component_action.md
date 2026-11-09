# Run Scene v2 Action

Source: https://tasker.joaoapps.com/userguide/en/help/ah_execute_scene_v2_component_action.html

Runs a built-in action on an element of a currently visible Scene V2, the same way the in-scene **Run Component Action** action does. Use it to control a scene from a task, for example to focus a **TextInput**, toggle a **Switch**, seek a **Video** or reload a **WebView**.

**Screen ID** is required and must match the Screen ID used when the scene was shown.

**Element ID** is required and must refer to an element that is currently rendered in that scene. Use the magnifying glass to pick from the elements in one of your scenes.

**Action Name** is the action to run, such as **focus**, **toggle**, **play** or **seek**. Each element type supports its own set of actions; use the magnifying glass to see the actions available for the chosen element.

**Names** and **Values** are optional comma-separated lists that pass parameters to the action, and must have the same number of items. They are only shown for actions that take parameters. Use the magnifying glass on **Names** to browse the parameter names of the selected action. For example, the **seek** action of a **Video** takes **position**, in milliseconds, so **Names**=**position** and **Values**=**30000** jumps to 30 seconds. You can use Tasker arrays directly in **Values**.

Some actions return values. These are set as local variables named after the action's outputs, and are listed in this action's output variables once an action that returns something is selected. For example, **togglePlayback** on a **Video** returns **is_playing**.

The action fails if no scene with the given Screen ID is currently showing, or if **Names** and **Values** have a different number of items.

Check [Scenes V2 (Screen Builder) Manual](scenes_v2) for full details on how Scenes V2 work.
