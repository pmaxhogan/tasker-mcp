# Volume Long Press

Source: https://tasker.joaoapps.com/userguide/en/help/eh_volume_long_press.html

Allows you to react to long pressing the physical volume buttons on your device.

To use this event you need to grant the special **SET_VOLUME_KEY_LONG_PRESS_LISTENER** permission. Check out how to do so [here](help__ah_volume_long_press_grant).

**Important Note:** This doesn't seem to work reliably with the screen off in all situations. It seems to work very reliably if music is playing and less reliably otherwise. This is due to system limitations on those devices and it's not something Tasker can control.

**Important Note 2:** If you're using Lineage OS or similar make sure to disable its own handling of long pressing the volume keys when the screen is off or it won't work at all with Tasker.

To check out an example of how this can be used check out [this video](https://www.youtube.com/watch?v=x-z-RvREF5E).

Type

The button you want to react to. Unfortunately it's not possible to react to both being pressed at the same time. Android doesn't send that event to Tasker.

Additional Time

**Important Note:** Only works with the screen on.

Use the magnifying glass to help you setup this field.

Check how much additional time you held the button down in the task by checking **%evtprm(2)**.

If not set, Tasker will simply trigger the event once, when it detects the long press on the selected volume button.

If set, will make Tasker only react only in certain conditions:

- **Number**: Only trigger after the button has been pressed for those many seconds after the long press is detected. For example, setting it to **3** will make the event only trigger if you press the volume button for a bit more than 3 seconds
- **Continuous Mode**: Only trigger after the button has been pressed for x many seconds after the long press is detected and then trigger again for each additional second that the button is held. For example, setting it to **continuous(0)** will make the event trigger right after the long press is detected and then trigger again each second until you release the button. Another example: setting it to **continuous(3)** will wait 3 seconds before it starts triggering continuously.
  **Continuous Mode With Limit**: Same as above but with a limit of triggers for a button press. For example, setting it to **continuous(0,3)** will make the event trigger in the same conditions as above but at most 3 times. If you want to trigger it again after that you have to release the button and long press it again.

Check out a video example of using the **Additional Time** feature [here](https://www.youtube.com/watch?v=E9yvAykDg0U).
