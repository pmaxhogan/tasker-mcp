# Widget v2

Source: https://tasker.joaoapps.com/userguide/en/help/ah_widget_v2.html

This action allows you to create widgets on your home screen with various layouts, and makes it easy to run your tasks from it.

To use these widgets:

- add a new **Widget v2** Tasker widget to your home screen
- configure it on your home screen to give it a name that you can then use reference it in Tasker
- in Tasker, in a task add the **Widget v2** action
- in **Widget Name** use the magnifying glass to select the widget you added to your home screen
- Select the **Layout** you want to use
- Configure the fields below to your liking

##### Widget Layouts

###### Buttons

One or more icons and labels similar to the home screen app icons you have on your launcher.

Set images for the buttons in the **Images** input, and set the labels in the **Texts** input.

Tutorial on how to create a buttons list [here](https://bit.ly/tasker_dynamic_icons)

###### Media

A media-player-like widget with a big image on the left, some text at the top and some control buttons at the bottom. You can use this for media but also for any functionality you like.

The first image you set in the **Images** input will be used for the big image on the left. The rest of the images will be used for the buttons on the bottom.

The **Title** will be used as the top text while the **Texts** will be used as bottom texts.

Example Dynamic Media Widget [here](https://bit.ly/tasker_dynamic_media_widget)

###### Circular Image

A simple image with a circular cutout.

###### Table

A list of rows that will be structured like a table

Each **Cell** in the table can contain either an **image** or a **text** but **not both**.

To get a table with 2 rows, with 3 images at the top and 3 texts at the bottom you would set:

- **Images**: image1.png,image2.png,image3.png
- **Texts**: ,,,text 1, text 2, text 3

Notice how the first 3 texts were left empty to accomodate for the 3 cells in which texts aren't used.

###### Custom

Any layout you want! 😁 You can infinitely customize the layout exactly to your liking!

Example Reddit Widget [here](https://bit.ly/tasker_reddit_widget)

Example Remote Device Widget [here](https://bit.ly/tasker_remote_device_widget)

More info about the Custom Layout [here](widgetv2_custom).
