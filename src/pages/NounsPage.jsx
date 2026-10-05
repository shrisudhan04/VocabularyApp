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
  { label: "Article (der/die/das)", value: "article" },
  { label: "English ➔ Noun", value: "english" },
  { label: "Plural Form", value: "plural" },
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

  // Quiz Controls: Question Count Limit & Timer
  const [wordCountInput, setWordCountInput] = useState("");
  const [timerInput, setTimerInput] = useState("30");
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);

  // Shuffle seed for quiz ordering
  const [quizShuffleKey, setQuizShuffleKey] = useState(0);

  // Quiz Progress
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);

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

  const [hourlyAlertsActive, setHourlyAlertsActive] = useState(false);
  const fileInputRef = useRef(null);

  // Date Filtering Evaluator
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

  // Quiz Filtered Words with Count Limit & Shuffle Order
  const availableQuizPool = useMemo(() => {
    const filtered = list.filter((item) => {
      const itemStatus = item.status || "In Progress";
      const matchesStatus = quizStatusFilter === "all" || itemStatus === quizStatusFilter;
      const matchesDate = matchesDateFilter(item.createdAt, quizDateMode, quizSpecificDate);
      return matchesStatus && matchesDate;
    });

    // If shuffled, randomize order
    return quizShuffleKey > 0 ? shuffleArray(filtered) : filtered;
  }, [list, quizStatusFilter, quizDateMode, quizSpecificDate, quizShuffleKey]);

  const quizList = useMemo(() => {
    const count = parseInt(wordCountInput, 10);
    if (!isNaN(count) && count > 0) {
      return availableQuizPool.slice(0, count);
    }
    return availableQuizPool;
  }, [availableQuizPool, wordCountInput]);

  // Countdown Timer
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
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback(null);
    setQuizTextInput("");
  };

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

  // Global Shuffle Handlers
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
    const shuffled = shuffleArray(list);
    onCommitNouns?.(shuffled);
    setCardIndex(0);
    setCardFlipped(false);
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

  // Goal helpers
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
                status: status.toLowerCase() === "mastered" ? "Mastered" : "In Progress",
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

  const handleQuizTextSubmit = (e) => {
    e?.preventDefault();
    if (quizFeedback !== null || !nounQuizWord) return;

    const entered = normalize(quizTextInput);

    if (quizMode === "english") {
      const targetNoun = normalize(nounQuizWord.noun);
      const isCorrect = entered === targetNoun;
      if (isCorrect) setQuizScore((prev) => prev + 1);
      setQuizFeedback(
        isCorrect
          ? "Correct! 🎉"
          : `Incorrect. The correct word is "${nounQuizWord.article} ${nounQuizWord.noun}".`
      );
    } else if (quizMode === "plural") {
      const expectedPlural = nounQuizWord.plural || "";
      const targetPlural = normalize(expectedPlural.replace(/^die\s+/i, ""));
      const enteredPluralClean = entered.replace(/^die\s+/i, "");

      const isCorrect = Boolean(targetPlural) && enteredPluralClean === targetPlural;
      if (isCorrect) setQuizScore((prev) => prev + 1);
      setQuizFeedback(
        isCorrect
          ? "Correct! 🎉"
          : `Incorrect. The correct plural is "${expectedPlural || "—"}".`
      );
    }
  };

  const nounCard = list[cardIndex];
  const nounQuizWord = quizList[quizIndex];

  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          <div className="stats-grid">
            <div className="stat dark">
              <div className="stat-head">
                <span className="stat-label">TOTAL NOUNS</span>
                <span className="stat-pill dark">{nounsMastered} mastered</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value">{list.length}</span>
                <span className="stat-note" style={{ color: "#a8a29e" }}>all genders</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">MASCULINE</span><span className="stat-pill bg-der">der</span></div>
              <div className="stat-foot"><span className="stat-value c-der">{countNoun("der")}</span></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">FEMININE</span><span className="stat-pill bg-die">die</span></div>
              <div className="stat-foot"><span className="stat-value c-die">{countNoun("die")}</span></div>
            </div>
            <div className="stat">
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

              {/* 🔀 List Shuffle Button */}
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
                    >
                      {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                    </button>
                  </div>
                  <div className="actions">
                    <button onClick={() => speakGerman(`${item.article} ${item.noun}. ${item.plural || ""}`)} className="icon-btn">🔊</button>
                    <button onClick={() => openEditModal(item)} className="icon-btn">✏</button>
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
              <div className="flash" onClick={() => setCardFlipped(!cardFlipped)}>
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
              <div className="flash-controls">
                <button className="btn btn-secondary" disabled={cardIndex === 0} onClick={() => { setCardIndex(cardIndex - 1); setCardFlipped(false); }}>
                  ◀ Previous
                </button>
                <button className="btn btn-secondary mid" onClick={() => speakGerman(`${nounCard.article} ${nounCard.noun}. ${nounCard.plural || ""}`)}>
                  🔊 Pronounce
                </button>
                {/* 🔀 Flashcard Shuffle Button */}
                
                <button className="btn btn-secondary" disabled={cardIndex >= list.length - 1} onClick={() => { setCardIndex(cardIndex + 1); setCardFlipped(false); }}>
                  Next ▶
                </button>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Card {cardIndex + 1} of {list.length}</span>
            </div>
          )}
        </div>
      )}

      {viewMode === "quiz" && (
        <div className="panel" style={{ marginTop: "-6px", paddingTop: "14px" }}>
          {/* 🎛️ QUIZ TOOLBAR: When timer is running, ONLY the timer is visible */}
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
                {/* 1. Quiz Mode Dropdown (Article, English, Plural) */}
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

                {/* 3. Date Filter Custom Dropdown */}
                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <CustomDropdown
                    icon="📅"
                    value={quizDateMode}
                    options={QUIZ_DATE_DROPDOWN_OPTIONS}
                    onChange={handleQuizDateModeChange}
                  />
                </div>

                {/* 4. Real Calendar Picker: Appears ONLY when 'Specific Date...' is chosen */}
                {quizDateMode === "specific" && (
                  <RealCalendarPicker
                    selectedDate={quizSpecificDate}
                    onSelectDate={handleQuizCalendarDateSelect}
                  />
                )}

                {/* 5. Words Count Limit Pill */}
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
                  <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--ink, #1f2937)" }}>Count:</span>
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

                {/* 🔀 7. Quiz Shuffle Button */}
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

                {/* Words Pool Count */}
                <div
                  style={{
                    flexShrink: 0,
                    fontSize: "13.5px",
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                    paddingLeft: "4px",
                  }}
                >
                  Words: <strong style={{ color: "var(--ink)" }}>{quizList.length}</strong>
                </div>

                {/* Clear Filters */}
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
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: timeLeft <= 5 ? "#dc2626" : "#15803d",
                    letterSpacing: "0.02em",
                  }}
                >
                  {timeLeft}s remaining
                </span>

                <button
                  type="button"
                  onClick={handleStopTimer}
                  title="Stop Timer"
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
                    padding: 0,
                    marginLeft: "4px",
                  }}
                >
                  ⏸
                </button>
              </div>
            )}
          </div>

          {!nounQuizWord ? (
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
                  ? "Add nouns to start quiz."
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
            <div className="quiz">
              <div className="quiz-head">
                <span>Question {quizIndex + 1} of {quizList.length}</span>
                <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {quizScore}</span>
              </div>

              <div className="quiz-card">
                {quizMode === "article" && (
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

                {quizMode === "english" && (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                      Type the German singular noun for:
                    </span>
                    <h1 style={{ color: "var(--brand, #b85c19)" }}>{nounQuizWord.meaning}</h1>
                  </>
                )}

                {quizMode === "plural" && (
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

              {quizMode === "article" ? (
                <div className="quiz-opts">
                  {["der", "die", "das"].map((opt) => (
                    <button
                      key={opt}
                      disabled={quizFeedback !== null}
                      className={`quiz-opt ${opt}`}
                      onClick={() => {
                        const ok = opt === nounQuizWord.article;
                        const nextScore = ok ? quizScore + 1 : quizScore;
                        if (ok) setQuizScore(nextScore);
                        setQuizFeedback(
                          ok
                            ? "Correct! 🎉"
                            : `Wrong! Correct article is "${nounQuizWord.article}".`
                        );
                      }}
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
                  <div style={{ display: "flex", width: "100%", gap: 8 }}>
                    <input
                      type="text"
                      autoFocus
                      disabled={quizFeedback !== null}
                      placeholder={
                        quizMode === "english"
                          ? "Type German word (e.g. Apfel)..."
                          : "Type plural form (e.g. Äpfel)..."
                      }
                      value={quizTextInput}
                      onChange={(e) => setQuizTextInput(e.target.value)}
                      className="modal-input"
                      style={{
                        flex: 1,
                        height: "46px",
                        fontSize: "16px",
                        fontWeight: 600,
                        borderRadius: "12px",
                        border: "1.5px solid var(--line-2, #ebdccb)",
                        padding: "0 14px",
                        outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      disabled={quizFeedback !== null || !quizTextInput.trim()}
                      className="btn btn-primary"
                      style={{ height: "46px", padding: "0 18px", borderRadius: "12px", marginTop: 7 }}
                    >
                      Check
                    </button>
                  </div>
                </form>
              )}

              {quizFeedback && (
                <div style={{ marginTop: 24, textAlign: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 700 }}>{quizFeedback}</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setQuizFeedback(null);
                      setQuizTextInput("");
                      if (quizIndex < quizList.length - 1) {
                        setQuizIndex((i) => i + 1);
                      } else {
                        setTimerRunning(false);
                        setTimeLeft(null);
                        setScoreModal({
                          isOpen: true,
                          reason: "finish",
                          score: quizScore,
                          total: quizList.length,
                        });
                      }
                    }}
                  >
                    {quizIndex < quizList.length - 1 ? "Next Word" : "Complete Quiz"}
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
              src={scoreModal.reason === "timeup" ? alertGif : (scoreModal.score > 0 ? congratsGif : alertGif)}
              alt="Quiz Results"
              style={{ width: 95, height: 95, objectFit: "contain", marginBottom: 12 }}
            />

            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: scoreModal.reason === "timeup" ? "#b91c1c" : "#b85c19",
                backgroundColor: scoreModal.reason === "timeup" ? "#fee2e2" : "#fef3c7",
                border: `1px solid ${scoreModal.reason === "timeup" ? "#fca5a5" : "#fde68a"}`,
                padding: "4px 12px",
                borderRadius: 20,
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              {scoreModal.reason === "timeup" ? "⏰ Time Is Up!" : "🎉 Quiz Completed!"}
            </span>

            <h3 style={{ margin: "4px 0 6px", fontSize: 22, color: "var(--ink)" }}>
              {scoreModal.reason === "timeup" ? "Time's Expired!" : "Great Effort!"}
            </h3>

            <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: 14 }}>
              {scoreModal.reason === "timeup"
                ? "The countdown clock reached zero. Here is how you did:"
                : "You have reviewed all the questions in your pool!"}
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
                <div style={{ fontSize: "26px", fontWeight: 800, color: "#166534" }}>
                  {scoreModal.total > 0 ? Math.round((scoreModal.score / scoreModal.total) * 100) : 0}%
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
                onClick={() => setScoreModal((p) => ({ ...p, isOpen: false }))}
              >
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
        defaultCategory="Nouns"
        categoryStats={{
          Nouns: {
            dailyCurrent: nounDailyCount,
            weeklyCurrent: nounWeeklyCount,
          },
        }}
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
                  onChange={(e) => setNounFormData({ ...nounFormData, noun: e.target.value })}
                />
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
                  options={STATUS_OPTIONS}
                  onChange={(val) => setNounFormData({ ...nounFormData, status: val })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
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
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#dc2626" }}>Reset All Nouns?</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              Are you sure you want to delete all nouns? This action will permanently remove your entire vocabulary list and cannot be undone.
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
              style={{ width: 100, height: 100, objectFit: "contain", marginBottom: 16 }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--ink)" }}>Word Already Exists!</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{duplicateWordName}"</strong> is already in your vocabulary list.
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
                  <strong style={{ color: "#b85c19" }}>{goalCelebration.target} nouns</strong>!
                </>
              ) : (
                <>
                  Phenomenal work! You hit your weekly goal of{" "}
                  <strong style={{ color: "#b85c19" }}>{goalCelebration.target} nouns</strong>!
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
              {successWordInfo.isEdit ? "Noun Updated!" : "Noun Added Successfully!"}
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{successWordInfo.article} {successWordInfo.noun}"</strong> has been saved to your vocabulary.
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