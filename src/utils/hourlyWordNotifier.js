// src/utils/hourlyWordNotifier.js

const STORAGE_KEY = "hourlyNounNotifier";

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

export async function requestMobileNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    alert("System notifications are not supported in this browser.");
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

// Generates a compact image banner drawn with Poppins font.
// The "WORD OF THE HOUR" label now lives in the notification title,
// so the banner is shorter and there is no empty strip above it.
function createPoppinsNotificationImage(nounItem) {
  const W = 600;
  const H = 180;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Rounded card background
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(0, 0, W, H, 24);
  } else {
    ctx.rect(0, 0, W, H);
  }
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Subtle border
  ctx.strokeStyle = "#ede5d8";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Main Word (Article + Noun)
  const article = nounItem.article || "";
  const noun = nounItem.noun || "";
  ctx.fillStyle = "#b45309";
  ctx.font = "800 38px 'Poppins', sans-serif";
  ctx.fillText(`${article} ${noun}`.trim(), 32, 68);

  // Details (Meaning & Plural)
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
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  // Make sure Poppins is ready before drawing on the canvas
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

  const title = "Word of the Hour"; // fills the title row -> no blank gap

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

export function startHourlyNounNotifier(getVocabList, intervalMs = 60 * 60 * 1000, onWordPicked) {
  const intervalId = setInterval(() => {
    const list = typeof getVocabList === "function" ? getVocabList() : getVocabList;
    const word = pickNextWord(list);
    if (word) {
      sendNounNotification(word);
      if (typeof onWordPicked === "function") {
        onWordPicked(word);
      }
    }
  }, intervalMs);

  return intervalId;
}