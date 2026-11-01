import React, { useState } from "react";
import { askAITutor } from "../services/aiService";

export default function AITutorPage() {
  const [level, setLevel] = useState("A1");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setLoading(true); setError(""); setReply("");
    try { setReply(await askAITutor({ message, level })); }
    catch (e) { setError(e.message || "Unable to contact the AI tutor."); }
    finally { setLoading(false); }
  }
  return <main className="ai-tutor-page">
    <h1>AI German Tutor</h1>
    <p>Ask grammar, vocabulary, sentence structure or translation questions.</p>
    <form onSubmit={submit}>
      <label>German level <select value={level} onChange={e => setLevel(e.target.value)}>
        {["A1", "A2", "B1", "B2"].map(x => <option key={x}>{x}</option>)}
      </select></label>
      <label>Your question<textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Why do we use Akkusativ after 'in' in this sentence?" required /></label>
      <button type="submit" disabled={loading || !message.trim()}>{loading ? "Thinking…" : "Ask tutor"}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {reply && <article className="ai-tutor-reply"><h2>Explanation</h2><p style={{ whiteSpace: "pre-wrap" }}>{reply}</p></article>}
  </main>;
}
