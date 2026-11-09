# Notify

Source: https://tasker.joaoapps.com/userguide/en/help/ah_notification.html

Show a notification on the top bar.

The specified Title will appear on the bar initially with the Icon.

Notifications with a particular (non-empty) title replace existing ones with that title.

When the notification area is pulled down, the specified Text will be visible.

If Permanent is checked, the notification will not be removed by clicking on it or pressing the Clear button. It *can* be removed using the Notify Cancel action.

A common use of creating a permanent notification is to allow permanent quick access to e.g. a Menu Task through the Notification Bar. Specify a task to run when the notification is clicked by creating a profile with a Notification Click event.

Up to 3 Actions can be specified which will appear in the notification area. In some cases it may be necessary to slide down to reveal the actions. Actions do not run as part of the notifying task.

Category

If you use Android 8 or above you have to use the new **Notification Category** system.

A notification category is a mandatory feature of notifications that allows users to change notification features in Android Settings.

The first time the **Category** field is used in a **Notify** action, the category will be created in Android Settings with the settings (Sound, Vibration, LED, etc) set to those that are configured in the action. Subsequent uses of the same category will use the same settings, even if changed in the Tasker action.

To make it perfectly clear, an Android Notification Category's settings can never be changed by Tasker after it's first created. Only you, the user, can change those settings in the Android System Settings for Tasker.

By default Tasker will use the **User Notifications** category if the **Category** field is not filled in.

You will be warned if you create a notification without a category because, as mentioned above, the **User Notifications** category will be used and that category will be set up with default settings that can not be changed by Tasker.

To delete a category, bring up the category list by using the magnifying glass in the **Category** field and long click an item on the list.

Priority

The priority of the notification relates to how the notification behaves when it's first posted and also its position in the notification list:

- **1**: only shows in the notification shade, below the fold. Will not show a popup when posted.
- **2**: shows in the notification shade, and potentially in the status bar but is not audibly intrusive.
- **3**: shows everywhere, makes noise, but does not visually intrude.
- **4 and 5**: shows everywhere, makes noise and shows a popup when posted.

**Note**: Levels 4 and 5 have the same effect but exist for backwards compatibility purposes. On Android 8+ they will behave the same.
