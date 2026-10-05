// src/components/WordToast.jsx
import { useEffect } from "react";

export default function WordToast({ word, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!word) return null;

  return (
    <div className="word-toast">
      <div className="word-toast-header">
        <span className="word-toast-badge">🔔 WORD OF THE HOUR</span>
        <button type="button" className="word-toast-close" onClick={onClose}>✕</button>
      </div>
      <div className="word-toast-title">
        <span className="toast-article">{word.article}</span> {word.noun}
      </div>
      <div className="word-toast-details">
        <span><strong>Meaning:</strong> {word.meaning || "—"}</span>
        <span><strong>Plural:</strong> {word.plural || "—"}</span>
      </div>
    </div>
  );
}