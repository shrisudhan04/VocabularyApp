import { useState, useEffect } from "react";
import "./App.css";

const DB_NAME = "GermanVocabVault";
const DB_VERSION = 4;
const STORE_NAME = "vocabulary_store";
const VERBS_STORE_NAME = "verbs_store";
const PATTERNS_STORE_NAME = "patterns_store";
const PREPOSITIONS_STORE_NAME = "prepositions_store";

const BACKUP_KEY = "current_vocab_data";
const VERBS_BACKUP_KEY = "current_verbs_data";
const PATTERNS_BACKUP_KEY = "current_patterns_data";
const PREPOSITIONS_BACKUP_KEY = "current_prepositions_data";

const SEED_DATA = [
  { id: 1, article: "der", noun: "Mann", plural: "die Männer", gender: "Masculine", meaning: "Male / Man", status: "Mastered" },
  { id: 2, article: "die", noun: "Frau", plural: "die Frauen", gender: "Feminine", meaning: "Woman / Wife", status: "In Progress" },
  { id: 3, article: "das", noun: "Kind", plural: "die Kinder", gender: "Neuter", meaning: "Child", status: "In Progress" },
  { id: 4, article: "der", noun: "Tisch", plural: "die Tische", gender: "Masculine", meaning: "Table", status: "Mastered" },
  { id: 5, article: "die", noun: "Sonne", plural: "die Sonnen", gender: "Feminine", meaning: "Sun", status: "Mastered" },
  { id: 6, article: "das", noun: "Buch", plural: "die Bücher", gender: "Neuter", meaning: "Book", status: "In Progress" },
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

const SEED_PATTERNS = [
  { id: "p1", article: "der", ending: "-ling", rule: "Living beings or objects with qualities", examples: "der Schmetterling, der Lehrling" },
  { id: "p2", article: "der", ending: "-or", rule: "Mostly professions / technical terms", examples: "der Motor, der Reaktor, der Autor" },
  { id: "p3", article: "der", ending: "-ismus", rule: "Doctrines, movements, or ideologies", examples: "der Optimismus, der Realismus" },
  { id: "p4", article: "der", ending: "-er", rule: "Male agents, nationalities, tools (most)", examples: "der Fahrer, der Lehrer, der Computer" },
  { id: "p5", article: "der", ending: "Days & Seasons", rule: "Days of week, months, seasons, compass points", examples: "der Montag, der Juli, der Sommer, der Norden" },

  { id: "p6", article: "die", ending: "-ung", rule: "Action or state nouns from verbs (almost 100%)", examples: "die Zeitung, die Hoffnung, die Wohnung" },
  { id: "p7", article: "die", ending: "-heit / -keit", rule: "Abstract qualities or traits", examples: "die Freiheit, die Schönheit, die Möglichkeit" },
  { id: "p8", article: "die", ending: "-schaft", rule: "Collectives, relationships, conditions", examples: "die Freundschaft, die Mannschaft" },
  { id: "p9", article: "die", ending: "-tät / -ion", rule: "Words of Latin origin", examples: "die Universität, die Station, die Nation" },
  { id: "p10", article: "die", ending: "-in", rule: "Female job titles and roles", examples: "die Ärztin, die Lehrerin, die Studentin" },

  { id: "p11", article: "das", ending: "-chen / -lein", rule: "Diminutives (small things/affectionate)", examples: "das Mädchen, das Brötchen, das Fräulein" },
  { id: "p12", article: "das", ending: "-ment", rule: "Objects, concepts of French/Latin origin", examples: "das Instrument, das Dokument, das Experiment" },
  { id: "p13", article: "das", ending: "-um", rule: "Latin origin nouns", examples: "das Zentrum, das Museum, das Datum" },
  { id: "p14", article: "das", ending: "-tum", rule: "States, properties (most)", examples: "das Eigentum, das Wachstum" },
  { id: "p15", article: "das", ending: "Verbal Nouns", rule: "Infinitive verbs used as nouns", examples: "das Essen, das Leben, das Schwimmen" },
];

const SEED_PREPOSITIONS = [
  { id: 201, prep: "durch", caseType: "Akkusativ", meaning: "through", example: "Wir gehen durch den Park.", status: "Mastered" },
  { id: 202, prep: "für", caseType: "Akkusativ", meaning: "for", example: "Das Geschenk ist für dich.", status: "Mastered" },
  { id: 203, prep: "ohne", caseType: "Akkusativ", meaning: "without", example: "Ohne meinen Kaffee kann ich nicht aufstehen.", status: "Mastered" },
  { id: 204, prep: "aus", caseType: "Dativ", meaning: "out of / from", example: "Er kommt aus der Schweiz.", status: "Mastered" },
  { id: 205, prep: "mit", caseType: "Dativ", meaning: "with", example: "Ich fahre mit dem Zug.", status: "Mastered" },
  { id: 206, prep: "nach", caseType: "Dativ", meaning: "after / to (city/country)", example: "Nach der Arbeit gehe ich nach Hause.", status: "In Progress" },
  { id: 207, prep: "in", caseType: "Wechsel", meaning: "in / into (Dat: location, Akk: direction)", example: "Ich bin im Haus (Dat). Ich gehe ins Haus (Akk).", status: "Mastered" },
  { id: 208, prep: "auf", caseType: "Wechsel", meaning: "on / onto (horizontal)", example: "Das Buch liegt auf dem Tisch (Dat).", status: "In Progress" },
  { id: 209, prep: "an", caseType: "Wechsel", meaning: "at / on (vertical edge)", example: "Das Bild hängt an der Wand (Dat).", status: "In Progress" },
];

function openVaultDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(VERBS_STORE_NAME)) db.createObjectStore(VERBS_STORE_NAME);
      if (!db.objectStoreNames.contains(PATTERNS_STORE_NAME)) db.createObjectStore(PATTERNS_STORE_NAME);
      if (!db.objectStoreNames.contains(PREPOSITIONS_STORE_NAME)) db.createObjectStore(PREPOSITIONS_STORE_NAME);
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
  --wechsel: #d97706; --wechsel-bg: #fef3c7;
}
html, body, #root { margin: 0 !important; padding: 0 !important; width: 100% !important; min-height: 100vh; background: var(--bg); }
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
button, input, select, textarea { font-family: inherit; }
button { cursor: pointer; }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

.page { background: var(--bg); min-height: 100vh; width: 100%; padding: 24px 32px; display: flex; justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--ink); }
.container { width: 100%; max-width: 1400px; display: flex; flex-direction: column; gap: 20px; min-width: 0; }

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

/* Main Category Tabs */
.main-tabs-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.main-tabs { display: flex; gap: 6px; background: var(--line-2); padding: 5px; border-radius: 12px; overflow-x: auto; scrollbar-width: none; }
.main-tabs::-webkit-scrollbar { display: none; }
.main-tab { border: none; padding: 10px 20px; border-radius: 9px; font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: transparent; color: var(--muted); white-space: nowrap; }
.main-tab.active { background: #fff; color: var(--brand); box-shadow: 0 2px 5px rgba(0,0,0,.08); }

/* Sub View Switcher */
.sub-tabs-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding-bottom: 4px; }
.sub-tabs { display: inline-flex; background: #e2e8f0; padding: 4px; border-radius: 10px; gap: 4px; }
.sub-tab { border: none; padding: 7px 18px; border-radius: 8px; font-size: 12.5px; font-weight: 600; background: transparent; color: var(--muted); }
.sub-tab.active { background: var(--brand); color: #fff; box-shadow: 0 1px 3px rgba(79,70,229,.25); }

/* Stats Grid */
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
.c-dativ { color: var(--dativ); } .c-akku { color: var(--akku); } .c-both { color: var(--both); } .c-wechsel { color: var(--wechsel); }

.bg-der { background: var(--der-bg); color: var(--der); }
.bg-die { background: var(--die-bg); color: var(--die); }
.bg-das { background: var(--das-bg); color: var(--das); }
.bg-dativ { background: var(--dativ-bg); color: var(--dativ); }
.bg-akku { background: var(--akku-bg); color: var(--akku); }
.bg-both { background: var(--both-bg); color: var(--both); }
.bg-wechsel { background: var(--wechsel-bg); color: var(--wechsel); }

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
.chip.wechsel { background: var(--wechsel-bg); color: var(--wechsel); border-color: #fde68a; }

.chip.all.on { background: var(--ink); color: #fff; border-color: var(--ink); }
.chip.der.on { background: var(--der); color: #fff; border-color: var(--der); }
.chip.die.on { background: var(--die); color: #fff; border-color: var(--die); }
.chip.das.on { background: var(--das); color: #fff; border-color: var(--das); }
.chip.dativ.on { background: var(--dativ); color: #fff; border-color: var(--dativ); }
.chip.akku.on { background: var(--akku); color: #fff; border-color: var(--akku); }
.chip.both.on { background: var(--both); color: #fff; border-color: var(--both); }
.chip.wechsel.on { background: var(--wechsel); color: #fff; border-color: var(--wechsel); }

/* List Container */
.list { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 8px 16px 16px; }
.list-head { padding: 12px 8px; font-size: 11px; font-weight: 700; color: var(--faint); letter-spacing: .5px; border-bottom: 1px solid var(--line); }

/* Tight column alignment without gaping voids */
.nouns-head, .noun-row {
  display: grid;
  grid-template-columns: 48px 80px 180px 180px 1fr 140px 120px !important;
  gap: 16px;
  align-items: center;
}

.verbs-head, .verb-row {
  display: grid;
  grid-template-columns: 48px 100px 180px 200px 1fr 130px 120px !important;
  gap: 16px;
  align-items: center;
}

.preps-head, .prep-row {
  display: grid;
  grid-template-columns: 48px 110px 140px 200px 1fr 130px 120px !important;
  gap: 16px;
  align-items: center;
}

.row { padding: 14px 8px; border-bottom: 1px solid var(--line); font-size: 13px; }
.row:last-child { border-bottom: none; }
.c-idx { text-align: center; color: var(--faint); font-weight: 500; }
.noun-wrap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pill { padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block; }
.gender { color: var(--faint); font-size: 12px; font-weight: 500; }
.c-plural { color: var(--muted); font-size: 13px; font-style: italic; }
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
.pattern-card { background: #f8fafc; border: 1px solid var(--line-2); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; position: relative; }
.pattern-card-top { display: flex; justify-content: space-between; align-items: center; }
.pattern-badge { align-self: flex-start; font-weight: 700; font-size: 13px; font-family: monospace; padding: 3px 8px; border-radius: 6px; }
.pattern-delete-btn { background: none; border: none; font-size: 13px; opacity: .5; padding: 2px; }
.pattern-delete-btn:hover { opacity: 1; }
.pattern-rule { font-size: 12.5px; color: var(--ink-2); font-weight: 500; margin: 0; }
.pattern-eg { font-size: 12px; color: var(--muted); font-style: italic; margin: 0; }

/* Panels */
.panel { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 48px 24px; text-align: center; }
.flash-wrap { display: flex; flex-direction: column; align-items: center; gap: 24px; }
.flash { width: min(480px, 100%); min-height: 250px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; cursor: pointer; user-select: none; }
.flash h2 { font-size: 42px; margin: 16px 0; overflow-wrap: anywhere; color: var(--ink); font-weight: 700; }
.flash-controls { display: flex; gap: 12px; align-items: center; }

/* Quiz */
.quiz { max-width: 460px; margin: 0 auto; text-align: center; }
.quiz-head { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; font-weight: 600; color: var(--muted); }
.quiz-card { background: #f8fafc; padding: 32px 24px; border-radius: 14px; border: 1px solid var(--line-2); }
.quiz-card h1 { font-size: 42px; margin: 14px 0 8px; overflow-wrap: anywhere; color: var(--ink); font-weight: 700; }
.quiz-opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
.quiz-opt { color: #fff; border: none; padding: 14px; border-radius: 10px; font-size: 16px; font-weight: 700; min-height: 48px; }
.quiz-opt.der { background: var(--der); } .quiz-opt.die { background: var(--die); } .quiz-opt.das { background: var(--das); }
.quiz-opt.Dativ { background: var(--dativ); } .quiz-opt.Akkusativ { background: var(--akku); } .quiz-opt.Both { background: var(--both); } .quiz-opt.Wechsel { background: var(--wechsel); }
.quiz-opt[disabled] { opacity: .6; }

/* Modal */
.overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 16px; }
.modal { background: #fff; border-radius: 14px; padding: 28px; width: 100%; max-width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,.1); max-height: 100%; overflow-y: auto; }
.modal h3 { margin: 0 0 16px; font-size: 18px; color: var(--ink); }
.modal form { display: flex; flex-direction: column; gap: 16px; }
.modal-label { font-size: 12px; font-weight: 600; color: #475569; }
.modal-input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 15px; margin-top: 6px; background: #fff; min-height: 42px; }
.radios { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.radio { flex: 1 1 30%; text-align: center; padding: 10px 8px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; background: #f1f5f9; color: #334155; }
.radio.on { background: var(--ink); color: #fff; }
.radio input { display: none; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }

/* ================= TABLET ================= */
@media (max-width: 1024px) {
  .page { padding: 20px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .patterns-grid { grid-template-columns: 1fr; }
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
  .header-actions { width: 100%; }
  .header-actions .btn-primary { display: none; }
  .btn { padding: 10px 8px; font-size: 12.5px; }

  .fab { display: inline-flex; position: fixed; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 50;
    padding: 0 20px; min-height: 52px; border-radius: 999px; box-shadow: 0 8px 20px rgba(79,70,229,.35); font-size: 14px; }

  .main-tabs-row { flex-direction: column; align-items: stretch; gap: 10px; }
  .main-tabs { width: 100%; }
  .main-tab { flex: 1; padding: 8px 6px; font-size: 13px; }

  .sub-tabs-bar { justify-content: center; }
  .sub-tabs { width: 100%; }
  .sub-tab { flex: 1; padding: 8px 4px; font-size: 12px; text-align: center; }

  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .stat { padding: 12px 14px; min-height: 0; border-radius: 12px; }
  .stat-foot { margin-top: 8px; }
  .stat-value { font-size: 24px; }
  .stat-note { display: none; }
  .stat-label { font-size: 10px; }
  .stat-pill { font-size: 10px; padding: 2px 8px; }

  .toolbar { gap: 10px; }
  .search { flex-basis: 100%; max-width: none; }
  .filters { width: 100%; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; margin: 0 -12px; padding: 0 12px 2px; width: calc(100% + 24px); }
  .filters::-webkit-scrollbar { display: none; }
  .filters-label { display: none; }
  .chip .hint { display: none; }

  .list { background: transparent; border: none; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .list-head { display: none; }
  
  .noun-row {
    background: #fff; border: 1px solid var(--line); border-left-width: 4px; border-radius: 12px; padding: 12px 14px; gap: 8px 10px;
    display: grid !important;
    grid-template-columns: auto 1fr auto !important;
    grid-template-areas: "art noun noun" "plural plural plural" "mean mean mean" "status status actions" !important;
  }
  .noun-row.der { border-left-color: var(--der); } .noun-row.die { border-left-color: var(--die); } .noun-row.das { border-left-color: var(--das); }

  .verb-row {
    background: #fff; border: 1px solid var(--line); border-left-width: 4px; border-radius: 12px; padding: 12px 14px; gap: 8px 10px;
    display: grid !important;
    grid-template-columns: auto 1fr auto !important;
    grid-template-areas: "case verb verb" "mean mean mean" "eg eg eg" "status status actions" !important;
  }
  .verb-row.Dativ { border-left-color: var(--dativ); }
  .verb-row.Akkusativ { border-left-color: var(--akku); }
  .verb-row.Both { border-left-color: var(--both); }

  .prep-row {
    background: #fff; border: 1px solid var(--line); border-left-width: 4px; border-radius: 12px; padding: 12px 14px; gap: 8px 10px;
    display: grid !important;
    grid-template-columns: auto 1fr auto !important;
    grid-template-areas: "case prep prep" "mean mean mean" "eg eg eg" "status status actions" !important;
  }
  .prep-row.Dativ { border-left-color: var(--dativ); }
  .prep-row.Akkusativ { border-left-color: var(--akku); }
  .prep-row.Wechsel { border-left-color: var(--wechsel); }

  .c-idx { display: none; }
  .c-art { grid-area: art; }
  .c-case { grid-area: case; }
  .c-noun { grid-area: noun; }
  .c-plural { grid-area: plural; font-size: 13px; font-weight: 600; color: var(--muted); }
  .c-verb { grid-area: verb; font-size: 16px; font-weight: 700; }
  .c-prep { grid-area: prep; font-size: 16px; font-weight: 700; }
  .c-mean { grid-area: mean; font-size: 14px; }
  .c-eg { grid-area: eg; font-size: 12px; }
  .c-status { grid-area: status; }
  .actions { grid-area: actions; }
  .pill { font-size: 13px; }
  .noun-wrap .pill { background: transparent !important; padding: 0; font-size: 18px; font-weight: 700; }
  .status { padding: 8px 12px; min-height: 36px; }
  .icon-btn { width: 40px; height: 40px; min-width: 40px; }

  .panel { padding: 28px 14px; }
  .flash { min-height: 220px; padding: 24px 16px; }
  .flash h2 { font-size: 34px; }
  .flash-controls { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .flash-controls .mid { grid-column: 1 / -1; order: 3; }
  .quiz-card { padding: 20px; }
  .quiz-card h1 { font-size: 34px; }
  .quiz-opt { padding: 16px 8px; }

  .overlay { align-items: flex-end; padding: 0; }
  .modal { max-width: none; border-radius: 18px 18px 0 0; padding: 22px 18px calc(22px + env(safe-area-inset-bottom)); max-height: 92vh; }
  .modal-actions .btn { flex: 1; }
}

@media (prefers-reduced-motion: no-preference) {
  .btn, .chip, .main-tab, .sub-tab, .icon-btn, .status { transition: background-color .15s, color .15s, transform .1s; }
  .btn:active, .icon-btn:active, .chip:active { transform: scale(.97); }
}
`;

const ARTICLE_CLASS = { der: "bg-der", die: "bg-die", das: "bg-das" };
const VERB_CASE_CLASS = { Dativ: "bg-dativ", Akkusativ: "bg-akku", "Both / Common": "bg-both" };
const PREP_CASE_CLASS = { Dativ: "bg-dativ", Akkusativ: "bg-akku", Wechsel: "bg-wechsel" };
const GENDER_MAP = { der: "Masculine", die: "Feminine", das: "Neuter" };

export default function App() {
  const [vocabList, setVocabList] = useState([]);
  const [verbsList, setVerbsList] = useState([]);
  const [patternsList, setPatternsList] = useState([]);
  const [prepsList, setPrepsList] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [isPersisted, setIsPersisted] = useState(false);

  // Main Section Tabs: "Nouns" | "Patterns" | "Verbs" | "Prepositions"
  const [mainCategory, setMainCategory] = useState("Nouns");

  // Sub-views for each category: "list" | "flashcards" | "quiz"
  const [nounSubView, setNounSubView] = useState("list");
  const [patternSubView, setPatternSubView] = useState("list");
  const [verbSubView, setVerbSubView] = useState("list");
  const [prepSubView, setPrepSubView] = useState("list");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [articleFilter, setArticleFilter] = useState("all");
  const [verbFilter, setVerbFilter] = useState("all");
  const [prepFilter, setPrepFilter] = useState("all");

  // Nouns Modal
  const [nounModalOpen, setNounModalOpen] = useState(false);
  const [editingNounId, setEditingNounId] = useState(null);
  const [nounFormData, setNounFormData] = useState({ noun: "", plural: "", article: "der", meaning: "", status: "In Progress" });

  // Verbs Modal
  const [verbModalOpen, setVerbModalOpen] = useState(false);
  const [editingVerbId, setEditingVerbId] = useState(null);
  const [verbFormData, setVerbFormData] = useState({ verb: "", caseType: "Dativ", meaning: "", example: "", status: "In Progress" });

  // Patterns Modal
  const [patternModalOpen, setPatternModalOpen] = useState(false);
  const [patternFormData, setPatternFormData] = useState({ article: "der", ending: "", rule: "", examples: "" });

  // Prepositions Modal
  const [prepModalOpen, setPrepModalOpen] = useState(false);
  const [editingPrepId, setEditingPrepId] = useState(null);
  const [prepFormData, setPrepFormData] = useState({ prep: "", caseType: "Akkusativ", meaning: "", example: "", status: "In Progress" });

  // Nouns Flashcard & Quiz State
  const [nounCardIndex, setNounCardIndex] = useState(0);
  const [nounCardFlipped, setNounCardFlipped] = useState(false);
  const [nounQuizIndex, setNounQuizIndex] = useState(0);
  const [nounQuizScore, setNounQuizScore] = useState(0);
  const [nounQuizFeedback, setNounQuizFeedback] = useState(null);

  // Patterns Flashcard & Quiz State
  const [patternCardIndex, setPatternCardIndex] = useState(0);
  const [patternCardFlipped, setPatternCardFlipped] = useState(false);
  const [patternQuizIndex, setPatternQuizIndex] = useState(0);
  const [patternQuizScore, setPatternQuizScore] = useState(0);
  const [patternQuizFeedback, setPatternQuizFeedback] = useState(null);

  // Verbs Flashcard & Quiz State
  const [verbCardIndex, setVerbCardIndex] = useState(0);
  const [verbCardFlipped, setVerbCardFlipped] = useState(false);
  const [verbQuizIndex, setVerbQuizIndex] = useState(0);
  const [verbQuizScore, setVerbQuizScore] = useState(0);
  const [verbQuizFeedback, setVerbQuizFeedback] = useState(null);

  // Prepositions Flashcard & Quiz State
  const [prepCardIndex, setPrepCardIndex] = useState(0);
  const [prepCardFlipped, setPrepCardFlipped] = useState(false);
  const [prepQuizIndex, setPrepQuizIndex] = useState(0);
  const [prepQuizScore, setPrepQuizScore] = useState(0);
  const [prepQuizFeedback, setPrepQuizFeedback] = useState(null);

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

        const storedPatterns = await loadFromVaultDB(PATTERNS_STORE_NAME, PATTERNS_BACKUP_KEY);
        if (storedPatterns && Array.isArray(storedPatterns) && storedPatterns.length > 0) {
          setPatternsList(storedPatterns);
        } else {
          await writeToVaultDB(PATTERNS_STORE_NAME, PATTERNS_BACKUP_KEY, SEED_PATTERNS);
          setPatternsList(SEED_PATTERNS);
        }

        const storedPreps = await loadFromVaultDB(PREPOSITIONS_STORE_NAME, PREPOSITIONS_BACKUP_KEY);
        if (storedPreps && Array.isArray(storedPreps) && storedPreps.length > 0) {
          setPrepsList(storedPreps);
        } else {
          await writeToVaultDB(PREPOSITIONS_STORE_NAME, PREPOSITIONS_BACKUP_KEY, SEED_PREPOSITIONS);
          setPrepsList(SEED_PREPOSITIONS);
        }
      } catch (err) {
        console.error("IndexedDB load error, fallback to memory:", err);
        setVocabList(SEED_DATA);
        setVerbsList(SEED_VERBS);
        setPatternsList(SEED_PATTERNS);
        setPrepsList(SEED_PREPOSITIONS);
      } finally {
        setIsReady(true);
      }
    }
    initVault();
  }, []);

  const commitNouns = async (newList) => {
    setVocabList(newList);
    setNounCardIndex((i) => Math.min(i, Math.max(newList.length - 1, 0)));
    setNounQuizIndex((i) => Math.min(i, Math.max(newList.length - 1, 0)));
    try {
      await writeToVaultDB(STORE_NAME, BACKUP_KEY, newList);
    } catch (e) {
      console.error("Failed writing nouns:", e);
    }
  };

  const commitVerbs = async (newList) => {
    setVerbsList(newList);
    setVerbCardIndex((i) => Math.min(i, Math.max(newList.length - 1, 0)));
    setVerbQuizIndex((i) => Math.min(i, Math.max(newList.length - 1, 0)));
    try {
      await writeToVaultDB(VERBS_STORE_NAME, VERBS_BACKUP_KEY, newList);
    } catch (e) {
      console.error("Failed writing verbs:", e);
    }
  };

  const commitPatterns = async (newList) => {
    setPatternsList(newList);
    setPatternCardIndex((i) => Math.min(i, Math.max(newList.length - 1, 0)));
    setPatternQuizIndex((i) => Math.min(i, Math.max(newList.length - 1, 0)));
    try {
      await writeToVaultDB(PATTERNS_STORE_NAME, PATTERNS_BACKUP_KEY, newList);
    } catch (e) {
      console.error("Failed writing patterns:", e);
    }
  };

  const commitPreps = async (newList) => {
    setPrepsList(newList);
    setPrepCardIndex((i) => Math.min(i, Math.max(newList.length - 1, 0)));
    setPrepQuizIndex((i) => Math.min(i, Math.max(newList.length - 1, 0)));
    try {
      await writeToVaultDB(PREPOSITIONS_STORE_NAME, PREPOSITIONS_BACKUP_KEY, newList);
    } catch (e) {
      console.error("Failed writing prepositions:", e);
    }
  };

  // Nouns Handlers
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

  // Verbs Handlers
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

  // Pattern Handlers
  const handleSavePatternModal = (e) => {
    e.preventDefault();
    if (!patternFormData.ending.trim() || !patternFormData.rule.trim()) return;
    const newPattern = {
      id: `p-${Date.now()}`,
      article: patternFormData.article,
      ending: patternFormData.ending.trim(),
      rule: patternFormData.rule.trim(),
      examples: patternFormData.examples.trim() || "—",
    };
    commitPatterns([...patternsList, newPattern]);
    setPatternModalOpen(false);
  };

  const handleDeletePattern = (id) => {
    if (window.confirm("Delete this pattern rule?")) {
      commitPatterns(patternsList.filter((p) => p.id !== id));
    }
  };

  // Preposition Handlers
  const handleTogglePrepStatus = (id) => {
    commitPreps(
      prepsList.map((item) =>
        item.id === id ? { ...item, status: item.status === "Mastered" ? "In Progress" : "Mastered" } : item
      )
    );
  };

  const handleDeletePrep = (id) => {
    if (window.confirm("Delete this preposition permanently?")) {
      commitPreps(prepsList.filter((item) => item.id !== id));
    }
  };

  const handleSavePrepModal = (e) => {
    e.preventDefault();
    if (!prepFormData.prep.trim() || !prepFormData.meaning.trim()) return;
    const updated = editingPrepId
      ? prepsList.map((item) => (item.id === editingPrepId ? { ...item, ...prepFormData } : item))
      : [...prepsList, { id: Date.now(), ...prepFormData }];
    commitPreps(updated);
    setPrepModalOpen(false);
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

  // Filtered item sets
  const filteredNouns = vocabList.filter((item) => {
    const q = search.toLowerCase();
    return (
      (articleFilter === "all" || item.article === articleFilter) &&
      (item.noun.toLowerCase().includes(q) || (item.plural && item.plural.toLowerCase().includes(q)) || item.meaning.toLowerCase().includes(q))
    );
  });

  const filteredVerbs = verbsList.filter((item) => {
    const q = search.toLowerCase();
    return (
      (verbFilter === "all" || item.caseType === verbFilter) &&
      (item.verb.toLowerCase().includes(q) || item.meaning.toLowerCase().includes(q) || item.example.toLowerCase().includes(q))
    );
  });

  const filteredPreps = prepsList.filter((item) => {
    const q = search.toLowerCase();
    return (
      (prepFilter === "all" || item.caseType === prepFilter) &&
      (item.prep.toLowerCase().includes(q) || item.meaning.toLowerCase().includes(q) || item.example.toLowerCase().includes(q))
    );
  });

  // Current subview determination
  const currentSubView =
    mainCategory === "Nouns" ? nounSubView :
    mainCategory === "Patterns" ? patternSubView :
    mainCategory === "Verbs" ? verbSubView : prepSubView;

  // Stats counters
  const nounsMastered = vocabList.filter((i) => i.status === "Mastered").length;
  const countNoun = (art) => vocabList.filter((i) => i.article === art).length;
  const countPattern = (art) => patternsList.filter((p) => p.article === art).length;
  const verbsMastered = verbsList.filter((i) => i.status === "Mastered").length;
  const countVerb = (c) => verbsList.filter((i) => i.caseType === c).length;
  const prepsMastered = prepsList.filter((i) => i.status === "Mastered").length;
  const countPrep = (c) => prepsList.filter((i) => i.caseType === c).length;

  // Active items for practice
  const nounCard = vocabList[nounCardIndex];
  const nounQuizWord = vocabList[nounQuizIndex];
  const patternCard = patternsList[patternCardIndex];
  const patternQuizWord = patternsList[patternQuizIndex];
  const verbCard = verbsList[verbCardIndex];
  const verbQuizWord = verbsList[verbQuizIndex];
  const prepCard = prepsList[prepCardIndex];
  const prepQuizWord = prepsList[prepQuizIndex];

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
              <p className="subtitle">Articles, plurals, suffix patterns, case verbs, and prepositions.</p>
            </div>
          </div>

          <div className="header-actions">
            {mainCategory === "Nouns" && currentSubView === "list" && (
              <button
                onClick={() => {
                  setEditingNounId(null);
                  setNounFormData({ noun: "", plural: "", article: "der", meaning: "", status: "In Progress" });
                  setNounModalOpen(true);
                }}
                className="btn btn-primary"
              >
                + Add Noun
              </button>
            )}
            {mainCategory === "Patterns" && currentSubView === "list" && (
              <button
                onClick={() => {
                  setPatternFormData({ article: "der", ending: "", rule: "", examples: "" });
                  setPatternModalOpen(true);
                }}
                className="btn btn-primary"
              >
                + Add Pattern
              </button>
            )}
            {mainCategory === "Verbs" && currentSubView === "list" && (
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
            )}
            {mainCategory === "Prepositions" && currentSubView === "list" && (
              <button
                onClick={() => {
                  setEditingPrepId(null);
                  setPrepFormData({ prep: "", caseType: "Akkusativ", meaning: "", example: "", status: "In Progress" });
                  setPrepModalOpen(true);
                }}
                className="btn btn-primary"
              >
                + Add Preposition
              </button>
            )}
          </div>
        </header>

        {/* PRIMARY TABS */}
        <div className="main-tabs-row">
          <div className="main-tabs" role="tablist">
            {[
              { id: "Nouns", icon: "📑", count: vocabList.length },
              { id: "Patterns", icon: "📐", count: patternsList.length },
              { id: "Verbs", icon: "⚡", count: verbsList.length },
              { id: "Prepositions", icon: "🎯", count: prepsList.length },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={mainCategory === tab.id}
                onClick={() => {
                  setMainCategory(tab.id);
                  setSearch("");
                }}
                className={`main-tab ${mainCategory === tab.id ? "active" : ""}`}
              >
                <span>{tab.icon}</span>
                <span>{tab.id}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>({tab.count})</span>
              </button>
            ))}
          </div>

          {/* SUB-VIEW SWITCHER */}
          <div className="sub-tabs-bar">
            <div className="sub-tabs">
              <button
                className={`sub-tab ${currentSubView === "list" ? "active" : ""}`}
                onClick={() => {
                  if (mainCategory === "Nouns") setNounSubView("list");
                  if (mainCategory === "Patterns") setPatternSubView("list");
                  if (mainCategory === "Verbs") setVerbSubView("list");
                  if (mainCategory === "Prepositions") setPrepSubView("list");
                }}
              >
                📑 Overview &amp; List
              </button>
              <button
                className={`sub-tab ${currentSubView === "flashcards" ? "active" : ""}`}
                onClick={() => {
                  if (mainCategory === "Nouns") { setNounSubView("flashcards"); setNounCardFlipped(false); }
                  if (mainCategory === "Patterns") { setPatternSubView("flashcards"); setPatternCardFlipped(false); }
                  if (mainCategory === "Verbs") { setVerbSubView("flashcards"); setVerbCardFlipped(false); }
                  if (mainCategory === "Prepositions") { setPrepSubView("flashcards"); setPrepCardFlipped(false); }
                }}
              >
                🎴 Flashcards
              </button>
              <button
                className={`sub-tab ${currentSubView === "quiz" ? "active" : ""}`}
                onClick={() => {
                  if (mainCategory === "Nouns") setNounSubView("quiz");
                  if (mainCategory === "Patterns") setPatternSubView("quiz");
                  if (mainCategory === "Verbs") setVerbSubView("quiz");
                  if (mainCategory === "Prepositions") setPrepSubView("quiz");
                }}
              >
                ✨ Quiz
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            CATEGORY 1: NOUNS
           ========================================================================= */}
        {mainCategory === "Nouns" && (
          <>
            {nounSubView === "list" && (
              <div className="section">
                <div className="stats-grid">
                  <div className="stat dark">
                    <div className="stat-head">
                      <span className="stat-label">TOTAL NOUNS</span>
                      <span className="stat-pill dark">{nounsMastered} mastered</span>
                    </div>
                    <div className="stat-foot">
                      <span className="stat-value">{vocabList.length}</span>
                      <span className="stat-note" style={{ color: "#94a3b8", fontWeight: 500 }}>all genders</span>
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

                <div className="toolbar">
                  <div className="search">
                    <span>🔍</span>
                    <input
                      type="search"
                      placeholder="Search noun, plural form, or English meaning..."
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
                    <span>PLURAL (DIE)</span>
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
                        <div className="c-plural">{item.plural || "—"}</div>
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
                          <button onClick={() => speakGerman(`${item.article} ${item.noun}. ${item.plural || ""}`)} className="icon-btn" title="Listen">🔊</button>
                          <button
                            onClick={() => {
                              setEditingNounId(item.id);
                              setNounFormData({ noun: item.noun, plural: item.plural || "", article: item.article, meaning: item.meaning, status: item.status });
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

            {nounSubView === "flashcards" && (
              <div className="panel">
                {!nounCard ? (
                  <p style={{ color: "#64748b" }}>No nouns available in vault.</p>
                ) : (
                  <div className="flash-wrap">
                    <div className="flash" onClick={() => setNounCardFlipped(!nounCardFlipped)}>
                      {!nounCardFlipped ? (
                        <>
                          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>GUESS ARTICLE, PLURAL &amp; MEANING</span>
                          <h2>{nounCard.noun}</h2>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>(Tap to flip)</span>
                        </>
                      ) : (
                        <>
                          <span className={`pill ${ARTICLE_CLASS[nounCard.article]}`} style={{ fontSize: 22, padding: "6px 20px" }}>
                            {nounCard.article} {nounCard.noun}
                          </span>
                          {nounCard.plural && (
                            <p style={{ fontSize: 16, fontWeight: 700, color: "#475569", margin: "10px 0 0" }}>
                              Plural: {nounCard.plural}
                            </p>
                          )}
                          <h3 style={{ fontSize: 24, margin: "10px 0 6px", color: "var(--ink-2)" }}>{nounCard.meaning}</h3>
                          <p style={{ color: "#64748b", margin: 0, fontSize: 14 }}>{nounCard.gender}</p>
                        </>
                      )}
                    </div>

                    <div className="flash-controls">
                      <button
                        className="btn btn-secondary"
                        disabled={nounCardIndex === 0}
                        onClick={() => { setNounCardIndex(nounCardIndex - 1); setNounCardFlipped(false); }}
                      >
                        ◀ Previous
                      </button>
                      <button className="btn btn-secondary mid" onClick={() => speakGerman(`${nounCard.article} ${nounCard.noun}. ${nounCard.plural || ""}`)}>
                        🔊 Pronounce
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={nounCardIndex >= vocabList.length - 1}
                        onClick={() => { setNounCardIndex(nounCardIndex + 1); setNounCardFlipped(false); }}
                      >
                        Next ▶
                      </button>
                    </div>
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      Noun {nounCardIndex + 1} of {vocabList.length}
                    </span>
                  </div>
                )}
              </div>
            )}

            {nounSubView === "quiz" && (
              <div className="panel">
                {!nounQuizWord ? (
                  <p style={{ color: "#64748b" }}>Add nouns to practice quiz.</p>
                ) : (
                  <div className="quiz">
                    <div className="quiz-head">
                      <span>Noun {nounQuizIndex + 1} of {vocabList.length}</span>
                      <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {nounQuizScore}</span>
                    </div>

                    <div className="quiz-card">
                      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Choose the correct article:</span>
                      <h1>{nounQuizWord.noun}</h1>
                      <p style={{ color: "#64748b", margin: "4px 0", fontSize: 14 }}>
                        Plural: <strong style={{ color: "var(--ink)" }}>{nounQuizWord.plural || "—"}</strong>
                      </p>
                      <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>
                        Meaning: <strong style={{ color: "var(--ink-2)" }}>{nounQuizWord.meaning}</strong>
                      </p>
                    </div>

                    <div className="quiz-opts">
                      {["der", "die", "das"].map((opt) => (
                        <button
                          key={opt}
                          disabled={nounQuizFeedback !== null}
                          className={`quiz-opt ${opt}`}
                          onClick={() => {
                            const ok = opt === nounQuizWord.article;
                            if (ok) setNounQuizScore((s) => s + 1);
                            setNounQuizFeedback(ok ? "Correct! 🎉" : `Wrong! The correct article is "${nounQuizWord.article}".`);
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    {nounQuizFeedback && (
                      <div style={{ marginTop: 24 }}>
                        <p style={{ fontSize: 15, fontWeight: 600 }}>{nounQuizFeedback}</p>
                        <button
                          className="btn btn-primary"
                          style={{ marginTop: 8 }}
                          onClick={() => {
                            setNounQuizFeedback(null);
                            if (nounQuizIndex < vocabList.length - 1) {
                              setNounQuizIndex((i) => i + 1);
                            } else {
                              alert(`Noun Quiz finished! Final Score: ${nounQuizScore}/${vocabList.length}`);
                              setNounQuizIndex(0);
                              setNounQuizScore(0);
                            }
                          }}
                        >
                          {nounQuizIndex < vocabList.length - 1 ? "Next Noun" : "Restart Quiz"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* =========================================================================
            CATEGORY 2: PATTERNS
           ========================================================================= */}
        {mainCategory === "Patterns" && (
          <>
            {patternSubView === "list" && (
              <div className="section">
                <div className="stats-grid">
                  <div className="stat dark">
                    <div className="stat-head">
                      <span className="stat-label">TOTAL PATTERNS</span>
                      <span className="stat-pill dark">Active Rules</span>
                    </div>
                    <div className="stat-foot">
                      <span className="stat-value">{patternsList.length}</span>
                      <span className="stat-note" style={{ color: "#94a3b8", fontWeight: 500 }}>suffix patterns</span>
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-head">
                      <span className="stat-label">DER PATTERNS</span>
                      <span className="stat-pill bg-der">der rules</span>
                    </div>
                    <div className="stat-foot">
                      <span className="stat-value c-der">{countPattern("der")}</span>
                      <span className="stat-note c-der">e.g. -ling, -or, -ismus</span>
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-head">
                      <span className="stat-label">DIE PATTERNS</span>
                      <span className="stat-pill bg-die">die rules</span>
                    </div>
                    <div className="stat-foot">
                      <span className="stat-value c-die">{countPattern("die")}</span>
                      <span className="stat-note c-die">e.g. -ung, -heit, -keit</span>
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-head">
                      <span className="stat-label">DAS PATTERNS</span>
                      <span className="stat-pill bg-das">das rules</span>
                    </div>
                    <div className="stat-foot">
                      <span className="stat-value c-das">{countPattern("das")}</span>
                      <span className="stat-note c-das">e.g. -chen, -ment, -um</span>
                    </div>
                  </div>
                </div>

                <div className="patterns-grid">
                  {["der", "die", "das"].map((art) => {
                    const label = GENDER_MAP[art];
                    const borderClass = art;
                    const colorClass = `c-${art}`;
                    const badgeClass = ARTICLE_CLASS[art];
                    const rules = patternsList.filter((p) => p.article === art);

                    return (
                      <div key={art} className={`pattern-col ${borderClass}`}>
                        <div className="pattern-header">
                          <div>
                            <h3 className={colorClass}>{label} Rules</h3>
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>{rules.length} patterns</span>
                          </div>
                          <span className={`stat-pill ${badgeClass}`}>{art}</span>
                        </div>

                        {rules.length === 0 ? (
                          <div style={{ color: "var(--faint)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                            No rules added yet.
                          </div>
                        ) : (
                          rules.map((rule) => (
                            <div key={rule.id} className="pattern-card">
                              <div className="pattern-card-top">
                                <span className={`pattern-badge ${badgeClass}`}>{rule.ending}</span>
                                <button
                                  onClick={() => handleDeletePattern(rule.id)}
                                  className="pattern-delete-btn"
                                  title="Delete pattern rule"
                                >
                                  ✕
                                </button>
                              </div>
                              <p className="pattern-rule">{rule.rule}</p>
                              <p className="pattern-eg">e.g. {rule.examples}</p>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {patternSubView === "flashcards" && (
              <div className="panel">
                {!patternCard ? (
                  <p style={{ color: "#64748b" }}>No pattern suffixes available.</p>
                ) : (
                  <div className="flash-wrap">
                    <div className="flash" onClick={() => setPatternCardFlipped(!patternCardFlipped)}>
                      {!patternCardFlipped ? (
                        <>
                          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>WHICH ARTICLE BELONGS TO THIS PATTERN?</span>
                          <h2 style={{ fontFamily: "monospace", letterSpacing: "1px" }}>{patternCard.ending}</h2>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>(Tap to reveal article &amp; rules)</span>
                        </>
                      ) : (
                        <>
                          <span className={`pill ${ARTICLE_CLASS[patternCard.article]}`} style={{ fontSize: 22, padding: "6px 22px" }}>
                            {patternCard.article} ({GENDER_MAP[patternCard.article]})
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
                        onClick={() => { setPatternCardIndex(patternCardIndex - 1); setPatternCardFlipped(false); }}
                      >
                        ◀ Previous
                      </button>
                      <button className="btn btn-secondary mid" onClick={() => speakGerman(patternCard.examples)}>
                        🔊 Hear Examples
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={patternCardIndex >= patternsList.length - 1}
                        onClick={() => { setPatternCardIndex(patternCardIndex + 1); setPatternCardFlipped(false); }}
                      >
                        Next ▶
                      </button>
                    </div>
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      Pattern {patternCardIndex + 1} of {patternsList.length}
                    </span>
                  </div>
                )}
              </div>
            )}

            {patternSubView === "quiz" && (
              <div className="panel">
                {!patternQuizWord ? (
                  <p style={{ color: "#64748b" }}>Add patterns to practice quiz.</p>
                ) : (
                  <div className="quiz">
                    <div className="quiz-head">
                      <span>Pattern {patternQuizIndex + 1} of {patternsList.length}</span>
                      <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {patternQuizScore}</span>
                    </div>

                    <div className="quiz-card">
                      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Which article goes with this suffix?</span>
                      <h1 style={{ fontFamily: "monospace" }}>{patternQuizWord.ending}</h1>
                      <p style={{ color: "#64748b", margin: 0, fontSize: 14 }}>
                        Rule: <strong style={{ color: "var(--ink-2)" }}>{patternQuizWord.rule}</strong>
                      </p>
                    </div>

                    <div className="quiz-opts">
                      {["der", "die", "das"].map((opt) => (
                        <button
                          key={opt}
                          disabled={patternQuizFeedback !== null}
                          className={`quiz-opt ${opt}`}
                          onClick={() => {
                            const ok = opt === patternQuizWord.article;
                            if (ok) setPatternQuizScore((s) => s + 1);
                            setPatternQuizFeedback(
                              ok ? "Correct! 🎉" : `Wrong! Words ending in "${patternQuizWord.ending}" take "${patternQuizWord.article}".`
                            );
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    {patternQuizFeedback && (
                      <div style={{ marginTop: 24 }}>
                        <p style={{ fontSize: 15, fontWeight: 600 }}>{patternQuizFeedback}</p>
                        <button
                          className="btn btn-primary"
                          style={{ marginTop: 8 }}
                          onClick={() => {
                            setPatternQuizFeedback(null);
                            if (patternQuizIndex < patternsList.length - 1) {
                              setPatternQuizIndex((i) => i + 1);
                            } else {
                              alert(`Pattern Quiz finished! Final Score: ${patternQuizScore}/${patternsList.length}`);
                              setPatternQuizIndex(0);
                              setPatternQuizScore(0);
                            }
                          }}
                        >
                          {patternQuizIndex < patternsList.length - 1 ? "Next Pattern" : "Restart Quiz"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* =========================================================================
            CATEGORY 3: VERBS
           ========================================================================= */}
        {mainCategory === "Verbs" && (
          <>
            {verbSubView === "list" && (
              <div className="section">
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

                <div className="toolbar">
                  <div className="search">
                    <span>🔍</span>
                    <input
                      type="search"
                      placeholder="Search verb, meaning, or sentence..."
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
                  <div className="list-head verbs-head">
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

            {verbSubView === "flashcards" && (
              <div className="panel">
                {!verbCard ? (
                  <p style={{ color: "#64748b" }}>No verbs available in vault.</p>
                ) : (
                  <div className="flash-wrap">
                    <div className="flash" onClick={() => setVerbCardFlipped(!verbCardFlipped)}>
                      {!verbCardFlipped ? (
                        <>
                          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>WHICH CASE DOES THIS VERB GOVERN?</span>
                          <h2>{verbCard.verb}</h2>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>(Tap to flip)</span>
                        </>
                      ) : (
                        <>
                          <span className={`pill ${VERB_CASE_CLASS[verbCard.caseType] || "bg-both"}`} style={{ fontSize: 22, padding: "6px 20px" }}>
                            {verbCard.caseType}
                          </span>
                          <h3 style={{ fontSize: 22, margin: "14px 0 6px", color: "var(--ink-2)" }}>{verbCard.meaning}</h3>
                          {verbCard.example && (
                            <p style={{ color: "#64748b", margin: 0, fontSize: 14, fontStyle: "italic" }}>"{verbCard.example}"</p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flash-controls">
                      <button
                        className="btn btn-secondary"
                        disabled={verbCardIndex === 0}
                        onClick={() => { setVerbCardIndex(verbCardIndex - 1); setVerbCardFlipped(false); }}
                      >
                        ◀ Previous
                      </button>
                      <button className="btn btn-secondary mid" onClick={() => speakGerman(`${verbCard.verb}. ${verbCard.example || ""}`)}>
                        🔊 Pronounce
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={verbCardIndex >= verbsList.length - 1}
                        onClick={() => { setVerbCardIndex(verbCardIndex + 1); setVerbCardFlipped(false); }}
                      >
                        Next ▶
                      </button>
                    </div>
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      Verb {verbCardIndex + 1} of {verbsList.length}
                    </span>
                  </div>
                )}
              </div>
            )}

            {verbSubView === "quiz" && (
              <div className="panel">
                {!verbQuizWord ? (
                  <p style={{ color: "#64748b" }}>Add verbs to practice quiz.</p>
                ) : (
                  <div className="quiz">
                    <div className="quiz-head">
                      <span>Verb {verbQuizIndex + 1} of {verbsList.length}</span>
                      <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {verbQuizScore}</span>
                    </div>

                    <div className="quiz-card">
                      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Which case is required by this verb?</span>
                      <h1>{verbQuizWord.verb}</h1>
                      <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>
                        Meaning: <strong style={{ color: "var(--ink-2)" }}>{verbQuizWord.meaning}</strong>
                      </p>
                    </div>

                    <div className="quiz-opts">
                      {[
                        { label: "Dativ", val: "Dativ", cls: "Dativ" },
                        { label: "Akkusativ", val: "Akkusativ", cls: "Akkusativ" },
                        { label: "Both", val: "Both / Common", cls: "Both" },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          disabled={verbQuizFeedback !== null}
                          className={`quiz-opt ${opt.cls}`}
                          onClick={() => {
                            const ok = opt.val === verbQuizWord.caseType;
                            if (ok) setVerbQuizScore((s) => s + 1);
                            setVerbQuizFeedback(
                              ok ? "Correct! 🎉" : `Wrong! "${verbQuizWord.verb}" governs "${verbQuizWord.caseType}".`
                            );
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {verbQuizFeedback && (
                      <div style={{ marginTop: 24 }}>
                        <p style={{ fontSize: 15, fontWeight: 600 }}>{verbQuizFeedback}</p>
                        <button
                          className="btn btn-primary"
                          style={{ marginTop: 8 }}
                          onClick={() => {
                            setVerbQuizFeedback(null);
                            if (verbQuizIndex < verbsList.length - 1) {
                              setVerbQuizIndex((i) => i + 1);
                            } else {
                              alert(`Verb Quiz finished! Final Score: ${verbQuizScore}/${verbsList.length}`);
                              setVerbQuizIndex(0);
                              setVerbQuizScore(0);
                            }
                          }}
                        >
                          {verbQuizIndex < verbsList.length - 1 ? "Next Verb" : "Restart Quiz"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* =========================================================================
            CATEGORY 4: PREPOSITIONS (PRÄPOSITIONEN)
           ========================================================================= */}
        {mainCategory === "Prepositions" && (
          <>
            {prepSubView === "list" && (
              <div className="section">
                <div className="stats-grid">
                  <div className="stat dark">
                    <div className="stat-head">
                      <span className="stat-label">TOTAL PREPOSITIONS</span>
                      <span className="stat-pill dark">{prepsMastered} mastered</span>
                    </div>
                    <div className="stat-foot">
                      <span className="stat-value">{prepsList.length}</span>
                      <span className="stat-note" style={{ color: "#94a3b8", fontWeight: 500 }}>by grammar case</span>
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-head">
                      <span className="stat-label">AKKUSATIV</span>
                      <span className="stat-pill bg-akku">Akk</span>
                    </div>
                    <div className="stat-foot">
                      <span className="stat-value c-akku">{countPrep("Akkusativ")}</span>
                      <span className="stat-note c-akku">e.g. durch, für, ohne</span>
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-head">
                      <span className="stat-label">DATIV</span>
                      <span className="stat-pill bg-dativ">Dat</span>
                    </div>
                    <div className="stat-foot">
                      <span className="stat-value c-dativ">{countPrep("Dativ")}</span>
                      <span className="stat-note c-dativ">e.g. aus, bei, mit</span>
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-head">
                      <span className="stat-label">WECHSEL (TWO-WAY)</span>
                      <span className="stat-pill bg-wechsel">Dat / Akk</span>
                    </div>
                    <div className="stat-foot">
                      <span className="stat-value c-wechsel">{countPrep("Wechsel")}</span>
                      <span className="stat-note c-wechsel">Location / Motion</span>
                    </div>
                  </div>
                </div>

                <div className="toolbar">
                  <div className="search">
                    <span>🔍</span>
                    <input
                      type="search"
                      placeholder="Search preposition, meaning, or sentence..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="filters">
                    <span className="filters-label">Case:</span>
                    <button onClick={() => setPrepFilter("all")} className={`chip all ${prepFilter === "all" ? "on" : ""}`}>
                      All ({prepsList.length})
                    </button>
                    <button onClick={() => setPrepFilter("Akkusativ")} className={`chip akku ${prepFilter === "Akkusativ" ? "on" : ""}`}>
                      Akkusativ
                    </button>
                    <button onClick={() => setPrepFilter("Dativ")} className={`chip dativ ${prepFilter === "Dativ" ? "on" : ""}`}>
                      Dativ
                    </button>
                    <button onClick={() => setPrepFilter("Wechsel")} className={`chip wechsel ${prepFilter === "Wechsel" ? "on" : ""}`}>
                      Wechsel (Two-way)
                    </button>
                  </div>
                </div>

                <div className="list">
                  <div className="list-head preps-head">
                    <span style={{ textAlign: "center" }}>#</span>
                    <span>CASE</span>
                    <span>PREPOSITION</span>
                    <span>MEANING</span>
                    <span>EXAMPLE SENTENCE</span>
                    <span>STATUS</span>
                    <span style={{ textAlign: "right" }}>ACTIONS</span>
                  </div>

                  {filteredPreps.length === 0 ? (
                    <div className="empty">No prepositions found.</div>
                  ) : (
                    filteredPreps.map((item, index) => (
                      <div className={`row prep-row ${item.caseType}`} key={item.id}>
                        <div className="c-idx">{index + 1}</div>
                        <div className="c-case">
                          <span className={`pill ${PREP_CASE_CLASS[item.caseType] || "bg-both"}`}>
                            {item.caseType === "Wechsel" ? "Wechsel" : item.caseType}
                          </span>
                        </div>
                        <div className="c-prep">{item.prep}</div>
                        <div className="c-mean">{item.meaning}</div>
                        <div className="c-eg">{item.example || "—"}</div>
                        <div className="c-status">
                          <button
                            onClick={() => handleTogglePrepStatus(item.id)}
                            className={`status ${item.status === "Mastered" ? "done" : "todo"}`}
                          >
                            {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                          </button>
                        </div>
                        <div className="actions">
                          <button onClick={() => speakGerman(`${item.prep}. ${item.example || ""}`)} className="icon-btn" title="Listen">🔊</button>
                          <button
                            onClick={() => {
                              setEditingPrepId(item.id);
                              setPrepFormData({ prep: item.prep, caseType: item.caseType, meaning: item.meaning, example: item.example, status: item.status });
                              setPrepModalOpen(true);
                            }}
                            className="icon-btn"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button onClick={() => handleDeletePrep(item.id)} className="icon-btn" title="Delete">🗑️</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {prepSubView === "flashcards" && (
              <div className="panel">
                {!prepCard ? (
                  <p style={{ color: "#64748b" }}>No prepositions available in vault.</p>
                ) : (
                  <div className="flash-wrap">
                    <div className="flash" onClick={() => setPrepCardFlipped(!prepCardFlipped)}>
                      {!prepCardFlipped ? (
                        <>
                          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>WHICH CASE DOES THIS PREPOSITION TAKE?</span>
                          <h2>{prepCard.prep}</h2>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>(Tap to flip)</span>
                        </>
                      ) : (
                        <>
                          <span className={`pill ${PREP_CASE_CLASS[prepCard.caseType] || "bg-both"}`} style={{ fontSize: 22, padding: "6px 20px" }}>
                            {prepCard.caseType === "Wechsel" ? "Wechselpräposition (Dat/Akk)" : `+ ${prepCard.caseType}`}
                          </span>
                          <h3 style={{ fontSize: 22, margin: "14px 0 6px", color: "var(--ink-2)" }}>{prepCard.meaning}</h3>
                          {prepCard.example && (
                            <p style={{ color: "#64748b", margin: 0, fontSize: 14, fontStyle: "italic" }}>"{prepCard.example}"</p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flash-controls">
                      <button
                        className="btn btn-secondary"
                        disabled={prepCardIndex === 0}
                        onClick={() => { setPrepCardIndex(prepCardIndex - 1); setPrepCardFlipped(false); }}
                      >
                        ◀ Previous
                      </button>
                      <button className="btn btn-secondary mid" onClick={() => speakGerman(`${prepCard.prep}. ${prepCard.example || ""}`)}>
                        🔊 Pronounce
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={prepCardIndex >= prepsList.length - 1}
                        onClick={() => { setPrepCardIndex(prepCardIndex + 1); setPrepCardFlipped(false); }}
                      >
                        Next ▶
                      </button>
                    </div>
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      Preposition {prepCardIndex + 1} of {prepsList.length}
                    </span>
                  </div>
                )}
              </div>
            )}

            {prepSubView === "quiz" && (
              <div className="panel">
                {!prepQuizWord ? (
                  <p style={{ color: "#64748b" }}>Add prepositions to practice quiz.</p>
                ) : (
                  <div className="quiz">
                    <div className="quiz-head">
                      <span>Preposition {prepQuizIndex + 1} of {prepsList.length}</span>
                      <span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {prepQuizScore}</span>
                    </div>

                    <div className="quiz-card">
                      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Which case is required by this preposition?</span>
                      <h1>{prepQuizWord.prep}</h1>
                      <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>
                        Meaning: <strong style={{ color: "var(--ink-2)" }}>{prepQuizWord.meaning}</strong>
                      </p>
                    </div>

                    <div className="quiz-opts">
                      {[
                        { label: "Akkusativ", val: "Akkusativ", cls: "Akkusativ" },
                        { label: "Dativ", val: "Dativ", cls: "Dativ" },
                        { label: "Wechsel", val: "Wechsel", cls: "Wechsel" },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          disabled={prepQuizFeedback !== null}
                          className={`quiz-opt ${opt.cls}`}
                          onClick={() => {
                            const ok = opt.val === prepQuizWord.caseType;
                            if (ok) setPrepQuizScore((s) => s + 1);
                            setPrepQuizFeedback(
                              ok ? "Correct! 🎉" : `Wrong! "${prepQuizWord.prep}" requires "${prepQuizWord.caseType}".`
                            );
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {prepQuizFeedback && (
                      <div style={{ marginTop: 24 }}>
                        <p style={{ fontSize: 15, fontWeight: 600 }}>{prepQuizFeedback}</p>
                        <button
                          className="btn btn-primary"
                          style={{ marginTop: 8 }}
                          onClick={() => {
                            setPrepQuizFeedback(null);
                            if (prepQuizIndex < prepsList.length - 1) {
                              setPrepQuizIndex((i) => i + 1);
                            } else {
                              alert(`Preposition Quiz finished! Final Score: ${prepQuizScore}/${prepsList.length}`);
                              setPrepQuizIndex(0);
                              setPrepQuizScore(0);
                            }
                          }}
                        >
                          {prepQuizIndex < prepsList.length - 1 ? "Next Preposition" : "Restart Quiz"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Action Button (Mobile) */}
      {!nounModalOpen && !verbModalOpen && !patternModalOpen && !prepModalOpen && currentSubView === "list" && (
        <button
          onClick={() => {
            if (mainCategory === "Nouns") {
              setEditingNounId(null);
              setNounFormData({ noun: "", plural: "", article: "der", meaning: "", status: "In Progress" });
              setNounModalOpen(true);
            } else if (mainCategory === "Patterns") {
              setPatternFormData({ article: "der", ending: "", rule: "", examples: "" });
              setPatternModalOpen(true);
            } else if (mainCategory === "Verbs") {
              setEditingVerbId(null);
              setVerbFormData({ verb: "", caseType: "Dativ", meaning: "", example: "", status: "In Progress" });
              setVerbModalOpen(true);
            } else {
              setEditingPrepId(null);
              setPrepFormData({ prep: "", caseType: "Akkusativ", meaning: "", example: "", status: "In Progress" });
              setPrepModalOpen(true);
            }
          }}
          className="btn btn-primary fab"
          aria-label="Add item"
        >
          {mainCategory === "Nouns" ? "+ Add Noun" :
           mainCategory === "Patterns" ? "+ Add Pattern" :
           mainCategory === "Verbs" ? "+ Add Verb" : "+ Add Prep"}
        </button>
      )}

      {/* Modal: Add/Edit Noun with Plural */}
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
                <label className="modal-label">German Noun (Singular)</label>
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
                <label className="modal-label">Plural Form (die ...)</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. die Äpfel"
                  value={nounFormData.plural}
                  onChange={(e) => setNounFormData({ ...nounFormData, plural: e.target.value })}
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

      {/* Modal: Add Pattern */}
      {patternModalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setPatternModalOpen(false)}>
          <div className="modal">
            <h3>Add Suffix / Pattern Rule</h3>
            <form onSubmit={handleSavePatternModal}>
              <div>
                <label className="modal-label">Target Article (Gender)</label>
                <div className="radios">
                  {["der", "die", "das"].map((art) => (
                    <label key={art} className={`radio ${patternFormData.article === art ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="patternArticle"
                        value={art}
                        checked={patternFormData.article === art}
                        onChange={(e) => setPatternFormData({ ...patternFormData, article: e.target.value })}
                      />
                      {art}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="modal-label">Ending / Pattern Suffix</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. -tion, -ment, -ling"
                  value={patternFormData.ending}
                  onChange={(e) => setPatternFormData({ ...patternFormData, ending: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Rule / Explanation</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. Words of Latin origin or abstract states"
                  value={patternFormData.rule}
                  onChange={(e) => setPatternFormData({ ...patternFormData, rule: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Examples</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. die Station, die Nation"
                  value={patternFormData.examples}
                  onChange={(e) => setPatternFormData({ ...patternFormData, examples: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setPatternModalOpen(false)} className="btn btn-secondary" style={{ border: "none" }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Save Pattern</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Preposition */}
      {prepModalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setPrepModalOpen(false)}>
          <div className="modal">
            <h3>{editingPrepId ? "Edit Preposition" : "Add New Preposition"}</h3>
            <form onSubmit={handleSavePrepModal}>
              <div>
                <label className="modal-label">Required Case</label>
                <div className="radios">
                  {["Akkusativ", "Dativ", "Wechsel"].map((c) => (
                    <label key={c} className={`radio ${prepFormData.caseType === c ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="prepCaseType"
                        value={c}
                        checked={prepFormData.caseType === c}
                        onChange={(e) => setPrepFormData({ ...prepFormData, caseType: e.target.value })}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="modal-label">Preposition</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. ohne, mit, vor"
                  value={prepFormData.prep}
                  onChange={(e) => setPrepFormData({ ...prepFormData, prep: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">English Meaning</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. without, with, in front of"
                  value={prepFormData.meaning}
                  onChange={(e) => setPrepFormData({ ...prepFormData, meaning: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Example Sentence</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. Er geht ohne mich."
                  value={prepFormData.example}
                  onChange={(e) => setPrepFormData({ ...prepFormData, example: e.target.value })}
                />
              </div>

              <div>
                <label className="modal-label">Status</label>
                <select
                  className="modal-input"
                  value={prepFormData.status}
                  onChange={(e) => setPrepFormData({ ...prepFormData, status: e.target.value })}
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Mastered">Mastered</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setPrepModalOpen(false)} className="btn btn-secondary" style={{ border: "none" }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Save Preposition</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}