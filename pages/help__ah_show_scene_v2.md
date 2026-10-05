# Show Scene V2

Source: https://tasker.joaoapps.com/userguide/en/help/ah_show_scene_v2.html

Show a Scene V2 on screen. You can pick a previously created scene by name or provide raw JSON directly.

Scenes can be displayed in 3 modes: **Fullscreen** (takes over the whole screen), **Dialog** (centered window) or **Overlay** (floating window on top of other apps).

In **Overlay** mode you can configure the position (**X Position**, **Y Position**), size (**Width**, **Height**), whether it is **Blocking** (intercepts touches) or passthrough, and enter/exit animations.

**X Position** and **Y Position** accept the following value formats:

- A positive number like **100** - the overlay's left/top edge is placed that many dp from the left/top of the screen. For example, an X of **100** places the overlay's left edge 100dp from the left of the screen.
- A negative number like **-20** - the overlay's right/bottom edge is placed that many dp from the right/bottom of the screen. For example, an X of **-20** places the overlay's right edge 20dp from the right of the screen, and a Y of **-0** places the overlay's bottom edge flush against the bottom.
- A positive percentage like **50%** - centers the overlay at that percentage from the left/top. For example, an X of **50%** centers the overlay horizontally on screen.
- A negative percentage like **-25%** - centers the overlay at that percentage from the right/bottom. For example, a Y of **-25%** centers the overlay vertically at 25% from the bottom of the screen.

**Width** and **Height** accept a number in dp (e.g. **200**) or a percentage of the screen size (e.g. **50%**).

If **Continue Task Immediately** is disabled, the task will wait until the scene is dismissed before continuing. The scene's dismiss result will be returned in the output variables shown in the action's configuration.

Use **Screen ID** to give the scene a custom identifier. This ID can then be used in other Scene V2 actions (Update, Dismiss, etc.) to target this specific scene. If left empty, the scene's own name is used as the ID.

Use **Auto Dismiss (ms)** to automatically dismiss the scene after a specified number of milliseconds.

Enable **Show Over Everything** (requires the Tasker Accessibility Service) to show overlays on top of all apps, including the lock screen and status bar.

Enable **Long Click Root To Dismiss** to be able to dismiss an overlay by long-clicking on the root element. This is useful as a safety net so overlays are never stuck on screen.

Check [Scenes V2 (Screen Builder) Manual](scenes_v2) for full details on how Scenes V2 work.
