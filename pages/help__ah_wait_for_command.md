# Wait For Command

Source: https://tasker.joaoapps.com/userguide/en/help/ah_wait_for_command.html

Pauses the current task until a command is received via the [Tasker Command System](https://tasker.joaoapps.com/commandsystem.html) or times out.

Use **Command Pattern** to filter which commands should unblock this action. The pattern supports Tasker's standard match syntax (wildcards like `*` and multi-pattern separators like `/`). Leave it empty to accept any incoming command.

**Timeout (Seconds)** sets the maximum wait time. If no matching command arrives within this period, the action fails and you can handle it with the usual action error-handling options (e.g. *Continue Task After Error*, or an *If*/*Stop* check on `%err`).

Only commands triggered *after* this action starts running are considered; commands emitted earlier will not unblock it.

When a matching command is received, the full command string is stored in the output variable `%wfc_command` so the rest of the task can react to its contents.

Commands can be sent from the **Command** action, AutoApps, or any other source that uses the Tasker Command System, and can be received by the **Command** event as well.
