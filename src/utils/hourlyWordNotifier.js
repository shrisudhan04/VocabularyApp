// src/utils/hourlyWordNotifier.js

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const STORAGE_KEY = "hourlyNounNotifier";

const MAX_SCHEDULED = 60;
const CHANNEL_ID = "hourly-words";
const SMALL_ICON = "ic_stat_word";
const TEST_ID = 999999;

// ============================================================
// PLATFORM DETECTION
// ============================================================

export const isNative = () => {
  try {
    const platform = Capacitor.getPlatform();

    // Android / iOS Capacitor app
    // MUST use LocalNotifications.
    if (platform === "android" || platform === "ios") {
      return true;
    }

    return Capacitor.isNativePlatform();
  } catch (err) {
    console.warn("Could not detect Capacitor platform:", err);
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

const isInProgress = (word) =>
  String(word?.status || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "") === "inprogress";

const getId = (word) =>
  String(
    word?.id ??
      `${word?.article || ""}-${word?.noun || ""}`
  );

const shuffle = (array) => {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

// ============================================================
// WORD SIGNATURE
// ============================================================

export const getWordsSignature = (vocabList) =>
  (vocabList || [])
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

// ============================================================
// STORAGE
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
  } catch {
    // Ignore storage errors.
  }
}

// ============================================================
// PICK WORD
// ============================================================

export function pickNextWord(vocabList) {
  const eligible = (vocabList || []).filter(isInProgress);

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
// PERMISSION
// ============================================================

export async function requestMobileNotificationPermission() {
  // ==========================================================
  // ANDROID / IOS
  // ==========================================================

  if (isNative()) {
    try {
      console.log(
        "[Deutschly] Using Capacitor Local Notifications:",
        Capacitor.getPlatform()
      );

      const current =
        await LocalNotifications.checkPermissions();

      console.log(
        "[Deutschly] Current notification permission:",
        current
      );

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

      console.log(
        "[Deutschly] Permission result:",
        result
      );

      return result.display === "granted";
    } catch (error) {
      console.error(
        "[Deutschly] Native notification permission failed:",
        error
      );

      return false;
    }
  }

  // ==========================================================
  // WEB / PWA
  // ==========================================================

  if (
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    console.warn(
      "Web notifications are unavailable."
    );

    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  return (
    (await Notification.requestPermission()) ===
    "granted"
  );
}

// ============================================================
// EXACT ALARM
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

    console.log(
      "[Deutschly] Exact alarm status:",
      status
    );

    if (status.exact_alarm === "granted") {
      return true;
    }

    const result =
      await LocalNotifications.changeExactNotificationSetting();

    console.log(
      "[Deutschly] Exact alarm result:",
      result
    );

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

const wordTitle = (word) =>
  `${word?.article || ""} ${word?.noun || ""}`.trim() ||
  "Word of the Hour";

const wordBody = (word) =>
  [
    word?.plural
      ? `Plural: ${word.plural}`
      : "",
    word?.meaning || "",
  ]
    .filter(Boolean)
    .join(" · ") ||
  "Open Deutschly to review this word";

// ============================================================
// ANDROID CHANNEL
// ============================================================

async function ensureAndroidChannel() {
  if (!isNative()) {
    return;
  }

  if (Capacitor.getPlatform() !== "android") {
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
// CANCEL
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
) =>
  startHour <= endHour
    ? hour < startHour ||
      hour > endHour
    : hour > endHour &&
      hour < startHour;

// ============================================================
// STATE
// ============================================================

function syncStateWithFired(
  state,
  eligible
) {
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
// BUILD WORD SEQUENCE
// ============================================================

function buildWordSequence(
  eligible,
  state,
  count
) {
  if (
    eligible.length === 0 ||
    count <= 0
  ) {
    return [];
  }

  const fresh = shuffle(
    eligible.filter(
      (word) =>
        !state.shown.has(getId(word))
    )
  );

  const seen = shuffle(
    eligible.filter(
      (word) =>
        state.shown.has(getId(word))
    )
  );

  let round = [
    ...fresh,
    ...seen,
  ];

  if (
    round.length > 1 &&
    getId(round[0]) === state.last
  ) {
    round = [
      ...round.slice(1),
      round[0],
    ];
  }

  const sequence = [];

  while (sequence.length < count) {
    for (const word of round) {
      if (sequence.length >= count) {
        break;
      }

      sequence.push(word);
    }

    const previousId =
      getId(
        sequence[sequence.length - 1]
      );

    round = shuffle(eligible);

    if (
      round.length > 1 &&
      getId(round[0]) === previousId
    ) {
      [
        round[0],
        round[1],
      ] = [
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
  console.log(
    "[Deutschly] Scheduling native notifications..."
  );

  console.log(
    "[Deutschly] Platform:",
    Capacitor.getPlatform()
  );

  if (
    !(await requestMobileNotificationPermission())
  ) {
    console.warn(
      "[Deutschly] Notification permission not granted."
    );

    return false;
  }

  await ensureAndroidChannel();

  await cancelAllPending();

  const eligible =
    (vocabList || []).filter(
      isInProgress
    );

  const state = loadState();

  syncStateWithFired(
    state,
    eligible
  );

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

    time.setHours(
      time.getHours() + 1
    );

    if (
      isQuietHour(
        time.getHours(),
        startHour,
        endHour
      )
    ) {
      continue;
    }

    slots.push(
      new Date(time)
    );
  }

  if (slots.length === 0) {
    saveState(state);
    return false;
  }

  const words =
    buildWordSequence(
      eligible,
      state,
      slots.length
    );

  const notifications =
    slots.map(
      (at, index) => ({
        id: index + 1,

        title: wordTitle(
          words[index]
        ),

        body: wordBody(
          words[index]
        ),

        channelId:
          CHANNEL_ID,

        smallIcon:
          SMALL_ICON,

        extra: {
          wordId:
            getId(words[index]),
        },

        schedule: {
          at,
          allowWhileIdle: true,
        },
      })
    );

  console.log(
    "[Deutschly] Scheduling",
    notifications.length,
    "native notifications."
  );

  await LocalNotifications.schedule({
    notifications,
  });

  state.scheduled =
    slots.map(
      (at, index) => ({
        id: getId(
          words[index]
        ),
        at: at.getTime(),
      })
    );

  saveState(state);

  return true;
}

// ============================================================
// PUBLIC SCHEDULER
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

  const start =
    clampHour(startHour, 8);

  const end =
    clampHour(endHour, 22);

  return serial(() =>
    doSchedule(
      vocabList,
      start,
      end
    )
  );
}

// ============================================================
// STOP NOTIFICATIONS
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
// TEST NOTIFICATION
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
      "[Deutschly] Test notification requires Android/iOS."
    );

    return false;
  }

  if (
    !(await requestMobileNotificationPermission())
  ) {
    return false;
  }

  await ensureAndroidChannel();

  console.log(
    `[Deutschly] Test notification scheduled in ${seconds} seconds.`
  );

  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_ID,

        title: wordTitle(word),

        body: wordBody(word),

        channelId:
          CHANNEL_ID,

        smallIcon:
          SMALL_ICON,

        schedule: {
          at: new Date(
            Date.now() +
              seconds * 1000
          ),

          allowWhileIdle: true,
        },
      },
    ],
  });

  return true;
}

// ============================================================
// IMMEDIATE NOTIFICATION
// ============================================================

export async function sendNounNotification(
  nounItem
) {
  if (!nounItem) {
    return;
  }

  // Android / iOS
  if (isNative()) {
    try {
      if (
        !(await requestMobileNotificationPermission())
      ) {
        return;
      }

      await ensureAndroidChannel();

      await LocalNotifications.schedule({
        notifications: [
          {
            id:
              100000 +
              Math.floor(
                Math.random() *
                  100000
              ),

            title:
              wordTitle(nounItem),

            body:
              wordBody(nounItem),

            channelId:
              CHANNEL_ID,

            smallIcon:
              SMALL_ICON,

            schedule: {
              at: new Date(
                Date.now() + 1000
              ),

              allowWhileIdle: true,
            },
          },
        ],
      });

      return;
    } catch (error) {
      console.error(
        "[Deutschly] Native notification failed:",
        error
      );

      return;
    }
  }

  // ==========================================================
  // WEB ONLY
  // ==========================================================

  if (
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    return;
  }

  if (
    Notification.permission !==
    "granted"
  ) {
    return;
  }

  try {
    new Notification(
      "Word of the Hour",
      {
        body: wordBody(
          nounItem
        ),
      }
    );
  } catch (error) {
    console.warn(
      "Web notification failed:",
      error
    );
  }
}

// ============================================================
// START / STOP
// ============================================================

export function startHourlyNounNotifier(
  getVocabList,
  intervalMs =
    60 * 60 * 1000,
  onWordPicked,
  options = {}
) {
  const readList = () =>
    typeof getVocabList ===
    "function"
      ? getVocabList()
      : getVocabList;

  // ==========================================================
  // ANDROID / IOS
  // ==========================================================

  if (isNative()) {
    scheduleHourlyWords(
      readList(),
      options
    );

    return null;
  }

  // ==========================================================
  // WEB
  // ==========================================================

  const intervalId =
    setInterval(() => {
      const word =
        pickNextWord(
          readList()
        );

      if (word) {
        sendNounNotification(
          word
        );

        if (
          typeof onWordPicked ===
          "function"
        ) {
          onWordPicked(word);
        }
      }
    }, intervalMs);

  return intervalId;
}

export function stopHourlyNounNotifier(
  intervalId
) {
  if (intervalId) {
    clearInterval(intervalId);
  }

  cancelHourlyWords();
}