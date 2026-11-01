import { useCallback } from "react";
import { recordReview } from "../services/learningService";

export default function useSpacedRepetition() {
  const review = useCallback((item, rating, now) => recordReview(item, rating, now), []);
  const getDueItems = useCallback((items = [], now = new Date()) => items.filter(item => {
    const due = item.nextReviewAt ? new Date(item.nextReviewAt).getTime() : NaN;
    return Number.isNaN(due) || due <= now.getTime();
  }), []);
  return { review, getDueItems };
}
