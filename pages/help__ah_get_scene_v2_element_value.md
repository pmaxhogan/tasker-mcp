# Get Scene v2 Values

Source: https://tasker.joaoapps.com/userguide/en/help/ah_get_scene_v2_element_value.html

Reads the values that a currently visible Scene V2 is outputting and stores them in local variables.

Every output variable that the scene's elements are configured to produce is returned, using the variable names you set up in the scene.

**Screen ID** is required and must match the Screen ID used when the scene was shown.

For example, a **TextInput** returns the text the user entered and a **Switch** returns its checked state. Elements with no output variable configured, such as a plain **Text** element, produce nothing.

If more than one element writes to the same variable name, that variable is returned as an array.

Check [Scenes V2 (Screen Builder) Manual](scenes_v2) for full details on how Scenes V2 work.
