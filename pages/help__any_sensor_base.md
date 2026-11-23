# Any Sensor Conditions Explained

Source: https://tasker.joaoapps.com/userguide/en/help/any_sensor_base.html

Check out a video demo of this functionality [here](https://www.youtube.com/watch?v=766S-KRnaiE).

The **Any Sensor** event and state will allow you to trigger tasks based on **any** of your device's sensors report.

Use the built-in helper (magnifying glass) to quickly find the sensor you want to monitor.

Type

The sensor type you want to monitor. Can be the sensor's [type number constant](https://developer.android.com/reference/android/hardware/Sensor.html#TYPE_ACCELEROMETER) (ie. 1 for accelerometer, 13 for temperature, etc) or the sensor's name as detected by Tasker.

Interval

How often Tasker will ask for the sensor to report values. You're guaranteed to never receive updates faster than this value, but may receive updates slower than this value depending on the sensor.

Interval Type

How Tasker will report the events:

- **Throttle** will trigger with the first event in each check interval and see if it matches the condition
- **Sample** will trigger with the last event in each check interval and see if it matches the condition
- **Debounce** will only trigger with events from the sensor if they stop being sent during the time set in Interval (for example, if you want to trigger a task on orientation change, and you turn your phone upside down, without debouncing, 2 events could be triggered, but with debouncing only one would be triggered)
- **Buffer** will gather the events in each check interval and return them all at once to the task, so you can for example make a task based on all of the events that happened in the last 5 seconds if you want (for example, do something if phone is upside down, then upright, then upside down again)
- **None** will trigger your task as soon as the event is received from the sensor. Not recommended for sensors that report a lot of events like the gravity sensor or gyroscope related sensors.
- **Buffer Debounce** is a combination of the **Buffer** and **Debounce** modes. It will gather the events into an array but won't trigger the profile until the specified amount of time without sensor events happening has passed.
