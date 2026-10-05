# ADB Wifi Permission

Source: https://tasker.joaoapps.com/userguide/en/help/ah_adb_wifi.html

### VERY IMPORTANT: by running the ADB command below you are opening a port on your device that other apps can access too, not just Tasker. If the port is found by other apps and they try to access it, you'll get a popup asking if you want to allow it. ONLY GIVE ACCESS TO APPS YOU TRUST! A malicious app could put your device at risk.

## USE AT YOUR OWN RISK

To use this, Tasker needs to have ADB running in WiFi mode on your device

##### Easy Way

Install the [Tasker Permissions](https://tasker.joaoapps.com/taskerpermissions.html) app and follow the prompts.

##### Hard Way (don't bother with this if you were able to do it the easy way)

**IMPORTANT NOTE:**The ADB command below will have to be ran every time you reboot your device. There's no known way to run it on boot automatically.

- Setup ADB on your PC as described [here](help__ah_adb_setup).
- Use these commands:

```
adb tcpip 5555
```

  If you're on a mac write

```
./adb tcpip 5555
```

- In Tasker use the **ADB Wifi** action with the following command:

```
test
```

- This should make a dialog show up on your device asking you to authorize your device, [like this](https://tasker.joaoapps.com/screens/adbwifiprompt.png).
- Accept the dialog and tick **Always allow from this computer**. (note: on first run the action will time out but after you accept to always allow it should run correctly)
- If you can't accept the dialog because the system says something like **An app is obscuring a permission request. Settings can't verify your response.** disable all app's permissions to draw over other apps and all accessibility services and try again.
- As noted above, **never** accept this dialog if you don't know why it popped up
- If when you disconnect your USB cable the action stops working make sure to firstly enable the **allow debugging in charge only mode** option and then the **USB debugging option** in developer settings.

**Note:** by enabling this, other built-in actions like **Airplane Mode** or **Mobile Data** will also start to work on an unrooted device. If you use a port other than 5555 you can change the **Default ADB Wifi** port in Tasker Settings > Misc so that Tasker uses that port in those actions.

Check out some examples of commands to use [here](https://developer.android.com/studio/command-line/adb#shellcommands). Make sure to **NOT** include the **adb shell** part on any command you try so that it works correctly.

## Action Inputs

Enable Debugging

Most people don't need debugging to be enabled at all times on their Android devices. It might be a security risk if you accidentally accept an unknown request to start debugging which could put your phone at risk.

By enabling this option you can leave debugging off and the action will enable it when ran and disable it afterwards, leaving your phone "closed down" for the majority of time!
