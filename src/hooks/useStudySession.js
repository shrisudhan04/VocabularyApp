import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "deutschly_study_sessions_v1";
function readSessions() {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
export default function useStudySession() {
  const [sessions, setSessions] = useState(readSessions);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); }, [sessions]);
  const recordSession = useCallback(({ category = "General", reviewed = 0, correct = 0, durationSeconds = 0 } = {}) => {
    const session = { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, category, reviewed, correct, durationSeconds, completedAt: new Date().toISOString() };
    setSessions(old => [...old, session]);
    return session;
  }, []);
  return { sessions, recordSession };
}
