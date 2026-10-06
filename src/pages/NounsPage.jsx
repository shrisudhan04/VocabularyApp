import { useState, useRef, useEffect, useMemo } from "react";
import {
  requestMobileNotificationPermission,
  startHourlyNounNotifier,
  sendNounNotification,
} from "../utils/hourlyWordNotifier";
import * as XLSX from "xlsx";
import CustomDropdown from "../components/CustomDropdown";
import GoalModal from "../components/GoalModal";
import { ARTICLE_CLASS, STATUS_OPTIONS, GENDER_MAP } from "../constants/seedData";
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
    [arr[j], arr[i]] = [arr[j], arr[i]];
  }
  return arr;
};

// A quiz needs at least this percentage to count as passed
const PASS_PERCENT = 70;

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

const FLASHREV_ROTATION = ["article", "plural", "english"];
const FLASHREV_STEPS = 3;

const getFlashRevMode = (word, subIndex) => {
  const available = FLASHREV_ROTATION.filter(
    (m) =>
      m === "article" ||
      (m === "plural" && Boolean(word?.plural)) ||
      (m === "english" && Boolean(word?.meaning))
  );
  return available[subIndex % available.length];
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

const GENDER_OPTIONS = [
  { label: "All Genders", value: "all" },
  { label: "der (Masculine)", value: "der" },
  { label: "die (Feminine)", value: "die" },
  { label: "das (Neuter)", value: "das" },
];

const STATUS_FILTER_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "In Progress", value: "In Progress" },
  { label: "Mastered", value: "Mastered" },
  { label: "Forgot", value: "Forgot" },
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
  { label: "Article", value: "article" },
  { label: "English ➔ Noun", value: "english" },
  { label: "Plural Form", value: "plural" },
  { label: "FlashRev", value: "flashrev" },
];

const EXCEL_ACTIONS = [
  { label: "Excel Actions", value: "" },
  { label: "📥 Import", value: "import" },
  { label: "📤 Export", value: "export" },
];

const EMPTY_FORM = {
  noun: "",
  plural: "",
  article: "der",
  meaning: "",
  status: "In Progress",
};

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

export default function NounsPage({
  viewMode = "list",
  vocabList = [],
  onCommitNouns,
  onRequestConfirm,
}) {
  const list = Array.isArray(vocabList) ? vocabList : [];

  const [search, setSearch] = useState("");
  const [articleFilter, setArticleFilter] = useState("all");
  const [nounStatusFilter, setNounStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  // Quiz Filters & Mode
  const [quizStatusFilter, setQuizStatusFilter] = useState("all");
  const [quizDateMode, setQuizDateMode] = useState("all");
  const [quizSpecificDate, setQuizSpecificDate] = useState("");
  const [quizMode, setQuizMode] = useState("article");
  const [quizTextInput, setQuizTextInput] = useState("");
  const [quizSelectedArticle, setQuizSelectedArticle] = useState("");

  // Quiz Controls: Question Count Limit & Timer
  const [wordCountInput, setWordCountInput] = useState("");
  const [timerInput, setTimerInput] = useState("30");
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  // Keeps the active quiz banner UI displayed even when paused
  const [isQuizActive, setIsQuizActive] = useState(false);

  // Shuffle seed for quiz ordering
  const [quizShuffleKey, setQuizShuffleKey] = useState(0);
  const [quizSessionKey, setQuizSessionKey] = useState(0);

  // Quiz Progress & Auto-Advance Transition State
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [quizAnswerState, setQuizAnswerState] = useState("idle");

  const autoNextTimeoutRef = useRef(null);

  // Quiz Completion & Score Modal
  const [scoreModal, setScoreModal] = useState({
    isOpen: false,
    reason: "finish",
    score: 0,
    total: 0,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingNounId, setEditingNounId] = useState(null);
  const [nounFormData, setNounFormData] = useState(EMPTY_FORM);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateWordName, setDuplicateWordName] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successWordInfo, setSuccessWordInfo] = useState({ article: "", noun: "", isEdit: false });
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

  useEffect(() => {
    return () => {
      if (autoNextTimeoutRef.current) {
        clearTimeout(autoNextTimeoutRef.current);
      }
    };
  }, []);

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

  const hasNouns = list.length > 0;
  const quizSessionIds = useMemo(() => {
    const filtered = list.filter((item) => {
      const itemStatus = item.status || "In Progress";
      const matchesStatus = quizStatusFilter === "all" || itemStatus === quizStatusFilter;
      const matchesDate = matchesDateFilter(item.createdAt, quizDateMode, quizSpecificDate);
      const matchesMode = quizMode !== "flashrev" || Boolean(item.flashRev);
      return matchesStatus && matchesDate && matchesMode;
    });
    const ordered = quizShuffleKey > 0 ? shuffleArray(filtered) : filtered;

    if (quizMode === "flashrev") {
      return ordered.flatMap((item) => Array(FLASHREV_STEPS).fill(item.id));
    }
    return ordered.map((item) => item.id);
  }, [hasNouns, viewMode, quizMode, quizStatusFilter, quizDateMode, quizSpecificDate, quizShuffleKey, quizSessionKey]);

  const availableQuizPool = useMemo(() => {
    const byId = new Map(list.map((item) => [item.id, item]));
    return quizSessionIds.map((id) => byId.get(id)).filter(Boolean);
  }, [list, quizSessionIds]);

  const flashList = useMemo(() => {
    if (!flashOrder) return list;
    const byId = new Map(list.map((item) => [item.id, item]));
    const ordered = flashOrder.map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(flashOrder);
    return [...ordered, ...list.filter((item) => !seen.has(item.id))];
  }, [list, flashOrder]);

  const quizList = useMemo(() => {
    if (quizMode === "flashrev") {
      const count = parseInt(wordCountInput, 10);
      if (!isNaN(count) && count > 0) {
        const maxSlots = count * FLASHREV_STEPS;
        return availableQuizPool.slice(0, maxSlots);
      }
      return availableQuizPool;
    }
    const count = parseInt(wordCountInput, 10);
    if (!isNaN(count) && count > 0) {
      return availableQuizPool.slice(0, count);
    }
    return availableQuizPool;
  }, [availableQuizPool, wordCountInput, quizMode]);

  // Countdown Timer
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
      // ⏸ Pause: stop ticking, keep remaining time intact, stay in active quiz banner
      setTimerRunning(false);
      return;
    }

    // ▶ Resume: continue ticking with same time left
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
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
    }
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback(null);
    setQuizAnswerState("idle");
    setQuizTextInput("");
    setQuizSelectedArticle("");
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

  const handleShuffleList = () => {
    if (list.length <= 1) return;
    const shuffled = shuffleArray(list);
    onCommitNouns?.(shuffled);
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
    if (cardIndex >= flashList.length - 1) {
      return;
    }
    setCardIndex((prev) => prev + 1);
    setCardFlipped(false);
  };

  const handleFlashTouchStart = (e) => {
    setTouchStartX(e.touches?.[0]?.clientX ?? null);
  };

  const handleFlashTouchEnd = (e) => {
    if (touchStartX === null) return;
    const endX = e.changedTouches?.[0]?.clientX;
    if (typeof endX !== "number") return;
    const deltaX = endX - touchStartX;
    if (Math.abs(deltaX) >= 60) {
      if (deltaX < 0) handleFlashNext();
      else handleFlashPrevious();
    }
    setTouchStartX(null);
  };

  const nounCard = flashList[cardIndex];

  const duplicateNoun = useMemo(() => {
    const current = nounFormData.noun.trim().toLowerCase();
    if (!current) return false;
    return list.some(
      (item) =>
        item.noun?.trim().toLowerCase() === current &&
        item.id !== editingNounId
    );
  }, [nounFormData.noun, list, editingNounId]);

  useEffect(() => {
    let timerId = null;
    if (hourlyAlertsActive && list.length > 0) {
      timerId = startHourlyNounNotifier(list);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [hourlyAlertsActive, vocabList]);

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
    const word =
      list.length > 0
        ? list[Math.floor(Math.random() * list.length)]
        : { article: "der", noun: "Test", plural: "Tests", meaning: "test" };
    await sendNounNotification(word);
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
          daily: Number(parsed.Nouns?.daily) || 10,
          weekly: Number(parsed.Nouns?.weekly) || 50,
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

  const { daily: nounDailyCount, weekly: nounWeeklyCount } = getGoalCounts(list);
  const { daily: nounDailyTarget, weekly: nounWeeklyTarget } = getSavedTargets();

  const handleConfirmReset = () => {
    playDangerSound();
    onCommitNouns?.([]);
    setCardIndex(0);
    setCardFlipped(false);
    resetQuizProgress();
    setResetModalOpen(false);
  };

  const exportToExcel = () => {
    if (list.length === 0) {
      alert("No nouns to export.");
      return;
    }

    const exportData = list.map((item, index) => ({
      "#": index + 1,
      Article: item.article,
      Noun: item.noun,
      Plural: item.plural || "",
      Meaning: item.meaning || "",
      Gender: item.gender || GENDER_MAP[item.article] || "",
      Status: item.status || "In Progress",
      CreatedAt: item.createdAt || new Date().toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Nouns");

    XLSX.writeFile(workbook, `German_Nouns_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

        const existingNounSet = new Set(
          list.map((v) => v.noun?.trim().toLowerCase())
        );

        const newEntries = [];
        const duplicateWords = [];

        rawJson.forEach((row, i) => {
          const rowLower = {};
          Object.keys(row).forEach((k) => {
            rowLower[k.trim().toLowerCase()] = row[k];
          });

          const noun = (rowLower.noun || rowLower["german noun"] || "").toString().trim();
          let article = (rowLower.article || "").toString().trim().toLowerCase();
          const plural = (rowLower.plural || rowLower["plural (die)"] || "").toString().trim();
          const meaning = (rowLower.meaning || rowLower["english meaning"] || "").toString().trim();
          const status = (rowLower.status || "In Progress").toString().trim();

          if (!["der", "die", "das"].includes(article)) {
            article = "der";
          }

          if (noun) {
            const lowerNoun = noun.toLowerCase();
            if (existingNounSet.has(lowerNoun)) {
              duplicateWords.push(noun);
            } else {
              existingNounSet.add(lowerNoun);
              newEntries.push({
                id: Date.now() + i,
                article,
                noun,
                plural,
                meaning,
                gender: GENDER_MAP[article] || "",
                status:
                  status.toLowerCase() === "mastered"
                    ? "Mastered"
                    : status.toLowerCase() === "forgot"
                    ? "Forgot"
                    : "In Progress",
                createdAt: new Date().toISOString(),
              });
            }
          }
        });

        if (newEntries.length > 0) {
          const updatedList = [...list, ...newEntries];
          const reachedGoal = verifyGoalMilestone(list, updatedList, `${newEntries.length} new nouns`);
          if (!reachedGoal) {
            playSuccessSound();
          }
          onCommitNouns?.(updatedList);
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
        alert("Failed to parse Excel file. Please ensure it has proper column headers (Article, Noun, Plural, Meaning).");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const generateGermanNoun = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      setAiError("VITE_GEMINI_API_KEY is not defined in your .env file.");
      return;
    }

    if (!nounFormData.meaning.trim()) {
      setAiError("Please provide an English word first.");
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Translate the English noun "${nounFormData.meaning.trim()}" into German. Provide the definite nominative singular article (der, die, or das), singular noun, and full plural form including article.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              article: { type: Type.STRING, enum: ["der", "die", "das"] },
              noun: { type: Type.STRING },
              plural: { type: Type.STRING },
            },
            required: ["article", "noun", "plural"],
          },
        },
      });

      const parsed = JSON.parse(response.text);

      setNounFormData((prev) => ({
        ...prev,
        article: parsed.article,
        noun: parsed.noun,
        plural: parsed.plural,
      }));
    } catch (err) {
      setAiError(err.message || "Failed to generate noun.");
    } finally {
      setAiLoading(false);
    }
  };

  const filteredNouns = list.filter((item) => {
    const q = normalize(search);
    const matchesSearch =
      !q ||
      normalize(item.noun).includes(q) ||
      normalize(item.plural).includes(q) ||
      normalize(item.meaning).includes(q) ||
      normalize(item.article).includes(q);
    const matchesArt = articleFilter === "all" || item.article === articleFilter;
    const itemStatus = item.status || "In Progress";
    const matchesStatus = nounStatusFilter === "all" || itemStatus === nounStatusFilter;
    return matchesSearch && matchesArt && matchesStatus && matchesDateFilter(item.createdAt, dateFilter, customDate);
  });

  const nounsMastered = list.filter((i) => i.status === "Mastered").length;
  const nounsForgot = list.filter((i) => i.status === "Forgot").length;
  const countNoun = (art) => list.filter((i) => i.article === art).length;

  const openAddModal = () => {
    setEditingNounId(null);
    setAiError("");
    setNounFormData(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingNounId(item.id);
    setAiError("");
    setNounFormData({
      noun: item.noun,
      plural: item.plural || "",
      article: item.article,
      meaning: item.meaning,
      status: item.status || "In Progress",
    });
    setModalOpen(true);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();

    const cleanNoun = nounFormData.noun.trim();
    if (!cleanNoun || !nounFormData.meaning.trim()) {
      return;
    }

    const isDuplicate = list.some(
      (item) =>
        item.noun.trim().toLowerCase() === cleanNoun.toLowerCase() &&
        item.id !== editingNounId
    );

    if (isDuplicate) {
      playDuplicateSound();
      setDuplicateWordName(cleanNoun);
      setDuplicateModalOpen(true);
      return;
    }

    const gender = GENDER_MAP[nounFormData.article] || "";
    const isEditing = Boolean(editingNounId);
    let updated;

    if (isEditing) {
      updated = list.map((item) =>
        item.id === editingNounId ? { ...item, ...nounFormData, noun: cleanNoun, gender } : item
      );
    } else {
      updated = [
        ...list,
        {
          id: Date.now(),
          ...nounFormData,
          noun: cleanNoun,
          gender,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const reachedGoal =
      !isEditing && verifyGoalMilestone(list, updated, `${nounFormData.article} ${cleanNoun}`);

    if (!reachedGoal && !isEditing) {
      playSuccessSound();
    }

    onCommitNouns?.(updated);
    setModalOpen(false);

    if (!reachedGoal) {
      setSuccessWordInfo({
        article: nounFormData.article,
        noun: cleanNoun,
        isEdit: isEditing,
      });
      setSuccessModalOpen(true);
    }
  };

  const toggleStatus = (id) =>
    onCommitNouns?.(
      list.map((i) =>
        i.id === id
          ? { ...i, status: i.status === "Mastered" ? "In Progress" : "Mastered" }
          : i
      )
    );

  const recordAnswerResult = (word, ok) => {
    if (!word) return;

    const isLastSubQuestion =
      quizMode !== "flashrev" || (quizIndex % FLASHREV_STEPS === FLASHREV_STEPS - 1);

    let changed = false;
    const updated = list.map((n) => {
      if (n.id !== word.id) return n;
      const next = { ...n };
      if (ok) {
        if (quizMode === "flashrev" && n.flashRev && isLastSubQuestion) {
          next.flashRev = false;
          changed = true;
        }
      } else {
        if (!n.flashRev) {
          next.flashRev = true;
          changed = true;
        }
        if (n.status === "Mastered") {
          next.status = "Forgot";
          changed = true;
        }
      }
      return next;
    });
    if (changed) onCommitNouns?.(updated);
  };

  const handleFlipCard = () => {
    if (!cardFlipped && nounCard && !nounCard.flashRev) {
      onCommitNouns?.(list.map((n) => (n.id === nounCard.id ? { ...n, flashRev: true } : n)));
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

  const goToNextQuestion = (finalScore) => {
    setQuizAnswerState("idle");
    setQuizFeedback(null);
    setQuizTextInput("");
    setQuizSelectedArticle("");

    if (quizIndex < quizList.length - 1) {
      setQuizIndex((prev) => prev + 1);
    } else {
      setTimerRunning(false);
      setIsQuizActive(false);
      setTimeLeft(null);
      openResultModal("finish", finalScore, quizList.length);
    }
  };

  const handleSubmitQuiz = () => {
    if (!quizList.length) return;
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
    }
    setTimerRunning(false);
    setIsQuizActive(false);
    setTimeLeft(null);
    openResultModal("submit", quizScore, quizList.length);
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

  const handleArticleOptionSelect = (selectedArticle) => {
    if (quizAnswerState !== "idle" || !nounQuizWord) return;

    const ok = selectedArticle === nounQuizWord.article;
    if (ok) {
      setQuizScore((prev) => prev + 1);
      setQuizFeedback("Correct! 🎉");
    } else {
      setQuizFeedback(`Wrong! Correct article is "${nounQuizWord.article}".`);
    }

    recordAnswerResult(nounQuizWord, ok);
    triggerAutoAdvance(ok);
  };

  const handleQuizTextSubmit = (e) => {
    e?.preventDefault();
    if (quizAnswerState !== "idle" || !nounQuizWord || !quizTextInput.trim()) return;

    let ok = false;

    if (effectiveMode === "english") {
      if (!quizSelectedArticle) return;

      const articleOk = quizSelectedArticle === nounQuizWord.article;
      const nounOk = foldGerman(quizTextInput) === foldGerman(nounQuizWord.noun);
      ok = articleOk && nounOk;
      if (ok) setQuizScore((prev) => prev + 1);

      let detail = "";
      if (!ok) {
        if (!articleOk && !nounOk) detail = "Both the article and the noun are wrong.";
        else if (!articleOk) detail = "The noun is right, but the article is wrong.";
        else detail = "The article is right, but the noun is wrong.";
      }

      setQuizFeedback(
        ok
          ? "Correct! 🎉"
          : `Incorrect. ${detail} The correct answer is "${nounQuizWord.article} ${nounQuizWord.noun}".`
      );
    } else if (effectiveMode === "plural") {
      const expectedPlural = nounQuizWord.plural || "";
      const stripDie = (str) => String(str ?? "").trim().replace(/^die\s+/i, "");

      ok =
        Boolean(stripDie(expectedPlural)) &&
        foldGerman(stripDie(quizTextInput)) === foldGerman(stripDie(expectedPlural));
      if (ok) setQuizScore((prev) => prev + 1);
      setQuizFeedback(
        ok
          ? "Correct! 🎉"
          : `Incorrect. The correct plural is "${expectedPlural || "—"}".`
      );
    }

    recordAnswerResult(nounQuizWord, ok);
    triggerAutoAdvance(ok);
  };

  const nounQuizWord = quizList[quizIndex];

  const effectiveMode =
    quizMode === "flashrev"
      ? getFlashRevMode(nounQuizWord, quizIndex % FLASHREV_STEPS)
      : quizMode;

  const flashRevCount = list.filter((n) => n.flashRev).length;

  const flashRevUniqueWords =
    quizMode === "flashrev" ? quizList.length / FLASHREV_STEPS : quizList.length;

  const flashRevSubLabel =
    quizMode === "flashrev"
      ? ` · Q${(quizIndex % FLASHREV_STEPS) + 1}/${FLASHREV_STEPS}`
      : "";

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
          text: `You need at least ${PASS_PERCENT}% to pass. Review the words and try again.`,
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

  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          <div className="stats-grid">
            <div className="stat dark" style={{ minWidth: 0 }}>
              <div className="stat-head">
                <span className="stat-label">TOTAL NOUNS</span>
                <span className="stat-pill dark">{nounsMastered} mastered</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value">{list.length}</span>
                {nounsForgot > 0 ? (
                  <span
                    className="stat-pill dark"
                    title="Words that were Mastered and then answered wrong in a quiz"
                    style={{ color: "#fecaca", background: "rgba(239, 68, 68, 0.2)" }}
                  >
                    ⚠ {nounsForgot} forgot
                  </span>
                ) : (
                  <span className="stat-note" style={{ color: "#a8a29e" }}>all genders</span>
                )}
              </div>
            </div>
            <div className="stat" style={{ minWidth: 0 }}>
              <div className="stat-head"><span className="stat-label">MASCULINE</span><span className="stat-pill bg-der">der</span></div>
              <div className="stat-foot"><span className="stat-value c-der">{countNoun("der")}</span></div>
            </div>
            <div className="stat" style={{ minWidth: 0 }}>
              <div className="stat-head"><span className="stat-label">FEMININE</span><span className="stat-pill bg-die">die</span></div>
              <div className="stat-foot"><span className="stat-value c-die">{countNoun("die")}</span></div>
            </div>
            <div className="stat" style={{ minWidth: 0 }}>
              <div className="stat-head"><span className="stat-label">NEUTER</span><span className="stat-pill bg-das">das</span></div>
              <div className="stat-foot"><span className="stat-value c-das">{countNoun("das")}</span></div>
            </div>
          </div>

          <div className="toolbar">
            <div className="search">
              <span>🔍</span>
              <input
                type="search"
                placeholder="Search noun, plural, or meaning..."
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
                  icon="👤"
                  value={articleFilter}
                  options={GENDER_OPTIONS}
                  onChange={(val) => setArticleFilter(val)}
                />
              </div>

              <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                <CustomDropdown
                  icon="📌"
                  value={nounStatusFilter}
                  options={STATUS_FILTER_OPTIONS}
                  onChange={(val) => setNounStatusFilter(val)}
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
                title="Shuffle noun list order"
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
                title="Send a word notification now"
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
                title="Reset all nouns"
              >
                🔄 Reset
              </button>
            </div>
          </div>

          {filteredNouns.length === 0 ? (
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
                No Nouns Found
              </h3>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)", maxWidth: "340px", lineHeight: 1.5 }}>
                {search || articleFilter !== "all" || nounStatusFilter !== "all" || dateFilter !== "all"
                  ? "We couldn't find any nouns matching your current filters. Try changing or clearing them."
                  : "You haven't added any nouns yet. Add your first German word to get started!"}
              </p>
              {search || articleFilter !== "all" || nounStatusFilter !== "all" || dateFilter !== "all" ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: "16px" }}
                  onClick={() => {
                    setSearch("");
                    setArticleFilter("all");
                    setNounStatusFilter("all");
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
                  + Add First Noun
                </button>
              )}
            </div>
          ) : (
            <div className="list">
              <div className="list-head nouns-head">
                <span style={{ textAlign: "center" }}>#</span>
                <span>ARTICLE</span>
                <span>GERMAN NOUN</span>
                <span>PLURAL (DIE)</span>
                <span>ENGLISH MEANING</span>
                <span>STATUS</span>
                <span style={{ textAlign: "right" }}>ACTIONS</span>
              </div>
              {filteredNouns.map((item, index) => (
                <div className={`row noun-row ${item.article}`} key={item.id}>
                  <div className="c-idx">{index + 1}</div>
                  <div className="c-art"><span className={`pill ${ARTICLE_CLASS[item.article]}`}>{item.article}</span></div>
                  <div className="c-noun">
                    <div className="noun-wrap">
                      <span className={`pill ${ARTICLE_CLASS[item.article]}`}>{item.noun}</span>
                      <span className="gender">({item.gender})</span>
                    </div>
                  </div>
                  <div className="c-plural">{item.plural || "—"}</div>
                  <div className="c-mean">{item.meaning}</div>
                  <div className="c-status">
                    <button
                      onClick={() => toggleStatus(item.id)}
                      className={`status ${item.status === "Mastered" ? "done" : "todo"}`}
                      style={
                        item.status === "Forgot"
                          ? { color: "#b91c1c", backgroundColor: "#fee2e2", borderColor: "#fca5a5" }
                          : undefined
                      }
                      title={item.status === "Forgot" ? "Set automatically after a wrong quiz answer. Click to mark Mastered again." : undefined}
                    >
                      {item.status === "Mastered"
                        ? "✔ Mastered"
                        : item.status === "Forgot"
                        ? "⚠ Forgot"
                        : "☐ In Progress"}
                    </button>
                  </div>
                  <div className="actions">
                    <button onClick={() => speakGerman(`${item.article} ${item.noun}. ${item.plural || ""}`)} className="icon-btn">🔊</button>
                    <button onClick={() => openEditModal(item)} className="icon-btn">✏️</button>
                    <button
                      onClick={() =>
                        onRequestConfirm?.("Delete Noun", `Are you sure you want to delete "${item.article} ${item.noun}"?`, () =>
                          onCommitNouns?.(list.filter((i) => i.id !== item.id))
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
        <button
          onClick={openAddModal}
          className="fab-btn"
          title="Add Noun"
          aria-label="Add Noun"
        >
          +
        </button>
      )}

      {viewMode === "flashcards" && (
        <div className="panel">
          {!nounCard ? (
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
              <p style={{ color: "var(--muted)", margin: 0 }}>No nouns available for flashcards.</p>
            </div>
          ) : (
            <div className="flash-wrap">
              <div
                className="flash"
                onClick={handleFlipCard}
                onTouchStart={handleFlashTouchStart}
                onTouchEnd={handleFlashTouchEnd}
                style={{ touchAction: "pan-y" }}
              >
                {!cardFlipped ? (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>GUESS ARTICLE, PLURAL &amp; MEANING</span>
                    <h2>{nounCard.noun}</h2>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                  </>
                ) : (
                  <>
                    <span className={`pill ${ARTICLE_CLASS[nounCard.article]}`} style={{ fontSize: 22, padding: "6px 20px" }}>
                      {nounCard.article} {nounCard.noun}
                    </span>
                    {nounCard.plural && (
                      <p style={{ fontSize: 16, fontWeight: 700, color: "var(--muted)", margin: "10px 0 0" }}>
                        Plural: {nounCard.plural}
                      </p>
                    )}
                    <h3 style={{ fontSize: 24, margin: "10px 0 6px", color: "var(--ink-2)" }}>{nounCard.meaning}</h3>
                    <p style={{ color: "var(--muted)", margin: 0, fontSize: 14 }}>{nounCard.gender}</p>
                  </>
                )}
              </div>
              <div style={{ width: "100%", marginBottom: "10px" }}>
                <div style={{ height: "6px", background: "var(--line-2, #ebdccb)", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ width: `${flashList.length ? ((cardIndex + 1) / flashList.length) * 100 : 0}%`, height: "100%", background: "var(--brand, #b85c19)", borderRadius: "999px", transition: "width 0.25s ease" }} />
                </div>
              </div>
              <div className="flash-controls">
                <button className="btn btn-secondary flash-nav-btn" disabled={cardIndex === 0} onClick={handleFlashPrevious}>
                  ◀ Previous
                </button>
                <button className="btn btn-secondary mid" onClick={() => speakGerman(`${nounCard.article} ${nounCard.noun}. ${nounCard.plural || ""}`)}>
                  🔊 Pronounce
                </button>
                <button className="btn btn-secondary flash-nav-btn" disabled={cardIndex >= flashList.length - 1} onClick={handleFlashNext}>
                  Next ▶
                </button>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                Card {cardIndex + 1} of {flashList.length} · {Math.round(((cardIndex + 1) / flashList.length) * 100)}% · {flashRevCount} queued for FlashRev
              </span>
            </div>
          )}
        </div>
      )}

      {/* 🎯 QUIZ VIEW */}
      {viewMode === "quiz" && (
        <div className="panel" style={getQuizPanelStyle()}>
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

                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <CustomDropdown
                    icon="📌"
                    value={quizStatusFilter}
                    options={STATUS_FILTER_OPTIONS}
                    onChange={handleQuizStatusChange}
                  />
                </div>

                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <CustomDropdown
                    icon="📅"
                    value={quizDateMode}
                    options={QUIZ_DATE_DROPDOWN_OPTIONS}
                    onChange={handleQuizDateModeChange}
                  />
                </div>

                {quizDateMode === "specific" && (
                  <RealCalendarPicker
                    selectedDate={quizSpecificDate}
                    onSelectDate={handleQuizCalendarDateSelect}
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
                    boxSizing: "border-box",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>🔢</span>
                  <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--ink, #1f2937)" }}>
                    {quizMode === "flashrev" ? "Words:" : "Count:"}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={
                      quizMode === "flashrev"
                        ? `${flashRevUniqueWords}`
                        : availableQuizPool.length
                        ? `${availableQuizPool.length}`
                        : "All"
                    }
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
                  <span style={{ fontSize: "14px" }}>⏱️</span>
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

                <button
                  type="button"
                  onClick={handleShuffleQuiz}
                  className="btn btn-secondary"
                  title="Shuffle quiz questions order"
                  style={{ flexShrink: 0, whiteSpace: "nowrap", height: "40px", borderRadius: "12px", padding: "0 12px" }}
                >
                  🔀 Shuffle
                </button>

                <div style={{ flexShrink: 0, fontSize: "13.5px", color: "var(--muted)", whiteSpace: "nowrap", paddingLeft: "4px" }}>
                  {quizMode === "flashrev" ? (
                    <>
                      Words: <strong style={{ color: "var(--ink)" }}>{flashRevUniqueWords}</strong>
                      <span style={{ color: "var(--faint)", fontSize: 12 }}> ×{FLASHREV_STEPS}Q</span>
                    </>
                  ) : (
                    <>Words: <strong style={{ color: "var(--ink)" }}>{quizList.length}</strong></>
                  )}
                </div>

                {(quizStatusFilter !== "all" || quizDateMode !== "all" || quizSpecificDate || wordCountInput) && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flexShrink: 0, padding: "0 12px", fontSize: "12.5px", whiteSpace: "nowrap", height: "40px", borderRadius: "12px" }}
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
                  aria-label={timerRunning ? "Pause Timer" : "Resume Timer"}
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "8px",
                    border: timerRunning ? "1px solid #fca5a5" : "1px solid #86efac",
                    backgroundColor: timerRunning ? "#ffffff" : "#15803d",
                    color: timerRunning ? "#dc2626" : "#ffffff",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    marginLeft: "4px",
                    transition: "all 0.15s ease",
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
                    width: "38px",
                    height: "38px",
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

          {!nounQuizWord ? (
            <div
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "36px 16px", textAlign: "center",
              }}
            >
              <img src={noDataImg} alt="No Data" style={{ width: "160px", maxWidth: "80%", height: "auto", marginBottom: "12px" }} />
              <p style={{ color: "var(--muted)", margin: "0 0 12px 0", fontSize: 15 }}>
                {list.length === 0
                  ? "Add nouns to start quiz."
                  : quizMode === "flashrev"
                  ? "No FlashRev words yet. Flip some flashcards, or miss a question in another quiz mode, and those words will show up here (or relax your filters)."
                  : "No nouns match the selected status, date, or count filters."}
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
                .quiz-submit-btn {
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  height: 45px;
                  padding: 0 12px;
                  border: none;
                  border-radius: 999px;
                  background: var(--brand, #b45309);
                  color: #fff;
                  font-size: 14px;
                  font-weight: 800;
                  letter-spacing: 0.02em;
                  cursor: pointer;
                  box-shadow: 0 6px 16px rgba(180, 83, 9, 0.28);
                  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
                }
                .quiz-submit-btn:hover {
                  transform: translateY(-2px);
                  filter: brightness(1.08);
                  box-shadow: 0 10px 22px rgba(180, 83, 9, 0.35);
                }
                .quiz-submit-btn:active {
                  transform: translateY(0) scale(0.97);
                  box-shadow: 0 3px 8px rgba(180, 83, 9, 0.3);
                }
                .quiz-submit-btn:focus-visible {
                  outline: 3px solid rgba(180, 83, 9, 0.35);
                  outline-offset: 2px;
                }
                .quiz-submit-btn .quiz-submit-tick {
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  width: 10px;
                  height: 10px;
                  border-radius: 50%;
                  background: rgba(255, 255, 255, 0.25);
                  font-size: 12px;
                }
                .quiz-submit-bottom {
                  display: flex;
                  justify-content: center;
                  margin-top: 28px;
                }

                .flashrev-dots {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  margin-bottom: 10px;
                }
                .flashrev-dot {
                  width: 8px;
                  height: 8px;
                  border-radius: 50%;
                  background: var(--line-2, #e2e8f0);
                  transition: background 0.2s ease, transform 0.2s ease;
                }
                .flashrev-dot.active {
                  background: var(--brand, #b45309);
                  transform: scale(1.3);
                }
                .flashrev-dot.done {
                  background: #86efac;
                }
                @media (max-width: 768px) {
                  .flash-controls .flash-nav-btn {
                    display: none !important;
                  }
                }
              `}</style>

              <div className="quiz-head quiz-head-with-submit">
                <span className="quiz-head-left">
                  {quizMode === "flashrev" ? (
                    <>
                      Word {Math.floor(quizIndex / FLASHREV_STEPS) + 1} of {flashRevUniqueWords}
                      <span style={{ color: "var(--muted)", fontWeight: 500 }}>{flashRevSubLabel}</span>
                    </>
                  ) : (
                    <>Question {quizIndex + 1} of {quizList.length}</>
                  )}
                </span>

                <span className="quiz-head-right" style={{ fontWeight: 700, color: "var(--brand)" }}>
                  Score: {quizScore}
                </span>
              </div>

              {quizMode === "flashrev" && (
                <div className="flashrev-dots">
                  {Array.from({ length: FLASHREV_STEPS }).map((_, i) => {
                    const subIdx = quizIndex % FLASHREV_STEPS;
                    const dotClass =
                      i < subIdx ? "done" : i === subIdx ? "active" : "";
                    return (
                      <span
                        key={i}
                        className={`flashrev-dot ${dotClass}`}
                        title={["Article", "Plural", "English"][i]}
                      />
                    );
                  })}
                  <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 6 }}>
                    {["Article", "Plural", "English → Noun"][quizIndex % FLASHREV_STEPS]}
                  </span>
                </div>
              )}

              <div className="quiz-card">
                {effectiveMode === "article" && (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                      Choose the correct article:
                    </span>
                    <h1>{nounQuizWord.noun}</h1>
                    <p style={{ color: "var(--muted)", margin: "4px 0", fontSize: 14 }}>
                      Plural: <strong>{nounQuizWord.plural || "—"}</strong>
                    </p>
                    <p style={{ color: "var(--muted)", margin: 0, fontSize: 15 }}>
                      Meaning: <strong style={{ color: "var(--ink-2)" }}>{nounQuizWord.meaning}</strong>
                    </p>
                  </>
                )}

                {effectiveMode === "english" && (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                      Type the German singular noun for:
                    </span>
                    <h1 style={{ color: "var(--brand, #b85c19)" }}>{nounQuizWord.meaning}</h1>
                  </>
                )}

                {effectiveMode === "plural" && (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                      Type the plural form for:
                    </span>
                    <h1>{nounQuizWord.article} {nounQuizWord.noun}</h1>
                    <p style={{ color: "var(--muted)", margin: 0, fontSize: 15 }}>
                      Meaning: <strong style={{ color: "var(--ink-2)" }}>{nounQuizWord.meaning}</strong>
                    </p>
                  </>
                )}
              </div>

              {effectiveMode === "article" ? (
                <div className="quiz-opts">
                  {["der", "die", "das"].map((opt) => (
                    <button
                      key={opt}
                      disabled={quizAnswerState !== "idle"}
                      className={`quiz-opt ${opt}`}
                      onClick={() => handleArticleOptionSelect(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <form
                  onSubmit={handleQuizTextSubmit}
                  style={{
                    marginTop: 18,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    maxWidth: 420,
                    marginInline: "auto",
                  }}
                >
                  {effectiveMode === "english" && (
                    <div style={{ width: "100%" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6, textAlign: "center" }}>
                        1. Choose the article
                      </div>
                      <div style={{ display: "flex", gap: 10, width: "100%" }}>
                        {[
                          { art: "der", color: "#2563eb", bg: "#eff6ff" },
                          { art: "die", color: "#dc2626", bg: "#fef2f2" },
                          { art: "das", color: "#16a34a", bg: "#f0fdf4" },
                        ].map(({ art, color, bg }) => {
                          const selected = quizSelectedArticle === art;
                          return (
                            <button
                              key={art}
                              type="button"
                              disabled={quizAnswerState !== "idle"}
                              onClick={() => setQuizSelectedArticle(art)}
                              style={{
                                flex: 1, height: 46, borderRadius: 12,
                                fontSize: 16, fontWeight: 800,
                                cursor: quizAnswerState !== "idle" ? "default" : "pointer",
                                color: selected ? "#ffffff" : color,
                                backgroundColor: selected ? color : bg,
                                border: `2px solid ${color}`,
                                boxShadow: selected ? `0 0 0 3px ${bg}` : "none",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {art}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", margin: "12px 0 6px", textAlign: "center" }}>
                        2. Type the noun
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", width: "100%", gap: 8 }}>
                    <input
                      type="text"
                      autoFocus
                      disabled={quizAnswerState !== "idle"}
                      placeholder={
                        effectiveMode === "english"
                          ? "Type German word (e.g. Apfel)..."
                          : "Type plural form (e.g. Äpfel)..."
                      }
                      value={quizTextInput}
                      onChange={(e) => setQuizTextInput(e.target.value)}
                      className="modal-input"
                      style={{
                        flex: 1, height: "46px", fontSize: "16px", fontWeight: 600,
                        borderRadius: "12px", border: "1.5px solid var(--line-2, #ebdccb)",
                        padding: "0 14px", outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      disabled={
                        quizAnswerState !== "idle" ||
                        !quizTextInput.trim() ||
                        (effectiveMode === "english" && !quizSelectedArticle)
                      }
                      className="btn btn-primary"
                      style={{ height: "46px", padding: "0 18px", borderRadius: "12px", marginTop: 7 }}
                    >
                      Check
                    </button>
                  </div>
                </form>
              )}

              {quizFeedback && (
                <div style={{ marginTop: 20, textAlign: "center", animation: "fadeIn 0.15s ease-in" }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: quizAnswerState === "correct" ? "#15803d" : "#dc2626" }}>
                    {quizFeedback}
                  </p>

                  {quizAnswerState === "correct" && (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {quizMode === "flashrev" && quizIndex % FLASHREV_STEPS < FLASHREV_STEPS - 1
                        ? `Next sub-question in 1 second...`
                        : `Moving to next word in 1 second...`}
                    </span>
                  )}
                </div>
              )}

              {quizAnswerState === "wrong" && (
                <div
                  className="quiz-submit-bottom"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-primary quiz-next-symbol"
                    autoFocus
                    onClick={handleForwardClick}
                    title={quizIndex < quizList.length - 1 ? "Next question" : "Finish quiz"}
                    style={{
                      width: 45,
                      height: 45,
                      padding: 0,
                      borderRadius: 14,
                      fontSize: 30,
                      fontWeight: 800,
                    }}
                  >
                    &gt;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 🏆 Quiz Results & Time-Up Modal */}
      {scoreModal.isOpen && (
        <div
          className="overlay"
          style={{ zIndex: 1300 }}
          onClick={(e) => { if (e.target === e.currentTarget) closeScoreModal(); }}
        >
          <div
            className="modal"
            style={{
              textAlign: "center", maxWidth: 360, padding: "26px 20px",
              display: "flex", flexDirection: "column", alignItems: "center",
              borderRadius: "20px", animation: "fadeIn 0.2s ease-in-out",
            }}
          >
            <img src={resultTheme.gif} alt="Quiz Results" style={{ width: 95, height: 95, objectFit: "contain", marginBottom: 12 }} />

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

            <h3 style={{ margin: "4px 0 6px", fontSize: 22, color: "var(--ink)" }}>{resultTheme.title}</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: 14 }}>{resultTheme.text}</p>

            <div style={{ display: "flex", gap: "12px", width: "100%", marginBottom: "18px" }}>
              <div style={{ flex: 1, padding: "12px 6px", borderRadius: "12px", backgroundColor: "#f7f2ed", border: "1px solid #ebdccb" }}>
                <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--brand, #b85c19)" }}>
                  {scoreModal.score} / {scoreModal.total}
                </div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginTop: 2, textTransform: "uppercase" }}>
                  Score
                </div>
              </div>
              <div style={{ flex: 1, padding: "12px 6px", borderRadius: "12px", backgroundColor: "#f7f2ed", border: "1px solid #ebdccb" }}>
                <div style={{ fontSize: "26px", fontWeight: 800, color: resultPassed ? "#166534" : "#b91c1c" }}>
                  {scoreModal.total > 0 ? Math.round(resultPct) : 0}%
                </div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginTop: 2, textTransform: "uppercase" }}>
                  Accuracy
                </div>
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
                  stopGoalAchievedMusic();
                  setScoreModal((p) => ({ ...p, isOpen: false }));
                  handleShuffleQuiz();
                  const parsed = parseInt(timerInput, 10);
                  if (!isNaN(parsed) && parsed > 0) {
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
        defaultCategory="Nouns"
        categoryStats={{ Nouns: { dailyCurrent: nounDailyCount, weeklyCurrent: nounWeeklyCount } }}
        initialDailyTarget={nounDailyTarget}
        initialWeeklyTarget={nounWeeklyTarget}
      />

      {/* Add / Edit Noun Modal */}
      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>{editingNounId ? "Edit Noun" : "Add New Noun"}</h3>
            <form onSubmit={handleSaveModal}>
              <div>
                <label className="modal-label">Article (Gender)</label>
                <div className="radios">
                  {["der", "die", "das"].map((art) => (
                    <label key={art} className={`radio ${nounFormData.article === art ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="article"
                        value={art}
                        checked={nounFormData.article === art}
                        onChange={(e) => setNounFormData({ ...nounFormData, article: e.target.value })}
                      />
                      {art}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="modal-label">English Word</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="modal-input"
                    style={{ flex: 1 }}
                    type="text"
                    required
                    placeholder="e.g. Apple"
                    value={nounFormData.meaning}
                    onChange={(e) => {
                      setAiError("");
                      setNounFormData({ ...nounFormData, meaning: e.target.value });
                    }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={generateGermanNoun} disabled={aiLoading}>
                    {aiLoading ? "Generating..." : "✨ Generate"}
                  </button>
                </div>
                {aiError && <p style={{ color: "#dc2626", fontSize: 13, margin: "6px 0 0" }}>{aiError}</p>}
              </div>

              <div>
                <label className="modal-label">German Noun (Singular)</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. Apfel"
                  value={nounFormData.noun}
                  onChange={(e) => {
                    setAiError("");
                    setNounFormData({ ...nounFormData, noun: e.target.value });
                  }}
                />
                {duplicateNoun && (
                  <p style={{ color: "#dc2626", fontSize: 12.5, margin: "6px 0 0", fontWeight: 600 }}>
                    ⚠ This German noun already exists in your vocabulary.
                  </p>
                )}
              </div>

              <div>
                <label className="modal-label">Plural Form (die ...)</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. die Äpfel"
                  value={nounFormData.plural}
                  onChange={(e) => setNounFormData({ ...nounFormData, plural: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Status</label>
                <CustomDropdown
                  fullWidth
                  value={nounFormData.status}
                  options={
                    nounFormData.status === "Forgot"
                      ? [...STATUS_OPTIONS, { label: "Forgot", value: "Forgot" }]
                      : STATUS_OPTIONS
                  }
                  onChange={(val) => setNounFormData({ ...nounFormData, status: val })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={duplicateNoun}>
                  Save Noun
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
              textAlign: "center", maxWidth: 360, padding: "24px 20px",
              display: "flex", flexDirection: "column", alignItems: "center",
              animation: "fadeIn 0.2s ease-in-out",
            }}
          >
            <img src={warningRedGif} alt="Warning" style={{ width: 90, height: 90, objectFit: "contain", marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#dc2626" }}>Reset All Nouns?</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              Are you sure you want to delete all nouns? This action will permanently remove your entire vocabulary list and cannot be undone.
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
              textAlign: "center", maxWidth: 360, padding: "24px 20px",
              display: "flex", flexDirection: "column", alignItems: "center",
            }}
          >
            <img src={alertGif} alt="Alert" style={{ width: 100, height: 100, objectFit: "contain", marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--ink)" }}>Word Already Exists!</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{duplicateWordName}"</strong> is already in your vocabulary list.
            </p>
            <button type="button" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setDuplicateModalOpen(false)}>
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
              textAlign: "center", maxWidth: 380, padding: "28px 22px 24px",
              display: "flex", flexDirection: "column", alignItems: "center",
              borderRadius: 20, border: "1px solid #ebdccb",
              boxShadow: "0 16px 36px rgba(0, 0, 0, 0.18)", animation: "fadeIn 0.22s ease-out",
            }}
          >
            <img src={congratsGif} alt="Celebration Congrats" style={{ width: 105, height: 105, objectFit: "contain", marginBottom: 12 }} />
            <span
              style={{
                fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
                color: "#b85c19", backgroundColor: "#fef3c7",
                border: "1px solid #fde68a", padding: "4px 12px",
                borderRadius: 20, marginBottom: 10, textTransform: "uppercase",
              }}
            >
              {goalCelebration.goalType === "daily" ? "🎯 Daily Goal Achieved!" : "🏆 Weekly Goal Achieved!"}
            </span>
            <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "var(--ink, #1e1e1e)" }}>
              Herzlichen Glückwunsch!
            </h3>
            <p style={{ color: "var(--muted, #6b7280)", margin: "0 0 16px", fontSize: 14, lineHeight: 1.55 }}>
              {goalCelebration.goalType === "daily" ? (
                <>You reached your daily goal of <strong style={{ color: "#b85c19" }}>{goalCelebration.target} nouns</strong>!</>
              ) : (
                <>Phenomenal work! You hit your weekly goal of <strong style={{ color: "#b85c19" }}>{goalCelebration.target} nouns</strong>!</>
              )}
            </p>
            {goalCelebration.addedWord && (
              <div
                style={{
                  fontSize: 12.5, color: "#166534", backgroundColor: "#dcfce7",
                  border: "1px solid #86efac", padding: "6px 14px",
                  borderRadius: 10, marginBottom: 18, fontWeight: 600,
                }}
              >
                Added: <strong>"{goalCelebration.addedWord}"</strong>
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "12px 18px", fontSize: 14.5, fontWeight: 700, backgroundColor: "#b85c19", borderColor: "#b85c19" }}
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
              textAlign: "center", maxWidth: 360, padding: "24px 20px",
              display: "flex", flexDirection: "column", alignItems: "center",
              animation: "fadeIn 0.2s ease-in-out",
            }}
          >
            <img src={successGif} alt="Success" style={{ width: 100, height: 100, objectFit: "contain", marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--brand, #16a34a)" }}>
              {successWordInfo.isEdit ? "Noun Updated!" : "Noun Added Successfully!"}
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{successWordInfo.article} {successWordInfo.noun}"</strong> has been saved to your vocabulary.
            </p>
            <button type="button" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setSuccessModalOpen(false)}>
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
            style={{ textAlign: "center", maxWidth: 380, padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 20, color: "var(--ink)" }}>Import Summary</h3>
            <div style={{ display: "flex", gap: 12, width: "100%", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ flex: 1, padding: "14px 8px", borderRadius: 10, backgroundColor: "#dcfce7", border: "1px solid #86efac", color: "#166534", fontWeight: 700 }}>
                <div style={{ fontSize: 28, lineHeight: 1.1 }}>{importSummary.added}</div>
                <div style={{ fontSize: 12, textTransform: "uppercase", marginTop: 4, letterSpacing: 0.5 }}>Added</div>
              </div>
              <div style={{ flex: 1, padding: "14px 8px", borderRadius: 10, backgroundColor: "#fef9c3", border: "1px solid #fde047", color: "#854d0e", fontWeight: 700 }}>
                <div style={{ fontSize: 28, lineHeight: 1.1 }}>{importSummary.duplicates}</div>
                <div style={{ fontSize: 12, textTransform: "uppercase", marginTop: 4, letterSpacing: 0.5 }}>Duplicates</div>
              </div>
            </div>
            {importSummary.duplicateWords.length > 0 && (
              <div
                style={{
                  fontSize: 12, color: "#854d0e", backgroundColor: "#fefce8",
                  border: "1px dashed #facc15", borderRadius: 6,
                  padding: "8px 12px", width: "100%", boxSizing: "border-box",
                  maxHeight: 90, overflowY: "auto", marginBottom: 16, textAlign: "left",
                }}
              >
                <strong>Skipped words:</strong>{" "}
                {importSummary.duplicateWords.slice(0, 8).join(", ")}
                {importSummary.duplicateWords.length > 8 && ` and ${importSummary.duplicateWords.length - 8} more...`}
              </div>
            )}
            <button type="button" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setImportSummary(null)}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}