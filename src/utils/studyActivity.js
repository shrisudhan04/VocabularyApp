const KEY = "deutschly_study_activity_v1";
const localDay = date => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function readStudyActivity() {
  try { const value = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
export function recordStudyActivity({ reviewed = 0, correct = 0, durationSeconds = 0, category = "General" } = {}, date = new Date()) {
  const entries = readStudyActivity();
  const day = localDay(date);
  const index = entries.findIndex(entry => entry.day === day);
  const current = index >= 0 ? entries[index] : { day, reviewed: 0, correct: 0, durationSeconds: 0, categories: [] };
  current.reviewed += Math.max(0, Number(reviewed) || 0);
  current.correct += Math.max(0, Number(correct) || 0);
  current.durationSeconds += Math.max(0, Number(durationSeconds) || 0);
  if (category && !current.categories.includes(category)) current.categories.push(category);
  if (index >= 0) entries[index] = current; else entries.push(current);
  localStorage.setItem(KEY, JSON.stringify(entries));
  return current;
}
export function calculateActivityStreak(entries = readStudyActivity(), today = new Date()) {
  const active = new Set(entries.filter(e => e.reviewed > 0 || e.durationSeconds > 0).map(e => e.day));
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayKey = localDay(cursor);
  const yesterday = new Date(cursor); yesterday.setDate(yesterday.getDate() - 1);
  if (!active.has(todayKey) && !active.has(localDay(yesterday))) return { streak: 0, activeToday: false };
  if (!active.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(localDay(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return { streak, activeToday: active.has(todayKey) };
}
