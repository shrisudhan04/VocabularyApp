import {
  STORE_NAME,
  VERBS_STORE_NAME,
  PATTERNS_STORE_NAME,
  PREPOSITIONS_STORE_NAME,
  TIME_STORE_NAME,
  BACKUP_KEY,
  VERBS_BACKUP_KEY,
  PATTERNS_BACKUP_KEY,
  PREPOSITIONS_BACKUP_KEY,
  TIME_BACKUP_KEY,
  loadFromVaultDB,
  writeToVaultDB,
} from "./db";

const APP_STORAGE_KEYS = [
  "app_theme",
  "vocab_vault_theme",
  "noun_categories",
  "study_goals_targets",
  "goal_daily_target",
  "goal_weekly_target",
  "last_celebrated_streak",
  "hourlyNounNotifier",
];

const getStorageSnapshot = () => {
  const data = {};
  APP_STORAGE_KEYS.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  });
  return data;
};

export async function createDeutschlyBackup() {
  const [nouns, verbs, patterns, prepositions, time] = await Promise.all([
    loadFromVaultDB(STORE_NAME, BACKUP_KEY),
    loadFromVaultDB(VERBS_STORE_NAME, VERBS_BACKUP_KEY),
    loadFromVaultDB(PATTERNS_STORE_NAME, PATTERNS_BACKUP_KEY),
    loadFromVaultDB(PREPOSITIONS_STORE_NAME, PREPOSITIONS_BACKUP_KEY),
    loadFromVaultDB(TIME_STORE_NAME, TIME_BACKUP_KEY),
  ]);

  return {
    format: "deutschly-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { nouns: nouns || [], verbs: verbs || [], patterns: patterns || [], prepositions: prepositions || [], time: time || [] },
    localStorage: getStorageSnapshot(),
  };
}

export function downloadDeutschlyBackup(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `deutschly-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function restoreDeutschlyBackup(backup) {
  if (!backup || backup.format !== "deutschly-backup" || !backup.data) {
    throw new Error("This file is not a valid Deutschly backup.");
  }

  const data = backup.data;
  const writes = [];

  if (Array.isArray(data.nouns)) writes.push(writeToVaultDB(STORE_NAME, BACKUP_KEY, data.nouns));
  if (Array.isArray(data.verbs)) writes.push(writeToVaultDB(VERBS_STORE_NAME, VERBS_BACKUP_KEY, data.verbs));
  if (Array.isArray(data.patterns)) writes.push(writeToVaultDB(PATTERNS_STORE_NAME, PATTERNS_BACKUP_KEY, data.patterns));
  if (Array.isArray(data.prepositions)) writes.push(writeToVaultDB(PREPOSITIONS_STORE_NAME, PREPOSITIONS_BACKUP_KEY, data.prepositions));
  if (Array.isArray(data.time)) writes.push(writeToVaultDB(TIME_STORE_NAME, TIME_BACKUP_KEY, data.time));
  await Promise.all(writes);

  if (backup.localStorage && typeof backup.localStorage === "object") {
    APP_STORAGE_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(backup.localStorage, key)) {
        localStorage.setItem(key, backup.localStorage[key]);
      }
    });
  }
}
