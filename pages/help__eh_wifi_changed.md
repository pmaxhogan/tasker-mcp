# Wifi Changed

Source: https://tasker.joaoapps.com/userguide/en/help/eh_wifi_changed.html

Triggers whenever the state of Wi-Fi changes: when the Wi-Fi radio is switched on or off, or when the device connects to or disconnects from a Wi-Fi network.

There are four kinds of change:

- `enabled` - the Wi-Fi radio was turned on
- `disabled` - the Wi-Fi radio was turned off
- `connected` - the device joined a Wi-Fi network
- `disconnected` - the device left a Wi-Fi network

Requires Android 7.0 (Nougat) or later.

State

Restrict the event to only certain changes.

Enter one or more of `enabled`, `disabled`, `connected` or `disconnected`, separated by `/` to match several at once (for example `connected/disconnected`).

Leave empty to trigger on every change. [Pattern matching](matching) is supported.

Get SSID

When enabled, Tasker reads the SSID and MAC address (BSSID) of the connected network and reveals the **SSID** and **MAC** fields below, letting you restrict the event to specific networks.

Looking up the network details requires the Location permission.

SSID

Only available when **Get SSID** is enabled.

Only trigger when the connected network's name matches. Separate multiple names with `/`, or leave empty to match any network.

MAC

Only available when **Get SSID** is enabled.

Like **SSID**, but matches the access point's MAC address (BSSID) instead of its name.
