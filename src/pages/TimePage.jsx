import { useState, useRef, useEffect, useMemo } from "react";
import {
  requestMobileNotificationPermission,
  startHourlyNounNotifier,
  sendNounNotification,
} from "../utils/hourlyWordNotifier";
import * as XLSX from "xlsx";
import CustomDropdown from "../components/CustomDropdown";
import GoalModal from "../components/GoalModal";
import { TIME_RULES, TIME_FLASHCARDS } from "../constants/grammarData";
import { STATUS_OPTIONS } from "../constants/seedData";
import { speakGerman } from "../utils/speech";
import { GoogleGenAI, Type } from "@google/genai";
import alertGif from "../assets/Alert.gif";
import successGif from "../assets/Success.gif";
import congratsGif from "../assets/Congrats.gif";
import warningRedGif from "../assets/WarningRed.gif";
import congratsAudio from "../assets/celebration.mp3";
import noDataImg from "../assets/nodata.svg";
import "../App.css";

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

const VIEW_FORMAT_OPTIONS = [
  { label: "⚖️ Compare Both", value: "all" },
  { label: "🏢 Formal (24h)", value: "formal" },
  { label: "☕ Informal (12h)", value: "informal" },
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
              <span key={lbl} style={{ fontSize: "11px", fontWeight: 700, color: idx === 0 || idx === 6 ? "#ef4444" : "#9ca3af", padding: "4px 0" }}>
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

export default function TimePage({
  viewMode = "list",
  timeList = [],
  onCommitTimes,
  onRequestConfirm,
}) {
  const list = Array.isArray(timeList) ? timeList : [];

  const [search, setSearch] = useState("");
  const [timeViewMode, setTimeViewMode] = useState("all");
  const [timeStatusFilter, setTimeStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  // Quiz State
  const [quizStatusFilter, setQuizStatusFilter] = useState("all");
  const [quizDateMode, setQuizDateMode] = useState("all");
  const [quizSpecificDate, setQuizSpecificDate] = useState("");
  const [wordCountInput, setWordCountInput] = useState("");
  const [timerInput, setTimerInput] = useState("30");
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [quizTextInput, setQuizTextInput] = useState("");

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [quizAnswerState, setQuizAnswerState] = useState("idle"); // 'idle' | 'correct' | 'wrong'
  const [quizShuffleKey, setQuizShuffleKey] = useState(0);
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
  const [editingTimeId, setEditingTimeId] = useState(null);
  const [timeFormData, setTimeFormData] = useState({
    digital: "",
    formal: "",
    informal: "",
    rule: "",
    status: "In Progress",
  });

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateWordName, setDuplicateWordName] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successWordInfo, setSuccessWordInfo] = useState({ digital: "", formal: "", isEdit: false });
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalCelebration, setGoalCelebration] = useState({
    isOpen: false,
    goalType: "daily",
    target: 5,
    current: 5,
    addedWord: "",
  });

  const [importSummary, setImportSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

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
      return matchesStatus && matchesDate;
    });
    return quizShuffleKey > 0 ? shuffleArray(filtered) : filtered;
  }, [list, quizStatusFilter, quizDateMode, quizSpecificDate, quizShuffleKey]);

  const quizList = useMemo(() => {
    const count = parseInt(wordCountInput, 10);
    if (!isNaN(count) && count > 0) {
      return availableQuizPool.slice(0, count);
    }
    return availableQuizPool;
  }, [availableQuizPool, wordCountInput]);

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
    setQuizAnswerState("idle");
    setQuizTextInput("");
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
    const sample = list.length > 0 ? list[Math.floor(Math.random() * list.length)] : { digital: "12:00", formal: "zwölf Uhr" };
    await sendNounNotification({ article: "die", noun: `Uhrzeit ${sample.digital}`, plural: sample.formal, meaning: "Time Expression" });
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
          daily: Number(parsed.Time?.daily) || 5,
          weekly: Number(parsed.Time?.weekly) || 25,
        };
      }
    } catch (e) {
      console.warn("Failed to read study_goals_targets:", e);
    }
    return {
      daily: Number(localStorage.getItem("goal_daily_target")) || 5,
      weekly: Number(localStorage.getItem("goal_weekly_target")) || 25,
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

  const { daily: timeDailyCount, weekly: timeWeeklyCount } = getGoalCounts(list);
  const { daily: timeDailyTarget, weekly: timeWeeklyTarget } = getSavedTargets();

  const handleConfirmReset = () => {
    playDangerSound();
    onCommitTimes?.([]);
    setCardIndex(0);
    setCardFlipped(false);
    resetQuizProgress();
    setResetModalOpen(false);
  };

  const exportToExcel = () => {
    if (list.length === 0) {
      alert("No time expressions to export.");
      return;
    }

    const exportData = list.map((item, index) => ({
      "#": index + 1,
      Digital: item.digital,
      "Formal (24h)": item.formal,
      "Informal (12h)": item.informal || "",
      "Rule / Pattern": item.rule || "",
      Status: item.status || "In Progress",
      CreatedAt: item.createdAt || new Date().toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "German_Uhrzeit");

    XLSX.writeFile(workbook, `German_Time_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

        const existingTimeSet = new Set(list.map((t) => t.digital?.trim().toLowerCase()));
        const newEntries = [];
        const duplicateWords = [];

        rawJson.forEach((row, i) => {
          const rowLower = {};
          Object.keys(row).forEach((k) => {
            rowLower[k.trim().toLowerCase()] = row[k];
          });

          const digital = (rowLower.digital || rowLower["time"] || rowLower["uhrzeit"] || "").toString().trim();
          const formal = (rowLower.formal || rowLower["formal (24h)"] || rowLower["offiziell"] || "").toString().trim();
          const informal = (rowLower.informal || rowLower["informal (12h)"] || rowLower["umgangssprachlich"] || "").toString().trim();
          const rule = (rowLower.rule || rowLower["rule / pattern"] || rowLower["explanation"] || "").toString().trim();
          const status = (rowLower.status || "In Progress").toString().trim();

          if (digital && formal) {
            const lowerDigital = digital.toLowerCase();
            if (existingTimeSet.has(lowerDigital)) {
              duplicateWords.push(digital);
            } else {
              existingTimeSet.add(lowerDigital);
              newEntries.push({
                id: `t-${Date.now() + i}`,
                digital,
                formal,
                informal,
                rule,
                status: status.toLowerCase() === "mastered" ? "Mastered" : "In Progress",
                createdAt: new Date().toISOString(),
              });
            }
          }
        });

        if (newEntries.length > 0) {
          const updatedList = [...list, ...newEntries];
          const reachedGoal = verifyGoalMilestone(list, updatedList, `${newEntries.length} new time expressions`);
          if (!reachedGoal) playSuccessSound();
          onCommitTimes?.(updatedList);
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

  const generateGermanTime = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setAiError("VITE_GEMINI_API_KEY is not defined in your .env file.");
      return;
    }
    if (!timeFormData.digital.trim()) {
      setAiError("Please provide a digital time first (e.g. 14:45).");
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");

      const ai = new GoogleGenAI({ apiKey });
      const promptConfig = {
        contents: `For the given 24h digital time "${timeFormData.digital.trim()}", provide:
1. The exact official formal phrasing in German (e.g., "Es ist vierzehn Uhr fünfundvierzig.").
2. The standard colloquial/informal 12h phrasing in German (e.g., "Es ist Viertel vor drei.").
3. The concise grammatical rule or pattern used.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              formal: { type: Type.STRING },
              informal: { type: Type.STRING },
              rule: { type: Type.STRING },
            },
            required: ["formal", "informal", "rule"],
          },
        },
      };

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        ...promptConfig,
      });

      const parsed = JSON.parse(response.text);
      setTimeFormData((prev) => ({
        ...prev,
        formal: parsed.formal,
        informal: parsed.informal,
        rule: parsed.rule,
      }));
    } catch (err) {
      setAiError(err.message || "Failed to generate German time phrasing.");
    } finally {
      setAiLoading(false);
    }
  };

  const filteredTimes = list.filter((item) => {
    const q = normalize(search);
    const matchesSearch =
      !q ||
      normalize(item.digital).includes(q) ||
      normalize(item.formal).includes(q) ||
      normalize(item.informal).includes(q) ||
      normalize(item.rule).includes(q);
    const matchesStatus = timeStatusFilter === "all" || (item.status || "In Progress") === timeStatusFilter;
    return matchesSearch && matchesStatus && matchesDateFilter(item.createdAt, dateFilter, customDate);
  });

  const openAddModal = () => {
    setEditingTimeId(null);
    setAiError("");
    setTimeFormData({ digital: "", formal: "", informal: "", rule: "", status: "In Progress" });
    setModalOpen(true);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    const cleanDigital = timeFormData.digital.trim();
    if (!cleanDigital || !timeFormData.formal.trim()) return;

    const isDuplicate = list.some(
      (item) => item.digital.trim().toLowerCase() === cleanDigital.toLowerCase() && (item.id || item.digital) !== editingTimeId
    );

    if (isDuplicate) {
      playDuplicateSound();
      setDuplicateWordName(cleanDigital);
      setDuplicateModalOpen(true);
      return;
    }

    let updated;
    const isEditing = Boolean(editingTimeId);

    if (isEditing) {
      updated = list.map((item) =>
        (item.id || item.digital) === editingTimeId ? { ...item, ...timeFormData } : item
      );
    } else {
      updated = [
        ...list,
        {
          id: `t-${Date.now()}`,
          ...timeFormData,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const reachedGoal = !isEditing && verifyGoalMilestone(list, updated, cleanDigital);
    if (!reachedGoal && !isEditing) playSuccessSound();

    onCommitTimes?.(updated);
    setModalOpen(false);

    if (!reachedGoal) {
      setSuccessWordInfo({ digital: cleanDigital, formal: timeFormData.formal, isEdit: isEditing });
      setSuccessModalOpen(true);
    }
  };

  // 🔢 Number to German words submit logic
  const handleQuizTextSubmit = (e) => {
    e?.preventDefault();
    if (quizFeedback !== null || !timeQuizWord) return;

    const entered = normalize(quizTextInput);
    const cleanFormal = normalize(timeQuizWord.formal.replace(/^es\s+ist\s+/i, ""));
    const cleanInformal = normalize((timeQuizWord.informal || "").replace(/^es\s+ist\s+/i, ""));

    const isMatch = entered === cleanFormal || entered === normalize(timeQuizWord.formal) ||
      (cleanInformal && (entered === cleanInformal || entered === normalize(timeQuizWord.informal)));

    if (isMatch) setQuizScore((prev) => prev + 1);

    setQuizFeedback(
      isMatch
        ? "Correct! 🎉"
        : `Incorrect. The German words for this number/time are: "${timeQuizWord.formal}"${timeQuizWord.informal ? ` or "${timeQuizWord.informal}"` : ""}.`
    );

    triggerAutoAdvance(isMatch);
  };

  const timeCard = list[cardIndex] || TIME_FLASHCARDS[cardIndex];
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

  // Shuffle handlers
  const handleShuffleList = () => {
    if (list.length <= 1) return;
    onCommitTimes?.(shuffleArray(list));
  };

  const handleShuffleQuiz = () => {
    setQuizShuffleKey((k) => k + 1);
    resetQuizProgress();
  };

  const handleShuffleFlashcards = () => {
    if (list.length <= 1) return;
    onCommitTimes?.(shuffleArray(list));
    setCardIndex(0);
    setCardFlipped(false);
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

  const timeQuizWord = quizList[quizIndex];

  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          <div className="stats-grid">
            <div className="stat dark">
              <div className="stat-head">
                <span className="stat-label">TOTAL TIME ENTRIES</span>
                <span className="stat-pill dark">{list.length} saved</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value">{list.length}</span>
                <span className="stat-note" style={{ color: "#a8a29e" }}>formal &amp; informal</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">RULES</span><span className="stat-pill bg-der">Rules</span></div>
              <div className="stat-foot"><span className="stat-value c-der">{TIME_RULES.length}</span></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">FLASHCARDS</span><span className="stat-pill bg-die">Deck</span></div>
              <div className="stat-foot"><span className="stat-value c-die">{TIME_FLASHCARDS.length}</span></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">MASTERED</span><span className="stat-pill bg-das">Status</span></div>
              <div className="stat-foot"><span className="stat-value c-das">{list.filter((i) => i.status === "Mastered").length}</span></div>
            </div>
          </div>

          <div className="toolbar">
            <div className="search">
              <span>🔍</span>
              <input
                type="search"
                placeholder="Search digital time, formal, or rule..."
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
                  value={timeViewMode}
                  options={VIEW_FORMAT_OPTIONS}
                  onChange={(val) => setTimeViewMode(val)}
                />
              </div>

              <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                <CustomDropdown
                  icon="📌"
                  value={timeStatusFilter}
                  options={STATUS_FILTER_OPTIONS}
                  onChange={(val) => setTimeStatusFilter(val)}
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
                title="Reset all time expressions"
              >
                🔄 Reset
              </button>
            </div>
          </div>

          {filteredTimes.length === 0 ? (
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
              <img src={noDataImg} alt="No Data Found" style={{ width: "200px", maxWidth: "80%", marginBottom: "16px" }} />
              <h3 style={{ margin: "0 0 8px", fontSize: "19px", fontWeight: 700 }}>No Time Expressions Found</h3>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)" }}>Add a new digital time to get started!</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="grammar-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Digital</th>
                    {(timeViewMode === "all" || timeViewMode === "formal") && <th>Formal (Offiziell / 24h)</th>}
                    {(timeViewMode === "all" || timeViewMode === "informal") && <th>Informal (Umgangssprachlich / 12h)</th>}
                    <th>Rule / Structure</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTimes.map((t) => (
                    <tr key={t.id || t.digital}>
                      <td style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 14 }}>{t.digital}</td>
                      {(timeViewMode === "all" || timeViewMode === "formal") && (
                        <td style={{ color: "var(--der)", fontWeight: 600 }}>{t.formal}</td>
                      )}
                      {(timeViewMode === "all" || timeViewMode === "informal") && (
                        <td style={{ color: "var(--die)", fontWeight: 600 }}>{t.informal || "—"}</td>
                      )}
                      <td style={{ fontSize: 13, color: "var(--muted)" }}>{t.rule || "—"}</td>
                      <td>
                        <button
                          onClick={() =>
                            onCommitTimes?.(
                              list.map((i) =>
                                (i.id || i.digital) === (t.id || t.digital)
                                  ? { ...i, status: i.status === "Mastered" ? "In Progress" : "Mastered" }
                                  : i
                              )
                            )
                          }
                          className={`status ${t.status === "Mastered" ? "done" : "todo"}`}
                        >
                          {t.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                        </button>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => speakGerman(timeViewMode === "formal" ? t.formal : t.informal || t.formal)}
                            className="icon-btn"
                          >
                            🔊
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTimeId(t.id || t.digital);
                              setAiError("");
                              setTimeFormData({
                                digital: t.digital,
                                formal: t.formal,
                                informal: t.informal || "",
                                rule: t.rule || "",
                                status: t.status || "In Progress",
                              });
                              setModalOpen(true);
                            }}
                            className="icon-btn"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onRequestConfirm?.("Delete Time Entry", `Are you sure you want to delete "${t.digital}"?`, () =>
                                onCommitTimes?.(list.filter((item) => (item.id || item.digital) !== (t.id || t.digital)))
                              )
                            }
                            className="icon-btn"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grammar-rule-box">
            <strong>Essential Uhrzeit Rules:</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 10 }}>
              {TIME_RULES.map((r, i) => (
                <div key={i} style={{ background: "var(--card)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line-2)" }}>
                  <span style={{ fontWeight: 700, color: "var(--brand)", fontSize: 13 }}>{r.term}</span>
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4 }}>{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === "list" && (
        <button onClick={openAddModal} className="fab-btn" title="Add Time" aria-label="Add Time">
          +
        </button>
      )}

      {viewMode === "flashcards" && (
        <div className="panel">
          {!timeCard ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px" }}>
              <img src={noDataImg} alt="No Data" style={{ width: "160px", marginBottom: "12px" }} />
              <p style={{ color: "var(--muted)", margin: 0 }}>No time entries available.</p>
            </div>
          ) : (
            <div className="flash-wrap">
              <div className="flash" onClick={() => setCardFlipped(!cardFlipped)}>
                {!cardFlipped ? (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>HOW DO YOU SAY THIS NUMBER / TIME IN GERMAN?</span>
                    <h2 style={{ fontSize: 32 }}>{timeCard.prompt || timeCard.digital}</h2>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                  </>
                ) : (
                  <>
                    <span className="pill bg-der" style={{ fontSize: 24, padding: "8px 24px" }}>
                      {timeCard.answer || timeCard.formal}
                    </span>
                    {(timeCard.note || timeCard.informal) && (
                      <h3 style={{ fontSize: 18, margin: "14px 0 6px", color: "var(--ink-2)" }}>
                        {timeCard.note || `Informal: ${timeCard.informal}`}
                      </h3>
                    )}
                  </>
                )}
              </div>
              <div className="flash-controls">
                <button className="btn btn-secondary" disabled={cardIndex === 0} onClick={() => { setCardIndex(cardIndex - 1); setCardFlipped(false); }}>◀ Previous</button>
                <button className="btn btn-secondary mid" onClick={() => speakGerman(timeCard.answer || timeCard.formal)}>🔊 Pronounce</button>
                <button className="btn btn-secondary" disabled={cardIndex >= (list.length || TIME_FLASHCARDS.length) - 1} onClick={() => { setCardIndex(cardIndex + 1); setCardFlipped(false); }}>Next ▶</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🎯 QUIZ MODE: Number to German Words ONLY */}
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

          {!timeQuizWord ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "36px 16px", textAlign: "center" }}>
              <img src={noDataImg} alt="No Data" style={{ width: "160px", marginBottom: "12px" }} />
              <p style={{ color: "var(--muted)", margin: "0 0 12px 0" }}>No numbers / time expressions match current filters.</p>
            </div>
          ) : (
            <div className="quiz">
              <div className="quiz-head">
                <span>Question {quizIndex + 1} of {quizList.length}</span>
                <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {quizScore}</span>
              </div>
              <div className="quiz-card">
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                  Write the German words for this number / time:
                </span>
                <h1 style={{ fontSize: "38px", fontFamily: "monospace", color: "var(--brand, #b85c19)" }}>
                  {timeQuizWord.digital}
                </h1>
                {timeQuizWord.rule && (
                  <p style={{ color: "var(--muted)", margin: "4px 0", fontSize: 14 }}>
                    Pattern hint: <em>{timeQuizWord.rule}</em>
                  </p>
                )}
              </div>

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
                    placeholder="e.g. vierzehn Uhr oder Viertel vor..."
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

              {quizFeedback && (
                <div style={{ marginTop: 24, textAlign: "center", animation: "fadeIn 0.15s ease-in" }}>
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
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      Moving to next word in 1 second...
                    </span>
                  )}

                  {quizAnswerState === "wrong" && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      autoFocus
                      onClick={handleForwardClick}
                      style={{
                        marginTop: 10,
                        height: 44,
                        padding: "0 22px",
                        borderRadius: 12,
                        fontWeight: 700,
                      }}
                    >
                      {quizIndex < quizList.length - 1 ? "Next ▶" : "Finish 🏁"}
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
        <div className="overlay" style={{ zIndex: 1300 }} onClick={(e) => e.target === e.currentTarget && setScoreModal((p) => ({ ...p, isOpen: false }))}>
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
        defaultCategory="Time"
        categoryStats={{
          Time: {
            dailyCurrent: timeDailyCount,
            weeklyCurrent: timeWeeklyCount,
          },
        }}
        initialDailyTarget={timeDailyTarget}
        initialWeeklyTarget={timeWeeklyTarget}
      />

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>{editingTimeId ? "Edit Time Expression" : "Add Time Expression"}</h3>
            <form onSubmit={handleSaveModal}>
              <div>
                <label className="modal-label">Digital Time (e.g. 14:45 or 08:30)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="modal-input"
                    style={{ flex: 1 }}
                    type="text"
                    required
                    placeholder="e.g. 14:45"
                    value={timeFormData.digital}
                    onChange={(e) => {
                      setAiError("");
                      setTimeFormData({ ...timeFormData, digital: e.target.value });
                    }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={generateGermanTime} disabled={aiLoading}>
                    {aiLoading ? "Generating..." : "✨ Generate"}
                  </button>
                </div>
                {aiError && <p style={{ color: "#dc2626", fontSize: 13, margin: "6px 0 0" }}>{aiError}</p>}
              </div>

              <div>
                <label className="modal-label">Formal / Official Phrasing (24h)</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. Es ist vierzehn Uhr fünfundvierzig."
                  value={timeFormData.formal}
                  onChange={(e) => setTimeFormData({ ...timeFormData, formal: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Informal Phrasing (12h)</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. Es ist Viertel vor drei."
                  value={timeFormData.informal}
                  onChange={(e) => setTimeFormData({ ...timeFormData, informal: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Rule / Explanation</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. Quarter to next hour (Viertel vor)"
                  value={timeFormData.rule}
                  onChange={(e) => setTimeFormData({ ...timeFormData, rule: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Status</label>
                <CustomDropdown
                  fullWidth
                  value={timeFormData.status}
                  options={STATUS_OPTIONS}
                  onChange={(val) => setTimeFormData({ ...timeFormData, status: val })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Time</button>
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
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#dc2626" }}>Reset All Time Entries?</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              Are you sure you want to delete all saved time expressions? This action cannot be undone.
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
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--ink)" }}>Time Already Exists!</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{duplicateWordName}"</strong> is already in your time expressions list.
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
              You reached your goal of <strong style={{ color: "#b85c19" }}>{goalCelebration.target} time expressions</strong>!
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
              {successWordInfo.isEdit ? "Time Entry Updated!" : "Time Entry Added!"}
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{successWordInfo.digital}"</strong> ({successWordInfo.formal}) has been saved.
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