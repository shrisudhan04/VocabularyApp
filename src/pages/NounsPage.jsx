import { useState } from "react";
import CustomDropdown from "../components/CustomDropdown";
import { ARTICLE_CLASS, DATE_OPTIONS, STATUS_OPTIONS, GENDER_MAP } from "../constants/seedData";
import { speakGerman } from "../utils/speech";
import { GoogleGenAI, Type } from "@google/genai";
import alertGif from "../assets/alert.gif";
import successGif from "../assets/success.gif";
import "../App.css";

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

  // Alert & Success Modal states
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateWordName, setDuplicateWordName] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successWordInfo, setSuccessWordInfo] = useState({ article: "", noun: "" });

  // AI / Generation helper states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);

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

      const candidateModels = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3-flash"];
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
    if (!cleanNoun || !nounFormData.meaning.trim()) return;

    // Check duplicate
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
    const updated = editingNounId
      ? vocabList.map((item) =>
          item.id === editingNounId ? { ...item, ...nounFormData, gender } : item
        )
      : [
          ...vocabList,
          {
            id: Date.now(),
            ...nounFormData,
            gender,
            createdAt: new Date().toISOString(),
          },
        ];

    onCommitNouns(updated);
    setModalOpen(false);

    // Trigger Success GIF Popup
    setSuccessWordInfo({
      article: nounFormData.article,
      noun: cleanNoun,
      isEdit: Boolean(editingNounId),
    });
    setSuccessModalOpen(true);

    // Optional: automatically dismiss after 2.2 seconds
    setTimeout(() => {
      setSuccessModalOpen(false);
    }, 2200);
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
                <span className="filters-label">Gender:</span>
                <button onClick={() => setArticleFilter("all")} className={`chip all ${articleFilter === "all" ? "on" : ""}`}>All</button>
                {["der", "die", "das"].map((a) => (
                  <button key={a} onClick={() => setArticleFilter(a)} className={`chip ${a} ${articleFilter === a ? "on" : ""}`}>{a}</button>
                ))}
              </div>

              <div className="filters">
                <span className="filters-label">Status:</span>
                <button onClick={() => setNounStatusFilter("all")} className={`chip all ${nounStatusFilter === "all" ? "on" : ""}`}>All</button>
                <button onClick={() => setNounStatusFilter("In Progress")} className={`chip all ${nounStatusFilter === "In Progress" ? "on" : ""}`}>In Progress</button>
                <button onClick={() => setNounStatusFilter("Mastered")} className={`chip das ${nounStatusFilter === "Mastered" ? "on" : ""}`}>Mastered</button>
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

              <button
                onClick={() => {
                  setEditingNounId(null);
                  setAiError("");
                  setNounFormData({ noun: "", plural: "", article: "der", meaning: "", status: "In Progress" });
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
                    🗑️
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

      {/* Duplicate Word Alert Modal with GIF */}
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

      {/* Success Modal with GIF */}
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
    </>
  );
}