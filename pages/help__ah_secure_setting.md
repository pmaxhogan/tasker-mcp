# Custom Setting

Source: https://tasker.joaoapps.com/userguide/en/help/ah_secure_setting.html

Allows you to change settings in the three Settings Tables on Android (Global, Secure and System)

Settings whose values are 0 and 1 are usually "on" and "off" settings. You can toggle these by setting the **Value** to **=:=toggle=:=**

Some values can only be changed with root.

You can leave the **Value** empty and only fill in the **Read Setting To** field to get the current value for the setting

If you set both the **Value** and **Read Setting To** inputs, the setting will be read into the variable **after** it has been changed. Can be useful for when you're toggling a setting and need to know what value you ended up with.

[Video Example](https://www.youtube.com/watch?v=NiJrtmHIiiE)

### How To Grant Permission

Please follow the [instructions](help__ah_secure_setting_grant) to learn how to grant the permission.

### Example Usage

Change any setting on your device from anywhere (PC, notification, watch, etc) with an [AutoApps Command](https://joaoapps.com/autoapps-command-system/) - [Full Tutorial](http://forum.joaoapps.com/index.php?resources/change-any-android-setting-from-anywhere-with-autoapps.331/)

**Note:** If you change your keyboard setting to an empty value and apps start crashing, simply change the keyboard back to a normal value in Android settings to fix it.
