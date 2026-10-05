# NFC Tag

Source: https://tasker.joaoapps.com/userguide/en/help/eh_nfc_tag.html

Allows you to react to a scanned NFC tag.

You can react by ID, Content or both. This allows you to react to NFC Tags that you don't write yourself. For example, if you have an old key card lying around that has an NFC chip in it, you can react to it by ID and do your automations that way.

Check out [this video example](https://www.youtube.com/watch?v=t3cbS3aez6M) to see this in action.

**Note:** If there are certain NFC tags that always make you select which app to use with them, disable the system app that can also handle the tags (usually called **Tags**) so that Tasker is then always used by default.

Steps to disable **Tags** app on stock Android:

- Navigate to Settings
- Click on Apps & Notifications
- Click on See all apps (Usually under Recently opened apps)
- Click on 3 dots on top right hand
- Click on Show system (which will enable all system installed apps)
- Search for the app (default nfc app, which you will see in Choose options while reading NFC tag)
- Usually the app is called Tags: click on Tags app in the list of apps
- Click on Disable and click on OK on any dialogs which are displayed around disabling the app
