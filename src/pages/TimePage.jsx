import { useState } from "react";
import { TIME_RULES, TIME_FLASHCARDS, TIME_QUIZ } from "../constants/grammarData";
import { speakGerman } from "../utils/speech";

export default function TimePage({
  viewMode,
  timeList,
  onCommitTimes,
  onRequestConfirm,
}) {
  const [timeViewMode, setTimeViewMode] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTimeId, setEditingTimeId] = useState(null);
  const [timeFormData, setTimeFormData] = useState({ digital: "", formal: "", informal: "", rule: "" });

  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!timeFormData.digital.trim() || !timeFormData.formal.trim()) return;
    const updated = editingTimeId
      ? timeList.map((item) => ((item.id || item.digital) === editingTimeId ? { ...item, ...timeFormData } : item))
      : [...timeList, { id: `t-${Date.now()}`, ...timeFormData, createdAt: new Date().toISOString() }];
    onCommitTimes(updated);
    setModalOpen(false);
  };

  const timeCard = TIME_FLASHCARDS[cardIndex];
  const timeQuizWord = TIME_QUIZ[quizIndex];

  return (
    <>
      {viewMode === "list" && (
        <div className="grammar-hub-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Uhrzeit (Formal 24h vs. Informal 12h Format):</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div className="filters">
                <button onClick={() => setTimeViewMode("all")} className={`chip all ${timeViewMode === "all" ? "on" : ""}`}>
                  ⚖️ Compare Both
                </button>
                <button onClick={() => setTimeViewMode("formal")} className={`chip der ${timeViewMode === "formal" ? "on" : ""}`}>
                  🏢 Formal (24h)
                </button>
                <button onClick={() => setTimeViewMode("informal")} className={`chip die ${timeViewMode === "informal" ? "on" : ""}`}>
                  ☕ Informal (12h)
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingTimeId(null);
                  setTimeFormData({ digital: "", formal: "", informal: "", rule: "" });
                  setModalOpen(true);
                }}
                className="btn btn-primary"
              >
                + Add Time
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
                {timeList.map((t) => (
                  <tr key={t.id || t.digital}>
                    <td style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 14 }}>{t.digital}</td>
                    {(timeViewMode === "all" || timeViewMode === "formal") && (
                      <td style={{ color: "var(--der)", fontWeight: 600 }}>{t.formal}</td>
                    )}
                    {(timeViewMode === "all" || timeViewMode === "informal") && (
                      <td style={{ color: "var(--die)", fontWeight: 600 }}>{t.informal || "—"}</td>
                    )}
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>{t.rule}</td>
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

      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>{editingTimeId ? "Edit Time Expression" : "Add Time Expression"}</h3>
            <form onSubmit={handleSaveModal}>
              <div>
                <label className="modal-label">Digital Time (e.g. 09:15 or 17:30)</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. 14:45"
                  value={timeFormData.digital}
                  onChange={(e) => setTimeFormData({ ...timeFormData, digital: e.target.value })}
                />
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
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Time</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}