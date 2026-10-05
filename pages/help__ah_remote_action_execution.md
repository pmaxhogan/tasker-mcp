# Remote Action Execution

Source: https://tasker.joaoapps.com/userguide/en/help/ah_remote_action_execution.html

The Remote Action Execution action is used to obtain a "Remote Action Token" needed for executing actions on remote devices using Tasker. This token allows other devices to perform tasks or set variables on the device where the token was generated.

Steps to use Remote Action Execution:

- Ensure setup is complete as per the [Remote Action Execution setup guide](fcm).
- Add the **Remote Action Execution** action in a Tasker task.
- Choose the **Execution Mode**:
  - **Query**: Retrieve the current Remote Action Token.
  - **Reset Token**: Generate a new Remote Action Token if needed, for example, after a security incident.
- Use the obtained token in the **Remote Device** field of other actions (like Perform Task or Set Variable) to control remote devices.

Usage Example:

- Get a Remote Action Token from your Pixel 5.
- Send this token to Dropbox for easy access.
- Utilize the token on your Pixel 6 to execute actions directly on your Pixel 5.

The Remote Action Execution function operates using Firebase Cloud Messaging (FCM). For more detailed technical documentation, visit [Firebase Cloud Messaging docs](https://firebase.google.com/docs/cloud-messaging).

You can execute remote actions from anywhere by sending an HTTP request to FCM directly with a message formatted like this:

```

		
{
	"validate_only": false,
	"message": {
		"token": "...",
		"android": {
			"priority": "high"
		},
		"data": {
			"task": "Test",
			"%test": "some value"
		}
	}
}
```

You can add any variables you want to the data section to customize the remote action.

[Here's a complete example web page that allows you to run a task remotely on your device.](https://tasker.joaoapps.com/tests/remote%20task%20execution%20example.html)
