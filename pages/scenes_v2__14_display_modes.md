# Tasker Scenes V2 Manual: Display Modes

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#display-modes

Section 14 of [Tasker Scenes V2 Manual](scenes_v2) (Display & Overlays).

When showing a layout from Tasker, you choose how it appears. Each base mode has a plain variant and a "WithResult" variant:

**Fullscreen** / **Fullscreen With Result** - The layout fills the entire screen as a standalone activity. Best for complex screens like dashboards or full-page forms.

Screenshot: A small confirmation layout shown in Fullscreen mode

**Dialog** / **Dialog With Result** - A floating dialog window with the rest of the app visible behind it. Good for quick confirmations, input prompts, or notifications that need a response.

Screenshot: The same layout shown in Dialog mode

**Overlay** / **Overlay With Result** - A floating window that sits on top of other apps. This is the most flexible mode - see [Overlay Features](scenes_v2__15_overlay_features#overlay-features) for the full range of options.

Screenshot: The same layout shown as an Overlay on top of another app

**Accessibility Overlay** / **Accessibility Overlay With Result** - The same floating overlay, but shown through Tasker's accessibility service so it can appear above surfaces a normal overlay cannot cover, like the lock screen. These two appear only in the scene's [default display mode](scenes_v2__13_screen_properties#screen-properties) list in the editor. In the **Show Scene v2** action you get the same result by picking **Overlay** (or **Overlay With Result**) and enabling [**Show Over Everything**](scenes_v2__15_overlay_features#overlay-features-show-over-everything). Either way, Tasker's accessibility service has to be enabled.

**Dream** - The layout runs as an Android screen saver (daydream), shown by the system when the device is docked or charging and idle, in place of the built-in screen saver. Unlike the other modes, running **Show Scene v2** with Dream doesn't show anything right away: it sets that scene as the one Tasker uses as a screen saver, and Tasker remembers it even after a reboot. Running it again with another scene replaces it, and **Dismiss Scene v2** with the same Screen ID removes it.

To use it, pick **Tasker Scene** as the screen saver in your device's **Settings > Display > Screen saver** (the exact path varies by device) and choose when screen savers start. The system starts and stops the screen saver; Dream layouts are fully interactive while showing. When you first pick Dream mode in the action, Tasker shows a one-time note explaining this.

Note: Some devices (for example, Pixels) may not let you pick third-party screen savers, or may switch back to a system screen saver even after you select one.

If you leave the Display Mode argument empty in the **Show Scene v2** action, the scene's own [default display mode](scenes_v2__13_screen_properties#screen-properties) is used, together with the scene's default overlay settings. The action's overlay arguments are then ignored, so to use them, pick **Overlay** or **Overlay With Result** in the action.

### With Result vs Plain Variants

The "WithResult" variant of a mode is what controls whether the **Show Scene v2** action waits. There is no separate "continue task" toggle.

- **Plain variants** (`Fullscreen`, `Dialog`, `Overlay`) - the action shows the layout and the task continues immediately, without waiting for a result. Use this for persistent overlays like status bars or floating controls that should stay visible while the task does other work.
- **"WithResult" variants** (`FullscreenWithResult`, `DialogWithResult`, `OverlayWithResult`) - the action blocks the calling task until the layout is dismissed, then sets the result output variables described in [Tasker Actions](scenes_v2__12_tasker_actions#tasker-actions).

To show a non-blocking layout and collect its result later, use a plain variant and call the **Wait For Scene v2 Result** action when you need the result. When the Display Mode argument is left empty, the scene's default display mode decides whether the action waits.

### Auto-dismiss

The **Show Scene v2** action has an **Auto Dismiss (ms)** argument. Set a timeout in milliseconds to automatically dismiss the layout after that delay. Leave it empty or set it to 0 to keep the layout visible until it is dismissed manually (by a dismiss handler or the **Dismiss Scene v2** action).

With a "With Result" mode, an auto dismiss counts as closing without a result: the action fails with "Scene dismissed without result or timed out", so turn on **Continue Task After Error** if the task should go on.

### Physical Display Targeting

On devices with multiple displays (e.g., foldables with external screens, connected monitors), you can target a specific display by its ID with the **Physical Display** argument. Use the magnifying glass in the action to pick from connected displays. If the chosen display ID is not connected, the action fails. Leave the argument empty to use the primary display.

### Long-Click Root To Dismiss

For overlay modes, enable **Long-Click Root To Dismiss** to let users dismiss the overlay by long-pressing anywhere on it. This adds a temporary dismiss handler to the root component at runtime without modifying the scene definition. If an overlay has no other dismiss mechanism configured, Tasker offers to enable this option when you save the action.

All non-Dream modes use the same **ID-based system**: showing a layout with the Screen ID of an already-active display updates it in place. Using a new Screen ID launches a new display. This lets you stack multiple layouts or update existing ones.

Warning: Overlay mode requires the "Display over other apps" permission. Tasker will prompt you to grant it when needed. For overlays that need to appear over the lock screen or notification tray, use the "Show Over Everything" option (requires the Tasker accessibility service).
