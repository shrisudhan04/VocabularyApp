import { useState, useRef, useEffect, useMemo } from "react";
import {
  requestMobileNotificationPermission,
  startHourlyNounNotifier,
  sendNounNotification,
} from "../utils/hourlyWordNotifier";
import * as XLSX from "xlsx";
import CustomDropdown from "../components/CustomDropdown";
import GoalModal from "../components/GoalModal";
import { PREP_CASE_CLASS, STATUS_OPTIONS, ARTICLE_CLASS } from "../constants/seedData";
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

// ---- FlashRev quiz config ----
const PREP_FLASHREV_STEPS = 3;
const PREP_FLASHREV_MODES = ["case", "meaning", "example"];

// Falls back to "case" if the word has no example sentence
const getPrepFlashRevMode = (word, step) => {
  const mode = PREP_FLASHREV_MODES[step % PREP_FLASHREV_STEPS];
  if (mode === "example" && !word?.example) return "case";
  return mode;
};

const QUIZ_MODE_OPTIONS = [
  { label: "Normal Quiz", value: "normal" },
  { label: "FlashRev Quiz", value: "flashrev" },
];

// ---- Swipe config ----
const SWIPE_MIN_DISTANCE = 50; // px needed to count as a swipe
const SWIPE_MAX_VERTICAL_RATIO = 0.8; // ignore mostly-vertical gestures

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
    "July", "August", "September", "October", "November", "December",
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
        <span>🗓️️</span>
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
  const [quizMode, setQuizMode] = useState("normal"); // 'normal' | 'flashrev'
  const [quizTextInput, setQuizTextInput] = useState("");
  const [quizStatusFilter, setQuizStatusFilter] = useState("all");
  const [quizDateMode, setQuizDateMode] = useState("all");
  const [quizSpecificDate, setQuizSpecificDate] = useState("");
  const [wordCountInput, setWordCountInput] = useState("");
  const [timerInput, setTimerInput] = useState("30");
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [quizAnswerState, setQuizAnswerState] = useState("idle"); // 'idle' | 'correct' | 'wrong'
  const [quizShuffleKey, setQuizShuffleKey] = useState(0);
  const [quizSessionKey, setQuizSessionKey] = useState(0);
  const autoNextTimeoutRef = useRef(null);

  // Clear auto-advance timeout on unmount
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

  // Swipe tracking (refs so touch moves don't cause re-renders)
  const touchStartRef = useRef(null); // { x, y }
  const swipedRef = useRef(false); // true right after a swipe, to block the follow-up tap

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
      const matchesStatus = quizStatusFilter === "all" || itemStatus === quizStatusFilter;
      const matchesDate = matchesDateFilter(item.createdAt, quizDateMode, quizSpecificDate);
      const matchesMode = quizMode !== "flashrev" || Boolean(item.flashRev);
      return matchesStatus && matchesDate && matchesMode;
    });
    const ordered = quizShuffleKey > 0 ? shuffleArray(filtered) : filtered;
    return quizMode === "flashrev"
      ? ordered.flatMap((item) => Array(PREP_FLASHREV_STEPS).fill(item.id))
      : ordered.map((item) => item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, quizStatusFilter, quizDateMode, quizSpecificDate, quizShuffleKey, quizMode, quizSessionKey]);

  const availableQuizWords = useMemo(() => {
    const byId = new Map(list.map((item) => [item.id, item]));
    return availableQuizPool.map((id) => byId.get(id)).filter(Boolean);
  }, [list, availableQuizPool]);

  const quizList = useMemo(() => {
    const count = parseInt(wordCountInput, 10);
    if (quizMode === "flashrev") {
      if (!isNaN(count) && count > 0) return availableQuizWords.slice(0, count * PREP_FLASHREV_STEPS);
      return availableQuizWords;
    }
    if (!isNaN(count) && count > 0) return availableQuizWords.slice(0, count);
    return availableQuizWords;
  }, [availableQuizWords, wordCountInput, quizMode]);

  const flashList = useMemo(() => {
    if (!flashOrder) return list;
    const byId = new Map(list.map((item) => [item.id, item]));
    const ordered = flashOrder.map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(flashOrder);
    return [...ordered, ...list.filter((item) => !seen.has(item.id))];
  }, [list, flashOrder]);

  useEffect(() => {
    let interval = null;
    if (timerRunning && timeLeft !== null && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timerRunning && timeLeft === 0) {
      setTimerRunning(false);
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
      setTimerRunning(true);
    }
  };

  const handleStopTimer = () => {
    setTimerRunning(false);
    setTimeLeft(null);
  };

  const resetQuizProgress = () => {
    if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback(null);
    setQuizTextInput("");
    setQuizAnswerState("idle");
    setQuizSessionKey((k) => k + 1);
  };

  // Hourly notifier
  useEffect(() => {
    let timerId = null;
    if (hourlyAlertsActive && list.length > 0) {
      timerId = startHourlyNounNotifier(list);
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
    const sample = list.length > 0 ? list[Math.floor(Math.random() * list.length)] : { article: "der", noun: "Tisch" };
    await sendNounNotification({ article: sample.article || "der", noun: sample.prep || "Test", plural: "", meaning: sample.meaning || "" });
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
      Case: item.caseType,
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
    const matchesCase = prepFilter === "all" || item.caseType === prepFilter;
    const matchesStatus = prepStatusFilter === "all" || (item.status || "In Progress") === prepStatusFilter;
    return matchesSearch && matchesCase && matchesStatus && matchesDateFilter(item.createdAt, dateFilter, customDate);
  });

  const prepsMastered = list.filter((i) => i.status === "Mastered").length;
  const countPrep = (c) => list.filter((i) => i.caseType === c).length;

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
        item.id === editingPrepId ? { ...item, ...prepFormData, prep: cleanPrep } : item
      );
    } else {
      updated = [
        ...list,
        {
          id: Date.now(),
          ...prepFormData,
          prep: cleanPrep,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const reachedGoal = !isEditing && verifyGoalMilestone(list, updated, cleanPrep);
    if (!reachedGoal && !isEditing) playSuccessSound();

    onCommitPreps?.(updated);
    setModalOpen(false);

    if (!reachedGoal) {
      setSuccessWordInfo({ prep: cleanPrep, caseType: prepFormData.caseType, isEdit: isEditing });
      setSuccessModalOpen(true);
    }
  };

  const prepCard = flashList[cardIndex];

  // Moves to the next question (or finishes the quiz)
  const goToNextQuestion = (finalScore) => {
    setQuizAnswerState("idle");
    setQuizFeedback(null);
    setQuizTextInput("");

    if (quizIndex < quizList.length - 1) {
      setQuizIndex((prev) => prev + 1);
    } else {
      setTimerRunning(false);
      setTimeLeft(null);
      setScoreModal({
        isOpen: true,
        reason: "finish",
        score: finalScore,
        total: quizList.length,
      });
    }
  };

  // Correct -> auto advance after 1s | Wrong -> stay and wait for Next button
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

    if (!isCorrect) return; // wait for the user to click Next

    autoNextTimeoutRef.current = setTimeout(() => {
      goToNextQuestion(quizScore + 1);
    }, 1000);
  };

  // Manual forward button (only used after a wrong answer)
  const handleForwardClick = () => {
    if (quizAnswerState !== "wrong") return;
    goToNextQuestion(quizScore);
  };

  // Submit quiz early
  const handleSubmitQuiz = () => {
    if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
    setTimerRunning(false);
    setTimeLeft(null);
    setScoreModal({
      isOpen: true,
      reason: "finish",
      score: quizScore,
      total: quizList.length,
    });
  };

  // Shuffle handlers
  const handleShuffleList = () => {
    if (list.length <= 1) return;
    onCommitPreps?.(shuffleArray(list));
  };

  const handleShuffleQuiz = () => {
    setQuizShuffleKey((k) => k + 1);
    resetQuizProgress();
  };

  const handleShuffleFlashcards = () => {
    if (list.length <= 1) return;
    setFlashOrder(shuffleArray(list).map((item) => item.id));
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

  // ---- Swipe handlers (generic) ----
  const handleSwipeStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    swipedRef.current = false;
  };

  // Returns "left" | "right" | null
  const getSwipeDirection = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const t = e.changedTouches?.[0];
    if (!start || !t) return null;

    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return null;
    if (Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_VERTICAL_RATIO) return null; // mostly vertical = scroll
    return dx < 0 ? "left" : "right";
  };

  // Flashcards: swipe left = next, swipe right = previous
  const handleFlashSwipeEnd = (e) => {
    const dir = getSwipeDirection(e);
    if (!dir) return;
    swipedRef.current = true;
    if (dir === "left") handleFlashNext();
    else handleFlashPrevious();
  };

  // Quiz: swipe left after a wrong answer = next question
  const handleQuizSwipeEnd = (e) => {
    const dir = getSwipeDirection(e);
    if (dir === "left" && quizAnswerState === "wrong") {
      swipedRef.current = true;
      handleForwardClick();
    }
  };

  const handleFlipCard = () => {
    // Ignore the tap that follows a swipe
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    if (!cardFlipped && prepCard && !prepCard.flashRev) {
      onCommitPreps?.(list.map((item) => (item.id === prepCard.id ? { ...item, flashRev: true } : item)));
    }
    setCardFlipped((f) => !f);
  };

  // Pale green / red panel tint while answering
  const getQuizPanelStyle = () => {
    const baseStyle = {
      marginTop: "-6px",
      paddingTop: "14px",
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
  const effectivePrepMode =
    quizMode === "flashrev" ? getPrepFlashRevMode(prepQuizWord, quizIndex % PREP_FLASHREV_STEPS) : "case";
  const flashRevCount = list.filter((p) => p.flashRev).length;
  const flashRevUniqueWords = quizMode === "flashrev" ? quizList.length / PREP_FLASHREV_STEPS : quizList.length;

  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          <div className="stats-grid">
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
                <div className={`row prep-row ${item.caseType}`} key={item.id}>
                  <div className="c-idx">{index + 1}</div>
                  <div className="c-case"><span className={`pill ${PREP_CASE_CLASS[item.caseType] || "bg-both"}`}>{item.caseType}</span></div>
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
                          caseType: item.caseType,
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
        <div className="panel">
          {!prepCard ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px" }}>
              <img src={noDataImg} alt="No Data" style={{ width: "160px", marginBottom: "12px" }} />
              <p style={{ color: "var(--muted)", margin: 0 }}>No prepositions available.</p>
            </div>
          ) : (
            <div className="flash-wrap">
              {/* Swipe works anywhere on the card: left = next, right = previous */}
              <div
                className="flash"
                onClick={handleFlipCard}
                onTouchStart={handleSwipeStart}
                onTouchEnd={handleFlashSwipeEnd}
                style={{ touchAction: "pan-y", userSelect: "none" }}
              >
                {!cardFlipped ? (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>WHICH ARTICLE &amp; CASE DOES THIS TAKE?</span>
                    <h2>{prepCard.prep}</h2>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip · Swipe to change card)</span>
                  </>
                ) : (
                  <>
                    
                    <span className={`pill ${PREP_CASE_CLASS[prepCard.caseType] || "bg-both"}`} style={{ fontSize: 20, padding: "6px 20px" }}>
                      {prepCard.caseType === "Wechsel" ? "Wechselpräposition" : `+ ${prepCard.caseType}`}
                    </span>
                    <h3 style={{ fontSize: 22, margin: "14px 0 6px", color: "var(--ink-2)" }}>{prepCard.meaning}</h3>
                    {prepCard.example && <p style={{ color: "var(--muted)", margin: 0, fontSize: 14, fontStyle: "italic" }}>"{prepCard.example}"</p>}
                  </>
                )}
              </div>
              <div
                className="flash-controls"
                onTouchStart={handleSwipeStart}
                onTouchEnd={handleFlashSwipeEnd}
                style={{ touchAction: "pan-y" }}
              >
                <button className="btn btn-secondary flash-nav-btn" disabled={cardIndex === 0} onClick={handleFlashPrevious}>◀ Previous</button>
                <button className="btn btn-secondary mid" onClick={() => speakGerman(`${prepCard.prep}. ${prepCard.example || ""}`)}>🔊 Pronounce</button>
                <button className="btn btn-secondary flash-nav-btn" disabled={cardIndex >= flashList.length - 1} onClick={handleFlashNext}>Next ▶</button>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                Preposition {cardIndex + 1} of {flashList.length} · {Math.round(((cardIndex + 1) / Math.max(flashList.length, 1)) * 100)}% · {flashRevCount} queued for FlashRev
              </span>
              <div style={{ width: "100%", maxWidth: 520, height: 6, background: "#eee7df", borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
                <div
                  style={{
                    width: `${Math.round(((cardIndex + 1) / Math.max(flashList.length, 1)) * 100)}%`,
                    height: "100%",
                    background: "var(--brand,#b85c19)",
                    borderRadius: 999,
                    transition: "width .2s ease",
                  }}
                />
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
              justifyContent: timerRunning ? "center" : "flex-start",
              gap: "10px",
              width: "100%",
              maxWidth: "100%",
              overflowX: "auto",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
              padding: "4px 2px 14px 2px",
              marginBottom: "16px",
              borderBottom: "1px solid var(--line-2, #ebdccb)",
            }}
          >
            {!timerRunning ? (
              <>
                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <CustomDropdown
                    icon="🧠"
                    value={quizMode}
                    options={QUIZ_MODE_OPTIONS}
                    onChange={(v) => { setQuizMode(v); resetQuizProgress(); }}
                  />
                </div>

                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <CustomDropdown
                    icon="📌"
                    value={quizStatusFilter}
                    options={STATUS_FILTER_OPTIONS}
                    onChange={(v) => { setQuizStatusFilter(v); resetQuizProgress(); }}
                  />
                </div>

                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <CustomDropdown
                    icon="📅"
                    value={quizDateMode}
                    options={QUIZ_DATE_DROPDOWN_OPTIONS}
                    onChange={(v) => { setQuizDateMode(v); if (v !== "specific") setQuizSpecificDate(""); resetQuizProgress(); }}
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

                {(quizStatusFilter !== "all" || quizDateMode !== "all" || quizSpecificDate || wordCountInput) && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flexShrink: 0, height: "40px", borderRadius: "12px" }}
                    onClick={() => {
                      setQuizStatusFilter("all");
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
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: "16px" }}>{timeLeft <= 5 ? "🔥" : "⏳"}</span>
                <span style={{ fontSize: "15px", fontWeight: 800, color: timeLeft <= 5 ? "#dc2626" : "#15803d" }}>
                  {timeLeft}s remaining
                </span>
                <button
                  type="button"
                  onClick={handleStopTimer}
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    border: "1px solid #fca5a5",
                    backgroundColor: "#ffffff",
                    color: "#dc2626",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: "4px",
                  }}
                >
                  ⏸
                </button>
              </div>
            )}
          </div>

          {!prepQuizWord ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "36px 16px", textAlign: "center" }}>
              <img src={noDataImg} alt="No Data" style={{ width: "160px", marginBottom: "12px" }} />
              <p style={{ color: "var(--muted)", margin: "0 0 12px 0" }}>
                {quizMode === "flashrev"
                  ? "No FlashRev words yet. Flip some cards in Flashcards view first."
                  : "No items match current filters."}
              </p>
            </div>
          ) : (
            <div
              className="quiz"
              onTouchStart={handleSwipeStart}
              onTouchEnd={handleQuizSwipeEnd}
              style={{ touchAction: "pan-y" }}
            >
              <style>{`
                .quiz-submit-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; height:56px; padding:0 30px; border:none; border-radius:999px; background:var(--brand,#b45319); color:#fff; font-size:16px; font-weight:600; cursor:pointer; box-shadow:0 10px 24px rgba(180,83,25,0.35); transition:transform .15s ease, box-shadow .15s ease; }
                .quiz-next-btn { display:inline-flex; align-items:center; justify-content:center; width:56px; height:56px; padding:0; border:none; border-radius:18px; background:var(--brand,#b45319); color:#fff; font-size:30px; font-weight:800; cursor:pointer; box-shadow:0 10px 24px rgba(180,83,25,0.35); transition:transform .15s ease, box-shadow .15s ease; }
                .quiz-next-btn:active { transform:scale(0.97); box-shadow:0 4px 12px rgba(180,83,25,0.3); }
                .quiz-submit-btn:active { transform:scale(0.97); box-shadow:0 4px 12px rgba(180,83,25,0.3); }
                .quiz-opts { display:grid; grid-template-columns:repeat(3,1fr); gap:15px; width:100%; max-width:600px; margin:20px auto 0; }
                .quiz-opts .quiz-opt { height:45px; padding:0; border:none; border-radius:10px; color:#fff; font-size:16px; font-weight:600; cursor:pointer; box-shadow:none; transition:transform .15s ease, filter .15s ease, opacity .15s ease; }
                .quiz-opts .quiz-opt:hover:not(:disabled) { filter:brightness(1.08); }
                .quiz-opts .quiz-opt:active:not(:disabled) { transform:scale(0.97); }
                .quiz-opts .quiz-opt:disabled { cursor:default; opacity:0.55; }
                .quiz-opts .quiz-opt.opt-Dativ { background:#0369a1; }
                .quiz-opts .quiz-opt.opt-Akkusativ { background:#be123c; }
                .quiz-opts .quiz-opt.opt-Wechsel { background:#15803d; }
                .quiz-opts .quiz-opt.picked:disabled { opacity:1; }
                .flashrev-dots { display:flex; align-items:center; justify-content:center; gap:6px; margin:0 0 10px; }
                .flashrev-dot { width:8px; height:8px; border-radius:50%; background:#e2e8f0; }
                .flashrev-dot.active { background:var(--brand,#b45319); transform:scale(1.3); }
                .flashrev-dot.done { background:#86efac; }
                @media(max-width:768px){ .flash-controls .flash-nav-btn{display:none!important;} }
              `}</style>
              <div className="quiz-head">
                <span>
                  {quizMode === "flashrev" ? (
                    <>
                      Word {Math.floor(quizIndex / PREP_FLASHREV_STEPS) + 1} of {flashRevUniqueWords}
                      <span style={{ color: "var(--muted)", fontWeight: 500 }}> · Q{(quizIndex % PREP_FLASHREV_STEPS) + 1}/{PREP_FLASHREV_STEPS}</span>
                    </>
                  ) : (
                    <>Question {quizIndex + 1} of {quizList.length}</>
                  )}
                </span>
                <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {quizScore}</span>
              </div>

              {quizMode === "flashrev" && (
                <div className="flashrev-dots">
                  {Array.from({ length: PREP_FLASHREV_STEPS }).map((_, i) => (
                    <span
                      key={i}
                      className={`flashrev-dot ${i < quizIndex % PREP_FLASHREV_STEPS ? "done" : i === quizIndex % PREP_FLASHREV_STEPS ? "active" : ""}`}
                    />
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
                      className={`quiz-opt opt-${opt}${quizAnswerState !== "idle" && opt === prepQuizWord.caseType ? " picked" : ""}`}
                      onClick={() => {
                        const ok = opt === prepQuizWord.caseType;
                        if (ok) setQuizScore((s) => s + 1);
                        setQuizFeedback(ok ? "Correct! 🎉" : `Wrong! Correct case is "${prepQuizWord.caseType}".`);
                        triggerAutoAdvance(ok);
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (quizAnswerState !== "idle" || !prepQuizWord) return;
                    const entered = normalize(quizTextInput);
                    const target = effectivePrepMode === "meaning" ? normalize(prepQuizWord.meaning) : normalize(prepQuizWord.prep);
                    const ok = Boolean(target) && entered === target;
                    if (ok) setQuizScore((s) => s + 1);
                    setQuizFeedback(
                      ok
                        ? "Correct! 🎉"
                        : `Incorrect. Correct answer is "${effectivePrepMode === "meaning" ? prepQuizWord.meaning : prepQuizWord.prep}".`
                    );
                    triggerAutoAdvance(ok);
                  }}
                  style={{ marginTop: 18, display: "flex", gap: 8, width: "100%", maxWidth: 420, marginInline: "auto" }}
                >
                  <input
                    autoFocus
                    disabled={quizAnswerState !== "idle"}
                    value={quizTextInput}
                    onChange={(e) => setQuizTextInput(e.target.value)}
                    className="modal-input"
                    placeholder={effectivePrepMode === "meaning" ? "Type English meaning..." : "Type German preposition..."}
                    style={{ flex: 1, height: 46, fontSize: 16, fontWeight: 600, borderRadius: 12, padding: "0 14px" }}
                  />
                  <button
                    type="submit"
                    disabled={quizAnswerState !== "idle" || !quizTextInput.trim()}
                    className="btn btn-primary"
                    style={{ height: 46, padding: "0 18px", borderRadius: 12 }}
                  >
                    Check
                  </button>
                </form>
              )}

              {quizFeedback && (
                <div style={{ marginTop: 20, textAlign: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: quizAnswerState === "correct" ? "#15803d" : "#dc2626" }}>{quizFeedback}</p>
                  {quizAnswerState === "correct" && <span style={{ fontSize: 12, color: "var(--muted)" }}>Moving to next question in 1 second...</span>}
                </div>
              )}

              {/* Next (after a wrong answer) and Submit Quiz, side by side */}
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 32 }}>
                <button type="button" className="quiz-submit-btn" onClick={handleSubmitQuiz}>✓ Submit Quiz</button>
                {quizAnswerState === "wrong" && (
                  <button type="button" className="quiz-next-btn" onClick={handleForwardClick} aria-label="Next question">
                    &gt;
                  </button>
                )}
              </div>
              {quizAnswerState === "wrong" && (
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, textAlign: "center" }}>or swipe left</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 🏆 Score / Time-Up Modal */}
      {scoreModal.isOpen && (
        <div className="overlay" style={{ zIndex: 1300 }} onClick={(e) => e.target === e.currentTarget && setScoreModal((p) => ({ ...p, isOpen: false }))}>
          <div className="modal" style={{ textAlign: "center", maxWidth: 360, padding: "26px 20px", display: "flex", flexDirection: "column", alignItems: "center", borderRadius: "20px" }}>
            <img src={scoreModal.reason === "timeup" ? alertGif : scoreModal.score > 0 ? congratsGif : alertGif} alt="Quiz Results" style={{ width: 95, height: 95, marginBottom: 12 }} />
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
              <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setScoreModal((p) => ({ ...p, isOpen: false }))}>
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