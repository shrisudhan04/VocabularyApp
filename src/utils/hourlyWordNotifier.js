export const triggerNounNotification = async (vocabList) => {
  if (!vocabList || vocabList.length === 0) return;
  if (Notification.permission !== "granted") return;

  const item = vocabList[Math.floor(Math.random() * vocabList.length)];
  const title = `${item.article} ${item.noun}`;
  const options = {
    body: `Meaning: ${item.meaning} | Plural: ${item.plural || "—"}`,
    icon: "/favicon.ico",
    tag: "hourly-noun-alert",
    renotify: true,
  };

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if (registration) {
      registration.showNotification(title, options);
      return;
    }
  }

  new Notification(title, options);
};