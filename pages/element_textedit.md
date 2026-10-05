# Scene Element: TextEdit

Source: https://tasker.joaoapps.com/userguide/en/element_textedit.html

#### About

A standard Android box for text entry.

TextEdit elements cannot appear in Overlay scenes.

#### Parameter: Text

This is the **initial** text to show in the element, with any variables replaced.

Note that if *Text* contains a variable, any changes in the variable value once the element have been shown will **not** be reflected in the visible contents of the text box. The reason for this limitation is that the user can change the text box contents by typing at any time so it is not possible to track where the variable contents should be, or even if they are still there at all.

#### Parameter: Position

Where to place the text within its box

#### Parameter: Text Width Scale

Horizontal scaling factor to squash up (negative values) or stretch (positive values) the text.

#### Events

[Text Changed](activity_elementedit#text) [Focus](activity_elementedit#focus)

#### Related Actions

- [Element Text
- [Element Text Colour](help__ah_scene_element_text_colour)
- [Element Border](help__ah_scene_element_border)
- [Element Back Colour](help__ah_scene_element_background_colour)
- [Element Focus
- [Element Position](help__ah_scene_element_position)
- [Element Size](help__ah_scene_element_size)
- [Element Visibility](help__ah_scene_element_visibility)
- [Element Depth](help__ah_scene_element_depth)
- [Test Element](help__ah_scene_element_test)

#### See Also

The [Element Editor](activity_elementedit) screen.
