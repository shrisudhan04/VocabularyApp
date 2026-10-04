import { useState } from "react";
import CustomDropdown from "../components/CustomDropdown";
import { PREP_CASE_CLASS, DATE_OPTIONS, STATUS_OPTIONS } from "../constants/seedData";
import { speakGerman } from "../utils/speech";

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
  const [prepFormData, setPrepFormData] = useState({
    prep: "",
    caseType: "Akkusativ",
    meaning: "",
    example: "",
    status: "In Progress",
  });

  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);

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
      item.meaning.toLowerCase().includes(q) ||
      item.example.toLowerCase().includes(q);
    const matchesCase = prepFilter === "all" || item.caseType === prepFilter;
    const matchesStatus = prepStatusFilter === "all" || item.status === prepStatusFilter;
    return matchesSearch && matchesCase && matchesStatus && matchesDateFilter(item.createdAt);
  });

  const prepsMastered = prepsList.filter((i) => i.status === "Mastered").length;
  const countPrep = (c) => prepsList.filter((i) => i.caseType === c).length;

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!prepFormData.prep.trim() || !prepFormData.meaning.trim()) return;
    const updated = editingPrepId
      ? prepsList.map((item) => (item.id === editingPrepId ? { ...item, ...prepFormData } : item))
      : [...prepsList, { id: Date.now(), ...prepFormData, createdAt: new Date().toISOString() }];
    onCommitPreps(updated);
    setModalOpen(false);
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

              <button
                onClick={() => {
                  setEditingPrepId(null);
                  setPrepFormData({ prep: "", caseType: "Akkusativ", meaning: "", example: "", status: "In Progress" });
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
                      setPrepFormData({
                        prep: item.prep,
                        caseType: item.caseType,
                        meaning: item.meaning,
                        example: item.example,
                        status: item.status,
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
                {["Akkusativ", "Dativ", "Wechsel"].map((opt) => (
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

      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>{editingPrepId ? "Edit Preposition" : "Add New Preposition"}</h3>
            <form onSubmit={handleSaveModal}>
              <div>
                <label className="modal-label">Required Case</label>
                <div className="radios">
                  {["Akkusativ", "Dativ", "Wechsel"].map((c) => (
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
                <label className="modal-label">English Meaning</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. without, with"
                  value={prepFormData.meaning}
                  onChange={(e) => setPrepFormData({ ...prepFormData, meaning: e.target.value })}
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
    </>
  );
}