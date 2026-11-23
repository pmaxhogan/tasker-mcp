# HTTP Auth

Source: https://tasker.joaoapps.com/userguide/en/help/ah_http_auth.html

Authenticate with a web service.

#### OAuth 2.0

Allows you to sign in a user and act on behalf of that user in a web service.

For example, if you sign in as a user on the Spotify API and give it proper permissions, you can then add songs to the user's Spotify playlists.

On most web services that use OAuth 2.0 you have to create an *app* on that service that you can then use to sign in the user.

**Very important**: when creating the app on the web service make sure to set the **Redirect URI** to **https://tasker.joaoapps.com/auth.html**. If you really want to host the redirect page yourself make sure to copy the original page's source code and host it somewhere of your choosing. You then need to supply that custom Redirect URI in the **Endpoint To Get Code** field as a query parameter. For example, if your endpoint to get code is **https://api/code** and your custom redirect URI is **https://myredirecturi/myauth.html** you would set **Endpoint To Get Code** to **https://api/code?redirect_uri=https%3A%2F%2Fmyredirecturi%2Fmyauth.html**

#### Examples

- [Add a row of data to a Google Spreadsheet (no plugins) ](https://forum.joaoapps.com/index.php?resources/add-a-row-of-data-to-a-google-spreadsheet-no-plugins.383/)

#### Inputs

Client ID and Client Secret

Given to you by the web service when you create an app on it

Endpoint To Get Code

A URL that is indicated in the web service documentation. Look for a URL in the docs that has the **response_type=code** parameter and use just the base URL.

For example, for Google web services that support OAuth 2.0 this URL is **https://accounts.google.com/o/oauth2/v2/auth** as you can see [here](https://developers.google.com/identity/protocols/OAuth2WebServer).

**Important Note:** sometimes some APIs require additional parameters to be added to this URL. For example, the [Reddit API](https://github.com/reddit-archive/reddit/wiki/OAuth2#authorization) requires you to add an additional **duration=permanent** parameter. To do this, simply add these extra parameters to the endpoint URL. In the reddit example you would use **https://www.reddit.com/api/v1/authorize?duration=permanent** instead of just **https://www.reddit.com/api/v1/authorize**.

Endpoint To Get Refresh Token

Also an URL that is indicated in the web service documentation. Look for a URL in the docs that has the **grant_type=refresh_token** parameter in the request body.

For example, for Google web services that support OAuth 2.0 this URL is **https://www.googleapis.com/oauth2/v4/token** as you can see [here](https://developers.google.com/identity/protocols/OAuth2WebServer).

Scopes

One per line.

These will define the permissions that your app will request the user when acting on his/her behalf.

For example, to [list a user's calendars in the Google Calendar API](https://developers.google.com/calendar/v3/reference/calendarList/list) you would need to use the **https://www.googleapis.com/auth/calendar.readonly** scope.
