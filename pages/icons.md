# Icons

Source: https://tasker.joaoapps.com/userguide/en/icons.html

Tasker can use four categories of icons: Application, Built-In, Ipack, User-Installed.

In some places it's also possible to use any image stored on local media as an icon.

#### Application Icons

These are taken from applications installed on the device.

Minor note: if the icon of the application changes, an update of previously created widgets/shortcuts can be forced by creating a single widget with the new icon and then rebooting.

#### Built-In Icons

These come with Tasker and are kept in the device's memory.

#### Ipack Icon Sets

[Ipack](http://ipack.dinglisch.net/) is a free, open format for sharing of icon sets between Android applications. Ipack icon sets can be either installed from [Play Store](http://market.android.com/search?q=ipack) or from the [Ipack website](http://ipack.dinglisch.net/download.html).

When setting an icon, you will notice an item labelled *Download More Icons*. Clicking on it will use the appropriate source depending on which version of Tasker you have.

#### User-Installed Icons

You can also install your own icons directly into Tasker's icon directory `/sdcard/Tasker/.icn/`. Make sure the icons are in a subdirectory. The subdirectory should also only be one level deep (no subsubdirectories).

Icons must be in PNG format.

Example: a two-icon set called *Christmas* would have the two files in these locations:

`/sdcard/Tasker/.icn/Christmas/santa.png`
`/sdcard/Tasker/.icn/Christmas/snowman.png`
