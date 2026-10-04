import { useState, useEffect, useRef } from "react";

export default function CustomDropdown({ value, options, onChange, icon = null, fullWidth = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div
      className={`dropdown-container ${isOpen ? "open" : ""} ${fullWidth ? "full-width" : ""}`}
      ref={containerRef}
      style={{ marginTop: fullWidth ? 6 : 0 }}
    >
      <button
        type="button"
        className="dropdown-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {icon && <span>{icon}</span>}
          <span>{selectedOption?.label}</span>
        </span>
        <span className="dropdown-arrow">▼</span>
      </button>

      <div className="dropdown-menu" role="listbox">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={opt.value === value}
            className={`dropdown-item ${opt.value === value ? "active" : ""}`}
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
          >
            <span>{opt.label}</span>
            {opt.value === value && <span style={{ fontSize: 11 }}>✔</span>}
          </button>
        ))}
      </div>
    </div>
  );
}