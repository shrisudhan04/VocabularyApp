import { useState, useRef, useEffect, useMemo } from "react";
import {
  requestMobileNotificationPermission,
  startHourlyNounNotifier,
  sendNounNotification,
} from "../utils/hourlyWordNotifier";
import * as XLSX from "xlsx";
import CustomDropdown from "../components/CustomDropdown";
import GoalModal from "../components/GoalModal";
import { VERB_CASE_CLASS, STATUS_OPTIONS } from "../constants/seedData";
import { speakGerman } from "../utils/speech";
import { GoogleGenAI, Type } from "@google/genai";
import alertGif from "../assets/Alert.gif";
import successGif from "../assets/Success.gif";
import congratsGif from "../assets/Congrats.gif";
import warningRedGif from "../assets/WarningRed.gif";
import congratsAudio from "../assets/celebration.mp3";
import noDataImg from "../assets/nodata.svg";
import "../App.css";

const GEMINI_MODEL = "gemini-3.8-flash";

// A quiz needs at least this percentage to count as passed
const PASS_PERCENT = 70;

// FlashRev asks each word several questions in a row, one per step.
// Keep this order in sync with the step labels shown in the quiz UI
// (["Case","Präteritum","Partizip II","Meaning"]).
const VERB_FLASHREV_STEPS_LIST = ["case", "preterite", "participle", "meaning"];
const VERB_FLASHREV_STEPS = VERB_FLASHREV_STEPS_LIST.length; // 4

// Picks the question type for a word at a given step (0..VERB_FLASHREV_STEPS-1).
// Falls back to "case" when the word has no data for that step, so the quiz
// never asks for an answer that is empty.
const getVerbFlashRevMode = (word, step = 0) => {
  const mode = VERB_FLASHREV_STEPS_LIST[step] ?? "case";
  if (!word) return "case";
  if (mode === "preterite" && !word.preterite) return "case";
  if (mode === "participle" && !word.participle) return "case";
  if (mode === "meaning" && !word.meaning) return "case";
  return mode;
};

const normalize = (s = "") =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const foldGerman = (s = "") =>
  String(s ?? "")
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");

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

const CASE_OPTIONS = [
  { label: "All Cases", value: "all" },
  { label: "Dativ", value: "Dativ" },
  { label: "Akkusativ", value: "Akkusativ" },
  { label: "Both / Common", value: "Both / Common" },
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

const QUIZ_MODE_OPTIONS = [
  { label: "Case (Dativ/Akkusativ)", value: "case" },
  { label: "Präteritum", value: "preterite" },
  { label: "Partizip II", value: "participle" },
  { label: "Infinitive", value: "infinitive" },
  { label: "FlashRev", value: "flashrev" },
];

const EXCEL_ACTIONS = [
  { label: "Excel Actions", value: "" },
  { label: "📥 Import", value: "import" },
  { label: "📤 Export", value: "export" },
];

const EMPTY_VERB_FORM = {
  verb: "",
  preterite: "",
  participle: "",
  caseType: "Dativ",
  meaning: "",
  example: "",
  status: "In Progress",
};

// 🗓️ Interactive Real Calendar Picker Popover
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
        <span>🗓</span>
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                background: "#f7f2ed",
                border: "none",
                borderRadius: "8px",
                width: "30px",
                height: "30px",
                cursor: "pointer",
                fontWeight: 700,
                color: "#4b5563",
              }}
            >
              ‹
            </button>
            <div style={{ fontWeight: 700, fontSize: "14.5px", color: "#111827" }}>
              {monthNames[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              style={{
                background: "#f7f2ed",
                border: "none",
                borderRadius: "8px",
                width: "30px",
                height: "30px",
                cursor: "pointer",
                fontWeight: 700,
                color: "#4b5563",
              }}
            >
              ›
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              textAlign: "center",
              marginBottom: "6px",
            }}
          >
            {dayLabels.map((lbl, idx) => (
              <span
                key={lbl}
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: idx === 0 || idx === 6 ? "#ef4444" : "#9ca3af",
                  padding: "4px 0",
                }}
              >
                {lbl}
              </span>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "2px",
              textAlign: "center",
            }}
          >
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
                    background: isSelected
                      ? "var(--brand, #b85c19)"
                      : isToday
                      ? "#fef3c7"
                      : "transparent",
                    color: isSelected
                      ? "#ffffff"
                      : cell.isOtherMonth
                      ? "#d1d5db"
                      : isToday
                      ? "#b85c19"
                      : "#1f2937",
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

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: "1px solid #f3f4f6",
            }}
          >
            <button
              type="button"
              onClick={handleSelectToday}
              style={{
                background: "#fef3c7",
                border: "1px solid #fde68a",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#b85c19",
                cursor: "pointer",
                padding: "5px 12px",
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerbsPage({
  viewMode = "list",
  verbsList = [],
  onCommitVerbs,
  onRequestConfirm,
}) {
  const list = Array.isArray(verbsList) ? verbsList : [];

  const [search, setSearch] = useState("");
  const [verbFilter, setVerbFilter] = useState("all");
  const [verbStatusFilter, setVerbStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  // Quiz Filters & Mode
  const [quizStatusFilter, setQuizStatusFilter] = useState("all");
  const [quizDateMode, setQuizDateMode] = useState("all");
  const [quizSpecificDate, setQuizSpecificDate] = useState("");
  const [quizMode, setQuizMode] = useState("case");
  const [quizTextInput, setQuizTextInput] = useState("");

  // Quiz Controls: Limit & Timer
  const [wordCountInput, setWordCountInput] = useState("");
  const [timerInput, setTimerInput] = useState("30");
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  // Keeps the active quiz banner displayed even when paused
  const [isQuizActive, setIsQuizActive] = useState(false);

  // Quiz Progress
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

  // Quiz Completion Modal
  const [scoreModal, setScoreModal] = useState({
    isOpen: false,
    reason: "finish",
    score: 0,
    total: 0,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingVerbId, setEditingVerbId] = useState(null);
  const [verbFormData, setVerbFormData] = useState(EMPTY_VERB_FORM);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateWordName, setDuplicateWordName] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successWordInfo, setSuccessWordInfo] = useState({ verb: "", caseType: "", isEdit: false });
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

  const [hourlyAlertsActive, setHourlyAlertsActive] = useState(false);
  const fileInputRef = useRef(null);

  const matchesDateFilter = (isoDate, mode, specificDate) => {
    if (!isoDate || mode === "all") return true;
    const itemDate = new Date(isoDate);
    const now = new Date();

    if (mode === "today") {
      return itemDate.toDateString() === now.toDateString();
    }
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
      ? ordered.flatMap((item) => Array(VERB_FLASHREV_STEPS).fill(item.id))
      : ordered.map((item) => item.id);
  }, [list, quizStatusFilter, quizDateMode, quizSpecificDate, quizShuffleKey, quizMode, quizSessionKey]);

  const availableQuizWords = useMemo(() => {
    const byId = new Map(list.map((item) => [item.id, item]));
    return availableQuizPool.map((id) => byId.get(id)).filter(Boolean);
  }, [list, availableQuizPool]);

  const quizList = useMemo(() => {
    const count = parseInt(wordCountInput, 10);
    if (quizMode === "flashrev") {
      if (!isNaN(count) && count > 0) return availableQuizWords.slice(0, count * VERB_FLASHREV_STEPS);
      return availableQuizWords;
    }
    if (!isNaN(count) && count > 0) return availableQuizWords.slice(0, count);
    return availableQuizWords;
  }, [availableQuizWords, wordCountInput, quizMode]);

  // Countdown Timer — same lifecycle as the Noun page
  useEffect(() => {
    let interval = null;
    if (timerRunning && timeLeft !== null && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timerRunning && timeLeft === 0) {
      setTimerRunning(false);
      setIsQuizActive(false);
      setTimerExpired(true);
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
    if (timeLeft !== null && timeLeft > 0) {
      setTimerExpired(false);
      setTimerRunning(true);
      setIsQuizActive(true);
      return;
    }

    const parsed = parseInt(timerInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setTimerExpired(false);
      setTimeLeft(parsed);
      setTimerRunning(true);
      setIsQuizActive(true);
    }
  };

  const handleToggleTimer = () => {
    if (timerRunning) {
      // Pause: keep remaining time and keep the active quiz banner.
      setTimerRunning(false);
      return;
    }

    // Resume with the remaining time.
    if (timeLeft !== null && timeLeft > 0) {
      setTimerRunning(true);
    } else {
      handleStartTimer();
    }
  };

  const handleStopTimer = () => {
    setTimerRunning(false);
    setTimerExpired(false);
    setIsQuizActive(false);
    setTimeLeft(null);
  };

  const resetQuizProgress = () => {
    if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback(null);
    setQuizAnswerState("idle");
    setQuizTextInput("");
    setTimerExpired(false);
    setQuizSessionKey((k) => k + 1);
  };

  const [lastViewMode, setLastViewMode] = useState(viewMode);
  if (lastViewMode !== viewMode) {
    setLastViewMode(viewMode);
    if (lastViewMode === "quiz") {
      setTimerRunning(false);
      setIsQuizActive(false);
      setTimeLeft(null);
      setTimerExpired(false);
    }
    if (viewMode === "quiz") {
      resetQuizProgress();
    }
  }

  const handleQuizStatusChange = (val) => {
    setQuizStatusFilter(val);
    resetQuizProgress();
  };

  const handleQuizDateModeChange = (val) => {
    setQuizDateMode(val);
    if (val !== "specific") {
      setQuizSpecificDate("");
    }
    resetQuizProgress();
  };

  const handleQuizCalendarDateSelect = (dateStr) => {
    setQuizSpecificDate(dateStr);
    resetQuizProgress();
  };

  useEffect(() => {
    let timerId = null;
    if (hourlyAlertsActive && list.length > 0) {
      const formattedForNotifier = list.map((v) => ({
        article: v.caseType,
        noun: v.verb,
        plural: `${v.preterite || "—"} / ${v.participle || "—"}`,
        meaning: v.meaning,
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
      if (granted) {
        setHourlyAlertsActive(true);
      }
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
      alert("Notifications are blocked. Enable them in your browser's site settings.");
      return;
    }
    if (Notification.permission !== "granted") {
      const granted = await requestMobileNotificationPermission();
      if (!granted) return;
    }
    const sampleVerb =
      list.length > 0
        ? list[Math.floor(Math.random() * list.length)]
        : { caseType: "Dativ", verb: "helfen", preterite: "half", participle: "geholfen", meaning: "to help" };

    await sendNounNotification({
      article: sampleVerb.caseType,
      noun: sampleVerb.verb,
      plural: `${sampleVerb.preterite || ""} / ${sampleVerb.participle || ""}`,
      meaning: sampleVerb.meaning,
    });
  };

  const getGoalCounts = (items = []) => {
    const safeItems = Array.isArray(items) ? items : [];
    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0, 0, 0, 0
    ).getTime();

    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23, 59, 59, 999
    ).getTime();

    const currentDayOfWeek = now.getDay();

    const startOfWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - currentDayOfWeek,
      0, 0, 0, 0
    ).getTime();

    const endOfWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - currentDayOfWeek + 6,
      23, 59, 59, 999
    ).getTime();

    let daily = 0;
    let weekly = 0;

    safeItems.forEach((item) => {
      if (!item?.createdAt) return;
      const itemTime = new Date(item.createdAt).getTime();

      if (itemTime >= startOfToday && itemTime <= endOfToday) {
        daily += 1;
      }

      if (itemTime >= startOfWeek && itemTime <= endOfWeek) {
        weekly += 1;
      }
    });

    return { daily, weekly };
  };

  const getSavedTargets = () => {
    try {
      const savedCategoryTargets = localStorage.getItem("study_goals_targets");
      if (savedCategoryTargets) {
        const parsed = JSON.parse(savedCategoryTargets);
        return {
          daily: Number(parsed.Verbs?.daily) || 10,
          weekly: Number(parsed.Verbs?.weekly) || 50,
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

  const { daily: verbDailyCount, weekly: verbWeeklyCount } = getGoalCounts(list);
  const { daily: verbDailyTarget, weekly: verbWeeklyTarget } = getSavedTargets();

  const handleConfirmReset = () => {
    playDangerSound();
    onCommitVerbs?.([]);
    setCardIndex(0);
    setCardFlipped(false);
    resetQuizProgress();
    setResetModalOpen(false);
  };

  const exportToExcel = () => {
    if (list.length === 0) {
      alert("No verbs to export.");
      return;
    }

    const exportData = list.map((item, index) => ({
      "#": index + 1,
      Verb: item.verb,
      Case: item.caseType || "Dativ",
      Präteritum: item.preterite || "",
      "Partizip II": item.participle || "",
      Meaning: item.meaning || "",
      Example: item.example || "",
      Status: item.status || "In Progress",
      CreatedAt: item.createdAt || new Date().toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Verbs");

    XLSX.writeFile(workbook, `German_Verbs_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet);

        if (!rawJson || rawJson.length === 0) {
          alert("The uploaded Excel sheet contains no rows.");
          return;
        }

        const existingVerbSet = new Set(
          list.map((v) => v.verb?.trim().toLowerCase())
        );

        const newEntries = [];
        const duplicateWords = [];

        rawJson.forEach((row, i) => {
          const rowLower = {};
          Object.keys(row).forEach((k) => {
            rowLower[k.trim().toLowerCase()] = row[k];
          });

          const verb = (rowLower.verb || rowLower["infinitive"] || rowLower["german verb"] || "").toString().trim();
          let caseType = (rowLower.case || rowLower["casetype"] || rowLower["grammatical case"] || "Dativ").toString().trim();
          const preterite = (rowLower.preterite || rowLower["präteritum"] || rowLower["past"] || "").toString().trim();
          const participle = (rowLower.participle || rowLower["partizip ii"] || rowLower["partizip 2"] || "").toString().trim();
          const meaning = (rowLower.meaning || rowLower["english meaning"] || "").toString().trim();
          const example = (rowLower.example || rowLower["example sentence"] || "").toString().trim();
          const status = (rowLower.status || "In Progress").toString().trim();

          const validCases = ["Dativ", "Akkusativ", "Both / Common"];
          if (!validCases.includes(caseType)) {
            if (caseType.toLowerCase().includes("both")) caseType = "Both / Common";
            else if (caseType.toLowerCase().includes("akku")) caseType = "Akkusativ";
            else caseType = "Dativ";
          }

          if (verb) {
            const lowerVerb = verb.toLowerCase();
            if (existingVerbSet.has(lowerVerb)) {
              duplicateWords.push(verb);
            } else {
              existingVerbSet.add(lowerVerb);
              newEntries.push({
                id: Date.now() + i,
                verb,
                caseType,
                preterite,
                participle,
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
          const reachedGoal = verifyGoalMilestone(list, updatedList, `${newEntries.length} new verbs`);
          if (!reachedGoal) {
            playSuccessSound();
          }
          onCommitVerbs?.(updatedList);
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
        alert("Failed to parse Excel file. Please ensure it has proper column headers (Verb, Case, Präteritum, Partizip II, Meaning, Example).");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const generateGermanVerb = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      setAiError("VITE_GEMINI_API_KEY is not defined in your .env file.");
      return;
    }

    if (!verbFormData.meaning.trim()) {
      setAiError("Please provide an English meaning first.");
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");

      const ai = new GoogleGenAI({ apiKey });

      const promptConfig = {
        contents: `Translate the English verb "${verbFormData.meaning.trim()}" into German. Provide the infinitive verb (lowercase, e.g., 'helfen'), Präteritum (3rd person singular, e.g., 'half'), Partizip II (e.g., 'geholfen'), the primary grammatical case it governs ('Dativ', 'Akkusativ', or 'Both / Common'), and a short natural example sentence with German translation.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verb: {
                type: Type.STRING,
                description: "German infinitive in lowercase",
              },
              preterite: {
                type: Type.STRING,
                description: "Simple past (Präteritum 3rd person singular)",
              },
              participle: {
                type: Type.STRING,
                description: "Past participle (Partizip II)",
              },
              caseType: {
                type: Type.STRING,
                enum: ["Dativ", "Akkusativ", "Both / Common"],
                description: "Case governed by the verb",
              },
              example: {
                type: Type.STRING,
                description: "Short German sentence showing usage with the correct case",
              },
            },
            required: ["verb", "preterite", "participle", "caseType", "example"],
          },
        },
      };

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        ...promptConfig,
      });

      const parsed = JSON.parse(response.text);

      setVerbFormData((prev) => ({
        ...prev,
        verb: parsed.verb,
        preterite: parsed.preterite,
        participle: parsed.participle,
        caseType: parsed.caseType,
        example: parsed.example,
      }));
    } catch (err) {
      setAiError(err.message || "Failed to generate verb.");
    } finally {
      setAiLoading(false);
    }
  };

  const filteredVerbs = list.filter((item) => {
    const q = normalize(search);
    const matchesSearch =
      !q ||
      normalize(item.verb).includes(q) ||
      normalize(item.preterite).includes(q) ||
      normalize(item.participle).includes(q) ||
      normalize(item.meaning).includes(q) ||
      normalize(item.example).includes(q);
    const matchesCase = verbFilter === "all" || item.caseType === verbFilter;
    const itemStatus = item.status || "In Progress";
    const matchesStatus = verbStatusFilter === "all" || itemStatus === verbStatusFilter;
    return matchesSearch && matchesCase && matchesStatus && matchesDateFilter(item.createdAt, dateFilter, customDate);
  });

  const verbsMastered = list.filter((i) => i.status === "Mastered").length;
  const countVerb = (c) => list.filter((i) => i.caseType === c).length;

  const openAddModal = () => {
    setEditingVerbId(null);
    setAiError("");
    setVerbFormData(EMPTY_VERB_FORM);
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingVerbId(item.id);
    setAiError("");
    setVerbFormData({
      verb: item.verb,
      preterite: item.preterite || "",
      participle: item.participle || "",
      caseType: item.caseType || "Dativ",
      meaning: item.meaning,
      example: item.example || "",
      status: item.status || "In Progress",
    });
    setModalOpen(true);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();

    const cleanVerb = verbFormData.verb.trim();
    if (!cleanVerb || !verbFormData.meaning.trim()) {
      return;
    }

    const isDuplicate = list.some(
      (item) =>
        item.verb.trim().toLowerCase() === cleanVerb.toLowerCase() &&
        item.id !== editingVerbId
    );

    if (isDuplicate) {
      playDuplicateSound();
      setDuplicateWordName(cleanVerb);
      setDuplicateModalOpen(true);
      return;
    }

    let updated;
    const isEditing = Boolean(editingVerbId);

    if (isEditing) {
      updated = list.map((item) =>
        item.id === editingVerbId ? { ...item, ...verbFormData, verb: cleanVerb } : item
      );
    } else {
      updated = [
        ...list,
        {
          id: Date.now(),
          ...verbFormData,
          verb: cleanVerb,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const reachedGoal = !isEditing && verifyGoalMilestone(list, updated, cleanVerb);

    if (!reachedGoal && !isEditing) {
      playSuccessSound();
    }

    onCommitVerbs?.(updated);
    setModalOpen(false);

    if (!reachedGoal) {
      setSuccessWordInfo({
        verb: cleanVerb,
        caseType: verbFormData.caseType,
        isEdit: isEditing,
      });
      setSuccessModalOpen(true);
    }
  };

  const toggleStatus = (id) =>
    onCommitVerbs?.(
      list.map((i) =>
        i.id === id
          ? { ...i, status: i.status === "Mastered" ? "In Progress" : "Mastered" }
          : i
      )
    );

  const handleQuizCaseSelect = (selectedCase) => {
    if (quizFeedback !== null || !verbQuizWord) return;

    const actual = verbQuizWord.caseType;
    const isCorrect = selectedCase === actual;

    if (isCorrect) setQuizScore((prev) => prev + 1);

    setQuizFeedback(
      isCorrect
        ? "Correct! 🎉"
        : `Wrong! "${verbQuizWord.verb}" governs "${actual}".`
    );

    recordAnswerResult(verbQuizWord, isCorrect);
    triggerAutoAdvance(isCorrect);
  };

  const handleQuizTextSubmit = (e) => {
    e?.preventDefault();
    if (quizFeedback !== null || !verbQuizWord) return;

    const entered = foldGerman(quizTextInput);
    let target = "";
    let label = "";

    if (effectiveVerbMode === "preterite") {
      target = foldGerman(verbQuizWord.preterite);
      label = `The Präteritum form is "${verbQuizWord.preterite || "—"}".`;
    } else if (effectiveVerbMode === "participle") {
      target = foldGerman(verbQuizWord.participle);
      label = `The Partizip II form is "${verbQuizWord.participle || "—"}".`;
    } else if (effectiveVerbMode === "infinitive") {
      target = foldGerman(verbQuizWord.verb);
      label = `The infinitive verb is "${verbQuizWord.verb}".`;
    } else if (effectiveVerbMode === "meaning") {
      target = foldGerman(verbQuizWord.meaning);
      label = `The meaning is "${verbQuizWord.meaning || "—"}".`;
    }

    const isCorrect = Boolean(target) && entered === target;
    if (isCorrect) setQuizScore((prev) => prev + 1);
    setQuizFeedback(isCorrect ? "Correct! 🎉" : `Incorrect. ${label}`);
    recordAnswerResult(verbQuizWord, isCorrect);
    triggerAutoAdvance(isCorrect);
  };

  const flashList = useMemo(() => {
    if (!flashOrder) return list;
    const byId = new Map(list.map((item) => [item.id, item]));
    const ordered = flashOrder.map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(flashOrder);
    return [...ordered, ...list.filter((item) => !seen.has(item.id))];
  }, [list, flashOrder]);

  const verbCard = flashList[cardIndex];

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
  const handleFlashTouchStart = (e) => setTouchStartX(e.touches?.[0]?.clientX ?? null);
  const handleFlashTouchEnd = (e) => {
    if (touchStartX === null) return;
    const endX = e.changedTouches?.[0]?.clientX;
    if (typeof endX === "number" && Math.abs(endX - touchStartX) >= 60) {
      if (endX < touchStartX) handleFlashNext();
      else handleFlashPrevious();
    }
    setTouchStartX(null);
  };
  const handleFlipCard = () => {
    if (!cardFlipped && verbCard && !verbCard.flashRev) {
      onCommitVerbs?.(list.map((item) => item.id === verbCard.id ? { ...item, flashRev: true } : item));
    }
    setCardFlipped((f) => !f);
  };
  const openResultModal = (reason, score, total) => {
    const pct = total > 0 ? (score / total) * 100 : 0;
    if (reason !== "timeup") {
      if (pct >= PASS_PERCENT) {
        playGoalAchievedMusic();
      } else {
        playDangerSound();
      }
    }
    setScoreModal({ isOpen: true, reason, score, total });
  };

  const closeScoreModal = () => {
    stopGoalAchievedMusic();
    setScoreModal((p) => ({ ...p, isOpen: false }));
    resetQuizProgress();
  };

  const handleSubmitQuiz = () => {
    if (!quizList.length) return;
    if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
    setTimerRunning(false);
    setIsQuizActive(false);
    setTimeLeft(null);
    openResultModal("submit", quizScore, quizList.length);
  };

  const recordAnswerResult = (word, ok) => {
    if (!word) return;
    const isLastSubQuestion =
      quizMode !== "flashrev" || (quizIndex % VERB_FLASHREV_STEPS === VERB_FLASHREV_STEPS - 1);
    let changed = false;
    const updated = list.map((item) => {
      if (item.id !== word.id) return item;
      const next = { ...item };
      if (ok) {
        if (quizMode === "flashrev" && item.flashRev && isLastSubQuestion) {
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
    if (changed) onCommitVerbs?.(updated);
  };

  // Moves to the next question (or finishes the quiz)
  const goToNextQuestion = (finalScore) => {
    setQuizAnswerState("idle");
    setQuizFeedback(null);
    setQuizSessionKey((k) => k + 1);
    setQuizTextInput("");

    if (quizIndex < quizList.length - 1) {
      setQuizIndex((prev) => prev + 1);
    } else {
      setTimerRunning(false);
      setIsQuizActive(false);
      setTimeLeft(null);
      openResultModal("finish", finalScore, quizList.length);
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

  // Shuffle handlers
  const handleShuffleList = () => {
    if (list.length <= 1) return;
    onCommitVerbs?.(shuffleArray(list));
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

  // Pale green / red panel tint while answering
  const resultPct = scoreModal.total > 0 ? (scoreModal.score / scoreModal.total) * 100 : 0;
  const resultPassed = resultPct >= PASS_PERCENT;
  const resultTheme =
    scoreModal.reason === "timeup"
      ? {
          gif: alertGif, color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5",
          badge: "⏰ Time Is Up!", title: "Time's Expired!",
          text: "The countdown clock reached zero. Here is how you did:",
        }
      : resultPassed
      ? {
          gif: successGif, color: "#166534", bg: "#dcfce7", border: "#86efac",
          badge: "🎉 Quiz Passed!", title: "Great Job!",
          text: `You reached the ${PASS_PERCENT}% pass mark. Well done!`,
        }
      : {
          gif: alertGif, color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5",
          badge: "📚 Keep Practicing", title: "Not Quite There Yet",
          text: `You need at least ${PASS_PERCENT}% to pass. Review the verbs and try again.`,
        };

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

  const verbQuizWord = quizList[quizIndex];
  const effectiveVerbMode = quizMode === "flashrev"
    ? getVerbFlashRevMode(verbQuizWord, quizIndex % VERB_FLASHREV_STEPS)
    : quizMode;
  const flashRevCount = list.filter((v) => v.flashRev).length;
  const flashRevUniqueWords = quizMode === "flashrev" ? quizList.length / VERB_FLASHREV_STEPS : quizList.length;

  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          <div className="stats-grid">
            <div className="stat dark">
              <div className="stat-head">
                <span className="stat-label">TOTAL VERBS</span>
                <span className="stat-pill dark">{verbsMastered} mastered</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value">{list.length}</span>
                <span className="stat-note" style={{ color: "#a8a29e" }}>all cases</span>
              </div>
            </div>

            <div className="stat">
              <div className="stat-head"><span className="stat-label">DATIV</span><span className="stat-pill bg-dativ">Dativ</span></div>
              <div className="stat-foot"><span className="stat-value c-dativ">{countVerb("Dativ")}</span></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">AKKUSATIV</span><span className="stat-pill bg-akku">Akkusativ</span></div>
              <div className="stat-foot"><span className="stat-value c-akku">{countVerb("Akkusativ")}</span></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">BOTH / COMMON</span><span className="stat-pill bg-both">Both</span></div>
              <div className="stat-foot"><span className="stat-value c-both">{countVerb("Both / Common")}</span></div>
            </div>
          </div>

          <div className="toolbar">
            <div className="search">
              <span>🔍</span>
              <input
                type="search"
                placeholder="Search verb, past forms, meaning..."
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
                  value={verbFilter}
                  options={CASE_OPTIONS}
                  onChange={(val) => setVerbFilter(val)}
                />
              </div>

              <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                <CustomDropdown
                  icon="📌"
                  value={verbStatusFilter}
                  options={STATUS_FILTER_OPTIONS}
                  onChange={(val) => setVerbStatusFilter(val)}
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
                title="Toggle Hourly Verb Notification"
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                {hourlyAlertsActive ? "🔔 Alerts On" : "🔕 Alerts Off"}
              </button>

              <button
                type="button"
                onClick={handleTestNotification}
                className="btn btn-secondary"
                title="Send a verb notification now"
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
                title="Reset all verbs"
              >
                🔄 Reset
              </button>
            </div>
          </div>

          {filteredVerbs.length === 0 ? (
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
                style={{
                  width: "200px",
                  maxWidth: "80%",
                  height: "auto",
                  objectFit: "contain",
                  marginBottom: "16px",
                  opacity: 0.9,
                }}
              />
              <h3 style={{ margin: "0 0 8px", fontSize: "19px", fontWeight: 700, color: "var(--ink)" }}>
                No Verbs Found
              </h3>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)", maxWidth: "340px", lineHeight: 1.5 }}>
                {search || verbFilter !== "all" || verbStatusFilter !== "all" || dateFilter !== "all"
                  ? "We couldn't find any verbs matching your current filters. Try changing or clearing them."
                  : "You haven't added any verbs yet. Add your first German verb to get started!"}
              </p>
              {search || verbFilter !== "all" || verbStatusFilter !== "all" || dateFilter !== "all" ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: "16px" }}
                  onClick={() => {
                    setSearch("");
                    setVerbFilter("all");
                    setVerbStatusFilter("all");
                    setDateFilter("all");
                    setCustomDate("");
                  }}
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: "16px" }}
                  onClick={openAddModal}
                >
                  + Add First Verb
                </button>
              )}
            </div>
          ) : (
            <div className="list">
              <div className="list-head verbs-head">
                <span style={{ textAlign: "center" }}>#</span>
                <span>CASE</span>
                <span>INFINITIVE</span>
                <span>PAST (PRÄT / PART II)</span>
                <span>MEANING</span>
                <span>EXAMPLE SENTENCE</span>
                <span>STATUS</span>
                <span style={{ textAlign: "right" }}>ACTIONS</span>
              </div>
              {filteredVerbs.map((item, index) => (
                <div className={`row verb-row ${item.caseType === "Both / Common" ? "Both" : item.caseType}`} key={item.id}>
                  <div className="c-idx">{index + 1}</div>
                  <div className="c-case">
                    <span className={`pill ${VERB_CASE_CLASS[item.caseType] || "bg-both"}`}>
                      {item.caseType}
                    </span>
                  </div>
                  <div className="c-verb" style={{ fontWeight: 700 }}>{item.verb}</div>
                  <div className="c-past">{item.preterite || "—"} / {item.participle || "—"}</div>
                  <div className="c-mean">{item.meaning}</div>
                  <div className="c-eg">{item.example || "—"}</div>
                  <div className="c-status">
                    <button
                      onClick={() => toggleStatus(item.id)}
                      className={`status ${item.status === "Mastered" ? "done" : "todo"}`}
                    >
                      {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                    </button>
                  </div>
                  <div className="actions">
                    <button onClick={() => speakGerman(`${item.verb}. ${item.preterite || ""}. ${item.participle || ""}. ${item.example || ""}`)} className="icon-btn">🔊</button>
                    <button onClick={() => openEditModal(item)} className="icon-btn">✏️</button>
                    <button
                      onClick={() =>
                        onRequestConfirm?.("Delete Verb", `Are you sure you want to delete the verb "${item.verb}"?`, () =>
                          onCommitVerbs?.(list.filter((i) => i.id !== item.id))
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

      {/* Floating Add Button */}
      {viewMode === "list" && (
        <button
          onClick={openAddModal}
          className="fab-btn"
          title="Add Verb"
          aria-label="Add Verb"
        >
          +
        </button>
      )}

      {viewMode === "flashcards" && (
        <div className="panel">
          {!verbCard ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 16px",
              }}
            >
              <img
                src={noDataImg}
                alt="No Data"
                style={{ width: "160px", maxWidth: "80%", height: "auto", marginBottom: "12px" }}
              />
              <p style={{ color: "var(--muted)", margin: 0 }}>No verbs available for flashcards.</p>
            </div>
          ) : (
            <div className="flash-wrap">
              <div className="flash" onClick={handleFlipCard}>
                {!cardFlipped ? (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>RECALL CASE &amp; PAST TENSE FORMS</span>
                    <h2>{verbCard.verb}</h2>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                  </>
                ) : (
                  <>
                    <span className={`pill ${VERB_CASE_CLASS[verbCard.caseType] || "bg-both"}`} style={{ fontSize: 20, padding: "6px 20px" }}>
                      {verbCard.caseType}
                    </span>
                    <p style={{ margin: "14px 0 4px", fontSize: 18, fontWeight: 700, color: "var(--brand)" }}>
                      Präteritum: {verbCard.preterite || "—"} | Partizip II: {verbCard.participle || "—"}
                    </p>
                    <h3 style={{ fontSize: 22, margin: "6px 0", color: "var(--ink-2)" }}>{verbCard.meaning}</h3>
                    {verbCard.example && <p style={{ color: "var(--muted)", margin: 0, fontSize: 14, fontStyle: "italic" }}>"{verbCard.example}"</p>}
                  </>
                )}
              </div>
              <div className="flash-controls" onTouchStart={handleFlashTouchStart} onTouchEnd={handleFlashTouchEnd} style={{touchAction:"pan-y"}}>
                <button className="btn btn-secondary flash-nav-btn" disabled={cardIndex === 0} onClick={handleFlashPrevious}>◀ Previous</button>
                <button className="btn btn-secondary mid" onClick={() => speakGerman(`${verbCard.verb}. ${verbCard.preterite || ""}. ${verbCard.participle || ""}.`)}>🔊 Pronounce</button>
                <button className="btn btn-secondary flash-nav-btn" disabled={cardIndex >= flashList.length - 1} onClick={handleFlashNext}>Next ▶</button>
              </div>
              <span style={{color:"var(--muted)",fontSize:13}}>Verb {cardIndex + 1} of {flashList.length} · {Math.round(((cardIndex + 1) / Math.max(flashList.length, 1)) * 100)}% · {flashRevCount} queued for FlashRev</span>
              <div style={{width:"100%",maxWidth:520,height:6,background:"#eee7df",borderRadius:999,overflow:"hidden",marginTop:8}}>
                <div style={{width:`${Math.round(((cardIndex + 1) / Math.max(flashList.length, 1)) * 100)}%`,height:"100%",background:"var(--brand,#b85c19)",borderRadius:999,transition:"width .2s ease"}} />
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === "quiz" && (
        <div className="panel" style={getQuizPanelStyle()}>
          {/* QUIZ TOOLBAR */}
          <div
            className="quiz-controls-row"
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              alignItems: "center",
              justifyContent: isQuizActive ? "center" : "flex-start",
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
            {!isQuizActive ? (
              <>
                {/* 1. Quiz Mode Dropdown (Case, Präteritum, Partizip II, Infinitive) */}
                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <CustomDropdown
                    icon="🎯"
                    value={quizMode}
                    options={QUIZ_MODE_OPTIONS}
                    onChange={(val) => {
                      setQuizMode(val);
                      resetQuizProgress();
                    }}
                  />
                </div>

                {/* 2. Status Dropdown */}
                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <CustomDropdown
                    icon="📌"
                    value={quizStatusFilter}
                    options={STATUS_FILTER_OPTIONS}
                    onChange={handleQuizStatusChange}
                  />
                </div>

                {/* 3. Date Filter Dropdown */}
                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <CustomDropdown
                    icon="📅"
                    value={quizDateMode}
                    options={QUIZ_DATE_DROPDOWN_OPTIONS}
                    onChange={handleQuizDateModeChange}
                  />
                </div>

                {/* 4. Real Calendar Picker */}
                {quizDateMode === "specific" && (
                  <RealCalendarPicker
                    selectedDate={quizSpecificDate}
                    onSelectDate={handleQuizCalendarDateSelect}
                  />
                )}

                {/* 5. Count Limit Pill */}
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
                    boxSizing: "border-box",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>🔢</span>
                  <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--ink, #1f2937)" }}>{quizMode === "flashrev" ? "Words:" : "Count:"}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={availableQuizPool.length ? `${availableQuizPool.length}` : "All"}
                    value={wordCountInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setWordCountInput(val);
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

                {/* 6. Set Timer Setup Pill */}
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
                    boxSizing: "border-box",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>⏱</span>
                  <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--ink, #1f2937)" }}>Timer:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="30"
                    value={timerInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setTimerInput(val);
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
                  <span style={{ fontSize: "12px", color: "var(--muted)", marginRight: 2 }}>s</span>

                  <button
                    type="button"
                    onClick={handleStartTimer}
                    title="Start Timer"
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
                      padding: 0,
                    }}
                  >
                    ▶
                  </button>
                </div>

                {/* Quiz Pool Count */}
                <div style={{ flexShrink: 0, fontSize: "13.5px", color: "var(--muted)", whiteSpace: "nowrap", paddingLeft: "4px" }}>
                  {quizMode === "flashrev" ? (
                    <>
                      Words: <strong style={{ color: "var(--ink)" }}>{flashRevUniqueWords}</strong>
                      <span style={{ color: "var(--faint)", fontSize: 12 }}> ×{VERB_FLASHREV_STEPS}Q</span>
                    </>
                  ) : (
                    <>Words: <strong style={{ color: "var(--ink)" }}>{quizList.length}</strong></>
                  )}
                </div>

                {/* Clear Filters */}
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
                    style={{
                      flexShrink: 0,
                      padding: "0 12px",
                      fontSize: "12.5px",
                      whiteSpace: "nowrap",
                      height: "40px",
                      borderRadius: "12px",
                    }}
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
                  backgroundColor: !timerRunning ? "#fffbeb" : timeLeft <= 5 ? "#fef2f2" : "#f0fdf4",
                  border: `1.5px solid ${!timerRunning ? "#fde68a" : timeLeft <= 5 ? "#f87171" : "#86efac"}`,
                  padding: "0 12px 0 16px",
                  borderRadius: "14px",
                  height: "44px",
                  boxSizing: "border-box",
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                }}
              >
                <span style={{ fontSize: "16px" }}>{!timerRunning ? "⏸️" : timeLeft <= 5 ? "🔥" : "⏳"}</span>
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: !timerRunning ? "#b45309" : timeLeft <= 5 ? "#dc2626" : "#15803d",
                    letterSpacing: "0.02em",
                  }}
                >
                  {timeLeft}s remaining
                </span>

                <button
                  type="button"
                  onClick={handleToggleTimer}
                  title={timerRunning ? "Pause Timer" : "Resume Timer"}
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    border: "1px solid #fca5a5",
                    backgroundColor: "#ffffff",
                    color: timerRunning ? "#dc2626" : "#15803d",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    marginLeft: "4px",
                  }}
                >
                  {timerRunning ? "⏸" : "▶"}
                </button>

                <button
                  type="button"
                  onClick={handleSubmitQuiz}
                  title="Submit Quiz"
                  aria-label="Submit Quiz"
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    border: "1px solid #fca5a5",
                    backgroundColor: "#ffffff",
                    color: "#dc2626",
                    fontSize: "16px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    marginLeft: "4px",
                  }}
                >
                  ✓
                </button>
              </div>
            )}
          </div>

          {!verbQuizWord ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "36px 16px",
                textAlign: "center",
              }}
            >
              <img
                src={noDataImg}
                alt="No Data"
                style={{ width: "160px", maxWidth: "80%", height: "auto", marginBottom: "12px" }}
              />
              <p style={{ color: "var(--muted)", margin: "0 0 12px 0", fontSize: 15 }}>
                {list.length === 0
                  ? "Add verbs to start quiz."
                  : "No verbs match the selected status, date, or count filters."}
              </p>
              {(quizStatusFilter !== "all" || quizDateMode !== "all" || quizSpecificDate || wordCountInput) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setQuizStatusFilter("all");
                    setQuizDateMode("all");
                    setQuizSpecificDate("");
                    setWordCountInput("");
                    resetQuizProgress();
                  }}
                >
                  Reset Quiz Filters
                </button>
              )}
            </div>
          ) : (
            <div
              className="quiz"
              style={{
                position: "relative",
                opacity: timerExpired ? 0.55 : 1,
                pointerEvents: timerExpired ? "none" : "auto",
                filter: timerExpired ? "grayscale(0.5)" : "none",
                transition: "opacity 0.2s ease, filter 0.2s ease",
              }}
            >
              <style>{`
                .quiz-submit-btn{height:45px;padding:0 14px;border:none;border-radius:999px;background:var(--brand,#b85c19);color:#fff;font-weight:800;cursor:pointer}
                .flashrev-dots{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 0 10px}
                .flashrev-dot{width:8px;height:8px;border-radius:50%;background:#e2e8f0}
                .flashrev-dot.active{background:var(--brand,#b85c19);transform:scale(1.3)}
                .flashrev-dot.done{background:#86efac}
                @media(max-width:768px){.flash-controls .flash-nav-btn{display:none!important}}
              `}</style>
              <div className="quiz-head">
                <span>
                  {quizMode === "flashrev"
                    ? <>Word {Math.floor(quizIndex / VERB_FLASHREV_STEPS) + 1} of {flashRevUniqueWords}<span style={{color:"var(--muted)",fontWeight:500}}> · Q{(quizIndex % VERB_FLASHREV_STEPS)+1}/{VERB_FLASHREV_STEPS}</span></>
                    : <>Question {quizIndex + 1} of {quizList.length}</>}
                </span>
                <span style={{fontWeight:700,color:"var(--brand)"}}>Score: {quizScore}</span>
              </div>

              {quizMode === "flashrev" && (
                <div className="flashrev-dots">
                  {Array.from({length:VERB_FLASHREV_STEPS}).map((_,i)=>(
                    <span key={i} className={`flashrev-dot ${i < quizIndex % VERB_FLASHREV_STEPS ? "done" : i === quizIndex % VERB_FLASHREV_STEPS ? "active" : ""}`} />
                  ))}
                  <span style={{fontSize:12,color:"var(--muted)",marginLeft:6}}>
                    {["Case","Präteritum","Partizip II","Meaning"][quizIndex % VERB_FLASHREV_STEPS]}
                  </span>
                </div>
              )}

              <div className="quiz-card">
                {effectiveVerbMode === "case" && (
                  <>
                    <span style={{fontSize:13,color:"var(--muted)",fontWeight:500}}>Choose the correct case:</span>
                    <h1>{verbQuizWord.verb}</h1>
                    <p style={{color:"var(--muted)",margin:0,fontSize:15}}>Meaning: <strong>{verbQuizWord.meaning}</strong></p>
                  </>
                )}
                {effectiveVerbMode === "preterite" && <><span style={{fontSize:13,color:"var(--muted)",fontWeight:500}}>Type the Präteritum:</span><h1>{verbQuizWord.verb}</h1></>}
                {effectiveVerbMode === "participle" && <><span style={{fontSize:13,color:"var(--muted)",fontWeight:500}}>Type Partizip II:</span><h1>{verbQuizWord.verb}</h1></>}
                {effectiveVerbMode === "infinitive" && <><span style={{fontSize:13,color:"var(--muted)",fontWeight:500}}>Type the infinitive:</span><h1>{verbQuizWord.meaning}</h1></>}
                {effectiveVerbMode === "meaning" && <><span style={{fontSize:13,color:"var(--muted)",fontWeight:500}}>Type the English meaning:</span><h1>{verbQuizWord.verb}</h1></>}
              </div>

              {effectiveVerbMode === "case" ? (
                <div style={{width:"100%",maxWidth:600,margin:"24px auto 0",display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14}}>
                  {["Dativ","Akkusativ","Both / Common"].map((caseOption)=>(
                    <button key={caseOption} type="button" disabled={quizAnswerState !== "idle"} onClick={()=>handleQuizCaseSelect(caseOption)} style={{minHeight:45,height:45,padding:"0 10px",borderRadius:12,border:"none",background:caseOption==="Dativ"?"#0878b5":caseOption==="Akkusativ"?"#c8103d":"#16843d",color:"#fff",fontSize:14,fontWeight:800,cursor:quizAnswerState!=="idle"?"not-allowed":"pointer",opacity:quizAnswerState!=="idle"?0.72:1}}>
                      {caseOption}
                    </button>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleQuizTextSubmit} style={{marginTop:18,display:"flex",gap:8,width:"100%",maxWidth:420,marginInline:"auto"}}>
                  <input autoFocus disabled={quizAnswerState !== "idle"} value={quizTextInput} onChange={(e)=>setQuizTextInput(e.target.value)} className="modal-input" placeholder={effectiveVerbMode==="meaning"?"Type English meaning...":effectiveVerbMode==="infinitive"?"Type infinitive...":effectiveVerbMode==="preterite"?"Type Präteritum...":"Type Partizip II..."} style={{flex:1,height:46,fontSize:16,fontWeight:600,borderRadius:12,padding:"0 14px"}} />
                  <button type="submit" disabled={quizAnswerState !== "idle" || !quizTextInput.trim()} className="btn btn-primary" style={{height:46,padding:"0 18px",borderRadius:12}}>Check</button>
                </form>
              )}

              {quizFeedback && (
  <div style={{ marginTop: 20, textAlign: "center" }}>
    <p
      style={{
        fontSize: 16,
        fontWeight: 700,
        color: quizAnswerState === "correct" ? "#15803d" : "#dc2626",
      }}
    >
      {quizFeedback}
    </p>

    {quizAnswerState === "correct" && (
      <span
        style={{
          fontSize: 12,
          color: "var(--muted)",
        }}
      >
        Moving to next question in 1 second...
      </span>
    )}

    {quizAnswerState === "wrong" && (
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleForwardClick}
        style={{
          width: 100,
          height: 20,
          padding: 0,
          borderRadius: 14,
          fontSize: 14,
          fontWeight: 600,
          marginTop: 8,
        }}
      >
        Next
      </button>
    )}
  </div>
)}
              <div style={{display:"flex",justifyContent:"center",marginTop:20}}>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🏆 Quiz Results & Time-Up Modal */}
      {scoreModal.isOpen && (
        <div
          className="overlay"
          style={{ zIndex: 1300 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setScoreModal((p) => ({ ...p, isOpen: false }));
            }
          }}
        >
          <div
            className="modal"
            style={{
              textAlign: "center",
              maxWidth: 360,
              padding: "26px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              borderRadius: "20px",
              animation: "fadeIn 0.2s ease-in-out",
            }}
          >
            <img
              src={resultTheme.gif}
              alt="Quiz Results"
              style={{ width: 95, height: 95, objectFit: "contain", marginBottom: 12 }}
            />

            <span
              style={{
                fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
                color: resultTheme.color, backgroundColor: resultTheme.bg,
                border: `1px solid ${resultTheme.border}`,
                padding: "4px 12px", borderRadius: 20, marginBottom: 8, textTransform: "uppercase",
              }}
            >
              {resultTheme.badge}
            </span>

            <h3 style={{ margin: "4px 0 6px", fontSize: 22, color: "var(--ink)" }}>
              {resultTheme.title}
            </h3>

            <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: 14 }}>
              {resultTheme.text}
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                width: "100%",
                marginBottom: "18px",
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: "12px 6px",
                  borderRadius: "12px",
                  backgroundColor: "#f7f2ed",
                  border: "1px solid #ebdccb",
                }}
              >
                <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--brand, #b85c19)" }}>
                  {scoreModal.score} / {scoreModal.total}
                </div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginTop: 2, textTransform: "uppercase" }}>
                  Score
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  padding: "12px 6px",
                  borderRadius: "12px",
                  backgroundColor: "#f7f2ed",
                  border: "1px solid #ebdccb",
                }}
              >
                <div style={{ fontSize: "26px", fontWeight: 800, color: resultPassed ? "#166534" : "#b91c1c" }}>
                  {scoreModal.total > 0 ? Math.round(resultPct) : 0}%
                </div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginTop: 2, textTransform: "uppercase" }}>
                  Accuracy
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", width: "100%" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={closeScoreModal}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => {
                  stopGoalAchievedMusic();
                  setScoreModal((p) => ({ ...p, isOpen: false }));
                  handleShuffleQuiz();
                  const parsed = parseInt(timerInput, 10);
                  if (!isNaN(parsed) && parsed > 0) {
                    setTimerExpired(false);
                    setTimeLeft(parsed);
                    setTimerRunning(true);
                    setIsQuizActive(true);
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
        defaultCategory="Verbs"
        categoryStats={{
          Verbs: {
            dailyCurrent: verbDailyCount,
            weeklyCurrent: verbWeeklyCount,
          },
        }}
        initialDailyTarget={verbDailyTarget}
        initialWeeklyTarget={verbWeeklyTarget}
      />

      {/* Add / Edit Verb Modal */}
      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>{editingVerbId ? "Edit Verb" : "Add New Verb"}</h3>
            <form onSubmit={handleSaveModal}>
              <div>
                <label className="modal-label">Grammatical Case</label>
                <div className="radios">
                  {["Dativ", "Akkusativ", "Both / Common"].map((c) => (
                    <label key={c} className={`radio ${verbFormData.caseType === c ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="caseType"
                        value={c}
                        checked={verbFormData.caseType === c}
                        onChange={(e) => setVerbFormData({ ...verbFormData, caseType: e.target.value })}
                      />
                      {c === "Both / Common" ? "Both" : c}
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
                    placeholder="e.g. to help"
                    value={verbFormData.meaning}
                    onChange={(e) => {
                      setAiError("");
                      setVerbFormData({ ...verbFormData, meaning: e.target.value });
                    }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={generateGermanVerb} disabled={aiLoading}>
                    {aiLoading ? "Generating..." : "✨ Generate"}
                  </button>
                </div>
                {aiError && <p style={{ color: "#dc2626", fontSize: 13, margin: "6px 0 0" }}>{aiError}</p>}
              </div>

              <div>
                <label className="modal-label">Infinitive Verb</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. helfen"
                  value={verbFormData.verb}
                  onChange={(e) => setVerbFormData({ ...verbFormData, verb: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="modal-label">Präteritum (Simple Past)</label>
                  <input
                    className="modal-input"
                    type="text"
                    placeholder="e.g. half"
                    value={verbFormData.preterite}
                    onChange={(e) => setVerbFormData({ ...verbFormData, preterite: e.target.value })}
                  />
                </div>
                <div>
                  <label className="modal-label">Partizip II (Past Participle)</label>
                  <input
                    className="modal-input"
                    type="text"
                    placeholder="e.g. geholfen"
                    value={verbFormData.participle}
                    onChange={(e) => setVerbFormData({ ...verbFormData, participle: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="modal-label">Example Sentence</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. Ich helfe dir."
                  value={verbFormData.example}
                  onChange={(e) => setVerbFormData({ ...verbFormData, example: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Status</label>
                <CustomDropdown
                  fullWidth
                  value={verbFormData.status}
                  options={STATUS_OPTIONS}
                  onChange={(val) => setVerbFormData({ ...verbFormData, status: val })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Verb
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {resetModalOpen && (
        <div
          className="overlay"
          style={{ zIndex: 1200 }}
          onClick={(e) => e.target === e.currentTarget && setResetModalOpen(false)}
        >
          <div
            className="modal"
            style={{
              textAlign: "center",
              maxWidth: 360,
              padding: "24px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              animation: "fadeIn 0.2s ease-in-out",
            }}
          >
            <img
              src={warningRedGif}
              alt="Warning"
              style={{
                width: 90,
                height: 90,
                objectFit: "contain",
                marginBottom: 16,
              }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#dc2626" }}>
              Reset All Verbs?
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              Are you sure you want to delete all verbs? This action will permanently remove your entire verb list and cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setResetModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  backgroundColor: "#dc2626",
                  borderColor: "#dc2626",
                  color: "#ffffff",
                }}
                onClick={handleConfirmReset}
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Word Alert Modal */}
      {duplicateModalOpen && (
        <div
          className="overlay"
          style={{ zIndex: 1200 }}
          onClick={(e) => e.target === e.currentTarget && setDuplicateModalOpen(false)}
        >
          <div
            className="modal"
            style={{
              textAlign: "center",
              maxWidth: 360,
              padding: "24px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <img
              src={alertGif}
              alt="Alert"
              style={{
                width: 100,
                height: 100,
                objectFit: "contain",
                marginBottom: 16,
              }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--ink)" }}>Verb Already Exists!</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{duplicateWordName}"</strong> is already in your verb list.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setDuplicateModalOpen(false)}
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Goal Reached Celebration Modal */}
      {goalCelebration.isOpen && (
        <div
          className="overlay"
          style={{ zIndex: 1300 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              stopGoalAchievedMusic();
              setGoalCelebration((p) => ({ ...p, isOpen: false }));
            }
          }}
        >
          <div
            className="modal"
            style={{
              textAlign: "center",
              maxWidth: 380,
              padding: "28px 22px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              borderRadius: 20,
              border: "1px solid #ebdccb",
              boxShadow: "0 16px 36px rgba(0, 0, 0, 0.18)",
              animation: "fadeIn 0.22s ease-out",
            }}
          >
            <img
              src={congratsGif}
              alt="Celebration Congrats"
              style={{
                width: 105,
                height: 105,
                objectFit: "contain",
                marginBottom: 12,
              }}
            />

            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: "#b85c19",
                backgroundColor: "#fef3c7",
                border: "1px solid #fde68a",
                padding: "4px 12px",
                borderRadius: 20,
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              {goalCelebration.goalType === "daily" ? "🎯 Daily Goal Achieved!" : "🏆 Weekly Goal Achieved!"}
            </span>

            <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "var(--ink, #1e1e1e)" }}>
              Herzlichen Glückwunsch!
            </h3>

            <p style={{ color: "var(--muted, #6b7280)", margin: "0 0 16px", fontSize: 14, lineHeight: 1.55 }}>
              {goalCelebration.goalType === "daily" ? (
                <>
                  You reached your daily goal of{" "}
                  <strong style={{ color: "#b85c19" }}>{goalCelebration.target} verbs</strong>!
                </>
              ) : (
                <>
                  Phenomenal work! You hit your weekly goal of{" "}
                  <strong style={{ color: "#b85c19" }}>{goalCelebration.target} verbs</strong>!
                </>
              )}
            </p>

            {goalCelebration.addedWord && (
              <div
                style={{
                  fontSize: 12.5,
                  color: "#166534",
                  backgroundColor: "#dcfce7",
                  border: "1px solid #86efac",
                  padding: "6px 14px",
                  borderRadius: 10,
                  marginBottom: 18,
                  fontWeight: 600,
                }}
              >
                Added: <strong>"{goalCelebration.addedWord}"</strong>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "12px 18px",
                fontSize: 14.5,
                fontWeight: 700,
                backgroundColor: "#b85c19",
                borderColor: "#b85c19",
              }}
              onClick={() => {
                stopGoalAchievedMusic();
                setGoalCelebration((p) => ({ ...p, isOpen: false }));
              }}
            >
              Awesome, Keep Going! 🚀
            </button>
          </div>
        </div>
      )}

      {/* Regular Success Modal */}
      {successModalOpen && (
        <div
          className="overlay"
          style={{ zIndex: 1200 }}
          onClick={(e) => e.target === e.currentTarget && setSuccessModalOpen(false)}
        >
          <div
            className="modal"
            style={{
              textAlign: "center",
              maxWidth: 360,
              padding: "24px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              animation: "fadeIn 0.2s ease-in-out",
            }}
          >
            <img
              src={successGif}
              alt="Success"
              style={{
                width: 100,
                height: 100,
                objectFit: "contain",
                marginBottom: 16,
              }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--brand, #16a34a)" }}>
              {successWordInfo.isEdit ? "Verb Updated!" : "Verb Added Successfully!"}
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{successWordInfo.verb}" ({successWordInfo.caseType})</strong> has been saved to your vocabulary.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setSuccessModalOpen(false)}
            >
              Great! 🎉
            </button>
          </div>
        </div>
      )}

      {/* Import Summary Modal */}
      {importSummary && (
        <div
          className="overlay"
          style={{ zIndex: 1200 }}
          onClick={(e) => e.target === e.currentTarget && setImportSummary(null)}
        >
          <div
            className="modal"
            style={{
              textAlign: "center",
              maxWidth: 380,
              padding: "24px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 20, color: "var(--ink)" }}>
              Import Summary
            </h3>

            <div
              style={{
                display: "flex",
                gap: 12,
                width: "100%",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  borderRadius: 10,
                  backgroundColor: "#dcfce7",
                  border: "1px solid #86efac",
                  color: "#166534",
                  fontWeight: 700,
                }}
              >
                <div style={{ fontSize: 28, lineHeight: 1.1 }}>{importSummary.added}</div>
                <div style={{ fontSize: 12, textTransform: "uppercase", marginTop: 4, letterSpacing: 0.5 }}>
                  Added
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  borderRadius: 10,
                  backgroundColor: "#fef9c3",
                  border: "1px solid #fde047",
                  color: "#854d0e",
                  fontWeight: 700,
                }}
              >
                <div style={{ fontSize: 28, lineHeight: 1.1 }}>{importSummary.duplicates}</div>
                <div style={{ fontSize: 12, textTransform: "uppercase", marginTop: 4, letterSpacing: 0.5 }}>
                  Duplicates
                </div>
              </div>
            </div>

            {importSummary.duplicateWords.length > 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: "#854d0e",
                  backgroundColor: "#fefce8",
                  border: "1px dashed #facc15",
                  borderRadius: 6,
                  padding: "8px 12px",
                  width: "100%",
                  boxSizing: "border-box",
                  maxHeight: 90,
                  overflowY: "auto",
                  marginBottom: 16,
                  textAlign: "left",
                }}
              >
                <strong>Skipped words:</strong>{" "}
                {importSummary.duplicateWords.slice(0, 8).join(", ")}
                {importSummary.duplicateWords.length > 8 &&
                  ` and ${importSummary.duplicateWords.length - 8} more...`}
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setImportSummary(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}