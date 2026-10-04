export default function SubTabs({ currentView, onChangeView }) {
  return (
    <div className="sub-tabs-bar">
      <div className="sub-tabs">
        <button
          className={`sub-tab ${currentView === "list" ? "active" : ""}`}
          onClick={() => onChangeView("list")}
        >
          📑 Overview
        </button>
        <button
          className={`sub-tab ${currentView === "flashcards" ? "active" : ""}`}
          onClick={() => onChangeView("flashcards")}
        >
          🎴 Flashcards
        </button>
        <button
          className={`sub-tab ${currentView === "quiz" ? "active" : ""}`}
          onClick={() => onChangeView("quiz")}
        >
          ✨ Quiz
        </button>
      </div>
    </div>
  );
}