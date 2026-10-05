# ADB Setup

Source: https://tasker.joaoapps.com/userguide/en/help/ah_adb_setup.html

To use some features, Tasker needs to run someADB commands on your device **through your PC**

1. Make sure that Tasker is installed on your Android device
2. **Enable Developer Mode**: Go to Android Settings -> About Phone and look for the **Build Number** option. Touch it multiple times until developer mode is enabled.
3. **Enable USB Debugging**: Go to Android Settings -> and look for the **Developer Options** option. In there, enable the **USB debugging** option.
4. **Install ADB on your PC**: Check [here](https://www.xda-developers.com/google-releases-separate-adb-and-fastboot-binary-downloads/) for a quick way to do it.
5. **Connect device to PC**: Connect your device to a PC and look on your phone. A prompt should show up asking you to allow your phone to be debugged by your PC. Accept this.
6. Open the command prompt from the file folder that contains the extracted downloads. To do this, press the windows key and type **cmd**. When the prompt opens, type **cd ** followed by folder your downloaded ADB to.
7. **Grant permission**: Open a command line a on your PC and write the needed commands (one at a time)

#### Notes:

- On MIUI devices you may have to open developer options and enable the **USB debugging (Security Settings)** setting (and the **Disable permission Monitoring** setting in some cases) to be able to run the above command.
- If you're having trouble with it saying that your device is not authorized, please check [here](https://www.addictivetips.com/android/fix-adb-device-unauthorized-message-android/).
