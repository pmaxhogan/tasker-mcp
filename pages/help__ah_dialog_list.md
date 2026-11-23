# List Dialog

Source: https://tasker.joaoapps.com/userguide/en/help/ah_dialog_list.html

Show a dialog with a list of items

The items you select and the text on the button you clicked (if applicable) will be returned to you in the task in a local variable. Check the action's output variables for details.

If you cancel the dialog (click outside of it or press back on your device) the Tasker action will result in error and stop the task. You can make the task continue with the **Continue Task After Error** option.

Will not work simultaneously with non-overlay scenes.

Items

Can be a Tasker array variable or direct values.

If you use an array, use it as e.g. **%array** and not **%array()**.

If direct values are used, they should be a comma separated list of values. If you need a separator other than a comma build an array first with the **Array Set** action or similar and then use the array variable in this action.

Selected Items (for **Multiple Choices** mode)

The text (not the index) of the items that should be pre-selected in the list.
