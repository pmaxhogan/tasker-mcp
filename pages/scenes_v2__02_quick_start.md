# Tasker Screen Builder Manual: Quick Start

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#quick-start

Section 2 of [Tasker Screen Builder Manual](scenes_v2) (Getting Started).

Build your first interactive screen in 5 steps.

1. **Create a new scene** - In Tasker, go to the SCENES tab and tap Add. Enter a name for the scene. A **Scene Type** dialog asks which kind of scene to create:
  - **Legacy** - The original Tasker scene editor.
  - **Modern (V2)** - The Screen Builder covered by this manual.
  Choose **Modern (V2)**. The Screen Builder editor opens.
  Screenshot: The Scene Type dialog with Legacy and Modern options
2. **Pick a starting point** - A brand-new scene has no content, so the editor opens a **What do you want to create?** dialog. It offers:
  - **Simple Layout** - A blank canvas: a single container holding one Text component. Best for simple custom designs where you want full control.
  - **Full Page Layout** - A complete page with a top bar, a navigation bar, and a floating action button already set up. Best for app-like screens.
  Any layout templates you have saved appear below these two. Choose **Simple Layout**. The editor fills with a centered Column containing a single Text component.
  Screenshot: The starting point dialog with Simple Layout and Full Page Layout
3. **Edit the Text** - Tap the Text in the **preview**. The first tap selects it - it gets highlighted in the preview and in the Elements tree. Tap it again to jump to the **Settings** tab, where you edit the selected component. You can also select components by tapping them in the Elements tree. Change the text content to "Hello, World!"
  Screenshot: Selecting the Text in the preview and editing its content
4. **Add a Button** - Go to the **Elements** tab. With the Text still selected, tap the "+" floating action button. It expands into placement options - choose **Add After** to insert a sibling below the Text. Pick Button from the component list. The Button appears right after the Text inside the Column and becomes the new selection. On the Settings tab, change its label to "Close".
  Screenshot: Adding a Button after the Text
5. **Make the Button close the screen** - With the Button selected, switch to the [**Event Handling**](scenes_v2__11_interactions#interactions) tab. Tap **Add handler**, select the **Click** event, then add a **Dismiss Layout** action to that handler. Now tapping the Button closes the screen. Any variables the screen wrote during its lifetime are returned to the Tasker task that showed it.
  Screenshot: A Click handler with a Dismiss Layout action

The preview panel updates live as you edit. Drag the separator between the editor and the preview to resize either side. When you are happy with the screen, tap Save. Use the **Show Scene v2** action in a Tasker task to display it as a [fullscreen screen, dialog, overlay, or screensaver](scenes_v2__14_display_modes#display-modes).

Tip: You can undo any change - the editor keeps full undo history, and long-pressing the undo or redo button shows the history list. Experiment freely. When you are comfortable with the basics, start a new scene and pick **Full Page Layout** to begin with a ready-made app structure.
