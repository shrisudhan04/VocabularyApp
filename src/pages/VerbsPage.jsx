import { useState } from "react";
import CustomDropdown from "../components/CustomDropdown";
import { VERB_CASE_CLASS, DATE_OPTIONS, STATUS_OPTIONS } from "../constants/seedData";
import { speakGerman } from "../utils/speech";

export default function VerbsPage({
  viewMode,
  verbsList,
  onCommitVerbs,
  onRequestConfirm,
}) {
  const [search, setSearch] = useState("");
  const [verbFilter, setVerbFilter] = useState("all");
  const [verbStatusFilter, setVerbStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingVerbId, setEditingVerbId] = useState(null);
  const [verbFormData, setVerbFormData] = useState({
    verb: "",
    preterite: "",
    participle: "",
    caseType: "Dativ",
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

  const filteredVerbs = verbsList.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      item.verb.toLowerCase().includes(q) ||
      (item.preterite && item.preterite.toLowerCase().includes(q)) ||
      (item.participle && item.participle.toLowerCase().includes(q)) ||
      item.meaning.toLowerCase().includes(q) ||
      item.example.toLowerCase().includes(q);
    const matchesCase = verbFilter === "all" || item.caseType === verbFilter;
    const matchesStatus = verbStatusFilter === "all" || item.status === verbStatusFilter;
    return matchesSearch && matchesCase && matchesStatus && matchesDateFilter(item.createdAt);
  });

  const verbsMastered = verbsList.filter((i) => i.status === "Mastered").length;
  const countVerb = (c) => verbsList.filter((i) => i.caseType === c).length;

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!verbFormData.verb.trim() || !verbFormData.meaning.trim()) return;
    const updated = editingVerbId
      ? verbsList.map((item) => (item.id === editingVerbId ? { ...item, ...verbFormData } : item))
      : [...verbsList, { id: Date.now(), ...verbFormData, createdAt: new Date().toISOString() }];
    onCommitVerbs(updated);
    setModalOpen(false);
  };

  const verbCard = verbsList[cardIndex];
  const verbQuizWord = verbsList[quizIndex];

  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          <div className="stats-grid">
            <div className="stat dark">
              <div className="stat-head"><span className="stat-label">TOTAL VERBS</span><span className="stat-pill dark">{verbsMastered} mastered</span></div>
              <div className="stat-foot"><span className="stat-value">{verbsList.length}</span></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">DATIV</span><span className="stat-pill bg-dativ">Dativ</span></div>
              <div className="stat-foot"><span className="stat-value c-dativ">{countVerb("Dativ")}</span></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">AKKUSATIV</span><span className="stat-pill bg-akku">Akkusativ</span></div>
              <div className="stat-foot"><span className="stat-value c-akku">{countVerb("Akkusativ")}</span></div>
            </div>
            <div className="stat">
              <div className="stat-head"><span className="stat-label">BOTH / COMMON</span><span className="stat-pill bg-both">Both</span></div>
              <div className="stat-foot"><span className="stat-value c-both">{countVerb("Both / Common")}</span></div>
            </div>
          </div>

          <div className="toolbar">
            <div className="search">
              <span role="img" aria-label="search">🔍</span>
              <input
                type="search"
                placeholder="Search verb, past forms, meaning..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filters-cluster">
              <div className="filters">
                <span className="filters-label">Case:</span>
                <button onClick={() => setVerbFilter("all")} className={`chip all ${verbFilter === "all" ? "on" : ""}`}>All</button>
                <button onClick={() => setVerbFilter("Dativ")} className={`chip dativ ${verbFilter === "Dativ" ? "on" : ""}`}>Dativ</button>
                <button onClick={() => setVerbFilter("Akkusativ")} className={`chip akku ${verbFilter === "Akkusativ" ? "on" : ""}`}>Akkusativ</button>
                <button onClick={() => setVerbFilter("Both / Common")} className={`chip both ${verbFilter === "Both / Common" ? "on" : ""}`}>Both</button>
              </div>

              <div className="filters">
                <span className="filters-label">Status:</span>
                <button onClick={() => setVerbStatusFilter("all")} className={`chip all ${verbStatusFilter === "all" ? "on" : ""}`}>All</button>
                <button onClick={() => setVerbStatusFilter("In Progress")} className={`chip all ${verbStatusFilter === "In Progress" ? "on" : ""}`}>In Progress</button>
                <button onClick={() => setVerbStatusFilter("Mastered")} className={`chip das ${verbStatusFilter === "Mastered" ? "on" : ""}`}>Mastered</button>
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
                  setEditingVerbId(null);
                  setVerbFormData({ verb: "", preterite: "", participle: "", caseType: "Dativ", meaning: "", example: "", status: "In Progress" });
                  setModalOpen(true);
                }}
                className="btn btn-primary"
              >
                + Add Verb
              </button>
            </div>
          </div>

          <div className="list">
            <div className="list-head verbs-head">
              <span style={{ textAlign: "center" }}>#</span>
              <span>CASE</span>
              <span>INFINITIVE</span>
              <span>PAST (PRÄT / PART II)</span>
              <span>MEANING</span>
              <span>EXAMPLE SENTENCE</span>
              <span>STATUS</span>
              <span style={{ textAlign: "right" }}>ACTIONS</span>
            </div>
            {filteredVerbs.map((item, index) => (
              <div className={`row verb-row ${item.caseType === "Both / Common" ? "Both" : item.caseType}`} key={item.id}>
                <div className="c-idx">{index + 1}</div>
                <div className="c-case"><span className={`pill ${VERB_CASE_CLASS[item.caseType] || "bg-both"}`}>{item.caseType}</span></div>
                <div className="c-verb" style={{ fontWeight: 700 }}>{item.verb}</div>
                <div className="c-past">{item.preterite || "—"} / {item.participle || "—"}</div>
                <div className="c-mean">{item.meaning}</div>
                <div className="c-eg">{item.example || "—"}</div>
                <div className="c-status">
                  <button
                    onClick={() =>
                      onCommitVerbs(verbsList.map((i) => i.id === item.id ? { ...i, status: i.status === "Mastered" ? "In Progress" : "Mastered" } : i))
                    }
                    className={`status ${item.status === "Mastered" ? "done" : "todo"}`}
                  >
                    {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                  </button>
                </div>
                <div className="actions">
                  <button onClick={() => speakGerman(`${item.verb}. ${item.preterite || ""}. ${item.participle || ""}. ${item.example || ""}`)} className="icon-btn">🔊</button>
                  <button
                    onClick={() => {
                      setEditingVerbId(item.id);
                      setVerbFormData({
                        verb: item.verb,
                        preterite: item.preterite || "",
                        participle: item.participle || "",
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
                      onRequestConfirm("Delete Verb", `Are you sure you want to delete the verb "${item.verb}"?`, () =>
                        onCommitVerbs(verbsList.filter((i) => i.id !== item.id))
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
          {!verbCard ? (
            <p>No verbs available.</p>
          ) : (
            <div className="flash-wrap">
              <div className="flash" onClick={() => setCardFlipped(!cardFlipped)}>
                {!cardFlipped ? (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>RECALL CASE &amp; PAST TENSE FORMS</span>
                    <h2>{verbCard.verb}</h2>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                  </>
                ) : (
                  <>
                    <span className={`pill ${VERB_CASE_CLASS[verbCard.caseType] || "bg-both"}`} style={{ fontSize: 20, padding: "6px 20px" }}>
                      {verbCard.caseType}
                    </span>
                    <p style={{ margin: "14px 0 4px", fontSize: 18, fontWeight: 700, color: "var(--brand)" }}>
                      Präteritum: {verbCard.preterite || "—"} | Partizip II: {verbCard.participle || "—"}
                    </p>
                    <h3 style={{ fontSize: 22, margin: "6px 0", color: "var(--ink-2)" }}>{verbCard.meaning}</h3>
                    {verbCard.example && <p style={{ color: "var(--muted)", margin: 0, fontSize: 14, fontStyle: "italic" }}>"{verbCard.example}"</p>}
                  </>
                )}
              </div>
              <div className="flash-controls">
                <button className="btn btn-secondary" disabled={cardIndex === 0} onClick={() => { setCardIndex(cardIndex - 1); setCardFlipped(false); }}>◀ Previous</button>
                <button className="btn btn-secondary mid" onClick={() => speakGerman(`${verbCard.verb}. ${verbCard.preterite || ""}. ${verbCard.participle || ""}.`)}>🔊 Pronounce</button>
                <button className="btn btn-secondary" disabled={cardIndex >= verbsList.length - 1} onClick={() => { setCardIndex(cardIndex + 1); setCardFlipped(false); }}>Next ▶</button>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Verb {cardIndex + 1} of {verbsList.length}</span>
            </div>
          )}
        </div>
      )}

      {viewMode === "quiz" && (
        <div className="panel">
          {!verbQuizWord ? (
            <p>Add verbs to start quiz.</p>
          ) : (
            <div className="quiz">
              <div className="quiz-head">
                <span>Question {quizIndex + 1} of {verbsList.length}</span>
                <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {quizScore}</span>
              </div>
              <div className="quiz-card">
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Which case is required by this verb?</span>
                <h1>{verbQuizWord.verb}</h1>
                <p style={{ color: "var(--muted)", margin: "4px 0", fontSize: 14 }}>
                  Past: <strong>{verbQuizWord.preterite || "—"} / {verbQuizWord.participle || "—"}</strong>
                </p>
                <p style={{ color: "var(--muted)", margin: 0, fontSize: 15 }}>
                  Meaning: <strong style={{ color: "var(--ink-2)" }}>{verbQuizWord.meaning}</strong>
                </p>
              </div>
              <div className="quiz-opts">
                {[{ l: "Dativ", v: "Dativ" }, { l: "Akkusativ", v: "Akkusativ" }, { l: "Both", v: "Both / Common" }].map((opt) => (
                  <button
                    key={opt.v}
                    disabled={quizFeedback !== null}
                    className={`quiz-opt ${opt.l}`}
                    onClick={() => {
                      const ok = opt.v === verbQuizWord.caseType;
                      if (ok) setQuizScore((s) => s + 1);
                      setQuizFeedback(ok ? "Correct! 🎉" : `Wrong! "${verbQuizWord.verb}" governs "${verbQuizWord.caseType}".`);
                    }}
                  >
                    {opt.l}
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
                      if (quizIndex < verbsList.length - 1) {
                        setQuizIndex((i) => i + 1);
                      } else {
                        alert(`Verb Quiz finished! Score: ${quizScore}/${verbsList.length}`);
                        setQuizIndex(0);
                        setQuizScore(0);
                      }
                    }}
                  >
                    {quizIndex < verbsList.length - 1 ? "Next Verb" : "Restart"}
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
            <h3>{editingVerbId ? "Edit Verb" : "Add New Verb"}</h3>
            <form onSubmit={handleSaveModal}>
              <div>
                <label className="modal-label">Grammatical Case</label>
                <div className="radios">
                  {["Dativ", "Akkusativ", "Both / Common"].map((c) => (
                    <label key={c} className={`radio ${verbFormData.caseType === c ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="caseType"
                        value={c}
                        checked={verbFormData.caseType === c}
                        onChange={(e) => setVerbFormData({ ...verbFormData, caseType: e.target.value })}
                      />
                      {c === "Both / Common" ? "Both" : c}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="modal-label">Infinitive Verb</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. helfen"
                  value={verbFormData.verb}
                  onChange={(e) => setVerbFormData({ ...verbFormData, verb: e.target.value })}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="modal-label">Präteritum (Simple Past)</label>
                  <input
                    className="modal-input"
                    type="text"
                    placeholder="e.g. half"
                    value={verbFormData.preterite}
                    onChange={(e) => setVerbFormData({ ...verbFormData, preterite: e.target.value })}
                  />
                </div>
                <div>
                  <label className="modal-label">Partizip II (Past Participle)</label>
                  <input
                    className="modal-input"
                    type="text"
                    placeholder="e.g. geholfen"
                    value={verbFormData.participle}
                    onChange={(e) => setVerbFormData({ ...verbFormData, participle: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="modal-label">English Meaning</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. to help (+ Dat)"
                  value={verbFormData.meaning}
                  onChange={(e) => setVerbFormData({ ...verbFormData, meaning: e.target.value })}
                />
              </div>
              <div>
                <label className="modal-label">Example Sentence</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. Ich helfe dir."
                  value={verbFormData.example}
                  onChange={(e) => setVerbFormData({ ...verbFormData, example: e.target.value })}
                />
              </div>
              <div>
                <label className="modal-label">Status</label>
                <CustomDropdown
                  fullWidth
                  value={verbFormData.status}
                  options={STATUS_OPTIONS}
                  onChange={(val) => setVerbFormData({ ...verbFormData, status: val })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Verb</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}