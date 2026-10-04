import { useState, useEffect } from "react";
import "./App.css";

const DB_NAME = "GermanVocabVault";
const DB_VERSION = 1;
const STORE_NAME = "vocabulary_store";
const BACKUP_KEY = "current_vocab_data";

const SEED_DATA = [
  { id: 1, article: "der", noun: "Mann", gender: "Masculine", meaning: "Male / Man", status: "Mastered" },
  { id: 2, article: "die", noun: "Frau", gender: "Feminine", meaning: "Woman / Wife", status: "In Progress" },
  { id: 3, article: "das", noun: "Kind", gender: "Neuter", meaning: "Child", status: "In Progress" },
  { id: 4, article: "der", noun: "Tisch", gender: "Masculine", meaning: "Table", status: "Mastered" },
  { id: 5, article: "die", noun: "Sonne", gender: "Feminine", meaning: "Sun", status: "Mastered" },
  { id: 6, article: "das", noun: "Buch", gender: "Neuter", meaning: "Book", status: "In Progress" },
];

// ---------- IndexedDB helpers ----------
function openVaultDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadFromVaultDB() {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const getReq = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(BACKUP_KEY);
    getReq.onsuccess = () => resolve(getReq.result || null);
    getReq.onerror = () => reject(getReq.error);
  });
}

async function writeToVaultDB(data) {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const putReq = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(data, BACKUP_KEY);
    putReq.onsuccess = () => resolve(true);
    putReq.onerror = () => reject(putReq.error);
  });
}

// ---------- Styles (CSS so media queries work) ----------
const CSS = `
:root {
  --bg: #f8fafc; --card: #ffffff; --line: #eef2f6; --line-2: #e2e8f0;
  --ink: #0f172a; --ink-2: #1e293b; --muted: #64748b; --faint: #94a3b8;
  --brand: #4f46e5;
  --der: #0284c7; --der-bg: #e0f2fe;
  --die: #db2777; --die-bg: #fce7f3;
  --das: #16a34a; --das-bg: #dcfce7;
}
html, body, #root { margin: 0 !important; padding: 0 !important; width: 100% !important; min-height: 100vh; background: var(--bg); }
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
button, input, select { font-family: inherit; }
button { cursor: pointer; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

.page { background: var(--bg); min-height: 100vh; width: 100%; padding: 24px 32px; display: flex; justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--ink); }
.container { width: 100%; max-width: 1400px; display: flex; flex-direction: column; gap: 24px; min-width: 0; }

/* Header */
.header { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 20px 28px;
  display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.header-left { display: flex; align-items: center; gap: 16px; min-width: 0; }
.logo { width: 50px; height: 50px; flex: none; border-radius: 12px; background: #ecfdf5; display: flex; align-items: center; justify-content: center; font-size: 24px; }
.title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.title { font-size: 21px; font-weight: 700; margin: 0; }
.badge { font-size: 11px; background: #dcfce7; color: #166534; padding: 3px 8px; border-radius: 6px; font-weight: 600; white-space: nowrap; }
.subtitle { font-size: 13px; color: var(--muted); margin: 6px 0 0; overflow-wrap: anywhere; }
.header-actions { display: flex; gap: 10px; align-items: center; }

.btn { border-radius: 8px; padding: 10px 16px; font-weight: 600; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; min-height: 40px; }
.btn-primary { background: var(--brand); color: #fff; border: none; }
.btn-secondary { background: #fff; color: #334155; border: 1px solid #cbd5e1; }
.btn[disabled] { opacity: .45; cursor: not-allowed; }
.fab { display: none; }

/* Stats */
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.stat { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 20px 22px; min-height: 110px;
  display: flex; flex-direction: column; justify-content: space-between; }
.stat.dark { background: var(--ink); border-color: var(--ink); color: #fff; }
.stat-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.stat-label { font-size: 11px; font-weight: 700; color: var(--muted); letter-spacing: .6px; }
.stat.dark .stat-label { color: var(--faint); }
.stat-pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.stat-pill.dark { background: var(--ink-2); color: #38bdf8; font-weight: 600; }
.stat-foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 16px; }
.stat-value { font-size: 30px; font-weight: 700; line-height: 1; }
.stat-note { font-size: 12px; font-weight: 600; }

.c-der { color: var(--der); } .c-die { color: var(--die); } .c-das { color: var(--das); }
.bg-der { background: var(--der-bg); color: var(--der); }
.bg-die { background: var(--die-bg); color: var(--die); }
.bg-das { background: var(--das-bg); color: var(--das); }

/* Tabs */
.tab-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.tabs { display: flex; gap: 4px; background: var(--line-2); padding: 4px; border-radius: 10px; }
.tab { border: none; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #fff; color: var(--muted); white-space: nowrap; }
.tab.active { background: var(--brand); color: #fff; box-shadow: 0 2px 4px rgba(79,70,229,.2); }
.tab .short { display: none; }
.help { font-size: 12px; color: #059669; font-weight: 600; }

/* Toolbar */
.section { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.toolbar { display: flex; gap: 16px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.search { position: relative; flex: 1 1 340px; max-width: 520px; }
.search span { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 13px; }
.search input { width: 100%; padding: 10px 14px 10px 38px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; font-size: 14px; min-height: 42px; }
.filters { display: flex; gap: 8px; align-items: center; }
.filters-label { font-size: 12px; color: var(--muted); font-weight: 600; margin-right: 4px; }
.chip { border: 1px solid; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; white-space: nowrap; min-height: 34px; }
.chip.all  { background: #f8fafc; color: #475569; border-color: var(--line-2); }
.chip.der  { background: #f0f9ff; color: var(--der); border-color: #bae6fd; }
.chip.die  { background: #fdf2f8; color: var(--die); border-color: #fbcfe8; }
.chip.das  { background: #f0fdf4; color: var(--das); border-color: #bbf7d0; }
.chip.all.on { background: var(--ink); color: #fff; border-color: var(--ink); }
.chip.der.on { background: var(--der); color: #fff; border-color: var(--der); }
.chip.die.on { background: var(--die); color: #fff; border-color: var(--die); }
.chip.das.on { background: var(--das); color: #fff; border-color: var(--das); }

/* Word list (grid rows: table on desktop, cards on mobile) */
.list { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 8px 16px 16px; }
.list-head, .row { display: grid; grid-template-columns: 44px 90px minmax(0,1.6fr) minmax(0,1.2fr) 140px 120px; gap: 12px; align-items: center; }
.list-head { padding: 12px 8px; font-size: 11px; font-weight: 700; color: var(--faint); letter-spacing: .5px; border-bottom: 1px solid var(--line); }
.row { padding: 14px 8px; border-bottom: 1px solid var(--line); font-size: 13px; }
.row:last-child { border-bottom: none; }
.c-idx { text-align: center; color: var(--faint); font-weight: 500; }
.noun-wrap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pill { padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block; }
.gender { color: var(--faint); font-size: 12px; font-weight: 500; }
.c-mean { color: var(--ink-2); font-weight: 600; }
.status { border: 1px solid; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.status.done { background: #f0fdf4; border-color: #86efac; color: var(--das); }
.status.todo { background: #f8fafc; border-color: #cbd5e1; color: var(--muted); }
.actions { display: flex; gap: 6px; justify-content: flex-end; }
.icon-btn { width: 36px; height: 36px; min-width: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; background: #f8fafc; border: 1px solid var(--line-2); border-radius: 8px; }
.empty { text-align: center; padding: 36px; color: var(--faint); }

/* Panels */
.panel { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 48px 24px; text-align: center; }
.flash-wrap { display: flex; flex-direction: column; align-items: center; gap: 24px; }
.flash { width: min(400px, 100%); min-height: 220px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; cursor: pointer; user-select: none; }
.flash h2 { font-size: 42px; margin: 16px 0; overflow-wrap: anywhere; }
.flash-controls { display: flex; gap: 12px; align-items: center; }
.quiz { max-width: 440px; margin: 0 auto; text-align: center; }
.quiz-head { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; font-weight: 600; color: var(--muted); }
.quiz-card { background: #f8fafc; padding: 28px; border-radius: 14px; border: 1px solid var(--line-2); }
.quiz-card h1 { font-size: 38px; margin: 14px 0 8px; overflow-wrap: anywhere; }
.quiz-opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
.quiz-opt { color: #fff; border: none; padding: 14px; border-radius: 10px; font-size: 16px; font-weight: 700; min-height: 48px; }
.quiz-opt.der { background: var(--der); } .quiz-opt.die { background: var(--die); } .quiz-opt.das { background: var(--das); }
.quiz-opt[disabled] { opacity: .6; }

/* Modal */
.overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 16px; }
.modal { background: #fff; border-radius: 14px; padding: 28px; width: 100%; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,.1); max-height: 100%; overflow-y: auto; }
.modal h3 { margin: 0 0 16px; font-size: 18px; }
.modal form { display: flex; flex-direction: column; gap: 16px; }
.modal-label { font-size: 12px; font-weight: 600; color: #475569; }
.modal-input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 16px; margin-top: 6px; background: #fff; min-height: 42px; }
.radios { display: flex; gap: 8px; margin-top: 6px; }
.radio { flex: 1; text-align: center; padding: 10px 8px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; background: #f1f5f9; color: #334155; }
.radio.on { background: var(--ink); color: #fff; }
.radio input { display: none; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }

/* Patterns */
.pat-note { margin: 0; font-size: 13px; color: var(--muted); flex: 1 1 320px; max-width: 560px; line-height: 1.5; }
.pat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
.pat-grid.single { grid-template-columns: 1fr; }
.pat-col { background: var(--card); border: 1px solid var(--line); border-top: 4px solid; border-radius: 14px; padding: 18px; min-width: 0; }
.pat-col.der { border-top-color: var(--der); } .pat-col.die { border-top-color: var(--die); } .pat-col.das { border-top-color: var(--das); }
.pat-head { display: flex; align-items: center; gap: 10px; }
.pat-head .pill { font-size: 14px; }
.pat-count { margin-left: auto; font-size: 12px; color: var(--faint); font-weight: 600; }
.pat-intro { margin: 10px 0 14px; font-size: 13px; color: var(--muted); line-height: 1.5; }
.pat-rules { display: grid; grid-template-columns: 1fr; gap: 10px; }
.pat-grid.single .pat-rules { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.pat-card { background: #f8fafc; border: 1px solid var(--line-2); border-radius: 10px; padding: 12px 14px; }
.pat-rule { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
.pat-rule strong { font-size: 15px; }
.pat-rule span { font-size: 12px; color: var(--muted); line-height: 1.4; }
.pat-ex { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pat-ex li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
.pat-mean { color: var(--muted); }
.pill-sm { padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: 12.5px; display: inline-block; }
.pat-mine { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); font-weight: 600; }

/* ================= TABLET ================= */
@media (max-width: 1024px) {
  .page { padding: 20px; }
  .stats { grid-template-columns: repeat(2, 1fr); }
  .help { display: none; }
  .pat-grid { grid-template-columns: 1fr; }
  .pat-grid .pat-rules { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
}

/* ================= MOBILE ================= */
@media (max-width: 640px) {
  .page { padding: 12px 12px calc(96px + env(safe-area-inset-bottom)); }
  .container { gap: 14px; }

  .header { padding: 14px; border-radius: 12px; gap: 12px; }
  .header-left { gap: 12px; width: 100%; }
  .logo { width: 42px; height: 42px; font-size: 20px; border-radius: 10px; }
  .title { font-size: 17px; line-height: 1.25; }
  .subtitle { font-size: 12px; margin-top: 4px; }
  .subtitle .long { display: none; }
  .header-actions { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .header-actions .btn-primary { display: none; }
  .btn { padding: 10px 8px; font-size: 12.5px; }

  .fab { display: inline-flex; position: fixed; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 50;
    padding: 0 20px; min-height: 52px; border-radius: 999px; box-shadow: 0 8px 20px rgba(79,70,229,.35); font-size: 14px; }

  .stats { gap: 10px; }
  .stat { padding: 12px 14px; min-height: 0; border-radius: 12px; }
  .stat-foot { margin-top: 8px; }
  .stat-value { font-size: 26px; }
  .stat-note { display: none; }
  .stat-label { font-size: 10px; }
  .stat-pill { font-size: 10px; padding: 2px 8px; }

  .tab-row { gap: 0; }
  .tabs { width: 100%; overflow-x: auto; scrollbar-width: none; gap: 2px; }
  .tabs::-webkit-scrollbar { display: none; }
  .tab { flex: 1 0 auto; min-width: 58px; flex-direction: column; gap: 2px; padding: 8px 6px; font-size: 11px; }
  .tab > span:first-child { font-size: 16px; line-height: 1; }
  .pat-col { padding: 14px; }
  .pat-note { flex-basis: 100%; }
  .tab .full { display: none; }
  .tab .short { display: inline; }

  .toolbar { gap: 10px; }
  .search { flex-basis: 100%; max-width: none; }
  .filters { width: 100%; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; margin: 0 -12px; padding: 0 12px 2px; width: calc(100% + 24px); }
  .filters::-webkit-scrollbar { display: none; }
  .filters-label { display: none; }
  .chip .hint { display: none; }

  .list { background: transparent; border: none; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .list-head { display: none; }
  .row { background: #fff; border: 1px solid var(--line); border-left-width: 4px; border-radius: 12px; padding: 12px 14px; gap: 8px 10px;
    grid-template-columns: auto 1fr auto;
    grid-template-areas: "art noun noun" "mean mean mean" "status status actions"; }
  .row:last-child { border-bottom: 1px solid var(--line); }
  .row.der { border-left-color: var(--der); } .row.die { border-left-color: var(--die); } .row.das { border-left-color: var(--das); }
  .c-idx { display: none; }
  .c-art { grid-area: art; }
  .c-noun { grid-area: noun; }
  .c-mean { grid-area: mean; font-size: 14px; padding-bottom: 4px; }
  .c-status { grid-area: status; }
  .actions { grid-area: actions; }
  .pill { font-size: 15px; }
  .noun-wrap .pill { background: transparent !important; padding: 0; font-size: 18px; font-weight: 700; }
  .status { padding: 8px 12px; min-height: 36px; }
  .icon-btn { width: 40px; height: 40px; min-width: 40px; }

  .panel { padding: 28px 14px; }
  .flash { min-height: 200px; }
  .flash h2 { font-size: 34px; }
  .flash-controls { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .flash-controls .mid { grid-column: 1 / -1; order: 3; }
  .quiz-card { padding: 20px; }
  .quiz-card h1 { font-size: 32px; }
  .quiz-opt { padding: 16px 8px; }

  .overlay { align-items: flex-end; padding: 0; }
  .modal { max-width: none; border-radius: 18px 18px 0 0; padding: 22px 18px calc(22px + env(safe-area-inset-bottom)); max-height: 92vh; }
  .modal-actions .btn { flex: 1; }
}

@media (prefers-reduced-motion: no-preference) {
  .btn, .chip, .tab, .icon-btn, .status { transition: background-color .15s, color .15s, transform .1s; }
  .btn:active, .icon-btn:active, .chip:active { transform: scale(.97); }
}
`;

const ARTICLE_CLASS = { der: "bg-der", die: "bg-die", das: "bg-das" };
const GENDER_MAP = { der: "Masculine", die: "Feminine", das: "Neuter" };


// ---------- Article patterns ----------
const PATTERNS = {
  der: {
    title: "Masculine",
    intro: "Mostly people who do things, tools, and time and weather words.",
    rules: [
      { rule: "-er", suffix: ["er"], note: "People who do something, tools", ex: [["Lehrer", "teacher"], ["Fahrer", "driver"], ["Computer", "computer"]] },
      { rule: "-ling", suffix: ["ling"], note: "People and things with a trait", ex: [["Frühling", "spring"], ["Lehrling", "apprentice"]] },
      { rule: "-ismus", suffix: ["ismus"], note: "Ideas and movements", ex: [["Tourismus", "tourism"], ["Realismus", "realism"]] },
      { rule: "-ist", suffix: ["ist"], note: "People by belief or job", ex: [["Tourist", "tourist"], ["Optimist", "optimist"]] },
      { rule: "-or", suffix: ["or"], note: "Machines and professions", ex: [["Motor", "engine"], ["Doktor", "doctor"]] },
      { rule: "-ig / -ich", suffix: ["ig", "ich"], note: "Common endings", ex: [["König", "king"], ["Teppich", "carpet"]] },
      { rule: "Days, months, seasons", note: "Time words are always der", ex: [["Montag", "Monday"], ["Januar", "January"], ["Sommer", "summer"]] },
      { rule: "Weather and directions", note: "Wind, rain and compass points", ex: [["Regen", "rain"], ["Wind", "wind"], ["Norden", "north"]] },
    ],
  },
  die: {
    title: "Feminine",
    intro: "Abstract ideas, female people, and most nouns ending in -e.",
    rules: [
      { rule: "-ung", suffix: ["ung"], note: "Actions and results", ex: [["Zeitung", "newspaper"], ["Wohnung", "apartment"], ["Übung", "exercise"]] },
      { rule: "-heit / -keit", suffix: ["heit", "keit"], note: "Qualities and states", ex: [["Freiheit", "freedom"], ["Möglichkeit", "possibility"]] },
      { rule: "-schaft", suffix: ["schaft"], note: "Groups and relationships", ex: [["Freundschaft", "friendship"], ["Gesellschaft", "society"]] },
      { rule: "-ion", suffix: ["ion"], note: "Latin-based words", ex: [["Nation", "nation"], ["Station", "station"]] },
      { rule: "-tät", suffix: ["tät"], note: "Abstract concepts", ex: [["Universität", "university"], ["Qualität", "quality"]] },
      { rule: "-ie / -ik", suffix: ["ie", "ik"], note: "Subjects and fields", ex: [["Familie", "family"], ["Musik", "music"]] },
      { rule: "-ur", suffix: ["ur"], note: "Culture and nature words", ex: [["Kultur", "culture"], ["Natur", "nature"]] },
      { rule: "-in", suffix: ["in"], note: "Female version of a person", ex: [["Lehrerin", "female teacher"], ["Ärztin", "female doctor"]] },
      { rule: "-e (most)", suffix: ["e"], note: "Most nouns ending in -e. Exceptions: der Name, das Auge", ex: [["Sonne", "sun"], ["Lampe", "lamp"], ["Blume", "flower"]] },
    ],
  },
  das: {
    title: "Neuter",
    intro: "Small things, young beings, foreign -ment and -um words, and verbs used as nouns.",
    rules: [
      { rule: "-chen / -lein", suffix: ["chen", "lein"], note: "Diminutives, always das", ex: [["Mädchen", "girl"], ["Brötchen", "bread roll"], ["Fräulein", "miss"]] },
      { rule: "-ment", suffix: ["ment"], note: "Latin-based words", ex: [["Dokument", "document"], ["Instrument", "instrument"]] },
      { rule: "-um", suffix: ["um"], note: "Latin-based words", ex: [["Museum", "museum"], ["Datum", "date"]] },
      { rule: "-ma", suffix: ["ma"], note: "Greek-based words", ex: [["Thema", "topic"], ["Drama", "drama"]] },
      { rule: "-nis", suffix: ["nis"], note: "Results and states. Some are die", ex: [["Ergebnis", "result"], ["Geheimnis", "secret"]] },
      { rule: "Verbs as nouns", note: "An infinitive used as a noun", ex: [["Essen", "food"], ["Leben", "life"], ["Lernen", "learning"]] },
      { rule: "Colors and metals", note: "Names of colors and most metals", ex: [["Blau", "blue"], ["Gold", "gold"], ["Silber", "silver"]] },
      { rule: "Young beings", note: "Children and baby animals", ex: [["Kind", "child"], ["Baby", "baby"], ["Kalb", "calf"]] },
    ],
  },
};

function wordsFor(rule, article, list) {
  if (!rule.suffix) return [];
  return list.filter((w) => {
    const n = w.noun.toLowerCase();
    return w.article === article && rule.suffix.some((sfx) => n.endsWith(sfx) && n.length > sfx.length);
  });
}

function WordList({ list, onToggle, onEdit, onDelete, onSpeak }) {

  const q = search.toLowerCase();
  const filtered = list.filter(
    (item) =>
      (articleFilter === "all" || item.article === articleFilter) &&
      (item.noun.toLowerCase().includes(q) || item.meaning.toLowerCase().includes(q))
  );

  return (
    <div className="section">
      <div className="toolbar">
        <div className="search">
          <span>🔍</span>
          <input
            type="search"
            placeholder="Search German or English..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ArticleChips value={articleFilter} onChange={setArticleFilter} total={list.length} />
      </div>

      <div className="list">
        <div className="list-head">
          <span style={{ textAlign: "center" }}>#</span>
          <span>ARTICLE</span>
          <span>GERMAN NOUN</span>
          <span>ENGLISH MEANING</span>
          <span>STATUS</span>
          <span style={{ textAlign: "right" }}>ACTIONS</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">No vocabulary found.</div>
        ) : (
          filtered.map((item, index) => (
            <div className={`row ${item.article}`} key={item.id}>
              <div className="c-idx">{index + 1}</div>
              <div className="c-art">
                <span className={`pill ${ARTICLE_CLASS[item.article]}`}>{item.article}</span>
              </div>
              <div className="c-noun">
                <div className="noun-wrap">
                  <span className={`pill ${ARTICLE_CLASS[item.article]}`}>{item.noun}</span>
                  <span className="gender">({item.gender})</span>
                </div>
              </div>
              <div className="c-mean">{item.meaning}</div>
              <div className="c-status">
                <button
                  onClick={() => onToggle(item.id)}
                  className={`status ${item.status === "Mastered" ? "done" : "todo"}`}
                >
                  {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                </button>
              </div>
              <div className="actions">
                <button onClick={() => onSpeak(`${item.article} ${item.noun}`)} className="icon-btn" title="Listen" aria-label="Listen">🔊</button>
                <button onClick={() => onEdit(item)} className="icon-btn" title="Edit" aria-label="Edit">✏️</button>
                <button onClick={() => onDelete(item.id)} className="icon-btn" title="Delete" aria-label="Delete">🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ArticleChips({ value, onChange, total }) {
  return (
    <div className="filters">
      <span className="filters-label">Filter:</span>
      <button onClick={() => onChange("all")} className={`chip all ${value === "all" ? "on" : ""}`}>
        All ({total})
      </button>
      {["der", "die", "das"].map((a) => (
        <button key={a} onClick={() => onChange(a)} className={`chip ${a} ${value === a ? "on" : ""}`}>
          {a} <span className="hint">({{ der: "Blue", die: "Pink", das: "Green" }[a]})</span>
        </button>
      ))}
    </div>
  );
}

function PatternView({ list }) {
  const [filter, setFilter] = useState("all");
  const cats = filter === "all" ? ["der", "die", "das"] : [filter];

  return (
    <div className="section">
      <div className="toolbar">
        <p className="pat-note">
          Patterns are guides, not laws. Most words follow them, but exceptions exist, so always learn the article with the noun.
        </p>
        <ArticleChips value={filter} onChange={setFilter} total={list.length} />
      </div>

      <div className={`pat-grid ${cats.length === 1 ? "single" : ""}`}>
        {cats.map((a) => {
          const P = PATTERNS[a];
          return (
            <section className={`pat-col ${a}`} key={a}>
              <header className="pat-head">
                <span className={`pill ${ARTICLE_CLASS[a]}`}>{a}</span>
                <strong>{P.title}</strong>
                <span className="pat-count">{P.rules.length} patterns</span>
              </header>
              <p className="pat-intro">{P.intro}</p>

              <div className="pat-rules">
                {P.rules.map((r) => {
                  const mine = wordsFor(r, a, list);
                  return (
                    <article className="pat-card" key={r.rule}>
                      <div className="pat-rule">
                        <strong className={`c-${a}`}>{r.rule}</strong>
                        <span>{r.note}</span>
                      </div>
                      <ul className="pat-ex">
                        {r.ex.map(([n, m]) => (
                          <li key={n}>
                            <span className={`pill-sm ${ARTICLE_CLASS[a]}`}>{a} {n}</span>
                            <span className="pat-mean">{m}</span>
                          </li>
                        ))}
                      </ul>
                      {mine.length > 0 && (
                        <div className="pat-mine">
                          <span>Your words:</span>
                          {mine.map((w) => (
                            <span key={w.id} className={`pill-sm ${ARTICLE_CLASS[a]}`}>{w.article} {w.noun}</span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [vocabList, setVocabList] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [isPersisted, setIsPersisted] = useState(false);

  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [, setSyncStatus] = useState("Vault Active");

  const [activeTab, setActiveTab] = useState("Vocabulary List");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ noun: "", article: "der", meaning: "", status: "In Progress" });

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);

  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  useEffect(() => {
    async function initVault() {
      if (navigator.storage && navigator.storage.persist) {
        const persisted = await navigator.storage.persist();
        setIsPersisted(persisted);
      }
      try {
        const stored = await loadFromVaultDB();
        if (stored && Array.isArray(stored) && stored.length > 0) {
          setVocabList(stored);
        } else {
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

  const commitData = async (newList) => {
    setVocabList(newList);
    // Keep indexes valid if the list shrank
    setCardIndex((i) => Math.min(i, Math.max(newList.length - 1, 0)));
    setQuizIndex((i) => Math.min(i, Math.max(newList.length - 1, 0)));

    try {
      await writeToVaultDB(newList);
      localStorage.setItem("backup_vocab", JSON.stringify(newList));
      setSyncStatus("Vault Protected");
    } catch (e) {
      console.error("Failed writing to IndexedDB:", e);
    }

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

  // File System Access API is desktop-Chromium only; guard it for mobile browsers
  const fsSupported = typeof window !== "undefined" && "showOpenFilePicker" in window;

  const connectLocalDiskFile = async () => {
    if (!fsSupported) {
      alert("Linking a disk file isn't supported on this browser. Your words are still saved in the browser vault.");
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "JSON Vocabulary File", accept: { "application/json": [".json"] } }],
        multiple: false,
      });
      const file = await handle.getFile();
      const parsed = JSON.parse(await file.text());
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
    if (!fsSupported) {
      // Mobile fallback: download a JSON backup instead
      const blob = new Blob([JSON.stringify(vocabList, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `german_vocab_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
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

  const handleToggleStatus = (id) => {
    commitData(
      vocabList.map((item) =>
        item.id === id ? { ...item, status: item.status === "Mastered" ? "In Progress" : "Mastered" } : item
      )
    );
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this word permanently?")) {
      commitData(vocabList.filter((item) => item.id !== id));
    }
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!formData.noun.trim() || !formData.meaning.trim()) return;
    const gender = GENDER_MAP[formData.article];
    const updated = editingId
      ? vocabList.map((item) => (item.id === editingId ? { ...item, ...formData, gender } : item))
      : [...vocabList, { id: Date.now(), ...formData, gender }];
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
    setFormData({ noun: item.noun, article: item.article, meaning: item.meaning, status: item.status });
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

  const totalCount = vocabList.length;
  const masteredCount = vocabList.filter((i) => i.status === "Mastered").length;
  const count = (a) => vocabList.filter((i) => i.article === a).length;

  const card = vocabList[cardIndex];
  const quizWord = vocabList[quizIndex];

  const tabs = [
    { id: "Vocabulary List", icon: "📑", short: "List" },
    { id: "Nouns", icon: "🗂️", short: "Nouns" },
    { id: "Flashcards", icon: "🎴", short: "Cards" },
    { id: "Article Quiz", icon: "✨", short: "Quiz" },
    { id: "Pattern", icon: "🧩", short: "Pattern" },
  ];

  return (
    <div className="page">
      <style>{CSS}</style>

      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <div className="logo">🛡️</div>
            <div style={{ minWidth: 0 }}>
              <div className="title-row">
                <h1 className="title">German Vocabulary &amp; Articles</h1>
                <span className="badge">{isPersisted ? "🔒 Eviction-Proof Vault" : "💾 Auto-Protected"}</span>
              </div>
              <p className="subtitle">
                <span className="long">Auto-saved to hardware database. </span>
                Disk link:{" "}
                <strong style={{ color: fileName ? "#16a34a" : "#64748b" }}>
                  {fileName ? `📄 ${fileName}` : "None (browser only)"}
                </strong>
              </p>
            </div>
          </div>

          <div className="header-actions">
            <button onClick={connectLocalDiskFile} className="btn btn-secondary" title="Sync with an existing local .json file">
              📂 Link File
            </button>
            <button onClick={createNewDiskFile} className="btn btn-secondary" title="Mirror or export to a .json file">
              {fsSupported ? "💾 Mirror to PC" : "💾 Export"}
            </button>
            <button onClick={openAddModal} className="btn btn-primary">+ Add Noun</button>
          </div>
        </header>

        {/* Stats */}
        <section className="stats">
          <div className="stat dark">
            <div className="stat-head">
              <span className="stat-label">TOTAL NOUNS</span>
              <span className="stat-pill dark">{masteredCount} mastered</span>
            </div>
            <div className="stat-foot">
              <span className="stat-value">{totalCount}</span>
              <span className="stat-note" style={{ color: "#94a3b8", fontWeight: 500 }}>all genders</span>
            </div>
          </div>
          {[
            { a: "der", label: "MASCULINE", note: "Blue highlight" },
            { a: "die", label: "FEMININE", note: "Pink highlight" },
            { a: "das", label: "NEUTER", note: "Green highlight" },
          ].map(({ a, label, note }) => (
            <div className="stat" key={a}>
              <div className="stat-head">
                <span className="stat-label">{label}</span>
                <span className={`stat-pill ${ARTICLE_CLASS[a]}`}>{a}</span>
              </div>
              <div className="stat-foot">
                <span className={`stat-value c-${a}`}>{count(a)}</span>
                <span className={`stat-note c-${a}`}>{note}</span>
              </div>
            </div>
          ))}
        </section>

        {/* Tabs */}
        <div className="tab-row">
          <div className="tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab ${activeTab === tab.id ? "active" : ""}`}
              >
                <span>{tab.icon}</span>
                <span className="full">{tab.id}</span>
                <span className="short">{tab.short}</span>
              </button>
            ))}
          </div>
          <span className="help">* Instant hardware autosave enabled on all changes</span>
        </div>

        {/* VIEW 1 & 2: Vocabulary List and Nouns (same view, separate search/filter) */}
        {(activeTab === "Vocabulary List" || activeTab === "Nouns") && (
          <WordList
            key={activeTab}
            list={vocabList}
            onToggle={handleToggleStatus}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onSpeak={speakGerman}
          />
        )}

        {/* VIEW 3: Flashcards */}
        {activeTab === "Flashcards" && (
          <div className="panel">
            {!card ? (
              <p style={{ color: "#64748b" }}>No vocabulary available.</p>
            ) : (
              <div className="flash-wrap">
                <div className="flash" onClick={() => setCardFlipped(!cardFlipped)}>
                  {!cardFlipped ? (
                    <>
                      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>GUESS ARTICLE &amp; MEANING</span>
                      <h2>{card.noun}</h2>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>(Tap to flip)</span>
                    </>
                  ) : (
                    <>
                      <span className={`pill ${ARTICLE_CLASS[card.article]}`} style={{ fontSize: 22, padding: "6px 20px" }}>
                        {card.article} {card.noun}
                      </span>
                      <h3 style={{ fontSize: 24, margin: "14px 0 6px", color: "#1e293b" }}>{card.meaning}</h3>
                      <p style={{ color: "#64748b", margin: 0, fontSize: 14 }}>{card.gender}</p>
                    </>
                  )}
                </div>

                <div className="flash-controls">
                  <button
                    className="btn btn-secondary"
                    disabled={cardIndex === 0}
                    onClick={() => { setCardIndex(cardIndex - 1); setCardFlipped(false); }}
                  >
                    ◀ Previous
                  </button>
                  <button
                    className="btn btn-secondary mid"
                    onClick={() => speakGerman(`${card.article} ${card.noun}`)}
                  >
                    🔊 Pronounce
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={cardIndex >= vocabList.length - 1}
                    onClick={() => { setCardIndex(cardIndex + 1); setCardFlipped(false); }}
                  >
                    Next ▶
                  </button>
                </div>
                <span style={{ color: "#64748b", fontSize: 13 }}>
                  Card {cardIndex + 1} of {vocabList.length}
                </span>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: Quiz */}
        {activeTab === "Article Quiz" && (
          <div className="panel">
            {!quizWord ? (
              <p style={{ color: "#64748b" }}>Add words to practice quiz.</p>
            ) : (
              <div className="quiz">
                <div className="quiz-head">
                  <span>Question {quizIndex + 1} of {vocabList.length}</span>
                  <span style={{ fontWeight: 700, color: "#4f46e5" }}>Score: {quizScore}</span>
                </div>

                <div className="quiz-card">
                  <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Choose the correct article:</span>
                  <h1>{quizWord.noun}</h1>
                  <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>
                    Meaning: <strong style={{ color: "#1e293b" }}>{quizWord.meaning}</strong>
                  </p>
                </div>

                <div className="quiz-opts">
                  {["der", "die", "das"].map((opt) => (
                    <button
                      key={opt}
                      disabled={quizFeedback !== null}
                      className={`quiz-opt ${opt}`}
                      onClick={() => {
                        const ok = opt === quizWord.article;
                        if (ok) setQuizScore((s) => s + 1);
                        setQuizFeedback(ok ? "Correct! 🎉" : `Wrong! The correct article is "${quizWord.article}".`);
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {quizFeedback && (
                  <div style={{ marginTop: 24 }}>
                    <p style={{ fontSize: 15, fontWeight: 600 }}>{quizFeedback}</p>
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: 8 }}
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
                    >
                      {quizIndex < vocabList.length - 1 ? "Next Word" : "Restart Quiz"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: Pattern */}
        {activeTab === "Pattern" && <PatternView list={vocabList} />}
      </div>

      {/* Mobile add button */}
      {(activeTab === "Vocabulary List" || activeTab === "Nouns") && !modalOpen && (
        <button onClick={openAddModal} className="btn btn-primary fab" aria-label="Add noun">
          + Add Noun
        </button>
      )}

      {/* Modal (bottom sheet on mobile) */}
      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>{editingId ? "Edit Noun" : "Add New Noun"}</h3>
            <form onSubmit={handleSaveModal}>
              <div>
                <label className="modal-label">Article (Gender)</label>
                <div className="radios">
                  {["der", "die", "das"].map((art) => (
                    <label key={art} className={`radio ${formData.article === art ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="article"
                        value={art}
                        checked={formData.article === art}
                        onChange={(e) => setFormData({ ...formData, article: e.target.value })}
                      />
                      {art}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="modal-label">German Noun</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. Apfel"
                  value={formData.noun}
                  onChange={(e) => setFormData({ ...formData, noun: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">English Meaning</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. Apple"
                  value={formData.meaning}
                  onChange={(e) => setFormData({ ...formData, meaning: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Status</label>
                <select
                  className="modal-input"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Mastered">Mastered</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary" style={{ border: "none" }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Save Noun</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}