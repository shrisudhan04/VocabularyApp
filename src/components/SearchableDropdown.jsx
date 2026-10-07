import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";

const normalize = (s = "") =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/**
 * Searchable dropdown (same look as the other custom dropdowns).
 *
 * Props
 *  - value, options [{label, value}], onChange(value)
 *  - icon, placeholder, searchPlaceholder, emptyText
 *  - fullWidth: stretch to 100% (use inside modals)
 *  - allowCreate + onCreate(name): shows a '+ Create "text"' row when nothing matches exactly
 *
 * The panel is rendered in a portal with fixed positioning, so it is never
 * clipped by horizontally scrolling filter rows or modal containers.
 */
export default function SearchableDropdown({
  value = "",
  options = [],
  onChange,
  icon = "",
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No matches found",
  fullWidth = false,
  allowCreate = false,
  onCreate,
  maxPanelHeight = 260,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState(null);

  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => o.value === value);
  const trimmed = query.trim();

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, query]);

  const canCreate =
    allowCreate &&
    Boolean(trimmed) &&
    !options.some(
      (o) =>
        normalize(o.label) === normalize(trimmed) ||
        normalize(String(o.value)) === normalize(trimmed)
    );

  const rows = useMemo(() => {
    const base = filtered.map((o) => ({ type: "option", label: o.label, value: o.value }));
    if (canCreate) base.push({ type: "create", label: `+ Create "${trimmed}"` });
    return base;
  }, [filtered, canCreate, trimmed]);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelHeight = maxPanelHeight + 64;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < panelHeight && rect.top > spaceBelow;
    const width = Math.max(rect.width, 240);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    setPos({
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      left,
      width,
    });
  };

  const openPanel = () => {
    setQuery("");
    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === value)
    );
    setActiveIndex(idx);
    updatePosition();
    setIsOpen(true);
  };

  const closePanel = () => {
    setIsOpen(false);
    setQuery("");
  };

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    updatePosition();
    const handler = () => updatePosition();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      closePanel();
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
    };
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const node = listRef.current?.children?.[activeIndex];
    node?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const commit = (row) => {
    if (!row) return;
    if (row.type === "create") {
      onCreate?.(trimmed);
    } else {
      onChange?.(row.value);
    }
    closePanel();
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(rows[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      closePanel();
    }
  };

  const isFiltered = value !== "" && value !== "all";

  return (
    <div
      style={{
        position: "relative",
        display: fullWidth ? "block" : "inline-block",
        width: fullWidth ? "100%" : "auto",
        flexShrink: 0,
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? closePanel() : openPanel())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          width: fullWidth ? "100%" : "auto",
          minWidth: fullWidth ? 0 : 130,
          maxWidth: fullWidth ? "100%" : 240,
          height: fullWidth ? "42px" : "40px",
          padding: "0 14px",
          borderRadius: "12px",
          border: isFiltered ? "1.5px solid #d97706" : "1px solid var(--line-2, #ebdccb)",
          backgroundColor: isFiltered ? "#fffbeb" : "#ffffff",
          color: isFiltered ? "#92400e" : "var(--ink, #1f2937)",
          fontSize: "13.5px",
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          boxSizing: "border-box",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {icon && <span>{icon}</span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <span style={{ fontSize: "10px", opacity: 0.6 }}>▼</span>
      </button>

      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{
              position: "fixed",
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              width: pos.width,
              zIndex: 3000,
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #ebdccb",
              boxShadow: "0 14px 32px rgba(0,0,0,0.16), 0 2px 6px rgba(0,0,0,0.06)",
              padding: "8px",
              boxSizing: "border-box",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              style={{
                width: "100%",
                height: "36px",
                borderRadius: "10px",
                border: "1px solid #ebdccb",
                backgroundColor: "#faf7f2",
                padding: "0 12px",
                fontSize: "13.5px",
                outline: "none",
                boxSizing: "border-box",
                color: "#1f2937",
                marginBottom: "6px",
              }}
            />
            <div ref={listRef} style={{ maxHeight: maxPanelHeight, overflowY: "auto" }}>
              {rows.length === 0 && (
                <div style={{ padding: "10px 12px", fontSize: 13, color: "#9ca3af" }}>{emptyText}</div>
              )}
              {rows.map((row, i) => {
                const isActive = i === activeIndex;
                const isSelected = row.type === "option" && row.value === value;
                const isCreate = row.type === "create";
                return (
                  <div
                    key={`${row.type}-${String(row.value ?? row.label)}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commit(row)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      fontSize: "13.5px",
                      fontWeight: isSelected || isCreate ? 700 : 500,
                      cursor: "pointer",
                      color: isCreate ? "#b85c19" : isSelected ? "#92400e" : "#1f2937",
                      backgroundColor: isActive ? "#fef3c7" : isSelected ? "#fffbeb" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.label}
                    </span>
                    {isSelected && <span style={{ fontSize: 12 }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
