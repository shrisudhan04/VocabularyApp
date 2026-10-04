import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import CustomDropdown from "../components/CustomDropdown";
import GoalModal from "../components/GoalModal"; // Adjust path if located elsewhere
import { ARTICLE_CLASS, DATE_OPTIONS, STATUS_OPTIONS, GENDER_MAP } from "../constants/seedData";
import { speakGerman } from "../utils/speech";
import { GoogleGenAI, Type } from "@google/genai";
import alertGif from "../assets/Alert.gif";
import successGif from "../assets/Success.gif";
import warningRedGif from "../assets/WarningRed.gif";
import "../App.css";

const GEMINI_MODEL = "gemini-2.5-flash";

// 🔊 Web Audio Synthesizer
const getActiveAudioContext = async () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
};

// 1. Success chime for adding new patterns & milestones
const playSuccessSound = async () => {
  try {
    const ctx = await getActiveAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
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

// 2. Duplicate warning buzzer
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

// 3. Danger warning for reset
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

const EXCEL_ACTIONS = [
  { label: "Excel Actions ▾", value: "" },
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

export default function PatternsPage({
  viewMode,
  patternsList,
  onCommitPatterns,
  onRequestConfirm,
}) {
  const [search, setSearch] = useState("");
  const [articleFilter, setArticleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPatternId, setEditingPatternId] = useState(null);
  const [patternFormData, setPatternFormData] = useState(EMPTY_FORM);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ article: "", ending: "", isEdit: false });
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // 🎯 Study Goals Modal & Milestone State
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
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);

  const fileInputRef = useRef(null);

  // ---------- Goal helpers ----------
  const getGoalCounts = (list = []) => {
  const now = new Date();

  // 1. Daily: Today 00:00:00.000 to 23:59:59.999
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

  // 2. Weekly: Sunday 12:00 AM (00:00:00.000) to Saturday 11:59 PM (23:59:59.999)
  // In JavaScript: Sunday is day 0, Saturday is day 6
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

  list.forEach((item) => {
    if (!item?.createdAt) return;
    const itemTime = new Date(item.createdAt).getTime();

    // Check strict Daily window (00:00 to 23:59 today)
    if (itemTime >= startOfToday && itemTime <= endOfToday) {
      daily += 1;
    }

    // Check strict Weekly window (Sunday 00:00 to Saturday 23:59)
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
      playSuccessSound();
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
      playSuccessSound();
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

  // Live Goal Progress calculations
  const { daily: patternDailyCount, weekly: patternWeeklyCount } = getGoalCounts(patternsList);
  const { daily: patternDailyTarget, weekly: patternWeeklyTarget } = getSavedTargets();

  // ---------- Reset ----------
  const handleConfirmReset = () => {
    playDangerSound();
    onCommitPatterns([]);
    setCardIndex(0);
    setCardFlipped(false);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback(null);
    setResetModalOpen(false);
  };

  // ---------- Excel export / import ----------
  const exportToExcel = () => {
    if (!patternsList || patternsList.length === 0) {
      alert("No patterns to export.");
      return;
    }

    const exportData = patternsList.map((item, index) => ({
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

        // Duplicate key = article + ending
        const existingKeys = new Set(
          patternsList.map((p) => `${p.article}|${p.ending?.trim().toLowerCase()}`)
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
                status: status.toLowerCase() === "mastered" ? "Mastered" : "In Progress",
                createdAt: new Date().toISOString(),
              });
            }
          }
        });

        if (newEntries.length > 0) {
          playSuccessSound();
          const updatedList = [...patternsList, ...newEntries];
          verifyGoalMilestone(patternsList, updatedList, `${newEntries.length} new patterns`);
          onCommitPatterns(updatedList);
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

  // ---------- AI generate ----------
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

  // ---------- Filtering ----------
  const matchesDateFilter = (isoDate) => {
    if (!isoDate || dateFilter === "all") return true;
    const itemDate = new Date(isoDate);
    const now = new Date();

    if (dateFilter === "today") return itemDate.toDateString() === now.toDateString();
    if (dateFilter === "week") return itemDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (dateFilter === "month") return itemDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (dateFilter === "custom" && customDate) return isoDate.slice(0, 10) === customDate;
    return true;
  };

  const filteredPatterns = patternsList.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (item.ending || "").toLowerCase().includes(q) ||
      (item.rule || "").toLowerCase().includes(q) ||
      (item.examples || "").toLowerCase().includes(q);
    const matchesArt = articleFilter === "all" || item.article === articleFilter;
    const itemStatus = item.status || "In Progress";
    const matchesStatus = statusFilter === "all" || itemStatus === statusFilter;
    return matchesSearch && matchesArt && matchesStatus && matchesDateFilter(item.createdAt);
  });

  const patternsMastered = patternsList.filter((p) => p.status === "Mastered").length;
  const countPattern = (art) => patternsList.filter((p) => p.article === art).length;

  // ---------- Add / Edit ----------
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

    const isDuplicate = patternsList.some(
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
      updated = patternsList.map((item) =>
        item.id === editingPatternId ? { ...item, ...patternFormData, ending: cleanEnding } : item
      );
    } else {
      playSuccessSound();
      updated = [
        ...patternsList,
        {
          id: `p-${Date.now()}`,
          ...patternFormData,
          ending: cleanEnding,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const reachedGoal =
      !isEditing &&
      verifyGoalMilestone(patternsList, updated, `${patternFormData.article} ${cleanEnding}`);

    onCommitPatterns(updated);
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
    onCommitPatterns(
      patternsList.map((p) =>
        p.id === id
          ? { ...p, status: p.status === "Mastered" ? "In Progress" : "Mastered" }
          : p
      )
    );

  const patternCard = patternsList[cardIndex];
  const patternQuizWord = patternsList[quizIndex];

  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          <div className="stats-grid">
            <div className="stat dark">
              <div className="stat-head">
                <span className="stat-label">TOTAL PATTERNS</span>
                <span className="stat-pill dark">{patternsMastered} mastered</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value">{patternsList.length}</span>
                <span className="stat-note" style={{ color: "#a8a29e" }}>active rules</span>
              </div>
            </div>

            {/* 🎯 Patterns Goal Stats Card */}
            <div 
              className="stat" 
              style={{ cursor: "pointer", border: "1px solid #fed7aa" }} 
              onClick={() => setGoalModalOpen(true)}
              title="Click to manage pattern study targets"
            >
              <div className="stat-head">
                <span className="stat-label">TODAY'S GOAL</span>
                <span className="stat-pill" style={{ backgroundColor: "#ffedd5", color: "#c2410c", fontWeight: 700 }}>
                  🎯 {patternDailyCount >= patternDailyTarget ? "Achieved!" : "In Progress"}
                </span>
              </div>
              <div className="stat-foot">
                <span className="stat-value" style={{ color: "#c2410c" }}>
                  {patternDailyCount} <span style={{ fontSize: 16, color: "var(--muted)" }}>/ {patternDailyTarget}</span>
                </span>
                <span className="stat-note" style={{ color: "#9a3412" }}>
                  Week: {patternWeeklyCount}/{patternWeeklyTarget}
                </span>
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

            <div className="filters-cluster">
              {/* 🎯 Goals Launcher Button */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setGoalModalOpen(true)}
                title="Set and track pattern study goals"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  borderColor: "#fed7aa",
                  backgroundColor: "#fff7ed",
                  color: "#9a3412",
                  fontWeight: 600,
                }}
              >
                <span>🎯</span> Goals ({patternDailyCount}/{patternDailyTarget})
              </button>

              <div className="filters">
                <CustomDropdown
                  icon="🏷"
                  value={articleFilter}
                  options={GENDER_OPTIONS}
                  onChange={(val) => setArticleFilter(val)}
                />
              </div>

              <div className="filters">
                <CustomDropdown
                  icon="📌"
                  value={statusFilter}
                  options={STATUS_FILTER_OPTIONS}
                  onChange={(val) => setStatusFilter(val)}
                />
              </div>

              <div className="filters">
                <CustomDropdown
                  icon="📅"
                  value={dateFilter}
                  options={DATE_OPTIONS}
                  onChange={(val) => setDateFilter(val)}
                />
                {dateFilter === "custom" && (
                  <input
                    type="date"
                    className="date-select"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
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

              <div className="filters">
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
                onClick={() => {
                  playDangerSound();
                  setResetModalOpen(true);
                }}
                className="btn btn-secondary"
                style={{
                  color: "#dc2626",
                  borderColor: "#fca5a5",
                  backgroundColor: "#fef2f2",
                }}
                title="Reset all patterns"
              >
                🔄 Reset
              </button>

              <button onClick={openAddModal} className="btn btn-primary">
                + Add Suffix Pattern
              </button>
            </div>
          </div>

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
                                  () => onCommitPatterns(patternsList.filter((p) => p.id !== rule.id))
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
        </div>
      )}

      {viewMode === "flashcards" && (
        <div className="panel">
          {!patternCard ? (
            <p>No patterns available.</p>
          ) : (
            <div className="flash-wrap">
              <div className="flash" onClick={() => setCardFlipped(!cardFlipped)}>
                {!cardFlipped ? (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>WHICH ARTICLE BELONGS TO THIS PATTERN?</span>
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
                <button className="btn btn-secondary" disabled={cardIndex === 0} onClick={() => { setCardIndex(cardIndex - 1); setCardFlipped(false); }}>◀ Previous</button>
                <button className="btn btn-secondary mid" onClick={() => speakGerman(patternCard.examples)}>🔊 Hear Examples</button>
                <button className="btn btn-secondary" disabled={cardIndex >= patternsList.length - 1} onClick={() => { setCardIndex(cardIndex + 1); setCardFlipped(false); }}>Next ▶</button>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Pattern {cardIndex + 1} of {patternsList.length}</span>
            </div>
          )}
        </div>
      )}

      {viewMode === "quiz" && (
        <div className="panel">
          {!patternQuizWord ? (
            <p>Add patterns to start quiz.</p>
          ) : (
            <div className="quiz">
              <div className="quiz-head">
                <span>Question {quizIndex + 1} of {patternsList.length}</span>
                <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {quizScore}</span>
              </div>
              <div className="quiz-card">
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Which article goes with this suffix?</span>
                <h1 style={{ fontFamily: "monospace" }}>{patternQuizWord.ending}</h1>
                <p style={{ color: "var(--muted)", margin: 0, fontSize: 14 }}>Rule: <strong style={{ color: "var(--ink-2)" }}>{patternQuizWord.rule}</strong></p>
              </div>
              <div className="quiz-opts">
                {["der", "die", "das"].map((opt) => (
                  <button
                    key={opt}
                    disabled={quizFeedback !== null}
                    className={`quiz-opt ${opt}`}
                    onClick={() => {
                      const ok = opt === patternQuizWord.article;
                      if (ok) setQuizScore((s) => s + 1);
                      setQuizFeedback(ok ? "Correct! 🎉" : `Wrong! Suffix "${patternQuizWord.ending}" takes "${patternQuizWord.article}".`);
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {quizFeedback && (
                <div style={{ marginTop: 24 }}>
                  <p style={{ fontSize: 15, fontWeight: 600 }}>{quizFeedback}</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setQuizFeedback(null);
                      if (quizIndex < patternsList.length - 1) {
                        setQuizIndex((i) => i + 1);
                      } else {
                        alert(`Pattern Quiz finished! Score: ${quizScore}/${patternsList.length}`);
                        setQuizIndex(0);
                        setQuizScore(0);
                      }
                    }}
                  >
                    {quizIndex < patternsList.length - 1 ? "Next Pattern" : "Restart"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 🎯 Study Goals Modal */}
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
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Pattern</button>
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
          onClick={(e) => e.target === e.currentTarget && setGoalCelebration((p) => ({ ...p, isOpen: false }))}
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
              src={successGif}
              alt="Celebration Success"
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
              onClick={() => setGoalCelebration((p) => ({ ...p, isOpen: false }))}
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