# Tasker Screen Builder Manual: Editor Overview

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#editor-overview

Section 3 of [Tasker Screen Builder Manual](scenes_v2) (Getting Started).

The editor workspace splits into an editing panel and a live preview panel. The editing panel has nine tabs, selectable along its edge. Each tab focuses on a different aspect of the selected component or the screen as a whole. On wide screens the editor and preview sit side by side; on narrow screens they stack, with a draggable separator between them.

### Elements

The component tree - your screen's structure at a glance. It shows every component nested inside its parent, like a file explorer shows folders and files. A Screen node sits at the top; selecting it shows Screen Properties on the Settings tab. Tap a component to select it; the other tabs then act on that selection. Drag and drop to reorder components or move them between containers. When a component is selected, inline buttons on its row move it up, down, or in and out of its parent.

Use the "+" floating action button to add components. It expands into placement options - add as first or last child, add before or after the selection, add as a parent, or clone. Components are then picked from a searchable list grouped by category (Layout, Display, Input). Long-press a component (or use its accessibility actions) to enter selection mode, where checkboxes let you act on several components at once - copy, cut, or delete them together. A component hidden by its [`showWhen`](scenes_v2__10_show_when#show-when) condition is marked with a crossed-out eye icon. If the screen is empty, this tab shows an "Add your first element" hint.

### Settings

Edit everything about the selected component. The **General** section shows the component's ID, the [`showWhen`](scenes_v2__10_show_when#show-when) conditional visibility expression, and component-specific properties (text content, image source, alignment, and so on). Containers also get a [**Provides**](scenes_v2__08_provides#provides) section for injecting key-value pairs into child components. An overflow-menu option lets you search properties by name.

When the Screen node is selected (or nothing is selected), this tab shows [**Screen Properties**](scenes_v2__13_screen_properties#screen-properties) instead: screen name and description, default display mode and overlay defaults, proportional scaling reference width, screen-level provides, keep-screen-on, and system bar colors.

### Modifiers

The [**Modifiers**](scenes_v2__06_modifiers#modifiers) tab manages the styling layers stacked on the selected component - Padding, Background, Size, Border, Shadow, and others. Each modifier is a card; reorder the stack by dragging, since order affects the result. Use the add button to append a new modifier from the available list. The tab also holds the component's drag-to-move behavior, used to let a component move an [overlay](scenes_v2__15_overlay_features#overlay-features) window.

### State

The **State** tab binds a component's live values to Tasker variables. For an input component such as a Switch or Text Input, this continuously writes the current value (checked, entered text, and so on) into a variable you name, so a task can read what the user did. Each binding is shown as an output key paired with the variable it writes to.

### Event Handling

The **Event Handling** tab sets up what happens when the user interacts with a component. Tap **Add handler** to create a handler, then choose which events fire it - Click, Hold, Multi-Click, Swipe, and others, depending on the component. A handler runs one or more [actions](scenes_v2__11_interactions#interactions) in order: set a variable, run a Tasker task, dismiss the screen, and more. An optional condition limits a handler to fire only when an expression is true. You can also stop an event from propagating to parent components.

### Actions

The **Actions** tab lists the component action handlers available on the selected component - imperative commands the screen can be told to perform from outside, identified by an ID. Each action shows its parameters, and where the action can be tested, a run button executes it against the preview so you can see the result without leaving the editor.

### Animation

The **Animation** tab sets the content transition for a container - how its children animate in and out when they appear, disappear, or change. It applies only to components that have children; for other components the tab shows a hint instead.

### Code

The **Code** tab shows the raw JSON behind your screen. Changes sync both ways - edit visually or in JSON and both stay in sync. A green "VALID" or red "INVALID" badge reports whether the JSON parses, with the parse error shown below when it does not. Cut, copy, and paste buttons help move JSON in and out. This tab is useful for copy-pasting screens or making bulk edits.

### AI

Describe what you want in plain language and AI generates or modifies your screen from the description. It works on the entire screen or just the selected component. From the tab's overflow menu you can copy the AI system instructions to the clipboard, export them to a file, or change the AI configuration.

### Test Variables

The editor's overflow menu has a **Variables** entry (flask icon) that opens the Test Variables panel. Here you set temporary variable values to preview how `showWhen` conditions behave - for example, setting `%is_logged_in` to `true` to see which components appear or disappear. The panel also lists the variables the screen writes. Test variables are editor-only and are not used at runtime. By default they affect `showWhen` evaluation in the preview; you can also turn on resolving variables in the preview so that text and other properties render with the test values instead of the raw variable names (such as `%username`).

### Preview

The **Preview panel** shows a live rendering of your screen as it will appear on the device. Every change updates it in real time. Tap a component in the preview to select it; tap it again to jump to the Settings tab for that component. By default the preview is non-interactive so taps select rather than trigger; turn on **Interactive mode** from the overflow menu to actually run handlers and exercise the screen. On devices with more than one display (foldables, connected monitors), you can move the preview to a secondary screen and edit on the other.

### Editing Modes

The editor supports two modes:

- **Screen mode** - Design a full screen with a root component, screen name, and screen-level properties. This is the standard mode for creating scenes. Its output is a screen object with a `root` and a `name`.
- **Element mode** - Design a standalone component without a screen wrapper. The output is bare component JSON (no `root` or `name` fields). This is for designing reusable templates used with **Array Merge** and [**Variable Components**](scenes_v2__09_variables#variables) - for example, a list item card duplicated for each entry in an array.

When you open the editor from an action field that accepts both formats, the editor auto-detects the mode from the existing content. If the field is empty, you are asked to choose between Screen and Element mode.
