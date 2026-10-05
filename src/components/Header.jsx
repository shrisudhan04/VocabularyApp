import { useState, useEffect } from "react";
import "../App.css";

export default function Header({ onOpenSidebar }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("app_theme") || "light";
  });

  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

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

      <div className="header-actions">
        <button
          type="button"
          className={`theme-toggle-btn ${isDark ? "theme-dark" : "theme-light"}`}
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          title={`Switch to ${isDark ? "light" : "dark"} mode`}
          onClick={toggleTheme}
        >
          {/* Sun Icon */}
          <svg
            className="theme-icon icon-sun"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
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

          {/* Moon Icon */}
          <svg
            className="theme-icon icon-moon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
      </div>
    </header>
  );
}