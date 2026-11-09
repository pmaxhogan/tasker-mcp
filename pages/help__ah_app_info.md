# App Info

Source: https://tasker.joaoapps.com/userguide/en/help/ah_app_info.html

Get information about one or multiple apps.

Package

Always use the helper so that it's easier for you to setup this field.

This field has multiple input methods:

- **Leave empty**: Will get app info about the currently opened app
- **Package name**: Will get info about the app with the selected package name.
- **Last App By Order**: Use the **last(X)** format, where **X** is a number. Will get info about whatever app was opened those many apps ago. For example, **last(1)** will get info on the previously opened app. **last(5)** will get info on the app that was opened 5 apps ago.
- **Last App By Time**: Use the **last(Xs)** format, where **X** is a number in seconds. Will get info about whatever app was opened those many seconds ago. For example, **last(10s)** will get info on the app that was opened 10 seconds ago.
- **Most Used By Time**: Use the **most(time,X:Y,Z)** format, where
  - **X**: Number of minutes to start looking for app usage. For example, a value of **1440** minutes (1 day) will look at usage stats starting 1 day ago
  - **Y**: Number of minutes to stop looking for app usage. For example, a value of **0** mintues will look at all the stats until the current time.
  - **Z**: Number of apps to get back. For example, to get back the 5 most used apps in the select time span, set this to **5**.
  The %app_used() variable will have the number of seconds the app was open during the selected period.
- **Most Used By Opened**: Use the **most(opened,X:Y,Z)** format with the same parameters as above. The %app_used() variable will have the number times the app was opened during the selected period.

You can add multiple inputs of any kind above. For example, you can use

```
net.dinglisch.android.taskerm/last(1)
```

to get app info for both Tasker and whatever app was last opened.

Ignore Packages

A list of package names separated by the **/** character.

Will ignore these apps when getting the info.

Ignore Unlaunchable Apps

If selected, will not get info on apps that can't be launched (ie. system apps, launchers, etc)

Handy when you want to create a recent app switcher for example.

Get All Details

If selected will get as much info as possible for the selected apps.

You'll notice the variable list becoming much longer when this is selected.

Use only when needed because it'll make the action slower.
