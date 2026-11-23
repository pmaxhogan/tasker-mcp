# Set up Quick Setting Tile

Source: https://tasker.joaoapps.com/userguide/en/help/ah_set_quick_setting.html

Dynamically configure one of Tasker's Quick Settings tiles: the tiles in the panel you pull down from the top of the screen.

Tasker provides up to 50 tiles. The first 3 are always available to add from Android's own Quick Settings editor. The other 47 stay hidden from that editor until you configure them here: as soon as you give a tile a Task or a Command for any click type, it becomes available to add. Setting up a tile with no Task and no Command, or using the Clear Quick Setting Tile action, hides it from the editor again.

When you clear a dynamic tile (4 to 50) it also disappears from your active tiles in the panel, and setting the same tile up again brings it back in the same position as before. This lets you build dynamic tile layouts that grow and shrink on demand while keeping their order. See Clear Quick Setting Tile.

**Number**: which tile to configure, from 1 to 50.

**Task** / **Long Click Task** / **Double Click Task**: the tasks to run on a short click, long click or double click. If no task is specified, the tile receives its default appearance and functionality.

**Command** / **Long Click Command** / **Double Click Command**: instead of, or as well as, a task, send a Tasker command for that click type. The optional **Command Prefix** is sent along with the commands.

**Status**: the visual state of the tile (Active, Inactive or Disabled) in a way defined by the system. A Disabled tile does not respond to clicks.

**Label** / **Subtitle** / **Icon**: customise how the tile looks. The Subtitle is only shown on Android 10 and later.

**Can Use On Locked Device**: when off, clicking the tile on a locked device first asks the user to unlock and then runs the task. The Long Click task will not work on a locked device due to an Android limitation. Unfortunately there's no way to make it work.

**Hide Notification Shade**: when on, the pulled-down panel is closed automatically after the tile is clicked.

The effects of this action are only visible once the tile has been added to the set of used tiles via the Android UI.

Requires Android 7.0 or later.

See Also: Clear Quick Setting Tile, Prefs / Action / Quick Settings Tasks.
