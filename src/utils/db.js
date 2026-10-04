export const DB_NAME = "GermanVocabVault";
export const DB_VERSION = 9;
export const STORE_NAME = "vocabulary_store";
export const VERBS_STORE_NAME = "verbs_store";
export const PATTERNS_STORE_NAME = "patterns_store";
export const PREPOSITIONS_STORE_NAME = "prepositions_store";
export const TIME_STORE_NAME = "time_store";

export const BACKUP_KEY = "current_vocab_data";
export const VERBS_BACKUP_KEY = "current_verbs_data";
export const PATTERNS_BACKUP_KEY = "current_patterns_data";
export const PREPOSITIONS_BACKUP_KEY = "current_prepositions_data";
export const TIME_BACKUP_KEY = "current_time_data";

export function openVaultDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(VERBS_STORE_NAME)) db.createObjectStore(VERBS_STORE_NAME);
      if (!db.objectStoreNames.contains(PATTERNS_STORE_NAME)) db.createObjectStore(PATTERNS_STORE_NAME);
      if (!db.objectStoreNames.contains(PREPOSITIONS_STORE_NAME)) db.createObjectStore(PREPOSITIONS_STORE_NAME);
      if (!db.objectStoreNames.contains(TIME_STORE_NAME)) db.createObjectStore(TIME_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadFromVaultDB(storeName, key) {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const getReq = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
    getReq.onsuccess = () => resolve(getReq.result || null);
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function writeToVaultDB(storeName, key, data) {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const putReq = db.transaction(storeName, "readwrite").objectStore(storeName).put(data, key);
    putReq.onsuccess = () => resolve(true);
    putReq.onerror = () => reject(putReq.error);
  });
}