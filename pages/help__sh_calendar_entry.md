# Calendar Entry

Source: https://tasker.joaoapps.com/userguide/en/help/sh_calendar_entry.html

An Android Calendar entry with the specified parameters is currently active.

Any unspecified parameters are ignored i.e. any calendar entry will be matched.

The *Calendar* field is a pattern match, but the name of the calendar provider befoe the : (probably Google) is **not** e.g. Google:*@test.com is valid, G*gle:one@test.com is not.

See Also: action Misc / Test, variables %CALTITLE, %CALDESCR, %CALLOC

#### Start Early

The amount of minutes to activate the state before the calendar event actually starts

#### End Later

The amount of minutes to deactivate the state after the calendar event actually ends
