import { useRef, useState } from "react";
import { calculateStreak } from "../utils/streakHelper";
import { countDueToday, masteryPercent } from "../utils/studyHelpers";
import { createDeutschlyBackup, downloadDeutschlyBackup, restoreDeutschlyBackup } from "../utils/backup";
import "../App.css";

const categoryMeta = [
  { id: "Nouns", icon: "📑", label: "Nouns", color: "#b85c19" },
  { id: "Verbs", icon: "⚡", label: "Verbs", color: "#2563eb" },
  { id: "Patterns", icon: "📐", label: "Patterns", color: "#7c3aed" },
  { id: "Prepositions", icon: "🎯", label: "Prepositions", color: "#059669" },
  { id: "Time", icon: "⏰", label: "Time", color: "#d97706" },
];

export default function DashboardPage({ lists, onNavigate, onRestoreComplete }) {
  const fileRef = useRef(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");

  const safeLists = lists || {};
  const streak = calculateStreak(safeLists);
  const totalWords = categoryMeta.reduce((sum, item) => sum + (safeLists[item.id]?.length || 0), 0);
  const totalDue = categoryMeta.reduce((sum, item) => sum + countDueToday(safeLists[item.id] || []), 0);
  const totalMastered = categoryMeta.reduce((sum, item) => {
    const list = safeLists[item.id] || [];
    return sum + list.filter((x) => String(x?.status || "").toLowerCase() === "mastered").length;
  }, 0);
  const overallMastery = totalWords ? Math.round((totalMastered / totalWords) * 100) : 0;

  const handleBackup = async () => {
    try {
      setBackupBusy(true);
      setBackupMessage("");
      const backup = await createDeutschlyBackup();
      downloadDeutschlyBackup(backup);
      setBackupMessage("Backup exported successfully.");
    } catch (error) {
      console.error(error);
      setBackupMessage("Backup export failed. Please try again.");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setBackupBusy(true);
      setBackupMessage("");
      const parsed = JSON.parse(await file.text());
      const confirmed = window.confirm(
        "Restore this Deutschly backup? Your current vocabulary and saved settings will be replaced by the backup."
      );
      if (!confirmed) return;
      await restoreDeutschlyBackup(parsed);
      setBackupMessage("Backup restored. Reloading Deutschly...");
      onRestoreComplete?.();
    } catch (error) {
      console.error(error);
      setBackupMessage(error?.message || "Restore failed. Please choose a valid Deutschly backup.");
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <div className="section dashboard-page">
      <div className="dashboard-hero">
        <div>
          <div className="dashboard-kicker">DEUTSCHLY DASHBOARD</div>
          <h2>What do you want to learn today?</h2>
          <p>Review the words that need attention, continue a category, or check your progress.</p>
        </div>
        <button className="btn btn-primary dashboard-review-btn" onClick={() => onNavigate("Due Today") } disabled={!totalDue}>
          🎯 {totalDue ? `Review ${totalDue} Due` : "Nothing Due Today"}
        </button>
      </div>

      <div className="dashboard-stats">
        <div className="dashboard-stat"><span>🔥 Streak</span><strong>{streak.streak} day{streak.streak === 1 ? "" : "s"}</strong><small>{streak.activeToday ? "Active today" : "Study today to continue"}</small></div>
        <div className="dashboard-stat"><span>📚 Total Words</span><strong>{totalWords}</strong><small>Across all learning sections</small></div>
        <div className="dashboard-stat"><span>🎯 Due Today</span><strong>{totalDue}</strong><small>Non-mastered or scheduled for today</small></div>
        <div className="dashboard-stat"><span>🏆 Mastery</span><strong>{overallMastery}%</strong><small>{totalMastered} mastered</small></div>
      </div>

      <div className="dashboard-section-head"><div><h3>Continue Learning</h3><p>Choose a learning collection.</p></div></div>
      <div className="dashboard-category-grid">
        {categoryMeta.map((meta) => {
          const list = safeLists[meta.id] || [];
          const due = countDueToday(list);
          const mastery = masteryPercent(list);
          return (
            <div className="dashboard-category-card" key={meta.id}>
              <div className="dashboard-category-top">
                <span className="dashboard-category-icon">{meta.icon}</span>
                <div><h4>{meta.label}</h4><span>{list.length} item{list.length === 1 ? "" : "s"}</span></div>
              </div>
              <div className="dashboard-progress"><div style={{ width: `${mastery}%` }} /></div>
              <div className="dashboard-category-meta"><span>{mastery}% mastered</span><strong>{due} due</strong></div>
              <div className="dashboard-card-actions">
                <button className="btn btn-secondary" onClick={() => onNavigate(meta.id, "list")}>Overview</button>
                <button className="btn btn-primary" onClick={() => onNavigate(meta.id, due ? "flashcards" : "flashcards")}>🎴 Study</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-bottom-grid">
        <div className="dashboard-panel">
          <div className="dashboard-section-head"><div><h3>Due Today</h3><p>Start with the section that has the most review work.</p></div></div>
          {categoryMeta.map((meta) => {
            const due = countDueToday(safeLists[meta.id] || []);
            return <button className="dashboard-due-row" key={meta.id} onClick={() => onNavigate(meta.id, "flashcards")} disabled={!due}><span>{meta.icon} {meta.label}</span><strong>{due}</strong></button>;
          })}
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-section-head"><div><h3>Data Safety</h3><p>Your learning data is stored locally in the app.</p></div></div>
          <div className="backup-actions">
            <button className="btn btn-primary" onClick={handleBackup} disabled={backupBusy}>⬇ {backupBusy ? "Working..." : "Export Backup"}</button>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={backupBusy}>⬆ Import Backup</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleRestoreFile} />
          </div>
          <p className="backup-note">Backup includes nouns, verbs, patterns, prepositions, time data, categories, goals, and notification settings.</p>
          {backupMessage && <div className="backup-message">{backupMessage}</div>}
        </div>
      </div>
    </div>
  );
}
