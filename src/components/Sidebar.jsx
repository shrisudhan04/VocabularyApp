import "../App.css";

export default function Sidebar({
  isOpen,
  onClose,
  categories,
  activeCategory,
  onSelectCategory,
}) {
  return (
    <div
      className={`sidebar-overlay ${isOpen ? "open" : ""}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-hidden={!isOpen}
    >
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">deutschly</span>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`sidebar-tab-btn ${isActive ? "active" : ""}`}
                onClick={() => {
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