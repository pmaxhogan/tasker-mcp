# Say WaveNet

Source: https://tasker.joaoapps.com/userguide/en/help/ah_say_wavenet.html

Allows you to make Tasker say something out loud using advanced [WaveNet Voices](https://cloud.google.com/text-to-speech/).

You can use [SSML](https://cloud.google.com/text-to-speech/docs/ssml) to more accurately structure your speech.

To use this action, you'll have to have a Google Cloud project on your Google account and use an API Key from that project.

To do that:

- Select or create a Google Cloud project [here](https://console.cloud.google.com/cloud-resource-manager).
- Enable billing for your project [here](https://console.cloud.google.com/billing/linkedaccount). (Note: even though billing is enabled, you'll only be charged if you go over the [free quota](https://cloud.google.com/text-to-speech/pricing).)
- Enable the **Text-to-Speech** API [here](https://console.cloud.google.com/flows/enableapi?apiid=texttospeech.googleapis.com).
- Go to the [Credentials](https://console.cloud.google.com/apis/credentials) page.
- Click on **Create credentials** > **API key**. A new key will be generated.
- Copy and paste the API Key into **Tasker > Preferences > Misc > Google API Key**.
- **Important Security Note:** It's highly recommended to restrict your API key... choose only the specific API you enabled (e.g., "Text-to-Speech")...

Continue Task Immediately

Enable if you don't want the task to wait for it to finish speaking. You must select this in order to do a Shut Up action later.

File

If set, will write the speech to a file with the mp3 format

Override API Key

If set will override the key entered in the main Tasker Preferences.
