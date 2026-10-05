# Test Net

Source: https://tasker.joaoapps.com/userguide/en/help/ah_test_net.html

Test a network attribute.

Possible Connection Types are **none, mobile, wifi, mms, supl, dun, hipri, wimax, bluetooth, dummy, ethernet**, and **vpn**.
Mobile Data and Wifi Hidden are **yes** or **no**.

BT Paired Addresses is a comma-separated list of the bluetooth devices this device is paired with. The other BT tests need a name or address to test.

BT Device Connected may require Tasker to be enabled when the device connects (for some device types).
Bluetooth must be enabled for all BT tests.

**Important Note:** if you use the **Mobile Data** action in Tasker to change your mobile data's status and it simply changes the UI instead of the real setting, the **Test Net** action will report the mobile data's UI status and not its real status.
