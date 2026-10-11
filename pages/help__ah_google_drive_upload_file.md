# Google Drive Upload

Source: https://tasker.joaoapps.com/userguide/en/help/ah_google_drive_upload_file.html

Send a file or folder to Google Drive for a given account. If uploading a folder, all files in sub-folders will also be uploaded recursively.

While the content is uploading, a notification will be shown with the progress.

Output Variables

This action will generate several local variables related to the uploaded files/folder, including their web url. If uploading multiple files or folder, array variables will be generated.

Account

The account you want to upload the file/folder to

Data/File

If it's a valid file/folder path, the file/folder will be uploaded. If not, the text you provide will uploaded as the file's content

Remote Name

The file name on Google Drive where you want to upload the content to. Ignored if uploading a folder. If not set, file name will be the same as the local file name.

Remote Folder

Folder path on Google Drive. If left empty, file/folder will be uploaded to the root folder

Content Description

Description for the file that shows up on Google Drive. Will also be used in the progress notification's text

Overwrite If Exists

Will overwrite the Google Drive files if they already exists. If not enabled and a file with the same name exists, a file with the same name will be created, so you'll end up with multiple files with the exact same name.

Publicly Share File

Will create a share link for the files and anyone with the link will be able to access it.

**Note**: For security reasons this action can't be used on App Factory generated apps.
