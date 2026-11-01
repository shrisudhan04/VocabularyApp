import React from "react";

export default function ProgressBar({ value = 0, max = 100, label, showValue = true }) {
  const percent = Math.max(0, Math.min(100, max > 0 ? (Number(value) / Number(max)) * 100 : 0));
  return (
    <div className="learning-progress" aria-label={label || "Progress"}>
      {label && <div className="learning-progress__label">{label}</div>}
      <div className="learning-progress__track" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin="0" aria-valuemax="100">
        <div className="learning-progress__fill" style={{ width: `${percent}%` }} />
      </div>
      {showValue && <small>{Math.round(percent)}%</small>}
    </div>
  );
}
