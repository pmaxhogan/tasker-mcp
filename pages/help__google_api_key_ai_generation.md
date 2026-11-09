# Google API Key for Tasker AI Generation

Source: https://tasker.joaoapps.com/userguide/en/help/google_api_key_ai_generation.html

To use the Tasker AI Generator feature, you need a Google Cloud API Key enabled for the Generative Language API.

To use this action, you'll have to get a Google AI Studio API Key on your Google account.

To do that:

- Open Google AI Studio on the [API Key](https://aistudio.google.com/apikey) page.
- Make sure you're logged in to your Google Account
- Click on **Create API key**. When you do this, Google automatically creates a Google Cloud project for you with the **Generative Language API** enabled on it.
- Optionally upgrade to a paid tier by clicking **Set up Billing**. A paid tier will give you [higher rate limits but can cost you if you use it often](https://ai.google.dev/gemini-api/docs/pricing). Using a free tier allows Google to [use your AI Tasker Generations to improve their services](https://ai.google.dev/gemini-api/terms#data-use-unpaid).
- Copy and paste the API Key into Tasker's AI Generation screen where prompted.

### IMPORTANT NOTE:

If you already have a Google API Key in Tasker, you can continue using it, but you have to enable the **Generative Language API** on your Google Cloud project [here](https://console.cloud.google.com/flows/enableapi?apiid=generativelanguage.googleapis.com) so you can continue to use it with both this, **Say Wavenet** and any other Google API that requires a key in Tasker.
