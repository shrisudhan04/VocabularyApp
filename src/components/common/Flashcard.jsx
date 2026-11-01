import React, { useState } from "react";

export default function Flashcard({ front, back, onKnow, onAgain, className = "" }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <section className={`learning-flashcard ${className}`} aria-live="polite">
      <button type="button" className="learning-flashcard__face" onClick={() => setRevealed(v => !v)}>
        <span>{revealed ? back : front}</span>
        <small>{revealed ? "Tap to see question" : "Tap to reveal answer"}</small>
      </button>
      {revealed && (
        <div className="learning-flashcard__actions">
          <button type="button" onClick={() => { onAgain?.(); setRevealed(false); }}>Review again</button>
          <button type="button" onClick={() => { onKnow?.(); setRevealed(false); }}>I knew it</button>
        </div>
      )}
    </section>
  );
}
