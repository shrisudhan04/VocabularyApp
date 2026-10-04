import "../App.css";

export default function Header({ onOpenSidebar }) {
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

      <h1 className="app-title">deutschly</h1>

      {/* Keeps the title centered relative to the screen */}
      <div className="header-spacer" aria-hidden="true" />
    </header>
  );
}