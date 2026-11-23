# Scenes V2 WebView Tasker Actions Reference

Source: https://tasker.joaoapps.com/userguide/en/scenes_v2/webview-actions.html

[<- Back to the Scenes V2 Manual](scenes_v2__05_general#webview-bridge-actions)

## Scenes V2 WebView Tasker Actions Reference

This is the full list of individual Tasker actions exposed to Scenes V2 WebView content through the JavaScript bridge. Each one is called as `await Tasker.<name>({ ...options })` and returns a Promise that resolves to an object of the action's output variables plus any other task-local variables (keyed without the leading `%`) or rejects with an `Error` if the action fails. See the manual's [JavaScript Bridge](scenes_v2__05_general#webview-js-bridge) section for how to reach the bridge and the surrounding methods.

Tip: For autocomplete of these actions in your editor, download the [VS Code workspace](https://tasker.joaoapps.com/userguide/en/scenes_v2/workspace.zip), unzip it, and open the folder in VS Code. Type `Tasker.` in `main.js` to get every action with its option keys and descriptions as you type.

**Examples.** Three common patterns for calling the actions below:

```
// 1. Call an action with options. Strings, booleans, and ints go in the options object.
await Tasker.flash({ text: 'Saved!', long: true });
```

```
// 2. Read the result. The Promise resolves to an object of the action's output
//    variables (plus any other task locals), keyed without the leading %.
const { stdout } = await Tasker.runShell({ cmd: 'getprop ro.product.model' });
console.log('Device model:', stdout);
```

```
// 3. Handle failure. A failing action rejects with an Error.
try {
  await Tasker.mediaControl({ cmd: 'next' });
} catch (e) {
  console.error('Could not skip track:', e.message);
}
```

Notation: Options that accept a fixed set of strings are shown as `(a|b|c)`; boolean options take `true`/`false` and are marked `(bool)`; integer options are marked `(int)`. A dash (-) means the action takes no options. All options are optional unless the action's purpose requires them.

| Action | Option keys | Description |
| --- | --- | --- |
| `browseUrl` | `url` | Open a URL in the browser |
| `call` | `number`, `auto` (bool) | Make a phone call |
| `callBlock` | `match`, `info` (bool) | Block calls matching a pattern |
| `callDivert` | `from`, `to`, `info` (bool) | Divert calls from one number to another |
| `callRevert` | `match` | Revert a call divert or block rule |
| `clearKey` | `key` | Clear a stored encryption passphrase |
| `composeEmail` | `to`, `subject`, `message` | Open email compose screen |
| `composeMms` | `to`, `subject`, `message`, `attachment` | Open MMS compose screen |
| `composeSms` | `to`, `message` | Open SMS compose screen |
| `createDirectory` | `dir`, `createParents` (bool), `root` (bool) | Create a directory |
| `decryptDir` | `path`, `key`, `removeKey` (bool) | Decrypt all files in a directory |
| `decryptFile` | `path`, `key`, `removeKey` (bool) | Decrypt a file |
| `deleteDirectory` | `dir`, `recurse` (bool), `root` (bool) | Delete a directory |
| `deleteFile` | `path`, `shred` (int), `root` (bool) | Delete a file |
| `disable` | - | Disable Tasker monitoring |
| `encryptDir` | `path`, `key`, `shred` (bool), `remember` (bool) | Encrypt all files in a directory |
| `encryptFile` | `path`, `key`, `shred` (bool), `remember` (bool) | Encrypt a file |
| `endCall` | - | End an active phone call |
| `flash` | `text`, `long` (bool) | Show a flash/toast message |
| `getLocation` | `source` (gps\|net\|any), `keepTracking` (bool), `timeout` (int; default 60) | Get device location; resolves to location output variables |
| `getVoice` | `prompt`, `model` (free\|web; default free), `maxResults` (int; default 20), `timeout` (int; default 60) | Capture voice input via speech recognition |
| `goHome` | `page` (int) | Go to a home screen page |
| `httpRequest` | `method`, `url`, `headers`, `query`, `body`, `fileToSend`, `fileToSave`, `timeout` (int), `trustAnyCertificate` (bool), `autoRedirect` (bool), `cookies` (bool), `structureOutput` (bool) | Perform an HTTP request |
| `isProfileActive` | `name` | Resolves to `"true"` or `"false"` for the named profile |
| `launchApp` | `app`, `data`, `excludeFromRecent` (bool) | Launch an installed app |
| `listFiles` | `dir`, `match`, `hidden` (bool), `root` (bool) | List files in a directory |
| `mediaControl` | `cmd` (next\|pause\|previous\|toggle\|stop\|play) | Send a media control command |
| `musicBack` | `secs` (int) | Rewind music playback |
| `musicPlay` | `file`, `start` (int), `loop` (bool), `stream` (call\|system\|ringer\|media\|alarm\|notification; default media), `continue` (bool) | Play a music file |
| `musicSkip` | `secs` (int) | Skip forward in music playback |
| `musicStop` | - | Stop music playback |
| `parseFormatDateTime` | `inputType` (int), `input`, `inputFormat`, `inputSeparator`, `outputFormat`, `outputSeparator`, `allDetails` (bool) | Parse and format a date/time string |
| `readFile` | `path` | Read the contents of a file |
| `reboot` | `type` (normal\|recovery\|bootloader\|shutdown; default normal) | Reboot the device |
| `recordAudio` | `path`, `source` (def\|mic\|callout\|callin\|call), `codec` (amrn\|amrw\|aac), `format` (mp4\|3gpp\|amrn\|amrw) | Start audio recording |
| `recordAudioStop` | - | Stop audio recording |
| `runShell` | `cmd`, `root` (bool), `timeout` (int; default 60) | Run a shell command; resolves to `{ stdout, stderr, result }` |
| `say` | `text`, `voice`, `stream`, `pitch` (int), `speed` (int), `network` (bool), `respectFocus` (bool) | Speak text aloud via TTS |
| `scanMedia` | `path` | Trigger a media scan for a file or directory |
| `sendIntent` | `action`, `package`, `class`, `target` (receiver\|activity\|service), `category`, `data`, `mime`, `extra1`, `extra2`, `extra3` | Send an Android Intent |
| `sendSms` | `message`, `number`, `store` (bool) | Send an SMS message |
| `setAirplaneMode` | `on` (bool) | Enable or disable airplane mode |
| `setAirplaneRadios` | `radios` (comma-separated: bt, wimax, wifi, nfc, cell) | Set which radios remain on in airplane mode |
| `setAlarm` | `message`, `hour` (int), `minute` (int), `confirm` (bool) | Set an alarm |
| `setAlarmVolume` | `level` (int), `show` (bool), `sound` (bool) | Set alarm volume |
| `setAutoBrightness` | `on` (bool) | Enable or disable automatic brightness |
| `setAutoSync` | `on` (bool) | Enable or disable auto-sync |
| `setBluetooth` | `on` (bool) | Enable or disable Bluetooth |
| `setBluetoothId` | `name` | Set the Bluetooth device name |
| `setBtVoiceVolume` | `level` (int), `show` (bool), `sound` (bool) | Set Bluetooth voice volume |
| `setCarMode` | `on` (bool) | Enable or disable car mode |
| `setClipboard` | `text`, `append` (bool) | Set the system clipboard text |
| `setDisplayAutoRotate` | `on` (bool) | Enable or disable automatic screen rotation |
| `setDisplayTimeout` | `hours` (int), `mins` (int), `secs` (int) | Set the screen-off timeout |
| `setDtmfVolume` | `level` (int), `show` (bool), `sound` (bool) | Set DTMF tone volume |
| `setHapticFeedback` | `on` (bool) | Enable or disable haptic feedback |
| `setInCallVolume` | `level` (int), `show` (bool), `sound` (bool) | Set in-call volume |
| `setKey` | `key`, `phrase` | Store an encryption passphrase in a named slot |
| `setMediaVolume` | `level` (int), `show` (bool), `sound` (bool) | Set media volume |
| `setMicMute` | `on` (bool) | Mute or unmute the microphone |
| `setMobileData` | `on` (bool) | Enable or disable mobile data |
| `setNavigationBar` | `position` (left\|center\|right) | Set the navigation bar layout position |
| `setNightMode` | `on` (bool) | Enable or disable night mode (dark mode) |
| `setNotificationVolume` | `level` (int), `show` (bool), `sound` (bool) | Set notification volume |
| `setProfileStatus` | `name`, `enable` (bool) | Enable or disable a profile by name |
| `setRingerVolume` | `level` (int), `show` (bool), `sound` (bool) | Set ringer volume |
| `setSilentMode` | `mode` (off\|vibrate\|on) | Set the ringer/silent mode |
| `setSoundEffects` | `on` (bool) | Enable or disable sound effects |
| `setSpeakerphone` | `on` (bool) | Enable or disable the speakerphone |
| `setStatusBar` | `on` (bool) | Show or hide the status bar |
| `setStayOn` | `mode` (never\|ac\|usb\|any) | Set the stay-on-while-plugged-in policy |
| `setSystemVolume` | `level` (int), `show` (bool), `sound` (bool) | Set system volume |
| `setUsbTether` | `on` (bool) | Enable or disable USB tethering |
| `setWallpaper` | `path` | Set the home/lock screen wallpaper |
| `setWifi` | `on` (bool) | Enable or disable Wi-Fi |
| `setWifiTether` | `on` (bool) | Enable or disable Wi-Fi tethering |
| `settings` | `name` | Open an Android settings screen by name |
| `shutdown` | - | Shut down the device |
| `stopLocation` | `source` (gps\|net\|any) | Stop location tracking |
| `systemLock` | - | Lock the device screen |
| `takeCall` | - | Answer an incoming phone call |
| `takePhoto` | `camera` (int; 0=back, 1=front), `path`, `resolution` (e.g. 1920x1080), `insertGallery` (bool) | Take a photo with the device camera |
| `type` | `text`, `repeats` (int) | Type text into the focused element |
| `unzip` | `path`, `deleteZip` (bool) | Unzip a zip archive |
| `variableConvert` | `value`, `mode` (one of: byteToKbyte, byteToMbyte, byteToGbyte, datetimeToSec, secToDatetime, secToDatetimeM, secToDatetimeL, htmlToText, celsToFahr, fahrToCels, centToInch, inchToCent, metreToFeet, feetToMetre, kgToPound, poundToKg, kmToMile, mileToKm, urlDecode, urlEncode, binToDec, decToBin, hexToDec, decToHex, base64encode, base64decode, toMd5, toSha1, toLowerCase, toUpperCase, toUpperCaseFirst) | Convert a Tasker variable's value |
| `vibrate` | `time` (int, ms) | Vibrate the device for a duration |
| `vibratePattern` | `pattern` (e.g. 0,500,100,500) | Vibrate in a pattern |
| `writeFile` | `path`, `text`, `append` (bool) | Write text to a file |
| `zip` | `path` (comma-separated paths), `deleteOriginal` (bool), `level` (int, 0-9) | Zip files into an archive |

No actions match your filter.
