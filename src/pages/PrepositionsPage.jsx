import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  requestMobileNotificationPermission,
  startHourlyNounNotifier,
  sendNounNotification,
} from "../utils/hourlyWordNotifier";
import * as XLSX from "xlsx";
import CustomDropdown from "../components/CustomDropdown";
import GoalModal from "../components/GoalModal";
import { PREP_CASE_CLASS, STATUS_OPTIONS } from "../constants/seedData";
import { speakGerman } from "../utils/speech";
import { GoogleGenAI, Type } from "@google/genai";
import alertGif from "../assets/Alert.gif";
import successGif from "../assets/Success.gif";
import congratsGif from "../assets/Congrats.gif";
import warningRedGif from "../assets/WarningRed.gif";
import congratsAudio from "../assets/celebration.mp3";
import noDataImg from "../assets/nodata.svg";
import "../App.css";

const GEMINI_MODEL = "gemini-2.5-flash";
const CASES = ["Akkusativ", "Dativ", "Wechsel"];
const QUIZ_MODE_OPTIONS = [
  { label: "Case", value: "case" },
  { label: "FlashRev", value: "flashrev" },
];

// Quiz multi-select: status filters + question modes can be selected together.
const QUIZ_STATUS_MODE_OPTIONS = [
  { label: "All Status", value: "status:all" },
  { label: "In Progress", value: "status:In Progress" },
  { label: "Mastered", value: "status:Mastered" },
  { label: "Case", value: "mode:case" },
  { label: "FlashRev", value: "mode:flashrev" },
  { label: "Article (Akkusativ)", value: "article:Akkusativ" },
  { label: "Article (Dativ)", value: "article:Dativ" },
  { label: "Article (Wechsel)", value: "article:Wechsel" },
];

const PREP_FLASHREV_ROTATION = ["case", "meaning", "example"];
const PREP_FLASHREV_STEPS = PREP_FLASHREV_ROTATION.length;

const getPrepFlashRevMode = (word, subIndex) => {
  const available = PREP_FLASHREV_ROTATION.filter((mode) =>
    mode === "case" ||
    (mode === "meaning" && Boolean(word?.meaning)) ||
    (mode === "example" && Boolean(word?.example))
  );
  return available[subIndex % Math.max(available.length, 1)];
};

const normalize = (s = "") =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// Fisher-Yates array shuffle helper
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const getActiveAudioContext = async () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
};

const playSuccessSound = async () => {
  try {
    const ctx = await getActiveAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      const startAt = ctx.currentTime + index * 0.08;
      osc.frequency.setValueAtTime(freq, startAt);

      gain.gain.setValueAtTime(0.15, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startAt);
      osc.stop(startAt + 0.3);
    });
  } catch (err) {
    console.warn("Audio playback failed:", err);
  }
};

let goalAudioInstance = null;

const playGoalAchievedMusic = () => {
  try {
    if (goalAudioInstance) {
      goalAudioInstance.pause();
      goalAudioInstance.currentTime = 0;
    }
    goalAudioInstance = new Audio(congratsAudio);
    goalAudioInstance.volume = 0.7;
    goalAudioInstance.play().catch((err) => {
      console.warn("Celebration audio playback error:", err);
    });
  } catch (err) {
    console.warn("Failed to play goal music:", err);
  }
};

const stopGoalAchievedMusic = () => {
  if (goalAudioInstance) {
    goalAudioInstance.pause();
    goalAudioInstance.currentTime = 0;
  }
};

const playDuplicateSound = async () => {
  try {
    const ctx = await getActiveAudioContext();
    if (!ctx) return;

    [0, 0.16].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      const startAt = ctx.currentTime + delay;
      osc.frequency.setValueAtTime(260, startAt);
      osc.frequency.linearRampToValueAtTime(160, startAt + 0.14);

      gain.gain.setValueAtTime(0.2, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startAt);
      osc.stop(startAt + 0.14);
    });
  } catch (err) {
    console.warn("Audio playback failed:", err);
  }
};

const playDangerSound = async () => {
  try {
    const ctx = await getActiveAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(70, ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    console.warn("Audio playback failed:", err);
  }
};

const CASE_FILTER_OPTIONS = [
  { label: "All Cases", value: "all" },
  { label: "Akkusativ", value: "Akkusativ" },
  { label: "Dativ", value: "Dativ" },
  { label: "Wechsel", value: "Wechsel" },
];

const STATUS_FILTER_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "In Progress", value: "In Progress" },
  { label: "Mastered", value: "Mastered" },
];

const QUIZ_DATE_DROPDOWN_OPTIONS = [
  { label: "All Dates", value: "all" },
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last Week", value: "last_week" },
  { label: "Last Month", value: "last_month" },
  { label: "Specific Date...", value: "specific" },
];

const EXCEL_ACTIONS = [
  { label: "Excel Actions", value: "" },
  { label: "📥 Import", value: "import" },
  { label: "📤 Export", value: "export" },
];

const EMPTY_FORM = {
  prep: "",
  caseType: "Akkusativ",
  meaning: "",
  example: "",
  status: "In Progress",
};

const normalizeCase = (raw) => {
  const v = (raw || "").toString().trim().toLowerCase();
  if (v.startsWith("akk")) return "Akkusativ";
  if (v.startsWith("dat")) return "Dativ";
  if (v.startsWith("wech") || v.includes("/")) return "Wechsel";
  return "Akkusativ";
};

// Quiz multi-select (Case / FlashRev / Article + status).
// The menu is rendered in a portal with fixed positioning
function QuizMultiSelect({ values = [], options = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const MENU_WIDTH = 212;

  const updateMenuPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const gap = 6;
    const viewportPadding = 8;

    let left = rect.left;
    if (left + MENU_WIDTH > window.innerWidth - viewportPadding) {
      left = Math.max(viewportPadding, window.innerWidth - MENU_WIDTH - viewportPadding);
    }

    const estimatedMenuHeight = options.length * 40 + 48;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight;

    setMenuStyle({
      position: "fixed",
      left: `${left}px`,
      top: openAbove
        ? `${Math.max(viewportPadding, rect.top - estimatedMenuHeight - gap)}px`
        : `${rect.bottom + gap}px`,
      width: `${MENU_WIDTH}px`,
      zIndex: 99999,
    });
  };

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    const handleOutside = (e) => {
      const t = e.target;
      if (
        buttonRef.current && !buttonRef.current.contains(t) &&
        menuRef.current && !menuRef.current.contains(t)
      ) {
        setOpen(false);
      }
    };
    const handleReposition = () => updateMenuPosition();

    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, options.length]);

  const toggle = (value) => {
    let next = Array.isArray(values) ? [...values] : [];
    
    if (value === "status:all") {
      next = next.filter((v) => !v.startsWith("status:"));
      next.push("status:all");
    } else if (value.startsWith("status:")) {
      next = next.filter((v) => !v.startsWith("status:"));
      next.push(value);
    } else if (value.startsWith("article:")) {
      // Article modes: can only select one article type
      next = next.filter((v) => !v.startsWith("article:"));
      next.push(value);
      // If FlashRev not selected, auto-select it
      if (!next.some((v) => v === "mode:flashrev")) {
        next = next.filter((v) => v === "mode:case" ? false : true);
        next.push("mode:flashrev");
      }
    } else {
      // Mode selection (Case, FlashRev)
      next = next.includes(value) ? next.filter((v) => v !== value) : [...next, value];
      // Ensure at least one mode is selected
      if (!next.some((v) => v.startsWith("mode:") || v.startsWith("article:"))) {
        next.push("mode:case");
      }
    }
    onChange(next);
  };

  const safeValues = (Array.isArray(values) ? values : []).map((v) =>
    v === "article" || v === "mode:article" ? "mode:case" : v
  );
  
  const labels = safeValues.map((v) => {
    if (v.startsWith("article:")) {
      return "Article: " + v.slice(8);
    }
    return options.find((o) => o.value === v)?.label;
  }).filter(Boolean);
  
  const label = labels.length ? labels.join(" + ") : "Case";

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          style={{
            ...menuStyle,
            boxSizing: "border-box",
            maxHeight: "min(360px, calc(100vh - 16px))",
            overflowY: "auto",
            overflowX: "hidden",
            background: "#ffffff",
            color: "#1f2937",
            border: "1px solid #ebdccb",
            borderRadius: "14px",
            boxShadow: "0 14px 32px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.06)",
            padding: "6px",
          }}
        >
          {options.map((o) => {
            const checked = safeValues.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                style={{
                  width: "100%",
                  border: "none",
                  background: checked ? "#fff7ed" : "transparent",
                  color: checked ? "#b45309" : "#374151",
                  borderRadius: "9px",
                  padding: "10px 9px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "14px",
                  fontWeight: checked ? 700 : 500,
                }}
              >
                <span
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "5px",
                    border: checked ? "1.5px solid #b45309" : "1.5px solid #d1d5db",
                    background: checked ? "#b45309" : "#ffffff",
                    color: "#ffffff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    flexShrink: 0,
                  }}
                >
                  {checked ? "✓" : ""}
                </span>
                <span>{o.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onChange(["mode:case"])}
            style={{
              width: "100%",
              marginTop: "3px",
              padding: "8px",
              border: "none",
              borderTop: "1px solid #f1f1f1",
              background: "transparent",
              color: "#9ca3af",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            Reset to Case
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((x) => !x)}
        title={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: "212px",
          minWidth: "212px",
          maxWidth: "212px",
          height: "40px",
          boxSizing: "border-box",
          padding: "0 12px",
          borderRadius: "12px",
          border: "1px solid var(--line-2, #ebdccb)",
          background: "#ffffff",
          color: "var(--ink, #1f2937)",
          cursor: "pointer",
          fontSize: "13.5px",
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          whiteSpace: "nowrap",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        <span>📌</span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: "left",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: "10px", opacity: 0.6, flexShrink: 0 }}>▼</span>
      </button>
      {menu}
    </>
  );
}

// 🗓️ Interactive Calendar Picker Popover
function RealCalendarPicker({ selectedDate, onSelectDate }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const initialDate = useMemo(() => {
    if (selectedDate) {
      const [year, month, day] = selectedDate.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date();
  }, [selectedDate]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: daysInPrevMonth - i,
        month: viewMonth - 1,
        year: viewMonth === 0 ? viewYear - 1 : viewYear,
        isOtherMonth: true,
      });
    }

    for (let d = 1; d <= daysInCurrentMonth; d++) {
      cells.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isOtherMonth: false,
      });
    }

    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        day: d,
        month: viewMonth + 1,
        year: viewMonth === 11 ? viewYear + 1 : viewYear,
        isOtherMonth: true,
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const handleDayClick = (cell, e) => {
    e.stopPropagation();
    const formattedDate = `${cell.year}-${String(cell.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
    onSelectDate(formattedDate);
    setIsOpen(false);
  };

  const handleSelectToday = (e) => {
    e.stopPropagation();
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onSelectDate(formattedDate);
    setIsOpen(false);
  };

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "0 14px",
          borderRadius: "12px",
          border: selectedDate ? "1.5px solid #d97706" : "1px solid var(--line-2, #ebdccb)",
          backgroundColor: selectedDate ? "#fffbeb" : "#ffffff",
          color: selectedDate ? "#92400e" : "var(--ink, #1f2937)",
          fontSize: "13.5px",
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          height: "40px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        <span>🗓️</span>
        <span>
          {selectedDate
            ? new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "Pick Date"}
        </span>
        <span style={{ fontSize: "10px", opacity: 0.6 }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1150,
            width: "285px",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 14px 32px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.06)",
            border: "1px solid #ebdccb",
            padding: "14px",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{ background: "#f7f2ed", border: "none", borderRadius: "8px", width: "30px", height: "30px", cursor: "pointer", fontWeight: 700, color: "#4b5563" }}
            >
              ‹
            </button>
            <div style={{ fontWeight: 700, fontSize: "14.5px", color: "#111827" }}>
              {monthNames[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              style={{ background: "#f7f2ed", border: "none", borderRadius: "8px", width: "30px", height: "30px", cursor: "pointer", fontWeight: 700, color: "#4b5563" }}
            >
              ›
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", marginBottom: "6px" }}>
            {dayLabels.map((lbl, idx) => (
              <span
                key={lbl}
                style={{ fontSize: "11px", fontWeight: 700, color: idx === 0 || idx === 6 ? "#ef4444" : "#9ca3af", padding: "4px 0" }}
              >
                {lbl}
              </span>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", textAlign: "center" }}>
            {calendarCells.map((cell, index) => {
              const cellDateStr = `${cell.year}-${String(cell.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
              const isSelected = selectedDate === cellDateStr;
              const isToday = todayStr === cellDateStr;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={(e) => handleDayClick(cell, e)}
                  style={{
                    background: isSelected ? "var(--brand, #b85c19)" : isToday ? "#fef3c7" : "transparent",
                    color: isSelected ? "#ffffff" : cell.isOtherMonth ? "#d1d5db" : isToday ? "#b85c19" : "#1f2937",
                    border: isToday && !isSelected ? "1px solid #fde68a" : "none",
                    borderRadius: "8px",
                    height: "32px",
                    width: "100%",
                    fontSize: "12.5px",
                    fontWeight: isSelected || isToday ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f3f4f6" }}>
            <button
              type="button"
              onClick={handleSelectToday}
              style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "8px", fontSize: "12px", fontWeight: 700, color: "#b85c19", cursor: "pointer", padding: "5px 12px" }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PrepositionsPage({
  viewMode = "list",
  prepsList = [],
  onCommitPreps,
  onRequestConfirm,
}) {
  const list = Array.isArray(prepsList) ? prepsList : [];

  const [search, setSearch] = useState("");
  const [prepFilter, setPrepFilter] = useState("all");
  const [prepStatusFilter, setPrepStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  // Quiz State
  const [quizStatusFilter, setQuizStatusFilter] = useState("all");
  const [quizMode, setQuizMode] = useState(["mode:case"]);
  
  const selectedQuizModes = quizMode.filter((v) => v.startsWith("mode:")).map((v) => v.slice(5));
  const selectedArticle = quizMode.find((v) => v.startsWith("article:"));
  const articleFilter = selectedArticle ? selectedArticle.slice(8) : null;
  const selectedQuizStatus = quizMode.find((v) => v.startsWith("status:"));
  const effectiveQuizStatus = selectedQuizStatus === "status:In Progress" ? "In Progress" : selectedQuizStatus === "status:Mastered" ? "Mastered" : "all";
  
  const [quizTextInput, setQuizTextInput] = useState("");
  const [quizDateMode, setQuizDateMode] = useState("all");
  const [quizSpecificDate, setQuizSpecificDate] = useState("");
  const [wordCountInput, setWordCountInput] = useState("");
  const [timerInput, setTimerInput] = useState("30");
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [quizAnswerState, setQuizAnswerState] = useState("idle");
  const [quizShuffleKey, setQuizShuffleKey] = useState(0);
  const [quizSessionKey, setQuizSessionKey] = useState(0);
  const autoNextTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
    };
  }, []);

  const [scoreModal, setScoreModal] = useState({
    isOpen: false,
    reason: "finish",
    score: 0,
    total: 0,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrepId, setEditingPrepId] = useState(null);
  const [prepFormData, setPrepFormData] = useState(EMPTY_FORM);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateWordName, setDuplicateWordName] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successWordInfo, setSuccessWordInfo] = useState({ prep: "", caseType: "", isEdit: false });
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalCelebration, setGoalCelebration] = useState({
    isOpen: false,
    goalType: "daily",
    target: 10,
    current: 10,
    addedWord: "",
  });

  const [importSummary, setImportSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [flashOrder, setFlashOrder] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);

  const [flashCaseFilter, setFlashCaseFilter] = useState("all");
  const [flashStatusFilter, setFlashStatusFilter] = useState("all");
  const [flashDateMode, setFlashDateMode] = useState("all");
  const [flashSpecificDate, setFlashSpecificDate] = useState("");
  const touchMovedRef = useRef(false);

  const [hourlyAlertsActive, setHourlyAlertsActive] = useState(false);
  const fileInputRef = useRef(null);

  const matchesDateFilter = (isoDate, mode, specificDate) => {
    if (!isoDate || mode === "all") return true;
    const itemDate = new Date(isoDate);
    const now = new Date();

    if (mode === "today") return itemDate.toDateString() === now.toDateString();
    if (mode === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return itemDate.toDateString() === yesterday.toDateString();
    }
    if (mode === "last_week") {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return itemDate >= oneWeekAgo && itemDate <= now;
    }
    if (mode === "last_month") {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return itemDate >= oneMonthAgo && itemDate <= now;
    }
    if (mode === "specific" || mode === "custom") {
      if (!specificDate) return true;
      return isoDate.slice(0, 10) === specificDate;
    }
    return true;
  };

  const availableQuizPool = useMemo(() => {
    const filtered = list.filter((item) => {
      const itemStatus = item.status || "In Progress";
      const matchesStatus = effectiveQuizStatus === "all" || itemStatus === effectiveQuizStatus;
      const matchesDate = matchesDateFilter(item.createdAt, quizDateMode, quizSpecificDate);
      
      const includesCase = selectedQuizModes.includes("case");
      const includesFlashRev = selectedQuizModes.includes("flashrev");
      const includesArticle = Boolean(articleFilter);
      
      let matchesMode = false;
      if (includesCase) {
        matchesMode = true;
      }
      if (includesFlashRev && Boolean(item.flashRev)) {
        if (includesArticle) {
          // Only include if article matches
          matchesMode = normalizeCase(item.caseType) === articleFilter;
        } else {
          matchesMode = true;
        }
      }
      
      return matchesStatus && matchesDate && matchesMode;
    });
    
    const ordered = quizShuffleKey > 0 ? shuffleArray(filtered) : filtered;
    const includesCase = selectedQuizModes.includes("case");
    const includesFlashRev = selectedQuizModes.includes("flashrev");
    
    return ordered.flatMap((item) => {
      const tokens = [];
      if (includesCase) tokens.push({ id: item.id, mode: "case" });
      if (includesFlashRev && item.flashRev) {
        if (articleFilter) {
          // Only add if matches article filter
          if (normalizeCase(item.caseType) === articleFilter) {
            for (let i = 0; i < PREP_FLASHREV_STEPS; i++) {
              tokens.push({ id: item.id, mode: "flashrev", step: i });
            }
          }
        } else {
          for (let i = 0; i < PREP_FLASHREV_STEPS; i++) {
            tokens.push({ id: item.id, mode: "flashrev", step: i });
          }
        }
      }
      return tokens;
    });
  }, [list.length, effectiveQuizStatus, quizDateMode, quizSpecificDate, quizShuffleKey, quizMode, quizSessionKey]);

  const availableQuizWords = useMemo(() => {
    const byId = new Map(list.map((item) => [item.id, item]));
    return availableQuizPool.map((q) => ({ ...byId.get(q.id), __quizMode: q.mode, __quizStep: q.step })).filter((x) => x?.id);
  }, [list, availableQuizPool]);

  const quizList = useMemo(() => {
    const count = parseInt(wordCountInput, 10);
    if (selectedQuizModes.includes("flashrev")) {
      if (!isNaN(count) && count > 0) return availableQuizWords.slice(0, count * PREP_FLASHREV_STEPS);
      return availableQuizWords;
    }
    if (!isNaN(count) && count > 0) return availableQuizWords.slice(0, count);
    return availableQuizWords;
  }, [availableQuizWords, wordCountInput, selectedQuizModes.join(",")]);

  const handleQuizCaseSelect = (selectedCase) => {
    if (quizFeedback !== null || !prepQuizWord) return;

    const actual = normalizeCase(prepQuizWord.caseType);
    const isCorrect = selectedCase === actual;
    if (isCorrect) setQuizScore((prev) => prev + 1);

    setQuizFeedback(
      isCorrect
        ? "Correct! 🎉"
        : `Wrong! "${prepQuizWord.prep}" takes "${actual}".`
    );
    recordAnswerResult(prepQuizWord, isCorrect);
    triggerAutoAdvance(isCorrect);
  };

  const handleQuizTextSubmit = (e) => {
    e?.preventDefault();
    if (quizFeedback !== null || !prepQuizWord) return;

    const entered = normalize(quizTextInput);
    const target = effectivePrepMode === "meaning"
      ? normalize(prepQuizWord.meaning)
      : normalize(prepQuizWord.prep);
    const label = effectivePrepMode === "meaning"
      ? `The meaning is "${prepQuizWord.meaning || "—"}".`
      : `The preposition is "${prepQuizWord.prep}".`;
    const isCorrect = Boolean(target) && entered === target;

    if (isCorrect) setQuizScore((prev) => prev + 1);
    setQuizFeedback(isCorrect ? "Correct! 🎉" : `Incorrect. ${label}`);
    recordAnswerResult(prepQuizWord, isCorrect);
    triggerAutoAdvance(isCorrect);
  };

  const recordAnswerResult = (word, ok) => {
    if (!word) return;

    const isFlashRevQuestion = word?.__quizMode === "flashrev";
    const isLastSubQuestion = !isFlashRevQuestion || (word.__quizStep ?? 0) === PREP_FLASHREV_STEPS - 1;

    let changed = false;
    const updated = list.map((item) => {
      if (item.id !== word.id) return item;
      const next = { ...item };

      if (ok) {
        if (isFlashRevQuestion && item.flashRev && isLastSubQuestion) {
          next.flashRev = false;
          changed = true;
        }
      } else {
        if (!item.flashRev) {
          next.flashRev = true;
          changed = true;
        }
        if (item.status === "Mastered") {
          next.status = "Forgot";
          changed = true;
        }
      }

      return next;
    });

    if (changed) onCommitPreps?.(updated);
  };

  const filteredFlashPool = useMemo(() => {
    return list.filter((item) => {
      const itemStatus = item.status || "In Progress";
      const matchesCase =
        flashCaseFilter === "all" || normalizeCase(item.caseType) === flashCaseFilter;
      const matchesStatus = flashStatusFilter === "all" || itemStatus === flashStatusFilter;
      const matchesDate = matchesDateFilter(item.createdAt, flashDateMode, flashSpecificDate);
      return matchesCase && matchesStatus && matchesDate;
    });
  }, [list, flashCaseFilter, flashStatusFilter, flashDateMode, flashSpecificDate]);

  const flashList = useMemo(() => {
    if (!flashOrder) return filteredFlashPool;
    const byId = new Map(filteredFlashPool.map((item) => [item.id, item]));
    const ordered = flashOrder.map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(flashOrder);
    return [...ordered, ...filteredFlashPool.filter((item) => !seen.has(item.id))];
  }, [filteredFlashPool, flashOrder]);

  useEffect(() => {
    let interval = null;
    if (timerRunning && timeLeft !== null && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timerRunning && timeLeft === 0) {
      setTimerRunning(false);
      setTimerPaused(false);
      playDangerSound();
      setScoreModal({
        isOpen: true,
        reason: "timeup",
        score: quizScore,
        total: quizList.length,
      });
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timeLeft, quizScore, quizList.length]);

  const handleStartTimer = () => {
    const parsed = parseInt(timerInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setTimeLeft(parsed);
      setTimerPaused(false);
      setTimerRunning(true);
    }
  };

  const handlePauseTimer = () => {
    if (!timerRunning || timeLeft === null) return;
    setTimerRunning(false);
    setTimerPaused(true);
  };

  const handleResumeTimer = () => {
    if (!timerPaused || timeLeft === null || timeLeft <= 0) return;
    setTimerPaused(false);
    setTimerRunning(true);
  };

  const handleStopTimer = () => {
    setTimerRunning(false);
    setTimerPaused(false);
    setTimeLeft(null);
  };

  const resetQuizProgress = () => {
    if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback(null);
    setQuizAnswerState("idle");
    setQuizTextInput("");
    setQuizSessionKey((k) => k + 1);
  };

  const [lastViewMode, setLastViewMode] = useState(viewMode);
  if (lastViewMode !== viewMode) {
    setLastViewMode(viewMode);
    if (lastViewMode === "quiz") {
      setTimerRunning(false);
      setTimerPaused(false);
      setTimeLeft(null);
    }
    if (viewMode === "quiz") {
      resetQuizProgress();
    }
  }

  useEffect(() => {
    let timerId = null;
    if (hourlyAlertsActive && list.length > 0) {
      const formattedForNotifier = list.map((p) => ({
        article: p.caseType,
        noun: p.prep,
        plural: "",
        meaning: p.meaning,
      }));
      timerId = startHourlyNounNotifier(formattedForNotifier);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [hourlyAlertsActive, list]);

  const handleToggleHourlyNotifications = async () => {
    if (!hourlyAlertsActive) {
      const granted = await requestMobileNotificationPermission();
      if (granted) setHourlyAlertsActive(true);
    } else {
      setHourlyAlertsActive(false);
    }
  };

  const handleTestNotification = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("System notifications are not supported in this browser.");
      return;
    }
    if (Notification.permission === "denied") {
      alert("Notifications are blocked in site settings.");
      return;
    }
    if (Notification.permission !== "granted") {
      const granted = await requestMobileNotificationPermission();
      if (!granted) return;
    }
    const sample =
      list.length > 0
        ? list[Math.floor(Math.random() * list.length)]
        : { caseType: "Akkusativ", prep: "ohne", meaning: "without" };
    await sendNounNotification({
      article: sample.caseType,
      noun: sample.prep,
      plural: "",
      meaning: sample.meaning || "",
    });
  };

  const getGoalCounts = (items = []) => {
    const safeItems = Array.isArray(items) ? items : [];
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const currentDayOfWeek = now.getDay();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDayOfWeek, 0, 0, 0, 0).getTime();
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDayOfWeek + 6, 23, 59, 59, 999).getTime();

    let daily = 0;
    let weekly = 0;

    safeItems.forEach((item) => {
      if (!item?.createdAt) return;
      const itemTime = new Date(item.createdAt).getTime();
      if (itemTime >= startOfToday && itemTime <= endOfToday) daily += 1;
      if (itemTime >= startOfWeek && itemTime <= endOfWeek) weekly += 1;
    });

    return { daily, weekly };
  };

  const getSavedTargets = () => {
    try {
      const savedCategoryTargets = localStorage.getItem("study_goals_targets");
      if (savedCategoryTargets) {
        const parsed = JSON.parse(savedCategoryTargets);
        return {
          daily: Number(parsed.Prepositions?.daily) || 10,
          weekly: Number(parsed.Prepositions?.weekly) || 50,
        };
      }
    } catch (e) {
      console.warn("Failed to read study_goals_targets:", e);
    }
    return {
      daily: Number(localStorage.getItem("goal_daily_target")) || 10,
      weekly: Number(localStorage.getItem("goal_weekly_target")) || 50,
    };
  };

  const verifyGoalMilestone = (prevList, nextList, wordLabel = "") => {
    const { daily: dailyTarget, weekly: weeklyTarget } = getSavedTargets();
    const prevCounts = getGoalCounts(prevList);
    const nextCounts = getGoalCounts(nextList);

    if (prevCounts.daily < dailyTarget && nextCounts.daily >= dailyTarget) {
      playGoalAchievedMusic();
      setGoalCelebration({
        isOpen: true,
        goalType: "daily",
        target: dailyTarget,
        current: nextCounts.daily,
        addedWord: wordLabel,
      });
      return true;
    }

    if (prevCounts.weekly < weeklyTarget && nextCounts.weekly >= weeklyTarget) {
      playGoalAchievedMusic();
      setGoalCelebration({
        isOpen: true,
        goalType: "weekly",
        target: weeklyTarget,
        current: nextCounts.weekly,
        addedWord: wordLabel,
      });
      return true;
    }

    return false;
  };

  const { daily: prepDailyCount, weekly: prepWeeklyCount } = getGoalCounts(list);
  const { daily: prepDailyTarget, weekly: prepWeeklyTarget } = getSavedTargets();

  const handleConfirmReset = () => {
    playDangerSound();
    onCommitPreps?.([]);
    setCardIndex(0);
    setCardFlipped(false);
    resetQuizProgress();
    setResetModalOpen(false);
  };

  const exportToExcel = () => {
    if (list.length === 0) {
      alert("No prepositions to export.");
      return;
    }

    const exportData = list.map((item, index) => ({
      "#": index + 1,
      Case: normalizeCase(item.caseType),
      Preposition: item.prep,
      Meaning: item.meaning || "",
      Example: item.example || "",
      Status: item.status || "In Progress",
      CreatedAt: item.createdAt || new Date().toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Prepositions");

    XLSX.writeFile(workbook, `German_Prepositions_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleImportButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const importFromExcel = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json(worksheet);

        if (!rawJson || rawJson.length === 0) {
          alert("The uploaded Excel sheet contains no rows.");
          return;
        }

        const existingSet = new Set(list.map((p) => p.prep?.trim().toLowerCase()));
        const newEntries = [];
        const duplicateWords = [];

        rawJson.forEach((row, i) => {
          const rowLower = {};
          Object.keys(row).forEach((k) => {
            rowLower[k.trim().toLowerCase()] = row[k];
          });

          const prep = (rowLower.preposition || rowLower.prep || "").toString().trim();
          const caseType = normalizeCase(rowLower.case || rowLower.casetype || rowLower["required case"]);
          const meaning = (rowLower.meaning || rowLower["english meaning"] || "").toString().trim();
          const example = (rowLower.example || rowLower["example sentence"] || "").toString().trim();
          const status = (rowLower.status || "In Progress").toString().trim();

          if (prep) {
            const lower = prep.toLowerCase();
            if (existingSet.has(lower)) {
              duplicateWords.push(prep);
            } else {
              existingSet.add(lower);
              newEntries.push({
                id: Date.now() + i,
                prep,
                caseType,
                meaning,
                example,
                status: status.toLowerCase() === "mastered" ? "Mastered" : "In Progress",
                createdAt: new Date().toISOString(),
              });
            }
          }
        });

        if (newEntries.length > 0) {
          const updatedList = [...list, ...newEntries];
          const reachedGoal = verifyGoalMilestone(list, updatedList, `${newEntries.length} new prepositions`);
          if (!reachedGoal) playSuccessSound();
          onCommitPreps?.(updatedList);
        } else if (duplicateWords.length > 0) {
          playDuplicateSound();
        }

        setImportSummary({
          total: rawJson.length,
          added: newEntries.length,
          duplicates: duplicateWords.length,
          duplicateWords,
        });
      } catch (err) {
        console.error("Import error:", err);
        alert("Failed to parse Excel file.");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const generateGermanPrep = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setAiError("VITE_GEMINI_API_KEY is not defined in your .env file.");
      return;
    }
    if (!prepFormData.meaning.trim()) {
      setAiError("Please provide an English meaning first.");
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Give the most common German preposition that means "${prepFormData.meaning.trim()}". Provide: preposition, caseType (Akkusativ, Dativ, or Wechsel), and one short example sentence.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prep: { type: Type.STRING },
              caseType: { type: Type.STRING, enum: CASES },
              example: { type: Type.STRING },
            },
            required: ["prep", "caseType", "example"],
          },
        },
      });

      const parsed = JSON.parse(response.text);
      setPrepFormData((prev) => ({
        ...prev,
        prep: parsed.prep,
        caseType: parsed.caseType,
        example: parsed.example,
      }));
    } catch (err) {
      setAiError(err.message || "Failed to generate preposition.");
    } finally {
      setAiLoading(false);
    }
  };

  const filteredPreps = list.filter((item) => {
    const q = normalize(search);
    const matchesSearch =
      !q ||
      normalize(item.prep).includes(q) ||
      normalize(item.meaning).includes(q) ||
      normalize(item.example).includes(q) ||
      normalize(item.caseType).includes(q);
    const matchesCase =
      prepFilter === "all" || normalizeCase(item.caseType) === prepFilter;
    const matchesStatus = prepStatusFilter === "all" || (item.status || "In Progress") === prepStatusFilter;
    return matchesSearch && matchesCase && matchesStatus && matchesDateFilter(item.createdAt, dateFilter, customDate);
  });

  const prepsMastered = list.filter((i) => i.status === "Mastered").length;
  const countPrep = (c) =>
    list.filter((i) => normalizeCase(i.caseType) === c).length;

  const openAddModal = () => {
    setEditingPrepId(null);
    setAiError("");
    setPrepFormData(EMPTY_FORM);
    setModalOpen(true);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    const cleanPrep = prepFormData.prep.trim();
    if (!cleanPrep || !prepFormData.meaning.trim()) return;

    const isDuplicate = list.some(
      (item) => item.prep.trim().toLowerCase() === cleanPrep.toLowerCase() && item.id !== editingPrepId
    );

    if (isDuplicate) {
      playDuplicateSound();
      setDuplicateWordName(cleanPrep);
      setDuplicateModalOpen(true);
      return;
    }

    const isEditing = Boolean(editingPrepId);
    let updated;

    if (isEditing) {
      updated = list.map((item) =>
        item.id === editingPrepId
        ? {
            ...item,
            ...prepFormData,
            prep: cleanPrep,
            caseType: normalizeCase(prepFormData.caseType),
          }
        : item
      );
    } else {
      updated = [
        ...list,
        {
          id: Date.now(),
          ...prepFormData,
          prep: cleanPrep,
          caseType: normalizeCase(prepFormData.caseType),
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const reachedGoal = !isEditing && verifyGoalMilestone(list, updated, cleanPrep);
    if (!reachedGoal && !isEditing) playSuccessSound();

    onCommitPreps?.(updated);
    setModalOpen(false);

    if (!reachedGoal) {
      setSuccessWordInfo({
        prep: cleanPrep,
        caseType: normalizeCase(prepFormData.caseType),
        isEdit: isEditing,
      });
      setSuccessModalOpen(true);
    }
  };

  const prepCard = flashList[cardIndex];

  const closeScoreModal = () => {
    setScoreModal((p) => ({ ...p, isOpen: false }));
    resetQuizProgress();
  };

  const goToNextQuestion = (finalScore) => {
    setQuizAnswerState("idle");
    setQuizFeedback(null);
    setQuizTextInput("");

    if (quizIndex < quizList.length - 1) {
      setQuizIndex((prev) => prev + 1);
    } else {
      setTimerRunning(false);
      setTimerPaused(false);
      setTimeLeft(null);
      setScoreModal({
        isOpen: true,
        reason: "finish",
        score: finalScore,
        total: quizList.length,
      });
    }
  };

  const triggerAutoAdvance = (isCorrect) => {
    setQuizAnswerState(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      playSuccessSound();
    } else {
      playDangerSound();
    }

    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
    }

    if (!isCorrect) return;

    autoNextTimeoutRef.current = setTimeout(() => {
      goToNextQuestion(quizScore + 1);
    }, 1000);
  };

  const handleForwardClick = () => {
    if (quizAnswerState !== "wrong") return;
    goToNextQuestion(quizScore);
  };

  const handleShuffleList = () => {
    if (list.length <= 1) return;
    onCommitPreps?.(shuffleArray(list));
  };

  const handleShuffleQuiz = () => {
    setQuizShuffleKey((k) => k + 1);
    resetQuizProgress();
  };

  const handleShuffleFlashcards = () => {
    if (filteredFlashPool.length <= 1) return;
    setFlashOrder(shuffleArray(filteredFlashPool).map((item) => item.id));
    setCardIndex(0);
    setCardFlipped(false);
  };

  const handleFlashCaseChange = (value) => {
    setFlashCaseFilter(value);
    setFlashOrder(null);
    setCardIndex(0);
    setCardFlipped(false);
  };

  const handleFlashStatusChange = (value) => {
    setFlashStatusFilter(value);
    setFlashOrder(null);
    setCardIndex(0);
    setCardFlipped(false);
  };

  const handleFlashDateModeChange = (value) => {
    setFlashDateMode(value);
    setFlashSpecificDate(value === "specific" ? flashSpecificDate : "");
    setFlashOrder(null);
    setCardIndex(0);
    setCardFlipped(false);
  };

  const handleFlashDateSelect = (date) => {
    setFlashSpecificDate(date);
    setFlashOrder(null);
    setCardIndex(0);
    setCardFlipped(false);
  };

  const clearFlashFilters = () => {
    setFlashCaseFilter("all");
    setFlashStatusFilter("all");
    setFlashDateMode("all");
    setFlashSpecificDate("");
    setFlashOrder(null);
    setCardIndex(0);
    setCardFlipped(false);
  };

  const handleFlashPrevious = () => {
    if (cardIndex <= 0) return;
    setCardIndex((prev) => prev - 1);
    setCardFlipped(false);
  };

  const handleFlashNext = () => {
    if (cardIndex >= flashList.length - 1) return;
    setCardIndex((prev) => prev + 1);
    setCardFlipped(false);
  };

  const handleFlashTouchStart = (e) => {
    const touch = e.touches?.[0];
    touchMovedRef.current = false;
    setTouchStartX(touch?.clientX ?? null);
  };

  const handleFlashTouchEnd = (e) => {
    if (touchStartX === null) return;
    const endX = e.changedTouches?.[0]?.clientX;
    const dx = typeof endX === "number" ? endX - touchStartX : 0;

    if (Math.abs(dx) >= 60) {
      touchMovedRef.current = true;
      if (dx < 0) handleFlashNext();
      else handleFlashPrevious();
    }

    setTouchStartX(null);
  };

  const handleResetFlashRev = () => {
    if (flashRevCount === 0) return;
    onCommitPreps?.(list.map((item) => (item.flashRev ? { ...item, flashRev: false } : item)));
    setCardFlipped(false);
  };

  const handleFlipCard = () => {
    if (touchMovedRef.current) {
      touchMovedRef.current = false;
      return;
    }
    if (!cardFlipped && prepCard && !prepCard.flashRev) {
      onCommitPreps?.(list.map((item) => item.id === prepCard.id ? { ...item, flashRev: true } : item));
    }
    setCardFlipped((f) => !f);
  };

  const getQuizPanelStyle = () => {
    const baseStyle = {
      marginTop: "-6px",
      paddingTop: "14px",
      overflow: "visible",
      transition: "background-color 0.25s ease, border-color 0.25s ease",
    };
    if (quizAnswerState === "correct") {
      return { ...baseStyle, backgroundColor: "#f0fdf4", borderColor: "#86efac" };
    }
    if (quizAnswerState === "wrong") {
      return { ...baseStyle, backgroundColor: "#fef2f2", borderColor: "#fca5a5" };
    }
    return baseStyle;
  };

  const prepQuizWord = quizList[quizIndex];
  const effectivePrepMode = prepQuizWord?.__quizMode === "flashrev"
    ? getPrepFlashRevMode(prepQuizWord, prepQuizWord.__quizStep ?? 0)
    : "case";
  const flashRevCount = list.filter((p) => p.flashRev).length;
  const flashRevUniqueWords = quizList.filter((q) => q?.__quizMode === "flashrev").length / PREP_FLASHREV_STEPS;

  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          <style>{`
            .prepositions-mobile-stats {
              min-width: 0 !important;
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            }
            .prepositions-mobile-stats > .stat {
              min-width: 0 !important;
              overflow: hidden;
            }
            @media (max-width: 1024px) {
              .prepositions-mobile-stats {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              }
            }
            @media (max-width: 640px) {
              .prepositions-mobile-stats { gap: 12px !important; width: 100% !important; }
              .prepositions-mobile-stats > .stat {
                padding: 14px 12px !important;
                min-height: 112px !important;
                border-radius: 16px !important;
              }
              .prepositions-mobile-stats .stat-head { min-width: 0; gap: 5px; }
              .prepositions-mobile-stats .stat-label {
                min-width: 0; overflow-wrap: anywhere; font-size: 10px; letter-spacing: .55px;
              }
              .prepositions-mobile-stats .stat-pill { flex-shrink: 0; max-width: 74px; text-align: center; }
              .prepositions-mobile-stats .stat-value { font-size: 30px; }
            }
          `}</style>
          <div className="stats-grid prepositions-mobile-stats">
            <div className="stat dark">
              <div className="stat-head">
                <span className="stat-label">TOTAL PREPOSITIONS</span>
                <span className="stat-pill dark">{prepsMastered} mastered</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value">{list.length}</span>
                <span className="stat-note" style={{ color: "#a8a29e" }}>all cases</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">AKKUSATIV</span><span className="stat-pill bg-akku">Akk</span></div>
              <div className="stat-foot"><span className="stat-value c-akku">{countPrep("Akkusativ")}</span></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">DATIV</span><span className="stat-pill bg-dativ">Dat</span></div>
              <div className="stat-foot"><span className="stat-value c-dativ">{countPrep("Dativ")}</span></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">WECHSEL</span><span className="stat-pill bg-wechsel">Dat / Akk</span></div>
              <div className="stat-foot"><span className="stat-value c-wechsel">{countPrep("Wechsel")}</span></div>
            </div>
          </div>

          <div className="toolbar">
            <div className="search">
              <span>🔍</span>
              <input
                type="search"
                placeholder="Search preposition, meaning, or sentence..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div
              className="filters-cluster"
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                maxWidth: "100%",
                overflowX: "auto",
                overflowY: "hidden",
                WebkitOverflowScrolling: "touch",
                padding: "4px 2px 8px 2px",
              }}
            >
              <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                <CustomDropdown
                  icon="🏷"
                  value={prepFilter}
                  options={CASE_FILTER_OPTIONS}
                  onChange={(val) => setPrepFilter(val)}
                />
              </div>

              <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                <CustomDropdown
                  icon="📌"
                  value={prepStatusFilter}
                  options={STATUS_FILTER_OPTIONS}
                  onChange={(val) => setPrepStatusFilter(val)}
                />
              </div>

              <div style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
                <CustomDropdown
                  icon="📅"
                  value={dateFilter}
                  options={QUIZ_DATE_DROPDOWN_OPTIONS}
                  onChange={(val) => setDateFilter(val)}
                />
                {dateFilter === "specific" && (
                  <RealCalendarPicker
                    selectedDate={customDate}
                    onSelectDate={(date) => setCustomDate(date)}
                  />
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".xlsx, .xls, .csv"
                onChange={importFromExcel}
              />

              <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                <CustomDropdown
                  icon="📊"
                  value=""
                  options={EXCEL_ACTIONS}
                  onChange={(val) => {
                    if (val === "import") handleImportButtonClick();
                    if (val === "export") exportToExcel();
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleShuffleList}
                className="btn btn-secondary"
                title="Shuffle list order"
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                🔀 Shuffle
              </button>

              <button
                type="button"
                onClick={handleToggleHourlyNotifications}
                className="btn btn-secondary"
                title="Toggle Hourly Word Notification"
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                {hourlyAlertsActive ? "🔔 Alerts On" : "🔕 Alerts Off"}
              </button>

              <button
                type="button"
                onClick={handleTestNotification}
                className="btn btn-secondary"
                title="Send notification now"
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                📨 Notify Now
              </button>

              <button
                type="button"
                onClick={() => setGoalModalOpen(true)}
                className="btn btn-secondary"
                title="Configure Daily & Weekly Goals"
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                🎯 Goals
              </button>

              <button
                type="button"
                onClick={() => {
                  playDangerSound();
                  setResetModalOpen(true);
                }}
                className="btn btn-secondary"
                style={{
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                  color: "#dc2626",
                  borderColor: "#fca5a5",
                  backgroundColor: "#fef2f2",
                }}
                title="Reset all prepositions"
              >
                🔄 Reset
              </button>
            </div>
          </div>

          {filteredPreps.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 20px",
                background: "var(--card)",
                borderRadius: "14px",
                border: "1px dashed var(--line-2)",
                textAlign: "center",
                marginTop: "8px",
              }}
            >
              <img
                src={noDataImg}
                alt="No Data Found"
                style={{ width: "200px", maxWidth: "80%", height: "auto", marginBottom: "16px" }}
              />
              <h3 style={{ margin: "0 0 8px", fontSize: "19px", fontWeight: 700, color: "var(--ink)" }}>
                No Prepositions Found
              </h3>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)", maxWidth: "340px", lineHeight: 1.5 }}>
                {search || prepFilter !== "all" || prepStatusFilter !== "all" || dateFilter !== "all"
                  ? "We couldn't find matches for your current filters."
                  : "Add your first preposition to get started!"}
              </p>
            </div>
          ) : (
            <div className="list">
              <div className="list-head preps-head">
                <span style={{ textAlign: "center" }}>#</span>
                <span>CASE</span>
                <span>PREPOSITION</span>
                <span>MEANING</span>
                <span>EXAMPLE SENTENCE</span>
                <span>STATUS</span>
                <span style={{ textAlign: "right" }}>ACTIONS</span>
              </div>
              {filteredPreps.map((item, index) => (
                <div className={`row prep-row ${normalizeCase(item.caseType)}`} key={item.id}>
                  <div className="c-idx">{index + 1}</div>
                  <div className="c-case"><span className={`pill ${PREP_CASE_CLASS[normalizeCase(item.caseType)] || "bg-both"}`}>{normalizeCase(item.caseType)}</span></div>
                  <div className="c-prep" style={{ fontWeight: 700 }}>{item.prep}</div>
                  <div className="c-mean">{item.meaning}</div>
                  <div className="c-eg">{item.example || "—"}</div>
                  <div className="c-status">
                    <button
                      onClick={() =>
                        onCommitPreps?.(
                          list.map((i) =>
                            i.id === item.id
                              ? { ...i, status: i.status === "Mastered" ? "In Progress" : "Mastered" }
                              : i
                          )
                        )
                      }
                      className={`status ${item.status === "Mastered" ? "done" : "todo"}`}
                    >
                      {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                    </button>
                  </div>
                  <div className="actions">
                    <button onClick={() => speakGerman(`${item.prep}. ${item.example || ""}`)} className="icon-btn">🔊</button>
                    <button
                      onClick={() => {
                        setEditingPrepId(item.id);
                        setAiError("");
                        setPrepFormData({
                          prep: item.prep,
                          caseType: normalizeCase(item.caseType),
                          meaning: item.meaning,
                          example: item.example || "",
                          status: item.status || "In Progress",
                        });
                        setModalOpen(true);
                      }}
                      className="icon-btn"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() =>
                        onRequestConfirm?.("Delete Preposition", `Are you sure you want to delete "${item.prep}"?`, () =>
                          onCommitPreps?.(list.filter((i) => i.id !== item.id))
                        )
                      }
                      className="icon-btn"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === "list" && (
        <button onClick={openAddModal} className="fab-btn" title="Add Preposition" aria-label="Add Preposition">
          +
        </button>
      )}

      {viewMode === "flashcards" && (
        <div className="panel" style={{ marginTop: "-6px", paddingTop: 10 }}>
          <div
            className="flash-filter-row"
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              maxWidth: "100%",
              overflowX: "auto",
              overflowY: "visible",
              WebkitOverflowScrolling: "touch",
              padding: "0 2px 14px 2px",
              marginBottom: "16px",
              borderBottom: "1px solid var(--line-2, #ebdccb)",
            }}
          >
            <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
              <CustomDropdown
                icon="🎯"
                value={flashCaseFilter}
                options={CASE_FILTER_OPTIONS}
                onChange={handleFlashCaseChange}
              />
            </div>

            <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
              <CustomDropdown
                icon="📌"
                value={flashStatusFilter}
                options={STATUS_FILTER_OPTIONS}
                onChange={handleFlashStatusChange}
              />
            </div>

            <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
              <CustomDropdown
                icon="📅"
                value={flashDateMode}
                options={QUIZ_DATE_DROPDOWN_OPTIONS}
                onChange={handleFlashDateModeChange}
              />
            </div>

            {flashDateMode === "specific" && (
              <RealCalendarPicker
                selectedDate={flashSpecificDate}
                onSelectDate={handleFlashDateSelect}
              />
            )}

            <button
              type="button"
              onClick={handleShuffleFlashcards}
              className="btn btn-secondary"
              title="Shuffle filtered flashcards"
              style={{
                flexShrink: 0,
                whiteSpace: "nowrap",
                height: "40px",
                borderRadius: "12px",
                padding: "0 12px",
              }}
            >
              🔀 Shuffle
            </button>

            <div style={{ flexShrink: 0, fontSize: "13.5px", color: "var(--muted)", whiteSpace: "nowrap" }}>
              Cards: <strong style={{ color: "var(--ink)" }}>{flashList.length}</strong>
            </div>

            {(flashCaseFilter !== "all" || flashStatusFilter !== "all" || flashDateMode !== "all" || flashSpecificDate) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearFlashFilters}
                style={{
                  flexShrink: 0,
                  padding: "0 12px",
                  fontSize: "12.5px",
                  whiteSpace: "nowrap",
                  height: "40px",
                  borderRadius: "12px",
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {!prepCard ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px" }}>
              <img src={noDataImg} alt="No Data" style={{ width: "160px", marginBottom: "12px" }} />
              <p style={{ color: "var(--muted)", margin: 0 }}>No prepositions available.</p>
            </div>
          ) : (
            <div className="flash-wrap">
              <div
                className="flash"
                onClick={handleFlipCard}
                onTouchStart={handleFlashTouchStart}
                onTouchEnd={handleFlashTouchEnd}
                style={{ position: "relative", touchAction: "pan-y", userSelect: "none" }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetFlashRev();
                  }}
                  disabled={flashRevCount === 0}
                  title="Reset FlashRev"
                  aria-label="Reset FlashRev"
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    width: "34px",
                    height: "34px",
                    borderRadius: "10px",
                    border: "1px solid var(--line-2, #ebdccb)",
                    background: "rgba(255, 255, 255, 0.92)",
                    color: "var(--brand, #b85c19)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    fontSize: "18px",
                    fontWeight: 800,
                    cursor: flashRevCount === 0 ? "default" : "pointer",
                    opacity: flashRevCount === 0 ? 0.45 : 1,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    zIndex: 3,
                  }}
                >
                  ↻
                </button>

                {!cardFlipped ? (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>WHICH CASE DOES THIS TAKE?</span>
                    <h2>{prepCard.prep}</h2>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                  </>
                ) : (
                  <>
                    <span className={`pill ${PREP_CASE_CLASS[normalizeCase(prepCard.caseType)] || "bg-both"}`} style={{ fontSize: 20, padding: "6px 20px" }}>
                      {normalizeCase(prepCard.caseType) === "Wechsel" ? "Wechselpräposition" : `+ ${normalizeCase(prepCard.caseType)}`}
                    </span>
                    <h3 style={{ fontSize: 22, margin: "14px 0 6px", color: "var(--ink-2)" }}>{prepCard.meaning}</h3>
                    {prepCard.example && <p style={{ color: "var(--muted)", margin: 0, fontSize: 14, fontStyle: "italic" }}>"{prepCard.example}"</p>}
                  </>
                )}
              </div>
              <div className="flash-controls">
                <button className="btn btn-secondary flash-nav-btn" disabled={cardIndex === 0} onClick={handleFlashPrevious}>◀ Previous</button>
                <button className="btn btn-secondary mid" onClick={() => speakGerman(`${prepCard.prep}. ${prepCard.example || ""}`)}>🔊 Pronounce</button>
                <button className="btn btn-secondary flash-nav-btn" disabled={cardIndex >= flashList.length - 1} onClick={handleFlashNext}>Next ▶</button>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Preposition {cardIndex + 1} of {flashList.length} · {Math.round(((cardIndex + 1) / Math.max(flashList.length, 1)) * 100)}% · {flashRevCount} queued for FlashRev</span>
              <div style={{ width: "100%", maxWidth: 520, height: 6, background: "#eee7df", borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
                <div style={{ width: `${Math.round(((cardIndex + 1) / Math.max(flashList.length, 1)) * 100)}%`, height: "100%", background: "var(--brand,#b85c19)", borderRadius: 999, transition: "width .2s ease" }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🎯 QUIZ MODE */}
      {viewMode === "quiz" && (
        <div className="panel" style={getQuizPanelStyle()}>
          <div
            className="quiz-controls-row"
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              alignItems: "center",
              justifyContent: (timerRunning || timerPaused) ? "center" : "flex-start",
              gap: "10px",
              width: "100%",
              maxWidth: "100%",
              overflowX: "auto",
              overflowY: "visible",
              WebkitOverflowScrolling: "touch",
              padding: "4px 2px 18px 2px",
              marginBottom: "16px",
              minHeight: "62px",
              boxSizing: "border-box",
              borderBottom: "1px solid var(--line-2, #ebdccb)",
            }}
          >
            {!(timerRunning || timerPaused) ? (
              <>
                <div style={{ flex: "0 0 auto", minWidth: "0", whiteSpace: "nowrap" }}>
                  <QuizMultiSelect values={quizMode} options={QUIZ_STATUS_MODE_OPTIONS} onChange={(next) => {
                    setQuizMode(next);
                    const status = next.find((v) => v.startsWith("status:"));
                    setQuizStatusFilter(status ? status.slice(7) : "all");
                    resetQuizProgress();
                  }} />
                </div>

                <div
                  style={{
                    flex: "0 0 180px",
                    width: "180px",
                    minWidth: "180px",
                    maxWidth: "180px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <CustomDropdown
                    icon="📅"
                    value={quizDateMode}
                    options={QUIZ_DATE_DROPDOWN_OPTIONS}
                    onChange={(v) => {
                      setQuizDateMode(v);
                      if (v !== "specific") setQuizSpecificDate("");
                      resetQuizProgress();
                    }}
                  />
                </div>

                {quizDateMode === "specific" && (
                  <RealCalendarPicker
                    selectedDate={quizSpecificDate}
                    onSelectDate={(date) => { setQuizSpecificDate(date); resetQuizProgress(); }}
                  />
                )}

                <div
                  style={{
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--line-2, #ebdccb)",
                    padding: "0 12px",
                    borderRadius: "12px",
                    height: "40px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>🔢</span>
                  <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--ink, #1f2937)" }}>Count:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={availableQuizPool.length ? `${availableQuizPool.length}` : "All"}
                    value={wordCountInput}
                    onChange={(e) => {
                      setWordCountInput(e.target.value.replace(/[^0-9]/g, ""));
                      resetQuizProgress();
                    }}
                    style={{
                      width: "48px",
                      height: "28px",
                      borderRadius: "8px",
                      border: "1px solid #ebdccb",
                      backgroundColor: "#faf7f2",
                      padding: "0 6px",
                      fontSize: "13.5px",
                      fontWeight: 700,
                      color: "#1f2937",
                      textAlign: "center",
                      outline: "none",
                    }}
                  />
                </div>

                <div
                  style={{
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--line-2, #ebdccb)",
                    padding: "0 6px 0 12px",
                    borderRadius: "12px",
                    height: "40px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>⏱️</span>
                  <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--ink, #1f2937)" }}>Timer:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="30"
                    value={timerInput}
                    onChange={(e) => setTimerInput(e.target.value.replace(/[^0-9]/g, ""))}
                    style={{
                      width: "48px",
                      height: "28px",
                      borderRadius: "8px",
                      border: "1px solid #ebdccb",
                      backgroundColor: "#faf7f2",
                      padding: "0 6px",
                      fontSize: "13.5px",
                      fontWeight: 700,
                      color: "#1f2937",
                      textAlign: "center",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "12px", color: "var(--muted)", marginRight: 2 }}>s</span>
                  <button
                    type="button"
                    onClick={handleStartTimer}
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      backgroundColor: "var(--brand, #b85c19)",
                      border: "none",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ▶
                  </button>
                </div>

                <div style={{ flexShrink: 0, fontSize: "13.5px", color: "var(--muted)", whiteSpace: "nowrap", paddingLeft: "4px" }}>
                  Items: <strong style={{ color: "var(--ink)" }}>{quizList.length}</strong>
                </div>

                <button
                  type="button"
                  onClick={handleShuffleQuiz}
                  className="btn btn-secondary"
                  title="Shuffle quiz questions order"
                  style={{
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    height: "40px",
                    borderRadius: "12px",
                    padding: "0 12px",
                  }}
                >
                  🔀 Shuffle
                </button>

                {(effectiveQuizStatus !== "all" || selectedQuizModes.join(",") !== "case" || quizDateMode !== "all" || quizSpecificDate || wordCountInput || articleFilter) && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flexShrink: 0, height: "40px", borderRadius: "12px" }}
                    onClick={() => {
                      setQuizStatusFilter("all");
                      setQuizMode(["mode:case"]);
                      setQuizDateMode("all");
                      setQuizSpecificDate("");
                      setWordCountInput("");
                      resetQuizProgress();
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: timeLeft <= 5 ? "#fef2f2" : "#f0fdf4",
                  border: `1.5px solid ${timeLeft <= 5 ? "#f87171" : "#86efac"}`,
                  padding: "0 12px 0 16px",
                  borderRadius: "14px",
                  height: "44px",
                  boxSizing: "border-box",
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                }}
              >
                <span style={{ fontSize: "16px" }}>{timeLeft <= 5 ? "🔥" : "⏳"}</span>
                <span style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  color: timeLeft <= 5 ? "#dc2626" : "#15803d",
                  letterSpacing: "0.02em"
                }}>
                  {timeLeft}s remaining
                </span>

                <button
                  type="button"
                  onClick={timerPaused ? handleResumeTimer : handlePauseTimer}
                  title={timerPaused ? "Resume Timer" : "Pause Timer"}
                  aria-label={timerPaused ? "Resume Timer" : "Pause Timer"}
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "10px",
                    border: "1px solid #fca5a5",
                    backgroundColor: "#ffffff",
                    color: "#dc2626",
                    fontSize: "14px",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    marginLeft: "2px",
                  }}
                >
                  {timerPaused ? "▶" : "Ⅱ"}
                </button>
              </div>
            )}
          </div>

          {!prepQuizWord ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "36px 16px", textAlign: "center" }}>
              <img src={noDataImg} alt="No Data" style={{ width: "160px", marginBottom: "12px" }} />
              <p style={{ color: "var(--muted)", margin: "0 0 12px 0" }}>No items match current filters.</p>
            </div>
          ) : (
            <div className="quiz">
              <style>{`
                .flashrev-dots { display:flex; align-items:center; justify-content:center; gap:6px; margin:0 0 10px; }
                .flashrev-dot { width:8px; height:8px; border-radius:50%; background:#e2e8f0; }
                .flashrev-dot.active { background:var(--brand,#b45319); transform:scale(1.3); }
                .flashrev-dot.done { background:#86efac; }
                @media(max-width:768px){ .flash-controls .flash-nav-btn{display:none!important;} }
              `}</style>
              <div className="quiz-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="quiz-head-left">
                  {prepQuizWord?.__quizMode === "flashrev"
                    ? <>FlashRev · Q{(prepQuizWord.__quizStep ?? 0) + 1}/{PREP_FLASHREV_STEPS}</>
                    : <>Case · Question {quizIndex + 1} of {quizList.length}</>}
                </span>

                <span className="quiz-head-right" style={{ fontWeight: 700, color: "var(--brand)" }}>
                  Score: {quizScore}
                </span>
              </div>

              {prepQuizWord?.__quizMode === "flashrev" && (
                <div className="flashrev-dots">
                  {Array.from({ length: PREP_FLASHREV_STEPS }).map((_, i) => (
                    <span key={i} className={`flashrev-dot ${i < quizIndex % PREP_FLASHREV_STEPS ? "done" : i === quizIndex % PREP_FLASHREV_STEPS ? "active" : ""}`} />
                  ))}
                  <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 6 }}>
                    {["Case", "Meaning", "Example"][quizIndex % PREP_FLASHREV_STEPS]}
                  </span>
                </div>
              )}

              <div className="quiz-card">
                {effectivePrepMode === "case" && (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Choose the correct case:</span>
                    <h1>{prepQuizWord.prep}</h1>
                    <p style={{ color: "var(--muted)", margin: 0, fontSize: 15 }}>Meaning: <strong>{prepQuizWord.meaning}</strong></p>
                  </>
                )}
                {effectivePrepMode === "meaning" && (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Type the English meaning:</span>
                    <h1>{prepQuizWord.prep}</h1>
                  </>
                )}
                {effectivePrepMode === "example" && (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Type the German preposition used in this sentence:</span>
                    <p style={{ fontSize: 18, lineHeight: 1.5, fontWeight: 700 }}>{prepQuizWord.example || "No example available"}</p>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Hint: {prepQuizWord.meaning || "Meaning not available"}</span>
                  </>
                )}
              </div>

              {effectivePrepMode === "case" ? (
                <div className="quiz-opts">
                  {["Dativ", "Akkusativ", "Wechsel"].map((opt) => (
                    <button
                      key={opt}
                      disabled={quizAnswerState !== "idle"}
                      className={`quiz-opt quiz-opt-${opt.toLowerCase()}`}
                      onClick={() => handleQuizCaseSelect(opt)}
                      style={{
                        backgroundColor:
                          opt === "Dativ"
                            ? "#0b72a8"
                            : opt === "Akkusativ"
                            ? "#c8103f"
                            : "#15803d",
                        color: "#ffffff",
                        borderColor:
                          opt === "Dativ"
                            ? "#0b72a8"
                            : opt === "Akkusativ"
                            ? "#c8103f"
                            : "#15803d",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleQuizTextSubmit} style={{ marginTop: 18, display: "flex", gap: 8, width: "100%", maxWidth: 420, marginInline: "auto" }}>
                  <input autoFocus disabled={quizAnswerState !== "idle"} value={quizTextInput} onChange={(e) => setQuizTextInput(e.target.value)} className="modal-input" placeholder={effectivePrepMode === "meaning" ? "Type English meaning..." : "Type German preposition..."} style={{ flex: 1, height: 46, fontSize: 16, fontWeight: 600, borderRadius: 12, padding: "0 14px" }} />
                  <button type="submit" disabled={quizAnswerState !== "idle" || !quizTextInput.trim()} className="btn btn-primary" style={{ height: 46, padding: "0 18px", borderRadius: 12 }}>Check</button>
                </form>
              )}

              {quizFeedback && (
                <div style={{ marginTop: 20, textAlign: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: quizAnswerState === "correct" ? "#15803d" : "#dc2626" }}>{quizFeedback}</p>
                  {quizAnswerState === "correct" && <span style={{ fontSize: 12, color: "var(--muted)" }}>Moving to next word in 1 second...</span>}
                  {quizAnswerState === "wrong" && (
                    <button
                      type="button"
                      className="btn btn-primary quiz-next-symbol"
                      autoFocus
                      onClick={handleForwardClick}
                      title={quizIndex < quizList.length - 1 ? "Next question" : "Finish quiz"}
                      style={{
                        width: 100,
                        height: 45,
                        padding: 0,
                        borderRadius: 14,
                        fontSize: 16,
                        fontWeight: 600,
                      }}
                    >
                      Next
                    </button>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* 🏆 Score / Time-Up Modal */}
      {scoreModal.isOpen && (
        <div className="overlay" style={{ zIndex: 1300 }} onClick={(e) => e.target === e.currentTarget && closeScoreModal()}>
          <div className="modal" style={{ textAlign: "center", maxWidth: 360, padding: "26px 20px", display: "flex", flexDirection: "column", alignItems: "center", borderRadius: "20px" }}>
            <img src={scoreModal.reason === "timeup" ? alertGif : (scoreModal.score > 0 ? congratsGif : alertGif)} alt="Quiz Results" style={{ width: 95, height: 95, marginBottom: 12 }} />
            <h3 style={{ margin: "4px 0 6px", fontSize: 22, color: "var(--ink)" }}>
              {scoreModal.reason === "timeup" ? "Time's Expired!" : "Quiz Finished!"}
            </h3>
            <div style={{ display: "flex", gap: "12px", width: "100%", margin: "16px 0" }}>
              <div style={{ flex: 1, padding: "12px 6px", borderRadius: "12px", backgroundColor: "#f7f2ed", border: "1px solid #ebdccb" }}>
                <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--brand, #b85c19)" }}>
                  {scoreModal.score} / {scoreModal.total}
                </div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Score</div>
              </div>
              <div style={{ flex: 1, padding: "12px 6px", borderRadius: "12px", backgroundColor: "#f7f2ed", border: "1px solid #ebdccb" }}>
                <div style={{ fontSize: "26px", fontWeight: 800, color: "#166534" }}>
                  {scoreModal.total > 0 ? Math.round((scoreModal.score / scoreModal.total) * 100) : 0}%
                </div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Accuracy</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", width: "100%" }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={closeScoreModal}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => {
                  setScoreModal((p) => ({ ...p, isOpen: false }));
                  handleShuffleQuiz();
                  const parsed = parseInt(timerInput, 10);
                  if (!isNaN(parsed) && parsed > 0) {
                    setTimeLeft(parsed);
                    setTimerPaused(false);
                    setTimerRunning(true);
                  }
                }}
              >
                Try Again 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎯 Study Goals Modal */}
      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        defaultCategory="Prepositions"
        categoryStats={{
          Prepositions: {
            dailyCurrent: prepDailyCount,
            weeklyCurrent: prepWeeklyCount,
          },
        }}
        initialDailyTarget={prepDailyTarget}
        initialWeeklyTarget={prepWeeklyTarget}
      />

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>{editingPrepId ? "Edit Preposition" : "Add New Preposition"}</h3>
            <form onSubmit={handleSaveModal}>
              <div>
                <label className="modal-label">Required Case</label>
                <div className="radios">
                  {CASES.map((c) => (
                    <label key={c} className={`radio ${prepFormData.caseType === c ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="prepCaseType"
                        value={c}
                        checked={prepFormData.caseType === c}
                        onChange={(e) => setPrepFormData({ ...prepFormData, caseType: e.target.value })}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="modal-label">English Meaning</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="modal-input"
                    style={{ flex: 1 }}
                    type="text"
                    required
                    placeholder="e.g. without, with"
                    value={prepFormData.meaning}
                    onChange={(e) => {
                      setAiError("");
                      setPrepFormData({ ...prepFormData, meaning: e.target.value });
                    }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={generateGermanPrep} disabled={aiLoading}>
                    {aiLoading ? "Generating..." : "✨ Generate"}
                  </button>
                </div>
                {aiError && <p style={{ color: "#dc2626", fontSize: 13, margin: "6px 0 0" }}>{aiError}</p>}
              </div>

              <div>
                <label className="modal-label">Preposition</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. ohne, mit"
                  value={prepFormData.prep}
                  onChange={(e) => setPrepFormData({ ...prepFormData, prep: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Example Sentence</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. Er geht ohne mich."
                  value={prepFormData.example}
                  onChange={(e) => setPrepFormData({ ...prepFormData, example: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Status</label>
                <CustomDropdown
                  fullWidth
                  value={prepFormData.status}
                  options={STATUS_OPTIONS}
                  onChange={(val) => setPrepFormData({ ...prepFormData, status: val })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Preposition</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {resetModalOpen && (
        <div className="overlay" style={{ zIndex: 1200 }} onClick={(e) => e.target === e.currentTarget && setResetModalOpen(false)}>
          <div className="modal" style={{ textAlign: "center", maxWidth: 360, padding: "24px 20px" }}>
            <img src={warningRedGif} alt="Warning" style={{ width: 90, height: 90, marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#dc2626" }}>Reset All Prepositions?</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              Are you sure you want to delete all prepositions? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setResetModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: "center", backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }}
                onClick={handleConfirmReset}
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Alert Modal */}
      {duplicateModalOpen && (
        <div className="overlay" style={{ zIndex: 1200 }} onClick={(e) => e.target === e.currentTarget && setDuplicateModalOpen(false)}>
          <div className="modal" style={{ textAlign: "center", maxWidth: 360, padding: "24px 20px" }}>
            <img src={alertGif} alt="Alert" style={{ width: 100, height: 100, marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--ink)" }}>Preposition Already Exists!</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{duplicateWordName}"</strong> is already in your list.
            </p>
            <button type="button" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setDuplicateModalOpen(false)}>
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Goal Celebration Modal */}
      {goalCelebration.isOpen && (
        <div className="overlay" style={{ zIndex: 1300 }} onClick={(e) => e.target === e.currentTarget && (stopGoalAchievedMusic(), setGoalCelebration((p) => ({ ...p, isOpen: false })))}>
          <div className="modal" style={{ textAlign: "center", maxWidth: 380, padding: "28px 22px 24px", borderRadius: 20 }}>
            <img src={congratsGif} alt="Celebration Congrats" style={{ width: 105, height: 105, marginBottom: 12 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>Herzlichen Glückwunsch!</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: 14 }}>
              You reached your goal of <strong style={{ color: "#b85c19" }}>{goalCelebration.target} prepositions</strong>!
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "12px 18px", backgroundColor: "#b85c19" }}
              onClick={() => { stopGoalAchievedMusic(); setGoalCelebration((p) => ({ ...p, isOpen: false })); }}
            >
              Awesome, Keep Going! 🚀
            </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModalOpen && (
        <div className="overlay" style={{ zIndex: 1200 }} onClick={(e) => e.target === e.currentTarget && setSuccessModalOpen(false)}>
          <div className="modal" style={{ textAlign: "center", maxWidth: 360, padding: "24px 20px" }}>
            <img src={successGif} alt="Success" style={{ width: 100, height: 100, marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--brand, #16a34a)" }}>
              {successWordInfo.isEdit ? "Preposition Updated!" : "Preposition Added!"}
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{successWordInfo.prep}"</strong> has been saved.
            </p>
            <button type="button" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setSuccessModalOpen(false)}>
              Great! 🎉
            </button>
          </div>
        </div>
      )}

      {/* Import Summary Modal */}
      {importSummary && (
        <div className="overlay" style={{ zIndex: 1200 }} onClick={(e) => e.target === e.currentTarget && setImportSummary(null)}>
          <div className="modal" style={{ textAlign: "center", maxWidth: 380, padding: "24px 20px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 20, color: "var(--ink)" }}>Import Summary</h3>
            <div style={{ display: "flex", gap: 12, width: "100%", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ flex: 1, padding: "14px 8px", borderRadius: 10, backgroundColor: "#dcfce7", border: "1px solid #86efac", color: "#166534", fontWeight: 700 }}>
                <div style={{ fontSize: 28 }}>{importSummary.added}</div>
                <div style={{ fontSize: 12, textTransform: "uppercase" }}>Added</div>
              </div>
              <div style={{ flex: 1, padding: "14px 8px", borderRadius: 10, backgroundColor: "#fef9c3", border: "1px solid #fde047", color: "#854d0e", fontWeight: 700 }}>
                <div style={{ fontSize: 28 }}>{importSummary.duplicates}</div>
                <div style={{ fontSize: 12, textTransform: "uppercase" }}>Duplicates</div>
              </div>
            </div>
            <button type="button" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setImportSummary(null)}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}