// src/utils/hourlyWordNotifier.js

export async function requestMobileNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    alert("System notifications are not supported in this browser.");
    return false;
  }
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export async function sendNounNotification(nounItem) {
  if (!nounItem) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const title = `Word : ${nounItem.article || ""} ${nounItem.noun || ""}`.trim();
  const options = {
    body: `Plural: ${nounItem.plural || "—"} | Meaning: ${nounItem.meaning || "—"}`,
    icon: "/icons.svg",
    badge: "/favicon-32x32.png",
    vibrate: [150, 80, 150],
    tag: `hourly-german-noun-${Date.now()}`,
    renotify: true,
  };

  if ("serviceWorker" in navigator) {
    try {
      const registration =
        (await navigator.serviceWorker.getRegistration()) ||
        (await navigator.serviceWorker.ready);
      await registration.showNotification(title, options);
      return;
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

export function startHourlyNounNotifier(vocabList) {
  if (!vocabList || vocabList.length === 0) return null;

  // Schedules recurring alerts every 60 minutes (3,600,000 ms)
  const intervalId = setInterval(() => {
    const randomWord = vocabList[Math.floor(Math.random() * vocabList.length)];
    sendNounNotification(randomWord);
  }, 10 * 1000);

  return intervalId;
}