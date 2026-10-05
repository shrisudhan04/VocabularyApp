import { useState } from "react";
import "../App.css";

export default function Sidebar({
  isOpen,
  onClose,
  categories = [],
  activeCategory,
  onSelectCategory,
  onOpenGoals,
  onOpenReport,
  languageMode = "EN", // "EN" or "DE"
  onToggleLanguage,    // callback function: (newMode) => void
}) {
  // Local fallback if no external state handler is passed
  const [localLang, setLocalLang] = useState(languageMode);

  const currentLang = onToggleLanguage ? languageMode : localLang;

  const handleLanguageChange = (mode) => {
    if (onToggleLanguage) {
      onToggleLanguage(mode);
    } else {
      setLocalLang(mode);
    }
  };

  return (
    <div
      className={`sidebar-overlay ${isOpen ? "open" : ""}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      inert={!isOpen ? "" : undefined}
    >
      <aside className="sidebar">
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <span className="sidebar-logo">DEutschly</span>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {/* 🌐 EN ↔ DE Toggle Pill Switch */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              backgroundColor: "var(--card-subtle, #f8fafc)",
              border: "1px solid var(--line-2, #e2e8f0)",
              borderRadius: "14px",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🌐</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--ink, #1f2937)",
                  letterSpacing: "0.01em",
                }}
              >
                Study Mode:
              </span>
            </div>

            <div
              style={{
                display: "inline-flex",
                backgroundColor: "#e2e8f0",
                borderRadius: "20px",
                padding: "3px",
                gap: "2px",
              }}
            >
              <button
                type="button"
                onClick={() => handleLanguageChange("EN")}
                style={{
                  padding: "4px 12px",
                  borderRadius: "16px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  backgroundColor: currentLang === "EN" ? "#2563eb" : "transparent",
                  color: currentLang === "EN" ? "#ffffff" : "#475569",
                  boxShadow:
                    currentLang === "EN"
                      ? "0 2px 4px rgba(37, 99, 235, 0.25)"
                      : "none",
                  transition: "all 0.18s ease-in-out",
                }}
              >
                EN
              </button>

              <button
                type="button"
                onClick={() => handleLanguageChange("DE")}
                style={{
                  padding: "4px 12px",
                  borderRadius: "16px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  backgroundColor: currentLang === "DE" ? "#2563eb" : "transparent",
                  color: currentLang === "DE" ? "#ffffff" : "#475569",
                  boxShadow:
                    currentLang === "DE"
                      ? "0 2px 4px rgba(37, 99, 235, 0.25)"
                      : "none",
                  transition: "all 0.18s ease-in-out",
                }}
              >
                DE
              </button>
            </div>
          </div>

          {/* Study Goals Button */}
          <button
            type="button"
            className="sidebar-tab-btn sidebar-goal-btn"
            onClick={(e) => {
              e.stopPropagation();
              e.currentTarget.blur();
              onClose();
              if (typeof onOpenGoals === "function") {
                onOpenGoals();
              }
            }}
          >
            <span>🎯 Study Goals</span>
            <span className="nav-count goal-badge">Daily / Weekly</span>
          </button>

          {/* Report Button */}
          <button
            type="button"
            className="sidebar-tab-btn sidebar-goal-btn"
            onClick={(e) => {
              e.stopPropagation();
              e.currentTarget.blur();
              onClose();
              if (typeof onOpenReport === "function") {
                onOpenReport();
              }
            }}
          >
            <span>📊 Report</span>
            <span className="nav-count goal-badge">By date</span>
          </button>

          <div className="sidebar-divider" />

          {/* Dynamic Category List */}
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`sidebar-tab-btn ${isActive ? "active" : ""}`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelectCategory(cat.id);
                  onClose();
                }}
              >
                <span>
                  {cat.icon} {cat.label || cat.id}
                </span>
                <span className="nav-count">{cat.count ?? 0}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}