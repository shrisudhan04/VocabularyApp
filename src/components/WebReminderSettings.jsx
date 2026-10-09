import { useEffect, useState } from "react";
import {
  getWebReminderSettings,
  saveWebReminderSettings,
  requestMobileNotificationPermission,
  sendNounNotification,
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
    if (uniqueTimes.length === 0) {
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
      let enabled = Boolean(settings.enabled);
      if (enabled) {
        const granted = await requestMobileNotificationPermission();
        if (!granted) {
          const saved = saveWebReminderSettings({ enabled: false, times: uniqueTimes });
          setSettings(saved);
          setFeedback("Notifications are blocked or unavailable. Allow notifications for this site in your browser settings, then enable reminders again.");
          return;
        }
      }

      const saved = saveWebReminderSettings({ enabled, times: uniqueTimes });
      setSettings(saved);
      setFeedback(
        enabled
          ? `Reminders enabled for ${uniqueTimes.join(", ")}. Keep Deutschly open in this browser for reminders to fire.`
          : "Reminder times saved. Reminders are currently off."
      );
    } catch (error) {
      console.error("Could not save web reminders:", error);
      setFeedback("Could not save reminder settings. Check browser storage permissions and try again.");
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
        setFeedback("Notifications are blocked or unavailable. Allow notifications for this site in your browser settings.");
        return;
      }
      const word = (Array.isArray(vocabList) ? vocabList : []).find(
        (item) => String(item?.status || "").toLowerCase().replace(/[\s_-]/g, "") === "inprogress"
      );
      const sent = await sendNounNotification(
        word || { article: "der", noun: "Tisch", plural: "Tische", meaning: "table" }
      );
      setFeedback(sent === false ? "The test notification could not be displayed. Check your browser's site notification settings." : "Test notification requested. Check your browser's notification area.");
    } catch (error) {
      console.error("Test notification failed:", error);
      setFeedback("Test notification failed. Check browser permissions and try again.");
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
            <strong>Important for web reminders</strong>
            <p>
              Deutschly checks these times while the app is open in this browser. Browser timer throttling may delay a reminder. Scheduled reminders are not guaranteed after you close the tab or browser; closed-app delivery requires a push service/backend.
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
