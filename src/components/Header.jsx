import StreakWidget from "./StreakWidget";
import "../App.css";

// The theme toggle now lives in the sidebar (see Sidebar.jsx).
export default function Header({ onOpenSidebar, streakData, onOpenMilestone }) {
  return (
    <header className="app-header">
      <button
        type="button"
        className="kebab-btn"
        aria-label="Open Navigation Menu"
        onClick={onOpenSidebar}
      >
        <span className="hamburger-icon">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      <h1 className="app-title">DEutschly</h1>

      <div
        className="header-actions"
        style={{ display: "flex", alignItems: "center", gap: 10 }}
      >
        {streakData && (
          <StreakWidget
            streak={streakData.streak}
            activeToday={streakData.activeToday}
            onClick={onOpenMilestone}
          />
        )}
      </div>
    </header>
  );
}