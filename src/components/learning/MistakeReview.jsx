import React from "react";
import VocabularyList from "./VocabularyList";

export default function MistakeReview({ mistakes = [], onRetry, onRemove }) {
  return <section className="mistake-review">
    <h2>My mistakes</h2>
    <p>Review words and questions that need more practice.</p>
    <VocabularyList items={mistakes} onEdit={onRetry} onDelete={onRemove} emptyMessage="No mistakes recorded yet." />
  </section>;
}
