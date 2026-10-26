# Call Screened

Source: https://tasker.joaoapps.com/userguide/en/help/eh_call_screened.html

Allows you to react to a call being screened. In other words, this event will trigger when Tasker is set as your **Caller ID & spam app** in Android settings and you get a call.

Import an example project that will accept calls if a caller is on your contact list and will reject them otherwise [here](https://taskernet.com/shares/?user=AS35m8ne7oO4s%2BaDx%2FwlzjdFTfVMWstg1ay5AkpiNdrLoSXEZdFfw1IpXiyJCVLNW0yn&id=Project%3AOnly+Allow+Calls+From+Contacts).

This event will trigger before the phone starts to ring.

After this triggers you have a few seconds to use the **Call Screening** action in your task to decide what you want to do with the call (reject, accept, etc).

If specified, Caller must match the incoming call (see [Pattern Matching](matching#caller) in the Userguide).

Possible values for call capabilities and properties are available [here](https://developer.android.com/reference/android/telecom/Call.Details). Capabilites start with **CAPABILITY_** and properties start with **PROPERTY_**
