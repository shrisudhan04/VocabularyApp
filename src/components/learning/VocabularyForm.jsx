import React, { useState } from "react";

const empty = { word: "", meaning: "", category: "" };
export default function VocabularyForm({ initialValue = empty, onSave, onCancel }) {
  const [form, setForm] = useState({ ...empty, ...initialValue });
  const update = e => setForm(old => ({ ...old, [e.target.name]: e.target.value }));
  const submit = e => {
    e.preventDefault();
    if (!form.word.trim()) return;
    onSave?.({ ...form, word: form.word.trim(), meaning: form.meaning.trim() });
  };
  return <form onSubmit={submit} className="vocabulary-form">
    <label>German word<input name="word" value={form.word} onChange={update} required /></label>
    <label>Meaning<input name="meaning" value={form.meaning} onChange={update} /></label>
    <label>Category<input name="category" value={form.category} onChange={update} /></label>
    <div><button type="submit">Save word</button>{onCancel && <button type="button" onClick={onCancel}>Cancel</button>}</div>
  </form>;
}
