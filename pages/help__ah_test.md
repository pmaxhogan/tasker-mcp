# Actions | Test

Source: https://tasker.joaoapps.com/userguide/en/help/ah_test.html

## Test

Test the value of a particular thing and put it in a variable.

Failed tests will result in the specified result variable being cleared.

**File tests:** directories always have 0 size and their modification time is the time a file was last added or deleted from them. File type is either file or dir.

**Contact lookups:** based on the phone number of the contact.

**Calendar values:** require the time in seconds since the epoch as data (e.g. use %TIMES, or use the Variable Convert action to convert a date/time into seconds first) and are entered in an array (%var1, %var2 etc), not a plain value, because there may be multiple events at the time specified.

## See also

[Variables](variables) section in the Userguide.
