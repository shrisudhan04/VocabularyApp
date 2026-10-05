// src/utils/hourlyWordNotifier.js

const STORAGE_KEY = "hourlyNounNotifier";

// >>> CHANGE THIS to match how your nouns mark "in progress" <<<
const isInProgress = (w) =>
  String(w?.status || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "") === "inprogress";

const getId = (w) => String(w.id ?? `${w.article || ""}-${w.noun || ""}`);

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { shown: new Set(raw?.shown || []), last: raw?.last || null };
  } catch {
    return { shown: new Set(), last: null };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ shown: [...state.shown], last: state.last })
    );
  } catch {
    // ignore storage errors
  }
}

// Picks a random in-progress word that hasn't been shown in this cycle.
// When every eligible word has been shown, a new cycle starts.
export function pickNextWord(vocabList) {
  const eligible = (vocabList || []).filter(isInProgress);
  if (eligible.length === 0) return null;

  const state = loadState();
  const eligibleIds = new Set(eligible.map(getId));

  // Forget words that are no longer in progress
  state.shown = new Set([...state.shown].filter((id) => eligibleIds.has(id)));

  let pool = eligible.filter((w) => !state.shown.has(getId(w)));

  if (pool.length === 0) {
    // Cycle finished: start over, but avoid the same word twice in a row
    state.shown = new Set();
    pool = eligible.filter(
      (w) => eligible.length === 1 || getId(w) !== state.last
    );
  }

  const word = pool[Math.floor(Math.random() * pool.length)];
  state.shown.add(getId(word));
  state.last = getId(word);
  saveState(state);
  return word;
}

export async function requestMobileNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    alert("System notifications are not supported in this browser.");
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export async function sendNounNotification(nounItem) {
  if (!nounItem) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const title = `Word: ${nounItem.article || ""} ${nounItem.noun || ""}`.trim();
  const options = {
    body: `Plural: ${nounItem.plural || "—"} | Meaning: ${nounItem.meaning || "—"}`,
    icon: "/icons.svg",
    badge: "/apple-touch-icon.png",
    vibrate: [150, 80, 150],
    tag: "hourly-german-noun",
    renotify: true,
  };

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, options);
        return;
      }
    } catch (err) {
      console.warn("ServiceWorker notification failed:", err);
    }
  }

  // Desktop-only fallback (throws on most mobile browsers)
  try {
    new Notification(title, options);
  } catch (err) {
    console.warn("Standard notification failed:", err);
  }
}

// getVocabList can be an array or a function returning the latest array
export function startHourlyNounNotifier(getVocabList, intervalMs = 60 * 60 * 1000) {
  const intervalId = setInterval(() => {
    const list = typeof getVocabList === "function" ? getVocabList() : getVocabList;
    const word = pickNextWord(list);
    if (word) sendNounNotification(word);
  }, intervalMs);

  return intervalId; // call clearInterval(intervalId) on cleanup
}