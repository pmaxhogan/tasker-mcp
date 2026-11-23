# HTTP Request

Source: https://tasker.joaoapps.com/userguide/en/help/ah_http_request.html

Perform any HTTP request of any type.

This action effectively replaces the HTTP Get, Head and Post actions and those are now deprecated.

#### Examples

- [Add a row of data to a Google Spreadsheet (no plugins) ](https://forum.joaoapps.com/index.php?resources/add-a-row-of-data-to-a-google-spreadsheet-no-plugins.383/)

#### Inputs

URL

The full URL you want to call

Headers

List of key value pairs.

Separate keys from values with the **:** character. Make sure there are no extra spaces.

One header per line.

Example:

```

					Key:Value
					Content-Type:application/json
					Authorization:Bearer MY_ACCESS_TOKEN
					Other-Header:Some value
```

Query Parameters

List of key value pairs that you want to append to the URL as query parameters.

Same format as the **Headers** field.

File To Send

Some requests can have file attachments. Use this field to send them.

If your request needs to set a name for the file (in **multipart/form-data** requests) prepend the file path with that name followed by a colon. Something like **myfilename:DCIM/Camera/photo.jpg** for example.

File To Save With Output

If you set this, the output will be saved to the selected file instead of the %http_data variable.

Timeout

Max number of seconds that the action will try to wait before giving up

Trust Any Certificate

Some HTTP (non-secure) servers will require you to enable this option so that the request can go through.

### When Sending Content

If you want to send content to a server (with **POST** or **PUT** for example), you can send some data, a file, or both.

Body

A piece of text data that you want to send to the server. This can be a number of different things depending on what the server is expecting. This should be written exactly how the server is expecting it. Tasker will not change it at all. For example, if the server expects a key-value list with a POST request it's most probably expecting something like **key1=value1&key2=value2&key3=value3**.

There is only one exception to this: When sending a file with a specified name as outlined below, Tasker modifies the contents of the "Body" field to comply with the multipart/form-data specification. In this scenario, you should input the body as query parameters (e.g., key1=value1&key2=value2, etc.), and Tasker will automatically transform it into a format compatible with the multipart/form-data standard.

File To Send

A file to send to the server. This can be sent in conjunction or instead of the Body depending on server requirements.

**Note**: if you send both Body and File, it'll send them both as a **multipart/related** request.

**Note 2**: If the server is expecting the file parameter to be named (usually on multipart/form-data requests) you can set the file's parameter name by prepending the file path with **name:**, for example, **photo:Images/photo.jpg** but don't forget to also send a body with this request.
