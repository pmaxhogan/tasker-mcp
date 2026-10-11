# Tasker Screen Builder Manual: AI Layout Generation

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#ai-generation

Section 16 of [Tasker Screen Builder Manual](scenes_v2) (Advanced).

The AI tab lets you describe what you want in plain language, and AI generates or modifies the layout for you.

### How to Use It

1. Switch to the AI tab
2. Type a description of what you want (e.g., "Create a settings panel with toggles for WiFi, Bluetooth, and Dark Mode")
3. Tap "Generate" - AI creates or modifies the layout based on your description

The first time you open the AI tab you'll see a "Set Up AI" button instead of the prompt field. Tap it to configure a model and API key. Once set up, the AI tab shows the prompt input.

A label at the top of the tab shows what the AI is working on: "Editing: Entire layout" when nothing is selected, or "Editing: <component id>" when you have a component selected in the Elements tree. With a component selected you can use words like "this" - "make this text bigger" or "change this button's color to red".

By default the AI regenerates the whole layout and returns it in full, so it may adjust other parts too. When a component is selected, a **Component only** toggle appears next to the Generate button. Turn it on to make the AI modify just the selected component and its children, leaving the rest of the layout untouched.

You can undo AI changes like any other edit - so experiment freely.

### AI Menu Options

The overflow menu (three dots) in the AI tab provides additional tools:

- **Copy System Instructions** - Copy the AI system instructions to the clipboard.
- **Export System Instructions** - Save the AI system instructions to a file on your device.
- The system instructions include the full layout schema and rules. Paste them into ChatGPT, Claude, or any other AI as a system prompt, then ask it to generate or modify Scene v2 layouts for you.
- **Change AI Configuration** - Open the AI configuration screen to change the model or settings.

### Tips for Good Prompts

- **Be specific about structure** - "A column with a header row and three cards below" gives better results than "a nice layout"
- **Skip colors unless you want custom ones** - By default, layouts use Material You theme colors that match the user's device. Only mention colors if you want something specific.
- **Describe interactions** - "Add a dismiss button in the top-right corner" tells AI about behavior, not just appearance
- **Iterate** - Generate a starting point, then select individual components and refine them with follow-up prompts

Tip: Select a component before prompting the AI so it knows what "this" refers to in your instructions. Turn on Component only to keep the rest of the layout untouched. You can always undo if the result isn't what you wanted.
