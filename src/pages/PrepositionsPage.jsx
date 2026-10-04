import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import CustomDropdown from "../components/CustomDropdown";
import GoalModal from "../components/GoalModal"; // Adjust path if located elsewhere
import { PREP_CASE_CLASS, DATE_OPTIONS, STATUS_OPTIONS } from "../constants/seedData";
import { speakGerman } from "../utils/speech";
import { GoogleGenAI, Type } from "@google/genai";
import alertGif from "../assets/Alert.gif";
import successGif from "../assets/Success.gif";
import warningRedGif from "../assets/WarningRed.gif";
import "../App.css";

const GEMINI_MODEL = "gemini-2.5-flash";

const CASES = ["Akkusativ", "Dativ", "Wechsel"];

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

// 1. Success chime for adding new prepositions & milestones
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

const EXCEL_ACTIONS = [
  { label: "Excel Actions ▾", value: "" },
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

export default function PrepositionsPage({
  viewMode,
  prepsList,
  onCommitPreps,
  onRequestConfirm,
}) {
  const [search, setSearch] = useState("");
  const [prepFilter, setPrepFilter] = useState("all");
  const [prepStatusFilter, setPrepStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrepId, setEditingPrepId] = useState(null);
  const [prepFormData, setPrepFormData] = useState(EMPTY_FORM);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ prep: "", isEdit: false });
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // 🎯 Study Goals Modal & Milestone Celebration
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
  const getGoalCounts = (list) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayOfWeek = now.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday).getTime();

    let daily = 0;
    let weekly = 0;

    (list || []).forEach((item) => {
      const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      if (itemTime >= startOfToday) daily += 1;
      if (itemTime >= startOfWeek) weekly += 1;
    });

    return { daily, weekly };
  };

  const getSavedTargets = () => {
    try {
      const saved = localStorage.getItem("study_goals_targets");
      if (saved) {
        const parsed = JSON.parse(saved);
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
  const { daily: prepDailyCount, weekly: prepWeeklyCount } = getGoalCounts(prepsList);
  const { daily: prepDailyTarget, weekly: prepWeeklyTarget } = getSavedTargets();

  // ---------- Reset ----------
  const handleConfirmReset = () => {
    playDangerSound();
    onCommitPreps([]);
    setCardIndex(0);
    setCardFlipped(false);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback(null);
    setResetModalOpen(false);
  };

  // ---------- Excel export / import ----------
  const exportToExcel = () => {
    if (!prepsList || prepsList.length === 0) {
      alert("No prepositions to export.");
      return;
    }

    const exportData = prepsList.map((item, index) => ({
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

        const existingSet = new Set(prepsList.map((p) => p.prep?.trim().toLowerCase()));

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
          playSuccessSound();
          const updatedList = [...prepsList, ...newEntries];
          verifyGoalMilestone(prepsList, updatedList, `${newEntries.length} new prepositions`);
          onCommitPreps(updatedList);
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
        alert("Failed to parse Excel file. Please ensure it has proper column headers (Case, Preposition, Meaning, Example).");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // ---------- AI generate ----------
  const generateGermanPrep = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      setAiError("VITE_GEMINI_API_KEY is not defined in your .env file.");
      return;
    }

    if (!prepFormData.meaning.trim()) {
      setAiError("Please provide an English meaning first (e.g. without).");
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Give the most common German preposition that means "${prepFormData.meaning.trim()}". Provide: the preposition (lowercase), the case it requires (Akkusativ, Dativ, or Wechsel for two-way prepositions that take Dativ or Akkusativ; if it takes Genitiv only, choose the closest of the three), and one short, simple A1-A2 level example sentence in German using it.`,
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

  const filteredPreps = prepsList.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      item.prep.toLowerCase().includes(q) ||
      (item.meaning || "").toLowerCase().includes(q) ||
      (item.example || "").toLowerCase().includes(q);
    const matchesCase = prepFilter === "all" || item.caseType === prepFilter;
    const matchesStatus = prepStatusFilter === "all" || item.status === prepStatusFilter;
    return matchesSearch && matchesCase && matchesStatus && matchesDateFilter(item.createdAt);
  });

  const prepsMastered = prepsList.filter((i) => i.status === "Mastered").length;
  const countPrep = (c) => prepsList.filter((i) => i.caseType === c).length;

  // ---------- Add / Edit ----------
  const handleSaveModal = (e) => {
    e.preventDefault();

    const cleanPrep = prepFormData.prep.trim();
    if (!cleanPrep || !prepFormData.meaning.trim()) return;

    const isDuplicate = prepsList.some(
      (item) =>
        item.prep.trim().toLowerCase() === cleanPrep.toLowerCase() &&
        item.id !== editingPrepId
    );

    if (isDuplicate) {
      playDuplicateSound();
      setDuplicateName(cleanPrep);
      setDuplicateModalOpen(true);
      return;
    }

    const isEditing = Boolean(editingPrepId);
    let updated;

    if (isEditing) {
      updated = prepsList.map((item) =>
        item.id === editingPrepId ? { ...item, ...prepFormData, prep: cleanPrep } : item
      );
    } else {
      playSuccessSound();
      updated = [
        ...prepsList,
        {
          id: Date.now(),
          ...prepFormData,
          prep: cleanPrep,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const reachedGoal = !isEditing && verifyGoalMilestone(prepsList, updated, cleanPrep);

    onCommitPreps(updated);
    setModalOpen(false);

    if (!reachedGoal) {
      setSuccessInfo({ prep: cleanPrep, isEdit: isEditing });
      setSuccessModalOpen(true);
    }
  };

  const prepCard = prepsList[cardIndex];
  const prepQuizWord = prepsList[quizIndex];

  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          <div className="stats-grid">
            <div className="stat dark">
              <div className="stat-head"><span className="stat-label">TOTAL PREPOSITIONS</span><span className="stat-pill dark">{prepsMastered} mastered</span></div>
              <div className="stat-foot"><span className="stat-value">{prepsList.length}</span></div>
            </div>

            {/* 🎯 Preposition Daily Goal Card */}
            <div 
              className="stat" 
              style={{ cursor: "pointer", border: "1px solid #fed7aa" }} 
              onClick={() => setGoalModalOpen(true)}
              title="Click to manage preposition study targets"
            >
              <div className="stat-head">
                <span className="stat-label">TODAY'S GOAL</span>
                <span className="stat-pill" style={{ backgroundColor: "#ffedd5", color: "#c2410c", fontWeight: 700 }}>
                  🎯 {prepDailyCount >= prepDailyTarget ? "Achieved!" : "In Progress"}
                </span>
              </div>
              <div className="stat-foot">
                <span className="stat-value" style={{ color: "#c2410c" }}>
                  {prepDailyCount} <span style={{ fontSize: 16, color: "var(--muted)" }}>/ {prepDailyTarget}</span>
                </span>
                <span className="stat-note" style={{ color: "#9a3412" }}>
                  Week: {prepWeeklyCount}/{prepWeeklyTarget}
                </span>
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
              <span role="img" aria-label="search">🔍</span>
              <input
                type="search"
                placeholder="Search preposition, meaning, or sentence..."
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
                title="Set and track preposition study goals"
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
                <span>🎯</span> Goals ({prepDailyCount}/{prepDailyTarget})
              </button>

              <div className="filters">
                <span className="filters-label">Case:</span>
                <button onClick={() => setPrepFilter("all")} className={`chip all ${prepFilter === "all" ? "on" : ""}`}>All</button>
                <button onClick={() => setPrepFilter("Akkusativ")} className={`chip akku ${prepFilter === "Akkusativ" ? "on" : ""}`}>Akkusativ</button>
                <button onClick={() => setPrepFilter("Dativ")} className={`chip dativ ${prepFilter === "Dativ" ? "on" : ""}`}>Dativ</button>
                <button onClick={() => setPrepFilter("Wechsel")} className={`chip wechsel ${prepFilter === "Wechsel" ? "on" : ""}`}>Wechsel</button>
              </div>

              <div className="filters">
                <span className="filters-label">Status:</span>
                <button onClick={() => setPrepStatusFilter("all")} className={`chip all ${prepStatusFilter === "all" ? "on" : ""}`}>All</button>
                <button onClick={() => setPrepStatusFilter("In Progress")} className={`chip all ${prepStatusFilter === "In Progress" ? "on" : ""}`}>In Progress</button>
                <button onClick={() => setPrepStatusFilter("Mastered")} className={`chip das ${prepStatusFilter === "Mastered" ? "on" : ""}`}>Mastered</button>
              </div>

              <div className="filters">
                <span className="filters-label">Created:</span>
                <CustomDropdown
                  icon="📅"
                  value={dateFilter}
                  options={DATE_OPTIONS}
                  onChange={(val) => setDateFilter(val)}
                />
                {dateFilter === "custom" && (
                  <input type="date" className="date-select" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
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
                title="Reset all prepositions"
              >
                🔄 Reset
              </button>

              <button
                onClick={() => {
                  setEditingPrepId(null);
                  setAiError("");
                  setPrepFormData(EMPTY_FORM);
                  setModalOpen(true);
                }}
                className="btn btn-primary"
              >
                + Add Preposition
              </button>
            </div>
          </div>

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
                      onCommitPreps(prepsList.map((i) => i.id === item.id ? { ...i, status: i.status === "Mastered" ? "In Progress" : "Mastered" } : i))
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
                      onRequestConfirm("Delete Preposition", `Are you sure you want to delete "${item.prep}"?`, () =>
                        onCommitPreps(prepsList.filter((i) => i.id !== item.id))
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
        </div>
      )}

      {viewMode === "flashcards" && (
        <div className="panel">
          {!prepCard ? (
            <p>No prepositions available.</p>
          ) : (
            <div className="flash-wrap">
              <div className="flash" onClick={() => setCardFlipped(!cardFlipped)}>
                {!cardFlipped ? (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>WHICH CASE DOES THIS PREPOSITION TAKE?</span>
                    <h2>{prepCard.prep}</h2>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                  </>
                ) : (
                  <>
                    <span className={`pill ${PREP_CASE_CLASS[prepCard.caseType] || "bg-both"}`} style={{ fontSize: 22, padding: "6px 20px" }}>
                      {prepCard.caseType === "Wechsel" ? "Wechselpräposition (Dat/Akk)" : `+ ${prepCard.caseType}`}
                    </span>
                    <h3 style={{ fontSize: 22, margin: "14px 0 6px", color: "var(--ink-2)" }}>{prepCard.meaning}</h3>
                    {prepCard.example && <p style={{ color: "var(--muted)", margin: 0, fontSize: 14, fontStyle: "italic" }}>"{prepCard.example}"</p>}
                  </>
                )}
              </div>
              <div className="flash-controls">
                <button className="btn btn-secondary" disabled={cardIndex === 0} onClick={() => { setCardIndex(cardIndex - 1); setCardFlipped(false); }}>◀ Previous</button>
                <button className="btn btn-secondary mid" onClick={() => speakGerman(`${prepCard.prep}. ${prepCard.example || ""}`)}>🔊 Pronounce</button>
                <button className="btn btn-secondary" disabled={cardIndex >= prepsList.length - 1} onClick={() => { setCardIndex(cardIndex + 1); setCardFlipped(false); }}>Next ▶</button>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Preposition {cardIndex + 1} of {prepsList.length}</span>
            </div>
          )}
        </div>
      )}

      {viewMode === "quiz" && (
        <div className="panel">
          {!prepQuizWord ? (
            <p>Add prepositions to start quiz.</p>
          ) : (
            <div className="quiz">
              <div className="quiz-head">
                <span>Question {quizIndex + 1} of {prepsList.length}</span>
                <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {quizScore}</span>
              </div>
              <div className="quiz-card">
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Which case is required by this preposition?</span>
                <h1>{prepQuizWord.prep}</h1>
                <p style={{ color: "var(--muted)", margin: 0, fontSize: 15 }}>Meaning: <strong style={{ color: "var(--ink-2)" }}>{prepQuizWord.meaning}</strong></p>
              </div>
              <div className="quiz-opts">
                {CASES.map((opt) => (
                  <button
                    key={opt}
                    disabled={quizFeedback !== null}
                    className={`quiz-opt ${opt}`}
                    onClick={() => {
                      const ok = opt === prepQuizWord.caseType;
                      if (ok) setQuizScore((s) => s + 1);
                      setQuizFeedback(ok ? "Correct! 🎉" : `Wrong! "${prepQuizWord.prep}" takes "${prepQuizWord.caseType}".`);
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
                      if (quizIndex < prepsList.length - 1) {
                        setQuizIndex((i) => i + 1);
                      } else {
                        alert(`Preposition Quiz finished! Score: ${quizScore}/${prepsList.length}`);
                        setQuizIndex(0);
                        setQuizScore(0);
                      }
                    }}
                  >
                    {quizIndex < prepsList.length - 1 ? "Next Preposition" : "Restart"}
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

      {/* Add / Edit Preposition Modal */}
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
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#dc2626" }}>Reset All Prepositions?</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              Are you sure you want to delete all prepositions? This action will permanently remove your entire preposition list and cannot be undone.
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
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--ink)" }}>Preposition Already Exists!</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{duplicateName}"</strong> is already in your preposition list.
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
                  <strong style={{ color: "#b85c19" }}>{goalCelebration.target} prepositions</strong>!
                </>
              ) : (
                <>
                  Phenomenal work! You hit your weekly goal of{" "}
                  <strong style={{ color: "#b85c19" }}>{goalCelebration.target} prepositions</strong>!
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
              {successInfo.isEdit ? "Preposition Updated!" : "Preposition Added Successfully!"}
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: 14 }}>
              <strong>"{successInfo.prep}"</strong> has been saved to your prepositions.
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
                <strong>Skipped prepositions:</strong>{" "}
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