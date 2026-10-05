# Arrays Merge

Source: https://tasker.joaoapps.com/userguide/en/help/ah_arrays_merge.html

Allows you to merge 2 or more arrays together with a given format.

For more info on each field please click the (?) button on each one.

[Watch a demo here](https://youtu.be/wV3DLmTZums)

[Import an example task here](https://taskernet.com/shares/?user=AS35m8ne7oO4s%2BaDx%2FwlzjdFTfVMWstg1ay5AkpiNdrLoSXEZdFfw1IpXiyJCVLNW0yn&id=Task%3ACheck+Crypto+Coin) (demo for task [here](https://youtu.be/0hjHtMwfGeM))

A lot of times in Tasker you end up with multiple related arrays.

For example, if you have

- array %names with the values João,John
- array %lastnames with the values Dias,Days

you can merge them together with a simple white space joiner and end up with an array like **João Dias,John Days** or you could use the format **%lastnames is %names's last name** wich would result in another 2 item array with the values **Dias is João's last name,Days is John's last name**
