# Toggle Work Profile

Source: https://tasker.joaoapps.com/userguide/en/help/ah_work_profile.html

This action allows you to toggle your Work Profile apps on or off. It's the equivalent of "Pausing Work Apps" in your launcher.

If you don't have a work profile on your device and want to create one you could use an app like [Shelter](https://f-droid.org/packages/net.typeblog.shelter/) You can also use the adb command

```
pm create-user --profileOf 0 --managed Work
```

and reboot.

To use this, Tasker needs to be granted permission to Modify The Work Profile on your device

##### Easy Way

Install the [Tasker Permissions](https://tasker.joaoapps.com/taskerpermissions.html) app and follow the prompts.

##### Hard Way (don't bother with this if you were able to do it the easy way)

1. Setup ADB on your PC as described [here](help__ah_adb_setup).
2. Use these commands:

```
adb shell pm grant net.dinglisch.android.taskerm android.permission.MODIFY_QUIET_MODE
```

  If you're on a mac write

```
./adb shell pm grant net.dinglisch.android.taskerm android.permission.MODIFY_QUIET_MODE
```

  **Note:** On MIUI devices you may have to open developer options and enable the **USB debugging (Security Settings)** setting (and the **Disable permission Monitoring** setting in some cases) to be able to run the above command.
