# Device Owner Permission

Source: https://tasker.joaoapps.com/userguide/en/help/ah_device_owner.html

### Warning

**It's important to consider that setting Tasker as the Device Owner can impact your device, so please keep that in mind before doing this procedure.**

**If anything stops working because of this procedure, it is possible to remove Tasker as the Device Owner by using the Clear Device Owner option in the Device Admin/Owner action in Tasker.**

A known issue for Samsung owners is that some of their Samsung services stop working and there's currently no known way to get them back to working while Tasker is the Device Owner:

- Secure Folder
- Quick Share (prior to Android 13, on Android 13 it is allowed)
- Samsung Pass
- Smart Switch (Data Restore Tool)
- Samsung Kids

**YOU HAVE BEEN WARNED!**

### Grant Permission

Here's how to make Tasker the **Device Owner** on your device

- Install Tasker
- Remove all accounts on your device under [Android Settings -> Accounts](taskersetting://accounts)
- Remove any lock screen security you may have
- Setup ADB on your PC as described [here](help__ah_adb_setup).
- Use this command to list your remaining accounts and remove them/uninstall any apps mentioned:

```
adb shell dumpsys account | find "Account {" | find /V "Session"
```

  If you're on a mac/linux write

```
./adb shell dumpsys account | grep "Account {" | grep -v "Session"
```

- Use this command:

```
adb shell dpm set-device-owner net.dinglisch.android.taskerm/.MyDeviceAdminReceiver
```

  If you're on a mac write

```
./adb shell dpm set-device-owner net.dinglisch.android.taskerm/.MyDeviceAdminReceiver
```

- Re-add all needed accounts
- Reactivate lock screen security if needed

**Note:** If the ADB command above does not work you have to

- Factory reset your device
- Install the latest version of Tasker from [here](https://tasker.joaoapps.com/download.html) **BEFORE** you add any accounts on your device
- Run the ADB command above
- Add all needed accounts only **after the command is ran successfully**

### Important note for Xiaomi or Redmi phones with MIUI

If the system is not allowing you to set the permission via ADB you first have to:

- Add your Mi Account
- Enable **Install Apps via ADB and USB** security settings
- Go to Mi Account in Settings and sign out again
- Finally grant the permission via ADB as shown above

### Enable Backups If Needed

On some devices the system backup functions might be disabled after you do the above. If so, use the Tasker **Device Admin/Owner** action to run the following Custom action:

```
setBackupServiceEnabled(true)
```

After running that in Tasker backups should run again.
