# Update Scene V2

Source: https://tasker.joaoapps.com/userguide/en/help/ah_update_scene_v2.html

Update a property of an element in a currently visible Scene V2.

Set **Screen ID** to the ID of the scene you want to update. If left empty, the update will be applied to **all** currently visible Scene V2 screens that contain a matching element.

Set **Element ID** to the ID of the element you want to modify. You can browse for available elements using the search icon. If **Element ID** is left empty, no element property will be updated, but variable passthrough (see below) will still work.

Set **Property** to the name of the property you want to change (e.g. **text**, **color**, **checked**, **url**, etc.).

Set **Value** to the new value for the property.

Enable **Variable Passthrough** to pass all local task variables to the scene. The scene can then reference them with the **%variable_name** syntax. Use **Limit Passthrough** to only pass variables matching a specific pattern.

Check [Scenes V2 (Screen Builder) Manual](scenes_v2) for full details on how Scenes V2 work.
