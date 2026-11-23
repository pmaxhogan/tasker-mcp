# Volume Key Long Press Handling Permission

Source: https://tasker.joaoapps.com/userguide/en/help/ah_volume_long_press_grant.html

To use this, Tasker needs to be granted permission to handle volume key long press interception on your device

##### Easy Way

Install the [Tasker Permissions](https://tasker.joaoapps.com/taskerpermissions.html) app and follow the prompts.

##### Hard Way (don't bother with this if you were able to do it the easy way)

1. Setup ADB on your PC as described [here](help__ah_adb_setup).
2. Use these commands:

```
adb shell pm grant net.dinglisch.android.taskerm android.permission.SET_VOLUME_KEY_LONG_PRESS_LISTENER
```

  If you're on a mac write

```
./adb shell pm grant net.dinglisch.android.taskerm android.permission.SET_VOLUME_KEY_LONG_PRESS_LISTENER
```
