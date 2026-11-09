# Multiple Variables Set

Source: https://tasker.joaoapps.com/userguide/en/help/ah_set_variables.html

Set the value on multiple variables in a single action.

Please check the help button for each field for more info on each of them,

#### Directly Setting Values In the Names Field (Tasker 6.3.3-beta+)

As of Tasker 6.3.3-beta you can use an alternative way of setting the variables. If

- the **Names** field contains the **Values Splitter**
- the **Values** field is empty
- the **Values Splitter** field does not contain valid Tasker variable name characters only

then you can set values directly in the **Names** field.

For example, if you use this configuration:

then

- **%aaa** will be set to **aaa**
- **%bbb** will be set to **bbb**

This allows for a more visual style of setting the variables.
