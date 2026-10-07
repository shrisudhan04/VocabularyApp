import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx-js-style";
import "../App.css";

const THEME_KEY = "app_theme";

/* global __APP_VERSION__, __APP_COMMIT__ */
const BUILD_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : null;
const BUILD_COMMIT =
  typeof __APP_COMMIT__ !== "undefined" ? __APP_COMMIT__ : null;

// ---------------------------------------------------------------
// Excel helpers
// ---------------------------------------------------------------

// Lowercase, strip accents (ä -> a), drop spaces/underscores/dashes/dots/brackets/slashes
const normalizeExcelHeader = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_\-./()]+/g, "");

const getExcelValue = (row, ...names) => {
  const normalizedRow = {};
  Object.keys(row || {}).forEach((key) => {
    normalizedRow[normalizeExcelHeader(key)] = row[key];
  });
  for (const name of names) {
    const key = normalizeExcelHeader(name);
    if (
      Object.prototype.hasOwnProperty.call(normalizedRow, key) &&
      normalizedRow[key] !== undefined &&
      normalizedRow[key] !== null
    ) {
      return normalizedRow[key];
    }
  }
  return "";
};

const normalizeImportedStatus = (value) => {
  const s = String(value || "").trim().toLowerCase();
  if (s === "mastered") return "Mastered";
  if (s === "forgot") return "Forgot";
  return "In Progress";
};

// Status for updates: blank cell => "" (means "don't touch existing status")
const statusOf = (row) => {
  const raw = String(getExcelValue(row, "Status") ?? "").trim();
  return raw ? normalizeImportedStatus(raw) : "";
};

const str = (row, ...names) => String(getExcelValue(row, ...names)).trim();

// Unique-key normalizer: trim, collapse inner spaces, lowercase
const lc = (v) => String(v || "").trim().replace(/\s+/g, " ").toLowerCase();

const normalizeArticle = (value) => {
  const a = String(value || "").trim().toLowerCase();
  return ["der", "die", "das"].includes(a) ? a : "der";
};

const genderFromArticle = (a) =>
  a === "der" ? "Masculine" : a === "die" ? "Feminine" : "Neuter";

// ---------------------------------------------------------------
// Noun category helpers (same storage key NounsPage uses)
// ---------------------------------------------------------------

const NOUN_CATEGORY_KEY = "noun_categories";

const cleanCat = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const foldCat = (s) =>
  cleanCat(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const sameCat = (a, b) => foldCat(a) === foldCat(b);

const loadStoredNounCategories = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOUN_CATEGORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(cleanCat).filter(Boolean) : [];
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------
// Import sheet configs
// The GERMAN WORD is the unique key (keyOf) and is never treated as
// a changed field. If it already exists, every other field that is
// filled in the Excel (English meaning, example, Präteritum,
// Partizip II, auxiliary, case, category, status) is updated when different.
// ---------------------------------------------------------------

const GERMAN_KEY_HEADERS = ["German", "Deutsch", "Word", "Wort"];
const MEANING_HEADERS = ["Meaning", "English Meaning", "English", "Translation"];
const EXAMPLE_HEADERS = ["Example", "Examples", "Example Sentence", "Beispiel", "Beispiele"];

const buildImportConfigs = ({
  vocabList, verbsList, patternsList, prepsList, timeList,
  onCommitNouns, onCommitVerbs, onCommitPatterns, onCommitPreps, onCommitTimes,
  resolveCategory,
}) => [
  {
    id: "Nouns", label: "Nouns", sheet: "Nouns",
    list: vocabList, commit: onCommitNouns,
    fields: ["article", "plural", "meaning", "category", "status"],
    keyOf: (i) => lc(i.noun),
    display: (i) => i.noun,
    parse: (row) => {
      const noun = str(row, "Noun", "German Noun", "Nomen", ...GERMAN_KEY_HEADERS);
      if (!noun) return null;
      const rawArticle = str(row, "Article", "Artikel");
      return {
        noun,
        article: rawArticle ? normalizeArticle(rawArticle) : "",
        plural: str(row, "Plural", "Plural (die)", "Mehrzahl"),
        meaning: str(row, ...MEANING_HEADERS),
        category: resolveCategory(str(row, "Category", "Kategorie")),
        status: statusOf(row),
      };
    },
    defaults: (inc) => ({ ...inc, article: inc.article || "der" }),
    finalize: (item) => ({ ...item, gender: genderFromArticle(item.article) }),
  },
  {
    id: "Patterns", label: "Patterns", sheet: "Patterns",
    list: patternsList, commit: onCommitPatterns,
    fields: ["rule", "examples", "status"],
    keyOf: (i) => `${lc(i.article)}|${lc(i.ending)}`,
    display: (i) => `${i.article} -${i.ending}`,
    parse: (row) => {
      const ending = str(row, "Ending", "Suffix", "Pattern", "Endung");
      if (!ending) return null;
      return {
        article: normalizeArticle(getExcelValue(row, "Article", "Artikel")),
        ending,
        rule: str(row, "Rule", "Explanation", "Regel"),
        examples: str(row, ...EXAMPLE_HEADERS),
        status: statusOf(row),
      };
    },
    defaults: (inc) => ({ ...inc }),
    finalize: (item) => ({ ...item, gender: item.article }),
  },
  {
    id: "Verbs", label: "Verbs", sheet: "Verbs",
    list: verbsList, commit: onCommitVerbs,
    fields: ["case", "preterite", "participle", "auxiliary", "meaning", "example", "status"],
    keyOf: (i) => lc(i.verb),
    display: (i) => i.verb,
    parse: (row) => {
      const verb = str(row, "Verb", "German Verb", "Infinitiv", "Infinitive", ...GERMAN_KEY_HEADERS);
      if (!verb) return null;
      return {
        verb,
        case: str(row, "Case", "Kasus"),
        preterite: str(
          row, "Präteritum", "Preterite", "Praeteritum", "Past", "Past Tense", "Simple Past"
        ),
        participle: str(
          row, "Partizip II", "Partizip 2", "Participle", "Past Participle", "Perfekt", "Partizip"
        ),
        auxiliary: str(row, "Auxiliary", "Hilfsverb", "Aux"),
        meaning: str(row, ...MEANING_HEADERS),
        example: str(row, ...EXAMPLE_HEADERS),
        status: statusOf(row),
      };
    },
    defaults: (inc) => ({ ...inc, auxiliary: inc.auxiliary || "hat" }),
    finalize: (item) => item,
  },
  {
    id: "Prepositions", label: "Prepositions", sheet: "Prepositions",
    list: prepsList, commit: onCommitPreps,
    fields: ["caseType", "meaning", "example", "status"],
    keyOf: (i) => lc(i.prep),
    display: (i) => i.prep,
    parse: (row) => {
      const prep = str(row, "Preposition", "Prep", "Präposition", ...GERMAN_KEY_HEADERS);
      if (!prep) return null;
      return {
        prep,
        caseType: str(row, "Case", "CaseType", "Required Case", "Kasus").toLowerCase(),
        meaning: str(row, ...MEANING_HEADERS),
        example: str(row, ...EXAMPLE_HEADERS),
        status: statusOf(row),
      };
    },
    defaults: (inc) => ({ ...inc }),
    finalize: (item) => item,
  },
  {
    id: "Time", label: "Time", sheet: "German_Uhrzeit", idPrefix: "t-",
    list: timeList, commit: onCommitTimes,
    fields: ["formal", "informal", "rule", "status"],
    keyOf: (i) => lc(i.digital),
    display: (i) => i.digital,
    isValidNew: (inc) => Boolean(inc.formal),
    parse: (row) => {
      const digital = str(row, "Digital", "Time", "Uhrzeit");
      if (!digital) return null;
      return {
        digital,
        formal: str(row, "Formal (24h)", "Formal", "Offiziell"),
        informal: str(row, "Informal (12h)", "Informal", "Umgangssprachlich"),
        rule: str(row, "Rule / Pattern", "Rule", "Pattern", "Explanation"),
        status: statusOf(row),
      };
    },
    defaults: (inc) => ({ ...inc }),
    finalize: (item) => item,
  },
];

const FIELD_LABELS = {
  article: "Article", plural: "Plural", meaning: "English", category: "Category", status: "Status",
  rule: "Rule", examples: "Examples", case: "Case", preterite: "Präteritum",
  participle: "Partizip II", auxiliary: "Auxiliary", example: "Example",
  caseType: "Case", formal: "Formal", informal: "Informal",
};

// Compare an imported sheet against the existing list -> new / update / unchanged
const planSheet = (cfg, workbook, findSheet) => {
  const sheetName = findSheet(cfg.sheet);
  if (!sheetName) return null;

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

  // Parse; if the same key appears twice in the file, the last row wins
  const incomingMap = new Map();
  rows.forEach((row) => {
    const inc = cfg.parse(row);
    if (inc) incomingMap.set(cfg.keyOf(inc), inc);
  });

  const existingMap = new Map(cfg.list.map((i) => [cfg.keyOf(i), i]));
  const stamp = Date.now();
  const newItems = [];
  const updates = [];
  let unchanged = 0;
  let skipped = 0;
  let idx = 0;

  incomingMap.forEach((inc, key) => {
    const ex = existingMap.get(key);

    // Not found by its German key -> brand-new entry
    if (!ex) {
      if (cfg.isValidNew && !cfg.isValidNew(inc)) { skipped++; return; }
      const base = cfg.defaults(inc);
      newItems.push(
        cfg.finalize({
          ...base,
          status: base.status || "In Progress",
          id: cfg.idPrefix ? `${cfg.idPrefix}${stamp + idx}` : stamp + idx,
          createdAt: new Date().toISOString(),
        })
      );
      idx++;
      return;
    }

    // Same German word -> only overwrite fields that are filled in the file and differ.
    // The key field itself (noun / verb / prep / digital) is never in cfg.fields.
    const changes = [];
    const patch = {};
    cfg.fields.forEach((f) => {
      const next = inc[f];
      if (next === undefined || next === "") return;
      const prev = ex[f] ?? "";
      if (String(prev).trim() !== String(next).trim()) {
        changes.push({ field: f, from: String(prev), to: String(next) });
        patch[f] = next;
      }
    });

    if (changes.length) {
      updates.push({
        key,
        label: cfg.display(ex),
        changes,
        item: cfg.finalize({ ...ex, ...patch }),
      });
    } else {
      unchanged++;
    }
  });

  const updateMap = new Map(updates.map((u) => [u.key, u.item]));
  const finalList = [
    ...cfg.list.map((i) => updateMap.get(cfg.keyOf(i)) ?? i),
    ...newItems,
  ];

  return {
    id: cfg.id,
    label: cfg.label,
    commit: cfg.commit,
    display: cfg.display,
    newItems,
    newLabels: newItems.map((i) => cfg.display(i)),
    updates,
    unchanged,
    skipped,
    finalList,
  };
};

// ---------------------------------------------------------------
// Excel styling
// ---------------------------------------------------------------

const EXCEL_FONT   = "Bahnschrift Light";
const HEADER_BLUE  = "1F4E78";
const BORDER_COLOR = "D9E2F3";
const WHITE        = "FFFFFF";
const TEXT_COLOR   = "1F2937";

const thinBorder = {
  top:    { style: "thin", color: { rgb: BORDER_COLOR } },
  bottom: { style: "thin", color: { rgb: BORDER_COLOR } },
  left:   { style: "thin", color: { rgb: BORDER_COLOR } },
  right:  { style: "thin", color: { rgb: BORDER_COLOR } },
};

const headerStyle = {
  font:      { name: EXCEL_FONT, sz: 11, bold: true, color: { rgb: WHITE } },
  fill:      { patternType: "solid", fgColor: { rgb: HEADER_BLUE } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border:    thinBorder,
};

const bodyStyle = {
  font:      { name: EXCEL_FONT, sz: 11, color: { rgb: TEXT_COLOR } },
  alignment: { vertical: "center", wrapText: true },
  border:    thinBorder,
};

const centerBodyStyle = {
  ...bodyStyle,
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
};

const createStyledSheet = (headers, rows, widths, centeredColumns = []) => {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"]       = widths.map((wch) => ({ wch }));
  ws["!rows"]       = [{ hpt: 24 }, ...rows.map(() => ({ hpt: 22 }))];
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(rows.length, 0), c: headers.length - 1 },
    }),
  };
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      cell.s =
        r === 0
          ? headerStyle
          : centeredColumns.includes(c)
          ? centerBodyStyle
          : bodyStyle;
    }
  }
  return ws;
};

// ---------------------------------------------------------------
// Small presentational pieces for the confirmation / report pages
// ---------------------------------------------------------------

const MAX_LISTED = 50;

function ChangeList({ updates }) {
  return (
    <ul className="imp-list">
      {updates.slice(0, MAX_LISTED).map((u) => (
        <li key={u.key}>
          <strong>{u.label}</strong>
          <ul className="imp-changes">
            {u.changes.map((c) => (
              <li key={c.field}>
                {FIELD_LABELS[c.field] || c.field}:{" "}
                <span className="imp-from">{c.from || "—"}</span>
                {" → "}
                <span className="imp-to">{c.to}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
      {updates.length > MAX_LISTED && (
        <li className="imp-more">+ {updates.length - MAX_LISTED} more</li>
      )}
    </ul>
  );
}

function NameList({ names }) {
  return (
    <ul className="imp-list">
      {names.slice(0, MAX_LISTED).map((n, i) => (
        <li key={`${n}-${i}`}>{n}</li>
      ))}
      {names.length > MAX_LISTED && (
        <li className="imp-more">+ {names.length - MAX_LISTED} more</li>
      )}
    </ul>
  );
}

function SheetDetails({ sheet, showUnchanged }) {
  return (
    <div className="imp-sheet">
      <div className="imp-sheet-head">
        <span className="imp-sheet-name">{sheet.label}</span>
        <span className="imp-pill imp-pill-new">{sheet.newItems.length} new</span>
        <span className="imp-pill imp-pill-upd">{sheet.updates.length} updated</span>
        {showUnchanged && (
          <span className="imp-pill">{sheet.unchanged} unchanged</span>
        )}
        {sheet.skipped > 0 && (
          <span className="imp-pill">{sheet.skipped} skipped</span>
        )}
      </div>

      {sheet.updates.length > 0 && (
        <details>
          <summary>Words that will be updated ({sheet.updates.length})</summary>
          <ChangeList updates={sheet.updates} />
        </details>
      )}
      {sheet.newItems.length > 0 && (
        <details>
          <summary>New words ({sheet.newItems.length})</summary>
          <NameList names={sheet.newLabels} />
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Main component
// ---------------------------------------------------------------

export default function Sidebar({
  isOpen,
  onClose,
  categories = [],
  activeCategory,
  onSelectCategory,
  onOpenGoals,
  onOpenReport,
  languageMode = "EN",
  onToggleLanguage,
  version = "1.0.0",

  // Data lists
  vocabList    = [],
  verbsList    = [],
  patternsList = [],
  prepsList    = [],
  timeList     = [],

  // Commit callbacks
  onCommitNouns,
  onCommitVerbs,
  onCommitPatterns,
  onCommitPreps,
  onCommitTimes,

  // Optional: noun category list owned by the parent (same props as NounsPage).
  // If omitted, categories are read from / saved to localStorage ("noun_categories").
  nounCategories,
  onCommitNounCategories,
}) {
  const [localLang, setLocalLang] = useState(languageMode);
  const currentLang = onToggleLanguage ? languageMode : localLang;

  const handleLanguageChange = (mode) => {
    if (onToggleLanguage) onToggleLanguage(mode);
    else setLocalLang(mode);
  };

  // Theme
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "light"; } catch { return "light"; }
  });
  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* noop */ }
  }, [theme]);

  const toggleTheme = () => setTheme((p) => (p === "light" ? "dark" : "light"));

  useEffect(() => {
    document.body.classList.toggle("sidebar-open", Boolean(isOpen));
    return () => document.body.classList.remove("sidebar-open");
  }, [isOpen]);

  const versionLabel = BUILD_VERSION ? BUILD_VERSION : `v${version}`;

  // All known noun categories: managed list + any category already used by a noun
  const getKnownNounCategories = () => {
    const known = [
      ...(Array.isArray(nounCategories) ? nounCategories : loadStoredNounCategories()),
    ]
      .map(cleanCat)
      .filter(Boolean);
    vocabList.forEach((i) => {
      const c = cleanCat(i.category);
      if (c && !known.some((k) => sameCat(k, c))) known.push(c);
    });
    return known;
  };

  // ---------------------------------------------------------------
  // Import  (parse -> confirmation page -> apply -> report)
  // ---------------------------------------------------------------

  const fileInputRef = useRef(null);
  const [pending, setPending]     = useState(null); // { fileName, sheets, newCategories }
  const [report, setReport]       = useState(null); // { fileName, sheets, newCategories }
  const [applying, setApplying]   = useState(false);

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // Step 1: read the file and build a plan. Nothing is saved yet.
  const importAllFromExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer   = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      const availableSheets = workbook.SheetNames.map((n) =>
        String(n).trim().toLowerCase()
      );
      const findSheet = (name) => {
        const i = availableSheets.indexOf(name.toLowerCase());
        return i === -1 ? null : workbook.SheetNames[i];
      };

      // Reuse existing categories (case/accent-insensitive); unknown ones are collected
      const known = getKnownNounCategories();
      const createdCategories = [];
      const resolveCategory = (raw) => {
        const clean = cleanCat(raw);
        if (!clean) return "";
        const hit =
          known.find((c) => sameCat(c, clean)) ||
          createdCategories.find((c) => sameCat(c, clean));
        if (hit) return hit;
        createdCategories.push(clean);
        return clean;
      };

      const configs = buildImportConfigs({
        vocabList, verbsList, patternsList, prepsList, timeList,
        onCommitNouns, onCommitVerbs, onCommitPatterns, onCommitPreps, onCommitTimes,
        resolveCategory,
      });

      const sheets = configs
        .map((cfg) => planSheet(cfg, workbook, findSheet))
        .filter(Boolean);

      event.target.value = "";

      if (sheets.length === 0) {
        alert(
          "No supported sheets found.\n\nExpected: Nouns, Patterns, Verbs, Prepositions, German_Uhrzeit"
        );
        return;
      }

      // Only keep new categories that a noun will actually use
      const nounSheet = sheets.find((s) => s.id === "Nouns");
      const newCategories = createdCategories.filter(
        (c) =>
          nounSheet &&
          (nounSheet.newItems.some((i) => sameCat(i.category, c)) ||
            nounSheet.updates.some((u) => sameCat(u.item.category, c)))
      );

      setPending({ fileName: file.name, sheets, newCategories });
      onClose?.(); // close the sidebar so the confirmation page is front and centre
    } catch (err) {
      console.error("Excel import error:", err);
      event.target.value = "";
      alert("Failed to import. Make sure the file is a valid .xlsx or .xls workbook.");
    }
  };

  // Step 2: user confirmed -> write everything, then show the report
  const confirmImport = async () => {
    if (!pending || applying) return;
    setApplying(true);
    try {
      // Save newly created categories (only after the user confirmed)
      if (pending.newCategories?.length) {
        const merged = [];
        [...getKnownNounCategories(), ...pending.newCategories].forEach((c) => {
          if (!merged.some((m) => sameCat(m, c))) merged.push(c);
        });
        if (onCommitNounCategories) {
          onCommitNounCategories(merged);
        } else {
          try {
            localStorage.setItem(NOUN_CATEGORY_KEY, JSON.stringify(merged));
          } catch { /* noop */ }
        }
      }

      for (const sheet of pending.sheets) {
        const hasChanges = sheet.newItems.length || sheet.updates.length;
        if (hasChanges && typeof sheet.commit === "function") {
          await sheet.commit(sheet.finalList);
        }
      }
      setReport({
        fileName: pending.fileName,
        sheets: pending.sheets,
        newCategories: pending.newCategories || [],
      });
      setPending(null);
    } catch (err) {
      console.error("Excel import apply error:", err);
      alert("Import failed while saving. Some sheets may not have been applied.");
    } finally {
      setApplying(false);
    }
  };

  const cancelImport = () => { if (!applying) setPending(null); };

  const sum = (sheets, pick) => sheets.reduce((n, s) => n + pick(s), 0);

  // ---------------------------------------------------------------
  // Export (with live data)
  // ---------------------------------------------------------------

  const exportAllToExcel = () => {
    try {
      const wb     = XLSX.utils.book_new();
      const nowIso = new Date().toISOString();

      // Nouns
      XLSX.utils.book_append_sheet(
        wb,
        createStyledSheet(
          ["#", "Article", "Noun", "Plural", "Meaning", "Category", "Gender", "Status", "Date Added"],
          vocabList.map((item, i) => [
            i + 1,
            item.article  || "",
            item.noun     || "",
            item.plural   || "",
            item.meaning  || "",
            item.category || "",
            item.gender   || genderFromArticle(item.article),
            item.status   || "In Progress",
            item.createdAt || nowIso,
          ]),
          [6, 12, 24, 24, 28, 22, 16, 16, 22],
          [0, 1, 6, 7]
        ),
        "Nouns"
      );

      // Patterns
      XLSX.utils.book_append_sheet(
        wb,
        createStyledSheet(
          ["#", "Article", "Ending", "Rule", "Examples", "Gender", "Status", "Date Added"],
          patternsList.map((item, i) => [
            i + 1,
            item.article  || "",
            item.ending   || "",
            item.rule     || "",
            item.examples || "",
            item.gender   || "",
            item.status   || "In Progress",
            item.createdAt || nowIso,
          ]),
          [6, 12, 20, 32, 36, 16, 16, 22],
          [0, 1, 5, 6]
        ),
        "Patterns"
      );

      // Prepositions
      XLSX.utils.book_append_sheet(
        wb,
        createStyledSheet(
          ["#", "Case", "Preposition", "Meaning", "Example", "Status", "Date Added"],
          prepsList.map((item, i) => [
            i + 1,
            item.caseType || "",
            item.prep     || "",
            item.meaning  || "",
            item.example  || "",
            item.status   || "In Progress",
            item.createdAt || nowIso,
          ]),
          [6, 18, 22, 28, 40, 16, 22],
          [0, 1, 5]
        ),
        "Prepositions"
      );

      // Verbs
      XLSX.utils.book_append_sheet(
        wb,
        createStyledSheet(
          ["#", "Verb", "Case", "Präteritum", "Partizip II", "Auxiliary", "Meaning", "Example", "Status", "Date Added"],
          verbsList.map((item, i) => [
            i + 1,
            item.verb       || "",
            item.case       || "",
            item.preterite  || "",
            item.participle || "",
            item.auxiliary  || "hat",
            item.meaning    || "",
            item.example    || "",
            item.status     || "In Progress",
            item.createdAt  || nowIso,
          ]),
          [6, 22, 18, 18, 20, 14, 28, 40, 16, 22],
          [0, 2, 5, 8]
        ),
        "Verbs"
      );

      // German_Uhrzeit
      XLSX.utils.book_append_sheet(
        wb,
        createStyledSheet(
          ["#", "Digital", "Formal (24h)", "Informal (12h)", "Rule / Pattern", "Status", "Date Added"],
          timeList.map((item, i) => [
            i + 1,
            item.digital  || "",
            item.formal   || "",
            item.informal || "",
            item.rule     || "",
            item.status   || "In Progress",
            item.createdAt || nowIso,
          ]),
          [6, 14, 24, 24, 38, 16, 22],
          [0, 5]
        ),
        "German_Uhrzeit"
      );

      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `German_Vault_All_${date}.xlsx`);
    } catch (err) {
      console.error("Excel export error:", err);
      alert(
        "Failed to export.\n\nMake sure this is installed:\nnpm install xlsx-js-style"
      );
    }
  };

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------

  const pendingNew = pending ? sum(pending.sheets, (s) => s.newItems.length) : 0;
  const pendingUpd = pending ? sum(pending.sheets, (s) => s.updates.length) : 0;
  const pendingSame = pending ? sum(pending.sheets, (s) => s.unchanged) : 0;

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? "open" : ""}`}
        onClick={(e) => e.target === e.currentTarget && onClose()}
        inert={!isOpen}
      >
        <style>{`
          body.sidebar-open .fab-btn { display: none !important; }

          .sidebar {
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .sidebar-header { flex-shrink: 0; }
          .sidebar-nav {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .sidebar-nav::-webkit-scrollbar { display: none; width: 0; height: 0; }

          .sidebar-footer {
            position: sticky;
            bottom: 0;
            flex-shrink: 0;
            margin: auto -20px -24px;
            padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
            background: var(--card);
            border-top: 1px solid var(--line-2);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 600;
            color: var(--muted);
            letter-spacing: 0.02em;
            z-index: 2;
          }
          .sidebar-version {
            padding: 2px 10px;
            border-radius: 999px;
            background: var(--card-inner);
            border: 1px solid var(--line-2);
            color: var(--brand);
            font-weight: 700;
            font-variant-numeric: tabular-nums;
          }

          .sidebar-theme-switch {
            position: relative;
            box-sizing: border-box;
            width: 56px; height: 30px;
            flex-shrink: 0;
            padding: 0;
            border-radius: 999px;
            border: 1px solid var(--line-2);
            background: var(--card-inner);
            cursor: pointer;
            transition: background-color 0.25s ease, border-color 0.25s ease;
          }
          .sidebar-theme-switch:hover { border-color: var(--brand); }
          .sidebar-theme-switch:focus-visible { outline: 3px solid var(--brand); outline-offset: 2px; }
          .sidebar-theme-knob {
            position: absolute;
            top: 2px; left: 2px;
            width: 24px; height: 24px;
            border-radius: 50%;
            background: var(--brand);
            color: #ffffff;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
            transition: transform 0.25s cubic-bezier(0.4,0,0.2,1),
                        background-color 0.25s ease, color 0.25s ease;
          }
          .sidebar-theme-switch.is-dark .sidebar-theme-knob {
            transform: translateX(26px);
            color: #1c1917;
          }
          .sidebar-theme-knob svg { width: 14px; height: 14px; }

          /* Two-column row for Import / Export */
          .excel-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 8px;
          }
          .excel-row .sidebar-tab-btn {
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
            padding: 10px 12px;
          }
          .excel-row .sidebar-tab-btn .nav-count {
            font-size: 10px;
          }
        `}</style>

        <aside className="sidebar">
          {/* Header */}
          <div className="sidebar-header">
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <button
                type="button"
                role="switch"
                aria-checked={isDark}
                aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
                title={`Switch to ${isDark ? "light" : "dark"} mode`}
                className={`sidebar-theme-switch ${isDark ? "is-dark" : ""}`}
                onClick={toggleTheme}
              >
                <span className="sidebar-theme-knob">
                  {isDark ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  )}
                </span>
              </button>
              <span className="sidebar-logo">DEutschly</span>
            </div>

            <button
              type="button"
              className="sidebar-close-btn"
              onClick={(e) => { e.currentTarget.blur(); onClose(); }}
              aria-label="Close sidebar"
            >
              ❌
            </button>
          </div>

          <nav className="sidebar-nav">
            {/* EN / DE toggle */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px",
              backgroundColor: "var(--card-subtle, #f8fafc)",
              border: "1px solid var(--line-2, #e2e8f0)",
              borderRadius: "14px",
              marginBottom: "12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>🌐</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink, #1f2937)", letterSpacing: "0.01em" }}>
                  Study Mode:
                </span>
              </div>
              <div style={{ display: "inline-flex", backgroundColor: "#e2e8f0", borderRadius: "20px", padding: "3px", gap: "2px" }}>
                {["EN", "DE"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleLanguageChange(mode)}
                    style={{
                      padding: "4px 12px", borderRadius: "16px", border: "none",
                      fontSize: "12px", fontWeight: 800, cursor: "pointer",
                      backgroundColor: currentLang === mode ? "#2563eb" : "transparent",
                      color:           currentLang === mode ? "#ffffff" : "#475569",
                      boxShadow:       currentLang === mode ? "0 2px 4px rgba(37,99,235,0.25)" : "none",
                      transition: "all 0.18s ease-in-out",
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Study Goals */}
            <button
              type="button"
              className="sidebar-tab-btn sidebar-goal-btn"
              onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); onClose(); onOpenGoals?.(); }}
            >
              <span>🎯 Study Goals</span>
              <span className="nav-count goal-badge">Daily / Weekly</span>
            </button>

            {/* Report */}
            <button
              type="button"
              className="sidebar-tab-btn sidebar-goal-btn"
              onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); onClose(); onOpenReport?.(); }}
            >
              <span>📊 Report</span>
              <span className="nav-count goal-badge">By date</span>
            </button>

            {/* ── Import / Export (side by side) ── */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={importAllFromExcel}
            />

            <div className="excel-row">
              <button
                type="button"
                className="sidebar-tab-btn sidebar-goal-btn"
                onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); handleImportClick(); }}
              >
                <span>📥 Import</span>
                <span className="nav-count goal-badge">.xlsx</span>
              </button>

              <button
                type="button"
                className="sidebar-tab-btn sidebar-goal-btn"
                onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); exportAllToExcel(); }}
              >
                <span>📤 Export</span>
                <span className="nav-count goal-badge">All sheets</span>
              </button>
            </div>

            <div className="sidebar-divider" />

            {/* Category list */}
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`sidebar-tab-btn ${isActive ? "active" : ""}`}
                  onClick={(e) => { e.currentTarget.blur(); onSelectCategory(cat.id); onClose(); }}
                >
                  <span>{cat.icon} {cat.label || cat.id}</span>
                  <span className="nav-count">{cat.id === "Dashboard" ? "" : (cat.count ?? 0)}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="sidebar-footer">
            <span>DEutschly</span>
            <span className="sidebar-version" title={BUILD_COMMIT ? `Commit ${BUILD_COMMIT}` : undefined}>
              {versionLabel}{BUILD_COMMIT ? ` · ${BUILD_COMMIT}` : ""}
            </span>
          </div>
        </aside>
      </div>

      {/* ── Import confirmation / report pages (rendered outside the sidebar) ── */}
      {(pending || report) && (
        <style>{`
          .imp-backdrop {
            position: fixed; inset: 0; z-index: 10000;
            background: rgba(15, 23, 42, 0.55);
            display: flex; align-items: center; justify-content: center;
            padding: 16px;
          }
          .imp-modal {
            width: 100%; max-width: 560px; max-height: 88vh;
            display: flex; flex-direction: column;
            background: var(--card, #ffffff);
            color: var(--ink, #1f2937);
            border: 1px solid var(--line-2, #e2e8f0);
            border-radius: 18px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.3);
            overflow: hidden;
          }
          .imp-head { padding: 18px 20px 12px; border-bottom: 1px solid var(--line-2, #e2e8f0); }
          .imp-title { margin: 0; font-size: 18px; font-weight: 800; }
          .imp-sub { margin: 4px 0 0; font-size: 12px; color: var(--muted, #64748b); word-break: break-all; }
          .imp-body { padding: 14px 20px; overflow-y: auto; flex: 1 1 auto; min-height: 0; }
          .imp-totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
          .imp-total {
            padding: 10px; text-align: center; border-radius: 12px;
            background: var(--card-inner, #f1f5f9); border: 1px solid var(--line-2, #e2e8f0);
          }
          .imp-total b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
          .imp-total span { font-size: 11px; color: var(--muted, #64748b); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
          .imp-total.new b { color: #16a34a; }
          .imp-total.upd b { color: #2563eb; }
          .imp-sheet { padding: 10px 0; border-top: 1px solid var(--line-2, #e2e8f0); }
          .imp-sheet-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
          .imp-sheet-name { font-weight: 800; margin-right: 4px; }
          .imp-pill {
            padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
            background: var(--card-inner, #f1f5f9); border: 1px solid var(--line-2, #e2e8f0);
            color: var(--muted, #64748b);
          }
          .imp-pill-new { color: #16a34a; border-color: #16a34a55; }
          .imp-pill-upd { color: #2563eb; border-color: #2563eb55; }
          .imp-sheet details { margin-top: 8px; font-size: 13px; }
          .imp-sheet summary { cursor: pointer; font-weight: 700; }
          .imp-list { margin: 6px 0 0; padding-left: 18px; font-size: 13px; }
          .imp-list li { margin: 3px 0; }
          .imp-changes { margin: 2px 0 4px; padding-left: 16px; list-style: circle; color: var(--muted, #64748b); }
          .imp-from { text-decoration: line-through; opacity: 0.7; }
          .imp-to { color: #2563eb; font-weight: 700; }
          .imp-more { list-style: none; color: var(--muted, #64748b); font-style: italic; }
          .imp-note { font-size: 12px; color: var(--muted, #64748b); margin: 0 0 12px; }
          .imp-foot {
            display: flex; justify-content: flex-end; gap: 8px;
            padding: 12px 20px calc(12px + env(safe-area-inset-bottom, 0px));
            border-top: 1px solid var(--line-2, #e2e8f0);
          }
          .imp-btn {
            padding: 9px 16px; border-radius: 12px; font-size: 13px; font-weight: 800;
            cursor: pointer; border: 1px solid var(--line-2, #e2e8f0);
            background: var(--card-inner, #f1f5f9); color: var(--ink, #1f2937);
          }
          .imp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
          .imp-btn-primary { background: #2563eb; border-color: #2563eb; color: #ffffff; }
        `}</style>
      )}

      {/* Confirmation page */}
      {pending && (
        <div className="imp-backdrop" role="dialog" aria-modal="true" aria-label="Confirm import">
          <div className="imp-modal">
            <div className="imp-head">
              <h2 className="imp-title">Confirm import</h2>
              <p className="imp-sub">{pending.fileName}</p>
            </div>

            <div className="imp-body">
              <div className="imp-totals">
                <div className="imp-total new"><b>{pendingNew}</b><span>New</span></div>
                <div className="imp-total upd"><b>{pendingUpd}</b><span>Will update</span></div>
                <div className="imp-total"><b>{pendingSame}</b><span>Unchanged</span></div>
              </div>

              <p className="imp-note">
                The German word is the unique key. Words that already exist are updated
                with the changed values from your file. Empty cells in the file never
                overwrite existing data. Nothing is saved until you confirm.
              </p>

              {pending.newCategories?.length > 0 && (
                <p className="imp-note">
                  <strong>
                    {pending.newCategories.length} new categor
                    {pending.newCategories.length === 1 ? "y" : "ies"} will be created:
                  </strong>{" "}
                  {pending.newCategories.join(", ")}
                </p>
              )}

              {pending.sheets.map((s) => (
                <SheetDetails key={s.id} sheet={s} showUnchanged />
              ))}
            </div>

            <div className="imp-foot">
              <button type="button" className="imp-btn" onClick={cancelImport} disabled={applying}>
                Cancel
              </button>
              {pendingNew + pendingUpd > 0 ? (
                <button
                  type="button"
                  className="imp-btn imp-btn-primary"
                  onClick={confirmImport}
                  disabled={applying}
                >
                  {applying
                    ? "Importing…"
                    : `Confirm (${pendingNew} new, ${pendingUpd} updates)`}
                </button>
              ) : (
                <button type="button" className="imp-btn imp-btn-primary" onClick={cancelImport}>
                  Nothing to import — close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report page */}
      {report && (
        <div className="imp-backdrop" role="dialog" aria-modal="true" aria-label="Import report">
          <div className="imp-modal">
            <div className="imp-head">
              <h2 className="imp-title">Import report</h2>
              <p className="imp-sub">{report.fileName}</p>
            </div>

            <div className="imp-body">
              <div className="imp-totals">
                <div className="imp-total new">
                  <b>{sum(report.sheets, (s) => s.newItems.length)}</b><span>Added</span>
                </div>
                <div className="imp-total upd">
                  <b>{sum(report.sheets, (s) => s.updates.length)}</b><span>Updated</span>
                </div>
                <div className="imp-total">
                  <b>{sum(report.sheets, (s) => s.unchanged)}</b><span>Unchanged</span>
                </div>
              </div>

              {report.newCategories?.length > 0 && (
                <p className="imp-note">
                  <strong>
                    {report.newCategories.length} new categor
                    {report.newCategories.length === 1 ? "y" : "ies"} created:
                  </strong>{" "}
                  {report.newCategories.join(", ")}
                </p>
              )}

              {report.sheets.map((s) => (
                <SheetDetails key={s.id} sheet={s} showUnchanged />
              ))}
            </div>

            <div className="imp-foot">
              <button type="button" className="imp-btn imp-btn-primary" onClick={() => setReport(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 