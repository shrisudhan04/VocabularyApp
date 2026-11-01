import { useEffect, useState } from "react";
import {
  getWebReminderSettings,
  saveWebReminderSettings,
  requestMobileNotificationPermission,
  sendNounNotification,
  isNative,
  scheduleDailyStudyReminders,
  cancelDailyStudyReminders,
  sendDailyReminderTest,
} from "../utils/hourlyWordNotifier";
import "./WebReminderSettings.css";

const MAX_REMINDER_TIMES = 5;

const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));

export default function WebReminderSettings({ isOpen, onClose, vocabList = [] }) {
  const [settings, setSettings] = useState(() => getWebReminderSettings());
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSettings(getWebReminderSettings());
    setFeedback("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const updateTime = (index, value) => {
    setSettings((current) => ({
      ...current,
      times: current.times.map((time, i) => (i === index ? value : time)),
    }));
    setFeedback("");
  };

  const addTime = () => {
    if (settings.times.length >= MAX_REMINDER_TIMES) return;
    const used = new Set(settings.times);
    const suggested = ["09:00", "13:00", "18:00", "20:00", "21:00"].find((time) => !used.has(time)) || "10:00";
    setSettings((current) => ({ ...current, times: [...current.times, suggested] }));
    setFeedback("");
  };

  const removeTime = (index) => {
    setSettings((current) => ({
      ...current,
      times: current.times.filter((_, i) => i !== index),
    }));
    setFeedback("");
  };

  const handleSave = async () => {
    const validTimes = settings.times.filter(isValidTime);
    const uniqueTimes = [...new Set(validTimes)].sort();
    if (settings.enabled && uniqueTimes.length === 0) {
      setFeedback("Add at least one valid reminder time.");
      return;
    }
    if (uniqueTimes.length !== validTimes.length) {
      setFeedback("Each reminder time must be valid and different.");
      return;
    }

    setBusy(true);
    setFeedback("");
    try {
      const normalizedTimes = uniqueTimes.length ? uniqueTimes : ["09:00"];
      const saved = saveWebReminderSettings({ enabled: settings.enabled, times: normalizedTimes });

      if (isNative()) {
        if (saved.enabled) {
          const result = await scheduleDailyStudyReminders(saved.times);
          if (!result.ok) {
            saveWebReminderSettings({ enabled: false, times: saved.times });
            setSettings({ enabled: false, times: saved.times });
            setFeedback(
              result.reason === "permission-denied"
                ? "Notification permission was not granted. Allow notifications for Deutschly in Android settings, then enable reminders again."
                : "Could not schedule native reminders. Check notification permissions and try again."
            );
            return;
          }
          setFeedback(`Daily Android reminders scheduled for ${saved.times.join(", ")}. They can arrive when Deutschly is closed.`);
        } else {
          await cancelDailyStudyReminders();
          setFeedback("Daily reminders are turned off. Scheduled Deutschly reminders have been cancelled.");
        }
      } else if (saved.enabled) {
        const granted = await requestMobileNotificationPermission();
        if (!granted) {
          saveWebReminderSettings({ enabled: false, times: saved.times });
          setSettings({ enabled: false, times: saved.times });
          setFeedback("Notifications are blocked or unavailable. Allow notifications for this site in your browser settings, then enable reminders again.");
          return;
        }
        setFeedback(`Web reminders enabled for ${saved.times.join(", ")}. Keep Deutschly open in this browser for reminders to fire.`);
      } else {
        setFeedback("Reminder times saved. Reminders are currently off.");
      }

      setSettings(saved);
    } catch (error) {
      console.error("Could not save reminders:", error);
      setFeedback("Could not save reminder settings. Check notification permissions and try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setFeedback("");
    try {
      const granted = await requestMobileNotificationPermission();
      if (!granted) {
        setFeedback("Notifications are blocked or unavailable. Allow notifications for Deutschly in your device settings.");
        return;
      }
      const sent = isNative()
        ? await sendDailyReminderTest()
        : await sendNounNotification(
            (Array.isArray(vocabList) ? vocabList : []).find(
              (item) => String(item?.status || "").toLowerCase().replace(/[\\s_-]/g, "") === "inprogress"
            ) || { article: "der", noun: "Tisch", plural: "Tische", meaning: "table" }
          );
      setFeedback(
        sent === false
          ? "The test notification could not be scheduled. Check notification permissions."
          : isNative()
            ? "Test notification scheduled. On Android it should appear in about 10 seconds, even if Deutschly is closed."
            : "Test notification requested. Keep Deutschly open for scheduled web reminders."
      );
    } catch (error) {
      console.error("Test notification failed:", error);
      setFeedback("Test notification failed. Check notification permissions and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="web-reminder-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
    >
      <section
        className="web-reminder-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="web-reminder-title"
      >
        <header className="web-reminder-header">
          <div>
            <span className="web-reminder-kicker">DEUTSCHLY SETTINGS</span>
            <h2 id="web-reminder-title">Notification reminders</h2>
            <p>Choose the times you want a German vocabulary reminder.</p>
          </div>
          <button
            type="button"
            className="web-reminder-close"
            aria-label="Close reminder settings"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </header>

        <div className="web-reminder-body">
          <label className="web-reminder-toggle">
            <span>
              <strong>Daily reminders</strong>
              <small>{settings.enabled ? "Enabled" : "Disabled"}</small>
            </span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => {
                setSettings((current) => ({ ...current, enabled: event.target.checked }));
                setFeedback("");
              }}
              disabled={busy}
            />
          </label>

          <div className="web-reminder-times-head">
            <div>
              <h3>Reminder times</h3>
              <p>Times use your device's local time.</p>
            </div>
            <span>{settings.times.length}/{MAX_REMINDER_TIMES}</span>
          </div>

          <div className="web-reminder-time-list">
            {settings.times.map((time, index) => (
              <div className="web-reminder-time-row" key={`${index}-${time}`}>
                <span className="web-reminder-clock" aria-hidden="true">◷</span>
                <label className="web-reminder-time-label" htmlFor={`reminder-time-${index}`}>
                  Reminder {index + 1}
                </label>
                <input
                  id={`reminder-time-${index}`}
                  type="time"
                  value={time}
                  onChange={(event) => updateTime(index, event.target.value)}
                  disabled={busy}
                  required
                />
                <button
                  type="button"
                  className="web-reminder-remove"
                  onClick={() => removeTime(index)}
                  disabled={busy || settings.times.length <= 1}
                  aria-label={`Remove reminder ${index + 1}`}
                  title="Remove time"
                >
                  −
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="web-reminder-add"
            onClick={addTime}
            disabled={busy || settings.times.length >= MAX_REMINDER_TIMES}
          >
            + Add another time
          </button>

          <div className="web-reminder-notice">
            <strong>{isNative() ? "Android / native reminders" : "Browser reminders"}</strong>
            <p>
              {isNative()
                ? "Deutschly uses device-local repeating notifications. They can be delivered when the app is closed and do not require a backend. Android notification permissions, battery settings and device policies can still affect delivery."
                : "Deutschly checks these times while the app is open in this browser. Browser timer throttling may delay reminders. Delivery after the tab or browser is closed is not guaranteed; that requires a web push service."}
            </p>
          </div>

          {feedback && (
            <p className="web-reminder-feedback" role="status">{feedback}</p>
          )}
        </div>

        <footer className="web-reminder-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={busy}>
            {busy ? "Please wait…" : "Test notification"}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={busy}>
            {busy ? "Saving…" : "Save reminders"}
          </button>
        </footer>
      </section>
    </div>
  );
}
