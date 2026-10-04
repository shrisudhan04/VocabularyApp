export default function ConfirmModal({ isOpen, title, message, onConfirm, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="confirm-box">
          <span className="confirm-icon">⚠️</span>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <p>{message}</p>
          <div className="modal-actions" style={{ justifyContent: "center" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={onConfirm} className="btn btn-danger">
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}