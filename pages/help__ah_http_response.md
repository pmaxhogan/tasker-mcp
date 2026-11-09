# HTTP Response Action

Source: https://tasker.joaoapps.com/userguide/en/help/ah_http_response.html

Allows you to send back a response to an **HTTP Request Event**.

The most common use case for this action would be:

- Have a profile with the **HTTP Request Event** condition
- In the task for that profile do whatever you want with the request and then respond to that request using this **HTTP Response Action** making sure to use the **%http_request_id** variable in the **Request ID** input (this variable is created by the mentioned event).

However, you could choose not to respond in the same profile by simply storing the **%http_request_id** variable in a global variable for example, and then later, with any logic you want, respond to that request.

Check out [this example project](https://taskernet.com/shares/?user=AS35m8ne7oO4s%2BaDx%2FwlzjdFTfVMWstg1ay5AkpiNdrLoSXEZdFfw1IpXiyJCVLNW0yn&id=Project%3AHttp+Server+Example) to learn how to use this event in a plethora of use cases.
