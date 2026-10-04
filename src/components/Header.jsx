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
      <h2 className="app-title">DEutschly</h2>
      <div className="header-spacer" />
    </header>
  );
}