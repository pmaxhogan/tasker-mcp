# Remote Action Execution

Source: https://tasker.joaoapps.com/userguide/en/fcm.html

Allows you to run any Tasker action on a different (remote) device.

#### Important Concepts

- **Firebase Cloud Messaging**: Google service that allows apps to receive remote **pushes** of information. Tasker uses this to perform **Remote Action Execution**.
- **FCM Token**: each device has a token that identifies it uniquely. This token is saved to your Google Drive in the **Tasker/FCM** folder. A file with the device's name containing the token will be created there.
- **Google Cloud Project**: **sending** FCM pushes requires you to setup a **Google Cloud Console Project** and a **Service Account** there
- **Firebase Project**: **receiving** FCM pushes requires you to add **Firebase** to the **Google Cloud Project**
- **Google Cloud Service Account and Firebase Files**: you'll have to provide Tasker with 2 files you'll generate with the instructions below so that Tasker can send and receive FCM pushes
- **Privacy/Security**: Tasker will use your own **Google Cloud** and **Firebase** projects so that only **YOU** have access to all the information needed for your devices to perform **Remote Action Execution**. Your FCM tokens will only work with your own Google Cloud project so nobody else can send pushes to your devices. Never share this information unless you want other people to be able to remotely run actions on your device. Pushes will also be sent from one device to the other directly via Firebase Cloud Messaging, and will not go through any Tasker server.

When you set up Remote Action Execution Tasker will register itself with **Firebase Cloud Messaging**. It will also upload your **FCM Token** to **Google Drive** if you're signed in to Google in Tasker on your device.

Your other devices can then run tasks on that device by using the **Remote Device** field in compatibe actions.

Compatible actions include:**

- Perform Task
- Command
- Set Variable
- Get Location v2
- Flash
- Set Clipboard
- Browse URL

**

#### How To Set Up Remote Action Execution

1. Create Google Cloud Service Account With Correct Permissions and get the **Google Cloud Service Account File**
  - (Optional) [Change your language to English](https://console.cloud.google.com/user-preferences/languages) so it's easier to follow this tutorial.
  - Click [here](https://console.cloud.google.com/iam-admin/roles/create) and select or create a project with any name your like, eg. **Tasker Remote Action Execution**
  - Enter your Role details:
    - **Service Account Name**: Tasker
    - **Service Account description**: Role with just the permissions needed for Tasker
    - **Service Account ID**: tasker
    - **Role launch stage**: General Availability
    - Add 2 permissions (you can use the **Filter** [not the **Filter Permissions By Role**] field to easily find them):
      - cloudmessaging.messages.create
      - firebasecloudmessaging.messages.create
    - Click **Create** to create the role.
  - Click [here](https://console.cloud.google.com/iam-admin/serviceaccounts/create) to start creating your **Service Account**
  - Enter your Service Account details:
    - **Service Account Name**: Tasker
    - **Service Account ID**: tasker
    - **Service Account description**: Account that's only used for Tasker
  - Click **Create and Continue** to move on to the account role setup
  - Click on **Select a role**
  - Select **Custom** > **Tasker**
  - Click on **Continue**
  - Click **Done** to create the account.
  - In the account list, look for the **tasker** account you just created and click on its 3-dot menu on the right
  - In the menu select **Manage Keys**
  - Click on **Add Key** > **Create New Key** > **Key Type JSON** > **Create**
  - This is the **Google Cloud Service Account File**.
  - Save the downloaded JSON file onto your Android device in a place you know you can find it later.
2. Add Firebase to your project and get the **Google Cloud Firebase File**
  - Go [here](https://console.firebase.google.com/)
  - Click on **Create a project**
  - Click on **Add Firebase to Google Cloud project** at the bottom
  - Select the project you created in the **Google Cloud Console** before
  - Go through the wizard that will add Firebase to the project
  - In the project's screen go to **Project Overview** and click to the **Android** icon on the right to add an app to your Firebase project
  - Enter the app's info:
    - **Android package name**: net.dinglisch.android.taskerm
    - **App nickname**: Tasker
    - Click on **Register App**
    - Click on **Download google-services.json**
  - This is the **Google Cloud Firebase File**.
  - Save the downloaded JSON file onto your Android device in a place you know you can find it later.
  - Finish the wizard
3. Provide Tasker With the Downloaded Files
  - Go into Tasker > Menu > Preferences > MISC tab
  - Under **Google Cloud Service Account** use the **Magnifying Glass** to select your **Google Cloud Service Account File**
  - Under **Google Cloud Firebase** use the **Magnifying Glass** to select your **Google Cloud Firebase File**
  - Exit settings to save
  - Repeat this process of selecting the 2 files on all of your Android devices that you want to execute remote tasks on.
  - Important: You have to use the same 2 files on all of your devices for it to work. Otherwise you'll get errors when trying to run actions remotely.
4. Test Remote Execution
  - Create a new Task and call it **Remote Open URL**
  - Add the **Browse URL** action
  - In the **URL** field enter **https://www.reddit.com/r/tasker/**
  - In the **Remote Device** field use the **Magnifying Glass** to select one of your other devices
    - Important: this device list is populated by a list of files in the **Tasker/FCM** folder on your Google Drive. If you have different accounts on different devices, each account will have its specific device list and you won't be able to easily select them. You can work around this by copying the files from one Google Drive account to the other.
  - Go back to the task editor and run the task with the play button. The URL should now open on your other device!
  - Important: You can send messages to any device using its **FCM Token** directly instead of its name. Use the **Magnifying Glass** on a device to get its Token and then use that token in the **Remote Device** field on any other device where you used the same 2 Google Cloud files.

#### FAQ

Why am I getting the SENDER_ID_MISMATCH error after setting up my devices?

That error means that you're using different Google Cloud projects on your devices. All your devices must use the same exact 2 Google Cloud files. To fix follow these steps:

- Open Tasker on all your devices > Preferences > Misc > Remove the files paths from the 2 fields (make the fields empty)
- Reboot your devices
- Select your files again in Preferences > Misc but make sure all your devices have the exact same 2 (Service Account and Firebase) files
