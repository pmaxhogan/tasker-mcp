# Progress Dialog

Source: https://tasker.joaoapps.com/userguide/en/help/ah_dialog_progress.html

Allows you to show a dialog with a message of your choosing, continue the task in the background and then dismiss the dialog.

The idea is, you first use this action with the **Show** option, do some stuff that takes some time to do in your tasks and then use the **Dismiss** option to close the dialog.

You can even update an already showing progress dialog with different values if your background task has several steps for example. You could do something like:

- Show the dialog initally with a message like "Loading..."
- When you reach a certain stage in your task you could update it to something like "Processing step 1...", "Processing step 2...", etc
- At the end of the task you could show a message like "All done!" for a second or so
- You could finally dismiss the dialog.

If you're updating the dialog you can omit the title or text and the value that was used before will be kept. For example, you could simply update the text and the previous title would remain the same.

If you create a dialog with the **Progress Bar** type and then later update it with an **Animation** type, the progress bar itself will be animated and won't show the progress. You can then later update it again with a numerical progress and the progress bar will resume updating. In this particular case the Animation Images won't be applied to the dialog that is showing the progress bar.
