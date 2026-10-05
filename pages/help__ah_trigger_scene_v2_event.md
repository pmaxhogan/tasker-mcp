# Trigger Scene v2 Event

Source: https://tasker.joaoapps.com/userguide/en/help/ah_trigger_scene_v2_event.html

Fires the event handlers configured on an element of a currently visible Scene V2, exactly as the in-scene **Trigger Event** action does. Use it to drive a scene from a task, for example to "click" a button or mark an input as changed.

Only the configured handlers run. No visual feedback is produced on the element itself.

**Screen ID** is required and must match the Screen ID used when the scene was shown.

**Element ID** is required and must refer to an element that is currently visible in that scene. Use the magnifying glass to pick from the elements in one of your scenes.

**Event ID** is the event to fire, such as **click**, **hold**, **multi_click** or **text_changed**. Every handler on the element that listens for this event runs. Use the magnifying glass to pick from the events configured on the chosen element.

**Event Param Names** and **Event Param Values** are optional comma-separated lists that pick a specific handler when several listen for the same event. For example, **Event Param Names**=**count** and **Event Param Values**=**2** only fires the handler set up for a double **multi_click**.

**Event Output Names** and **Event Output Values** are optional comma-separated lists that supply values to the fired handlers as though the event had produced them. For example, **Event Output Names**=**text** and **Event Output Values**=**hello**. You can use Tasker arrays directly in **Event Output Values**.

Each Names field must have the same number of items as its matching Values field.

The action fails if no scene with the given Screen ID is currently showing, the element is not found, the element has no handler for the chosen event (or none matching the given event params), or a Names/Values pair has a different number of items.

Check [Scenes V2 (Screen Builder) Manual](scenes_v2) for full details on how Scenes V2 work.
