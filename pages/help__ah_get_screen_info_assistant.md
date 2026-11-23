# Get Screen Info (Assistant)

Source: https://tasker.joaoapps.com/userguide/en/help/ah_get_screen_info_assistant.html

Gets various visible and invisible info about the currently opened screen on your device.

The **%ai_texts** variable will contain a JSON Array structure (note: you can [read JSON natively in Tasker](variables#json)) where every element usually just has a **text** field. In some cases (like if you use this action while Chrome is open) you might get and **extras** field with some more info as well.

Here's an excerpt of what you might get if you use this action while Chrome is open:

```

[
	{
		"text": "Tasker Share"
	},
	{
		"text": "Report"
	},
	{
		"text": "Last Modified: 2022-04-05 16:57:30"
	},
	{
		"text": "Counter Test"
	},
	{
		"extras": {
			"htmlTag": "a",
			"display": "inline",
			"href": "/?user\...",
			"target": "_blank"
		}
	},
	{
		"text": "Other Shares From This User"
	},
	{
		"extras": {
			"htmlTag": "a",
			"display": "inline",
			"href": "/?public",
			"target": "_blank"
		}
	},
	...
]
```

The %ai_extras variable can contain arbitrary info that the currently opened app provides in a JSON structure, so it's recommended that, if you're interested in a certain app's extra info, you first try this action while that app is open and use a **Text/Image Dialog** to show what this variable contains
