# Mobile Data

Source: https://tasker.joaoapps.com/userguide/en/help/ah_mobile_data_direct.html

Set mobile data status without affecting incoming calls.

This works reliably on rooted Android devices.

On non-rooted devices this action needs the [WRITE_SECURE_SETTINGS permission](help__ah_secure_setting_grant) but may not always work.

On most devices the action simply changes the UI in Android Settings but doesn't really change the setting in the background.

It was found that on some Samsung devices if you connect to a Wifi network and then disconnect again that the setting will "stick" for real.

If you find another trick that will make the setting "stick" after using this action please let the developer know so that the trick can be applied for everyone! :) Thanks in advance!
