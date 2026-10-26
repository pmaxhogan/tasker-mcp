# Read System Logs Permission

Source: https://tasker.joaoapps.com/userguide/en/help/ah_read_logs_grant.html

To use this, Tasker needs to be granted permission to read system logs on your device

##### Easy Way

Install the [Tasker Permissions](https://tasker.joaoapps.com/taskerpermissions.html) app and follow the prompts.

##### Hard Way (don't bother with this if you were able to do it the easy way)

1. Setup ADB on your PC as described [here](help__ah_adb_setup).
2. Use these commands:

```
adb shell pm grant net.dinglisch.android.taskerm android.permission.READ_LOGS
```

```
adb shell am force-stop net.dinglisch.android.taskerm
```

  If you're on a mac write

```
./adb shell pm grant net.dinglisch.android.taskerm android.permission.READ_LOGS
```

```
./adb shell am force-stop net.dinglisch.android.taskerm
```

3. This will close Tasker, so open Tasker again manually so that it can resume functioning normally.
