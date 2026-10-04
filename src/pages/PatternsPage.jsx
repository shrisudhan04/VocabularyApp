import { useState } from "react";
import CustomDropdown from "../components/CustomDropdown";
import { ARTICLE_CLASS, DATE_OPTIONS, GENDER_MAP } from "../constants/seedData";
import { speakGerman } from "../utils/speech";

export default function PatternsPage({
  viewMode,
  patternsList,
  onCommitPatterns,
  onRequestConfirm,
}) {
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [patternFormData, setPatternFormData] = useState({
    article: "der",
    ending: "",
    rule: "",
    examples: "",
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

  const countPattern = (art) => patternsList.filter((p) => p.article === art).length;

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!patternFormData.ending.trim() || !patternFormData.rule.trim()) return;
    onCommitPatterns([
      ...patternsList,
      { id: `p-${Date.now()}`, ...patternFormData, createdAt: new Date().toISOString() },
    ]);
    setModalOpen(false);
  };

  const patternCard = patternsList[cardIndex];
  const patternQuizWord = patternsList[quizIndex];

  return (
    <>
      {viewMode === "list" && (
        <div className="section">
          <div className="stats-grid">
            <div className="stat dark">
              <div className="stat-head"><span className="stat-label">TOTAL PATTERNS</span><span className="stat-pill dark">Active Rules</span></div>
              <div className="stat-foot"><span className="stat-value">{patternsList.length}</span></div>
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
            <div className="filters">
              <span className="filters-label">Created:</span>
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
            <button
              onClick={() => {
                setPatternFormData({ article: "der", ending: "", rule: "", examples: "" });
                setModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ marginLeft: "auto" }}
            >
              + Add Suffix Pattern
            </button>
          </div>

          <div className="patterns-grid">
            {["der", "die", "das"].map((art) => (
              <div key={art} className={`pattern-col ${art}`}>
                <div className="pattern-header">
                  <div>
                    <h3 className={`c-${art}`}>{GENDER_MAP[art]} Rules</h3>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {patternsList.filter((p) => p.article === art && matchesDateFilter(p.createdAt)).length} patterns
                    </span>
                  </div>
                  <span className={`stat-pill ${ARTICLE_CLASS[art]}`}>{art}</span>
                </div>
                {patternsList
                  .filter((p) => p.article === art && matchesDateFilter(p.createdAt))
                  .map((rule) => (
                    <div key={rule.id} className="pattern-card">
                      <div className="pattern-card-top">
                        <span className={`pattern-badge ${ARTICLE_CLASS[art]}`}>{rule.ending}</span>
                        <button
                          onClick={() =>
                            onRequestConfirm("Delete Suffix Pattern", `Delete rule for "${rule.ending}"?`, () =>
                              onCommitPatterns(patternsList.filter((p) => p.id !== rule.id))
                            )
                          }
                          className="pattern-delete-btn"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="pattern-rule">{rule.rule}</p>
                      <p className="pattern-eg">e.g. {rule.examples}</p>
                    </div>
                  ))}
              </div>
            ))}
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

      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>Add Suffix / Pattern Rule</h3>
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
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. -tion"
                  value={patternFormData.ending}
                  onChange={(e) => setPatternFormData({ ...patternFormData, ending: e.target.value })}
                />
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
              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Pattern</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}