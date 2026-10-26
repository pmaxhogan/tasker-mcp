# Write Secure Settings Permission

Source: https://tasker.joaoapps.com/userguide/en/help/ah_secure_setting_grant.html

To use this, Tasker needs to be granted permission to Write Secure Settings on your device

##### Easy Way

Install the [Tasker Permissions](https://tasker.joaoapps.com/taskerpermissions.html) app and follow the prompts.

##### Hard Way (don't bother with this if you were able to do it the easy way)

1. Setup ADB on your PC as described [here](help__ah_adb_setup).
2. Use these commands:

```
adb shell pm grant net.dinglisch.android.taskerm android.permission.WRITE_SECURE_SETTINGS
```

  If you're on a mac write

```
./adb shell pm grant net.dinglisch.android.taskerm android.permission.WRITE_SECURE_SETTINGS
```

  **Note:** On MIUI devices you may have to open developer options and enable the **USB debugging (Security Settings)** setting (and the **Disable permission Monitoring** setting in some cases) to be able to run the above command.
