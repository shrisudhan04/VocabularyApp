import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import CustomDropdown from "../components/CustomDropdown";
import GoalModal from "../components/GoalModal";
import { TIME_RULES, TIME_FLASHCARDS, TIME_QUIZ } from "../constants/grammarData";
import { DATE_OPTIONS } from "../constants/seedData";
import { speakGerman } from "../utils/speech";
import { GoogleGenAI, Type } from "@google/genai";
import alertGif from "../assets/Alert.gif";
import successGif from "../assets/Success.gif";
import congratsGif from "../assets/Congrats.gif";
import warningRedGif from "../assets/WarningRed.gif";
import congratsAudio from "../assets/celebration.mp3";
import "../App.css";

// 🔍 Search helper: lowercase, strip accents, trim
const normalize = (s = "") =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// 🔊 Robust Web Audio Synthesizer with automatic AudioContext resumption
const getActiveAudioContext = async () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
};

// 1. Success chime for adding new expressions
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

// 2. Goal Celebration MP3
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

// 3. Duplicate warning buzzer
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

// 4. Danger warning for reset
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

const EXCEL_ACTIONS = [
  { label: "Excel Actions ▾", value: "" },
  { label: "📥 Import", value: "import" },
  { label: "📤 Export", value: "export" },
];

export default function TimePage({
  viewMode,
  timeList,
  onCommitTimes,
  onRequestConfirm,
}) {
  const [search, setSearch] = useState("");
  const [timeViewMode, setTimeViewMode] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTimeId, setEditingTimeId] = useState(null);
  const [timeFormData, setTimeFormData] = useState({
    digital: "",
    formal: "",
    informal: "",
    rule: "",
  });

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateWordName, setDuplicateWordName] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successWordInfo, setSuccessWordInfo] = useState({ digital: "", formal: "", isEdit: false });
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // 🎯 Study Goals Modal & Milestone State
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
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);

  const fileInputRef = useRef(null);

  const getGoalCounts = (list = []) => {
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

    list.forEach((item) => {
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

  const { daily: timeDailyCount, weekly: timeWeeklyCount } = getGoalCounts(timeList);
  const { daily: timeDailyTarget, weekly: timeWeeklyTarget } = getSavedTargets();

  const handleConfirmReset = () => {
    playDangerSound();
    onCommitTimes([]);
    setCardIndex(0);
    setCardFlipped(false);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback(null);
    setResetModalOpen(false);
  };

  const exportToExcel = () => {
    if (!timeList || timeList.length === 0) {
      alert("No time expressions to export.");
      return;
    }

    const exportData = timeList.map((item, index) => ({
      "#": index + 1,
      Digital: item.digital,
      "Formal (24h)": item.formal,
      "Informal (12h)": item.informal || "",
      "Rule / Pattern": item.rule || "",
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
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet);

        if (!rawJson || rawJson.length === 0) {
          alert("The uploaded Excel sheet contains no rows.");
          return;
        }

        const existingTimeSet = new Set(
          timeList.map((t) => t.digital?.trim().toLowerCase())
        );

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
                createdAt: new Date().toISOString(),
              });
            }
          }
        });

        if (newEntries.length > 0) {
          const updatedList = [...timeList, ...newEntries];
          const reachedGoal = verifyGoalMilestone(timeList, updatedList, `${newEntries.length} new time expressions`);
          if (!reachedGoal) {
            playSuccessSound();
          }
          onCommitTimes(updatedList);
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
        alert("Failed to parse Excel file. Please ensure it has proper column headers (Digital, Formal, Informal, Rule).");
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
      setAiError("Please provide a digital time first (e.g. 14:45 or 08:15).");
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");

      const ai = new GoogleGenAI({ apiKey });

      const promptConfig = {
        contents: `You are a German grammar specialist. For the given 24h digital time "${timeFormData.digital.trim()}", provide:
1. The exact official formal phrasing in German (e.g., "Es ist vierzehn Uhr fünfundvierzig.").
2. The standard colloquial/informal 12h phrasing in German (e.g., "Es ist Viertel vor drei.").
3. The concise grammatical rule or pattern used (e.g., "Viertel vor [next hour]" or "halb [next hour]").`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              formal: {
                type: Type.STRING,
                description: "Full German formal phrasing with capital Es and correct number words",
              },
              informal: {
                type: Type.STRING,
                description: "Full German informal 12h phrasing",
              },
              rule: {
                type: Type.STRING,
                description: "Short pattern or formula description",
              },
            },
            required: ["formal", "informal", "rule"],
          },
        },
      };

      const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash"];
      let response;

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            ...promptConfig,
          });
          break;
        } catch (err) {
          const isOverloadedOrNotFound =
            err?.status === "UNAVAILABLE" ||
            err?.message?.includes("503") ||
            err?.message?.includes("404");
          if (isOverloadedOrNotFound && modelName !== candidateModels[candidateModels.length - 1]) {
            await new Promise((res) => setTimeout(res, 800));
            continue;
          }
          throw err;
        }
      }

      const parsed = JSON.parse(response.text);

      setTimeFormData((prev) => ({
        ...prev,
        formal: parsed.formal,
        informal: parsed.informal,
        rule: parsed.rule,
      }));
    } catch (err) {
      if (err?.message?.includes("503") || err?.status === "UNAVAILABLE") {
        setAiError("Servers are experiencing high demand. Please try again in a moment.");
      } else {
        setAiError(err.message || "Failed to generate German time phrasing.");
      }
    } finally {
      setAiLoading(false);
    }
  };

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

  const filteredTimes = timeList.filter((item) => {
    const q = normalize(search);
    const matchesSearch =
      !q ||
      normalize(item.digital).includes(q) ||
      normalize(item.formal).includes(q) ||
      normalize(item.informal).includes(q) ||
      normalize(item.rule).includes(q);

    return matchesSearch && matchesDateFilter(item.createdAt);
  });

  const openAddModal = () => {
    setEditingTimeId(null);
    setAiError("");
    setTimeFormData({ digital: "", formal: "", informal: "", rule: "" });
    setModalOpen(true);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();

    const cleanDigital = timeFormData.digital.trim();
    if (!cleanDigital || !timeFormData.formal.trim()) {
      return;
    }

    const isDuplicate = timeList.some(
      (item) =>
        item.digital.trim().toLowerCase() === cleanDigital.toLowerCase() &&
        (item.id || item.digital) !== editingTimeId
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
      updated = timeList.map((item) =>
        (item.id || item.digital) === editingTimeId ? { ...item, ...timeFormData } : item
      );
    } else {
      updated = [
        ...timeList,
        {
          id: `t-${Date.now()}`,
          ...timeFormData,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const reachedGoal = !isEditing && verifyGoalMilestone(timeList, updated, cleanDigital);

    if (!reachedGoal && !isEditing) {
      playSuccessSound();
    }

    onCommitTimes(updated);
    setModalOpen(false);

    if (!reachedGoal) {
      setSuccessWordInfo({
        digital: cleanDigital,
        formal: timeFormData.formal,
        isEdit: isEditing,
      });
      setSuccessModalOpen(true);
    }
  };

  const timeCard = TIME_FLASHCARDS[cardIndex];
  const timeQuizWord = TIME_QUIZ[quizIndex];

  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          <div className="stats-grid">
            <div className="stat dark">
              <div className="stat-head">
                <span className="stat-label">TOTAL TIME ENTRIES</span>
                <span className="stat-pill dark">{timeList.length} saved</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value">{timeList.length}</span>
                <span className="stat-note" style={{ color: "#a8a29e" }}>formal &amp; informal</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-head">
                <span className="stat-label">STANDARD RULES</span>
                <span className="stat-pill bg-der">Rules</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value c-der">{TIME_RULES.length}</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-head">
                <span className="stat-label">FLASHCARDS</span>
                <span className="stat-pill bg-die">Deck</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value c-die">{TIME_FLASHCARDS.length}</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-head">
                <span className="stat-label">QUIZ QUESTIONS</span>
                <span className="stat-pill bg-das">Quiz</span>
              </div>
              <div className="stat-foot">
                <span className="stat-value c-das">{TIME_QUIZ.length}</span>
              </div>
            </div>
          </div>

          <div className="toolbar">
            <div className="search">
              <span role="img" aria-label="search">🔍</span>
              <input
                type="search"
                placeholder="Search digital time, formal, or rule..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filters-cluster">
              <div className="filters">
                <CustomDropdown
                  icon="🏷"
                  value={timeViewMode}
                  options={VIEW_FORMAT_OPTIONS}
                  onChange={(val) => setTimeViewMode(val)}
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
                onClick={() => setGoalModalOpen(true)}
                className="btn btn-secondary"
                title="Configure Daily & Weekly Goals"
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

          <div className="table-wrap">
            <table className="grammar-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Digital</th>
                  {(timeViewMode === "all" || timeViewMode === "formal") && <th>Formal (Offiziell / 24h)</th>}
                  {(timeViewMode === "all" || timeViewMode === "informal") && <th>Informal (Umgangssprachlich / 12h)</th>}
                  <th>Rule / Structure</th>
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
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => speakGerman(timeViewMode === "formal" ? t.formal : t.informal || t.formal)}
                          className="icon-btn"
                          title="Pronounce"
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
                            });
                            setModalOpen(true);
                          }}
                          className="icon-btn"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onRequestConfirm("Delete Time Entry", `Are you sure you want to delete "${t.digital}"?`, () =>
                              onCommitTimes(timeList.filter((item) => (item.id || item.digital) !== (t.id || t.digital)))
                            )
                          }
                          className="icon-btn"
                          title="Delete"
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

      {/* Floating Action Button */}
      {viewMode === "list" && (
        <button
          onClick={openAddModal}
          className="fab-btn"
          title="Add Time"
          aria-label="Add Time"
        >
          +
        </button>
      )}

      {viewMode === "flashcards" && (
        <div className="panel">
          <div className="flash-wrap">
            <div className="flash" onClick={() => setCardFlipped(!cardFlipped)}>
              {!cardFlipped ? (
                <>
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>HOW DO YOU SAY THIS TIME IN GERMAN?</span>
                  <h2 style={{ fontSize: 32 }}>{timeCard.prompt}</h2>
                  <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                </>
              ) : (
                <>
                  <span className="pill bg-der" style={{ fontSize: 24, padding: "8px 24px" }}>{timeCard.answer}</span>
                  <h3 style={{ fontSize: 18, margin: "14px 0 6px", color: "var(--ink-2)" }}>{timeCard.note}</h3>
                </>
              )}
            </div>
            <div className="flash-controls">
              <button className="btn btn-secondary" disabled={cardIndex === 0} onClick={() => { setCardIndex(cardIndex - 1); setCardFlipped(false); }}>◀ Previous</button>
              <button className="btn btn-secondary mid" onClick={() => speakGerman(timeCard.answer)}>🔊 Pronounce</button>
              <button className="btn btn-secondary" disabled={cardIndex >= TIME_FLASHCARDS.length - 1} onClick={() => { setCardIndex(cardIndex + 1); setCardFlipped(false); }}>Next ▶</button>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>Flashcard {cardIndex + 1} of {TIME_FLASHCARDS.length}</span>
          </div>
        </div>
      )}

      {viewMode === "quiz" && (
        <div className="panel">
          <div className="quiz">
            <div className="quiz-head">
              <span>Question {quizIndex + 1} of {TIME_QUIZ.length}</span>
              <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {quizScore}</span>
            </div>
            <div className="quiz-card">
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Select the correct time:</span>
              <h1 style={{ fontSize: 24 }}>{timeQuizWord.q}</h1>
            </div>
            <div className="quiz-opts" style={{ gridTemplateColumns: "1fr" }}>
              {timeQuizWord.options.map((opt) => (
                <button
                  key={opt}
                  disabled={quizFeedback !== null}
                  className="quiz-opt"
                  onClick={() => {
                    const ok = opt === timeQuizWord.answer;
                    if (ok) setQuizScore((s) => s + 1);
                    setQuizFeedback(ok ? `Correct! 🎉 ${timeQuizWord.expl}` : `Wrong! Correct phrasing is "${timeQuizWord.answer}". (${timeQuizWord.expl})`);
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
                    if (quizIndex < TIME_QUIZ.length - 1) {
                      setQuizIndex((i) => i + 1);
                    } else {
                      alert(`Time Quiz finished! Final Score: ${quizScore}/${TIME_QUIZ.length}`);
                      setQuizIndex(0);
                      setQuizScore(0);
                    }
                  }}
                >
                  {quizIndex < TIME_QUIZ.length - 1 ? "Next Question" : "Restart"}
                </button>
              </div>
            )}
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

      {/* Add / Edit Time Modal */}
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

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Time
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
              Reset All Time Entries?
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              Are you sure you want to delete all saved time expressions? This action cannot be undone.
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
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--ink)" }}>Time Already Exists!</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{duplicateWordName}"</strong> is already in your time expressions list.
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
                  <strong style={{ color: "#b85c19" }}>{goalCelebration.target} time expressions</strong>!
                </>
              ) : (
                <>
                  Phenomenal work! You hit your weekly goal of{" "}
                  <strong style={{ color: "#b85c19" }}>{goalCelebration.target} time expressions</strong>!
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
              {successWordInfo.isEdit ? "Time Entry Updated!" : "Time Entry Added!"}
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{successWordInfo.digital}"</strong> ({successWordInfo.formal}) has been saved.
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
                <strong>Skipped entries:</strong>{" "}
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