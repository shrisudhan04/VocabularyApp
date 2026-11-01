# Deutschly notifications

## Included

- Up to five daily reminder times.
- Native Capacitor Local Notifications on Android/iOS.
- Native repeating local schedules (no backend required).
- Test notification scheduled about 10 seconds after pressing Test notification.
- Reminder schedules are restored when Deutschly starts and refreshed when vocabulary changes.
- Existing browser reminders remain supported while the app page is open.
- Disabling reminders cancels only Deutschly daily reminder notification IDs; it does not cancel unrelated app notifications.

## Android setup

Run from the project root:

```bash
npm install
npx cap sync android
npx cap open android
```

Build and install the Android app from Android Studio. The Android app must be rebuilt after syncing native plugin changes.

On the first enable, Android asks for notification permission. If permission was previously denied, enable notifications for Deutschly in Android Settings > Apps > Deutschly > Notifications.

## Test

1. Install and open the Android build.
2. Open Sidebar > Notification reminders.
3. Enable Daily reminders and select a time.
4. Save reminders.
5. Press Test notification; it should arrive in about 10 seconds.
6. Close Deutschly and wait for the next selected reminder time.

Android battery optimization, manufacturer background restrictions, notification channel settings and OS policy can still affect exact delivery time. Repeating alarms may be delivered inexactly by Android; the app does not request unrestricted exact-alarm access.

## Web limitations

On a normal browser build, reminder checks run only while the Deutschly page is open. Reliable browser notifications after the browser is fully closed require a service worker plus a web-push server and are not implemented by this local-notification change.
