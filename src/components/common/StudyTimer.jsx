import React, { useEffect, useState } from "react";

export default function StudyTimer({ running = true, onTick, className = "" }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => setSeconds(s => {
      const next = s + 1;
      onTick?.(next);
      return next;
    }), 1000);
    return () => window.clearInterval(id);
  }, [running, onTick]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return <time className={className} dateTime={`PT${seconds}S`}>{mm}:{ss}</time>;
}
