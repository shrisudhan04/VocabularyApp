import  { useEffect, useState } from "react";
import "./GoalModal.css";

function CircularProgress({ current, target, size = 84, strokeWidth = 7, color = "#ff7a45" }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const validTarget = Math.max(target, 1);
  const progressRatio = Math.min(current / validTarget, 1);
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <div className="modal-circular-wrapper" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="circular-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#ede6dc"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="circular-progress-bar"
        />
      </svg>
      <div className="circular-text-inner">
        <span className="modal-progress-percent">
          {Math.round(progressRatio * 100)}%
        </span>
      </div>
    </div>
  );
}

const CATEGORIES = [
  { id: "Nouns", icon: "📑", label: "Nouns" },
  { id: "Verbs", icon: "⚡", label: "Verbs" },
  { id: "Patterns", icon: "📐", label: "Patterns" },
  { id: "Prepositions", icon: "🎯", label: "Preps" },
  { id: "Time", icon: "⏰", label: "Time" },
];

export default function GoalModal({
  isOpen,
  onClose,
  categoryStats = {},
  defaultCategory = "Nouns",
  initialDailyTarget = 10,
  initialWeeklyTarget = 50,
}) {
  const [activeCategory, setActiveCategory] = useState(defaultCategory);

  const [targets, setTargets] = useState(() => {
    try {
      const saved = localStorage.getItem("study_goals_targets");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (isOpen && defaultCategory) {
      setActiveCategory(defaultCategory);
    }
  }, [isOpen, defaultCategory]);

  const dailyTarget = targets[activeCategory]?.daily || initialDailyTarget;
  const weeklyTarget = targets[activeCategory]?.weekly || initialWeeklyTarget;

  const currentStats = categoryStats[activeCategory] || { dailyCurrent: 0, weeklyCurrent: 0 };
  const dailyCurrent = currentStats.dailyCurrent || 0;
  const weeklyCurrent = currentStats.weeklyCurrent || 0;

  const updateDailyTarget = (newVal) => {
    const val = Math.max(1, Number(newVal) || 1);
    const updated = {
      ...targets,
      [activeCategory]: {
        ...targets[activeCategory],
        daily: val,
        weekly: weeklyTarget,
      },
    };
    setTargets(updated);
    localStorage.setItem("study_goals_targets", JSON.stringify(updated));
  };

  const updateWeeklyTarget = (newVal) => {
    const val = Math.max(1, Number(newVal) || 1);
    const updated = {
      ...targets,
      [activeCategory]: {
        ...targets[activeCategory],
        daily: dailyTarget,
        weekly: val,
      },
    };
    setTargets(updated);
    localStorage.setItem("study_goals_targets", JSON.stringify(updated));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="goal-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="goal-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="goal-modal-header">
          <div>
            <div className="goal-modal-badge">
              <span>🎯</span> STUDY GOALS
            </div>
            <h3 className="goal-modal-title">Track Your Progress</h3>
          </div>
          <button className="goal-modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Category Pill Bar inside the Popup */}
        <div className="goal-category-bar">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`goal-cat-pill ${isActive ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="goal-modal-body">
          {/* Daily Goal Card */}
          <div className="goal-card-premium">
            <div className="goal-card-top-row">
              <div className="goal-title-group">
                <span className="goal-type-label">DAILY GOAL</span>
                <span className="goal-unit-tag">Today</span>
              </div>
              <div className="limit-stepper-control">
                <span className="stepper-label">Target:</span>
                <div className="stepper-box">
                  <button
                    type="button"
                    onClick={() => updateDailyTarget(dailyTarget - 5)}
                    aria-label="Decrease daily limit"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={dailyTarget}
                    onChange={(e) => updateDailyTarget(e.target.value)}
                    aria-label="Daily target value"
                  />
                  <button
                    type="button"
                    onClick={() => updateDailyTarget(dailyTarget + 5)}
                    aria-label="Increase daily limit"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="goal-card-main-row">
              <div className="goal-metrics">
                <div className="goal-count-display">
                  <span className="metric-current">{dailyCurrent}</span>
                  <span className="metric-slash">/</span>
                  <span className="metric-target">{dailyTarget}</span>
                  <span className="metric-unit">{activeCategory.toLowerCase()}</span>
                </div>
                <p className="goal-status-text">
                  {dailyTarget - dailyCurrent > 0 ? (
                    <>
                      <strong>{dailyTarget - dailyCurrent}</strong> more to hit today's target!
                    </>
                  ) : (
                    <span className="completed-tag">🎉 Daily goal achieved!</span>
                  )}
                </p>
              </div>

              <CircularProgress
                current={dailyCurrent}
                target={dailyTarget}
                color="#2e7d32"
              />
            </div>
          </div>

          {/* Weekly Goal Card */}
          <div className="goal-card-premium">
            <div className="goal-card-top-row">
              <div className="goal-title-group">
                <span className="goal-type-label">WEEKLY GOAL</span>
                <span className="goal-unit-tag">This Week</span>
              </div>
              <div className="limit-stepper-control">
                <span className="stepper-label">Target:</span>
                <div className="stepper-box">
                  <button
                    type="button"
                    onClick={() => updateWeeklyTarget(weeklyTarget - 10)}
                    aria-label="Decrease weekly limit"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={weeklyTarget}
                    onChange={(e) => updateWeeklyTarget(e.target.value)}
                    aria-label="Weekly target value"
                  />
                  <button
                    type="button"
                    onClick={() => updateWeeklyTarget(weeklyTarget + 10)}
                    aria-label="Increase weekly limit"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="goal-card-main-row">
              <div className="goal-metrics">
                <div className="goal-count-display">
                  <span className="metric-current">{weeklyCurrent}</span>
                  <span className="metric-slash">/</span>
                  <span className="metric-target">{weeklyTarget}</span>
                  <span className="metric-unit">{activeCategory.toLowerCase()}</span>
                </div>
                <p className="goal-status-text">
                  {weeklyTarget - weeklyCurrent > 0 ? (
                    <>
                      <strong>{weeklyTarget - weeklyCurrent}</strong> left to hit your weekly target
                    </>
                  ) : (
                    <span className="completed-tag">🚀 Weekly milestone crushed!</span>
                  )}
                </p>
              </div>

              <CircularProgress
                current={weeklyCurrent}
                target={weeklyTarget}
                color="#b85c19"
              />
            </div>
          </div>
        </div>

        <div className="goal-modal-footer">
          <button type="button" className="goal-primary-btn" onClick={onClose}>
            Back to Learning
          </button>
        </div>
      </div>
    </div>
  );
}