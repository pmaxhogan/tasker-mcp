# Tasker Function

Source: https://tasker.joaoapps.com/userguide/en/help/ah_function.html

This is a place for all Tasker actions that are so small/niche that they wouldn't make sense in a standalone action.

You call these functions with the following format:

```
functionName(arg1,arg2,arg3,argX...)
```

**Note:** When you add an action in a task you can use the search field in the dialog to search for a function name directly and then select the `Tasker Function` action to have the function name filled in automatically and the helper will help you setup its parameters.
If you do this when adding a favorite action (long click the + button in task) you can have a direct shortcut to the specific function you searched for.

[Check out a demo for this here](https://youtu.be/S9QG-e8Udok)

Check out which functions you can use by using the magnifying glass and use the helper to pick a function.

These are some examples:

#### Throttle Notifications

You can make certain app notifications not be reacted by Tasker as frequently as they are posted.

For example, Google Maps notifications are updated very frequently but maybe you just want to react to them at most every 10 seconds. To do that you would write the function:

```
addThrottleNotifications(10,com.google.android.apps.maps)
```

where **10** is the number of seconds and **com.google.android.apps.maps** is the Google Maps' package name.

You can also remove the throttling by doing

```
removeThrottleNotifications(com.google.android.apps.maps)
```

where **com.google.android.apps.maps** is the Google Maps' package name.

When you throttle an app's notifications, that throttling will persist until you explicitly remove throttling yourself.
