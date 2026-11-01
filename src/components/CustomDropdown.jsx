import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function CustomDropdown({
  value,
  options = [],
  onChange,
  icon = null,
  fullWidth = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, minWidth: 0 });
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const calculatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 6,
        left: rect.left,
        minWidth: rect.width,
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(event) {
      const clickedTrigger = triggerRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);

      if (!clickedTrigger && !clickedMenu) {
        setIsOpen(false);
      }
    }

    function handleCloseOnScrollOrResize() {
      setIsOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("scroll", handleCloseOnScrollOrResize, true);
    window.addEventListener("resize", handleCloseOnScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("scroll", handleCloseOnScrollOrResize, true);
      window.removeEventListener("resize", handleCloseOnScrollOrResize);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const menuNode = isOpen
    ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className="dropdown-menu-portal"
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            minWidth: `${coords.minWidth}px`,
            zIndex: 9999,
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`dropdown-item ${opt.value === value ? "active" : ""}`}
              onClick={() => {
                onChange?.(opt.value);
                setIsOpen(false);
              }}
            >
              <span>{opt.label}</span>
              {opt.value === value && <span style={{ fontSize: 11 }}>✔</span>}
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <div
      className={`dropdown-container ${isOpen ? "open" : ""} ${fullWidth ? "full-width" : ""}`}
      ref={containerRef}
      style={{ marginTop: fullWidth ? 6 : 0 }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="dropdown-trigger"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {icon && <span>{icon}</span>}
          <span>{selectedOption?.label}</span>
        </span>
        <span className="dropdown-arrow">▼</span>
      </button>

      {menuNode}
    </div>
  );
}