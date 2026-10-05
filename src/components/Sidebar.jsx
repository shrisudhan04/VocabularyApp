import "../App.css";

export default function Sidebar({
  isOpen,
  onClose,
  categories = [],
  activeCategory,
  onSelectCategory,
  onOpenGoals,
  onOpenReport,
}) {
  return (
    <div
      className={`sidebar-overlay ${isOpen ? "open" : ""}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      inert={!isOpen}
    >
      <aside className="sidebar">
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
                  {cat.icon} {cat.id}
                </span>
                <span className="nav-count">{cat.count}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}