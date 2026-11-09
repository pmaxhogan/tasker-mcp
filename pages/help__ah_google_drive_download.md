# Google Drive Download

Source: https://tasker.joaoapps.com/userguide/en/help/ah_google_drive_download.html

Get a file or folder from Google Drive for a given account.

While the content is downloading, a notification will be shown with the progress.

Output Variables

Array of local file paths corresponding to the files that were downloaded

Account

The account you want to download the files from

Type: File Id

Download a file by its ID. You can get the Id after you upload the file, or with a Google Drive List action (check the output variables)

Type: Remote Path

Download a file or folder by specifying its Google Drive path. If you only specify the **Remote Folder** field, a folder will be downloaded. If you also specify the **Remote File Name** field, only a single file will be downloaded.

Local Path

Place to store the files/folders on local storage. If you are downloading a folder, then this path must be a folder. If you are downloading a file, this can be either a folder or file.

**Note**: For security reasons this action can't be used on App Factory generated apps.
