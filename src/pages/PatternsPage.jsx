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

const GEMINI_MODEL = "gemini-2.5-flash";

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

// Pattern FlashRev: each pattern is tested on article, suffix/ending, and examples.
const FLASHREV_ROTATION = ["article", "ending", "examples"];
const FLASHREV_STEPS = 3;

const getFlashRevMode = (pattern, subIndex) => {
  const available = FLASHREV_ROTATION.filter(
    (mode) => mode === "article" || Boolean(pattern?.[mode])
  );
  return available[subIndex % Math.max(available.length, 1)];
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
  { label: "All Articles", value: "all" },
  { label: "der (Masculine)", value: "der" },
  { label: "die (Feminine)", value: "die" },
  { label: "das (Neuter)", value: "das" },
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
  { label: "Article", value: "article" },
  { label: "Rule → Suffix", value: "ending" },
  { label: "Example → Suffix", value: "examples" },
  { label: "FlashRev", value: "flashrev" },
];

const EXCEL_ACTIONS = [
  { label: "Excel Actions", value: "" },
  { label: "📥 Import", value: "import" },
  { label: "📤 Export", value: "export" },
];

const EMPTY_FORM = {
  article: "der",
  ending: "",
  rule: "",
  examples: "",
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

export default function PatternsPage({
  viewMode = "list",
  patternsList = [],
  onCommitPatterns,
  onRequestConfirm,
}) {
  const list = Array.isArray(patternsList) ? patternsList : [];

  const [search, setSearch] = useState("");
  const [articleFilter, setArticleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  // Quiz Filters & Mode
  const [quizStatusFilter, setQuizStatusFilter] = useState("all");
  const [quizDateMode, setQuizDateMode] = useState("all");
  const [quizSpecificDate, setQuizSpecificDate] = useState("");
  const [quizMode, setQuizMode] = useState("article");
  const [quizTextInput, setQuizTextInput] = useState("");

  // Quiz Controls: Question Count Limit & Timer
  const [wordCountInput, setWordCountInput] = useState("");
  const [timerInput, setTimerInput] = useState("30");
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);

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

  // Quiz Completion & Score Modal
  const [scoreModal, setScoreModal] = useState({
    isOpen: false,
    reason: "finish",
    score: 0,
    total: 0,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPatternId, setEditingPatternId] = useState(null);
  const [patternFormData, setPatternFormData] = useState(EMPTY_FORM);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ article: "", ending: "", isEdit: false });
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Study Goals Modal & Milestone State
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

  // Flashcard filters — same custom-dropdown / horizontal-scroll style as Nouns.
  const [flashArticleFilter, setFlashArticleFilter] = useState("all");
  const [flashStatusFilter, setFlashStatusFilter] = useState("all");
  const [flashDateMode, setFlashDateMode] = useState("all");
  const [flashSpecificDate, setFlashSpecificDate] = useState("");

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

  const hasPatterns = list.length > 0;

  // Freeze the quiz session by id, while allowing edits/deletions to update the displayed data.
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
  }, [hasPatterns, viewMode, quizMode, quizStatusFilter, quizDateMode, quizSpecificDate, quizShuffleKey, quizSessionKey]);

  const availableQuizPool = useMemo(() => {
    const byId = new Map(list.map((item) => [item.id, item]));
    return quizSessionIds.map((id) => byId.get(id)).filter(Boolean);
  }, [list, quizSessionIds]);

  const filteredFlashPool = useMemo(() => {
    return list.filter((item) => {
      const itemStatus = item.status || "In Progress";
      const matchesArticle =
        flashArticleFilter === "all" || item.article === flashArticleFilter;
      const matchesStatus =
        flashStatusFilter === "all" || itemStatus === flashStatusFilter;
      const matchesDate = matchesDateFilter(
        item.createdAt,
        flashDateMode,
        flashSpecificDate
      );
      return matchesArticle && matchesStatus && matchesDate;
    });
  }, [list, flashArticleFilter, flashStatusFilter, flashDateMode, flashSpecificDate]);

  const flashList = useMemo(() => {
    if (!flashOrder) return filteredFlashPool;
    const byId = new Map(filteredFlashPool.map((item) => [item.id, item]));
    const ordered = flashOrder.map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(flashOrder);
    return [
      ...ordered,
      ...filteredFlashPool.filter((item) => !seen.has(item.id)),
    ];
  }, [filteredFlashPool, flashOrder]);

  const quizList = useMemo(() => {
    const count = parseInt(wordCountInput, 10);
    if (quizMode === "flashrev") {
      if (!isNaN(count) && count > 0) return availableQuizPool.slice(0, count * FLASHREV_STEPS);
      return availableQuizPool;
    }
    if (!isNaN(count) && count > 0) return availableQuizPool.slice(0, count);
    return availableQuizPool;
  }, [availableQuizPool, wordCountInput, quizMode]);

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
    if (timerRunning && timeLeft !== null && timeLeft > 0) {
      setTimerRunning(false);
      setTimerPaused(true);
    }
  };

  const handleResumeTimer = () => {
    if (timerPaused && timeLeft !== null && timeLeft > 0) {
      setTimerPaused(false);
      setTimerRunning(true);
    }
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

  const handleQuizModeChange = (val) => {
    setQuizMode(val);
    resetQuizProgress();
  };

  const handleQuizStatusChange = (val) => {
    setQuizStatusFilter(val);
    resetQuizProgress();
  };

  const handleQuizDateModeChange = (val) => {
    setQuizDateMode(val);
    if (val !== "specific") setQuizSpecificDate("");
    resetQuizProgress();
  };

  const handleQuizCalendarDateSelect = (dateStr) => {
    setQuizSpecificDate(dateStr);
    resetQuizProgress();
  };

  const lastViewModeRef = useRef(viewMode);
  useEffect(() => {
    if (lastViewModeRef.current === viewMode) return;

    if (lastViewModeRef.current === "quiz") {
      setTimerRunning(false);
      setTimeLeft(null);
    }

    if (viewMode === "quiz") {
      resetQuizProgress();
    }

    lastViewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    let timerId = null;
    if (hourlyAlertsActive && list.length > 0) {
      const formattedForNotifier = list.map((p) => ({
        article: p.article,
        noun: p.ending,
        meaning: p.rule,
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
    const samplePattern =
      list.length > 0
        ? list[Math.floor(Math.random() * list.length)]
        : { article: "die", ending: "-ung", rule: "Forms feminine nouns" };

    await sendNounNotification({
      article: samplePattern.article,
      noun: samplePattern.ending,
      plural: "",
      meaning: samplePattern.rule,
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
      const saved = localStorage.getItem("study_goals_targets");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          daily: Number(parsed.Patterns?.daily) || 10,
          weekly: Number(parsed.Patterns?.weekly) || 50,
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

  const { daily: patternDailyCount, weekly: patternWeeklyCount } = getGoalCounts(list);
  const { daily: patternDailyTarget, weekly: patternWeeklyTarget } = getSavedTargets();

  const handleConfirmReset = () => {
    playDangerSound();
    onCommitPatterns?.([]);
    setCardIndex(0);
    setCardFlipped(false);
    resetQuizProgress();
    setResetModalOpen(false);
  };

  const exportToExcel = () => {
    if (list.length === 0) {
      alert("No patterns to export.");
      return;
    }

    const exportData = list.map((item, index) => ({
      "#": index + 1,
      Article: item.article,
      Ending: item.ending,
      Rule: item.rule || "",
      Examples: item.examples || "",
      Gender: GENDER_MAP[item.article] || "",
      Status: item.status || "In Progress",
      CreatedAt: item.createdAt || new Date().toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Patterns");

    XLSX.writeFile(workbook, `German_Patterns_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

        const existingKeys = new Set(
          list.map((p) => `${p.article}|${p.ending?.trim().toLowerCase()}`)
        );

        const newEntries = [];
        const duplicateWords = [];

        rawJson.forEach((row, i) => {
          const rowLower = {};
          Object.keys(row).forEach((k) => {
            rowLower[k.trim().toLowerCase()] = row[k];
          });

          const ending = (rowLower.ending || rowLower.suffix || rowLower.pattern || "").toString().trim();
          let article = (rowLower.article || "").toString().trim().toLowerCase();
          const rule = (rowLower.rule || rowLower.explanation || "").toString().trim();
          const examples = (rowLower.examples || rowLower.example || "").toString().trim();
          const status = (rowLower.status || "In Progress").toString().trim();

          if (!["der", "die", "das"].includes(article)) {
            article = "der";
          }

          if (ending) {
            const key = `${article}|${ending.toLowerCase()}`;
            if (existingKeys.has(key)) {
              duplicateWords.push(ending);
            } else {
              existingKeys.add(key);
              newEntries.push({
                id: `p-${Date.now()}-${i}`,
                article,
                ending,
                rule,
                examples,
                gender: GENDER_MAP[article] || "",
                status: status.toLowerCase() === "mastered" ? "Mastered" : "In Progress",
                createdAt: new Date().toISOString(),
              });
            }
          }
        });

        if (newEntries.length > 0) {
          const updatedList = [...list, ...newEntries];
          const reachedGoal = verifyGoalMilestone(list, updatedList, `${newEntries.length} new patterns`);
          if (!reachedGoal) {
            playSuccessSound();
          }
          onCommitPatterns?.(updatedList);
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
        alert("Failed to parse Excel file. Please ensure it has proper column headers (Article, Ending, Rule, Examples).");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const generateGermanPattern = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      setAiError("VITE_GEMINI_API_KEY is not defined in your .env file.");
      return;
    }

    if (!patternFormData.ending.trim()) {
      setAiError("Please enter a suffix / ending first (e.g. -ung).");
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        
        contents: `For the German noun ending/suffix "${patternFormData.ending.trim()}", give the grammatical article it most reliably indicates (der, die, or das), a short one-sentence rule explaining the pattern (mention notable exceptions only if important), and 3 to 4 example nouns written with their article, separated by commas (e.g. "die Station, die Nation").`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              article: { type: Type.STRING, enum: ["der", "die", "das"] },
              rule: { type: Type.STRING },
              examples: { type: Type.STRING },
            },
            required: ["article", "rule", "examples"],
          },
        },
      });

      const parsed = JSON.parse(response.text);

      setPatternFormData((prev) => ({
        ...prev,
        article: parsed.article,
        rule: parsed.rule,
        examples: parsed.examples,
      }));
    } catch (err) {
      setAiError(err.message || "Failed to generate pattern.");
    } finally {
      setAiLoading(false);
    }
  };

  const filteredPatterns = list.filter((item) => {
    const q = normalize(search);
    const matchesSearch =
      !q ||
      normalize(item.ending).includes(q) ||
      normalize(item.rule).includes(q) ||
      normalize(item.examples).includes(q) ||
      normalize(item.article).includes(q);
    const matchesArt = articleFilter === "all" || item.article === articleFilter;
    const itemStatus = item.status || "In Progress";
    const matchesStatus = statusFilter === "all" || itemStatus === statusFilter;
    return matchesSearch && matchesArt && matchesStatus && matchesDateFilter(item.createdAt, dateFilter, customDate);
  });

  const patternsMastered = list.filter((p) => p.status === "Mastered").length;
  const countPattern = (art) => list.filter((p) => p.article === art).length;

  const openAddModal = () => {
    setEditingPatternId(null);
    setAiError("");
    setPatternFormData(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (rule) => {
    setEditingPatternId(rule.id);
    setAiError("");
    setPatternFormData({
      article: rule.article,
      ending: rule.ending,
      rule: rule.rule,
      examples: rule.examples || "",
      status: rule.status || "In Progress",
    });
    setModalOpen(true);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();

    const cleanEnding = patternFormData.ending.trim();
    if (!cleanEnding || !patternFormData.rule.trim()) return;

    const isDuplicate = list.some(
      (item) =>
        item.ending.trim().toLowerCase() === cleanEnding.toLowerCase() &&
        item.article === patternFormData.article &&
        item.id !== editingPatternId
    );

    if (isDuplicate) {
      playDuplicateSound();
      setDuplicateName(cleanEnding);
      setDuplicateModalOpen(true);
      return;
    }

    const isEditing = Boolean(editingPatternId);
    let updated;

    if (isEditing) {
      updated = list.map((item) =>
        item.id === editingPatternId ? { ...item, ...patternFormData, ending: cleanEnding } : item
      );
    } else {
      updated = [
        ...list,
        {
          id: `p-${Date.now()}`,
          ...patternFormData,
          ending: cleanEnding,
          gender: GENDER_MAP[patternFormData.article] || "",
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const reachedGoal =
      !isEditing &&
      verifyGoalMilestone(list, updated, `${patternFormData.article} ${cleanEnding}`);

    if (!reachedGoal && !isEditing) {
      playSuccessSound();
    }

    onCommitPatterns?.(updated);
    setModalOpen(false);

    if (!reachedGoal) {
      setSuccessInfo({
        article: patternFormData.article,
        ending: cleanEnding,
        isEdit: isEditing,
      });
      setSuccessModalOpen(true);
    }
  };

  const toggleStatus = (id) =>
    onCommitPatterns?.(
      list.map((p) =>
        p.id === id
          ? { ...p, status: p.status === "Mastered" ? "In Progress" : "Mastered" }
          : p
      )
    );

  const patternCard = list[cardIndex];

  // Shuffle handlers
  const handleShuffleList = () => {
    if (list.length <= 1) return;
    onCommitPatterns?.(shuffleArray(list));
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

  const handleFlashArticleChange = (value) => {
    setFlashArticleFilter(value);
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
    if (value !== "specific") setFlashSpecificDate("");
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
    setFlashArticleFilter("all");
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

  // Reset all items currently queued for FlashRev
  const handleResetFlashRev = () => {
    if (flashRevCount === 0) return;
    onCommitPatterns?.(list.map((item) => (item.flashRev ? { ...item, flashRev: false } : item)));
    setCardFlipped(false);
  };

  const handleFlipCard = () => {
    const card = flashList[cardIndex];
    if (!cardFlipped && card && !card.flashRev) {
      onCommitPatterns?.(list.map((p) => p.id === card.id ? { ...p, flashRev: true } : p));
    }
    setCardFlipped((f) => !f);
  };

  const recordAnswerResult = (pattern, ok) => {
    if (!pattern) return;
    const isLastSubQuestion = quizMode !== "flashrev" || (quizIndex % FLASHREV_STEPS === FLASHREV_STEPS - 1);
    let changed = false;
    const updated = list.map((p) => {
      if (p.id !== pattern.id) return p;
      const next = { ...p };
      if (ok) {
        if (quizMode === "flashrev" && p.flashRev && isLastSubQuestion) {
          next.flashRev = false;
          changed = true;
        }
      } else {
        if (!p.flashRev) { next.flashRev = true; changed = true; }
        if (p.status === "Mastered") { next.status = "In Progress"; changed = true; }
      }
      return next;
    });
    if (changed) onCommitPatterns?.(updated);
  };

  const openResultModal = (reason, score, total) => {
    const pct = total > 0 ? (score / total) * 100 : 0;
    if (reason !== "timeup") {
      if (pct >= PASS_PERCENT) playGoalAchievedMusic();
      else playDangerSound();
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
    if (quizIndex < quizList.length - 1) {
      setQuizIndex((prev) => prev + 1);
    } else {
      setTimerRunning(false);
      setTimeLeft(null);
      openResultModal("finish", finalScore, quizList.length);
    }
  };

  const handleSubmitQuiz = () => {
    if (!quizList.length) return;
    if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
    setTimerRunning(false);
    setTimeLeft(null);
    openResultModal("submit", quizScore, quizList.length);
  };

  const triggerAutoAdvance = (isCorrect) => {
    setQuizAnswerState(isCorrect ? "correct" : "wrong");
    if (isCorrect) playSuccessSound(); else playDangerSound();
    if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
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
    if (quizAnswerState !== "idle" || !patternQuizWord) return;
    const ok = selectedArticle === patternQuizWord.article;
    if (ok) setQuizScore((prev) => prev + 1);
    setQuizFeedback(ok ? "Correct! 🎉" : `Wrong! Correct article is "${patternQuizWord.article}".`);
    recordAnswerResult(patternQuizWord, ok);
    triggerAutoAdvance(ok);
  };

  const handlePatternTextSubmit = (e) => {
    e?.preventDefault();
    if (quizAnswerState !== "idle" || !patternQuizWord || !quizTextInput.trim()) return;
    const expected = effectiveMode === "examples" ? patternQuizWord.ending : patternQuizWord.ending;
    const ok = foldGerman(quizTextInput) === foldGerman(expected);
    if (ok) setQuizScore((prev) => prev + 1);
    setQuizFeedback(ok ? "Correct! 🎉" : `Incorrect. The correct suffix is "${expected}".`);
    recordAnswerResult(patternQuizWord, ok);
    triggerAutoAdvance(ok);
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

  const patternQuizWord = quizList[quizIndex];
  const effectiveMode = quizMode === "flashrev"
    ? getFlashRevMode(patternQuizWord, quizIndex % FLASHREV_STEPS)
    : quizMode;
  const flashRevCount = list.filter((p) => p.flashRev).length;
  const flashRevUniqueWords = quizMode === "flashrev" ? quizList.length / FLASHREV_STEPS : quizList.length;
  const flashRevSubLabel = quizMode === "flashrev" ? ` · Q${(quizIndex % FLASHREV_STEPS) + 1}/${FLASHREV_STEPS}` : "";

  const resultPct = scoreModal.total > 0 ? (scoreModal.score / scoreModal.total) * 100 : 0;
  const resultPassed = resultPct >= PASS_PERCENT;
  const resultTheme =
    scoreModal.reason === "timeup"
      ? { gif: alertGif, color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5", badge: "⏰ Time Is Up!", title: "Time's Expired!", text: "The countdown clock reached zero. Here is how you did:" }
      : resultPassed
      ? { gif: successGif, color: "#166534", bg: "#dcfce7", border: "#86efac", badge: "🎉 Quiz Passed!", title: "Great Job!", text: `You reached the ${PASS_PERCENT}% pass mark. Well done!` }
      : { gif: alertGif, color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5", badge: "📚 Keep Practicing", title: "Not Quite There Yet", text: `You need at least ${PASS_PERCENT}% to pass. Review the patterns and try again.` };


  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          {/* Dashboard Stats */}
          <div className="stats-grid">
            <div className="stat dark">
              <div className="stat-head">
                <span className="stat-label">TOTAL PATTERNS</span>
                <span className="stat-pill dark">{patternsMastered} mastered</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value">{list.length}</span>
                <span className="stat-note" style={{ color: "#a8a29e" }}>active rules</span>
              </div>
            </div>

            <div className="stat">
              <div className="stat-head"><span className="stat-label">DER PATTERNS</span><span className="stat-pill bg-der">der</span></div>
              <div className="stat-foot"><span className="stat-value c-der">{countPattern("der")}</span></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">DIE PATTERNS</span><span className="stat-pill bg-die">die</span></div>
              <div className="stat-foot"><span className="stat-value c-die">{countPattern("die")}</span></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">DAS PATTERNS</span><span className="stat-pill bg-das">das</span></div>
              <div className="stat-foot"><span className="stat-value c-das">{countPattern("das")}</span></div>
            </div>
          </div>

          {/* Regular Toolbar */}
          <div className="toolbar">
            <div className="search">
              <span>🔍</span>
              <input
                type="search"
                placeholder="Search suffix, rule, or examples..."
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
                  value={statusFilter}
                  options={STATUS_FILTER_OPTIONS}
                  onChange={(val) => setStatusFilter(val)}
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
                title="Toggle Hourly Pattern Notification"
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                {hourlyAlertsActive ? "🔔 Alerts On" : "🔕 Alerts Off"}
              </button>

              <button
                type="button"
                onClick={handleTestNotification}
                className="btn btn-secondary"
                title="Send a pattern notification now"
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
                title="Reset all patterns"
              >
                🔄 Reset
              </button>
            </div>
          </div>

          {filteredPatterns.length === 0 ? (
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
                No Patterns Found
              </h3>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)", maxWidth: "340px", lineHeight: 1.5 }}>
                {search || articleFilter !== "all" || statusFilter !== "all" || dateFilter !== "all"
                  ? "We couldn't find any suffix patterns matching your current filters. Try changing or clearing them."
                  : "You haven't added any patterns yet. Add your first German suffix pattern to get started!"}
              </p>
              {search || articleFilter !== "all" || statusFilter !== "all" || dateFilter !== "all" ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: "16px" }}
                  onClick={() => {
                    setSearch("");
                    setArticleFilter("all");
                    setStatusFilter("all");
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
                  + Add First Pattern
                </button>
              )}
            </div>
          ) : (
            <div className="patterns-grid">
              {["der", "die", "das"]
                .filter((art) => articleFilter === "all" || articleFilter === art)
                .map((art) => {
                  const colItems = filteredPatterns.filter((p) => p.article === art);
                  return (
                    <div key={art} className={`pattern-col ${art}`}>
                      <div className="pattern-header">
                        <div>
                          <h3 className={`c-${art}`}>{GENDER_MAP[art]} Rules</h3>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>
                            {colItems.length} patterns
                          </span>
                        </div>
                        <span className={`stat-pill ${ARTICLE_CLASS[art]}`}>{art}</span>
                      </div>

                      {colItems.map((rule) => (
                        <div key={rule.id} className="pattern-card">
                          <div className="pattern-card-top">
                            <span className={`pattern-badge ${ARTICLE_CLASS[art]}`}>{rule.ending}</span>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <button
                                onClick={() => speakGerman(rule.examples || rule.ending)}
                                className="icon-btn"
                                title="Hear examples"
                              >
                                🔊
                              </button>
                              <button
                                onClick={() => openEditModal(rule)}
                                className="icon-btn"
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() =>
                                  onRequestConfirm(
                                    "Delete Suffix Pattern",
                                    `Delete rule for "${rule.ending}"?`,
                                    () => onCommitPatterns(list.filter((p) => p.id !== rule.id))
                                  )
                                }
                                className="pattern-delete-btn"
                                title="Delete"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          <p className="pattern-rule">{rule.rule}</p>
                          <p className="pattern-eg">e.g. {rule.examples}</p>
                          <button
                            onClick={() => toggleStatus(rule.id)}
                            className={`status ${rule.status === "Mastered" ? "done" : "todo"}`}
                            style={{ marginTop: 8 }}
                          >
                            {rule.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Floating Add Button */}
      {viewMode === "list" && (
        <button
          onClick={openAddModal}
          className="fab-btn"
          title="Add Suffix Pattern"
          aria-label="Add Suffix Pattern"
        >
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
              gap: "8px",
              width: "100%",
              maxWidth: "100%",
              overflowX: "auto",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
              padding: "4px 2px 12px 2px",
              marginBottom: "12px",
              borderBottom: "1px solid var(--line-2, #ebdccb)",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
              <CustomDropdown
                icon="👤"
                value={flashArticleFilter}
                options={GENDER_OPTIONS}
                onChange={handleFlashArticleChange}
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

            <div
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
            >
              <CustomDropdown
                icon="📅"
                value={flashDateMode}
                options={QUIZ_DATE_DROPDOWN_OPTIONS}
                onChange={handleFlashDateModeChange}
              />
              {flashDateMode === "specific" && (
                <RealCalendarPicker
                  selectedDate={flashSpecificDate}
                  onSelectDate={handleFlashDateSelect}
                />
              )}
            </div>

            <button
              type="button"
              onClick={handleShuffleFlashcards}
              className="btn btn-secondary"
              disabled={filteredFlashPool.length <= 1}
              title="Shuffle the filtered flashcards"
              style={{
                flexShrink: 0,
                whiteSpace: "nowrap",
                height: "40px",
                borderRadius: "12px",
                padding: "0 14px",
                opacity: filteredFlashPool.length <= 1 ? 0.55 : 1,
              }}
            >
              🔀 Shuffle
            </button>

            {(flashArticleFilter !== "all" ||
              flashStatusFilter !== "all" ||
              flashDateMode !== "all" ||
              flashSpecificDate) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearFlashFilters}
                style={{
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                  height: "40px",
                  borderRadius: "12px",
                  padding: "0 12px",
                  fontSize: "12.5px",
                }}
              >
                Clear Filters
              </button>
            )}

            <span
              style={{
                flexShrink: 0,
                color: "var(--muted)",
                fontSize: "13px",
                whiteSpace: "nowrap",
                paddingLeft: "2px",
              }}
            >
              Cards: <strong style={{ color: "var(--ink)" }}>{filteredFlashPool.length}</strong>
            </span>
          </div>

          {!flashList[cardIndex] ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
              <img src={noDataImg} alt="No Data" style={{ width: "160px", maxWidth: "80%", height: "auto", marginBottom: "12px" }} />
              <p style={{ color: "var(--muted)", margin: 0 }}>No patterns available for flashcards.</p>
            </div>
          ) : (
            <div className="flash-wrap">
              <div
                className="flash"
                onClick={handleFlipCard}
                onTouchStart={handleFlashTouchStart}
                onTouchEnd={handleFlashTouchEnd}
                style={{ position: "relative", touchAction: "pan-y" }}
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
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>WHICH ARTICLE BELONGS TO THIS PATTERN?</span>
                    <h2 style={{ fontFamily: "monospace" }}>{flashList[cardIndex].ending}</h2>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap or swipe to navigate · tap to reveal)</span>
                  </>
                ) : (
                  <>
                    <span className={`pill ${ARTICLE_CLASS[flashList[cardIndex].article]}`} style={{ fontSize: 22, padding: "6px 22px" }}>
                      {flashList[cardIndex].article} ({GENDER_MAP[flashList[cardIndex].article]})
                    </span>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-2)", margin: "14px 0 6px" }}>{flashList[cardIndex].rule}</p>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, fontStyle: "italic" }}>e.g. {flashList[cardIndex].examples}</p>
                  </>
                )}
              </div>
              <div className="flash-controls">
                <button className="btn btn-secondary flash-nav-btn" disabled={cardIndex === 0} onClick={handleFlashPrevious}>◀ Previous</button>
                <button className="btn btn-secondary mid" onClick={() => speakGerman(flashList[cardIndex].examples || flashList[cardIndex].ending)}>🔊 Hear Examples</button>
                <button className="btn btn-secondary flash-nav-btn" disabled={cardIndex >= flashList.length - 1} onClick={handleFlashNext}>Next ▶</button>
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                Pattern {cardIndex + 1} of {flashList.length} · {Math.round(((cardIndex + 1) / flashList.length) * 100)}% · {flashRevCount} queued for FlashRev
              </div>
            </div>
          )}
        </div>
      )}

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
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
              padding: "4px 2px 14px 2px",
              marginBottom: "16px",
              borderBottom: "1px solid var(--line-2, #ebdccb)",
            }}
          >
            {!(timerRunning || timerPaused) ? (
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
                  backgroundColor: timerPaused ? "#fff7ed" : (timeLeft <= 5 ? "#fef2f2" : "#f0fdf4"),
                  border: `1.5px solid ${timerPaused ? "#fdba74" : (timeLeft <= 5 ? "#f87171" : "#86efac")}`,
                  padding: "0 12px 0 16px",
                  borderRadius: "14px",
                  height: "44px",
                  boxSizing: "border-box",
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                }}
              >
                <span style={{ fontSize: "16px" }}>{timerPaused ? "⏸️" : (timeLeft <= 5 ? "🔥" : "⏳")}</span>
                <span style={{ fontSize: "15px", fontWeight: 800, color: timerPaused ? "#c2410c" : (timeLeft <= 5 ? "#dc2626" : "#15803d"), letterSpacing: "0.02em" }}>
                  {timeLeft}s {timerPaused ? "paused" : "remaining"}
                </span>
                {timerPaused ? (
                  <button type="button" onClick={handleResumeTimer} title="Resume Timer" style={{ width:"30px", height:"30px", borderRadius:"8px", border:"none", backgroundColor:"var(--brand, #b85c19)", color:"#fff", fontSize:"13px", fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", padding:0, marginLeft:"4px" }}>▶</button>
                ) : (
                  <button type="button" onClick={handlePauseTimer} title="Pause Timer" style={{ width:"30px", height:"30px", borderRadius:"8px", border:"1px solid #fca5a5", backgroundColor:"#fff", color:"#dc2626", fontSize:"12px", fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", padding:0, marginLeft:"4px" }}>⏸</button>
                )}
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

          {!patternQuizWord ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "36px 16px", textAlign: "center" }}>
              <img src={noDataImg} alt="No Data" style={{ width: "160px", maxWidth: "80%", height: "auto", marginBottom: "12px" }} />
              <p style={{ color: "var(--muted)", margin: "0 0 12px 0", fontSize: 15 }}>
                {list.length === 0 ? "Add patterns to start quiz." : quizMode === "flashrev" ? "No FlashRev patterns yet. Flip some flashcards, or miss a question in another quiz mode, and those patterns will show up here (or relax your filters)." : "No patterns match the selected status, date, or count filters."}
              </p>
              {(quizStatusFilter !== "all" || quizDateMode !== "all" || quizSpecificDate || wordCountInput) && (
                <button type="button" className="btn btn-secondary" onClick={() => { setQuizStatusFilter("all"); setQuizDateMode("all"); setQuizSpecificDate(""); setWordCountInput(""); resetQuizProgress(); }}>
                  Reset Quiz Filters
                </button>
              )}
            </div>
          ) : (
            <div className="quiz">
              <style>{`
        .flash-filter-row::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
                .timer-submit-mobile {
                  width: 48px;
                  height: 30px;
                  border-radius: 8px;
                  border: 1px solid #fca5a5;
                  background: #fff;
                  color: #dc2626;
                  font-size: 18px;
                  font-weight: 700;
                  cursor: pointer;
                  display: none;
                  align-items: center;
                  justify-content: center;
                  padding: 0;
                  margin-left: 2px;
                  line-height: 1;
                }
                .timer-submit-mobile:hover {
                  background: #fff7f7;
                }

                .quiz-submit-btn {
                  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                  height: 45px; padding: 0 12px; border: none; border-radius: 999px;
                  background: var(--brand, #b45309); color: #fff; font-size: 14px; font-weight: 800;
                  letter-spacing: 0.02em; cursor: pointer; box-shadow: 0 6px 16px rgba(180, 83, 9, 0.28);
                  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
                }
                .quiz-submit-btn:hover { transform: translateY(-2px); filter: brightness(1.08); box-shadow: 0 10px 22px rgba(180, 83, 9, 0.35); }
                .quiz-submit-btn:active { transform: translateY(0) scale(0.97); box-shadow: 0 3px 8px rgba(180, 83, 9, 0.3); }
                .quiz-submit-btn:focus-visible { outline: 3px solid rgba(180, 83, 9, 0.35); outline-offset: 2px; }
                .quiz-submit-btn .quiz-submit-tick { display: inline-flex; align-items: center; justify-content: center; width: 10px; height: 10px; border-radius: 50%; background: rgba(255, 255, 255, 0.25); font-size: 12px; }
                .quiz-submit-bottom { display: flex; justify-content: center; margin-top: 28px; }
                .quiz-submit-top { display: none; }
                @media (max-width: 768px) {
                  .timer-submit-mobile { display: inline-flex; }
                  .quiz-submit-top { display: none !important; }
                  .quiz-submit-bottom { display: none !important; }
                }
                @media (min-width: 769px) {
                  .quiz-head.quiz-head-with-submit { display: grid !important; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; }
                  .quiz-head-with-submit .quiz-head-left { justify-self: start; }
                  .quiz-head-with-submit .quiz-head-right { justify-self: end; }
                  .quiz-submit-top { display: inline-flex; }
                  .quiz-submit-bottom { display: none; }
                  .timer-submit-mobile { display: none !important; }
                }
                .flashrev-dots { display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:10px; }
                .flashrev-dot { width:8px; height:8px; border-radius:50%; background:var(--line-2,#e2e8f0); transition:background .2s ease,transform .2s ease; }
                .flashrev-dot.active { background:var(--brand,#b45309); transform:scale(1.3); }
                .flashrev-dot.done { background:#86efac; }
                @media (max-width:768px) { .flash-controls .flash-nav-btn { display:none !important; } }
              `}</style>

              <div className="quiz-head quiz-head-with-submit">
                <span className="quiz-head-left">
                  {quizMode === "flashrev" ? <>Pattern {Math.floor(quizIndex / FLASHREV_STEPS) + 1} of {flashRevUniqueWords}<span style={{ color:"var(--muted)", fontWeight:500 }}>{flashRevSubLabel}</span></> : <>Question {quizIndex + 1} of {quizList.length}</>}
                </span>
                <button type="button" className="quiz-submit-btn quiz-submit-top" onClick={handleSubmitQuiz} title="End the quiz now and see your result"><span className="quiz-submit-tick">✓</span> Submit Quiz</button>
                <span className="quiz-head-right" style={{ fontWeight:700, color:"var(--brand)" }}>Score: {quizScore}</span>
              </div>

              {quizMode === "flashrev" && (
                <div className="flashrev-dots">
                  {Array.from({length:FLASHREV_STEPS}).map((_,i)=>{ const subIdx=quizIndex%FLASHREV_STEPS; return <span key={i} className={`flashrev-dot ${i<subIdx?"done":i===subIdx?"active":""}`} title={["Article","Rule → Suffix","Example → Suffix"][i]} />; })}
                  <span style={{fontSize:12,color:"var(--muted)",marginLeft:6}}>{["Article","Rule → Suffix","Example → Suffix"][quizIndex%FLASHREV_STEPS]}</span>
                </div>
              )}

              <div className="quiz-card">
                {effectiveMode === "article" && (<>
                  <span style={{fontSize:13,color:"var(--muted)",fontWeight:500}}>Which article goes with this suffix / pattern?</span>
                  <h1 style={{fontFamily:"monospace"}}>{patternQuizWord.ending}</h1>
                  <p style={{color:"var(--muted)",margin:"4px 0",fontSize:14}}>Rule: <strong style={{color:"var(--ink-2)"}}>{patternQuizWord.rule}</strong></p>
                  {patternQuizWord.examples && <p style={{color:"var(--muted)",margin:0,fontSize:14}}>Examples: <strong style={{color:"var(--ink-2)"}}>{patternQuizWord.examples}</strong></p>}
                </>)}
                {effectiveMode === "ending" && (<>
                  <span style={{fontSize:13,color:"var(--muted)",fontWeight:500}}>Type the German suffix / ending for this rule:</span>
                  <h1 style={{color:"var(--brand,#b85c19)"}}>{patternQuizWord.rule}</h1>
                </>)}
                {effectiveMode === "examples" && (<>
                  <span style={{fontSize:13,color:"var(--muted)",fontWeight:500}}>Type the suffix / ending represented by these examples:</span>
                  <h1>{patternQuizWord.examples || "—"}</h1>
                  <p style={{color:"var(--muted)",margin:0,fontSize:15}}>Article: <strong>{patternQuizWord.article}</strong></p>
                </>)}
              </div>

              {effectiveMode === "article" ? (
                <div className="quiz-opts">{["der","die","das"].map((opt)=><button key={opt} disabled={quizAnswerState!=="idle"} className={`quiz-opt ${opt}`} onClick={()=>handleArticleOptionSelect(opt)}>{opt}</button>)}</div>
              ) : (
                <form onSubmit={handlePatternTextSubmit} style={{marginTop:18,display:"flex",flexDirection:"column",alignItems:"center",gap:12,width:"100%",maxWidth:420,marginInline:"auto"}}>
                  <input autoFocus type="text" value={quizTextInput} disabled={quizAnswerState!=="idle"} onChange={(e)=>setQuizTextInput(e.target.value)} placeholder="Type your answer..." style={{width:"100%",height:46,borderRadius:12,border:"2px solid #ebdccb",padding:"0 14px",fontSize:16,outline:"none",textAlign:"center"}} />
                  <button type="submit" disabled={quizAnswerState!=="idle" || !quizTextInput.trim()} className="btn btn-primary" style={{minWidth:130,justifyContent:"center"}}>Check</button>
                </form>
              )}

              {quizFeedback && <div style={{marginTop:20,textAlign:"center",animation:"fadeIn .15s ease-in"}}>
                <p style={{fontSize:16,fontWeight:700,color:quizAnswerState==="correct"?"#15803d":"#dc2626"}}>{quizFeedback}</p>
                {quizAnswerState==="correct" && <span style={{fontSize:12,color:"var(--muted)"}}>{quizMode==="flashrev" && quizIndex%FLASHREV_STEPS<FLASHREV_STEPS-1 ? "Next sub-question in 1 second..." : "Moving to next word in 1 second..."}</span>}
              </div>}

              <div className="quiz-submit-bottom" style={{alignItems:"center",justifyContent:"center",gap:12,marginTop:16}}>
                <button type="button" className="quiz-submit-btn" onClick={handleSubmitQuiz}><span className="quiz-submit-tick">✓</span> Submit Quiz</button>
                {quizAnswerState === "wrong" && <button type="button" className="btn btn-primary quiz-next-symbol" autoFocus onClick={handleForwardClick} title={quizIndex<quizList.length-1?"Next question":"Finish quiz"} style={{width:45,height:45,padding:0,borderRadius:14,fontSize:30,fontWeight:800}}>&gt;</button>}
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
                  }
                }}
              >
                Try Again 🚀
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Study Goals Modal */}
      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        defaultCategory="Patterns"
        categoryStats={{
          Patterns: {
            dailyCurrent: patternDailyCount,
            weeklyCurrent: patternWeeklyCount,
          },
        }}
        initialDailyTarget={patternDailyTarget}
        initialWeeklyTarget={patternWeeklyTarget}
      />

      {/* Add / Edit Pattern Modal */}
      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>{editingPatternId ? "Edit Suffix / Pattern Rule" : "Add Suffix / Pattern Rule"}</h3>
            <form onSubmit={handleSaveModal}>
              <div>
                <label className="modal-label">Target Article (Gender)</label>
                <div className="radios">
                  {["der", "die", "das"].map((art) => (
                    <label key={art} className={`radio ${patternFormData.article === art ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="patternArticle"
                        value={art}
                        checked={patternFormData.article === art}
                        onChange={(e) => setPatternFormData({ ...patternFormData, article: e.target.value })}
                      />
                      {art}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="modal-label">Ending / Pattern Suffix</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="modal-input"
                    style={{ flex: 1 }}
                    type="text"
                    required
                    placeholder="e.g. -tion"
                    value={patternFormData.ending}
                    onChange={(e) => {
                      setAiError("");
                      setPatternFormData({ ...patternFormData, ending: e.target.value });
                    }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={generateGermanPattern} disabled={aiLoading}>
                    {aiLoading ? "Generating..." : "✨ Generate"}
                  </button>
                </div>
                {aiError && <p style={{ color: "#dc2626", fontSize: 13, margin: "6px 0 0" }}>{aiError}</p>}
              </div>

              <div>
                <label className="modal-label">Rule / Explanation</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. Words of Latin origin"
                  value={patternFormData.rule}
                  onChange={(e) => setPatternFormData({ ...patternFormData, rule: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Examples</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. die Station, die Nation"
                  value={patternFormData.examples}
                  onChange={(e) => setPatternFormData({ ...patternFormData, examples: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Status</label>
                <CustomDropdown
                  fullWidth
                  value={patternFormData.status}
                  options={STATUS_OPTIONS}
                  onChange={(val) => setPatternFormData({ ...patternFormData, status: val })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Pattern
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
              style={{ width: 90, height: 90, objectFit: "contain", marginBottom: 16 }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#dc2626" }}>Reset All Patterns?</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              Are you sure you want to delete all patterns? This action will permanently remove your entire pattern list and cannot be undone.
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

      {/* Duplicate Alert Modal */}
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
              style={{ width: 100, height: 100, objectFit: "contain", marginBottom: 16 }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--ink)" }}>Pattern Already Exists!</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{duplicateName}"</strong> is already in your patterns list for this article.
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
              style={{ width: 105, height: 105, objectFit: "contain", marginBottom: 12 }}
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
                  <strong style={{ color: "#b85c19" }}>{goalCelebration.target} patterns</strong>!
                </>
              ) : (
                <>
                  Phenomenal work! You hit your weekly goal of{" "}
                  <strong style={{ color: "#b85c19" }}>{goalCelebration.target} patterns</strong>!
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
              style={{ width: 100, height: 100, objectFit: "contain", marginBottom: 16 }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--brand, #16a34a)" }}>
              {successInfo.isEdit ? "Pattern Updated!" : "Pattern Added Successfully!"}
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{successInfo.ending}" → {successInfo.article}</strong> has been saved to your patterns.
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
            <h3 style={{ margin: "0 0 16px", fontSize: 20, color: "var(--ink)" }}>Import Summary</h3>

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
                <div style={{ fontSize: 12, textTransform: "uppercase", marginTop: 4, letterSpacing: 0.5 }}>Added</div>
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
                <div style={{ fontSize: 12, textTransform: "uppercase", marginTop: 4, letterSpacing: 0.5 }}>Duplicates</div>
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
                <strong>Skipped patterns:</strong>{" "}
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