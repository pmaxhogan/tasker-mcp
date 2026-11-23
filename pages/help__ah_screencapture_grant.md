# Screen Capture permanent Permission

Source: https://tasker.joaoapps.com/userguide/en/help/ah_screencapture_grant.html

Every time you want to take a screenshot or capture your screen with Tasker you have to manually accept an Android system prompt. To avoid that you can run a one-time ADB command from your PC and allow Tasker forever!

##### Easy Way

Install the [Tasker Permissions](https://tasker.joaoapps.com/taskerpermissions.html) app and follow the prompts.

##### Hard Way (don't bother with this if you were able to do it the easy way)

1. Setup ADB on your PC as described [here](help__ah_adb_setup).
2. Use these commands:

```
adb shell appops set net.dinglisch.android.taskerm PROJECT_MEDIA allow
```

  If you're on a mac write

```
./adb shell appops set net.dinglisch.android.taskerm PROJECT_MEDIA allow
```
