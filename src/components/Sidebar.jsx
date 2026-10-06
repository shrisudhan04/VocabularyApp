import { useState, useEffect } from "react";
import "../App.css";

const THEME_KEY = "app_theme";

/* Injected at build time by vite.config.js (git commit based).
   Falls back to the `version` prop if the build didn't define them. */
/* global __APP_VERSION__, __APP_COMMIT__ */
const BUILD_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : null;
const BUILD_COMMIT =
  typeof __APP_COMMIT__ !== "undefined" ? __APP_COMMIT__ : null;

export default function Sidebar({
  isOpen,
  onClose,
  categories = [],
  activeCategory,
  onSelectCategory,
  onOpenGoals,
  onOpenReport,
  languageMode = "EN", // "EN" or "DE"
  onToggleLanguage, // callback function: (newMode) => void
  version = "1.0.0", // fallback if no git version is available
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

  // 🌗 Theme (moved here from the header). Same storage key + data-theme attribute as before.
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || "light";
    } catch {
      return "light";
    }
  });
  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable - theme still applies for this session */
    }
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  // Flag the page while the sidebar is open so floating buttons (the sticky "+") can hide
  useEffect(() => {
    document.body.classList.toggle("sidebar-open", Boolean(isOpen));
    return () => document.body.classList.remove("sidebar-open");
  }, [isOpen]);

  // Version label: v1.0.<commit count> · <short hash>
  const versionLabel = BUILD_VERSION ? BUILD_VERSION : `v${version}`;

  return (
    <div
      className={`sidebar-overlay ${isOpen ? "open" : ""}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      inert={!isOpen}
    >
      <style>{`
        /* Hide the sticky add (+) button while the sidebar is open */
        body.sidebar-open .fab-btn {
          display: none !important;
        }

        /* Header / nav / footer stack so the version is pinned to the bottom */
        .sidebar {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .sidebar-header {
          flex-shrink: 0;
        }
        .sidebar-nav {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
        }

        /* Sticky footer: stays at the bottom, only the nav scrolls */
        .sidebar-footer {
          position: sticky;
          bottom: 0;
          flex-shrink: 0;
          margin: auto -20px -24px;           /* stretch over the sidebar padding */
          padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
          background: var(--card);
          border-top: 1px solid var(--line-2);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          letter-spacing: 0.02em;
          z-index: 2;
        }
        .sidebar-version {
          padding: 2px 10px;
          border-radius: 999px;
          background: var(--card-inner);
          border: 1px solid var(--line-2);
          color: var(--brand);
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        /* Theme toggle switch (top-left of the sidebar) — fully theme-driven */
        .sidebar-theme-switch {
          position: relative;
          box-sizing: border-box;
          width: 56px;
          height: 30px;
          flex-shrink: 0;
          padding: 0;
          border-radius: 999px;
          border: 1px solid var(--line-2);
          background: var(--card-inner);
          cursor: pointer;
          transition: background-color 0.25s ease, border-color 0.25s ease;
        }
        .sidebar-theme-switch:hover {
          border-color: var(--brand);
        }
        .sidebar-theme-switch:focus-visible {
          outline: 3px solid var(--brand);
          outline-offset: 2px;
        }
        .sidebar-theme-knob {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--brand);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                      background-color 0.25s ease, color 0.25s ease;
        }
        .sidebar-theme-switch.is-dark .sidebar-theme-knob {
          transform: translateX(26px);
          color: #1c1917;
        }
        .sidebar-theme-knob svg {
          width: 14px;
          height: 14px;
        }
      `}</style>

      <aside className="sidebar">
        {/* Sidebar Header: theme toggle (top-left) + logo, close button on the right */}
        <div className="sidebar-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 0,
            }}
          >
            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
              title={`Switch to ${isDark ? "light" : "dark"} mode`}
              className={`sidebar-theme-switch ${isDark ? "is-dark" : ""}`}
              onClick={toggleTheme}
            >
              <span className="sidebar-theme-knob">
                {isDark ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )}
              </span>
            </button>

            <span className="sidebar-logo">DEutschly</span>
          </div>

          <button
            type="button"
            className="sidebar-close-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Close sidebar"
          >
            ❌
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
                  backgroundColor:
                    currentLang === "EN" ? "#2563eb" : "transparent",
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
                  backgroundColor:
                    currentLang === "DE" ? "#2563eb" : "transparent",
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

        {/* Sticky version footer (bottom of the sidebar) */}
        <div className="sidebar-footer">
          <span>DEutschly</span>
          <span
            className="sidebar-version"
            title={BUILD_COMMIT ? `Commit ${BUILD_COMMIT}` : undefined}
          >
            {versionLabel}
            {BUILD_COMMIT ? ` · ${BUILD_COMMIT}` : ""}
          </span>
        </div>
      </aside>
    </div>
  );
}