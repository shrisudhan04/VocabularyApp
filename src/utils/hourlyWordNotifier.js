// src/utils/hourlyWordNotifier.js

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// ============================================================
// CONSTANTS
// ============================================================

const STORAGE_KEY = "hourlyNounNotifier";

const MAX_SCHEDULED = 60;
const CHANNEL_ID = "hourly-words";
const SMALL_ICON = "ic_stat_word";
const TEST_ID = 999999;

const WEB_REMINDER_SETTINGS_KEY =
  "deutschly_web_reminder_settings_v1";

const WEB_REMINDER_FIRED_KEY =
  "deutschly_web_reminder_fired_v1";

const DEFAULT_WEB_REMINDER_SETTINGS = {
  enabled: false,
  times: ["09:00"],
};

const WEB_REMINDER_CHECK_INTERVAL_MS = 15 * 1000;
const WEB_REMINDER_GRACE_MS = 5 * 60 * 1000;

// ============================================================
// PLATFORM DETECTION
// ============================================================

export const isNative = () => {
  try {
    const platform = Capacitor.getPlatform();

    if (platform === "android" || platform === "ios") {
      return true;
    }

    return Capacitor.isNativePlatform();
  } catch (error) {
    console.warn(
      "[Deutschly] Could not detect platform:",
      error
    );

    return false;
  }
};

export const getNotificationPlatform = () => {
  try {
    return {
      platform: Capacitor.getPlatform(),
      isNative: isNative(),
    };
  } catch {
    return {
      platform: "unknown",
      isNative: false,
    };
  }
};

// ============================================================
// WORD HELPERS
// ============================================================

const isInProgress = (word) => {
  return (
    String(word?.status || "")
      .toLowerCase()
      .replace(/[\s_-]/g, "") === "inprogress"
  );
};

const getId = (word) => {
  return String(
    word?.id ??
      `${word?.article || ""}-${word?.noun || ""}`
  );
};

const shuffle = (array) => {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

export const getWordsSignature = (vocabList) => {
  return (vocabList || [])
    .filter(isInProgress)
    .map((word) =>
      [
        getId(word),
        word?.article || "",
        word?.noun || "",
        word?.plural || "",
        word?.meaning || "",
      ].join("¦")
    )
    .sort()
    .join("|");
};

// ============================================================
// LOCAL STORAGE
// ============================================================

function loadState() {
  try {
    const raw = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    return {
      shown: new Set(raw?.shown || []),
      last: raw?.last || null,
      scheduled: Array.isArray(raw?.scheduled)
        ? raw.scheduled
        : [],
    };
  } catch {
    return {
      shown: new Set(),
      last: null,
      scheduled: [],
    };
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
  } catch (error) {
    console.warn(
      "[Deutschly] Could not save notifier state:",
      error
    );
  }
}

// ============================================================
// WEB REMINDER SETTINGS
// ============================================================

const normalizeReminderTimes = (times) => {
  const valid = (Array.isArray(times) ? times : [])
    .map((value) => String(value || "").trim())
    .filter((value) =>
      /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    );

  return [...new Set(valid)].sort();
};

export function getWebReminderSettings() {
  try {
    const raw = JSON.parse(
      localStorage.getItem(
        WEB_REMINDER_SETTINGS_KEY
      ) || "null"
    );

    const times = normalizeReminderTimes(
      raw?.times
    ).slice(0, 5);

    return {
      enabled: Boolean(raw?.enabled),
      times: times.length
        ? times
        : [...DEFAULT_WEB_REMINDER_SETTINGS.times],
    };
  } catch {
    return {
      ...DEFAULT_WEB_REMINDER_SETTINGS,
      times: [...DEFAULT_WEB_REMINDER_SETTINGS.times],
    };
  }
}

export function saveWebReminderSettings(settings) {
  const normalized = {
    enabled: Boolean(settings?.enabled),
    times: normalizeReminderTimes(
      settings?.times
    ).slice(0, 5),
  };

  if (normalized.times.length === 0) {
    normalized.times = [
      ...DEFAULT_WEB_REMINDER_SETTINGS.times,
    ];
  }

  try {
    localStorage.setItem(
      WEB_REMINDER_SETTINGS_KEY,
      JSON.stringify(normalized)
    );
  } catch (error) {
    console.warn(
      "[Deutschly] Could not save reminder settings:",
      error
    );
  }

  return normalized;
}

function readFiredReminderKeys() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(
        WEB_REMINDER_FIRED_KEY
      ) || "[]"
    );

    return Array.isArray(parsed)
      ? parsed.filter(
          (item) => typeof item === "string"
        )
      : [];
  } catch {
    return [];
  }
}

function markReminderFired(key) {
  try {
    const keys = readFiredReminderKeys().filter(
      (item) => item !== key
    );

    keys.push(key);

    localStorage.setItem(
      WEB_REMINDER_FIRED_KEY,
      JSON.stringify(keys.slice(-90))
    );
  } catch (error) {
    console.warn(
      "[Deutschly] Could not store reminder history:",
      error
    );
  }
}

// ============================================================
// PICK NEXT WORD
// ============================================================

export function pickNextWord(vocabList) {
  const eligible = (vocabList || []).filter(
    isInProgress
  );

  if (eligible.length === 0) {
    return null;
  }

  const state = loadState();

  const eligibleIds = new Set(
    eligible.map(getId)
  );

  state.shown = new Set(
    [...state.shown].filter((id) =>
      eligibleIds.has(id)
    )
  );

  let pool = eligible.filter(
    (word) => !state.shown.has(getId(word))
  );

  if (pool.length === 0) {
    state.shown = new Set();

    pool = eligible.filter(
      (word) =>
        eligible.length === 1 ||
        getId(word) !== state.last
    );
  }

  const word =
    pool[Math.floor(Math.random() * pool.length)];

  state.shown.add(getId(word));
  state.last = getId(word);

  saveState(state);

  return word;
}

// ============================================================
// NOTIFICATION PERMISSION
// ============================================================

export async function requestMobileNotificationPermission() {
  // Android and iOS
  if (isNative()) {
    try {
      const current =
        await LocalNotifications.checkPermissions();

      if (current.display === "granted") {
        return true;
      }

      if (current.display === "denied") {
        console.warn(
          "[Deutschly] Notification permission denied."
        );

        return false;
      }

      const result =
        await LocalNotifications.requestPermissions();

      return result.display === "granted";
    } catch (error) {
      console.error(
        "[Deutschly] Native notification permission failed:",
        error
      );

      return false;
    }
  }

  // Web browser
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    window.isSecureContext === false
  ) {
    console.warn(
      "[Deutschly] Web notifications are unavailable."
    );

    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  try {
    return (
      (await Notification.requestPermission()) ===
      "granted"
    );
  } catch (error) {
    console.error(
      "[Deutschly] Web permission request failed:",
      error
    );

    return false;
  }
}

// ============================================================
// ANDROID EXACT ALARM ACCESS
// ============================================================

export async function ensureExactAlarmAccess() {
  if (
    !isNative() ||
    Capacitor.getPlatform() !== "android"
  ) {
    return true;
  }

  try {
    const status =
      await LocalNotifications.checkExactNotificationSetting();

    if (status.exact_alarm === "granted") {
      return true;
    }

    const result =
      await LocalNotifications.changeExactNotificationSetting();

    return result.exact_alarm === "granted";
  } catch (error) {
    console.warn(
      "[Deutschly] Exact alarm setting failed:",
      error
    );

    return false;
  }
}

// ============================================================
// NOTIFICATION CONTENT
// ============================================================

const wordTitle = (word) => {
  return (
    `${word?.article || ""} ${word?.noun || ""}`.trim() ||
    "Word of the Hour"
  );
};

const wordBody = (word) => {
  return (
    [
      word?.plural ? `Plural: ${word.plural}` : "",
      word?.meaning || "",
    ]
      .filter(Boolean)
      .join(" · ") ||
    "Open Deutschly to review this word"
  );
};

// ============================================================
// SHOW WEB NOTIFICATION
// ============================================================

async function showWebNotification(
  title,
  body,
  options = {}
) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    window.isSecureContext === false
  ) {
    return false;
  }

  const notificationOptions = {
    body,
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
    data: {
      url: "/",
    },
    ...options,
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration =
        await navigator.serviceWorker
          .getRegistration()
          .catch(() => undefined);

      if (registration?.showNotification) {
        try {
          await registration.showNotification(
            title,
            notificationOptions
          );

          return true;
        } catch (error) {
          console.warn(
            "[Deutschly] Service worker notification failed:",
            error
          );
        }
      }
    }

    new Notification(title, notificationOptions);

    return true;
  } catch (error) {
    console.warn(
      "[Deutschly] Web notification failed:",
      error
    );

    return false;
  }
}

export async function sendWebReminderNotification(
  title,
  body = "It's time for your German practice.",
  options = {}
) {
  return showWebNotification(title, body, {
    tag: options.tag || "deutschly-study-reminder",
  });
}

// ============================================================
// ANDROID NOTIFICATION CHANNEL
// ============================================================

async function ensureAndroidChannel() {
  if (
    !isNative() ||
    Capacitor.getPlatform() !== "android"
  ) {
    return;
  }

  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Hourly words",
      description: "A German noun every hour",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
  } catch (error) {
    console.warn(
      "[Deutschly] Could not create notification channel:",
      error
    );
  }
}

// ============================================================
// CANCEL PENDING NATIVE NOTIFICATIONS
// ============================================================

async function cancelAllPending() {
  try {
    const pending =
      await LocalNotifications.getPending();

    if (
      pending?.notifications &&
      pending.notifications.length > 0
    ) {
      await LocalNotifications.cancel({
        notifications: pending.notifications,
      });
    }
  } catch (error) {
    console.warn(
      "[Deutschly] Could not cancel pending notifications:",
      error
    );
  }
}

// ============================================================
// SERIAL QUEUE
// ============================================================

let chain = Promise.resolve();

const serial = (fn) => {
  const run = chain.then(fn);

  chain = run.catch(() => {});

  return run;
};

// ============================================================
// TIME HELPERS
// ============================================================

const clampHour = (hour, fallback) =>
  Number.isFinite(hour)
    ? Math.min(
        23,
        Math.max(0, Math.floor(hour))
      )
    : fallback;

const isQuietHour = (
  hour,
  startHour,
  endHour
) => {
  return startHour <= endHour
    ? hour < startHour || hour > endHour
    : hour > endHour && hour < startHour;
};

// ============================================================
// NATIVE NOTIFICATION STATE
// ============================================================

function syncStateWithFired(state, eligible) {
  const now = Date.now();

  const eligibleIds = new Set(
    eligible.map(getId)
  );

  for (const item of state.scheduled) {
    if (
      item.at <= now &&
      eligibleIds.has(item.id)
    ) {
      state.shown.add(item.id);
      state.last = item.id;
    }
  }

  state.scheduled = [];

  state.shown = new Set(
    [...state.shown].filter((id) =>
      eligibleIds.has(id)
    )
  );

  if (
    eligible.length > 0 &&
    state.shown.size >= eligible.length
  ) {
    state.shown = new Set();
  }
}

// ============================================================
// BUILD WORD SEQUENCE FOR NATIVE NOTIFICATIONS
// ============================================================

function buildWordSequence(
  eligible,
  state,
  count
) {
  if (eligible.length === 0 || count <= 0) {
    return [];
  }

  const fresh = shuffle(
    eligible.filter(
      (word) => !state.shown.has(getId(word))
    )
  );

  const seen = shuffle(
    eligible.filter(
      (word) => state.shown.has(getId(word))
    )
  );

  let round = [...fresh, ...seen];

  if (
    round.length > 1 &&
    getId(round[0]) === state.last
  ) {
    round = [...round.slice(1), round[0]];
  }

  const sequence = [];

  while (sequence.length < count) {
    for (const word of round) {
      if (sequence.length >= count) {
        break;
      }

      sequence.push(word);
    }

    const previousId = getId(
      sequence[sequence.length - 1]
    );

    round = shuffle(eligible);

    if (
      round.length > 1 &&
      getId(round[0]) === previousId
    ) {
      [round[0], round[1]] = [
        round[1],
        round[0],
      ];
    }
  }

  return sequence;
}

// ============================================================
// SCHEDULE NATIVE NOTIFICATIONS
// ============================================================

async function doSchedule(
  vocabList,
  startHour,
  endHour
) {
  if (
    !(await requestMobileNotificationPermission())
  ) {
    return false;
  }

  await ensureAndroidChannel();
  await cancelAllPending();

  const eligible = (vocabList || []).filter(
    isInProgress
  );

  const state = loadState();

  syncStateWithFired(state, eligible);

  if (eligible.length === 0) {
    saveState(state);
    return false;
  }

  // Start from the next full hour.
  const slots = [];
  const time = new Date();

  time.setMinutes(0, 0, 0);

  let guard = 0;

  while (
    slots.length < MAX_SCHEDULED &&
    guard < 24 * 14
  ) {
    guard++;

    time.setHours(time.getHours() + 1);

    if (
      isQuietHour(
        time.getHours(),
        startHour,
        endHour
      )
    ) {
      continue;
    }

    slots.push(new Date(time));
  }

  if (slots.length === 0) {
    saveState(state);
    return false;
  }

  const words = buildWordSequence(
    eligible,
    state,
    slots.length
  );

  const notifications = slots.map(
    (at, index) => ({
      id: index + 1,
      title: wordTitle(words[index]),
      body: wordBody(words[index]),
      channelId: CHANNEL_ID,
      smallIcon: SMALL_ICON,
      extra: {
        wordId: getId(words[index]),
      },
      schedule: {
        at,
        allowWhileIdle: true,
      },
    })
  );

  await LocalNotifications.schedule({
    notifications,
  });

  state.scheduled = slots.map(
    (at, index) => ({
      id: getId(words[index]),
      at: at.getTime(),
    })
  );

  saveState(state);

  return true;
}

// ============================================================
// PUBLIC NATIVE SCHEDULER
// ============================================================

export function scheduleHourlyWords(
  vocabList,
  {
    startHour = 8,
    endHour = 22,
  } = {}
) {
  if (!isNative()) {
    console.warn(
      "[Deutschly] scheduleHourlyWords called on web."
    );

    return Promise.resolve(false);
  }

  const start = clampHour(startHour, 8);
  const end = clampHour(endHour, 22);

  return serial(() =>
    doSchedule(vocabList, start, end)
  );
}

// ============================================================
// CANCEL HOURLY NOTIFICATIONS
// ============================================================

export function cancelHourlyWords() {
  if (!isNative()) {
    return Promise.resolve();
  }

  return serial(async () => {
    await cancelAllPending();

    const state = loadState();

    state.scheduled = [];

    saveState(state);

    console.log(
      "[Deutschly] Hourly notifications cancelled."
    );
  });
}

// ============================================================
// TEST NOTIFICATION - ANDROID / IOS
// ============================================================

export async function scheduleTestNotification(
  word = {
    article: "der",
    noun: "Tisch",
    plural: "Tische",
    meaning: "table",
  },
  seconds = 10
) {
  if (!isNative()) {
    console.warn(
      "[Deutschly] Native test notification requires Android/iOS."
    );

    return false;
  }

  if (
    !(await requestMobileNotificationPermission())
  ) {
    return false;
  }

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
          at: new Date(
            Date.now() + seconds * 1000
          ),
          allowWhileIdle: true,
        },
      },
    ],
  });

  return true;
}

// ============================================================
// SEND IMMEDIATE WORD NOTIFICATION
// ============================================================

export async function sendNounNotification(
  nounItem
) {
  if (!nounItem) {
    return false;
  }

  // Android / iOS
  if (isNative()) {
    try {
      if (
        !(await requestMobileNotificationPermission())
      ) {
        return false;
      }

      await ensureAndroidChannel();

      await LocalNotifications.schedule({
        notifications: [
          {
            id:
              100000 +
              Math.floor(Math.random() * 100000),
            title: wordTitle(nounItem),
            body: wordBody(nounItem),
            channelId: CHANNEL_ID,
            smallIcon: SMALL_ICON,
            schedule: {
              at: new Date(Date.now() + 1000),
              allowWhileIdle: true,
            },
          },
        ],
      });

      return true;
    } catch (error) {
      console.error(
        "[Deutschly] Native notification failed:",
        error
      );

      return false;
    }
  }

  // Web browser
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return false;
  }

  return showWebNotification(
    wordTitle(nounItem),
    wordBody(nounItem),
    {
      tag: `deutschly-word-${getId(nounItem)}`,
    }
  );
}

// ============================================================
// USER-SCHEDULED WEB REMINDERS
// ============================================================
//
// Checks selected local times while Deutschly is open.
// Browser timers do not reliably run after the app/browser
// has been fully closed. Closed-app web push requires a
// push service/backend.
//

export function startScheduledWebReminders(
  getVocabList
) {
  if (
    isNative() ||
    typeof window === "undefined"
  ) {
    return null;
  }

  const readList = () => {
    try {
      return typeof getVocabList === "function"
        ? getVocabList()
        : getVocabList;
    } catch {
      return [];
    }
  };

  const sessionFired = new Set();
  let stopped = false;

  const checkReminders = async () => {
    if (
      stopped ||
      typeof window === "undefined"
    ) {
      return;
    }

    const settings = getWebReminderSettings();

    if (
      !settings.enabled ||
      settings.times.length === 0
    ) {
      return;
    }

    if (
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      window.isSecureContext === false
    ) {
      return;
    }

    const now = new Date();
    const nowMs = now.getTime();

    const dateKey = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    const persistedFired = new Set(
      readFiredReminderKeys()
    );

    for (const time of settings.times) {
      const [hour, minute] = time
        .split(":")
        .map(Number);

      const target = new Date(now);

      target.setHours(hour, minute, 0, 0);

      const age = nowMs - target.getTime();

      // Only fire at the scheduled time or within 5 minutes.
      if (
        age < 0 ||
        age > WEB_REMINDER_GRACE_MS
      ) {
        continue;
      }

      const firedKey = `${dateKey}@${time}`;

      if (
        persistedFired.has(firedKey) ||
        sessionFired.has(firedKey)
      ) {
        continue;
      }

      // Reserve while displaying notification.
      sessionFired.add(firedKey);

      const currentList = readList();

      const safeList = Array.isArray(currentList)
        ? currentList
        : [];

      const eligibleWord = safeList.find(
        isInProgress
      );

      let displayed = false;

      if (eligibleWord) {
        const nextWord =
          pickNextWord(safeList) || eligibleWord;

        displayed =
          (await sendNounNotification(nextWord)) !==
          false;
      } else {
        displayed =
          await sendWebReminderNotification(
            "Deutschly study reminder",
            "It's time for your German practice. Open Deutschly to review your vocabulary.",
            {
              tag: `deutschly-study-reminder-${firedKey}`,
            }
          );
      }

      if (displayed) {
        markReminderFired(firedKey);
        persistedFired.add(firedKey);
      } else {
        // Retry if notification could not be displayed.
        sessionFired.delete(firedKey);
      }
    }
  };

  // Check immediately when the scheduler starts.
  void checkReminders();

  const intervalId = window.setInterval(
    () => {
      void checkReminders();
    },
    WEB_REMINDER_CHECK_INTERVAL_MS
  );

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void checkReminders();
    }
  };

  document.addEventListener(
    "visibilitychange",
    onVisibilityChange
  );

  return {
    intervalId,

    stop: () => {
      stopped = true;

      window.clearInterval(intervalId);

      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
    },
  };
}

// ============================================================
// STOP WEB REMINDERS
// ============================================================

export function stopScheduledWebReminders(handle) {
  if (handle?.stop) {
    handle.stop();
  } else if (
    typeof window !== "undefined" &&
    handle
  ) {
    window.clearInterval(handle);
  }
}

// ============================================================
// LEGACY START / STOP HOURLY NOUN NOTIFIER
// ============================================================
//
// Kept for existing Nouns, Verbs, Patterns, Time and
// Prepositions pages that already import these functions.
//

export function startHourlyNounNotifier(
  getVocabList,
  intervalMs = 60 * 60 * 1000,
  onWordPicked,
  options = {}
) {
  const readList = () =>
    typeof getVocabList === "function"
      ? getVocabList()
      : getVocabList;

  // Android / iOS uses scheduled local notifications.
  if (isNative()) {
    scheduleHourlyWords(readList(), options);

    return null;
  }

  // Preserve the existing browser hourly notifier.
  const intervalId = setInterval(() => {
    const word = pickNextWord(readList());

    if (word) {
      void sendNounNotification(word);

      if (typeof onWordPicked === "function") {
        onWordPicked(word);
      }
    }
  }, intervalMs);

  return intervalId;
}

export function stopHourlyNounNotifier(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
  }

  void cancelHourlyWords();
}