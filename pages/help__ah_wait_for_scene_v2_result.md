# Wait For Scene V2 Result

Source: https://tasker.joaoapps.com/userguide/en/help/ah_wait_for_scene_v2_result.html

Wait for a currently visible Scene V2 to be dismissed and return its result.

This action is useful when a scene was shown with **Continue Task Immediately** enabled in the **Show Scene V2** action, and you want to wait for a response at a later point in your task.

**Screen ID** is required and must match the ID of the scene you want to wait for. The scene must already be visible.

Set **Timeout (ms)** to specify a maximum wait time in milliseconds. If the scene is not dismissed within this time, the action will fail. Leave empty to wait indefinitely.

When the scene is dismissed, the result will be returned in the output variables shown in the action's configuration.

Check [Scenes V2 (Screen Builder) Manual](scenes_v2) for full details on how Scenes V2 work.
