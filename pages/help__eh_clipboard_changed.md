# Clipboard Changed

Source: https://tasker.joaoapps.com/userguide/en/help/eh_clipboard_changed.html

Allows you to react to the clipboard on your device being changed.

Depending on what the clipboard was changed to, the various variables can have or not have values. For example, if the clipboard was changed to have a text value, the **%cl_image_uri** variable will not have a value.

You can add conditions in the event itself so that it only triggers when certain variables have certain values, e.g. you could add a trigger for **%cl_image_uri Is Set** to make it only trigger if the clipboard contains an image

If you enable the **Ignore Set By Tasker** option, this event will not trigger if Tasker was the app to set the clipboard.
