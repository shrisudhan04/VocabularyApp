import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import CustomDropdown from "../components/CustomDropdown";
import { ARTICLE_CLASS, DATE_OPTIONS, STATUS_OPTIONS, GENDER_MAP } from "../constants/seedData";
import { speakGerman } from "../utils/speech";
import { GoogleGenAI, Type } from "@google/genai";
import alertGif from "../assets/Alert.gif";
import successGif from "../assets/Success.gif";
import warningRedGif from "../assets/WarningRed.gif";
import "../App.css";

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

const EXCEL_ACTIONS = [
  { label: "Excel Actions ▾", value: "" },
  { label: "📥 Import", value: "import" },
  { label: "📤 Export", value: "export" },
];

export default function NounsPage({
  viewMode,
  vocabList,
  onCommitNouns,
  onRequestConfirm,
}) {
  const [search, setSearch] = useState("");
  const [articleFilter, setArticleFilter] = useState("all");
  const [nounStatusFilter, setNounStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingNounId, setEditingNounId] = useState(null);
  const [nounFormData, setNounFormData] = useState({
    noun: "",
    plural: "",
    article: "der",
    meaning: "",
    status: "In Progress",
  });

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateWordName, setDuplicateWordName] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successWordInfo, setSuccessWordInfo] = useState({ article: "", noun: "" });
  const [resetModalOpen, setResetModalOpen] = useState(false);

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

  // Helper calculating live counts
  const getGoalCounts = (list) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayOfWeek = now.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday).getTime();

    let daily = 0;
    let weekly = 0;

    list.forEach((item) => {
      const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      if (itemTime >= startOfToday) daily += 1;
      if (itemTime >= startOfWeek) weekly += 1;
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

  const handleConfirmReset = () => {
    onCommitNouns([]);
    setCardIndex(0);
    setCardFlipped(false);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback(null);
    setResetModalOpen(false);
  };

  const exportToExcel = () => {
    if (!vocabList || vocabList.length === 0) {
      alert("No nouns to export.");
      return;
    }

    const exportData = vocabList.map((item, index) => ({
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
          vocabList.map((v) => v.noun?.trim().toLowerCase())
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
          const updatedList = [...vocabList, ...newEntries];
          verifyGoalMilestone(vocabList, updatedList, `${newEntries.length} new nouns`);
          onCommitNouns(updatedList);
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
      setAiError("VITE_GEMINI_API_KEY is not defined. Ensure .env is in the root directory and restart Vite.");
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

      const promptConfig = {
        contents: `Translate the English noun "${nounFormData.meaning.trim()}" into German. Provide the definite nominative singular article (der, die, or das), singular noun, and full plural form including article.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              article: {
                type: Type.STRING,
                enum: ["der", "die", "das"],
              },
              noun: {
                type: Type.STRING,
              },
              plural: {
                type: Type.STRING,
              },
            },
            required: ["article", "noun", "plural"],
          },
        },
      };

      // Updated model identifiers
      const candidateModels = ["gemini-2.5-flash", "gemini-3.8-flash"];
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
            err?.status === "NOT_FOUND" ||
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

      setNounFormData((prev) => ({
        ...prev,
        article: parsed.article,
        noun: parsed.noun,
        plural: parsed.plural,
      }));
    } catch (err) {
      if (err?.message?.includes("503") || err?.status === "UNAVAILABLE") {
        setAiError("Servers are currently experiencing high demand. Please tap 'Generate' again in a few moments.");
      } else {
        setAiError(err.message || "Failed to generate noun.");
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

  const filteredNouns = vocabList.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      item.noun.toLowerCase().includes(q) ||
      (item.plural && item.plural.toLowerCase().includes(q)) ||
      item.meaning.toLowerCase().includes(q);
    const matchesArt = articleFilter === "all" || item.article === articleFilter;
    const matchesStatus = nounStatusFilter === "all" || item.status === nounStatusFilter;
    return matchesSearch && matchesArt && matchesStatus && matchesDateFilter(item.createdAt);
  });

  const nounsMastered = vocabList.filter((i) => i.status === "Mastered").length;
  const countNoun = (art) => vocabList.filter((i) => i.article === art).length;

  const handleSaveModal = (e) => {
    e.preventDefault();

    const cleanNoun = nounFormData.noun.trim();
    if (!cleanNoun || !nounFormData.meaning.trim()) {
      return;
    }

    const isDuplicate = vocabList.some(
      (item) =>
        item.noun.trim().toLowerCase() === cleanNoun.toLowerCase() &&
        item.id !== editingNounId
    );

    if (isDuplicate) {
      setDuplicateWordName(cleanNoun);
      setDuplicateModalOpen(true);
      return;
    }

    const gender = GENDER_MAP[nounFormData.article] || "";
    let updated;
    const isEditing = Boolean(editingNounId);

    if (isEditing) {
      updated = vocabList.map((item) =>
        item.id === editingNounId ? { ...item, ...nounFormData, gender } : item
      );
    } else {
      updated = [
        ...vocabList,
        {
          id: Date.now(),
          ...nounFormData,
          gender,
          createdAt: new Date().toISOString(), // Ensures immediate increment in goal counts
        },
      ];
    }

    const reachedGoal = !isEditing && verifyGoalMilestone(vocabList, updated, `${nounFormData.article} ${cleanNoun}`);

    onCommitNouns(updated);
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

  const nounCard = vocabList[cardIndex];
  const nounQuizWord = vocabList[quizIndex];

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
                <span className="stat-value">{vocabList.length}</span>
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

            <div className="filters-cluster">
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
                  value={nounStatusFilter}
                  options={STATUS_FILTER_OPTIONS}
                  onChange={(val) => setNounStatusFilter(val)}
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
                onClick={() => setResetModalOpen(true)}
                className="btn btn-secondary"
                style={{
                  color: "#dc2626",
                  borderColor: "#fca5a5",
                  backgroundColor: "#fef2f2",
                }}
                title="Reset all nouns"
              >
                🔄 Reset
              </button>

              <button
                onClick={() => {
                  setEditingNounId(null);
                  setAiError("");
                  setNounFormData({
                    noun: "",
                    plural: "",
                    article: "der",
                    meaning: "",
                    status: "In Progress",
                  });
                  setModalOpen(true);
                }}
                className="btn btn-primary"
              >
                + Add Noun
              </button>
            </div>
          </div>

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
                    onClick={() =>
                      onCommitNouns(vocabList.map((i) => i.id === item.id ? { ...i, status: i.status === "Mastered" ? "In Progress" : "Mastered" } : i))
                    }
                    className={`status ${item.status === "Mastered" ? "done" : "todo"}`}
                  >
                    {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                  </button>
                </div>
                <div className="actions">
                  <button onClick={() => speakGerman(`${item.article} ${item.noun}. ${item.plural || ""}`)} className="icon-btn">🔊</button>
                  <button
                    onClick={() => {
                      setEditingNounId(item.id);
                      setAiError("");
                      setNounFormData({ noun: item.noun, plural: item.plural || "", article: item.article, meaning: item.meaning, status: item.status });
                      setModalOpen(true);
                    }}
                    className="icon-btn"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() =>
                      onRequestConfirm("Delete Noun", `Are you sure you want to delete "${item.article} ${item.noun}"?`, () =>
                        onCommitNouns(vocabList.filter((i) => i.id !== item.id))
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
          {!nounCard ? (
            <p>No nouns available.</p>
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
                <button className="btn btn-secondary" disabled={cardIndex >= vocabList.length - 1} onClick={() => { setCardIndex(cardIndex + 1); setCardFlipped(false); }}>
                  Next ▶
                </button>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Card {cardIndex + 1} of {vocabList.length}</span>
            </div>
          )}
        </div>
      )}

      {viewMode === "quiz" && (
        <div className="panel">
          {!nounQuizWord ? (
            <p>Add nouns to start quiz.</p>
          ) : (
            <div className="quiz">
              <div className="quiz-head">
                <span>Question {quizIndex + 1} of {vocabList.length}</span>
                <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {quizScore}</span>
              </div>
              <div className="quiz-card">
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Choose the correct article:</span>
                <h1>{nounQuizWord.noun}</h1>
                <p style={{ color: "var(--muted)", margin: "4px 0", fontSize: 14 }}>Plural: <strong>{nounQuizWord.plural || "—"}</strong></p>
                <p style={{ color: "var(--muted)", margin: 0, fontSize: 15 }}>Meaning: <strong style={{ color: "var(--ink-2)" }}>{nounQuizWord.meaning}</strong></p>
              </div>
              <div className="quiz-opts">
                {["der", "die", "das"].map((opt) => (
                  <button
                    key={opt}
                    disabled={quizFeedback !== null}
                    className={`quiz-opt ${opt}`}
                    onClick={() => {
                      const ok = opt === nounQuizWord.article;
                      if (ok) setQuizScore((s) => s + 1);
                      setQuizFeedback(ok ? "Correct! 🎉" : `Wrong! Correct article is "${nounQuizWord.article}".`);
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
                      if (quizIndex < vocabList.length - 1) {
                        setQuizIndex((i) => i + 1);
                      } else {
                        alert(`Quiz finished! Score: ${quizScore}/${vocabList.length}`);
                        setQuizIndex(0);
                        setQuizScore(0);
                      }
                    }}
                  >
                    {quizIndex < vocabList.length - 1 ? "Next Word" : "Restart"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
              style={{
                width: 90,
                height: 90,
                objectFit: "contain",
                marginBottom: 16,
              }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#dc2626" }}>
              Reset All Nouns?
            </h3>
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
              style={{
                width: 100,
                height: 100,
                objectFit: "contain",
                marginBottom: 16,
              }}
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

      {/* Goal Reached Celebration Modal (Uses successGif from assets) */}
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
              style={{
                width: 100,
                height: 100,
                objectFit: "contain",
                marginBottom: 16,
              }}
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

