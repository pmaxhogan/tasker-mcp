# Parse/Format Date and Time

Source: https://tasker.joaoapps.com/userguide/en/help/ah_format_date_time.html

Allows you to format a date and/or time in any format, from any kind of input date.

[Watch a demo here](https://youtu.be/UR5Qf7KpDXQ)

[Watch a demo of adding/subtracting time here](https://youtu.be/t51RS7a2myM)

[Import the sunset/sunrise task here](https://taskernet.com/shares/?user=AS35m8ne7oO4s%2BaDx%2FwlzjdFTfVMWstg1ay5AkpiNdrLoSXEZdFfw1IpXiyJCVLNW0yn&id=Task%3AGet+Sunset+Sunrise)

[Check out all the output format options here](https://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat.html)

[Example task of getting how many days to go til a certain date](https://taskernet.com/shares/?user=AS35m8ne7oO4s%2BaDx%2FwlzjdFTfVMWstg1ay5AkpiNdrLoSXEZdFfw1IpXiyJCVLNW0yn&id=Project%3ACalculate+Days+To+Go#)

This action follows the principle of being very simple to use but, if you really want to, you can do some pretty crazy combinations of configurations. Easy to use, but powerful if you need it!

- If you don't configure anything, the action will simply output a bunch of variables (day, month, year, etc) regarding the current date
- You can specify an Output Format to, additionally, output another variable with the format you specify
- You can specify multiple Output Formats if you want to simultaneously output into different formats. For example, you could want the date and time in different variables, and this allows you to do that easily
- You can change the Formatted Variable Names so that you can for example specify 2 output formats and give them relevant names directly in this action.
- If you change the Input Type from Now to something else, you can format/get variables regarding a date that's not the current one
- You can use %TIMEMS (Milliseconds Since Epoch), %TIMES (Seconds since Epoch), ISO 8601 (a widely used format) or any other custom format you want with the Custom Input Type
- If you use the Custom Input Type you can input one or multiple input dates each with its own Input Format if you want (you can use 1 input format for all of the inputs too if you want)
- If you use multiple Inputs and multiple Output Formats at the same time, you'll get all the inputs formatted in all the outputs. For example, if you have 2 inputs and 3 output formats you'll end up with 6 output variables each with its own different input/format combination
- On top of all of this you can enable the Get All Details option which will add a bunch of pre-determined variables to the output. Stuff like Minute of Day, Week of Year, Is Week Day and many more. Stuff that you may not always want but that can be handy sometimes!
