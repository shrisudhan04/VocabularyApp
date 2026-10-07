// src/utils/hourlyWordNotifier.js
//
// Native (Capacitor): hourly words are scheduled as LOCAL notifications on the phone,
//                     so they fire with the app closed and with no internet / no server.
// Web (browser/PWA): falls back to setInterval (works only while the tab is alive).
//
// Install:  npm i @capacitor/core @capacitor/app @capacitor/local-notifications

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const STORAGE_KEY = "hourlyNounNotifier";
const MAX_SCHEDULED = 60; // iOS allows 64 pending; stay below it everywhere
const CHANNEL_ID = "hourly-words";
const SMALL_ICON = "ic_stat_word";
const TEST_ID = 999999;

export const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const isInProgress = (w) =>
  String(w?.status || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "") === "inprogress";

const getId = (w) => String(w.id ?? `${w.article || ""}-${w.noun || ""}`);

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Changes whenever an eligible word is added, removed or edited.
export const getWordsSignature = (vocabList) =>
  (vocabList || [])
    .filter(isInProgress)
    .map((w) =>
      [getId(w), w.article || "", w.noun || "", w.plural || "", w.meaning || ""].join("¦")
    )
    .sort()
    .join("|");

// ---------------------------------------------------------------
// Persistent rotation state
// ---------------------------------------------------------------

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      shown: new Set(raw?.shown || []),
      last: raw?.last || null,
      scheduled: Array.isArray(raw?.scheduled) ? raw.scheduled : [],
    };
  } catch {
    return { shown: new Set(), last: null, scheduled: [] };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        shown: [...state.shown],
        last: state.last,
        scheduled: state.scheduled || [],
      })
    );
  } catch {
    // ignore storage errors
  }
}

// Web fallback: pick one word, no repeats until every eligible word was shown.
export function pickNextWord(vocabList) {
  const eligible = (vocabList || []).filter(isInProgress);
  if (eligible.length === 0) return null;

  const state = loadState();
  const eligibleIds = new Set(eligible.map(getId));

  state.shown = new Set([...state.shown].filter((id) => eligibleIds.has(id)));

  let pool = eligible.filter((w) => !state.shown.has(getId(w)));

  if (pool.length === 0) {
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

// ---------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------

export async function requestMobileNotificationPermission() {
  // Native app: Capacitor handles the Android 13+ POST_NOTIFICATIONS prompt
  if (isNative()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === "granted") return true;
      if (current.display === "denied") return false;
      const res = await LocalNotifications.requestPermissions();
      return res.display === "granted";
    } catch (err) {
      console.warn("Native notification permission failed:", err);
      return false;
    }
  }

  if (typeof window === "undefined" || !("Notification" in window)) {
    alert("System notifications are not supported in this browser.");
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

// Android 12+: exact alarms are a separate special permission. Without it the
// hourly words still fire, but Android may delay each one by a few minutes.
// This opens the system settings page, so call it from a button, not automatically.
export async function ensureExactAlarmAccess() {
  if (!isNative() || Capacitor.getPlatform() !== "android") return true;
  try {
    const status = await LocalNotifications.checkExactNotificationSetting();
    if (status.exact_alarm === "granted") return true;
    const res = await LocalNotifications.changeExactNotificationSetting();
    return res.exact_alarm === "granted";
  } catch (err) {
    console.warn("Exact alarm setting failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------
// Native (Capacitor) local notifications
// ---------------------------------------------------------------

const wordTitle = (w) =>
  `${w.article || ""} ${w.noun || ""}`.trim() || "Word of the Hour";

// "Plural: Äpfel · apple"
const wordBody = (w) =>
  [w.plural ? `Plural: ${w.plural}` : "", w.meaning || ""]
    .filter(Boolean)
    .join(" · ") || "Open deutschly to review this word";

async function ensureAndroidChannel() {
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Hourly words",
      description: "A German noun every hour",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
  } catch {
    // createChannel is Android-only; ignore elsewhere
  }
}

async function cancelAllPending() {
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch (err) {
    console.warn("Could not cancel pending notifications:", err);
  }
}

// Run schedule/cancel operations one at a time so overlapping triggers
// (app resume + list change + toggle) can never interleave.
let chain = Promise.resolve();
const serial = (fn) => {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
};

const clampHour = (h, fallback) =>
  Number.isFinite(h) ? Math.min(23, Math.max(0, Math.floor(h))) : fallback;

// startHour..endHour is inclusive. If startHour > endHour the window wraps midnight.
const isQuietHour = (h, startHour, endHour) =>
  startHour <= endHour
    ? h < startHour || h > endHour
    : h > endHour && h < startHour;

// Words whose notification time has already passed count as "shown".
function syncStateWithFired(state, eligible) {
  const now = Date.now();
  const eligibleIds = new Set(eligible.map(getId));

  for (const s of state.scheduled) {
    if (s.at <= now && eligibleIds.has(s.id)) {
      state.shown.add(s.id);
      state.last = s.id;
    }
  }
  state.scheduled = [];
  state.shown = new Set([...state.shown].filter((id) => eligibleIds.has(id)));

  if (eligible.length > 0 && state.shown.size >= eligible.length) {
    state.shown = new Set(); // everything was shown -> start a new cycle
  }
}

// Not-yet-shown words first, then the rest. No back-to-back repeats,
// including across the start of the sequence and each wrap-around.
function buildWordSequence(eligible, state, count) {
  if (eligible.length === 0 || count <= 0) return [];

  const fresh = shuffle(eligible.filter((w) => !state.shown.has(getId(w))));
  const seen = shuffle(eligible.filter((w) => state.shown.has(getId(w))));

  let round = [...fresh, ...seen];
  if (round.length > 1 && getId(round[0]) === state.last) {
    round = [...round.slice(1), round[0]];
  }

  const sequence = [];
  while (sequence.length < count) {
    for (const w of round) {
      if (sequence.length >= count) break;
      sequence.push(w);
    }
    const prevId = getId(sequence[sequence.length - 1]);
    round = shuffle(eligible);
    if (round.length > 1 && getId(round[0]) === prevId) {
      [round[0], round[1]] = [round[1], round[0]];
    }
  }
  return sequence;
}

async function doSchedule(vocabList, startHour, endHour) {
  if (!(await requestMobileNotificationPermission())) return false;

  await ensureAndroidChannel();
  await cancelAllPending();

  const eligible = (vocabList || []).filter(isInProgress);
  const state = loadState();
  syncStateWithFired(state, eligible);

  if (eligible.length === 0) {
    saveState(state);
    return false;
  }

  // Next full hours that are not in quiet hours
  const slots = [];
  const t = new Date();
  t.setMinutes(0, 0, 0);
  let guard = 0;
  while (slots.length < MAX_SCHEDULED && guard < 24 * 14) {
    guard++;
    t.setHours(t.getHours() + 1);
    if (isQuietHour(t.getHours(), startHour, endHour)) continue;
    slots.push(new Date(t));
  }

  if (slots.length === 0) {
    saveState(state);
    return false;
  }

  const words = buildWordSequence(eligible, state, slots.length);

  const notifications = slots.map((at, i) => ({
    id: i + 1,
    title: wordTitle(words[i]),
    body: wordBody(words[i]),
    channelId: CHANNEL_ID,
    smallIcon: SMALL_ICON,
    extra: { wordId: getId(words[i]) },
    schedule: { at, allowWhileIdle: true },
  }));

  await LocalNotifications.schedule({ notifications });

  state.scheduled = slots.map((at, i) => ({
    id: getId(words[i]),
    at: at.getTime(),
  }));
  saveState(state);
  return true;
}

// Cancels everything pending and schedules up to 60 future hourly words.
// Safe to call as often as you like (app open, list change, toggle).
export function scheduleHourlyWords(
  vocabList,
  { startHour = 8, endHour = 22 } = {}
) {
  if (!isNative()) return Promise.resolve(false);
  const start = clampHour(startHour, 8);
  const end = clampHour(endHour, 22);
  return serial(() => doSchedule(vocabList, start, end));
}

export function cancelHourlyWords() {
  if (!isNative()) return Promise.resolve();
  return serial(async () => {
    await cancelAllPending();
    const state = loadState();
    state.scheduled = [];
    saveState(state);
  });
}

// Fires one real notification after `seconds`, for testing with the app closed.
export async function scheduleTestNotification(word, seconds = 60) {
  if (!isNative() || !word) return false;
  if (!(await requestMobileNotificationPermission())) return false;
  await ensureAndroidChannel();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_ID,
        title: wordTitle(word),
        body: wordBody(word),
        channelId: CHANNEL_ID,
        smallIcon: SMALL_ICON,
        schedule: {
          at: new Date(Date.now() + seconds * 1000),
          allowWhileIdle: true,
        },
      },
    ],
  });
  return true;
}

// ---------------------------------------------------------------
// Web notification (image banner drawn with Poppins)
// ---------------------------------------------------------------

function createPoppinsNotificationImage(nounItem) {
  const W = 600;
  const H = 180;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(0, 0, W, H, 24);
  } else {
    ctx.rect(0, 0, W, H);
  }
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.strokeStyle = "#ede5d8";
  ctx.lineWidth = 4;
  ctx.stroke();

  const article = nounItem.article || "";
  const noun = nounItem.noun || "";
  ctx.fillStyle = "#b45309";
  ctx.font = "800 38px 'Poppins', sans-serif";
  ctx.fillText(`${article} ${noun}`.trim(), 32, 68);

  ctx.fillStyle = "#44403c";
  ctx.font = "600 20px 'Poppins', sans-serif";
  ctx.fillText(`Meaning: ${nounItem.meaning || "—"}`, 32, 116);

  ctx.fillStyle = "#78716c";
  ctx.font = "500 16px 'Poppins', sans-serif";
  ctx.fillText(`Plural: ${nounItem.plural || "—"}`, 32, 150);

  return canvas.toDataURL("image/png");
}

export async function sendNounNotification(nounItem) {
  if (!nounItem) return;

  // Native app: show a local notification right away
  if (isNative()) {
    try {
      if (!(await requestMobileNotificationPermission())) return;
      await ensureAndroidChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 100000 + Math.floor(Math.random() * 100000),
            title: wordTitle(nounItem),
            body: wordBody(nounItem),
            channelId: CHANNEL_ID,
            smallIcon: SMALL_ICON,
            schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
          },
        ],
      });
    } catch (err) {
      console.warn("Native notification failed:", err);
    }
    return;
  }

  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    await Promise.all([
      document.fonts.load("800 38px 'Poppins'"),
      document.fonts.load("600 20px 'Poppins'"),
      document.fonts.load("500 16px 'Poppins'"),
    ]);
  } catch {
    // fall back to sans-serif
  }

  const imageBanner = createPoppinsNotificationImage(nounItem);
  const title = "Word of the Hour";

  const options = {
    image: imageBanner,
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

  try {
    new Notification(title, options);
  } catch (err) {
    console.warn("Standard notification failed:", err);
  }
}

// ---------------------------------------------------------------
// Public start / stop (native schedules, web uses setInterval)
// ---------------------------------------------------------------

// Native: schedules on the phone and returns null (no timer needed).
// Web:    starts the setInterval and returns its id (works only while the tab is open).
export function startHourlyNounNotifier(
  getVocabList,
  intervalMs = 60 * 60 * 1000,
  onWordPicked,
  options = {}
) {
  const readList = () =>
    typeof getVocabList === "function" ? getVocabList() : getVocabList;

  if (isNative()) {
    scheduleHourlyWords(readList(), options);
    return null;
  }

  const intervalId = setInterval(() => {
    const word = pickNextWord(readList());
    if (word) {
      sendNounNotification(word);
      if (typeof onWordPicked === "function") onWordPicked(word);
    }
  }, intervalMs);

  return intervalId;
}

// Stops hourly alerts on both platforms.
export function stopHourlyNounNotifier(intervalId) {
  if (intervalId) clearInterval(intervalId);
  cancelHourlyWords();
}