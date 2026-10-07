// Shared learning helpers used by the dashboard and study filters.

export const normalizeStatus = (value) =>
  String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");

export const isMastered = (item) => normalizeStatus(item?.status) === "mastered";

export const startOfToday = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const endOfToday = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1;

// Backward compatible "Due Today" rule:
// 1) If a future/explicit nextReviewAt exists, honor it.
// 2) If no review date exists (legacy records), non-mastered/Forgot items are due.
export const isDueToday = (item, now = new Date()) => {
  if (!item) return false;
  const nextReview = item.nextReviewAt ? new Date(item.nextReviewAt).getTime() : NaN;
  const todayEnd = endOfToday(now);

  if (!Number.isNaN(nextReview)) {
    return nextReview <= todayEnd;
  }

  return !isMastered(item);
};

export const countDueToday = (list = [], now = new Date()) =>
  (Array.isArray(list) ? list : []).filter((item) => isDueToday(item, now)).length;

export const countMastered = (list = []) =>
  (Array.isArray(list) ? list : []).filter(isMastered).length;

export const masteryPercent = (list = []) => {
  const items = Array.isArray(list) ? list : [];
  if (!items.length) return 0;
  return Math.round((countMastered(items) / items.length) * 100);
};

export const categoryItems = (list = [], category) => {
  const wanted = String(category || "").trim().toLowerCase();
  return (Array.isArray(list) ? list : []).filter((item) => {
    const values = Array.isArray(item?.category) ? item.category : item?.category ? [item.category] : [];
    return values.some((value) => String(value || "").trim().toLowerCase() === wanted);
  });
};

export const matchesStudyStatus = (item, filter) => filter === "all" || (filter === "due" ? isDueToday(item) : (item?.status || "In Progress") === filter);
