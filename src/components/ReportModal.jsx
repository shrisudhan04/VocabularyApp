// src/components/ReportModal.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import CustomDropdown from "./CustomDropdown";
import "./ReportModal.css";

const CATEGORY_OPTIONS = ["All", "Nouns", "Verbs", "Patterns", "Prepositions", "Time"].map(
  (c) => ({ label: c, value: c })
);

const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const CHART_HEIGHT = 140; // px available for the tallest bar

const fmt = (date, opts) => date.toLocaleDateString("en-GB", opts);

// Builds the date buckets for the chosen period.
// Daily / weekly: newest first, labelled D-1, D-2 ... / W-1, W-2 ...
// Monthly: Jan -> Dec of the chosen year.
function buildBuckets(period, year) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const buckets = [];

  if (period === "daily") {
    // last 7 days, including today
    for (let i = 0; i <= 6; i++) {
      const start = new Date(y, m, d - i);
      const end = new Date(y, m, d - i + 1);
      buckets.push({
        start: start.getTime(),
        end: end.getTime(),
        label: i === 0 ? "Now" : `D-${i}`,
        full: fmt(start, { day: "numeric", month: "short" }),
      });
    }
  } else if (period === "weekly") {
    // last 8 weeks, weeks start on Monday
    const mondayOffset = (now.getDay() + 6) % 7;
    for (let i = 0; i <= 7; i++) {
      const start = new Date(y, m, d - mondayOffset - i * 7);
      const end = new Date(y, m, d - mondayOffset - i * 7 + 7);
      const lastDay = new Date(y, m, d - mondayOffset - i * 7 + 6);
      buckets.push({
        start: start.getTime(),
        end: end.getTime(),
        label: i === 0 ? "Now" : `W-${i}`,
        full: `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(lastDay, {
          day: "numeric",
          month: "short",
        })}`,
      });
    }
  } else {
    // all 12 months of the selected year
    for (let mo = 0; mo < 12; mo++) {
      const start = new Date(year, mo, 1);
      const end = new Date(year, mo + 1, 1);
      buckets.push({
        start: start.getTime(),
        end: end.getTime(),
        label: fmt(start, { month: "short" }),
        full: fmt(start, { month: "long", year: "numeric" }),
      });
    }
  }

  const t = now.getTime();
  return buckets.map((b) => ({ ...b, current: t >= b.start && t < b.end }));
}

export default function ReportModal({ isOpen, onClose, lists }) {
  const currentYear = new Date().getFullYear();

  const [category, setCategory] = useState("All");
  const [period, setPeriod] = useState("daily");
  const [year, setYear] = useState(currentYear);
  const scrollRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Years from your oldest item up to the current year (latest first)
  const yearOptions = useMemo(() => {
    let minYear = currentYear;
    Object.values(lists || {})
      .flat()
      .forEach((item) => {
        const yr = item.createdAt ? new Date(item.createdAt).getFullYear() : NaN;
        if (!Number.isNaN(yr) && yr < minYear) minYear = yr;
      });
    const options = [];
    for (let yr = currentYear; yr >= minYear; yr--) {
      options.push({ label: String(yr), value: String(yr) });
    }
    return options;
  }, [lists, currentYear]);

  const { data, total, max } = useMemo(() => {
    const items =
      category === "All" ? Object.values(lists || {}).flat() : (lists || {})[category] || [];

    const buckets = buildBuckets(period, year).map((b) => ({ ...b, count: 0 }));

    items.forEach((item) => {
      const ts = item.createdAt ? new Date(item.createdAt).getTime() : NaN;
      if (Number.isNaN(ts)) return;
      const bucket = buckets.find((b) => ts >= b.start && ts < b.end);
      if (bucket) bucket.count += 1;
    });

    return {
      data: buckets,
      total: buckets.reduce((sum, b) => sum + b.count, 0),
      max: Math.max(1, ...buckets.map((b) => b.count)),
    };
  }, [lists, category, period, year]);

  // Scroll the chart so the current period is in view (e.g. Oct in the monthly view)
  useEffect(() => {
    if (!isOpen) return;
    const box = scrollRef.current;
    if (!box) return;
    const current = box.querySelector(".is-current");
    box.scrollLeft = current
      ? Math.max(0, current.offsetLeft - box.clientWidth / 2 + current.offsetWidth / 2)
      : 0;
  }, [isOpen, period, year, category, data]);

  if (!isOpen) return null;

  const periodWord = { daily: "7 days", weekly: "8 weeks" }[period];
  const summaryText =
    period === "monthly" ? `added in ${year}` : `added in the last ${periodWord}`;

  return (
    <div className="report-overlay" onClick={onClose}>
      <div
        className="report-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Report"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="report-header">
          <h2 className="report-title">📊 Report</h2>

          <div className="report-controls">
            <CustomDropdown
              icon="🗂️"
              value={category}
              options={CATEGORY_OPTIONS}
              onChange={(val) => setCategory(val)}
            />

            <CustomDropdown
              icon="📅"
              value={period}
              options={PERIODS}
              onChange={(val) => setPeriod(val)}
            />

            {period === "monthly" && (
              <CustomDropdown
                icon="🗓️"
                value={String(year)}
                options={yearOptions}
                onChange={(val) => setYear(Number(val))}
              />
            )}

            <button className="report-close" onClick={onClose} aria-label="Close report">
              ✕
            </button>
          </div>
        </div>

        <div className="report-scroll" ref={scrollRef}>
          <div className="report-chart">
            {data.map((b) => (
              <div
                className={`report-col ${b.current ? "is-current" : ""}`}
                key={b.start}
                title={`${b.full}: ${b.count}`}
              >
                <div className="report-bar-wrap" style={{ height: CHART_HEIGHT + 22 }}>
                  <span className={`report-count ${b.count === 0 ? "is-zero" : ""}`}>
                    {b.count}
                  </span>
                  <div
                    className={`report-bar ${b.count === 0 ? "is-empty" : ""}`}
                    style={{
                      height: b.count === 0 ? 3 : Math.round((b.count / max) * CHART_HEIGHT),
                    }}
                  />
                </div>
                <span className="report-label">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="report-summary">
          <span className="report-summary-num">{total}</span>
          <span className="report-summary-text">
            {total === 1 ? "item" : "items"} {summaryText}
            {category !== "All" ? ` · ${category}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}