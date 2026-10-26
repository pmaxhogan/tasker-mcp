# Tasker Scenes V2 Manual: Quick Start

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#quick-start

Section 2 of [Tasker Scenes V2 Manual](scenes_v2) (Getting Started).

Build your first interactive screen in 5 steps.

1. **Create a new scene** - In Tasker, go to the SCENES tab and tap Add. Enter a name for the scene. A **Scene Type** dialog asks which kind of scene to create:
  - **Legacy** - The original Tasker scene editor.
  - **Modern (V2)** - Scenes V2, covered by this manual.
  Choose **Modern (V2)**. The Scenes V2 editor opens.
  If you use Tasker's new UI, tap **NEW**, choose **Screen** and enter a name instead. New UI scenes are always Scenes V2, so there's no type to pick.
  Screenshot: The Scene Type dialog with Legacy and Modern options
2. **Pick a starting point** - A brand-new scene has no content, so the editor opens a **What do you want to create?** dialog. It offers:
  - **Simple Layout** - A blank canvas: a single container holding one Text component. Best for simple custom designs where you want full control.
  - **Full Page Layout** - A complete page with a top bar, a navigation bar, and a floating action button already set up. Best for app-like screens.
  Any layout templates you have saved appear below these two. Choose **Simple Layout**. The editor fills with a centered Column containing a single Text component.
  Screenshot: The editor after choosing Simple Layout: a centered Column holding one Text
3. **Edit the Text** - Tap the Text in the **preview**. The first tap selects it - it gets highlighted in the preview and in the Elements tree. Tap it again to jump to the **Settings** tab, where you edit the selected component. You can also select components by tapping them in the Elements tree. Change the text content to "Hello, World!"
  Screenshot: The Text selected and its content edited in the Settings tab
4. **Add a Button** - Go to the **Elements** tab. With the Text still selected, tap the "+" floating action button. It expands into placement options - choose **Add After** to insert a sibling below the Text. Pick Button from the component list. The Button appears right after the Text inside the Column and becomes the new selection. The Button arrives with a Text child holding its label; select that Text in the Elements tab and change its Text to "Close".
  Screenshot: The + button expanded into Add Before and Add After
5. **Make the Button close the screen** - With the Button selected, switch to the [**Event Handling**](scenes_v2__11_interactions#interactions) tab. Tap **Add Event Handler**, select the **Click** event, then tap **Add Action** and pick **Dismiss Screen** to that handler. Now tapping the Button closes the screen. Any variables the screen wrote during its lifetime are returned to the Tasker task that showed it.
  Screenshot: A Click handler with a Dismiss Screen action in the Event Handling tab

Screenshot: The finished screen in the preview

The preview panel updates live as you edit. Drag the separator between the editor and the preview to resize either side. When you are happy with the screen, tap Save. Use the **Show Scene v2** action in a Tasker task to display it as a [fullscreen screen, dialog, or overlay](scenes_v2__14_display_modes#display-modes), or to set it as your device's screen saver.

Tip: You can undo any change - the editor keeps full undo history, and long-pressing the undo or redo button shows the history list. Experiment freely. When you are comfortable with the basics, start a new scene and pick **Full Page Layout** to begin with a ready-made app structure.
