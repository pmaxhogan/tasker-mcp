# JavaScript Support

Source: https://tasker.joaoapps.com/userguide/en/javascript.html

- Introduction
- Local Variables
- Global Variables
- Arrays
- Settings
- Execution
- Working Off-Device
- Builtin Functions
  alarmVol audioRecord audioRecordStop
  btVoiceVol browseURL button
  call callBlock callDivert callRevert callVol carMode clearKey composeEmail composeMMS composeSMS convert createDir createScene cropImage
  decryptDir decryptFile deleteDir deleteFile destroyScene displayAutoBright displayAutoRotate displayTimeout dpad dtmfVol
  elemBackColour elemBorder elemPosition elemText elemTextColour elemTextSize elemVisibility enableProfile encryptDir encryptFile endCall enterKey exit
  filterImage flash flashLong flipImage
  getLocation getVoice global goHome
  haptics hideScene
  listFiles loadApp loadImage local lock
  mediaControl mediaVol micMute mobileData musicBack musicPlay musicSkip musicStop
  nightMode notificationVol
  performTask popup profileActive pulse
  readFile reboot resizeImage ringerVol rotateImage
  saveImage say scanCard sendIntent sendSMS setAirplaneMode setAirplaneRadios setAlarm setAutoSync setBT setBTID setClip setGlobal setKey setLocal settings setWallpaper setWifi shell showScene shutdown silentMode sl4a soundEffects speakerphone statusBar stayOn stopLocation systemLock systemVol
  takeCall takePhoto taskRunning type
  usbTether unzip
  vibrate vibratePattern
  wait wifiTether writeFile
  zip
- Function Notes

### Introduction

Tasker supports running JavaScript code in tasks or [WebView](element_web) scene elements. Most Tasker actions can be accessed direct from the JavaScript. JSON and XMLHTTPRequest are also directly available from the JavaScript code.

#### JavaScript in Tasks

JavaScript can be embedded inline in tasks via the *JavaScriptlet* (direct specification of JavaScript to run) or *JavaScript* (load script from file) actions.

In both cases, the JavaScript executes in sequence with the other actions in the task and variables are transparently converted so pieces of JavaScript can be interwoven throughout the task.

#### Embedded in HTML

WebView elements allow specification of mixed HTML and JS for the element content.

` <H1 onClick="setWifi( false )">ClickMeToTurnOffWifi</H1> `

This allows a single WebView to present a complete user-interface.

### Local Variables

In `JavaScript(let)` actions, local variables (all lower case, e.g. **%myvar**) are directly accessible in the JavaScript without the % sign (e.g. **myvar**). If the script changes the value, the new value is transparently used by subsequent actions in the task.

The values of new (all lower case) variables declared in JavaScript (with the `var` keyword) are also available to subsequent actions, with the exception of those which are chain-declared e.g. `var one = 'aval', two = 'bval';`

In JavaScript embedded in HTML, the functions local and setLocal must be used to access variables local to the scene hosting the WebView.

If you're using a `JavaScript` or `JavaScriptlet` action and you disable **Auto Exit**, you have to set local variables with setLocal.

### Global Variables

Tasker global variables need to be accessed via global() and set via setGlobal(). Global arrays are not supported due to an Android limitation.

### Arrays

Local Tasker arrays are transparently available in *Javascript(let)*s and vice-versa. They are not available in WebViews.

Arrays which are not existing Tasker arrays must be declared in the JS as such i.e. in this case *arr* will not be visible to the remainder of the task:

```
	var arr = getSomeArray();
```

Whereas in this case it will:

```
	var arr = [];
	arr = getSomeArray();
```

Note that:

- JavaScript array indices start at 0, whereas Tasker array indices start at 1
- JavaScript uses `[]` while Tasker uses `()`

So, for example, `%arr(1)` (Tasker) is equivalent to `arr[0]` (JavaScript).

### Settings

Unlike normal Tasker actions, settings which are changed in JavaScript as part of a profile's enter task are **not** restored when the profile exits.

### Execution

#### Execution Instances

Only one script can execute at one time. Once a piece of JavaScript is executing, it cannot be interrupted by another piece.

#### Working Off-Device

You might wish to develop long and/or complicated tasks off-device e.g. on a PC. There are two strategies for that:

#### 1. JavaScript action

For off-device testing, use `Menu / More / Developer / Save JS Library Template` to get dummy definitions for the built in functions. Include that file when developing on your PC.

To test in your JavaScript code whether you're on-device or not, use

` var onAndroid = ( global( 'sdk' ) > 0 ); `

By using the `JavaScript` action rather than `JavaScriptlet` you can easily access a file synced from PC to a file on the Android device.

#### 2. Using WebView

If you specify a website URL as the content for your WebView, then testing the code on the target device is a simple matter of pushing the new version to your webserver and reloading the WebView on the device (see action [Element Web Control](help__ah_scene_element_web_control))

#### Builtin Function Execution

Calls to most Tasker builtin functions (see below) are executed as normal single-action tasks and thus may be blocked by other executing tasks.

They execute at the priority of the task that executed the JavaScript **plus two**.

#### JavaScript(let): Alert,Confirm,Prompt

Scripts using these functions require a 'user-interface' and may cause interference with the currently running app (though in most cases they will not).

#### JavaScript(let): Auto Exit

By default, the `JavaScript(let)` action will end when the main execution sequence is finished.

If you are using asynchronous code e.g. via *setTimeout()* or other callbacks, you should deselect *Auto Exit*. You are then responsible yourself for telling Tasker to continue the task by calling *exit()*.

In any case, execution will stop when the timeout configured for the action is reached.

#### JavaScript(let): Libraries

You can specify as many libraries as you want in the *Libraries* parameter, separated by newlines.

Several popular libraries are pre-selectable.

You may wish to download them manually to your local storage and change the *http* URL to a *file* URL so that Internet is not required to run your script.

Warning: library code will have access to local files, data providers etc. on the device

Important: if you are using your own libraries developed on Windows, you may need to convert CRLF style line endings to Unix style LF.

### Builtin Functions

Tasker makes most of it's actions available via functions which can be called directly via name in `JavaScript(let)` actions and WebView elements.

Exceptions:

- in WebView content where mode is set to **URL**, the functions must be prefixed by **tk** e.g. `tk.flash('Woo!')`
- when executing code via *eval* the functions must be prefixed by **tk.**

##### alarmVol / btVoiceVol / callVol / dtmfVol / mediaVol / notificationVol / systemVol / ringerVol

`var ok = alarmVol( int level, bool display, bool sound )`

Set the relevant system volume to *level*.

If *display* is true, the new level will be flashed up on-screen.

If *sound* is true, a tone will sound at the new level.

##### audioRecord

`var ok = audioRecord( str destPath, str source, str codec, str format )`

- *destPath*: where to put the recording. Note that a file extension is not necessary, it will correspond to the selected *format*.
- *source*: **def, mic, call, callout** or **callin**
- *codec*: **amrn, amrw** or **aac**
- *format*: **mp4, 3gpp, amrn** or **amrw**

The JavaScript does **not** wait for the audio recording to complete.

See also: audioRecordStop().

##### audioRecordStop

`var ok = audioRecordStop()`

Stop recording previously initiated by audioRecord().

##### browseURL

`var ok = browseURL( str URL )`

Open the default browser at the specifed URL.

##### button

`var ok = button( str name )`

Simulate a press of the named button.

*name* must be one of **back, call, camera, endcall, menu, volup, voldown** or **search**.

This function requires a rooted device.

##### call

`var ok = call( str num, bool autoDial )`

Make a phone call.

If *autoDial* is **false**, the phone app will be brought up with the number pre-inserted, if **true** the number will also be dialed.

##### callBlock

`var ok = callBlock( str numMatch, bool showInfo )`

Block **outgoing** calls [matching](matching) *numMatch*.

If *showInfo* is set, Tasker will flash a message when a call is blocked.

##### callDivert

`var ok = callDivert( str fromMatch, str to, bool showInfo )`

Divert **outgoing** calls [matching](matching) *fromMatch* to the number *to*.

If *showInfo* is set, Tasker will flash a message when a call is diverted.

##### callRevert

`var ok = callRevert( str numMatch )`

Stop blocking or diverting outgoing calls previously specified with callBlock or callDivert.

##### carMode

`var ok = carMode( bool onFlag )`

Turn on or off Android Car Mode.

##### clearKey

`var ok = clearKey( str keyName )`

Clear the passphrase for the specified *keyName*.

See Also: [Encryption](encryption) in the Userguide.

##### composeEmail

`var ok = composeEmail( str to, str subject, str message )`

Show an email composition dialog with any specified fields pre-filled.

The JavaScript does **not** wait for the email to be sent before continuing.

##### composeMMS

`var ok = composeMMS( str to, str subject, str message, str attachmentPath )`

Show an MMS composition dialog with any specified fields pre-filled.

The JavaScript does **not** wait for the MMS to be sent before continuing.

##### composeSMS

`var ok = composeSMS( str to, str message )`

Show an SMS composition dialog with any specified fields pre-filled.

The JavaScript does **not** wait for the SMS to be sent before continuing.

##### convert

`var result = convert( str val, str conversionType )`

Convert from one type of value to another.

*conversionType* must be one of the string constants: **byteToKbyte, byteToMbyte, byteToGbyte, datetimeToSec, secToDatetime, secToDatetimeM, secToDatetimeL, htmlToText, celsToFahr, fahrToCels, inchToCent, metreToFeet, feetToMetre, kgToPound, poundToKg, kmToMile, mileToKm, urlDecode, urlEncode, binToDec, decToBin, hexToDec, decToHex, base64encode base64decode, toMd5, toSha1, toLowerCase, toUpperCase, toUpperCaseFirst**.

See also: action [Variable Convert](help__ah_convert_variable).

##### createDir

`var ok = createDir( str dirPath, bool createParent, bool useRoot )`

Create the named *dirPath*. If *createParent* is specified and any parent directory does not exist, it will also be created.

If *useRoot* is specified, the operation will be performed as the root user (where available).

##### createScene

`var ok = createScene( str sceneName )`

Create the named [scene](scenes) without displaying it.

##### cropImage

`var ok = cropImage( int fromLeftPercent, int fromRightPercent, int fromTopPercent, int fromBottomPercent )`

Crop an image in Tasker's image buffer previously loaded via loadImage.

##### decryptDir

`var ok = decryptDir( str path, str key, bool removeKey )`

As decryptFile(), but decrypts each file in the specified directory in turn.

##### decryptFile

`var ok = decryptFile( str path, str key, bool removeKey )`

Decrypt the specified file using the encryption parameters specified in `Menu / Prefs / Action`.

If *removeKey* is not set, the entered passphrase will be reapplied automatically to the next encryption/decryption operation with the specified *keyName*.

See Also: [Encryption](encryption) in the Userguide, [Decrypt File](help__ah_decrypt_file) action.

##### deleteDir

`var ok = deleteDir( str dirPath, bool recurse, bool useRoot )`

Delete the named *dirPath*. *recurse* must be specified if the directory is not empty.

If *useRoot* is specified, the operation will be performed as the root user (where available).

##### deleteFile

`var ok = deleteFile( str filePath, int shredTimes, bool useRoot )`

Delete the named *filePath*.

*shredTimes* has range 0-10.

If *useRoot* is specified, the operation will be performed as the root user (where available).

See also: action [Delete File](help__ah_delete_file)

##### destroyScene

`var ok = destroyScene( str sceneName )`

Hide the named [scene](scenes) if it's visible, then destroy it.

##### displayAutoBright

`var ok = displayAutoBright( bool onFlag )`

Whether the display brightness should automatically adjust to the ambient light or not.

##### displayAutoRotate

`var ok = displayRotate( bool onFlag )`

Whether the display orientation should change based on the physical orientation of the device.

##### displayTimeout

`var ok = displayTimeout( int hours, int minutes, int seconds )`

How long the period of no-activity should be before the display is turned off.

##### dpad

`var ok = dpad( str direction, int noRepeats )`

Simulate a movement or press of the hardware dpad (or trackball).

*direction* must be one of **up, down, left, right** or **press**.

This function requires a rooted device.

##### enableProfile

`var ok = enableProfile( str name, boolean enable )`

Enable or disable the named Tasker profile.

##### encryptDir

`var ok = encryptDir( str path, str keyName, bool rememberKey, bool shredOriginal )`

As encryptFile(), but encrypts each file in the specified directory in turn.

##### elemBackColour

`var ok = elemBackColour( str scene, str element, str startColour, str endColour )`

Set the background colour of the specified [scene](scenes) element.

See also: action [Element Back Colour](help__ah_scene_element_background_colour).

##### elemBorder

`var ok = elemBorder( str scene, str element, int width, str colour )`

Set the border colour and width of the specified [scene](scenes) element.

##### elemPosition

`var ok = elemPosition( str scene, str element, str orientation, int x, int y, int animMS )`

Move an element within it's scene.

*orientation* must be one of **port** or **land**. *animMS* indicates the duration of the corresponding animation in MS. A zero-value indicates no animation.

See also: action [Element Position](help__ah_scene_element_position).

##### elemText

`var ok = elemText( str scene, str element, str position, str text )`

Set the text of the specified [scene](scenes) element.

*pos* must be one of **repl** (replace existing text completely), **start** (insert before existing text) or **end** (append after existing text).

See also: action [Element Text](help__ah_scene_element_text).

##### elemTextColour

`var ok = elemTextColour( str scene, str element, str colour )`

Set the text colour of the specified [scene](scenes) element.

See also: action [Element Text Colour](help__ah_scene_element_text_colour).

##### elemTextSize

`var ok = elemTextSize( str scene, str element, int size )`

Set the text size of the specified [scene](scenes) element.

See also: action [Element Text Size](help__scene_element_text_size).

##### elemVisibility

`var ok = elemVisibility( str scene, str element, boolean visible, int animationTimeMS )`

Make the specified [scene](scenes) element visible or invisible.

See also: action [Element Visibility](help__ah_scene_element_visibility).

##### endCall

`var ok = endCall()`

Terminate the current call (if there is one).

##### encryptFile

`var ok = encryptFile( str path, str keyName, bool rememberKey, bool shredOriginal )`

Encrypt the specified file using the encryption parameters specified in `Menu / Prefs / Action`.

If *rememberKey* is set, the entered passphrase will be reapplied automatically to the next encryption/decryption operation with the specified *keyName*.

If *shredOriginal* is specified, the original file will be overwritten several times with random bits if encryption is successful.

See Also: [Encryption](encryption) in the Userguide, [Encrypt File](help__ah_encrypt_file) action.

##### enterKey

`var ok = enterKey( str title, str keyName, bool showOverKeyguard, bool confirm, str background, str layout, int timeoutSecs )`

Show a dialog to enter the passphrase for the specified *keyName*. The JavaScript waits until the dialog has been dismissed or the timeout reached.

- *confirm*: if set, the passphrase must be entered twice to ensure it is correct.
- *background*: [optional] a file path or file URI to a background image.
- *layout*: the name of a user-created [scene](scenes) to use in place of the built-in scene.

See Also: [Encryption](encryption) in the Userguide

##### filterImage

`bool ok = filterImage( str mode, int value )`

Filter an image previously loaded into Tasker's image buffer via loadImage()

Possible values of *mode* are:

- **bw**: convert to black & white, using *value* as a threshold
- **eblue**: enhance blue values by *value*
- **egreen**: enhance green values by *value*
- **ered**: enhance red values by *value*
- **grey**: convert to greyscale, *value* is unused
- **alpha**: set pixel alpha (opposite of transparency) to *value*

*value* should be 1-254.

##### flipImage

`bool ok = flipImage( bool horizontal )`

Flip an image previously loaded into Tasker's image buffer via loadImage()

If *horizontal* is false, the image is flipped vertically.

##### exit

`exit()`

Stop execution of the JavaScript.

##### flash

`flash( str message )`

Flash a short-duration Android 'Toast' message.

##### flashLong

`flashLong( str message )`

Flash a long-duration Android 'Toast' message.

##### getLocation

`var ok = getLocation( str source, bool keepTracking, int timeoutSecs )`

Try to get a fix of the current device location.

*source* must be one of **gps, net** or **any**.

If *keepTracking* is set, the specified source(s) will be left tracking with the purpose of providing a much quicker fix next time the function is called.

Fix coordinates are stored in the global Tasker variables **%LOC** (GPS) and/or **%LOCN** (Net). The value can be retrieved with the global function. Several other parameters of the fix are also available, see [Variables](variables).

Example

```
	var lastFix = global( 'LOC' );
	if ( 
		getLocation( 'gps' ) &&
		( global( 'LOC' ) != lastFix ) 
	) {
		flash( "New fix: " + global( 'LOC' ) );
	}
```

See also: action [Get Location](help__ah_get_fix), function stopLocation.

##### getVoice

`str result = getVoice( str prompt, str languageModel, int timeout )`

Get voice input and convert to text.

*result* is 'undefined' if the voice acquisition failed, otherwise it's an array of possible matching texts.

*prompt* is a label for the dialog that is shown during voice acquisition.

*languageMode* gives the speech recognition engine a clue as to the context of the speech. It must be one of **web** for 'web search' or **free** for 'free-form'.

##### goHome

`goHome( int screenNum )`

Go to the Android home screen. *screenNum* is not supported by all home screens.

##### haptics

`var ok = haptics( bool onFlag )`

Enable/disable system setting Haptic Feedback.

##### hideScene

`var ok = hideScene( str sceneName )`

Hide the named [scene](scenes) if it's visible.

##### global

`var value = global( str varName )`

Retrieve the value of a Tasker global variable. Prefixing the name with % is optional.

Example:

```
	flash( global( '%DogName' ) );
```

##### listFiles

`str files = listFiles( str dirPath, bool hiddenToo )`

List all files in the specified *dirPath*.

*files* is a newline-separated list of subfiles.

If no files or found or an error occurs, the returned value will be `undef`.

If *hiddenToo* is specified, files starting with period are included, otherwise they are not.

Example:

```
	var files = listFiles( '/sdcard' );
	var arr = files.split( '\n' );
	flash( 'Found ' + arr.length + ' files' );
```

##### loadApp

`var ok = loadApp( str name, str data, bool excludeFromRecents )`

Start up the named app.

*Name* can be a package name or app label, it's tested first against known package names. **Note**: app label could be localized to another language if the script is used in an exported app.

*Data* is in URI format and app-specific.

When *excludeFromRecents* is true, the app will not appear in the home screen 'recent applications' list.

##### loadImage

`var ok = loadImage( str uri )`

Load an image into Tasker's internal image buffer.

The following uri formats are currently supported:

- *file://* followed by a local file path

See also [Load Image](help__ah_load_image) action.

##### lock

`var ok = lock( str title, str code, bool allowCancel, bool rememberCode, bool fullScreen, str background, str layout )`

Show a lock screen, preventing user interaction with the covered part of the screen. The JavaScript waits until the code has been entered or the lock cancelled (see below).

- *code*: the numeric code which must be entered for unlock
- *allowCancel*: show a button to remove the lockscreen, which causes a return to the Android home screen
- *rememberCode*: the code will be remembered and automatically entered when the lock screen is show in future, until the display next turns off
- *background*: [optional] a file path or file URI to a background image.
- *layout*: the name of a user-created [scene](scenes) to use in place of the built-in lock scene

##### local

`var value = local( str varName )`

Retrieve the value of a Tasker scene-local variable. The name should **not** be prefixed with *%*.

This function is only for use by JavaScript embedded in HTML and accessed via a WebView scene element.

##### mediaControl

`var ok = mediaControl( str action )`

Control media via simulation of hardware buttons.

Possible *action*s are **next, pause, prev, toggle, stop** or **play**.

##### micMute

`var ok = micMute( bool shouldMute )`

Mute or unmute the device's microphone (if present),

##### mobileData

`var ok = mobileData( bool set )`

Enable or disable the system Mobile Data setting.

See also: action [Mobile Data](help__ah_mobile_data_direct)

##### musicBack

`var ok = musicBack( int seconds )`

Skip back by *seconds* during playback of a music file previously started by musicPlay.

See also: musicSkip, musicStop

##### musicPlay

`var ok = musicPlay( str path, int offsetSecs, bool loop, str stream )`

Play a music file via Tasker's internal music player.

*stream* to which audio stream the music should be played

This function does **not** not wait for completion.

The last 3 arguments may be ommitted, in which case they default to **0**, **false** and **media** respectively.

See also: musicStop, musicBack, musicSkip

##### musicSkip

`var ok = musicSkip( int seconds )`

Skip forwards by *seconds* during playback of a music file previously started by musicPlay.

See also: musicBack, musicStop

##### musicStop

`var ok = musicStop()`

Stop playback of a music file previously started by musicPlay.

See also: musicBack, musicSkip

##### nightMode

`var ok = nightMode( bool onFlag )`

Turn on or off Android Night Mode.

##### popup

`var ok = popup( str title, str text, bool showOverKeyguard, str background, str layout, int timeoutSecs )`

Show a popup dialog. The JavaScript waits until the popup has been dismissed or the timeout reached.

- *background*: [optional] a file path or file URI to a background image.
- *layout*: the name of a user-created [scene](scenes) to use in place of the built-in popup scene.

##### performTask

`var ok = performTask( str taskName, int priority, str parameterOne, str parameterTwo, str returnVariable, bool stop, bool variablePassthrough, str variablePassthroughList, bool resetReturnVariable )`

Run the Tasker task *taskName*.

Note that the JavaScript does not wait for the task to complete.

##### profileActive

`bool active = profileActive( str profileName )`

Whether the named Tasker profile is currently active. Returns false if the profile name is unknown.

##### pulse

`bool ok = pulse( bool onFlag )`

Enable or disable the Android Notification Pulse system setting.

##### readFile

`var contents = readFile( str path )`

Read the contents of a text file.

##### reboot

`var ok = reboot( str type )`

Reboot the device.

*type* is one of **normal, recovery** or **bootloader**. It can be ommitted and defaults to **normal**.

Requires a rooted device.

See also: function shutdown

##### resizeImage

`var ok = resizeImage( int width, int height )`

Scale the current image in Tasker's image buffer to the specified dimensions.

##### rotateImage

`var ok = rotateImage( str dir, int degrees )`

Rotate the current image in Tasker's image buffer.

*dir* must be one of **left** or **right**. *degrees* must be one of **45, 90, 135** or **180**.

##### saveImage

`var ok = saveImage( str path, int qualityPercent, bool deleteFromMemoryAfter )`

Save the current image in Tasker's image buffer to the specified file *path*.

[Save Image](help__ah_save_image) action.

##### say

`var ok = say( str text, str engine, str voice, str stream, int pitch, int speed )`

Cause the device to say *text* out loud.

- *engine*: the speech engine e.g. **com.svox.classic** Defaults to the system default (specify *undefined* for that)
- *voice*: the voice to use (must be supported by *engine*). Defaults to the current system language (specify *undefined* for that)
- *stream*: to which audio stream the speech should be made
- *pitch*: 1-10
- *speed*: 1-10

The script waits for the speech to be finished.

##### sendIntent

`var ok = sendIntent( str action, str targetComp, str package, str class, str category, str data, str mimeType, str[] extras );`

Send an intent. Intents are Android's high-level application interaction system.

Any parameter may be specified as undefined.

- *targetComp*: the type of application component to target, one of **receiver, activity** or **service**. Defaults to **receiver**.
- *package*: the application package to limt the intent to
- *class*: the application class to limit the intent to
- *category*: one of **none, alt, browsable, cardock, deskdock, home, info, launcher, preference, selectedalt, tab** or **test**, defaults to **none**
- *extras*: extra data to pass, in the format *key:value*. May be undefined. Maximum length 2.

See also: action [Send Intent](help__ah_send_intent).

##### sendSMS

`var ok = sendSMS( str number, str text, boolean storeInMessagingApp );`

Send an SMS.

See also: action [Send SMS](help__ah_send_sms)

##### setAirplaneMode

`var ok = setAirplaneMode( bool setOn )`

Enable or disable Airplane Mode.

Get the current value with:

` var enabled = global( 'AIR' ); `

See also: function setAirplaneRadios

##### setAirplaneRadios

`var ok = setAirplaneRadios( str disableRadios )`

Specify the radios which will be **disabled** when the device enters Airplane Mode.

*disableRadios* is a comma-separated list with radio names from the following set: **cell, nfc, wifi, wimax, bt**.

Get the current value with:

` var radios = global( 'AIRR' ); `

See also: function setAirplaneMode

##### setAlarm

`var ok = setAlarm( int hour, int min, str message, bool confirmFlag )`

Create an alarm in the default alarm clock app.

*confirmFlag* specifies whether the app should confirm that the alarm has been set.

*message* is optional.

Requires Android version 2.3+.

##### setAutoSync

`var ok = setAutoSync( bool setOn )`

Enable or disable the global auto-sync setting.

##### scanCard

`var ok = scanCard( str path )`

Force the system to scan the external storage card for new/deleted media.

If *path* is defined, only that will be scanned.

See also: action [Scan Card](help__ah_scan_card)

##### setBT

`var ok = setBT( bool setOn )`

Enable or disable the Bluetooth radio (if present).

Test BT state with:

` if ( global( 'BLUE' ) == "on" ) { doSomething(); } `

##### setBTID

`var ok = setBTID( str toSet )`

Set the bluetooth adapter ID (the name as seen by other devices).

##### setGlobal

`setGlobal( str varName, str newValue )`

Set the value of a Tasker global user variable. Prefixing varName with % is optional.

Arrays are **not** supported due to limitations of the Android JS interface.

##### setKey

`var ok = setKey( str keyName, str passphrase )`

Set the passphrase for the specified *keyName*.

See Also: [Encryption](encryption) in the Userguide.

##### setLocal

`setLocal( str varName, str newValue )`

Set the value of a Tasker **scene-local** user variable. Variable names should **not** be prefixed with *%*.

This function is only for use by JavaScript embedded in HTML and accessed via a WebView scene element.

##### setClip

`var ok = setClip( str text, bool appendFlag )`

Set the global system clipboard.

Test the value with:

` var clip = global( 'CLIP' ); `

##### settings

`var ok = settings( str screenName )`

Show an Android System Settings screen.

*screenName* must be one of **all, accessibility, addacount, airplanemode, apn, app, batteryinfo, appmanage bluetooth, date, deviceinfo, dictionary, display, inputmethod, internalstorage, locale, location, memorycard, networkoperator, powerusage, privacy, quicklaunch, security, mobiledata, search, sound, sync, wifi, wifiip** or **wireless**.

##### setWallpaper

`var ok = setWallpaper( str path )`

Set the system home screen wallpaper.

##### setWifi

`var ok = setWifi( bool setOn )`

Enable or disable the Wifi radio (if present).

Test wifi state with:

` if ( global( 'WIFI' ) == "on" ) { doSomething(); } `

##### shell

`var output = shell( str command, bool asRoot, int timoutSecs )`

Run the shell command *command*.

*asRoot* will only have effect if the device is rooted.

*output* is 'undefined' if the shell command failed. It's maximum size is restricted to around 750K.

##### showScene

`var ok = showScene( str name, str displayAs, int hoffset, int voffset, bool showExitIcon, bool waitForExit )`

Show the named [scene](scenes), creating it first if necessary.

- *displayAs*: options: `Overlay, OverBlocking, OverBlockFullDisplay, Dialog, DialogBlur, DialogDim, ActivityFullWindow, ActivityFullDisplay, ActivityFullDisplayNoTitle`
- *hoffset, voffset*: percentage vertical and horizontal offset for the scene -100% to 100% (not relevant for full screen/window display types)
- *showExitIcon*: display a small icon in the bottom right which destroys the scene when pressed
- *waitForExit*: whether to wait for the scene to exit before continuing the script

##### shutdown

`var ok = shutdown()`

Shutdown the device.

Requires a rooted device.

See also: reboot

##### silentMode

`var ok = silentMode( str mode )`

Set the system silent ('ringer') mode.

*mode* must be one of **off, vibrate** or **on**

##### sl4a

`var ok = sl4a( str scriptName, boolean inTerminal )`

Run a previously created [SL4A](https://code.google.com/p/android-scripting/) script.

##### soundEffects

`var ok = soundEffects( bool setTo )`

Setting the system *Sound Effects* setting (sound from clicking on buttons etc.

##### speakerphone

`var ok = speakerPhone( bool setFlag )`

Enable or disable the speakerphone function.

##### statusBar

`var ok = statusBar( bool expanded )`

Expand or contract the system status bar.

##### stayOn

`var ok = stayOn( str mode )`

Specify whether the device should remain on when power is connected.

Possible *mode*s are **never, ac, usb, any**.

##### stopLocation

`var ok = stopLocation()`

Stop tracking a location provider. This is only relevant when a getLocation function has been previously called with the *keepTracking* parameter set.

##### systemLock

`var ok = systemLock()`

Turn off the display and activate the keyguard.

Requires Tasker's Device Administrator to be enabled in Android settings.

##### taskRunning

`bool running = taskRunning( str taskName )`

Whether the named Tasker task is currently running. Returns false if the task name is unknown.

##### takeCall

`bool ok = takeCall();`

Auto-accept an incoming call (if there is one).

##### takePhoto

`bool ok = takePhoto( int camera, str fileName, str resolution, bool insertGallery )`

Take a photo with the builtin camera.

- *camera*: 0 = rear camera, 1 = front camera
- *resolution*: format WxH e.g. 640x840
- *insertGallery*: whether to insert the resulting picture in the Android Gallery application

See also: action [Take Photo](help__ah_take_photo)

##### type

`var ok = type( str text, int repeatCount )`

Simulate keyboard typing.

Requires a rooted device.

##### unzip

`boolean ok = unzip( str zipPath, bool deleteZipAfter )`

Unpack a Zip archive into the parent directory of the archive.

*deleteZip* causes the zip archive to be deleted after successful unpacking.

##### usbTether

`usbTether( bool set )`

Enable or disable USB tethering.

See also: action [USB Tether](help__ah_tether_usb)

##### vibrate

`vibrate( int durationMilliseconds )`

Cause the device to vibrate for the specified time.

##### vibratePattern

`vibratePattern( str pattern )`

Cause the device to vibrate following the specified *pattern*, which consists of a sequence of off then on millisecond durations e.g.

`500,1000,750,1000`

wait for 500ms, vibrates 1000ms, wait for 750ms, then vibrate for 1000ms.

##### wait

`wait( int durationMilliseconds )`

Pause the script for the specified time.

Warning: may cause some preceeding functions not to complete in some situations. If in doubt, use JavaScript setTimeout() instead.

##### wifiTether

`var ok = wifiTether( bool set )`

Enable or disable Wifi tethering.

See also: action [Wifi Tether](help__ah_tether_wifi)

##### writeFile

`var ok = writeFile( str path, str text, bool append )`

Write *text* to file *path*.

If *append* is specified, the text will be attached to the end of the existing file contents (if there are any).

##### zip

`boolean ok = zip( str path, int level, bool deleteOriginalAfter )`

Zip a file or directory.

*level* is the desired compression level from 1-9, with 9 resulting in the smallest file and the longest compression time.

*deleteOriginal* causes *path* to be deleted if the zip operation is successful.

### Notes

#### Audio Streams

Must be one of **call, system, ringer, media, alarm** or **notification**

#### Colours

Colours are specified in *AARRGGBB* hexadecimal format, with solid white being **FFFFFFFF**.

#### File Paths

File paths can be specified as either absolute (start with **/**) or relative (don't start with **/**).

Relative file paths are relative to the root of the internal storage media. So, for example, `pics/me.jpg` might resolve to `/sdcard/pics/me.jpg`.
