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

  // Quiz Filters
  const [quizStatusFilter, setQuizStatusFilter] = useState("all");
  const [quizDateMode, setQuizDateMode] = useState("all");
  const [quizSpecificDate, setQuizSpecificDate] = useState("");

  // Quiz Controls: Question Count Limit & Timer
  const [wordCountInput, setWordCountInput] = useState("");
  const [timerInput, setTimerInput] = useState("30");
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);

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
    return list.filter((item) => {
      const itemStatus = item.status || "In Progress";
      const matchesStatus = quizStatusFilter === "all" || itemStatus === quizStatusFilter;
      const matchesDate = matchesDateFilter(item.createdAt, quizDateMode, quizSpecificDate);
      return matchesStatus && matchesDate;
    });
  }, [list, quizStatusFilter, quizDateMode, quizSpecificDate]);

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
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback(null);
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
  const patternQuizWord = quizList[quizIndex];

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
        <div className="panel">
          {!patternCard ? (
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
              <p style={{ color: "var(--muted)", margin: 0 }}>No patterns available for flashcards.</p>
            </div>
          ) : (
            <div className="flash-wrap">
              <div className="flash" onClick={() => setCardFlipped(!cardFlipped)}>
                {!cardFlipped ? (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
                      WHICH ARTICLE BELONGS TO THIS PATTERN?
                    </span>
                    <h2 style={{ fontFamily: "monospace" }}>{patternCard.ending}</h2>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to reveal article &amp; rules)</span>
                  </>
                ) : (
                  <>
                    <span className={`pill ${ARTICLE_CLASS[patternCard.article]}`} style={{ fontSize: 22, padding: "6px 22px" }}>
                      {patternCard.article} ({GENDER_MAP[patternCard.article]})
                    </span>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-2)", margin: "14px 0 6px" }}>{patternCard.rule}</p>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, fontStyle: "italic" }}>e.g. {patternCard.examples}</p>
                  </>
                )}
              </div>
              <div className="flash-controls">
                <button className="btn btn-secondary" disabled={cardIndex === 0} onClick={() => { setCardIndex(cardIndex - 1); setCardFlipped(false); }}>
                  ◀ Previous
                </button>
                <button className="btn btn-secondary mid" onClick={() => speakGerman(patternCard.examples || patternCard.ending)}>
                  🔊 Hear Examples
                </button>
                <button className="btn btn-secondary" disabled={cardIndex >= list.length - 1} onClick={() => { setCardIndex(cardIndex + 1); setCardFlipped(false); }}>
                  Next ▶
                </button>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Pattern {cardIndex + 1} of {list.length}</span>
            </div>
          )}
        </div>
      )}

      {viewMode === "quiz" && (
        <div className="panel" style={{ marginTop: "-6px", paddingTop: "14px" }}>
          {/* QUIZ TOOLBAR: Focused purely on Article Finding */}
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
                {/* Status Dropdown */}
                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <CustomDropdown
                    icon="📌"
                    value={quizStatusFilter}
                    options={STATUS_FILTER_OPTIONS}
                    onChange={handleQuizStatusChange}
                  />
                </div>

                {/* Date Filter Dropdown */}
                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <CustomDropdown
                    icon="📅"
                    value={quizDateMode}
                    options={QUIZ_DATE_DROPDOWN_OPTIONS}
                    onChange={handleQuizDateModeChange}
                  />
                </div>

                {/* Real Calendar Picker */}
                {quizDateMode === "specific" && (
                  <RealCalendarPicker
                    selectedDate={quizSpecificDate}
                    onSelectDate={handleQuizCalendarDateSelect}
                  />
                )}

                {/* Count Limit Pill */}
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

                {/* Set Timer Setup Pill */}
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

                {/* Patterns Pool Count */}
                <div
                  style={{
                    flexShrink: 0,
                    fontSize: "13.5px",
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                    paddingLeft: "4px",
                  }}
                >
                  Patterns: <strong style={{ color: "var(--ink)" }}>{quizList.length}</strong>
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

          {!patternQuizWord ? (
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
                  ? "Add patterns to start quiz."
                  : "No patterns match the selected status, date, or count filters."}
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

              {/* Pure Article Quiz Card */}
              <div className="quiz-card">
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                  Which article goes with this suffix / pattern?
                </span>
                <h1 style={{ fontFamily: "monospace" }}>{patternQuizWord.ending}</h1>
                <p style={{ color: "var(--muted)", margin: "4px 0", fontSize: 14 }}>
                  Rule: <strong style={{ color: "var(--ink-2)" }}>{patternQuizWord.rule}</strong>
                </p>
                {patternQuizWord.examples && (
                  <p style={{ color: "var(--muted)", margin: 0, fontSize: 14 }}>
                    Examples: <strong style={{ color: "var(--ink-2)" }}>{patternQuizWord.examples}</strong>
                  </p>
                )}
              </div>

              {/* der / die / das Choice Buttons */}
              <div className="quiz-opts">
                {["der", "die", "das"].map((opt) => (
                  <button
                    key={opt}
                    disabled={quizFeedback !== null}
                    className={`quiz-opt ${opt}`}
                    onClick={() => {
                      const ok = opt === patternQuizWord.article;
                      const nextScore = ok ? quizScore + 1 : quizScore;
                      if (ok) setQuizScore(nextScore);
                      setQuizFeedback(
                        ok
                          ? "Correct! 🎉"
                          : `Wrong! Suffix "${patternQuizWord.ending}" takes "${patternQuizWord.article}".`
                      );
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {quizFeedback && (
                <div style={{ marginTop: 24, textAlign: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 700 }}>{quizFeedback}</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setQuizFeedback(null);
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
                    {quizIndex < quizList.length - 1 ? "Next Pattern" : "Complete Quiz"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quiz Results & Time-Up Modal */}
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
                : "You have reviewed all the patterns in your pool!"}
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
                  resetQuizProgress();
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