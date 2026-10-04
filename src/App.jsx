import { useState, useEffect } from "react";
import "./App.css";
const DB_NAME = "GermanVocabVault";
const DB_VERSION = 1;
const STORE_NAME = "vocabulary_store";
const BACKUP_KEY = "current_vocab_data";

// Fallback seed data if the database is opened for the first time
const SEED_DATA = [
  { id: 1, article: "der", noun: "Mann", gender: "Masculine", meaning: "Male / Man", status: "Mastered" },
  { id: 2, article: "die", noun: "Frau", gender: "Feminine", meaning: "Woman / Wife", status: "In Progress" },
  { id: 3, article: "das", noun: "Kind", gender: "Neuter", meaning: "Child", status: "In Progress" },
  { id: 4, article: "der", noun: "Tisch", gender: "Masculine", meaning: "Table", status: "Mastered" },
  { id: 5, article: "die", noun: "Sonne", gender: "Feminine", meaning: "Sun", status: "Mastered" },
  { id: 6, article: "das", noun: "Buch", gender: "Neuter", meaning: "Book", status: "In Progress" },
];

// --- 1. NATIVE INDEXEDDB HELPERS (ZERO PACKAGES) ---
function openVaultDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadFromVaultDB() {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(BACKUP_KEY);
    getReq.onsuccess = () => resolve(getReq.result || null);
    getReq.onerror = () => reject(getReq.error);
  });
}

async function writeToVaultDB(data) {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const putReq = store.put(data, BACKUP_KEY);
    putReq.onsuccess = () => resolve(true);
    putReq.onerror = () => reject(putReq.error);
  });
}

export default function App() {
  const [vocabList, setVocabList] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [isPersisted, setIsPersisted] = useState(false);

  // Direct File Handle (Layer 2)
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [syncStatus, setSyncStatus] = useState("Vault Active");

  // Tab & Filters
  const [activeTab, setActiveTab] = useState("Vocabulary List");
  const [search, setSearch] = useState("");
  const [articleFilter, setArticleFilter] = useState("all");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    noun: "",
    article: "der",
    meaning: "",
    status: "In Progress",
  });

  // Quiz
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);

  // Flashcards
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  // --- INITIALIZE & LOCK AGAINST LOSS ON LOAD ---
  useEffect(() => {
    async function initVault() {
      // 1. Request OS-level persistence immunity
      if (navigator.storage && navigator.storage.persist) {
        const persisted = await navigator.storage.persist();
        setIsPersisted(persisted);
      }

      // 2. Load directly from permanent IndexedDB
      try {
        const stored = await loadFromVaultDB();
        if (stored && Array.isArray(stored) && stored.length > 0) {
          setVocabList(stored);
        } else {
          // If empty, initialize with seed and commit to DB
          await writeToVaultDB(SEED_DATA);
          setVocabList(SEED_DATA);
        }
      } catch (err) {
        console.error("IndexedDB load error, checking localStorage fallback:", err);
        const fallback = localStorage.getItem("backup_vocab");
        setVocabList(fallback ? JSON.parse(fallback) : SEED_DATA);
      } finally {
        setIsReady(true);
      }
    }

    initVault();
  }, []);

  // --- CENTRAL DISPATCHER: SAVES TO EVERY STORAGE LAYER SIMULTANEOUSLY ---
  const commitData = async (newList) => {
    setVocabList(newList);

    // 1. Commit to IndexedDB (Hardware-level browser DB)
    try {
      await writeToVaultDB(newList);
      localStorage.setItem("backup_vocab", JSON.stringify(newList)); // secondary fallback
      setSyncStatus("Vault Protected");
    } catch (e) {
      console.error("Failed writing to IndexedDB:", e);
    }

    // 2. Commit to Physical Hard Drive File if connected
    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(newList, null, 2));
        await writable.close();
        setSyncStatus(`Saved to ${fileName}`);
      } catch (e) {
        console.error("Failed updating physical disk file:", e);
        setSyncStatus("Disk Write Error");
      }
    }
  };

  // Connect Physical File (Disk Mirror)
  const connectLocalDiskFile = async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "JSON Vocabulary File", accept: { "application/json": [".json"] } }],
        multiple: false,
      });
      const file = await handle.getFile();
      const content = await file.text();
      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
        await commitData(parsed);
        setFileHandle(handle);
        setFileName(file.name);
        alert(`Successfully linked to "${file.name}". All future actions will sync to this file.`);
      }
    } catch (err) {
      if (err.name !== "AbortError") console.error(err);
    }
  };

  const createNewDiskFile = async () => {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: `german_vocab_vault_${new Date().toISOString().slice(0, 10)}.json`,
        types: [{ description: "JSON Vocabulary File", accept: { "application/json": [".json"] } }],
      });
      const file = await handle.getFile();
      setFileHandle(handle);
      setFileName(file.name);
      
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(vocabList, null, 2));
      await writable.close();
      setSyncStatus(`Linked to ${file.name}`);
    } catch (err) {
      if (err.name !== "AbortError") console.error(err);
    }
  };

  // CRUD Operations
  const handleToggleStatus = (id) => {
    const updated = vocabList.map((item) =>
      item.id === id ? { ...item, status: item.status === "Mastered" ? "In Progress" : "Mastered" } : item
    );
    commitData(updated);
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this word permanently?")) {
      const updated = vocabList.filter((item) => item.id !== id);
      commitData(updated);
    }
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!formData.noun.trim() || !formData.meaning.trim()) return;

    const genderMap = { der: "Masculine", die: "Feminine", das: "Neuter" };
    const gender = genderMap[formData.article];

    let updated;
    if (editingId) {
      updated = vocabList.map((item) => (item.id === editingId ? { ...item, ...formData, gender } : item));
    } else {
      updated = [...vocabList, { id: Date.now(), ...formData, gender }];
    }
    commitData(updated);
    setModalOpen(false);
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ noun: "", article: "der", meaning: "", status: "In Progress" });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormData({
      noun: item.noun,
      article: item.article,
      meaning: item.meaning,
      status: item.status,
    });
    setModalOpen(true);
  };

  const speakGerman = (word) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "de-DE";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  if (!isReady) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading secure vault...</div>;
  }

  const filteredList = vocabList.filter((item) => {
    const matchesArticle = articleFilter === "all" || item.article === articleFilter;
    const matchesSearch =
      item.noun.toLowerCase().includes(search.toLowerCase()) ||
      item.meaning.toLowerCase().includes(search.toLowerCase());
    return matchesArticle && matchesSearch;
  });

  const totalCount = vocabList.length;
  const masteredCount = vocabList.filter((i) => i.status === "Mastered").length;
  const derCount = vocabList.filter((i) => i.article === "der").length;
  const dieCount = vocabList.filter((i) => i.article === "die").length;
  const dasCount = vocabList.filter((i) => i.article === "das").length;

  return (
    <div className="font-adani" style={styles.pageWrapper}>
      <style>{`
        html, body, #root {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          min-height: 100vh !important;
          background-color: #f8fafc;
          box-sizing: border-box !important;
        }
        * { box-sizing: border-box; }
        button, input { font-family: inherit; }
      `}</style>

      <div style={styles.contentContainer}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.iconSquare}>🛡️</div>
            <div>
              <div style={styles.headerTitleRow}>
                <h1 style={styles.mainTitle}>German Vocabulary &amp; Articles</h1>
                <span style={styles.secureBadge}>
                  {isPersisted ? "🔒 Eviction-Proof Vault" : "💾 Auto-Protected"}
                </span>
              </div>
              <p style={styles.subtitle}>
                Auto-saved to hardware database. Active disk link:{" "}
                <strong style={{ color: fileName ? "#16a34a" : "#64748b" }}>
                  {fileName ? `📄 ${fileName}` : "None (IndexedDB only)"}
                </strong>
              </p>
            </div>
          </div>

          <div style={styles.headerRight}>
            <button onClick={connectLocalDiskFile} style={styles.btnSecondary} title="Sync with an existing local .json file">
              📂 Link Disk File
            </button>
            <button onClick={createNewDiskFile} style={styles.btnSecondary} title="Mirror to a new .json file on your PC">
              💾 Mirror to PC
            </button>
            <button onClick={openAddModal} style={styles.btnAdd}>
              + Add Noun
            </button>
          </div>
        </header>

        {/* 4 Stats Cards */}
        <section style={styles.statsGrid}>
          <div style={{ ...styles.statCard, ...styles.statCardDark }}>
            <div style={styles.statHeader}>
              <span style={{ ...styles.statLabel, color: "#94a3b8" }}>TOTAL NOUNS</span>
              <span style={styles.darkBadge}>{masteredCount} mastered</span>
            </div>
            <div style={styles.statBottom}>
              <span style={styles.statValue}>{totalCount}</span>
              <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>all genders</span>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statHeader}>
              <span style={styles.statLabel}>MASCULINE</span>
              <span style={{ ...styles.articlePill, backgroundColor: "#e0f2fe", color: "#0284c7" }}>der</span>
            </div>
            <div style={styles.statBottom}>
              <span style={{ ...styles.statValue, color: "#0284c7" }}>{derCount}</span>
              <span style={{ color: "#0284c7", fontSize: "12px", fontWeight: 600 }}>Blue highlight</span>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statHeader}>
              <span style={styles.statLabel}>FEMININE</span>
              <span style={{ ...styles.articlePill, backgroundColor: "#fce7f3", color: "#db2777" }}>die</span>
            </div>
            <div style={styles.statBottom}>
              <span style={{ ...styles.statValue, color: "#db2777" }}>{dieCount}</span>
              <span style={{ color: "#db2777", fontSize: "12px", fontWeight: 600 }}>Pink highlight</span>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statHeader}>
              <span style={styles.statLabel}>NEUTER</span>
              <span style={{ ...styles.articlePill, backgroundColor: "#dcfce7", color: "#16a34a" }}>das</span>
            </div>
            <div style={styles.statBottom}>
              <span style={{ ...styles.statValue, color: "#16a34a" }}>{dasCount}</span>
              <span style={{ color: "#16a34a", fontSize: "12px", fontWeight: 600 }}>Green highlight</span>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div style={styles.tabNavRow}>
          <div style={styles.tabGroup}>
            {[
              { id: "Vocabulary List", icon: "📑" },
              { id: "Flashcards", icon: "🎴" },
              { id: "Article Quiz", icon: "✨" },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    ...styles.tabButton,
                    backgroundColor: active ? "#4f46e5" : "#ffffff",
                    color: active ? "#ffffff" : "#64748b",
                    boxShadow: active ? "0 2px 4px rgba(79, 70, 229, 0.2)" : "none",
                  }}
                >
                  <span>{tab.icon}</span> {tab.id}
                </button>
              );
            })}
          </div>
          <span style={styles.tabHelpText}>
            * Instant hardware autosave enabled on all changes
          </span>
        </div>

        {/* VIEW 1: Vocabulary List View */}
        {activeTab === "Vocabulary List" && (
          <div style={styles.tableSectionWrapper}>
            <div style={styles.toolbar}>
              <div style={styles.searchWrapper}>
                <span style={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="Search German or English translation..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={styles.searchInput}
                />
              </div>

              <div style={styles.filterGroup}>
                <span style={styles.filterLabel}>Filter:</span>
                <button
                  onClick={() => setArticleFilter("all")}
                  style={{
                    ...styles.filterChip,
                    backgroundColor: articleFilter === "all" ? "#0f172a" : "#f8fafc",
                    color: articleFilter === "all" ? "#ffffff" : "#475569",
                    borderColor: articleFilter === "all" ? "#0f172a" : "#e2e8f0",
                  }}
                >
                  All ({vocabList.length})
                </button>
                <button
                  onClick={() => setArticleFilter("der")}
                  style={{
                    ...styles.filterChip,
                    backgroundColor: articleFilter === "der" ? "#0284c7" : "#f0f9ff",
                    color: articleFilter === "der" ? "#ffffff" : "#0284c7",
                    borderColor: articleFilter === "der" ? "#0284c7" : "#bae6fd",
                  }}
                >
                  der (Blue)
                </button>
                <button
                  onClick={() => setArticleFilter("die")}
                  style={{
                    ...styles.filterChip,
                    backgroundColor: articleFilter === "die" ? "#db2777" : "#fdf2f8",
                    color: articleFilter === "die" ? "#ffffff" : "#db2777",
                    borderColor: articleFilter === "die" ? "#db2777" : "#fbcfe8",
                  }}
                >
                  die (Pink)
                </button>
                <button
                  onClick={() => setArticleFilter("das")}
                  style={{
                    ...styles.filterChip,
                    backgroundColor: articleFilter === "das" ? "#16a34a" : "#f0fdf4",
                    color: articleFilter === "das" ? "#ffffff" : "#16a34a",
                    borderColor: articleFilter === "das" ? "#16a34a" : "#bbf7d0",
                  }}
                >
                  das (Green)
                </button>
              </div>
            </div>

            <div style={styles.tableBox}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: "4%", textAlign: "center" }}>#</th>
                    <th style={{ width: "12%" }}>ARTICLE</th>
                    <th style={{ width: "34%" }}>GERMAN NOUN (WORD HIGHLIGHT)</th>
                    <th style={{ width: "26%" }}>ENGLISH MEANING</th>
                    <th style={{ width: "14%" }}>STATUS</th>
                    <th style={{ width: "5%", textAlign: "center" }}>AUDIO</th>
                    <th style={{ width: "5%", textAlign: "center" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "36px", color: "#94a3b8" }}>
                        No vocabulary found.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((item, index) => {
                      const isDer = item.article === "der";
                      const isDie = item.article === "die";
                      const badgeStyle = isDer ? styles.pillDer : isDie ? styles.pillDie : styles.pillDas;

                      return (
                        <tr key={item.id} style={styles.tableRow}>
                          <td style={{ textAlign: "center", color: "#94a3b8", fontWeight: 500 }}>
                            {index + 1}
                          </td>
                          <td>
                            <span style={{ ...styles.pillBase, ...badgeStyle }}>{item.article}</span>
                          </td>
                          <td>
                            <div style={styles.nounWrapper}>
                              <span style={{ ...styles.pillBase, ...badgeStyle }}>{item.noun}</span>
                              <span style={styles.genderMuted}>({item.gender})</span>
                            </div>
                          </td>
                          <td style={{ color: "#1e293b", fontWeight: 600 }}>{item.meaning}</td>
                          <td>
                            <button
                              onClick={() => handleToggleStatus(item.id)}
                              style={{
                                ...styles.statusButton,
                                ...(item.status === "Mastered"
                                  ? styles.statusMastered
                                  : styles.statusInProgress),
                              }}
                            >
                              {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                            </button>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              onClick={() => speakGerman(`${item.article} ${item.noun}`)}
                              style={styles.iconBtn}
                              title="Listen Pronunciation"
                            >
                              🔊
                            </button>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div style={styles.actionCell}>
                              <button onClick={() => openEditModal(item)} style={styles.iconBtn} title="Edit Word">
                                ✏️
                              </button>
                              <button onClick={() => handleDelete(item.id)} style={styles.iconBtn} title="Delete Word">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 2: Flashcards View */}
        {activeTab === "Flashcards" && (
          <div style={styles.panelBox}>
            {vocabList.length === 0 ? (
              <p style={{ color: "#64748b" }}>No vocabulary available.</p>
            ) : (
              <div style={styles.flashcardWrapper}>
                <div onClick={() => setCardFlipped(!cardFlipped)} style={styles.cardInteractive}>
                  {!cardFlipped ? (
                    <>
                      <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>
                        GUESS ARTICLE &amp; MEANING
                      </span>
                      <h2 style={{ fontSize: "42px", margin: "16px 0", color: "#0f172a" }}>
                        {vocabList[cardIndex]?.noun}
                      </h2>
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>(Click to flip)</span>
                    </>
                  ) : (
                    <>
                      <span
                        style={{
                          ...styles.pillBase,
                          fontSize: "22px",
                          padding: "6px 20px",
                          ...(vocabList[cardIndex]?.article === "der"
                            ? styles.pillDer
                            : vocabList[cardIndex]?.article === "die"
                            ? styles.pillDie
                            : styles.pillDas),
                        }}
                      >
                        {vocabList[cardIndex]?.article} {vocabList[cardIndex]?.noun}
                      </span>
                      <h3 style={{ fontSize: "24px", margin: "14px 0 6px 0", color: "#1e293b" }}>
                        {vocabList[cardIndex]?.meaning}
                      </h3>
                      <p style={{ color: "#64748b", margin: 0, fontSize: "14px" }}>
                        {vocabList[cardIndex]?.gender}
                      </p>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <button
                    disabled={cardIndex === 0}
                    onClick={() => { setCardIndex(cardIndex - 1); setCardFlipped(false); }}
                    style={{ ...styles.btnSecondary, opacity: cardIndex === 0 ? 0.5 : 1 }}
                  >
                    ◀ Previous
                  </button>
                  <button
                    onClick={() => speakGerman(`${vocabList[cardIndex].article} ${vocabList[cardIndex].noun}`)}
                    style={styles.btnSecondary}
                  >
                    🔊 Pronounce
                  </button>
                  <button
                    disabled={cardIndex >= vocabList.length - 1}
                    onClick={() => { setCardIndex(cardIndex + 1); setCardFlipped(false); }}
                    style={{ ...styles.btnSecondary, opacity: cardIndex >= vocabList.length - 1 ? 0.5 : 1 }}
                  >
                    Next ▶
                  </button>
                </div>
                <span style={{ color: "#64748b", fontSize: "13px" }}>
                  Card {cardIndex + 1} of {vocabList.length}
                </span>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: Article Quiz View */}
        {activeTab === "Article Quiz" && (
          <div style={styles.panelBox}>
            {vocabList.length === 0 ? (
              <p style={{ color: "#64748b" }}>Add words to practice quiz.</p>
            ) : (
              <div style={{ maxWidth: "440px", margin: "0 auto", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                  <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>
                    Question {quizIndex + 1} of {vocabList.length}
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#4f46e5" }}>
                    Score: {quizScore}
                  </span>
                </div>

                <div style={styles.quizCard}>
                  <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
                    Choose the correct article:
                  </span>
                  <h1 style={{ fontSize: "38px", margin: "14px 0 8px 0", color: "#0f172a" }}>
                    {vocabList[quizIndex]?.noun}
                  </h1>
                  <p style={{ color: "#64748b", margin: 0, fontSize: "15px" }}>
                    Meaning: <strong style={{ color: "#1e293b" }}>{vocabList[quizIndex]?.meaning}</strong>
                  </p>
                </div>

                <div style={styles.quizOptionsRow}>
                  {["der", "die", "das"].map((opt) => (
                    <button
                      key={opt}
                      disabled={quizFeedback !== null}
                      onClick={() => {
                        const isCorrect = opt === vocabList[quizIndex]?.article;
                        if (isCorrect) setQuizScore((s) => s + 1);
                        setQuizFeedback(
                          isCorrect
                            ? "Correct! 🎉"
                            : `Wrong! The correct article is "${vocabList[quizIndex]?.article}".`
                        );
                      }}
                      style={{
                        ...styles.quizOptionBtn,
                        backgroundColor:
                          opt === "der" ? "#0284c7" : opt === "die" ? "#db2777" : "#16a34a",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {quizFeedback && (
                  <div style={{ marginTop: "24px" }}>
                    <p style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a" }}>
                      {quizFeedback}
                    </p>
                    <button
                      onClick={() => {
                        setQuizFeedback(null);
                        if (quizIndex < vocabList.length - 1) {
                          setQuizIndex((i) => i + 1);
                        } else {
                          alert(`Quiz completed! Final Score: ${quizScore}/${vocabList.length}`);
                          setQuizIndex(0);
                          setQuizScore(0);
                        }
                      }}
                      style={{ ...styles.btnAdd, marginTop: "8px" }}
                    >
                      {quizIndex < vocabList.length - 1 ? "Next Word" : "Restart Quiz"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", color: "#0f172a" }}>
              {editingId ? "Edit Noun" : "Add New Noun"}
            </h3>
            <form onSubmit={handleSaveModal} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={styles.modalLabel}>Article (Gender)</label>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  {["der", "die", "das"].map((art) => (
                    <label
                      key={art}
                      style={{
                        ...styles.radioPill,
                        backgroundColor: formData.article === art ? "#0f172a" : "#f1f5f9",
                        color: formData.article === art ? "#ffffff" : "#334155",
                      }}
                    >
                      <input
                        type="radio"
                        name="article"
                        value={art}
                        checked={formData.article === art}
                        onChange={(e) => setFormData({ ...formData, article: e.target.value })}
                        style={{ display: "none" }}
                      />
                      {art}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={styles.modalLabel}>German Noun</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apfel"
                  value={formData.noun}
                  onChange={(e) => setFormData({ ...formData, noun: e.target.value })}
                  style={styles.modalInput}
                />
              </div>

              <div>
                <label style={styles.modalLabel}>English Meaning</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apple"
                  value={formData.meaning}
                  onChange={(e) => setFormData({ ...formData, meaning: e.target.value })}
                  style={styles.modalInput}
                />
              </div>

              <div>
                <label style={styles.modalLabel}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={styles.modalInput}
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Mastered">Mastered</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{ ...styles.btnSecondary, border: "none" }}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.btnAdd}>
                  Save Noun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  // In your styles object:
td: {
  padding: "24px 16px", // Changed from 16px to 24px (or 28px) for more vertical breathing room
  verticalAlign: "middle",
},
  pageWrapper: {
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
    width: "100%",
    padding: "24px 32px",
    display: "flex",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  contentContainer: {
    width: "100%",
    maxWidth: "1400px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  header: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    padding: "20px 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid #eef2f6",
    flexWrap: "wrap",
    gap: "16px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  headerRight: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  iconSquare: {
    width: "50px",
    height: "50px",
    borderRadius: "12px",
    backgroundColor: "#ecfdf5",
    color: "#059669",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
  },
  headerTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  mainTitle: {
    fontSize: "21px",
    fontWeight: "700",
    color: "#0f172a",
    margin: 0,
  },
  secureBadge: {
    fontSize: "11px",
    backgroundColor: "#dcfce7",
    color: "#166534",
    padding: "3px 8px",
    borderRadius: "6px",
    fontWeight: "600",
  },
  subtitle: {
    fontSize: "13px",
    color: "#64748b",
    margin: "6px 0 0 0",
  },
  btnAdd: {
    backgroundColor: "#4f46e5",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 18px",
    fontWeight: "600",
    fontSize: "13px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  },
  btnSecondary: {
    backgroundColor: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "9px 14px",
    fontWeight: "600",
    fontSize: "13px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  statCard: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    padding: "20px 22px",
    border: "1px solid #eef2f6",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "110px",
  },
  statCardDark: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
    color: "#ffffff",
  },
  statHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: "0.6px",
  },
  darkBadge: {
    backgroundColor: "#1e293b",
    color: "#38bdf8",
    fontSize: "11px",
    fontWeight: "600",
    padding: "3px 10px",
    borderRadius: "999px",
  },
  articlePill: {
    fontSize: "11px",
    fontWeight: "700",
    padding: "3px 10px",
    borderRadius: "999px",
  },
  statBottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: "16px",
  },
  statValue: {
    fontSize: "30px",
    fontWeight: "700",
    lineHeight: 1,
  },
  tabNavRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
  },
  tabGroup: {
    display: "flex",
    gap: "8px",
    backgroundColor: "#e2e8f0",
    padding: "4px",
    borderRadius: "10px",
  },
  tabButton: {
    border: "none",
    padding: "8px 18px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  },
  tabHelpText: {
    fontSize: "12px",
    color: "#059669",
    fontWeight: "600",
  },
  tableSectionWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  toolbar: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  searchWrapper: {
    position: "relative",
    flex: "1 1 340px",
    maxWidth: "520px",
  },
  searchIcon: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "13px",
    color: "#94a3b8",
  },
  searchInput: {
    width: "100%",
    padding: "10px 14px 10px 38px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    fontSize: "13px",
    outline: "none",
  },
  filterGroup: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  filterLabel: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: "600",
    marginRight: "4px",
  },
  filterChip: {
    border: "1px solid",
    padding: "7px 14px",
    borderRadius: "8px",
    fontSize: "12px",
    cursor: "pointer",
    fontWeight: "600",
  },
  tableBox: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    border: "1px solid #eef2f6",
    overflowX: "auto",
    paddingRight: "16px",
  },
  table: {
  width: "100%",
  borderCollapse: "separate", // Must be separate, not collapse
  borderSpacing: "0 12px",    // 0 horizontal gap, 12px vertical gap between rows
  textAlign: "left",
  fontSize: "13px",
},
  pillBase: {
    padding: "4px 12px",
    borderRadius: "6px",
    fontWeight: "600",
    display: "inline-block",
  },
  pillDer: {
    backgroundColor: "#e0f2fe",
    color: "#0284c7",
  },
  pillDie: {
    backgroundColor: "#fce7f3",
    color: "#db2777",
  },
  pillDas: {
    backgroundColor: "#dcfce7",
    color: "#16a34a",
  },
  nounWrapper: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  genderMuted: {
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: 500,
  },
  statusButton: {
    border: "1px solid",
    borderRadius: "6px",
    padding: "5px 12px",
    fontSize: "12px",
    cursor: "pointer",
    fontWeight: "600",
  },
  statusMastered: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
    color: "#16a34a",
  },
  statusInProgress: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    color: "#64748b",
  },iconBtn: {
  width: "32px",
  height: "32px",
  minWidth: "32px",
  minHeight: "32px",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "14px",
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  cursor: "pointer",
  transition: "all 0.15s ease",
},
  actionCell: {
    display: "flex",
    gap: "6px",
    justifyContent: "center",
  },
  panelBox: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    padding: "48px 24px",
    border: "1px solid #eef2f6",
    textAlign: "center",
  },
  flashcardWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "24px",
  },
  cardInteractive: {
    width: "400px",
    minHeight: "220px",
    backgroundColor: "#f8fafc",
    borderRadius: "16px",
    border: "2px dashed #cbd5e1",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: "24px",
    userSelect: "none",
  },
  quizCard: {
    backgroundColor: "#f8fafc",
    padding: "28px",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
  },
  quizOptionsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
    marginTop: "20px",
  },
  quizOptionBtn: {
    color: "#ffffff",
    border: "none",
    padding: "14px",
    borderRadius: "10px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    backdropFilter: "blur(2px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    padding: "28px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
  },
  modalLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#475569",
  },
  modalInput: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    marginTop: "6px",
    outline: "none",
  },
  radioPill: {
    flex: 1,
    textAlign: "center",
    padding: "8px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },
};