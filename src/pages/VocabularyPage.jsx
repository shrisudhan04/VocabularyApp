import { useState, useRef, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import CustomDropdown from "../components/CustomDropdown";
import GoalModal from "../components/GoalModal";
import { STATUS_OPTIONS } from "../constants/seedData";
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

const speakEnglish = (text) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
};

const getActiveAudioContext = async () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") await ctx.resume();
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
    goalAudioInstance.play().catch((err) => console.warn(err));
  } catch (err) {
    console.warn("Goal music failed:", err);
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
    console.warn("Audio failed:", err);
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
    console.warn("Audio failed:", err);
  }
};

const CATEGORY_OPTIONS = [
  { label: "All Categories", value: "all" },
  { label: "🔗 Connectors & Transitions", value: "connectors" },
  { label: "📖 Words & Vocabulary", value: "words" },
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
  { label: "English ➔ German Meaning", value: "meaning" },
  { label: "German ➔ English Word", value: "word" },
];

const EXCEL_ACTIONS = [
  { label: "Excel Actions", value: "" },
  { label: "📥 Import", value: "import" },
  { label: "📤 Export", value: "export" },
];

const EMPTY_FORM = {
  category: "words",
  word: "",
  germanMeaning: "",
  partOfSpeech: "",
  example: "",
  status: "In Progress",
};

// 🗓️ Real Calendar Picker Popover
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
    if (isOpen) document.addEventListener("mousedown", handleOutsideClick);
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
          border: selectedDate ? "1.5px solid #2563eb" : "1px solid var(--line-2, #ebdccb)",
          backgroundColor: selectedDate ? "#eff6ff" : "#ffffff",
          color: selectedDate ? "#1d4ed8" : "var(--ink, #1f2937)",
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
            boxShadow: "0 14px 32px rgba(0, 0, 0, 0.16)",
            border: "1px solid #e2e8f0",
            padding: "14px",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: "8px",
                width: "30px",
                height: "30px",
                cursor: "pointer",
                fontWeight: 700,
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
                background: "#f1f5f9",
                border: "none",
                borderRadius: "8px",
                width: "30px",
                height: "30px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ›
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", marginBottom: "6px" }}>
            {dayLabels.map((lbl, idx) => (
              <span key={lbl} style={{ fontSize: "11px", fontWeight: 700, color: idx === 0 || idx === 6 ? "#ef4444" : "#9ca3af" }}>
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
                    background: isSelected ? "#2563eb" : isToday ? "#dbeafe" : "transparent",
                    color: isSelected ? "#ffffff" : cell.isOtherMonth ? "#cbd5e1" : "#1e293b",
                    border: "none",
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

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={handleSelectToday}
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#2563eb",
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

export default function VocabularyPage({
  viewMode = "list",
  vocabList = [],
  onCommitVocab,
  onRequestConfirm,
}) {
  const list = Array.isArray(vocabList) ? vocabList : [];

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  // Pop-up Drawer state with DE/EN toggle
  const [selectedDrawerItem, setSelectedDrawerItem] = useState(null);
  const [drawerLangMode, setDrawerLangMode] = useState("EN"); // "EN" or "DE"

  // Quiz State
  const [quizStatusFilter, setQuizStatusFilter] = useState("all");
  const [quizCategoryFilter, setQuizCategoryFilter] = useState("all");
  const [quizDateMode, setQuizDateMode] = useState("all");
  const [quizSpecificDate, setQuizSpecificDate] = useState("");
  const [quizMode, setQuizMode] = useState("meaning");
  const [quizTextInput, setQuizTextInput] = useState("");
  const [wordCountInput, setWordCountInput] = useState("");
  const [timerInput, setTimerInput] = useState("30");
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);

  const [scoreModal, setScoreModal] = useState({
    isOpen: false,
    reason: "finish",
    score: 0,
    total: 0,
  });

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateWordName, setDuplicateWordName] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successWordInfo, setSuccessWordInfo] = useState({ word: "", meaning: "", isEdit: false });
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Goals
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
  const fileInputRef = useRef(null);

  const matchesDateFilter = (isoDate, mode, specificDate) => {
    if (!isoDate || mode === "all") return true;
    const itemDate = new Date(isoDate);
    const now = new Date();

    if (mode === "today") return itemDate.toDateString() === now.toDateString();
    if (mode === "yesterday") {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      return itemDate.toDateString() === y.toDateString();
    }
    if (mode === "last_week") {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return itemDate >= oneWeekAgo && itemDate <= now;
    }
    if (mode === "last_month") {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return itemDate >= oneMonthAgo && itemDate <= now;
    }
    if (mode === "specific") {
      if (!specificDate) return true;
      return isoDate.slice(0, 10) === specificDate;
    }
    return true;
  };

  const availableQuizPool = useMemo(() => {
    return list.filter((item) => {
      const itemStatus = item.status || "In Progress";
      const itemCat = item.category || "words";
      const matchesStatus = quizStatusFilter === "all" || itemStatus === quizStatusFilter;
      const matchesCategory = quizCategoryFilter === "all" || itemCat === quizCategoryFilter;
      const matchesDate = matchesDateFilter(item.createdAt, quizDateMode, quizSpecificDate);
      return matchesStatus && matchesCategory && matchesDate;
    });
  }, [list, quizStatusFilter, quizCategoryFilter, quizDateMode, quizSpecificDate]);

  const quizList = useMemo(() => {
    const count = parseInt(wordCountInput, 10);
    if (!isNaN(count) && count > 0) return availableQuizPool.slice(0, count);
    return availableQuizPool;
  }, [availableQuizPool, wordCountInput]);

  useEffect(() => {
    let interval = null;
    if (timerRunning && timeLeft !== null && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
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
    return () => interval && clearInterval(interval);
  }, [timerRunning, timeLeft, quizScore, quizList.length]);

  const handleStartTimer = () => {
    const parsed = parseInt(timerInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setTimeLeft(parsed);
      setTimerRunning(true);
    }
  };

  const resetQuizProgress = () => {
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback(null);
    setQuizTextInput("");
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
      const t = new Date(item.createdAt).getTime();
      if (t >= startOfToday && t <= endOfToday) daily += 1;
      if (t >= startOfWeek && t <= endOfWeek) weekly += 1;
    });

    return { daily, weekly };
  };

  const getSavedTargets = () => {
    try {
      const saved = localStorage.getItem("study_goals_targets");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          daily: Number(parsed.English?.daily) || 10,
          weekly: Number(parsed.English?.weekly) || 50,
        };
      }
    } catch (e) {
      console.warn("Target fetch error:", e);
    }
    return {
      daily: Number(localStorage.getItem("goal_daily_target")) || 10,
      weekly: Number(localStorage.getItem("goal_weekly_target")) || 50,
    };
  };

  const verifyGoalMilestone = (prevList, nextList, wordLabel = "") => {
    const { daily: dTarget, weekly: wTarget } = getSavedTargets();
    const prev = getGoalCounts(prevList);
    const next = getGoalCounts(nextList);

    if (prev.daily < dTarget && next.daily >= dTarget) {
      playGoalAchievedMusic();
      setGoalCelebration({
        isOpen: true,
        goalType: "daily",
        target: dTarget,
        current: next.daily,
        addedWord: wordLabel,
      });
      return true;
    }

    if (prev.weekly < wTarget && next.weekly >= wTarget) {
      playGoalAchievedMusic();
      setGoalCelebration({
        isOpen: true,
        goalType: "weekly",
        target: wTarget,
        current: next.weekly,
        addedWord: wordLabel,
      });
      return true;
    }
    return false;
  };

  const { daily: engDailyCount, weekly: engWeeklyCount } = getGoalCounts(list);
  const { daily: engDailyTarget, weekly: engWeeklyTarget } = getSavedTargets();

  const handleConfirmReset = () => {
    playDangerSound();
    onCommitVocab?.([]);
    setCardIndex(0);
    setCardFlipped(false);
    resetQuizProgress();
    setResetModalOpen(false);
  };

  const exportToExcel = () => {
    if (list.length === 0) {
      alert("No vocabulary to export.");
      return;
    }

    const exportData = list.map((item, index) => ({
      "#": index + 1,
      Category: item.category || "words",
      "English Word / Connector": item.word,
      "German Translation / Meaning": item.germanMeaning,
      "Part of Speech / Position": item.partOfSpeech || "",
      Example: item.example || "",
      Status: item.status || "In Progress",
      CreatedAt: item.createdAt || new Date().toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "English_Vocab");
    XLSX.writeFile(workbook, `English_Vocabulary_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

        const existingSet = new Set(list.map((v) => v.word?.trim().toLowerCase()));
        const newEntries = [];
        const duplicateWords = [];

        rawJson.forEach((row, i) => {
          const rowLower = {};
          Object.keys(row).forEach((k) => (rowLower[k.trim().toLowerCase()] = row[k]));

          const word = (rowLower.word || rowLower["english word"] || rowLower["english word / connector"] || "").toString().trim();
          const germanMeaning = (rowLower.german || rowLower.meaning || rowLower["german translation"] || "").toString().trim();
          const categoryRaw = (rowLower.category || "").toString().toLowerCase().trim();
          const category = categoryRaw.includes("connect") ? "connectors" : "words";
          const partOfSpeech = (rowLower["part of speech"] || rowLower.type || "").toString().trim();
          const example = (rowLower.example || "").toString().trim();
          const status = (rowLower.status || "In Progress").toString().trim();

          if (word) {
            const lowerWord = word.toLowerCase();
            if (existingSet.has(lowerWord)) {
              duplicateWords.push(word);
            } else {
              existingSet.add(lowerWord);
              newEntries.push({
                id: Date.now() + i,
                category,
                word,
                germanMeaning,
                partOfSpeech,
                example,
                status: status.toLowerCase() === "mastered" ? "Mastered" : "In Progress",
                createdAt: new Date().toISOString(),
              });
            }
          }
        });

        if (newEntries.length > 0) {
          const updatedList = [...list, ...newEntries];
          const reachedGoal = verifyGoalMilestone(list, updatedList, `${newEntries.length} new words`);
          if (!reachedGoal) playSuccessSound();
          onCommitVocab?.(updatedList);
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

  const generateWithAI = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setAiError("VITE_GEMINI_API_KEY is not defined in your .env file.");
      return;
    }
    if (!formData.word.trim()) {
      setAiError("Please provide an English word or connector first.");
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Analyze the English word or connector: "${formData.word.trim()}". Classify it as either 'connectors' (transitions, conjunctions) or 'words' (nouns, verbs, adjectives). Provide an accurate German translation, the grammatical part of speech / syntax function, and a natural English example sentence.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, enum: ["connectors", "words"] },
              germanMeaning: { type: Type.STRING },
              partOfSpeech: { type: Type.STRING },
              example: { type: Type.STRING },
            },
            required: ["category", "germanMeaning", "partOfSpeech", "example"],
          },
        },
      });

      const parsed = JSON.parse(response.text);
      setFormData((prev) => ({
        ...prev,
        category: parsed.category || prev.category,
        germanMeaning: parsed.germanMeaning,
        partOfSpeech: parsed.partOfSpeech,
        example: parsed.example,
      }));
    } catch (err) {
      setAiError(err.message || "Failed to generate word details.");
    } finally {
      setAiLoading(false);
    }
  };

  const filteredList = list.filter((item) => {
    const q = normalize(search);
    const matchesSearch =
      !q ||
      normalize(item.word).includes(q) ||
      normalize(item.germanMeaning).includes(q) ||
      normalize(item.partOfSpeech).includes(q) ||
      normalize(item.example).includes(q);

    const matchesCat = categoryFilter === "all" || (item.category || "words") === categoryFilter;
    const itemStatus = item.status || "In Progress";
    const matchesStatus = statusFilter === "all" || itemStatus === statusFilter;
    const matchesDate = matchesDateFilter(item.createdAt, dateFilter, customDate);

    return matchesSearch && matchesCat && matchesStatus && matchesDate;
  });

  const totalMastered = list.filter((i) => i.status === "Mastered").length;
  const countCategory = (cat) => list.filter((i) => (i.category || "words") === cat).length;

  const openAddModal = () => {
    setEditingId(null);
    setAiError("");
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setAiError("");
    setFormData({
      category: item.category || "words",
      word: item.word,
      germanMeaning: item.germanMeaning,
      partOfSpeech: item.partOfSpeech || "",
      example: item.example || "",
      status: item.status || "In Progress",
    });
    setModalOpen(true);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    const cleanWord = formData.word.trim();
    if (!cleanWord || !formData.germanMeaning.trim()) return;

    const isDuplicate = list.some(
      (item) => item.word.trim().toLowerCase() === cleanWord.toLowerCase() && item.id !== editingId
    );

    if (isDuplicate) {
      playDuplicateSound();
      setDuplicateWordName(cleanWord);
      setDuplicateModalOpen(true);
      return;
    }

    const isEditing = Boolean(editingId);
    let updated;

    if (isEditing) {
      updated = list.map((item) => (item.id === editingId ? { ...item, ...formData, word: cleanWord } : item));
    } else {
      updated = [
        ...list,
        {
          id: Date.now(),
          ...formData,
          word: cleanWord,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const reachedGoal = !isEditing && verifyGoalMilestone(list, updated, cleanWord);
    if (!reachedGoal && !isEditing) playSuccessSound();

    onCommitVocab?.(updated);
    setModalOpen(false);

    if (!reachedGoal) {
      setSuccessWordInfo({
        word: cleanWord,
        meaning: formData.germanMeaning,
        isEdit: isEditing,
      });
      setSuccessModalOpen(true);
    }
  };

  const toggleStatus = (id) =>
    onCommitVocab?.(
      list.map((i) => (i.id === id ? { ...i, status: i.status === "Mastered" ? "In Progress" : "Mastered" } : i))
    );

  const handleQuizTextSubmit = (e) => {
    e?.preventDefault();
    if (quizFeedback !== null || !activeQuizWord) return;

    const entered = normalize(quizTextInput);

    if (quizMode === "meaning") {
      const target = normalize(activeQuizWord.germanMeaning);
      const isCorrect = entered === target || target.includes(entered);
      if (isCorrect) setQuizScore((s) => s + 1);
      setQuizFeedback(isCorrect ? "Correct! 🎉" : `Incorrect. Answer is "${activeQuizWord.germanMeaning}".`);
    } else {
      const target = normalize(activeQuizWord.word);
      const isCorrect = entered === target;
      if (isCorrect) setQuizScore((s) => s + 1);
      setQuizFeedback(isCorrect ? "Correct! 🎉" : `Incorrect. Answer is "${activeQuizWord.word}".`);
    }
  };

  const currentFlashcard = list[cardIndex];
  const activeQuizWord = quizList[quizIndex];

  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          {/* STATS BAR */}
          <div className="stats-grid">
            <div className="stat dark">
              <div className="stat-head">
                <span className="stat-label">TOTAL ENGLISH VOCAB</span>
                <span className="stat-pill dark">{totalMastered} mastered</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value">{list.length}</span>
                <span className="stat-note" style={{ color: "#94a3b8" }}>active items</span>
              </div>
            </div>

            <div className="stat">
              <div className="stat-head">
                <span className="stat-label">CONNECTORS</span>
                <span className="stat-pill" style={{ backgroundColor: "#f3e8ff", color: "#7e22ce" }}>Transitions</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value" style={{ color: "#7e22ce" }}>{countCategory("connectors")}</span>
              </div>
            </div>

            <div className="stat">
              <div className="stat-head">
                <span className="stat-label">WORDS &amp; IDIOMS</span>
                <span className="stat-pill" style={{ backgroundColor: "#e0f2fe", color: "#0369a1" }}>Vocabulary</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value" style={{ color: "#0369a1" }}>{countCategory("words")}</span>
              </div>
            </div>
          </div>

          {/* TOOLBAR */}
          <div className="toolbar">
            <div className="search">
              <span>🔍</span>
              <input
                type="search"
                placeholder="Search English word, connector, meaning..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div
              className="filters-cluster"
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "8px",
                overflowX: "auto",
                padding: "4px 2px 8px 2px",
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <CustomDropdown
                  icon="🏷️"
                  value={categoryFilter}
                  options={CATEGORY_OPTIONS}
                  onChange={(val) => setCategoryFilter(val)}
                />
              </div>

              <div style={{ flexShrink: 0 }}>
                <CustomDropdown
                  icon="📌"
                  value={statusFilter}
                  options={STATUS_FILTER_OPTIONS}
                  onChange={(val) => setStatusFilter(val)}
                />
              </div>

              <div style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <CustomDropdown
                  icon="📅"
                  value={dateFilter}
                  options={QUIZ_DATE_DROPDOWN_OPTIONS}
                  onChange={(val) => setDateFilter(val)}
                />
                {dateFilter === "specific" && (
                  <RealCalendarPicker selectedDate={customDate} onSelectDate={(d) => setCustomDate(d)} />
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".xlsx, .xls, .csv"
                onChange={importFromExcel}
              />

              <div style={{ flexShrink: 0 }}>
                <CustomDropdown
                  icon="📊"
                  value=""
                  options={EXCEL_ACTIONS}
                  onChange={(val) => {
                    if (val === "import") fileInputRef.current?.click();
                    if (val === "export") exportToExcel();
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => setGoalModalOpen(true)}
                className="btn btn-secondary"
                style={{ flexShrink: 0 }}
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
                  color: "#dc2626",
                  borderColor: "#fca5a5",
                  backgroundColor: "#fef2f2",
                }}
              >
                🔄 Reset
              </button>
            </div>
          </div>

          {/* LIST */}
          {filteredList.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "48px 20px",
                background: "var(--card)",
                borderRadius: "14px",
                border: "1px dashed var(--line-2)",
                textAlign: "center",
                marginTop: "8px",
              }}
            >
              <img src={noDataImg} alt="No Data" style={{ width: "180px", marginBottom: "16px" }} />
              <h3 style={{ margin: "0 0 8px", fontSize: "19px", fontWeight: 700 }}>No English Vocabulary Found</h3>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)" }}>
                Start adding your English connectors and vocabulary words!
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: "16px" }}
                onClick={openAddModal}
              >
                + Add English Word
              </button>
            </div>
          ) : (
            <div className="list">
              <div
                className="list-head"
                style={{
                  gridTemplateColumns: "40px 140px 1.4fr 1.4fr 1.2fr 120px 100px",
                  display: "grid",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 16px",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "var(--muted)",
                  borderBottom: "1px solid var(--line-2)",
                }}
              >
                <span style={{ textAlign: "center" }}>#</span>
                <span>CATEGORY</span>
                <span>ENGLISH WORD / CONNECTOR</span>
                <span>GERMAN TRANSLATION</span>
                <span>PART OF SPEECH / SYNTAX</span>
                <span>STATUS</span>
                <span style={{ textAlign: "right" }}>ACTIONS</span>
              </div>

              {filteredList.map((item, index) => {
                const isConnector = (item.category || "words") === "connectors";
                return (
                  <div
                    key={item.id}
                    className="row"
                    onClick={() => setSelectedDrawerItem(item)}
                    style={{
                      gridTemplateColumns: "40px 140px 1.4fr 1.4fr 1.2fr 120px 100px",
                      display: "grid",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 16px",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--line-2)",
                    }}
                  >
                    <div style={{ textAlign: "center", fontWeight: 700, color: "var(--muted)" }}>
                      {index + 1}
                    </div>

                    <div>
                      <span
                        className="pill"
                        style={{
                          backgroundColor: isConnector ? "#ede9fe" : "#e0f2fe",
                          color: isConnector ? "#6b21a8" : "#0369a1",
                          fontWeight: 700,
                          fontSize: "12px",
                          padding: "4px 8px",
                          borderRadius: "6px",
                        }}
                      >
                        {isConnector ? "🔗 Connector" : "📖 Word"}
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: "15px" }}>
                      {item.word}
                    </div>

                    <div style={{ fontWeight: 600, color: "var(--ink-2)" }}>{item.germanMeaning}</div>

                    <div style={{ fontSize: "13px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.partOfSpeech || "—"}
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleStatus(item.id)}
                        className={`status ${item.status === "Mastered" ? "done" : "todo"}`}
                      >
                        {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                      </button>
                    </div>

                    <div className="actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => speakEnglish(item.word)}
                        className="icon-btn"
                        title="Pronounce English"
                      >
                        🔊
                      </button>
                      <button onClick={() => openEditModal(item)} className="icon-btn" title="Edit">
                        ✏
                      </button>
                      <button
                        onClick={() =>
                          onRequestConfirm?.("Delete Item", `Are you sure you want to delete "${item.word}"?`, () =>
                            onCommitVocab?.(list.filter((i) => i.id !== item.id))
                          )
                        }
                        className="icon-btn"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === "list" && (
        <button onClick={openAddModal} className="fab-btn" title="Add English Vocab" aria-label="Add Vocab">
          +
        </button>
      )}

      {/* ========================================================================= */}
      {/* 🚀 SLIDE-OUT POPUP DRAWER WITH THE DE ↔ EN TOGGLE */}
      {/* ========================================================================= */}
      <div
        className={`sidebar-overlay ${selectedDrawerItem ? "open" : ""}`}
        style={{ zIndex: 1250 }}
        onClick={(e) => e.target === e.currentTarget && setSelectedDrawerItem(null)}
      >
        <aside
          className="sidebar"
          style={{
            maxWidth: "420px",
            width: "90vw",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "-8px 0 32px rgba(0,0,0,0.18)",
            padding: "24px 20px",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
                English Word Inspector
              </span>
              <button
                type="button"
                className="sidebar-close-btn"
                onClick={() => setSelectedDrawerItem(null)}
              >
                ✕
              </button>
            </div>

            {/* DE <-> EN TOGGLE BUTTON */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                backgroundColor: "#f8fafc",
                borderRadius: "12px",
                marginBottom: "20px",
                border: "1px solid var(--line-2, #e2e8f0)",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>Front Card View:</span>
              <div
                style={{
                  display: "inline-flex",
                  backgroundColor: "#e2e8f0",
                  borderRadius: "20px",
                  padding: "2px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setDrawerLangMode("EN")}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "18px",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    backgroundColor: drawerLangMode === "EN" ? "#2563eb" : "transparent",
                    color: drawerLangMode === "EN" ? "#ffffff" : "#475569",
                  }}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerLangMode("DE")}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "18px",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    backgroundColor: drawerLangMode === "DE" ? "#2563eb" : "transparent",
                    color: drawerLangMode === "DE" ? "#ffffff" : "#475569",
                  }}
                >
                  DE
                </button>
              </div>
            </div>

            {selectedDrawerItem && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <span
                    className="pill"
                    style={{
                      backgroundColor: (selectedDrawerItem.category || "words") === "connectors" ? "#ede9fe" : "#e0f2fe",
                      color: (selectedDrawerItem.category || "words") === "connectors" ? "#6b21a8" : "#0369a1",
                      fontWeight: 800,
                      fontSize: "12px",
                      padding: "5px 10px",
                      borderRadius: "8px",
                    }}
                  >
                    {(selectedDrawerItem.category || "words") === "connectors"
                      ? "🔗 Connector / Discourse Marker"
                      : "📖 Vocabulary Word"}
                  </span>
                </div>

                <div
                  style={{
                    padding: "18px",
                    backgroundColor: "#f8fafc",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: "14px",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
                    {drawerLangMode === "EN" ? "English Word / Phrase" : "German Meaning / Definition"}
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: "#2563eb", margin: "6px 0 10px" }}>
                    {drawerLangMode === "EN" ? selectedDrawerItem.word : selectedDrawerItem.germanMeaning}
                  </div>

                  <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
                    {drawerLangMode === "EN" ? "German Translation" : "English Original"}
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--ink, #1f2937)" }}>
                    {drawerLangMode === "EN" ? selectedDrawerItem.germanMeaning : selectedDrawerItem.word}
                  </div>
                </div>

                {selectedDrawerItem.partOfSpeech && (
                  <div style={{ padding: "14px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
                      Part of Speech / Syntax Role
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: "13.5px", color: "var(--ink)" }}>
                      {selectedDrawerItem.partOfSpeech}
                    </p>
                  </div>
                )}

                {selectedDrawerItem.example && (
                  <div style={{ padding: "14px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, color: "#166534", textTransform: "uppercase" }}>
                      Context Example
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: "13.5px", fontStyle: "italic", color: "#14532d", lineHeight: 1.5 }}>
                      "{selectedDrawerItem.example}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedDrawerItem && (
            <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => speakEnglish(selectedDrawerItem.word)}
              >
                🔊 Listen
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => {
                  const itm = selectedDrawerItem;
                  setSelectedDrawerItem(null);
                  openEditModal(itm);
                }}
              >
                ✏ Edit
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* FLASHCARDS VIEW */}
      {viewMode === "flashcards" && (
        <div className="panel">
          {!currentFlashcard ? (
            <div style={{ textAlign: "center", padding: "24px" }}>
              <img src={noDataImg} alt="No Data" style={{ width: "160px", marginBottom: "12px" }} />
              <p style={{ color: "var(--muted)", margin: 0 }}>No vocabulary items available for flashcards.</p>
            </div>
          ) : (
            <div className="flash-wrap">
              <div className="flash" onClick={() => setCardFlipped(!cardFlipped)}>
                {!cardFlipped ? (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>GUESS GERMAN MEANING</span>
                    <h2>{currentFlashcard.word}</h2>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                  </>
                ) : (
                  <>
                    <h3 style={{ fontSize: 24, margin: "10px 0 6px", color: "#2563eb" }}>{currentFlashcard.germanMeaning}</h3>
                    {currentFlashcard.partOfSpeech && (
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", margin: "8px 0 0" }}>
                        {currentFlashcard.partOfSpeech}
                      </p>
                    )}
                    {currentFlashcard.example && (
                      <p style={{ fontSize: 13, fontStyle: "italic", color: "#64748b", margin: "10px 0 0" }}>
                        "{currentFlashcard.example}"
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flash-controls">
                <button
                  className="btn btn-secondary"
                  disabled={cardIndex === 0}
                  onClick={() => {
                    setCardIndex(cardIndex - 1);
                    setCardFlipped(false);
                  }}
                >
                  ◀ Previous
                </button>
                <button className="btn btn-secondary mid" onClick={() => speakEnglish(currentFlashcard.word)}>
                  🔊 Pronounce
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={cardIndex >= list.length - 1}
                  onClick={() => {
                    setCardIndex(cardIndex + 1);
                    setCardFlipped(false);
                  }}
                >
                  Next ▶
                </button>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                Card {cardIndex + 1} of {list.length}
              </span>
            </div>
          )}
        </div>
      )}

      {/* QUIZ VIEW */}
      {viewMode === "quiz" && (
        <div className="panel" style={{ marginTop: "-6px", paddingTop: "14px" }}>
          <div
            className="quiz-controls-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              overflowX: "auto",
              paddingBottom: "14px",
              borderBottom: "1px solid var(--line-2)",
              marginBottom: "16px",
            }}
          >
            {!timerRunning ? (
              <>
                <div style={{ flexShrink: 0 }}>
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
                <div style={{ flexShrink: 0 }}>
                  <CustomDropdown
                    icon="🏷️"
                    value={quizCategoryFilter}
                    options={CATEGORY_OPTIONS}
                    onChange={(val) => {
                      setQuizCategoryFilter(val);
                      resetQuizProgress();
                    }}
                  />
                </div>
                <div style={{ flexShrink: 0 }}>
                  <CustomDropdown
                    icon="📌"
                    value={quizStatusFilter}
                    options={STATUS_FILTER_OPTIONS}
                    onChange={(val) => {
                      setQuizStatusFilter(val);
                      resetQuizProgress();
                    }}
                  />
                </div>
                <div style={{ flexShrink: 0 }}>
                  <CustomDropdown
                    icon="📅"
                    value={quizDateMode}
                    options={QUIZ_DATE_DROPDOWN_OPTIONS}
                    onChange={(val) => {
                      setQuizDateMode(val);
                      if (val !== "specific") setQuizSpecificDate("");
                      resetQuizProgress();
                    }}
                  />
                </div>

                {quizDateMode === "specific" && (
                  <RealCalendarPicker
                    selectedDate={quizSpecificDate}
                    onSelectDate={(d) => {
                      setQuizSpecificDate(d);
                      resetQuizProgress();
                    }}
                  />
                )}

                <div
                  style={{
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--line-2)",
                    padding: "0 12px",
                    borderRadius: "12px",
                    height: "40px",
                  }}
                >
                  <span>🔢</span>
                  <span style={{ fontSize: "13.5px", fontWeight: 600 }}>Count:</span>
                  <input
                    type="text"
                    inputMode="numeric"
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
                      border: "1px solid #cbd5e1",
                      textAlign: "center",
                      fontWeight: 700,
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
                    border: "1px solid var(--line-2)",
                    padding: "0 6px 0 12px",
                    borderRadius: "12px",
                    height: "40px",
                  }}
                >
                  <span>⏱️</span>
                  <span style={{ fontSize: "13.5px", fontWeight: 600 }}>Timer:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="30"
                    value={timerInput}
                    onChange={(e) => setTimerInput(e.target.value.replace(/[^0-9]/g, ""))}
                    style={{
                      width: "48px",
                      height: "28px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleStartTimer}
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      backgroundColor: "#2563eb",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    ▶
                  </button>
                </div>
              </>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: timeLeft <= 5 ? "#fef2f2" : "#eff6ff",
                  border: `1.5px solid ${timeLeft <= 5 ? "#f87171" : "#93c5fd"}`,
                  padding: "0 14px",
                  borderRadius: "14px",
                  height: "44px",
                }}
              >
                <span>{timeLeft <= 5 ? "🔥" : "⏳"}</span>
                <span style={{ fontSize: "15px", fontWeight: 800, color: timeLeft <= 5 ? "#dc2626" : "#2563eb" }}>
                  {timeLeft}s remaining
                </span>
                <button
                  type="button"
                  onClick={() => setTimerRunning(false)}
                  style={{
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#fff",
                    borderRadius: "8px",
                    padding: "4px 8px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ⏸
                </button>
              </div>
            )}
          </div>

          {!activeQuizWord ? (
            <div style={{ textAlign: "center", padding: "36px" }}>
              <img src={noDataImg} alt="No Data" style={{ width: "160px", marginBottom: "12px" }} />
              <p style={{ color: "var(--muted)", margin: 0 }}>No English words match filters.</p>
            </div>
          ) : (
            <div className="quiz">
              <div className="quiz-head">
                <span>Question {quizIndex + 1} of {quizList.length}</span>
                <span style={{ fontWeight: 700, color: "#2563eb" }}>Score: {quizScore}</span>
              </div>

              <div className="quiz-card">
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  {quizMode === "meaning" ? "Provide German translation for:" : "Provide English word for:"}
                </span>
                <h1 style={{ color: "#2563eb", marginTop: "8px" }}>
                  {quizMode === "meaning" ? activeQuizWord.word : activeQuizWord.germanMeaning}
                </h1>
                {activeQuizWord.partOfSpeech && (
                  <p style={{ color: "var(--muted)", fontSize: "13.5px", margin: "6px 0 0" }}>
                    Role / Category: <strong>{activeQuizWord.partOfSpeech}</strong>
                  </p>
                )}
              </div>

              <form onSubmit={handleQuizTextSubmit} style={{ marginTop: 18, display: "flex", gap: 8, maxWidth: 420, marginInline: "auto" }}>
                <input
                  type="text"
                  autoFocus
                  disabled={quizFeedback !== null}
                  placeholder="Type your answer..."
                  value={quizTextInput}
                  onChange={(e) => setQuizTextInput(e.target.value)}
                  className="modal-input"
                  style={{ flex: 1, height: "46px" }}
                />
                <button
                  type="submit"
                  disabled={quizFeedback !== null || !quizTextInput.trim()}
                  className="btn btn-primary"
                  style={{ height: "46px", padding: "0 18px", borderRadius: "12px", marginTop: 7 }}
                >
                  Check
                </button>
              </form>

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

      {/* SCORE MODAL */}
      {scoreModal.isOpen && (
        <div className="overlay" style={{ zIndex: 1300 }} onClick={() => setScoreModal((p) => ({ ...p, isOpen: false }))}>
          <div className="modal" style={{ textAlign: "center", maxWidth: 360, padding: "26px 20px" }}>
            <img src={scoreModal.score > 0 ? congratsGif : alertGif} alt="Results" style={{ width: 95, height: 95, marginBottom: 12 }} />
            <h3 style={{ margin: "4px 0 6px", fontSize: 22 }}>
              {scoreModal.reason === "timeup" ? "Time's Expired!" : "Quiz Complete!"}
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: 14 }}>
              Your Score: <strong>{scoreModal.score} / {scoreModal.total}</strong>
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                setScoreModal((p) => ({ ...p, isOpen: false }));
                resetQuizProgress();
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>{editingId ? "Edit English Item" : "Add English Word / Connector"}</h3>
            <form onSubmit={handleSaveModal}>
              <div>
                <label className="modal-label">Category</label>
                <div className="radios">
                  {[
                    { label: "Connectors & Transitions", value: "connectors" },
                    { label: "Words & Vocabulary", value: "words" },
                  ].map((cat) => (
                    <label key={cat.value} className={`radio ${formData.category === cat.value ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="category"
                        value={cat.value}
                        checked={formData.category === cat.value}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      />
                      {cat.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="modal-label">English Word / Connector</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="modal-input"
                    style={{ flex: 1 }}
                    type="text"
                    required
                    placeholder="e.g. Furthermore, However, Resilient"
                    value={formData.word}
                    onChange={(e) => {
                      setAiError("");
                      setFormData({ ...formData, word: e.target.value });
                    }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={generateWithAI} disabled={aiLoading}>
                    {aiLoading ? "Generating..." : "✨ AI Help"}
                  </button>
                </div>
                {aiError && <p style={{ color: "#dc2626", fontSize: 13, margin: "6px 0 0" }}>{aiError}</p>}
              </div>

              <div>
                <label className="modal-label">German Translation / Meaning</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. Darüber hinaus, Jedoch, Widerstandsfähig"
                  value={formData.germanMeaning}
                  onChange={(e) => setFormData({ ...formData, germanMeaning: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Part of Speech / Syntax Position</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. Transition Word / Adjective / Phrasal Verb"
                  value={formData.partOfSpeech}
                  onChange={(e) => setFormData({ ...formData, partOfSpeech: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Context Example Sentence</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. Furthermore, the survey confirmed our hypotheses."
                  value={formData.example}
                  onChange={(e) => setFormData({ ...formData, example: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Status</label>
                <CustomDropdown
                  fullWidth
                  value={formData.status}
                  options={STATUS_OPTIONS}
                  onChange={(val) => setFormData({ ...formData, status: val })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION */}
      {resetModalOpen && (
        <div className="overlay" style={{ zIndex: 1200 }} onClick={() => setResetModalOpen(false)}>
          <div className="modal" style={{ textAlign: "center", maxWidth: 360, padding: "24px" }}>
            <img src={warningRedGif} alt="Warning" style={{ width: 90, height: 90, marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#dc2626" }}>Reset English Vocab?</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              Are you sure? This will delete all saved English items permanently.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setResetModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, backgroundColor: "#dc2626", borderColor: "#dc2626" }}
                onClick={handleConfirmReset}
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE MODAL */}
      {duplicateModalOpen && (
        <div className="overlay" style={{ zIndex: 1200 }} onClick={() => setDuplicateModalOpen(false)}>
          <div className="modal" style={{ textAlign: "center", maxWidth: 360, padding: "24px" }}>
            <img src={alertGif} alt="Alert" style={{ width: 100, height: 100, marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 20 }}>Word Already Exists!</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{duplicateWordName}"</strong> is already in your vocabulary list.
            </p>
            <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={() => setDuplicateModalOpen(false)}>
              Understood
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {successModalOpen && (
        <div className="overlay" style={{ zIndex: 1200 }} onClick={() => setSuccessModalOpen(false)}>
          <div className="modal" style={{ textAlign: "center", maxWidth: 360, padding: "24px" }}>
            <img src={successGif} alt="Success" style={{ width: 100, height: 100, marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#16a34a" }}>
              {successWordInfo.isEdit ? "Item Updated!" : "Item Saved!"}
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{successWordInfo.word}"</strong> ({successWordInfo.meaning}) is ready.
            </p>
            <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={() => setSuccessModalOpen(false)}>
              Great! 🎉
            </button>
          </div>
        </div>
      )}

      {/* GOAL MODAL */}
      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        defaultCategory="English"
        categoryStats={{
          English: {
            dailyCurrent: engDailyCount,
            weeklyCurrent: engWeeklyCount,
          },
        }}
        initialDailyTarget={engDailyTarget}
        initialWeeklyTarget={engWeeklyTarget}
      />
    </>
  );
}