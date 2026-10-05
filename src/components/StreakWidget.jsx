// src/components/StreakWidget.jsx
import "./StreakWidget.css";

export default function StreakWidget({ streak = 0, activeToday = false, onClick }) {
  return (
    <div
      className={`streak-widget ${activeToday ? "is-active" : "is-pending"}`}
      onClick={onClick}
      title={
        activeToday
          ? `${streak} day streak! You've practiced today.`
          : `${streak} day streak! Complete an item to keep it going today.`
      }
      role="button"
      tabIndex={0}
    >
      <span className="streak-flame">{activeToday ? "🔥" : "❄️"}</span>
      <span className="streak-count">{streak}</span>
      <span className="streak-label">{streak === 1 ? "day" : "days"}</span>
      {!activeToday && <span className="streak-dot" />}
    </div>
  );
}