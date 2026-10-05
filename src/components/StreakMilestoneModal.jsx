// src/components/StreakMilestoneModal.jsx
import { useEffect, useRef } from "react";
import celebrationSound from "../assets/celebration.mp3";
import fireVideo from "../assets/Fire.mp4";
import "./StreakMilestoneModal.css";

export default function StreakMilestoneModal({ isOpen, streak, onClose }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Play celebration audio
    try {
      const audio = new Audio(celebrationSound);
      audioRef.current = audio;
      audio.volume = 0.6;
      audio.play().catch((err) => console.warn("Audio autoplay blocked:", err));
    } catch (e) {
      console.warn("Audio failed to load:", e);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="milestone-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="milestone-card" onClick={(e) => e.stopPropagation()}>
        <div className="milestone-video-container">
          <video
            src={fireVideo}
            autoPlay
            loop
            muted
            playsInline
            className="milestone-fire-video"
          />
        </div>

        <div className="milestone-content">
          <span className="milestone-badge">🔥 MILESTONE UNLOCKED!</span>
          <h2 className="milestone-title">{streak}-Day Streak!</h2>
          <p className="milestone-subtitle">
            Outstanding dedication! You've practiced German consistently for <strong>{streak} days</strong>. Keep the flame alive!
          </p>

          <button type="button" className="milestone-btn" onClick={onClose}>
            Keep Going! 🚀
          </button>
        </div>
      </div>
    </div>
  );
}