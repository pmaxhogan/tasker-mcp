# Assistant Action

Source: https://tasker.joaoapps.com/userguide/en/help/eh_assistant_action.html

#### Run Tasks Directly by Name

By simply saying **Ok Google, run my task in Tasker** (where **my task** is any of your tasks' name) you'll be able to run any of your existing Tasks with your voice!

You can also say something like **run my task with something and other** to set **%par1** to **something** and **%par2** to **other** when calling your tasks if you want.

Instead of run you can also use any of these words:

- start
- do
- set
- send

#### Setup profiles with this Assistant Action event

If you want more control over your voice commands you can setup profiles with the **Assistant Action** event and here you can filter you command any way you like using [Tasker Pattern Matching](matching).

You can use this to receive variable inputs for example. You could have a command like **run turn off my bedroom lights in 5 minutes with Tasker** and then parse that out and have Tasker wait **5 minutes** and after that **turn off your bedroom lights**.

#### English Only

Assistant **App Actions** is a feature Google allows apps to have in US-English only for now (no other versions of English work). I'll add support for other languages as soon as **App Actions** allow it.

#### Command not being sent to Tasker?

Unfortunately on some occasions Google gets it wrong and doesn't send the command to Tasker. Mostly in cases where a very similar and very commonly used command exists for the Google Assistant itself.

For example a command like **run timer in Tasker** might be interpreted by the assitant itself and create a timer there instead of running your task called **timer**.

In those cases you need to change the task name to something more unique or use the "Assistant Action" event with a custom command to trigger it.
