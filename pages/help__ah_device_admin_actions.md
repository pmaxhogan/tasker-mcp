# Device Administrator Actions

Source: https://tasker.joaoapps.com/userguide/en/help/ah_device_admin_actions.html

Allows you to run any of the [Device Policy Manager](https://developer.android.com/reference/android/app/admin/DevicePolicyManager) actions from a Tasker task.

Most of the actions that you can run are high-privilege actions and many require Tasker to be the **Device Owner**.

[Please check here on how to make Tasker your Device Owner](help__ah_device_owner).

Custom Action

This option allows you to select from any of the available [Device Policy Manager](https://developer.android.com/reference/android/app/admin/DevicePolicyManager) actions and run them with the apporpriate parameters. Many actions will return results which you can access in the Output Variable of this action.

The list of actions available here depends on your device and is not controlled by Tasker. Tasker simply looks up all actions that are available to you and lists them.

**Note:** when one of these actions returns a result you can access it in the **%ao_output()** array. These are the ways output is formatted for different types:

- **Bundle**: A JSON structure with all the key-value pairs
- **Any other type**: A string representation of the value

Pre-Defined Actions

You can select from any of the pre-defined actions which are just some of the above actions that the developer chose to make more easily avaialable because they are the most relevant.

Keep in mind that running one of pre-defined actions is the equivalent of running the same action in the **Custom** mode described above. It's just easier and more direct to select.

Freeze App vs Suspend App

Although both actions are used for controlling apps and they seem similar, they address different functionalities. **Freezing** is effectively like uninstalling an app, but it keeps the app's data. The app will be gone from absolutely everywhere on your device. **Suspending** is just marking the app as not launchable by the user.

For example, if you try to launch a suspended app from Tasker, you'll get a system dialog alerting you that the app is suspended. If you try to do the same for a Frozen app, the Tasker action will end in error, just like the app wasn't even installed.

Kill App

Killing an app is the equivalent of force stopping it. It will stop running immediately but can then be ran again right away.
