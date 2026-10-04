// src/utils/hourlyWordNotifier.js

export async function requestMobileNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Mobile notifications are not supported in this browser.");
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export async function sendNounNotification(nounItem) {
  if (Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  const title = `🇩🇪 Word of the Hour: ${nounItem.article} ${nounItem.noun}`;
  const body = `Plural: ${nounItem.plural || "—"} | Meaning: ${nounItem.meaning}`;

  registration.showNotification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    vibrate: [150, 80, 150],
    tag: "hourly-german-noun",
    renotify: true,
    data: { url: "/" },
  });
}

// Schedules hourly local notifications
export function startHourlyNounNotifier(vocabList) {
  if (!vocabList || vocabList.length === 0) return null;

  // Trigger one immediately so you see it work
  const initialWord = vocabList[Math.floor(Math.random() * vocabList.length)];
  sendNounNotification(initialWord);

  // Set recurring 1-hour interval (3,600,000 ms)
  const intervalId = setInterval(() => {
    const randomWord = vocabList[Math.floor(Math.random() * vocabList.length)];
    sendNounNotification(randomWord);
  }, 60 * 60 * 1000);

  return intervalId;
}