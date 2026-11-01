import React from "react";

export default function VocabularyList({ items = [], onEdit, onDelete, emptyMessage = "No vocabulary found." }) {
  if (!items.length) return <p>{emptyMessage}</p>;
  return <ul className="vocabulary-list">
    {items.map((item, index) => <li key={item.id ?? item.word ?? index}>
      <div><strong>{item.word || item.german || "Untitled"}</strong><span>{item.meaning || item.english || ""}</span></div>
      {onEdit && <button type="button" onClick={() => onEdit(item)}>Edit</button>}
      {onDelete && <button type="button" onClick={() => onDelete(item)}>Delete</button>}
    </li>)}
  </ul>;
}
