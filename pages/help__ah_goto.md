# Goto

Source: https://tasker.joaoapps.com/userguide/en/help/ah_goto.html

Go to a different place in the current task.

Number: specify an action number to jump to.

Label: specify an action label to jump to. This is almost always better than specifying a number.

Top of Loop: jump to the first For action above the current action ('continue')

End of Loop: jump to the action **after** the next End For action ('break')End of If: jump to the next End If action

**Jumping into an If block**: a later *Else* or *Else If* is only skipped if Tasker evaluated the block's *If* (or an earlier *Else If*) and found it true. If you jump from outside the block straight into one of its branches, the *If* is not evaluated, so when the branch ends Tasker treats the next *Else If* or *Else* as if no branch had run yet and evaluates or runs it. If you jump backwards into a branch of a block that was already evaluated earlier in the task, the result of that earlier evaluation is used instead, so the same *Goto* can behave differently depending on what ran before it.

To avoid this, jump to the *If* action itself, or end any branch you jump into with a *Goto* of type *End of If*.

See the section on Flow Control in the Userguide for more info.
