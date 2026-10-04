import { useState, useEffect } from "react";
import "./App.css";

const DB_NAME = "GermanVocabVault";
const DB_VERSION = 2;
const STORE_NAME = "vocabulary_store";
const VERBS_STORE_NAME = "verbs_store";
const BACKUP_KEY = "current_vocab_data";
const VERBS_BACKUP_KEY = "current_verbs_data";

const SEED_DATA = [
  { id: 1, article: "der", noun: "Mann", gender: "Masculine", meaning: "Male / Man", status: "Mastered" },
  { id: 2, article: "die", noun: "Frau", gender: "Feminine", meaning: "Woman / Wife", status: "In Progress" },
  { id: 3, article: "das", noun: "Kind", gender: "Neuter", meaning: "Child", status: "In Progress" },
  { id: 4, article: "der", noun: "Tisch", gender: "Masculine", meaning: "Table", status: "Mastered" },
  { id: 5, article: "die", noun: "Sonne", gender: "Feminine", meaning: "Sun", status: "Mastered" },
  { id: 6, article: "das", noun: "Buch", gender: "Neuter", meaning: "Book", status: "In Progress" },
];

const SEED_VERBS = [
  { id: 101, verb: "helfen", caseType: "Dativ", meaning: "to help", example: "Ich helfe dem Mann.", status: "Mastered" },
  { id: 102, verb: "danken", caseType: "Dativ", meaning: "to thank", example: "Wir danken der Lehrerin.", status: "In Progress" },
  { id: 103, verb: "gehören", caseType: "Dativ", meaning: "to belong to", example: "Das Buch gehört mir.", status: "In Progress" },
  { id: 104, verb: "sehen", caseType: "Akkusativ", meaning: "to see", example: "Ich sehe den Tisch.", status: "Mastered" },
  { id: 105, verb: "haben", caseType: "Akkusativ", meaning: "to have", example: "Er hat einen Hund.", status: "Mastered" },
  { id: 106, verb: "brauchen", caseType: "Akkusativ", meaning: "to need", example: "Wir brauchen einen Stift.", status: "In Progress" },
  { id: 107, verb: "geben", caseType: "Both / Common", meaning: "to give (jemandem [Dat] etwas [Akk])", example: "Ich gebe dem Kind das Buch.", status: "Mastered" },
  { id: 108, verb: "schenken", caseType: "Both / Common", meaning: "to gift (jemandem [Dat] etwas [Akk])", example: "Er schenkt ihr eine Blume.", status: "In Progress" },
];

const PATTERNS_DATA = [
  {
    article: "der",
    label: "Masculine",
    badgeClass: "bg-der",
    colorClass: "c-der",
    borderClass: "der",
    rules: [
      { ending: "-ling", rule: "Living beings or objects with qualities", examples: "der Schmetterling, der Lehrling" },
      { ending: "-or", rule: "Mostly professions / technical terms", examples: "der Motor, der Reaktor, der Autor" },
      { ending: "-ismus", rule: "Doctrines, movements, or ideologies", examples: "der Optimismus, der Realismus" },
      { ending: "-er", rule: "Male agents, nationalities, tools (most)", examples: "der Fahrer, der Lehrer, der Computer" },
      { ending: "Days & Seasons", rule: "Days of week, months, seasons, compass points", examples: "der Montag, der Juli, der Sommer, der Norden" },
    ],
  },
  {
    article: "die",
    label: "Feminine",
    badgeClass: "bg-die",
    colorClass: "c-die",
    borderClass: "die",
    rules: [
      { ending: "-ung", rule: "Action or state nouns from verbs (almost 100%)", examples: "die Zeitung, die Hoffnung, die Wohnung" },
      { ending: "-heit / -keit", rule: "Abstract qualities or traits", examples: "die Freiheit, die Schönheit, die Möglichkeit" },
      { ending: "-schaft", rule: "Collectives, relationships, conditions", examples: "die Freundschaft, die Mannschaft" },
      { ending: "-tät / -ion", rule: "Words of Latin origin", examples: "die Universität, die Station, die Nation" },
      { ending: "-in", rule: "Female job titles and roles", examples: "die Ärztin, die Lehrerin, die Studentin" },
    ],
  },
  {
    article: "das",
    label: "Neuter",
    badgeClass: "bg-das",
    colorClass: "c-das",
    borderClass: "das",
    rules: [
      { ending: "-chen / -lein", rule: "Diminutives (small things/affectionate)", examples: "das Mädchen, das Brötchen, das Fräulein" },
      { ending: "-ment", rule: "Objects, concepts of French/Latin origin", examples: "das Instrument, das Dokument, das Experiment" },
      { ending: "-um", rule: "Latin origin nouns", examples: "das Zentrum, das Museum, das Datum" },
      { ending: "-tum", rule: "States, properties (most)", examples: "das Eigentum, das Wachstum" },
      { ending: "Verbal Nouns", rule: "Infinitive verbs used as nouns", examples: "das Essen, das Leben, das Schwimmen" },
    ],
  },
];

const PATTERN_FLASHCARDS = PATTERNS_DATA.flatMap((cat) =>
  cat.rules.map((r, i) => ({
    id: `${cat.article}-${i}`,
    ending: r.ending,
    article: cat.article,
    gender: cat.label,
    rule: r.rule,
    examples: r.examples,
  }))
);

// ---------- IndexedDB helpers ----------
function openVaultDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(VERBS_STORE_NAME)) db.createObjectStore(VERBS_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadFromVaultDB(storeName, key) {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const getReq = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
    getReq.onsuccess = () => resolve(getReq.result || null);
    getReq.onerror = () => reject(getReq.error);
  });
}

async function writeToVaultDB(storeName, key, data) {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const putReq = db.transaction(storeName, "readwrite").objectStore(storeName).put(data, key);
    putReq.onsuccess = () => resolve(true);
    putReq.onerror = () => reject(putReq.error);
  });
}

// ---------- Styles ----------
const CSS = `
:root {
  --bg: #f8fafc; --card: #ffffff; --line: #eef2f6; --line-2: #e2e8f0;
  --ink: #0f172a; --ink-2: #1e293b; --muted: #64748b; --faint: #94a3b8;
  --brand: #4f46e5;
  --der: #0284c7; --der-bg: #e0f2fe;
  --die: #db2777; --die-bg: #fce7f3;
  --das: #16a34a; --das-bg: #dcfce7;
  --dativ: #7c3aed; --dativ-bg: #ede9fe;
  --akku: #ea580c; --akku-bg: #ffedd5;
  --both: #0891b2; --both-bg: #cffafe;
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
.title { font-size: 21px; font-weight: 700; margin: 0; color: var(--ink); }
.badge { font-size: 11px; background: #dcfce7; color: #166534; padding: 3px 8px; border-radius: 6px; font-weight: 600; white-space: nowrap; }
.subtitle { font-size: 13px; color: var(--muted); margin: 6px 0 0; overflow-wrap: anywhere; }
.header-actions { display: flex; gap: 10px; align-items: center; }

.btn { border-radius: 8px; padding: 10px 16px; font-weight: 600; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; min-height: 40px; }
.btn-primary { background: var(--brand); color: #fff; border: none; }
.btn-secondary { background: #fff; color: #334155; border: 1px solid #cbd5e1; }
.btn[disabled] { opacity: .45; cursor: not-allowed; }
.fab { display: none; }

/* Vault Overview Grid */
.vault-overview { display: flex; flex-direction: column; gap: 18px; }
.vault-section-title { font-size: 13px; font-weight: 700; color: var(--muted); letter-spacing: .6px; text-transform: uppercase; margin-bottom: 8px; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }

.stat { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px; min-height: 105px;
  display: flex; flex-direction: column; justify-content: space-between; }
.stat.dark { background: var(--ink); border-color: var(--ink); color: #fff; }
.stat-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.stat-label { font-size: 11px; font-weight: 700; color: var(--muted); letter-spacing: .6px; }
.stat.dark .stat-label { color: var(--faint); }
.stat-pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.stat-pill.dark { background: var(--ink-2); color: #38bdf8; font-weight: 600; }
.stat-foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 14px; }
.stat-value { font-size: 28px; font-weight: 700; line-height: 1; }
.stat-note { font-size: 12px; font-weight: 600; }

.c-der { color: var(--der); } .c-die { color: var(--die); } .c-das { color: var(--das); }
.c-dativ { color: var(--dativ); } .c-akku { color: var(--akku); } .c-both { color: var(--both); }

.bg-der { background: var(--der-bg); color: var(--der); }
.bg-die { background: var(--die-bg); color: var(--die); }
.bg-das { background: var(--das-bg); color: var(--das); }
.bg-dativ { background: var(--dativ-bg); color: var(--dativ); }
.bg-akku { background: var(--akku-bg); color: var(--akku); }
.bg-both { background: var(--both-bg); color: var(--both); }

/* Tabs */
.tab-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.tabs { display: flex; gap: 4px; background: var(--line-2); padding: 4px; border-radius: 10px; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
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
.filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.filters-label { font-size: 12px; color: var(--muted); font-weight: 600; margin-right: 4px; }
.chip { border: 1px solid; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; white-space: nowrap; min-height: 34px; }
.chip.all  { background: #f8fafc; color: #475569; border-color: var(--line-2); }
.chip.der  { background: #f0f9ff; color: var(--der); border-color: #bae6fd; }
.chip.die  { background: #fdf2f8; color: var(--die); border-color: #fbcfe8; }
.chip.das  { background: #f0fdf4; color: var(--das); border-color: #bbf7d0; }
.chip.dativ { background: var(--dativ-bg); color: var(--dativ); border-color: #ddd6fe; }
.chip.akku { background: var(--akku-bg); color: var(--akku); border-color: #fed7aa; }
.chip.both { background: var(--both-bg); color: var(--both); border-color: #a5f3fc; }
.chip.all.on { background: var(--ink); color: #fff; border-color: var(--ink); }
.chip.der.on { background: var(--der); color: #fff; border-color: var(--der); }
.chip.die.on { background: var(--die); color: #fff; border-color: var(--die); }
.chip.das.on { background: var(--das); color: #fff; border-color: var(--das); }
.chip.dativ.on { background: var(--dativ); color: #fff; border-color: var(--dativ); }
.chip.akku.on { background: var(--akku); color: #fff; border-color: var(--akku); }
.chip.both.on { background: var(--both); color: #fff; border-color: var(--both); }

/* List */
.list { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 8px 16px 16px; }
.list-head, .row { display: grid; grid-template-columns: 44px 110px minmax(0,1.4fr) minmax(0,1.2fr) minmax(0,1.6fr) 130px 110px; gap: 12px; align-items: center; }
.nouns-head, .noun-row { grid-template-columns: 44px 90px minmax(0,1.6fr) minmax(0,1.2fr) 140px 120px; }
.list-head { padding: 12px 8px; font-size: 11px; font-weight: 700; color: var(--faint); letter-spacing: .5px; border-bottom: 1px solid var(--line); }
.row { padding: 14px 8px; border-bottom: 1px solid var(--line); font-size: 13px; }
.row:last-child { border-bottom: none; }
.c-idx { text-align: center; color: var(--faint); font-weight: 500; }
.noun-wrap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pill { padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block; }
.gender { color: var(--faint); font-size: 12px; font-weight: 500; }
.c-mean { color: var(--ink-2); font-weight: 600; }
.c-eg { color: var(--muted); font-size: 12px; font-style: italic; }
.status { border: 1px solid; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.status.done { background: #f0fdf4; border-color: #86efac; color: var(--das); }
.status.todo { background: #f8fafc; border-color: #cbd5e1; color: var(--muted); }
.actions { display: flex; gap: 6px; justify-content: flex-end; }
.icon-btn { width: 36px; height: 36px; min-width: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; background: #f8fafc; border: 1px solid var(--line-2); border-radius: 8px; }
.empty { text-align: center; padding: 36px; color: var(--faint); }

/* Patterns Tab */
.patterns-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.pattern-col { background: var(--card); border: 1px solid var(--line); border-top: 4px solid transparent; border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.pattern-col.der { border-top-color: var(--der); }
.pattern-col.die { border-top-color: var(--die); }
.pattern-col.das { border-top-color: var(--das); }
.pattern-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.pattern-header h3 { margin: 0; font-size: 18px; }
.pattern-card { background: #f8fafc; border: 1px solid var(--line-2); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.pattern-badge { align-self: flex-start; font-weight: 700; font-size: 13px; font-family: monospace; padding: 3px 8px; border-radius: 6px; }
.pattern-rule { font-size: 12.5px; color: var(--ink-2); font-weight: 500; margin: 0; }
.pattern-eg { font-size: 12px; color: var(--muted); font-style: italic; margin: 0; }

/* Panels & Flashcards */
.panel { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 40px 24px; text-align: center; }
.flash-mode-toggle { display: inline-flex; background: var(--line-2); padding: 4px; border-radius: 10px; margin-bottom: 24px; gap: 4px; }
.mode-btn { border: none; padding: 6px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--muted); background: transparent; }
.mode-btn.active { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.flash-wrap { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.flash { width: min(440px, 100%); min-height: 240px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 24px; cursor: pointer; user-select: none; }
.flash h2 { font-size: 42px; margin: 16px 0; overflow-wrap: anywhere; color: var(--ink); font-weight: 700; }
.flash-controls { display: flex; gap: 12px; align-items: center; }

/* Quiz */
.quiz { max-width: 440px; margin: 0 auto; text-align: center; }
.quiz-head { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; font-weight: 600; color: var(--muted); }
.quiz-card { background: #f8fafc; padding: 28px; border-radius: 14px; border: 1px solid var(--line-2); }
.quiz-card h1 { font-size: 38px; margin: 14px 0 8px; overflow-wrap: anywhere; color: var(--ink); font-weight: 700; }
.quiz-opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
.quiz-opt { color: #fff; border: none; padding: 14px; border-radius: 10px; font-size: 16px; font-weight: 700; min-height: 48px; }
.quiz-opt.der { background: var(--der); } .quiz-opt.die { background: var(--die); } .quiz-opt.das { background: var(--das); }
.quiz-opt[disabled] { opacity: .6; }

/* Modal */
.overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 16px; }
.modal { background: #fff; border-radius: 14px; padding: 28px; width: 100%; max-width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,.1); max-height: 100%; overflow-y: auto; }
.modal h3 { margin: 0 0 16px; font-size: 18px; color: var(--ink); }
.modal form { display: flex; flex-direction: column; gap: 16px; }
.modal-label { font-size: 12px; font-weight: 600; color: #475569; }
.modal-input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 15px; margin-top: 6px; background: #fff; min-height: 42px; }
.radios { display: flex; gap: 8px; margin-top: 6px; }
.radio { flex: 1; text-align: center; padding: 10px 8px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; background: #f1f5f9; color: #334155; }
.radio.on { background: var(--ink); color: #fff; }
.radio input { display: none; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }

/* ================= TABLET ================= */
@media (max-width: 1024px) {
  .page { padding: 20px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .patterns-grid { grid-template-columns: 1fr; }
  .help { display: none; }
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

  .vault-overview { gap: 14px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .stat { padding: 12px 14px; min-height: 0; border-radius: 12px; }
  .stat-foot { margin-top: 8px; }
  .stat-value { font-size: 24px; }
  .stat-note { display: none; }
  .stat-label { font-size: 10px; }
  .stat-pill { font-size: 10px; padding: 2px 8px; }

  .tab-row { gap: 0; }
  .tabs { width: 100%; }
  .tab { flex: 1; padding: 10px 6px; font-size: 12px; }
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
  
  .noun-row { background: #fff; border: 1px solid var(--line); border-left-width: 4px; border-radius: 12px; padding: 12px 14px; gap: 8px 10px;
    grid-template-columns: auto 1fr auto;
    grid-template-areas: "art noun noun" "mean mean mean" "status status actions"; }
  .noun-row.der { border-left-color: var(--der); } .noun-row.die { border-left-color: var(--die); } .noun-row.das { border-left-color: var(--das); }

  .verb-row { background: #fff; border: 1px solid var(--line); border-left-width: 4px; border-radius: 12px; padding: 12px 14px; gap: 8px 10px;
    grid-template-columns: auto 1fr auto;
    grid-template-areas: "case verb verb" "mean mean mean" "eg eg eg" "status status actions"; }
  .verb-row.Dativ { border-left-color: var(--dativ); }
  .verb-row.Akkusativ { border-left-color: var(--akku); }
  .verb-row.Both { border-left-color: var(--both); }

  .c-idx { display: none; }
  .c-art { grid-area: art; }
  .c-case { grid-area: case; }
  .c-noun { grid-area: noun; }
  .c-verb { grid-area: verb; font-size: 16px; font-weight: 700; }
  .c-mean { grid-area: mean; font-size: 14px; }
  .c-eg { grid-area: eg; font-size: 12px; }
  .c-status { grid-area: status; }
  .actions { grid-area: actions; }
  .pill { font-size: 13px; }
  .noun-wrap .pill { background: transparent !important; padding: 0; font-size: 18px; font-weight: 700; }
  .status { padding: 8px 12px; min-height: 36px; }
  .icon-btn { width: 40px; height: 40px; min-width: 40px; }

  .panel { padding: 24px 14px; }
  .flash { min-height: 210px; padding: 20px 14px; }
  .flash h2 { font-size: 32px; }
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
const VERB_CASE_CLASS = { Dativ: "bg-dativ", Akkusativ: "bg-akku", "Both / Common": "bg-both" };
const GENDER_MAP = { der: "Masculine", die: "Feminine", das: "Neuter" };

export default function App() {
  const [vocabList, setVocabList] = useState([]);
  const [verbsList, setVerbsList] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [isPersisted, setIsPersisted] = useState(false);

  const [activeTab, setActiveTab] = useState("Nouns");
  const [search, setSearch] = useState("");
  const [articleFilter, setArticleFilter] = useState("all");
  const [verbFilter, setVerbFilter] = useState("all");

  // Nouns Modal
  const [nounModalOpen, setNounModalOpen] = useState(false);
  const [editingNounId, setEditingNounId] = useState(null);
  const [nounFormData, setNounFormData] = useState({ noun: "", article: "der", meaning: "", status: "In Progress" });

  // Verbs Modal
  const [verbModalOpen, setVerbModalOpen] = useState(false);
  const [editingVerbId, setEditingVerbId] = useState(null);
  const [verbFormData, setVerbFormData] = useState({ verb: "", caseType: "Dativ", meaning: "", example: "", status: "In Progress" });

  // Quiz
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);

  // Flashcards
  const [flashcardMode, setFlashcardMode] = useState("nouns");
  const [cardIndex, setCardIndex] = useState(0);
  const [patternCardIndex, setPatternCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  useEffect(() => {
    async function initVault() {
      if (navigator.storage && navigator.storage.persist) {
        const persisted = await navigator.storage.persist();
        setIsPersisted(persisted);
      }
      try {
        const storedVocab = await loadFromVaultDB(STORE_NAME, BACKUP_KEY);
        if (storedVocab && Array.isArray(storedVocab) && storedVocab.length > 0) {
          setVocabList(storedVocab);
        } else {
          await writeToVaultDB(STORE_NAME, BACKUP_KEY, SEED_DATA);
          setVocabList(SEED_DATA);
        }

        const storedVerbs = await loadFromVaultDB(VERBS_STORE_NAME, VERBS_BACKUP_KEY);
        if (storedVerbs && Array.isArray(storedVerbs) && storedVerbs.length > 0) {
          setVerbsList(storedVerbs);
        } else {
          await writeToVaultDB(VERBS_STORE_NAME, VERBS_BACKUP_KEY, SEED_VERBS);
          setVerbsList(SEED_VERBS);
        }
      } catch (err) {
        console.error("IndexedDB load error, fallback to memory:", err);
        setVocabList(SEED_DATA);
        setVerbsList(SEED_VERBS);
      } finally {
        setIsReady(true);
      }
    }
    initVault();
  }, []);

  const commitNouns = async (newList) => {
    setVocabList(newList);
    setCardIndex((i) => Math.min(i, Math.max(newList.length - 1, 0)));
    setQuizIndex((i) => Math.min(i, Math.max(newList.length - 1, 0)));
    try {
      await writeToVaultDB(STORE_NAME, BACKUP_KEY, newList);
    } catch (e) {
      console.error("Failed writing nouns:", e);
    }
  };

  const commitVerbs = async (newList) => {
    setVerbsList(newList);
    try {
      await writeToVaultDB(VERBS_STORE_NAME, VERBS_BACKUP_KEY, newList);
    } catch (e) {
      console.error("Failed writing verbs:", e);
    }
  };

  const handleToggleNounStatus = (id) => {
    commitNouns(
      vocabList.map((item) =>
        item.id === id ? { ...item, status: item.status === "Mastered" ? "In Progress" : "Mastered" } : item
      )
    );
  };

  const handleDeleteNoun = (id) => {
    if (window.confirm("Delete this noun permanently?")) {
      commitNouns(vocabList.filter((item) => item.id !== id));
    }
  };

  const handleSaveNounModal = (e) => {
    e.preventDefault();
    if (!nounFormData.noun.trim() || !nounFormData.meaning.trim()) return;
    const gender = GENDER_MAP[nounFormData.article];
    const updated = editingNounId
      ? vocabList.map((item) => (item.id === editingNounId ? { ...item, ...nounFormData, gender } : item))
      : [...vocabList, { id: Date.now(), ...nounFormData, gender }];
    commitNouns(updated);
    setNounModalOpen(false);
  };

  const handleToggleVerbStatus = (id) => {
    commitVerbs(
      verbsList.map((item) =>
        item.id === id ? { ...item, status: item.status === "Mastered" ? "In Progress" : "Mastered" } : item
      )
    );
  };

  const handleDeleteVerb = (id) => {
    if (window.confirm("Delete this verb permanently?")) {
      commitVerbs(verbsList.filter((item) => item.id !== id));
    }
  };

  const handleSaveVerbModal = (e) => {
    e.preventDefault();
    if (!verbFormData.verb.trim() || !verbFormData.meaning.trim()) return;
    const updated = editingVerbId
      ? verbsList.map((item) => (item.id === editingVerbId ? { ...item, ...verbFormData } : item))
      : [...verbsList, { id: Date.now(), ...verbFormData }];
    commitVerbs(updated);
    setVerbModalOpen(false);
  };

  const speakGerman = (phrase) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = "de-DE";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  if (!isReady) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading German Vault...</div>;
  }

  const filteredNouns = vocabList.filter((item) => {
    const q = search.toLowerCase();
    return (
      (articleFilter === "all" || item.article === articleFilter) &&
      (item.noun.toLowerCase().includes(q) || item.meaning.toLowerCase().includes(q))
    );
  });

  const filteredVerbs = verbsList.filter((item) => {
    const q = search.toLowerCase();
    return (
      (verbFilter === "all" || item.caseType === verbFilter) &&
      (item.verb.toLowerCase().includes(q) || item.meaning.toLowerCase().includes(q) || item.example.toLowerCase().includes(q))
    );
  });

  const tabs = [
    { id: "Nouns", icon: "📑", short: "Nouns" },
    { id: "Verbs", icon: "⚡", short: "Verbs" },
    { id: "Patterns", icon: "📐", short: "Patterns" },
    { id: "Flashcards", icon: "🎴", short: "Cards" },
    { id: "Article Quiz", icon: "✨", short: "Quiz" },
  ];

  // Nouns stats
  const nounsMastered = vocabList.filter((i) => i.status === "Mastered").length;
  const countNoun = (art) => vocabList.filter((i) => i.article === art).length;

  // Verbs stats
  const verbsMastered = verbsList.filter((i) => i.status === "Mastered").length;
  const countVerb = (c) => verbsList.filter((i) => i.caseType === c).length;

  const card = vocabList[cardIndex];
  const patternCard = PATTERN_FLASHCARDS[patternCardIndex];
  const quizWord = vocabList[quizIndex];

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
                <h1 className="title">German Vocabulary Vault</h1>
                <span className="badge">{isPersisted ? "🔒 Eviction-Proof" : "💾 Auto-Protected"}</span>
              </div>
              <p className="subtitle">Master genders, patterns, and case-governed verbs.</p>
            </div>
          </div>

          <div className="header-actions">
            {activeTab === "Verbs" ? (
              <button
                onClick={() => {
                  setEditingVerbId(null);
                  setVerbFormData({ verb: "", caseType: "Dativ", meaning: "", example: "", status: "In Progress" });
                  setVerbModalOpen(true);
                }}
                className="btn btn-primary"
              >
                + Add Verb
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditingNounId(null);
                  setNounFormData({ noun: "", article: "der", meaning: "", status: "In Progress" });
                  setNounModalOpen(true);
                }}
                className="btn btn-primary"
              >
                + Add Noun
              </button>
            )}
          </div>
        </header>

        {/* VAULT OVERVIEW: Nouns + Verbs Together */}
        <section className="vault-overview">
          {/* Row 1: Nouns Summary */}
          <div>
            <div className="vault-section-title">Nouns Overview (Genders)</div>
            <div className="stats-grid">
              <div className="stat dark">
                <div className="stat-head">
                  <span className="stat-label">TOTAL NOUNS</span>
                  <span className="stat-pill dark">{nounsMastered} mastered</span>
                </div>
                <div className="stat-foot">
                  <span className="stat-value">{vocabList.length}</span>
                  <span className="stat-note" style={{ color: "#94a3b8", fontWeight: 500 }}>3 genders</span>
                </div>
              </div>

              <div className="stat">
                <div className="stat-head">
                  <span className="stat-label">MASCULINE</span>
                  <span className="stat-pill bg-der">der</span>
                </div>
                <div className="stat-foot">
                  <span className="stat-value c-der">{countNoun("der")}</span>
                  <span className="stat-note c-der">Blue highlight</span>
                </div>
              </div>

              <div className="stat">
                <div className="stat-head">
                  <span className="stat-label">FEMININE</span>
                  <span className="stat-pill bg-die">die</span>
                </div>
                <div className="stat-foot">
                  <span className="stat-value c-die">{countNoun("die")}</span>
                  <span className="stat-note c-die">Pink highlight</span>
                </div>
              </div>

              <div className="stat">
                <div className="stat-head">
                  <span className="stat-label">NEUTER</span>
                  <span className="stat-pill bg-das">das</span>
                </div>
                <div className="stat-foot">
                  <span className="stat-value c-das">{countNoun("das")}</span>
                  <span className="stat-note c-das">Green highlight</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Verbs Summary */}
          <div>
            <div className="vault-section-title">Verbs Overview (Grammatical Cases)</div>
            <div className="stats-grid">
              <div className="stat dark">
                <div className="stat-head">
                  <span className="stat-label">TOTAL VERBS</span>
                  <span className="stat-pill dark">{verbsMastered} mastered</span>
                </div>
                <div className="stat-foot">
                  <span className="stat-value">{verbsList.length}</span>
                  <span className="stat-note" style={{ color: "#94a3b8", fontWeight: 500 }}>case governed</span>
                </div>
              </div>

              <div className="stat">
                <div className="stat-head">
                  <span className="stat-label">DATIV VERBS</span>
                  <span className="stat-pill bg-dativ">Dativ</span>
                </div>
                <div className="stat-foot">
                  <span className="stat-value c-dativ">{countVerb("Dativ")}</span>
                  <span className="stat-note c-dativ">+ Dativ object</span>
                </div>
              </div>

              <div className="stat">
                <div className="stat-head">
                  <span className="stat-label">AKKUSATIV VERBS</span>
                  <span className="stat-pill bg-akku">Akkusativ</span>
                </div>
                <div className="stat-foot">
                  <span className="stat-value c-akku">{countVerb("Akkusativ")}</span>
                  <span className="stat-note c-akku">+ Akkusativ object</span>
                </div>
              </div>

              <div className="stat">
                <div className="stat-head">
                  <span className="stat-label">BOTH / COMMON</span>
                  <span className="stat-pill bg-both">Both</span>
                </div>
                <div className="stat-foot">
                  <span className="stat-value c-both">{countVerb("Both / Common")}</span>
                  <span className="stat-note c-both">Dat (person) + Akk</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs Row */}
        <div className="tab-row">
          <div className="tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => { setActiveTab(tab.id); setSearch(""); }}
                className={`tab ${activeTab === tab.id ? "active" : ""}`}
              >
                <span>{tab.icon}</span>
                <span className="full">{tab.id}</span>
                <span className="short">{tab.short}</span>
              </button>
            ))}
          </div>
          <span className="help">* Instant autosave enabled on all additions &amp; edits</span>
        </div>

        {/* VIEW 1: Nouns */}
        {activeTab === "Nouns" && (
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

              <div className="filters">
                <span className="filters-label">Filter:</span>
                <button onClick={() => setArticleFilter("all")} className={`chip all ${articleFilter === "all" ? "on" : ""}`}>
                  All ({vocabList.length})
                </button>
                {["der", "die", "das"].map((a) => (
                  <button key={a} onClick={() => setArticleFilter(a)} className={`chip ${a} ${articleFilter === a ? "on" : ""}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="list">
              <div className="list-head nouns-head">
                <span style={{ textAlign: "center" }}>#</span>
                <span>ARTICLE</span>
                <span>GERMAN NOUN</span>
                <span>ENGLISH MEANING</span>
                <span>STATUS</span>
                <span style={{ textAlign: "right" }}>ACTIONS</span>
              </div>

              {filteredNouns.length === 0 ? (
                <div className="empty">No nouns found.</div>
              ) : (
                filteredNouns.map((item, index) => (
                  <div className={`row noun-row ${item.article}`} key={item.id}>
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
                        onClick={() => handleToggleNounStatus(item.id)}
                        className={`status ${item.status === "Mastered" ? "done" : "todo"}`}
                      >
                        {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                      </button>
                    </div>
                    <div className="actions">
                      <button onClick={() => speakGerman(`${item.article} ${item.noun}`)} className="icon-btn" title="Listen">🔊</button>
                      <button
                        onClick={() => {
                          setEditingNounId(item.id);
                          setNounFormData({ noun: item.noun, article: item.article, meaning: item.meaning, status: item.status });
                          setNounModalOpen(true);
                        }}
                        className="icon-btn"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button onClick={() => handleDeleteNoun(item.id)} className="icon-btn" title="Delete">🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: Verbs */}
        {activeTab === "Verbs" && (
          <div className="section">
            <div className="toolbar">
              <div className="search">
                <span>🔍</span>
                <input
                  type="search"
                  placeholder="Search verb, meaning, or example..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="filters">
                <span className="filters-label">Case:</span>
                <button onClick={() => setVerbFilter("all")} className={`chip all ${verbFilter === "all" ? "on" : ""}`}>
                  All ({verbsList.length})
                </button>
                <button onClick={() => setVerbFilter("Dativ")} className={`chip dativ ${verbFilter === "Dativ" ? "on" : ""}`}>
                  Dativ (+Dat)
                </button>
                <button onClick={() => setVerbFilter("Akkusativ")} className={`chip akku ${verbFilter === "Akkusativ" ? "on" : ""}`}>
                  Akkusativ (+Akk)
                </button>
                <button onClick={() => setVerbFilter("Both / Common")} className={`chip both ${verbFilter === "Both / Common" ? "on" : ""}`}>
                  Both / Common
                </button>
              </div>
            </div>

            <div className="list">
              <div className="list-head">
                <span style={{ textAlign: "center" }}>#</span>
                <span>CASE</span>
                <span>GERMAN VERB</span>
                <span>MEANING</span>
                <span>EXAMPLE SENTENCE</span>
                <span>STATUS</span>
                <span style={{ textAlign: "right" }}>ACTIONS</span>
              </div>

              {filteredVerbs.length === 0 ? (
                <div className="empty">No verbs found.</div>
              ) : (
                filteredVerbs.map((item, index) => (
                  <div className={`row verb-row ${item.caseType === "Both / Common" ? "Both" : item.caseType}`} key={item.id}>
                    <div className="c-idx">{index + 1}</div>
                    <div className="c-case">
                      <span className={`pill ${VERB_CASE_CLASS[item.caseType] || "bg-both"}`}>{item.caseType}</span>
                    </div>
                    <div className="c-verb">{item.verb}</div>
                    <div className="c-mean">{item.meaning}</div>
                    <div className="c-eg">{item.example || "—"}</div>
                    <div className="c-status">
                      <button
                        onClick={() => handleToggleVerbStatus(item.id)}
                        className={`status ${item.status === "Mastered" ? "done" : "todo"}`}
                      >
                        {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                      </button>
                    </div>
                    <div className="actions">
                      <button onClick={() => speakGerman(`${item.verb}. ${item.example || ""}`)} className="icon-btn" title="Listen">🔊</button>
                      <button
                        onClick={() => {
                          setEditingVerbId(item.id);
                          setVerbFormData({ verb: item.verb, caseType: item.caseType, meaning: item.meaning, example: item.example, status: item.status });
                          setVerbModalOpen(true);
                        }}
                        className="icon-btn"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button onClick={() => handleDeleteVerb(item.id)} className="icon-btn" title="Delete">🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: Patterns */}
        {activeTab === "Patterns" && (
          <div className="patterns-grid">
            {PATTERNS_DATA.map((cat) => (
              <div key={cat.article} className={`pattern-col ${cat.borderClass}`}>
                <div className="pattern-header">
                  <div>
                    <h3 className={cat.colorClass}>{cat.label} Rules</h3>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Category patterns</span>
                  </div>
                  <span className={`stat-pill ${cat.badgeClass}`}>{cat.article}</span>
                </div>

                {cat.rules.map((rule, idx) => (
                  <div key={idx} className="pattern-card">
                    <span className={`pattern-badge ${cat.badgeClass}`}>{rule.ending}</span>
                    <p className="pattern-rule">{rule.rule}</p>
                    <p className="pattern-eg">e.g. {rule.examples}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* VIEW 4: Flashcards */}
        {activeTab === "Flashcards" && (
          <div className="panel">
            <div className="flash-mode-toggle">
              <button
                className={`mode-btn ${flashcardMode === "nouns" ? "active" : ""}`}
                onClick={() => { setFlashcardMode("nouns"); setCardFlipped(false); }}
              >
                📑 Nouns ({vocabList.length})
              </button>
              <button
                className={`mode-btn ${flashcardMode === "patterns" ? "active" : ""}`}
                onClick={() => { setFlashcardMode("patterns"); setCardFlipped(false); }}
              >
                📐 Suffixes &amp; Patterns ({PATTERN_FLASHCARDS.length})
              </button>
            </div>

            {flashcardMode === "nouns" ? (
              !card ? (
                <p style={{ color: "#64748b" }}>No vocabulary available.</p>
              ) : (
                <div className="flash-wrap">
                  <div className="flash" onClick={() => setCardFlipped(!cardFlipped)}>
                    {!cardFlipped ? (
                      <>
                        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>GUESS ARTICLE &amp; MEANING</span>
                        <h2 style={{ color: "var(--ink)" }}>{card.noun}</h2>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>(Tap to flip)</span>
                      </>
                    ) : (
                      <>
                        <span className={`pill ${ARTICLE_CLASS[card.article]}`} style={{ fontSize: 22, padding: "6px 20px" }}>
                          {card.article} {card.noun}
                        </span>
                        <h3 style={{ fontSize: 24, margin: "14px 0 6px", color: "var(--ink-2)" }}>{card.meaning}</h3>
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
                    <button className="btn btn-secondary mid" onClick={() => speakGerman(`${card.article} ${card.noun}`)}>
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
              )
            ) : (
              !patternCard ? (
                <p style={{ color: "#64748b" }}>No patterns available.</p>
              ) : (
                <div className="flash-wrap">
                  <div className="flash" onClick={() => setCardFlipped(!cardFlipped)}>
                    {!cardFlipped ? (
                      <>
                        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>WHICH ARTICLE BELONGS TO THIS PATTERN?</span>
                        <h2 style={{ fontFamily: "monospace", color: "var(--ink)" }}>{patternCard.ending}</h2>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>(Tap to reveal gender &amp; rules)</span>
                      </>
                    ) : (
                      <>
                        <span className={`pill ${ARTICLE_CLASS[patternCard.article]}`} style={{ fontSize: 22, padding: "6px 22px" }}>
                          {patternCard.article} ({patternCard.gender})
                        </span>
                        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-2)", margin: "14px 0 6px" }}>
                          {patternCard.rule}
                        </p>
                        <p style={{ fontSize: 13, color: "#64748b", margin: 0, fontStyle: "italic" }}>
                          e.g. {patternCard.examples}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flash-controls">
                    <button
                      className="btn btn-secondary"
                      disabled={patternCardIndex === 0}
                      onClick={() => { setPatternCardIndex(patternCardIndex - 1); setCardFlipped(false); }}
                    >
                      ◀ Previous
                    </button>
                    <button className="btn btn-secondary mid" onClick={() => speakGerman(patternCard.examples)}>
                      🔊 Hear Examples
                    </button>
                    <button
                      className="btn btn-secondary"
                      disabled={patternCardIndex >= PATTERN_FLASHCARDS.length - 1}
                      onClick={() => { setPatternCardIndex(patternCardIndex + 1); setCardFlipped(false); }}
                    >
                      Next ▶
                    </button>
                  </div>
                  <span style={{ color: "#64748b", fontSize: 13 }}>
                    Pattern {patternCardIndex + 1} of {PATTERN_FLASHCARDS.length}
                  </span>
                </div>
              )
            )}
          </div>
        )}

        {/* VIEW 5: Quiz */}
        {activeTab === "Article Quiz" && (
          <div className="panel">
            {!quizWord ? (
              <p style={{ color: "#64748b" }}>Add words to practice quiz.</p>
            ) : (
              <div className="quiz">
                <div className="quiz-head">
                  <span>Question {quizIndex + 1} of {vocabList.length}</span>
                  <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {quizScore}</span>
                </div>

                <div className="quiz-card">
                  <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Choose the correct article:</span>
                  <h1 style={{ color: "var(--ink)" }}>{quizWord.noun}</h1>
                  <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>
                    Meaning: <strong style={{ color: "var(--ink-2)" }}>{quizWord.meaning}</strong>
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
      </div>

      {/* Floating Action Button (Mobile) */}
      {!nounModalOpen && !verbModalOpen && (
        <button
          onClick={() => {
            if (activeTab === "Verbs") {
              setEditingVerbId(null);
              setVerbFormData({ verb: "", caseType: "Dativ", meaning: "", example: "", status: "In Progress" });
              setVerbModalOpen(true);
            } else {
              setEditingNounId(null);
              setNounFormData({ noun: "", article: "der", meaning: "", status: "In Progress" });
              setNounModalOpen(true);
            }
          }}
          className="btn btn-primary fab"
          aria-label="Add item"
        >
          {activeTab === "Verbs" ? "+ Add Verb" : "+ Add Noun"}
        </button>
      )}

      {/* Modal: Add/Edit Noun */}
      {nounModalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setNounModalOpen(false)}>
          <div className="modal">
            <h3>{editingNounId ? "Edit Noun" : "Add New Noun"}</h3>
            <form onSubmit={handleSaveNounModal}>
              <div>
                <label className="modal-label">Article (Gender)</label>
                <div className="radios">
                  {["der", "die", "das"].map((art) => (
                    <label key={art} className={`radio ${nounFormData.article === art ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="article"
                        value={art}
                        checked={nounFormData.article === art}
                        onChange={(e) => setNounFormData({ ...nounFormData, article: e.target.value })}
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
                  value={nounFormData.noun}
                  onChange={(e) => setNounFormData({ ...nounFormData, noun: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">English Meaning</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. Apple"
                  value={nounFormData.meaning}
                  onChange={(e) => setNounFormData({ ...nounFormData, meaning: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Status</label>
                <select
                  className="modal-input"
                  value={nounFormData.status}
                  onChange={(e) => setNounFormData({ ...nounFormData, status: e.target.value })}
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Mastered">Mastered</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setNounModalOpen(false)} className="btn btn-secondary" style={{ border: "none" }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Save Noun</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Verb */}
      {verbModalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setVerbModalOpen(false)}>
          <div className="modal">
            <h3>{editingVerbId ? "Edit Verb" : "Add New Verb"}</h3>
            <form onSubmit={handleSaveVerbModal}>
              <div>
                <label className="modal-label">Grammatical Case</label>
                <div className="radios">
                  {["Dativ", "Akkusativ", "Both / Common"].map((c) => (
                    <label key={c} className={`radio ${verbFormData.caseType === c ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="caseType"
                        value={c}
                        checked={verbFormData.caseType === c}
                        onChange={(e) => setVerbFormData({ ...verbFormData, caseType: e.target.value })}
                      />
                      {c === "Both / Common" ? "Both" : c}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="modal-label">Infinitive Verb</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. helfen, sehen"
                  value={verbFormData.verb}
                  onChange={(e) => setVerbFormData({ ...verbFormData, verb: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">English Meaning</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. to help (+ Dat)"
                  value={verbFormData.meaning}
                  onChange={(e) => setVerbFormData({ ...verbFormData, meaning: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Example Sentence</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. Ich helfe dir."
                  value={verbFormData.example}
                  onChange={(e) => setVerbFormData({ ...verbFormData, example: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Status</label>
                <select
                  className="modal-input"
                  value={verbFormData.status}
                  onChange={(e) => setVerbFormData({ ...verbFormData, status: e.target.value })}
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Mastered">Mastered</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setVerbModalOpen(false)} className="btn btn-secondary" style={{ border: "none" }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Save Verb</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}