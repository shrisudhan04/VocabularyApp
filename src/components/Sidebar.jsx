export default function Sidebar({ isOpen, onClose, categories, activeCategory, onSelectCategory }) {
  return (
    <div
      className={`sidebar-overlay ${isOpen ? "open" : ""}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside className="sidebar" role="dialog" aria-modal="true" aria-label="Main Navigation">
        <div className="sidebar-header">
          <span className="sidebar-title">Categories</span>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close Sidebar"
          >
            ✕
          </button>
        </div>
        <nav className="sidebar-nav">
          {categories.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`sidebar-tab-btn ${activeCategory === tab.id ? "active" : ""}`}
              onClick={() => {
                onSelectCategory(tab.id);
                onClose();
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{tab.icon}</span>
                <span>{tab.id}</span>
              </span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>({tab.count})</span>
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
}