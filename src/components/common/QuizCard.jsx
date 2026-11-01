import React from "react";

export default function QuizCard({ question, options = [], value, onChange, onSubmit, feedback, disabled = false }) {
  return (
    <section className="learning-quiz-card">
      <h3>{question}</h3>
      <div className="learning-quiz-card__options">
        {options.map(option => {
          const answer = typeof option === "string" ? option : option.value;
          const label = typeof option === "string" ? option : option.label;
          return <button key={answer} type="button" disabled={disabled} aria-pressed={value === answer}
            className={value === answer ? "is-selected" : ""} onClick={() => onChange?.(answer)}>{label}</button>;
        })}
      </div>
      {feedback && <p role="status">{feedback}</p>}
      {onSubmit && <button type="button" disabled={disabled || value == null} onClick={onSubmit}>Check answer</button>}
    </section>
  );
}
