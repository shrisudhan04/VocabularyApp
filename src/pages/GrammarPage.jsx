import { useState } from "react";
import {
  GRAMMAR_TOPICS,
  POSSESSIVE_STEMS,
  POSSESSIVE_ENDINGS,
  ARTICLES_TABLE,
  DEMONSTRATIVES_TABLE,
  PERSONAL_PRONOUNS_TABLE,
  ADJECTIVE_ENDINGS_RULES,
  GRAMMAR_FLASHCARDS,
  GRAMMAR_QUIZ,
} from "../constants/grammarData";
import { speakGerman } from "../utils/speech";

export default function GrammarPage({ viewMode }) {
  const [activeTopic, setActiveTopic] = useState("possessives");
  const [caseFilter, setCaseFilter] = useState("Nominativ");

  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);

  const getPossessiveForm = (stemObj, genderKey, caseKey) => {
    let base = stemObj.stem;
    const ending = POSSESSIVE_ENDINGS[caseKey][genderKey];
    if (base === "euer") {
      if (ending === "–") return "euer";
      return `eur${ending}`;
    }
    if (ending === "–") return base;
    return `${base}${ending}`;
  };

  const grammarCard = GRAMMAR_FLASHCARDS[cardIndex];
  const grammarQuizWord = GRAMMAR_QUIZ[quizIndex];

  return (
    <>
      {viewMode === "list" && (
        <div className="grammar-hub-card">
          <div className="grammar-topic-nav">
            {GRAMMAR_TOPICS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTopic(t.id)}
                className={`grammar-topic-btn ${activeTopic === t.id ? "active" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTopic === "possessives" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Possessive Articles Matrix:</span>
                <div className="filters">
                  {["Nominativ", "Akkusativ", "Dativ", "Genitiv"].map((c) => (
                    <button key={c} onClick={() => setCaseFilter(c)} className={`chip ${caseFilter === c ? "all on" : "all"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-wrap">
                <table className="grammar-table">
                  <thead>
                    <tr>
                      <th>Owner (Besitzer)</th>
                      <th>Stem</th>
                      <th>Masculine ({caseFilter})</th>
                      <th>Feminine ({caseFilter})</th>
                      <th>Neuter ({caseFilter})</th>
                      <th>Plural ({caseFilter})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {POSSESSIVE_STEMS.map((s) => (
                      <tr key={s.owner}>
                        <td style={{ fontWeight: 600 }}>{s.owner}</td>
                        <td className="grammar-highlight">{s.stem}-</td>
                        <td>{getPossessiveForm(s, "m", caseFilter)}</td>
                        <td>{getPossessiveForm(s, "f", caseFilter)}</td>
                        <td>{getPossessiveForm(s, "n", caseFilter)}</td>
                        <td>{getPossessiveForm(s, "pl", caseFilter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grammar-rule-box">
                <strong>Core Rules to Remember:</strong><br />
                • <strong>euer</strong> drops its middle 'e' when taking an ending: <em>euer $\rightarrow$ eure, eurem, euren, eurer</em>.<br />
                • <strong>Dativ Plural:</strong> adds <strong>-en</strong> to the possessive, and the noun adds <strong>-n</strong> (<em>mit meinen Freunden</em>).<br />
                • <strong>Genitiv M/N:</strong> possessive takes <strong>-es</strong>, noun adds <strong>-(e)s</strong> (<em>das Auto meines Bruders</em>).
              </div>
            </div>
          )}

          {activeTopic === "articles" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Definite (der) &amp; Indefinite (ein / kein) Declension:</span>
              <div className="table-wrap">
                <table className="grammar-table">
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>Definite (der/die/das)</th>
                      <th>Indefinite (ein/eine)</th>
                      <th>Negative (kein-)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(ARTICLES_TABLE).map((c) => (
                      <tr key={c}>
                        <td style={{ fontWeight: 700 }}>{c}</td>
                        <td>{ARTICLES_TABLE[c].def_m} / {ARTICLES_TABLE[c].def_f} / {ARTICLES_TABLE[c].def_n} / {ARTICLES_TABLE[c].def_pl}</td>
                        <td>{ARTICLES_TABLE[c].indef_m} / {ARTICLES_TABLE[c].indef_f} / {ARTICLES_TABLE[c].indef_n} / —</td>
                        <td>{ARTICLES_TABLE[c].indef_m.replace("ein", "kein")} / {ARTICLES_TABLE[c].indef_f.replace("ein", "kein")} / {ARTICLES_TABLE[c].indef_n.replace("ein", "kein")} / {ARTICLES_TABLE[c].neg_pl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTopic === "demonstratives" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Demonstrative (dieser-) &amp; Interrogative (welcher-):</span>
              <div className="table-wrap">
                <table className="grammar-table">
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>dieser (this) [m / f / n / pl]</th>
                      <th>welcher (which) [m / f / n / pl]</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(DEMONSTRATIVES_TABLE).map((c) => (
                      <tr key={c}>
                        <td style={{ fontWeight: 700 }}>{c}</td>
                        <td>{DEMONSTRATIVES_TABLE[c].m} / {DEMONSTRATIVES_TABLE[c].f} / {DEMONSTRATIVES_TABLE[c].n} / {DEMONSTRATIVES_TABLE[c].pl}</td>
                        <td>{DEMONSTRATIVES_TABLE[c].wm} / {DEMONSTRATIVES_TABLE[c].wf} / {DEMONSTRATIVES_TABLE[c].wn} / {DEMONSTRATIVES_TABLE[c].wpl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTopic === "personal" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Personal Pronouns (Personalpronomen):</span>
              <div className="table-wrap">
                <table className="grammar-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Nominativ</th>
                      <th>Akkusativ</th>
                      <th>Dativ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERSONAL_PRONOUNS_TABLE.map((row) => (
                      <tr key={row.p}>
                        <td style={{ fontWeight: 600 }}>{row.p}</td>
                        <td>{row.nom}</td>
                        <td className="grammar-highlight">{row.akk}</td>
                        <td style={{ fontWeight: 700, color: "var(--dativ)" }}>{row.dat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTopic === "adjectives" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Adjective Declension (Adjektivdeklination):</span>
              <div className="table-wrap">
                <table className="grammar-table">
                  <thead>
                    <tr>
                      <th>Declension Type</th>
                      <th>Nominativ</th>
                      <th>Akkusativ</th>
                      <th>Dativ / Genitiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ADJECTIVE_ENDINGS_RULES.map((r) => (
                      <tr key={r.type}>
                        <td style={{ fontWeight: 700 }}>{r.type}</td>
                        <td>{r.nom}</td>
                        <td>{r.akk}</td>
                        <td>{r.dat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === "flashcards" && (
        <div className="panel">
          <div className="flash-wrap">
            <div className="flash" onClick={() => setCardFlipped(!cardFlipped)}>
              {!cardFlipped ? (
                <>
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>GRAMMAR PRACTICE PROMPT</span>
                  <h2 style={{ fontSize: 32 }}>{grammarCard.prompt}</h2>
                  <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                </>
              ) : (
                <>
                  <span className="pill bg-der" style={{ fontSize: 26, padding: "8px 24px" }}>{grammarCard.answer}</span>
                  <h3 style={{ fontSize: 20, margin: "14px 0 6px", color: "var(--ink-2)" }}>{grammarCard.note}</h3>
                </>
              )}
            </div>
            <div className="flash-controls">
              <button className="btn btn-secondary" disabled={cardIndex === 0} onClick={() => { setCardIndex(cardIndex - 1); setCardFlipped(false); }}>◀ Previous</button>
              <button className="btn btn-secondary mid" onClick={() => speakGerman(grammarCard.answer)}>🔊 Pronounce</button>
              <button className="btn btn-secondary" disabled={cardIndex >= GRAMMAR_FLASHCARDS.length - 1} onClick={() => { setCardIndex(cardIndex + 1); setCardFlipped(false); }}>Next ▶</button>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>Flashcard {cardIndex + 1} of {GRAMMAR_FLASHCARDS.length}</span>
          </div>
        </div>
      )}

      {viewMode === "quiz" && (
        <div className="panel">
          <div className="quiz">
            <div className="quiz-head">
              <span>Question {quizIndex + 1} of {GRAMMAR_QUIZ.length}</span>
              <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {quizScore}</span>
            </div>
            <div className="quiz-card">
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Fill in the correct form:</span>
              <h1 style={{ fontSize: 26 }}>{grammarQuizWord.q}</h1>
            </div>
            <div className="quiz-opts">
              {grammarQuizWord.options.map((opt) => (
                <button
                  key={opt}
                  disabled={quizFeedback !== null}
                  className="quiz-opt"
                  onClick={() => {
                    const ok = opt === grammarQuizWord.answer;
                    if (ok) setQuizScore((s) => s + 1);
                    setQuizFeedback(ok ? `Correct! 🎉 ${grammarQuizWord.expl}` : `Wrong! Correct form is "${grammarQuizWord.answer}". (${grammarQuizWord.expl})`);
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
                    if (quizIndex < GRAMMAR_QUIZ.length - 1) {
                      setQuizIndex((i) => i + 1);
                    } else {
                      alert(`Grammar Quiz finished! Final Score: ${quizScore}/${GRAMMAR_QUIZ.length}`);
                      setQuizIndex(0);
                      setQuizScore(0);
                    }
                  }}
                >
                  {quizIndex < GRAMMAR_QUIZ.length - 1 ? "Next Question" : "Restart"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}