# Tasker Scenes V2 Manual: Raw JSON Editing

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2.html#raw-json

Section 17 of [Tasker Scenes V2 Manual](scenes_v2) (Advanced).

The **Code** tab shows the full JSON structure behind your layout. Every visual change updates the JSON, and every JSON change updates the visual editor - they stay in sync bidirectionally.

### When to Use Raw JSON

- **Copy-pasting layouts** - Copy the JSON to share a layout with someone, or paste in a layout from elsewhere
- **Bulk edits** - Faster to find-and-replace a color across 20 components in JSON than clicking through each one
- **Debugging** - See exactly what's set on every component when something doesn't look right

### Validity Indicator

A badge at the top of the tab shows the current state:

- **VALID** (green) - JSON is well-formed and the visual editor is in sync
- **INVALID** (red) - JSON has a syntax error. The visual editor stops updating until you fix it.

### JSON Structure

The top-level JSON is a screen object. Only `root` is needed - every other field is optional and has a default:

```
{
  "name": "My Screen",
  "description": "What this screen does",
  "provides": { "key": "value" },
  "statusBarColor": "surface",
  "navigationBarColor": "surface",
  "isLightStatusBars": "false",
  "isLightNavigationBars": "false",
  "hideSystemBars": false,
  "keepScreenOn": false,
  "unsetVariablesAsEmpty": true,
  "referenceDp": "360",
  "root": {
    "type": "Column",
    "id": "root_col",
    "children": [ ... ]
  }
}
```

Other screen fields exist for overlays and editor state - `defaultDisplayMode`, `defaultOverlayX`/`Y`/`Width`/`Height`/`Blocking`/`Animation`, `resolveVariablesInPreview`, `pinnedTestVariableEntries`, and a screen-level `eventHandlers` block. The editor manages these for you; you rarely set them by hand.

Every component is an object with a `"type"` discriminator and an `"id"`. See the [Components](scenes_v2__05_general#general) section for the full list of component types and each component's properties. Container components hold a `"children"` array (Scaffold and the app bars use named slots instead). Every component takes an optional `"modifiers"` array. Colors are hex strings (`#RRGGBB` or `#AARRGGBB`), Material 3 theme color names, `"transparent"` or `"contentColor"` - see [Colors & Theming](scenes_v2__07_colors_theming#colors-theming).

Note: If you make the JSON invalid, the visual editor stops updating. Fix the JSON syntax to restore sync. The editor won't overwrite your JSON while it's invalid.

### Editing the JSON in Another App or on Your PC

The Code tab can link the scene's JSON to a file on your device. Tap **Link to a JSON file**, then pick an existing file or type a new name to create one. From then on:

- With **Auto-sync** on (the default), changes you make in the editor are written to the file, and when the file changes - for example because you saved it in a text editor - the editor and the preview update right away.
- With Auto-sync off, use **Reload from file** and **Write to file** to sync when you choose.
- A status line shows the last sync, or a problem such as the file being missing. If the file doesn't contain valid JSON, it's ignored and your scene stays as it was until the file is fixed.

Put the file in a folder you sync with your computer and you can write the scene in your favorite code editor while watching the result live on the phone. The link is remembered per scene, and saving the scene keeps it.
