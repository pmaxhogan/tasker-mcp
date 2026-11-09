# Media Control

Source: https://tasker.joaoapps.com/userguide/en/help/ah_android_media_control.html

Send a command to a media playback application.

A target app need only be specified when multiple apps are interpreting the command.

Note: the Toggle Pause function may not work unless playback has already been started manually.

Note: Tasker's Music XXX actions are not controlled by this action.

If you enable the **Use Notification If Available** option, Tasker will try to find a suitable notification with media control capabilities and control it that way. If it cannot find the notification it'll fall back to the other methods.

On some media notifications the Android System will report that the media was correctly controlled via the notification where in reality it was not, so if this option is not working for your media app, please contact their app's developers to correctly implement it.
