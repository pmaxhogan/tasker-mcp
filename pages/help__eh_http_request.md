# HTTP Request Event

Source: https://tasker.joaoapps.com/userguide/en/help/eh_http_request.html

If at least one of these events is part of a profile's condition, Tasker will create an HTTP server in the specified port.

This event condition will trigger on appropriate requests made to the server that match the various inputs specified here.

For example, if you create a condition with **Port** set to **1921** and **Method** set to **POST**, then the profile will trigger when Tasker receives an HTTP Request on that port with the POST method.

When you receive an HTTP Request in Tasker you should respond to it. You can respond in 2 ways:

- Set the **Quick Response** field directly which will simple send back the text you specify there with the 'text/plain' mimetype.
- Use the **HTTP Response Action** in a task and use this event's **%http_request_id** to specify that you're responding to this specific request. This action allows you to fully customize your response. You don't necessarily need to respond to a request in the same profile, as long as you use the correct request ID in your response (e.g. you could save it in a global variable and use it later)

Here's a [Video Tutorial](https://youtu.be/cnviSlrw3Ec) of how to set up a **Remote Voice Messaging** project with Tasker, using this event!

Check out [this example project](https://taskernet.com/shares/?user=AS35m8ne7oO4s%2BaDx%2FwlzjdFTfVMWstg1ay5AkpiNdrLoSXEZdFfw1IpXiyJCVLNW0yn&id=Project%3AHttp+Server+Example) to learn how to use this event in a plethora of use cases.

**Important Note: **You can use the **Test Net** action to get your device's local network IP address so you know where to send the requests to.

**Important Note 2: if you have 2 HTTP Request events with the same port and path, only one of them will be considered.**
