# Sleeping

Source: https://tasker.joaoapps.com/userguide/en/help/eh_sleeping.html

Google Play Services on your device "think" you're sleeping.

Tasker doesn't have any control over how this state is detected. Tasker simply receives events from Google Play Services and relays them back to Tasker and to your profiles.

If this condition doesn't work, please don't blame Tasker or the developer since I really can't control how it works. As such, please use it at your own risk.

**Note:** If you want this to trigger on every single event set the `Minimum Confidence` to 0 and the `Maximum Light` and `Maximum Motion` to 6.
