# Android Notification Small Icon

Android's status bar requires a **white monochrome silhouette** as the small
notification icon. Colored icons are automatically rendered as a solid grey
square — that's why your uploaded logo was not visible.

These PNGs are white silhouettes of your Food Express truck icon at every
required DPI.

## One-time install (do this on your local machine after `npx cap add android`)

Copy each file into the matching Android drawable folder:

```
resources/android-notification-icon/drawable-mdpi/ic_stat_notification.png
  → android/app/src/main/res/drawable-mdpi/ic_stat_notification.png

resources/android-notification-icon/drawable-hdpi/ic_stat_notification.png
  → android/app/src/main/res/drawable-hdpi/ic_stat_notification.png

resources/android-notification-icon/drawable-xhdpi/ic_stat_notification.png
  → android/app/src/main/res/drawable-xhdpi/ic_stat_notification.png

resources/android-notification-icon/drawable-xxhdpi/ic_stat_notification.png
  → android/app/src/main/res/drawable-xxhdpi/ic_stat_notification.png

resources/android-notification-icon/drawable-xxxhdpi/ic_stat_notification.png
  → android/app/src/main/res/drawable-xxxhdpi/ic_stat_notification.png
```

Quick copy (from project root, on macOS/Linux):

```bash
for dpi in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  mkdir -p android/app/src/main/res/drawable-$dpi
  cp resources/android-notification-icon/drawable-$dpi/ic_stat_notification.png \
     android/app/src/main/res/drawable-$dpi/ic_stat_notification.png
done
```

Windows PowerShell:

```powershell
foreach ($dpi in "mdpi","hdpi","xhdpi","xxhdpi","xxxhdpi") {
  New-Item -ItemType Directory -Force "android/app/src/main/res/drawable-$dpi" | Out-Null
  Copy-Item "resources/android-notification-icon/drawable-$dpi/ic_stat_notification.png" `
            "android/app/src/main/res/drawable-$dpi/ic_stat_notification.png" -Force
}
```

Then rebuild:

```bash
npx cap sync android
npx cap run android
```

## Verify

Send yourself a test notification. In the status bar you should see the
white truck silhouette (with an orange tint pulled from `iconColor` /
`android.notification.color = #FF6F00`). When you pull down the shade, the
full colored logo appears as the large image (delivered via FCM
`notification.image`).
