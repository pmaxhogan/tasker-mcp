# Tasker Scenes V2 Manual: Editor Overview

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#editor-overview

Section 3 of [Tasker Scenes V2 Manual](scenes_v2) (Getting Started).

The editor has three areas:

- **Top bar**: undo, redo, save and the overflow menu.
- **Editing panel**: a set of tabs, each focused on one aspect of the selected component or of the screen.
- **Preview**: a live rendering of your screen that updates as you edit.
- **Wide screens**: panel and preview side by side.
- **Narrow screens**: stacked. Drag the separator to resize them.

Screenshot: The editor with its top bar, tabs, editing panel and preview

### The Tabs

Tabs only appear when they apply to what you selected:

| Tab | What it's for | Shown |
| --- | --- | --- |
| [Elements](scenes_v2__03_editor_overview#editor-overview-elements) | The tree of components on your screen | Always |
| [Settings](scenes_v2__03_editor_overview#editor-overview-properties) | The selected component's properties, or the screen's | Always |
| [Modifiers](scenes_v2__03_editor_overview#editor-overview-modifiers) | Styling layers: padding, size, background, border and more | When a component is selected |
| [State](scenes_v2__03_editor_overview#editor-overview-state) | Writing the component's live values into Tasker variables | For components with values, such as a Switch or Text Input |
| [Event Handling](scenes_v2__03_editor_overview#editor-overview-interaction) | What happens when the user taps, holds, swipes and so on | Always |
| [Actions](scenes_v2__03_editor_overview#editor-overview-actions) | Commands the component can be told to perform | For components that have actions |
| [Animation](scenes_v2__03_editor_overview#editor-overview-animation) | How the component, or its children, animate in and out | When the component or one of its children has a `showWhen` condition |
| [Code](scenes_v2__03_editor_overview#editor-overview-raw-json) | The raw JSON behind the screen | Always |
| [AI](scenes_v2__03_editor_overview#editor-overview-ai) | Generating or changing the screen from a description | When AI is available |

### Top Bar and Menu

- **Undo / Redo**: the editor keeps a full undo history. Long-press either button to see the history list.
- **Save**: saves the scene.
- **Move to display**: moves the preview to another display. Only on foldables or with a connected monitor.
- **Overflow menu**:
  - **Interactive Mode**: makes the [preview](scenes_v2__03_editor_overview#editor-overview-preview) respond to taps like the real screen.
  - **Search Settings**: search properties by name. Only on the Settings tab.
  - **Variables**: opens the [Variables](scenes_v2__03_editor_overview#editor-overview-test-variables) panel with your test variables.
  - **Save as Template**, **Load Template**, **Saved Components**, **Set Templates Folder**: see [Templates](scenes_v2__03_editor_overview#editor-overview-templates).

Screenshot: The editor's overflow menu

### Elements

Your screen's structure at a glance. Components are nested inside their parents, like folders and files in a file explorer.

- **Screen node**: sits at the top. Select it to edit [Screen Settings](scenes_v2__13_screen_properties#screen-properties) on the Settings tab.
- **Select**: tap a component. The other tabs then act on it.
- **Move**: drag and drop, or use the selected row's arrows to move it up, down, or in and out of its parent.
- **Hidden components**: a component hidden by its [`showWhen`](scenes_v2__10_show_when#show-when) condition is marked with a crossed-out eye.
- **Empty screen**: shows an "Add your first element" hint. A copied container (like a Column) can be pasted as the root.

Screenshot: The Elements tab with a component selected and its move buttons visible

#### Adding Components

1. Select the component you want to add next to, or inside of.
2. Tap **+** and pick where it goes: **Add Before**/**After**, **Add as First**/**Last Child** or **Add as Parent**. (**Clone Before**/**After** copy the selection instead.)
3. Pick the component from the list. Search it, or browse by category. The **(i)** next to each one explains it, and your [saved components](scenes_v2__03_editor_overview#editor-overview-templates) are there too.

Screenshot: The + button expanded with its placement options

Screenshot: The component list, grouped by category

#### Working With Several Components

- **Selection mode**: long-press a component (or use its accessibility actions). Checkboxes appear so you can select several components.
- **Bulk actions**: select all, copy, cut or delete.
- **Paste**: above, below, inside, or as the first or last child of the selection.
- **Save as Component**: with a single component selected, saves it as a [component template](scenes_v2__03_editor_overview#editor-overview-templates).

Screenshot: Selection mode with several components checked

### Settings

Everything about the selected component:

- **General**: the component's ID, an optional **Tree Label** (a friendly name shown in the Elements tab), its [`showWhen`](scenes_v2__10_show_when#show-when) condition and, on components people interact with, [**Enabled**](scenes_v2__05_general#general-enabled).
- **The component's own properties**: text, image source, alignment and so on, grouped in sections like **Content**.
- **Provides**: on containers. Hands [values](scenes_v2__08_provides#provides) down to the components inside.
- **(i) buttons**: explain properties whose purpose isn't obvious, often with a **Learn More** link to this manual.
- **Minus and plus buttons**: on numeric properties that step by whole values.
- **Search Settings**: in the overflow menu, to find a property by name.

Screenshot: The Settings tab for a component, with an (i) button visible

With the Screen node selected (or nothing selected), this tab shows [**Screen Settings**](scenes_v2__13_screen_properties#screen-properties) instead, in collapsible sections (General, Scaling, Provides, Display):

- Screen name and description
- Default display mode and overlay defaults
- Proportional scaling reference width
- [Screen-level provides](scenes_v2__08_provides#screen_provides)
- Keep screen on
- System bar colors

Screenshot: The Settings tab showing Screen Settings

### Modifiers

The styling layers stacked on the selected component. See [Modifiers](scenes_v2__06_modifiers#modifiers) for the full list.

- **Cards**: each modifier is a card. Expand it to edit its values, including [Apply When](scenes_v2__06_modifiers#modifiers-apply-when).
- **Order**: drag a card by its handle, or use its up and down arrows.
- **Add**: modifiers that only work because of the component's parent (like Weight inside a Row or Column) are listed first.
- **Copy and paste**: copy one card, or **Copy all**. **Paste** adds them to another component and skips any that don't apply there.
- **Drag to move**: lets the component move an [overlay](scenes_v2__15_overlay_features#overlay-features) window around.

Order changes the result: Modifiers are applied from top to bottom, so the same modifiers in a different order look different. Most people miss this. If a component doesn't look the way you wanted, it's probably the modifier order: try moving the cards around first. See [How Modifier Stacking Works](scenes_v2__06_modifiers#modifiers-stacking).

Screenshot: The Modifiers tab with a stack of modifier cards

Screenshot: A Shadow modifier card expanded to show its values

### State

- Binds a component's live values to Tasker variables, for example whether a Switch is checked or what was typed in a Text Input.
- The variable you name is kept up to date as the user interacts, so a task can read what they did.
- Each binding pairs a value with the variable it writes to.

Screenshot: The State tab binding a Switch's value to a variable

### Event Handling

What happens when the user interacts with a component. See [Event Handling](scenes_v2__11_interactions#interactions).

- **Add handler**: creates a handler. Tap the events that fire it, such as Click, Hold, Multi Click or Swipe; the list depends on the component.
- **Actions**: a handler runs one or more actions in order, like setting a variable, running a Tasker task or dismissing the screen.
- **Only trigger when**: an optional condition. The handler only fires when it's true.
- **Stop propagation**: keeps the event from reaching parent components.
- **Copy and paste**: handlers can be pasted onto other components. Handlers for events the target doesn't have are skipped.

Screenshot: A handler with a Click event and a couple of actions

### Actions

- Commands a task can send to the component, like toggling a Switch.
- **ID**: shown on each card. Use it in [Run Scene v2 Action](scenes_v2__12_tasker_actions#tasker-actions-run-action), with the screen ID and the component's ID.
- **Run button**: tries the action on the preview.

Screenshot: The Actions tab with a run button

### Animation

- **Visibility transition**: how the component appears and disappears. Needs a `showWhen` on the component. See [Show and Hide Animations](scenes_v2__10_show_when#show-when-animations).
- **Content transition**: how a container's children animate in and out. Needs a `showWhen` on a child. See [Content Transition](scenes_v2__05_general#general-content-transition).

Screenshot: The Animation tab with a visibility transition set

### Code

- The raw JSON behind your screen. Edit here or visually; both stay in sync.
- **VALID / INVALID**: tells you if the JSON is correct, with the error below when it isn't.
- **Follows your selection**: the selected component's JSON is highlighted, ready to copy or cut.
- **Buttons**: select all, cut, copy and paste.

Screenshot: The Code tab with the VALID badge and the selected component's JSON highlighted

#### Linking to a JSON File

Edit the screen in a text editor, or on your PC through a synced folder. Tap the document button next to VALID (**Link to a JSON file**).

- **Pick a file**: choose an existing file, or type a new name to create one.
- **Auto-sync on**: changes flow both ways automatically.
- **Auto-sync off**: use **Reload from file** and **Write to file** to sync by hand.
- **Status line**: the last sync, or an error. Invalid JSON in the file never replaces your screen.

See [Raw JSON Editing](scenes_v2__17_raw_json#raw-json) for more.

Screenshot: The Code tab linked to a JSON file with Auto-sync on

### AI

- Describe what you want in plain language and AI creates or changes your screen.
- **Editing**: what the AI focuses on: the selected component, or the entire layout.
- **Component only**: on, only the selected component changes. Off, anything on the screen can.
- **⋮ menu**: copy or export the AI instructions, or change the AI configuration.

Screenshot: The AI tab with a description typed in

### Preview

- A live rendering of your screen as it will look on the device. Every change shows up right away.
- **Selecting**: tap a component to select it. Tap it again to jump to its Settings.
- **Interactive Mode**: off by default, so taps select. Turn it on in the overflow menu to try the screen for real.
- **Second display**: on foldables or with a connected monitor, move the preview to the other display.

### Test Variables

See how your screen reacts to different values without running a task. For example, set `%is_logged_in` to `true` to see what appears. Open it with **Variables** (flask icon) in the overflow menu.

- **On/off**: switch a test variable off without deleting it.
- **Pin**: saves it with the scene so it's still there next time you open the editor.
- **Set by screen**: variables the screen writes while you use it in Interactive Mode. Tap one to copy a condition like `%name == "value"`.
- **Resolve in Preview**: on by default, so text shows the test values. Off shows raw names like `%username`. Saved with the scene.
- **Editor only**: test variables are never used when the scene really runs.

Screenshot: The Variables panel with a pinned variable and the Set by screen list

### Templates

Reuse your own work instead of starting from scratch.

#### Screen Templates

- **Save**: **Save as Template** in the overflow menu saves the whole screen with a name and description.
- **Use**: saved screens appear under **My Templates** in the **What do you want to create?** dialog when you start a new scene.
- **Load**: **Load Template** in the overflow menu replaces the current screen with one of them.

#### Component Templates

- **Save**: long-press a component in the Elements tab, then **Save as Component**. Everything inside it is included.
- **Use**: saved components show up in the component list when you add a component, in their category (**My Components** if you didn't pick one).
- **Manage**: **Saved Components** in the overflow menu lists them so you can delete the ones you no longer need.

Screenshot: The Save as Component dialog

#### Templates Folder

- Templates are files on your device. Tasker asks for a folder the first time you save one.
- **Set Templates Folder** in the overflow menu changes it, for example to a folder you sync.

### Editing Modes

- **Full Screen**: a whole scene, with a name and screen settings. The normal mode.
- **Single Element**: one component with no screen around it. Use it for pieces repeated by **Arrays Merge** or shown through [**Variable Components**](scenes_v2__09_variables#variables), like one list item card.

To design JSON for a Tasker action field, like the Format of **Arrays Merge**:

1. Tap the field's magnifying glass and pick **Show Scene v2**.
2. If the field already has JSON, the right mode opens. If not, the **Edit Mode** prompt asks: **Full Screen** or **Single Element**.

Tip: To show a list from Tasker arrays, the [**Arrays Merge Template**](scenes_v2__05_general#component-arrays-merge-template) component is the preferred way. You design the repeated item right in your screen, with no separate action or JSON needed.

Screenshot: The Edit Mode prompt with Full Screen and Single Element
