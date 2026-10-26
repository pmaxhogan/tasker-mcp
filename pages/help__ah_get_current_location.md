# Get Location v2

Source: https://tasker.joaoapps.com/userguide/en/help/ah_get_current_location.html

Allows you to get your location in a more accurate, fast and easy than the original **Get Location** action.

The action will return a bunch of location related [local variables](variables) that you can use right away.

**Important Note**: Some variables like **altitude**, **bearing** and **speed** are only set if the location is GPS based. To force GPS based location set the **Min Speed Accuracy** value.

#### Inputs

Minimum Accuracy

The maximum radius of uncertainty (in meters) that the returned location should have.

For example, if you want to get your location and make sure that it's really accurate you should use a value like 10 in this field.

Be aware that while you're indoors it's usually very hard for your phone to get an accurate location so the action might time out while trying to get a location with this filter set a value too low.

Speed and Altitude

Use the magnifying glass to help you out with these.

You can use the **=,>=,<=,>,<** symbols to specify your condition.

For example, if you want to get your location when your speed is above 10 meters per second you would set the **Speed** field to **>10**.

Near Location

Use the magnifying glass to help you out with this.

Format for this field is **latitude,longitude,radius**

Setting this field will make Tasker wait until you're inside the radius for the specified location and only then will it return your location.

Enable Location If Needed

If your location settings are off when this action is used Tasker can automatically enable location for you.

Min Speed Accuracy

Setting this field will make the action wait until the desired accuracy is achieved before returning its values to the task.

Since speed is only measured when using the GPS sensor on your phone you can set this field to force it to get the speed and other GPS related values.
