# Clear Quick Setting Tile

Source: https://tasker.joaoapps.com/userguide/en/help/ah_clear_quick_setting.html

Reset one of Tasker's Quick Settings tiles back to its empty, unconfigured state.

Every value previously set with the Set up Quick Setting Tile action is removed: the short, long and double click Tasks and Commands, the Command Prefix, Label, Subtitle, Icon, Status and the Can Use On Locked Device and Hide Notification Shade options.

**Number**: which tile to clear, from 1 to 50.

Tiles 4 to 50 are hidden from Android's own Quick Settings editor until they are configured, so clearing one of them also removes it from your active tiles in the panel. Android remembers the tile's place, though: if you later set the same tile up again with Set up Quick Setting Tile, it comes back in the same position it had before.

You can use this quirk to build dynamic tile layouts whose length changes on demand. Clearing tiles shrinks the visible set and setting them up again grows it, and because each tile always returns to its original slot the layout keeps its order no matter how many elements you currently show.

Tiles 1 to 3 are always available and are simply returned to their default appearance.

It is not classified as an error to clear a tile that was not previously configured.

Requires Android 7.0 or later.

See Also: Set up Quick Setting Tile.
