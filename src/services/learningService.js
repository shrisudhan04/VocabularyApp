import { loadFromVaultDB, writeToVaultDB } from "../utils/db";

export async function loadVocabulary(storeName, key) {
  const result = await loadFromVaultDB(storeName, key);
  return Array.isArray(result) ? result : [];
}

export async function saveVocabulary(storeName, key, items) {
  if (!Array.isArray(items)) throw new TypeError("Vocabulary must be an array.");
  await writeToVaultDB(storeName, key, items);
  return items;
}

export function recordReview(item, rating, now = new Date()) {
  const intervals = { again: 0, hard: 1, good: 3, easy: 7 };
  const days = intervals[rating];
  if (days === undefined) throw new Error(`Unknown review rating: ${rating}`);
  const reviewedAt = now.toISOString();
  const nextReviewAt = new Date(now.getTime() + days * 86400000).toISOString();
  return {
    ...item,
    reviewCount: (Number(item.reviewCount) || 0) + 1,
    lastReviewedAt: reviewedAt,
    nextReviewAt,
    status: rating === "again" ? "Forgot" : (rating === "easy" ? "Mastered" : "In Progress"),
  };
}

export function recordMistake(item, answer, correctAnswer, now = new Date()) {
  return { ...item, lastWrongAnswer: answer, correctAnswer, lastMistakeAt: now.toISOString(), mistakeCount: (Number(item.mistakeCount) || 0) + 1 };
}
