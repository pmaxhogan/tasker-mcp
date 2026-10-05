# Google Drive List

Source: https://tasker.joaoapps.com/userguide/en/help/ah_google_drive_list.html

Get details about files and folders on your Google Drive.

Output Variables

Arrays of details about your files and folders. Each position on each array corresponds to one item. For example, position **1** on **%gd_id()** corresponds to position **1** on **%gd_name**, etc.

Account

The account you want to list the files from

Type: Remote Folder

List files inside a folder on your Google Drive

Type: Query

List the files using a custom query. For example, you can use **name contains 'My doc'** to search for files that contain the words 'My doc' in their name. Check [here](https://developers.google.com/drive/api/v3/search-parameters) for complete documentation.

**Note**: For security reasons this action can't be used on App Factory generated apps.
