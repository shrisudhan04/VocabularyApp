// src/utils/streakHelper.js
export function calculateStreak(lists = {}) {
  // Collect all valid dates from all lists
  const dates = new Set();

  Object.values(lists)
    .flat()
    .forEach((item) => {
      if (!item?.createdAt) return;
      const d = new Date(item.createdAt);
      if (!Number.isNaN(d.getTime())) {
        dates.add(d.toISOString().slice(0, 10)); // "YYYY-MM-DD"
      }
    });

  const now = new Date();
  const formatDay = (d) => d.toISOString().slice(0, 10);

  const todayStr = formatDay(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDay(yesterday);

  const activeToday = dates.has(todayStr);
  const activeYesterday = dates.has(yesterdayStr);

  // If neither today nor yesterday has activity, streak is broken
  if (!activeToday && !activeYesterday) {
    return { streak: 0, activeToday: false };
  }

  let streak = 0;
  // If active today, start counting from today; otherwise count from yesterday
  const checkDate = new Date(now);
  if (!activeToday) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (dates.has(formatDay(checkDate))) {
    streak += 1;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return { streak, activeToday };
}