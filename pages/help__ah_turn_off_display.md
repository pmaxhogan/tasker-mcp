# Turn Off

Source: https://tasker.joaoapps.com/userguide/en/help/ah_turn_off_display.html

If the display is on, it will be turned off.

On some devices it takes about 3 seconds for it to really turn off, on others it might take around 10 seconds. Either way, a fully black screen will be shown while the screen doesn't really turn off.

The action attempts to set the display's timeout to the minimum possible value and displays a black screen until the screen turns off. After it runs, it resets the value to its original state.

Dim

Set the brightness to 0 prior to showing the black screen. Useful for non OLED displays.

Lock

If set, will use the Accessibility Service to lock the screen, but you'll still be able to unlock it with Smart Unlock or by using your fingerprint, unlike with the **System Lock** action where you'll have to unlock your screen with a password.

If Tasker has the [Write Secure Settings](help__ah_secure_setting_grant) and **Write Settings** permissions, you don't need to turn your accessibility service for this to work.
