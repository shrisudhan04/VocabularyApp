

export default function ConfirmModal({ isOpen, title, message, onConfirm, onClose }) {
  if (!isOpen) return null;

  const playSynthesizedDeleteSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      // Drop frequency quickly to create a 'popping/trash' downward tone
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  };

  const handleConfirm = () => {
    playSynthesizedDeleteSound();
    onConfirm();
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="confirm-box">
          <span className="confirm-icon">⚠️</span>
          <h3 style={{ marginTop: 30 }}>{title}</h3>
          <p>{message}</p>
          <div className="modal-actions" style={{ justifyContent: "center" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={handleConfirm} className="btn btn-danger">
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}