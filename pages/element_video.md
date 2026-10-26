# Scene Element: Video

Source: https://tasker.joaoapps.com/userguide/en/element_video.html

#### About

Displays a video from file or URI.

The playback state is maintained during rotation or hiding of the scene.

#### Parameters: Source

Determines where to acquire the content for the video.

A source which starts with a **/** or does not contain a **:** is treated as a local file path.

Anything else is treated as a URI.

#### Parameter: Start Automatically

If checked, whenever a new video is loaded it will begin play immediately. If not checked, the video must be started via the [Element Video Control](help__ah_element_video_control) action.

#### Parameter: Loop

If checked, the video will start playing again from the start when the end is reached.

#### Parameter: Adapt To Fit

What to do when the video size does not exactly match the element size.

- *Stretch*
  The video is stretched (or shrunk) to fill the element, probably changing the aspect ratio in the process
- *Scale*
  The video is scaled up or down while maintaining the aspect ratio until it horizontally or vertically matches the element size. As a result, the video will not completely fill the element on the other side.

#### Events

- [Tap, Long Tap](activity_elementedit#tap)
- [Stroke](activity_elementedit#stroke)
- [Video](activity_elementedit#video)

#### Related Actions

- [Element Video Control](help__ah_scene_element_video_control)
- [Element Focus
- [Element Position](help__ah_scene_element_position)
- [Element Size](help__ah_scene_element_size)
- [Element Visibility](help__ah_scene_element_visibility)
- [Element Depth](help__ah_scene_element_depth)
- [Test Element](help__ah_scene_element_test)

Note on `Test Element`: testing the element *Value* returns the current playback position in Milliseconds, *Maximum Value* returns the duration of the current video. In both cases, the video must be already in the 'Prepared' (see the [Video event](activity_elementedit#video)) state before running the test.

#### See Also

The [Element Editor](activity_elementedit) screen.
