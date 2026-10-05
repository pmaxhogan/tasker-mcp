# Power Menu Action (Android 11+)

Source: https://tasker.joaoapps.com/userguide/en/help/ah_power_menu_action.html

Allows you to completely configure a Power Menu Tile. These tiles show up on Android 11 when you long-press the power button. Check out a demo video of this [here](https://youtu.be/hCplbDJ_NyI?t=107).

#### Example Projects:

[Create a Power Menu toggle tile](https://forum.joaoapps.com/index.php?resources/create-a-power-menu-action-toggle.506/)

[Create a dynamic app launcher in your Power Menu](https://forum.joaoapps.com/index.php?resources/create-a-dynamic-app-launcher-power-menu-tile.507/)

#### Important Note: Check here if Tasker's controls don't show up for you.

ID

Allows you to specify which tile you want to update. If a tile with the same ID doesn't exist, a new one will be created. If a tile with the ID already exists, it'll be overwritten with the new settings when you run the action.

Action

Instead of editing a tile you can delete it.

Type

You can create several types of tiles:

- **Button**: a simple button with no state. It doesn't turn on or off
- **Toggle**: like a switch, it turns on or off. It's state can be configured with the **Active** input field.
- **Range**: Is set to a current value in a range. For example, you could set a range of 1 to 10, and let the current value be 5 and it would create a button just half selected.
- **Toggle Range**: A combination of the two above. If clicked it will act like a toggle, but you can also drag your finger on it to select its current position.
- **No Action**: A tile that cannot be interacted with. Use it to display some useful information that is not interactive.

Title

Text that appears on the top row of the tile

Subtitle

Text that appears on the bottom row of the tile

Icon

Icon that goes with the tile

Command

Command that's sent to Tasker when the tile is used.

The command will trigger Tasker's **Command** Event.

This uses the [Tasker Command System](https://tasker.joaoapps.com/commandsystem.html).

Depending on the type of tile, the command will be sent differently:

- **Button**: only the command will be sent
- **Toggle**: The command will be sent followed by the new state of the tile, eg. **command=:=state**, where **state** is either **true** or **false**.
- **Range**: The command will be sent followed by the current selected value in the range, eg. **command=:=current_value**
- **Toggle Range**: both the state and range will be sent, eg. **command=:=state=:=current_value**.

Range Format

Follows the Java [String Format](https://docs.oracle.com/javase/tutorial/java/data/numberformat.html) specification for **float** numbers.

Allows you to customize how the range number appears on the screen.

The default value for this is **%.1f**
