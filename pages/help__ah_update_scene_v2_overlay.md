# Update Scene V2 Overlay

Source: https://tasker.joaoapps.com/userguide/en/help/ah_update_scene_v2_overlay.html

Update the overlay configuration of a currently visible Scene V2 that was shown in **Overlay** mode.

This action lets you change the overlay's position, size, and blocking behavior after it has been shown.

**Screen ID** is required and must match the ID of the overlay scene you want to update.

Set **X Position** and **Y Position** to move the overlay to a new position on screen. Values can be:

- A positive number (e.g. **100**) - the overlay's left/top edge is placed that many dp from the left/top of the screen.
- A negative number (e.g. **-20**) - the overlay's right/bottom edge is placed that many dp from the right/bottom of the screen.
- A positive percentage (e.g. **50%**) - centers the overlay at that percentage from the left/top.
- A negative percentage (e.g. **-50%**) - centers the overlay at that percentage from the right/bottom.

Set **Width** and **Height** to resize the overlay. Values can be a number in dp (e.g. **200**) or a percentage of the screen size (e.g. **50%**).

Set **Blocking** to control whether the overlay intercepts touch events or lets them pass through to the apps behind it.

Set **Transition Duration (ms)** to animate the changes smoothly over the specified number of milliseconds (default is 400ms). Set **Transition Easing** to choose the animation curve.

Only the fields you fill in will be updated. Leave a field empty to keep its current value.

Check [Scenes V2 (Screen Builder) Manual](scenes_v2) for full details on how Scenes V2 work.
