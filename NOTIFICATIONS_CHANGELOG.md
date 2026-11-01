# Notification enhancements added

1. Daily reminder settings support up to five local times.
2. Android/iOS builds use Capacitor Local Notifications with repeating daily schedules.
3. Test notification can be scheduled roughly 10 seconds after pressing the test button.
4. Daily schedules are restored on native app startup and refreshed when vocabulary changes.
5. Disabling reminders cancels the daily reminder schedules.
6. Existing web reminders remain, with an accurate notice that browser delivery requires the page to stay open.
7. Hourly vocabulary notification cancellation is now scoped to hourly notification IDs so it cannot accidentally cancel daily study reminders.
8. Android manifest declares `POST_NOTIFICATIONS`.

See `NOTIFICATIONS_SETUP.md` for setup and test instructions.
