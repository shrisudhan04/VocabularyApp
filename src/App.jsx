import { useState, useEffect, useRef } from "react";
import "./App.css";

const DB_NAME = "GermanVocabVault";
const DB_VERSION = 9;
const STORE_NAME = "vocabulary_store";
const VERBS_STORE_NAME = "verbs_store";
const PATTERNS_STORE_NAME = "patterns_store";
const PREPOSITIONS_STORE_NAME = "prepositions_store";
const TIME_STORE_NAME = "time_store";

const BACKUP_KEY = "current_vocab_data";
const VERBS_BACKUP_KEY = "current_verbs_data";
const PATTERNS_BACKUP_KEY = "current_patterns_data";
const PREPOSITIONS_BACKUP_KEY = "current_prepositions_data";
const TIME_BACKUP_KEY = "current_time_data";

// ---------- SEED DATA ----------
const SEED_DATA = [
  { id: 1, article: "der", noun: "Mann", plural: "die Männer", gender: "Masculine", meaning: "Male / Man", status: "Mastered", createdAt: "2026-09-01T10:00:00.000Z" },
  { id: 2, article: "die", noun: "Frau", plural: "die Frauen", gender: "Feminine", meaning: "Woman / Wife", status: "In Progress", createdAt: "2026-09-05T11:00:00.000Z" },
  { id: 3, article: "das", noun: "Kind", plural: "die Kinder", gender: "Neuter", meaning: "Child", status: "In Progress", createdAt: "2026-09-10T14:30:00.000Z" },
  { id: 4, article: "der", noun: "Tisch", plural: "die Tische", gender: "Masculine", meaning: "Table", status: "Mastered", createdAt: "2026-09-15T09:20:00.000Z" },
  { id: 5, article: "die", noun: "Sonne", plural: "die Sonnen", gender: "Feminine", meaning: "Sun", status: "Mastered", createdAt: "2026-09-20T16:00:00.000Z" },
  { id: 6, article: "das", noun: "Buch", plural: "die Bücher", gender: "Neuter", meaning: "Book", status: "In Progress", createdAt: "2026-09-25T18:45:00.000Z" },
];

const SEED_VERBS = [
  { id: 101, verb: "sein", preterite: "war", participle: "gewesen", auxiliary: "ist", caseType: "Nominativ", meaning: "to be", example: "Ich war gestern zu Hause.", status: "Mastered", createdAt: "2026-09-01T08:00:00.000Z" },
  { id: 102, verb: "haben", preterite: "hatte", participle: "gehabt", auxiliary: "hat", caseType: "Akkusativ", meaning: "to have", example: "Er hatte keine Zeit.", status: "Mastered", createdAt: "2026-09-02T08:00:00.000Z" },
  { id: 103, verb: "werden", preterite: "wurde", participle: "geworden", auxiliary: "ist", caseType: "Nominativ", meaning: "to become", example: "Sie wurde Ärztin.", status: "In Progress", createdAt: "2026-09-05T12:00:00.000Z" },
  { id: 104, verb: "können", preterite: "konnte", participle: "gekonnt", auxiliary: "hat", caseType: "Akkusativ", meaning: "can / to be able to", example: "Wir konnten den Zug nicht erreichen.", status: "Mastered", createdAt: "2026-09-07T13:00:00.000Z" },
  { id: 105, verb: "müssen", preterite: "musste", participle: "gemusst", auxiliary: "hat", caseType: "Akkusativ", meaning: "must / to have to", example: "Er musste lange im Büro bleiben.", status: "Mastered", createdAt: "2026-09-10T14:00:00.000Z" },
  { id: 106, verb: "gehen", preterite: "ging", participle: "gegangen", auxiliary: "ist", caseType: "Both / Common", meaning: "to go / walk", example: "Wir gingen in den Park.", status: "Mastered", createdAt: "2026-09-12T15:00:00.000Z" },
  { id: 107, verb: "fahren", preterite: "fuhr", participle: "gefahren", auxiliary: "ist", caseType: "Both / Common", meaning: "to drive / ride", example: "Er fuhr mit dem Bus nach Berlin.", status: "Mastered", createdAt: "2026-09-15T09:00:00.000Z" },
  { id: 108, verb: "kommen", preterite: "kam", participle: "gekommen", auxiliary: "ist", caseType: "Both / Common", meaning: "to come", example: "Sie kam viel zu spät zur Besprechung.", status: "Mastered", createdAt: "2026-09-18T10:00:00.000Z" },
  { id: 109, verb: "bleiben", preterite: "blieb", participle: "geblieben", auxiliary: "ist", caseType: "Dativ", meaning: "to stay / remain", example: "Er blieb das ganze Wochenende im Bett.", status: "In Progress", createdAt: "2026-09-20T11:00:00.000Z" },
  { id: 110, verb: "laufen", preterite: "lief", participle: "gelaufen", auxiliary: "ist", caseType: "Akkusativ", meaning: "to run / walk", example: "Das Kind lief schnell über die Straße.", status: "In Progress", createdAt: "2026-09-22T17:00:00.000Z" },
  { id: 111, verb: "helfen", preterite: "half", participle: "geholfen", auxiliary: "hat", caseType: "Dativ", meaning: "to help", example: "Der Kollege half dem Mann sofort.", status: "Mastered", createdAt: "2026-09-24T18:00:00.000Z" },
  { id: 112, verb: "danken", preterite: "dankte", participle: "gedankt", auxiliary: "hat", caseType: "Dativ", meaning: "to thank", example: "Wir dankten der Lehrerin für ihre Geduld.", status: "In Progress", createdAt: "2026-09-26T19:00:00.000Z" },
  { id: 113, verb: "gefallen", preterite: "gefiel", participle: "gefallen", auxiliary: "hat", caseType: "Dativ", meaning: "to appeal to / to please", example: "Das neue Design gefiel dem Chef sehr gut.", status: "In Progress", createdAt: "2026-09-28T20:00:00.000Z" },
  { id: 114, verb: "gehören", preterite: "gehörte", participle: "gehört", auxiliary: "hat", caseType: "Dativ", meaning: "to belong to", example: "Dieses alte Buch gehörte meinem Großvater.", status: "Mastered", createdAt: "2026-09-29T21:00:00.000Z" },
  { id: 115, verb: "sehen", preterite: "sah", participle: "gesehen", auxiliary: "hat", caseType: "Akkusativ", meaning: "to see", example: "Ich sah einen Vogel auf dem Dach.", status: "Mastered", createdAt: "2026-09-30T07:30:00.000Z" },
  { id: 116, verb: "lesen", preterite: "las", participle: "gelesen", auxiliary: "hat", caseType: "Akkusativ", meaning: "to read", example: "Er las den Vertrag sehr aufmerksam.", status: "In Progress", createdAt: "2026-10-01T08:45:00.000Z" },
  { id: 117, verb: "schreiben", preterite: "schrieb", participle: "geschrieben", auxiliary: "hat", caseType: "Akkusativ", meaning: "to write", example: "Sie schrieb eine lange E-Mail.", status: "Mastered", createdAt: "2026-10-02T10:15:00.000Z" },
  { id: 118, verb: "finden", preterite: "fand", participle: "gefunden", auxiliary: "hat", caseType: "Akkusativ", meaning: "to find", example: "Endlich fand er den passenden Schlüssel.", status: "Mastered", createdAt: "2026-10-03T11:00:00.000Z" },
  { id: 119, verb: "trinken", preterite: "trank", participle: "getrunken", auxiliary: "hat", caseType: "Akkusativ", meaning: "to drink", example: "Wir tranken zusammen einen warmen Tee.", status: "In Progress", createdAt: "2026-10-03T14:20:00.000Z" },
  { id: 120, verb: "essen", preterite: "aß", participle: "gegessen", auxiliary: "hat", caseType: "Akkusativ", meaning: "to eat", example: "Er aß ein frisches Brötchen zum Frühstück.", status: "Mastered", createdAt: "2026-10-04T09:00:00.000Z" },
  { id: 121, verb: "geben", preterite: "gab", participle: "gegeben", auxiliary: "hat", caseType: "Both / Common", meaning: "to give", example: "Ich gab dem Kind das bunte Buch.", status: "Mastered", createdAt: "2026-10-04T11:15:00.000Z" },
  { id: 122, verb: "bringen", preterite: "brachte", participle: "gebracht", auxiliary: "hat", caseType: "Both / Common", meaning: "to bring", example: "Der Kellner brachte dem Gast das Essen.", status: "In Progress", createdAt: "2026-10-04T12:00:00.000Z" },
  { id: 123, verb: "schenken", preterite: "schenkte", participle: "geschenkt", auxiliary: "hat", caseType: "Both / Common", meaning: "to gift", example: "Er schenkte seiner Freundin eine weiße Blume.", status: "In Progress", createdAt: "2026-10-04T13:30:00.000Z" },
  { id: 124, verb: "erklären", preterite: "erklärte", participle: "erklärt", auxiliary: "hat", caseType: "Both / Common", meaning: "to explain", example: "Der Lehrer erklärte den Schülern die Grammatikregel.", status: "Mastered", createdAt: "2026-10-04T14:45:00.000Z" },
];

const SEED_PATTERNS = [
  { id: "p1", article: "der", ending: "-ling", rule: "Living beings or objects with qualities", examples: "der Schmetterling, der Lehrling", createdAt: "2026-09-01T10:00:00.000Z" },
  { id: "p2", article: "der", ending: "-or", rule: "Mostly professions / technical terms", examples: "der Motor, der Reaktor, der Autor", createdAt: "2026-09-05T10:00:00.000Z" },
  { id: "p3", article: "der", ending: "-ismus", rule: "Doctrines, movements, or ideologies", examples: "der Optimismus, der Realismus", createdAt: "2026-09-10T10:00:00.000Z" },
  { id: "p4", article: "der", ending: "-er", rule: "Male agents, tools, nationalities", examples: "der Fahrer, der Lehrer, der Computer", createdAt: "2026-09-15T10:00:00.000Z" },
  { id: "p5", article: "der", ending: "Days & Seasons", rule: "Days of week, months, seasons, compass points", examples: "der Montag, der Juli, der Sommer, der Norden", createdAt: "2026-09-20T10:00:00.000Z" },
  { id: "p6", article: "die", ending: "-ung", rule: "Action or state nouns from verbs (almost 100%)", examples: "die Zeitung, die Hoffnung, die Wohnung", createdAt: "2026-09-22T10:00:00.000Z" },
  { id: "p7", article: "die", ending: "-heit / -keit", rule: "Abstract qualities or traits", examples: "die Freiheit, die Schönheit, die Möglichkeit", createdAt: "2026-09-25T10:00:00.000Z" },
  { id: "p8", article: "die", ending: "-schaft", rule: "Collectives, relationships, conditions", examples: "die Freundschaft, die Mannschaft", createdAt: "2026-09-28T10:00:00.000Z" },
  { id: "p9", article: "die", ending: "-tät / -ion", rule: "Words of Latin origin", examples: "die Universität, die Station, die Nation", createdAt: "2026-10-01T10:00:00.000Z" },
  { id: "p10", article: "die", ending: "-in", rule: "Female job titles and roles", examples: "die Ärztin, die Lehrerin, die Studentin", createdAt: "2026-10-02T10:00:00.000Z" },
  { id: "p11", article: "das", ending: "-chen / -lein", rule: "Diminutives (small things/affectionate)", examples: "das Mädchen, das Brötchen, das Fräulein", createdAt: "2026-10-02T12:00:00.000Z" },
  { id: "p12", article: "das", ending: "-ment", rule: "Objects, concepts of French/Latin origin", examples: "das Instrument, das Dokument, das Experiment", createdAt: "2026-10-03T10:00:00.000Z" },
  { id: "p13", article: "das", ending: "-um", rule: "Latin origin nouns", examples: "das Zentrum, das Museum, das Datum", createdAt: "2026-10-03T11:00:00.000Z" },
  { id: "p14", article: "das", ending: "-tum", rule: "States, properties (most)", examples: "das Eigentum, das Wachstum", createdAt: "2026-10-04T08:00:00.000Z" },
  { id: "p15", article: "das", ending: "Verbal Nouns", rule: "Infinitive verbs used as nouns", examples: "das Essen, das Leben, das Schwimmen", createdAt: "2026-10-04T09:00:00.000Z" },
];

const SEED_PREPOSITIONS = [
  { id: 201, prep: "durch", caseType: "Akkusativ", meaning: "through", example: "Wir gehen durch den Park.", status: "Mastered", createdAt: "2026-09-01T10:00:00.000Z" },
  { id: 202, prep: "für", caseType: "Akkusativ", meaning: "for", example: "Das Geschenk ist für dich.", status: "Mastered", createdAt: "2026-09-05T10:00:00.000Z" },
  { id: 203, prep: "ohne", caseType: "Akkusativ", meaning: "without", example: "Ohne meinen Kaffee kann ich nicht aufstehen.", status: "Mastered", createdAt: "2026-09-10T10:00:00.000Z" },
  { id: 204, prep: "aus", caseType: "Dativ", meaning: "out of / from", example: "Er kommt aus der Schweiz.", status: "Mastered", createdAt: "2026-09-15T10:00:00.000Z" },
  { id: 205, prep: "mit", caseType: "Dativ", meaning: "with", example: "Ich fahre mit dem Zug.", status: "Mastered", createdAt: "2026-09-20T10:00:00.000Z" },
  { id: 206, prep: "nach", caseType: "Dativ", meaning: "after / to (city/country)", example: "Nach der Arbeit gehe ich nach Hause.", status: "In Progress", createdAt: "2026-09-25T10:00:00.000Z" },
  { id: 207, prep: "in", caseType: "Wechsel", meaning: "in / into (Dat: location, Akk: direction)", example: "Ich bin im Haus (Dat). Ich gehe ins Haus (Akk).", status: "Mastered", createdAt: "2026-09-30T10:00:00.000Z" },
  { id: 208, prep: "auf", caseType: "Wechsel", meaning: "on / onto (horizontal)", example: "Das Buch liegt auf dem Tisch (Dat).", status: "In Progress", createdAt: "2026-10-02T10:00:00.000Z" },
  { id: 209, prep: "an", caseType: "Wechsel", meaning: "at / on (vertical edge)", example: "Das Bild hängt an der Wand (Dat).", status: "In Progress", createdAt: "2026-10-04T10:00:00.000Z" },
];

const SEED_TIME = [
  { id: "t1", digital: "08:00", formal: "Es ist acht Uhr.", informal: "Es ist acht.", rule: "Exact hour (volle Stunde)" },
  { id: "t2", digital: "08:05", formal: "Es ist acht Uhr fünf.", informal: "Es ist fünf nach acht.", rule: "5 past (nach)" },
  { id: "t3", digital: "08:15", formal: "Es ist acht Uhr fünfzehn.", informal: "Es ist Viertel nach acht.", rule: "Quarter past (Viertel nach)" },
  { id: "t4", digital: "08:20", formal: "Es ist acht Uhr zwanzig.", informal: "Es ist zwanzig nach acht / zehn vor halb neun.", rule: "20 past or 10 before half" },
  { id: "t5", digital: "08:25", formal: "Es ist acht Uhr fünfundzwanzig.", informal: "Es ist fünf vor halb neun.", rule: "5 before half past" },
  { id: "t6", digital: "08:30", formal: "Es ist acht Uhr dreißig.", informal: "Es ist halb neun.", rule: "Half past ('halfway to next hour')" },
  { id: "t7", digital: "08:35", formal: "Es ist acht Uhr fünfunddreißig.", informal: "Es ist fünf nach halb neun.", rule: "5 past half past" },
  { id: "t8", digital: "08:40", formal: "Es ist acht Uhr vierzig.", informal: "Es ist zwanzig vor neun / zehn nach halb neun.", rule: "20 to or 10 past half" },
  { id: "t9", digital: "08:45", formal: "Es ist acht Uhr fünfundvierzig.", informal: "Es ist Viertel vor neun.", rule: "Quarter to (Viertel vor)" },
  { id: "t10", digital: "08:50", formal: "Es ist acht Uhr fünfzig.", informal: "Es ist zehn vor neun.", rule: "10 to (vor)" },
  { id: "t11", digital: "14:15", formal: "Es ist vierzehn Uhr fünfzehn.", informal: "Es ist Viertel nach zwei.", rule: "Afternoon 24h vs. 12h" },
  { id: "t12", digital: "20:30", formal: "Es ist zwanzig Uhr dreißig.", informal: "Es ist halb neun (abends).", rule: "Evening 24h vs. 12h" },
];

const GRAMMAR_TOPICS = [
  { id: "possessives", label: "Possessivartikel (mein, dein)" },
  { id: "articles", label: "Articles (der / ein / kein)" },
  { id: "demonstratives", label: "Demonstratives (dieser, welcher)" },
  { id: "personal", label: "Personal Pronouns (mich, mir)" },
  { id: "adjectives", label: "Adjective Endings" },
];

const POSSESSIVE_STEMS = [
  { owner: "ich (I)", stem: "mein" },
  { owner: "du (you sg.)", stem: "dein" },
  { owner: "er (he)", stem: "sein" },
  { owner: "sie (she)", stem: "ihr" },
  { owner: "es (it)", stem: "sein" },
  { owner: "wir (we)", stem: "unser" },
  { owner: "ihr (you pl.)", stem: "euer" },
  { owner: "sie (they)", stem: "ihr" },
  { owner: "Sie (formal)", stem: "Ihr" },
];

const POSSESSIVE_ENDINGS = {
  Nominativ: { m: "–", f: "-e", n: "–", pl: "-e" },
  Akkusativ: { m: "-en", f: "-e", n: "–", pl: "-e" },
  Dativ: { m: "-em", f: "-er", n: "-em", pl: "-en" },
  Genitiv: { m: "-es", f: "-er", n: "-es", pl: "-er" },
};

const ARTICLES_TABLE = {
  Nominativ: { def_m: "der", def_f: "die", def_n: "das", def_pl: "die", indef_m: "ein", indef_f: "eine", indef_n: "ein", neg_pl: "keine" },
  Akkusativ: { def_m: "den", def_f: "die", def_n: "das", def_pl: "die", indef_m: "einen", indef_f: "eine", indef_n: "ein", neg_pl: "keine" },
  Dativ: { def_m: "dem", def_f: "der", def_n: "dem", def_pl: "den (+n)", indef_m: "einem", indef_f: "einer", indef_n: "einem", neg_pl: "keinen (+n)" },
  Genitiv: { def_m: "des (+s)", def_f: "der", def_n: "des (+s)", def_pl: "der", indef_m: "eines (+s)", indef_f: "einer", indef_n: "eines (+s)", neg_pl: "keiner" },
};

const DEMONSTRATIVES_TABLE = {
  Nominativ: { m: "dieser", f: "diese", n: "dieses", pl: "diese", wm: "welcher", wf: "welche", wn: "welches", wpl: "welche" },
  Akkusativ: { m: "diesen", f: "diese", n: "dieses", pl: "diese", wm: "welchen", wf: "welche", wn: "welches", wpl: "welche" },
  Dativ: { m: "diesem", f: "dieser", n: "diesem", pl: "diesen (+n)", wm: "welchem", wf: "welcher", wn: "welchem", wpl: "welchen (+n)" },
  Genitiv: { m: "dieses", f: "dieser", n: "dieses", pl: "dieser", wm: "welches", wf: "welcher", wn: "welches", wpl: "welcher" },
};

const PERSONAL_PRONOUNS_TABLE = [
  { p: "ich (I)", nom: "ich", akk: "mich", dat: "mir" },
  { p: "du (you)", nom: "du", akk: "dich", dat: "dir" },
  { p: "er (he)", nom: "er", akk: "ihn", dat: "ihm" },
  { p: "sie (she)", nom: "sie", akk: "sie", dat: "ihr" },
  { p: "es (it)", nom: "es", akk: "es", dat: "ihm" },
  { p: "wir (we)", nom: "wir", akk: "uns", dat: "uns" },
  { p: "ihr (you pl.)", nom: "ihr", akk: "euch", dat: "euch" },
  { p: "sie (they)", nom: "sie", akk: "sie", dat: "ihnen" },
  { p: "Sie (formal)", nom: "Sie", akk: "Sie", dat: "Ihnen" },
];

const ADJECTIVE_ENDINGS_RULES = [
  { type: "Weak (after der/die/das)", nom: "m: -e, f: -e, n: -e, pl: -en", akk: "m: -en, f: -e, n: -e, pl: -en", dat: "all: -en", gen: "all: -en" },
  { type: "Mixed (after ein/kein/mein)", nom: "m: -er, f: -e, n: -es, pl: -en", akk: "m: -en, f: -e, n: -es, pl: -en", dat: "all: -en", gen: "all: -en" },
  { type: "Strong (zero article)", nom: "m: -er, f: -e, n: -es, pl: -e", akk: "m: -en, f: -e, n: -es, pl: -e", dat: "m: -em, f: -er, n: -em, pl: -en", gen: "m: -en, f: -er, n: -en, pl: -er" },
];

const TIME_RULES = [
  { term: "Formal (Offiziell)", desc: "Uses the 24-hour clock. Pattern: [Stunde] + Uhr + [Minute]. No 'vor', 'nach', or 'halb'." },
  { term: "Informal (Umgangssprachlich)", desc: "Uses the 12-hour clock. Expressed relative to the hour using 'vor' (before), 'nach' (after), and 'halb' (halfway to)." },
  { term: "halb [Stunde]", desc: "Crucial rule: 'halb neun' means 08:30 (halfway to nine), NOT 09:30." },
  { term: "Viertel vor / nach", desc: "'Viertel nach' = 15 minutes past; 'Viertel vor' = 15 minutes before the next hour." },
  { term: "Key Questions", desc: "Wie spät ist es? / Wie viel Uhr ist es? (What time is it?) | Um wie viel Uhr...? (At what time...?)" },
];

const TIME_FLASHCARDS = [
  { id: "tf1", prompt: "Informal Time: 07:30", answer: "Es ist halb acht.", note: "'halb' looks forward to the next hour (8)." },
  { id: "tf2", prompt: "Formal Time: 15:45", answer: "Es ist fünfzehn Uhr fünfundvierzig.", note: "Pattern: [Hour 24h] + Uhr + [Minute]." },
  { id: "tf3", prompt: "Informal Time: 10:15", answer: "Es ist Viertel nach zehn.", note: "Quarter past takes 'nach'." },
  { id: "tf4", prompt: "Informal Time: 11:25", answer: "Es ist fünf vor halb zwölf.", note: "Measured relative to 11:30 (halb zwölf)." },
  { id: "tf5", prompt: "Informal Time: 09:40", answer: "Es ist zwanzig vor zehn.", note: "20 minutes before 10 o'clock." },
];

const TIME_QUIZ = [
  { q: "Wie spät ist es um 14:30? (Informell)", answer: "halb drei", options: ["halb zwei", "halb drei", "zwei Uhr dreißig"], expl: "'halb' points to the upcoming hour (3), so 14:30 is 'halb drei'." },
  { q: "Wie sagt man 18:15 offiziell (Formal)?", answer: "achtzehn Uhr fünfzehn", options: ["Viertel nach sechs", "achtzehn Uhr fünfzehn", "sechs Uhr fünfzehn"], expl: "Formal uses 24h format: [Hour] Uhr [Minutes]." },
  { q: "Was bedeutet 'Es ist Viertel vor fünf'?", answer: "04:45 / 16:45", options: ["04:15 / 16:15", "05:15 / 17:15", "04:45 / 16:45"], expl: "'Viertel vor' means 15 minutes before the hour." },
  { q: "Wie heißt 08:25 umgangssprachlich?", answer: "fünf vor halb neun", options: ["fünfundzwanzig nach acht", "fünf nach halb acht", "fünf vor halb neun"], expl: "German relates 25 past to half-past: 5 before half 9." },
];

const GRAMMAR_FLASHCARDS = [
  { id: "g1", prompt: "ich + Akkusativ + Maskulin Possessive", answer: "meinen", note: "z.B. Ich sehe meinen Bruder." },
  { id: "g2", prompt: "ihr (you pl.) + Dativ + Maskulin Possessive", answer: "eurem", note: "Achtung: euer drops 'e' -> eurem." },
  { id: "g3", prompt: "Personal Pronoun: du in Dativ", answer: "dir", note: "z.B. Wie geht es dir?" },
  { id: "g4", prompt: "Personal Pronoun: er in Akkusativ", answer: "ihn", note: "z.B. Ich kenne ihn gut." },
  { id: "g5", prompt: "Demonstrative: 'this' + Dativ Maskulin", answer: "diesem", note: "z.B. In diesem Zimmer." },
  { id: "g6", prompt: "Negative: kein + Akkusativ Maskulin", answer: "keinen", note: "z.B. Ich habe keinen Hunger." },
  { id: "g7", prompt: "Definite: Dativ Plural Article", answer: "den (+n)", note: "z.B. mit den Freunden." },
  { id: "g8", prompt: "Adjective: ein + groß- + Maskulin Nominativ", answer: "ein großer", note: "Mixed declension takes -er for masculine." },
];

const GRAMMAR_QUIZ = [
  { q: "Ich helfe ___ Bruder. (mein)", answer: "meinem", options: ["mein", "meinen", "meinem"], expl: "helfen + Dativ (Maskulin: -em)" },
  { q: "Wir besuchen ___ Eltern. (unser)", answer: "unsere", options: ["unser", "unseren", "unsere"], expl: "besuchen + Akkusativ (Plural: -e)" },
  { q: "Er gibt ___ Schwester ein Buch. (sein)", answer: "seiner", options: ["seine", "seiner", "seinem"], expl: "geben + Dativ (Feminin: -er)" },
  { q: "Ich habe ___ Zeit heute. (kein)", answer: "keine", options: ["kein", "keine", "keinen"], expl: "Zeit ist Feminin (Akkusativ: -e)" },
  { q: "In ___ Restaurant essen wir? (welcher, Dativ Neutrum)", answer: "welchem", options: ["welcher", "welchen", "welchem"], expl: "in + Dativ Neutrum nimmt -em" },
  { q: "Kannst du ___ bitte helfen? (ich, Dativ)", answer: "mir", options: ["mich", "mir", "meinem"], expl: "helfen verlangt Dativ -> mir" },
  { q: "Das ist das Auto ___ Vaters. (dieser, Genitiv)", answer: "dieses", options: ["diesem", "dieser", "dieses"], expl: "Genitiv Maskulin: dieses Vaters" },
  { q: "Das ist ein ___ Tag. (schön, Nom Masc)", answer: "schöner", options: ["schöne", "schöner", "schönen"], expl: "ein + Adjektiv (Maskulin Nominativ: -er)" },
];

const DATE_OPTIONS = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "week", label: "Past 7 Days" },
  { value: "month", label: "Past 30 Days" },
  { value: "custom", label: "Specific Date..." },
];

const STATUS_OPTIONS = [
  { value: "In Progress", label: "In Progress" },
  { value: "Mastered", label: "Mastered" },
];

// ---------- INDEXEDDB HELPERS ----------
function openVaultDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(VERBS_STORE_NAME)) db.createObjectStore(VERBS_STORE_NAME);
      if (!db.objectStoreNames.contains(PATTERNS_STORE_NAME)) db.createObjectStore(PATTERNS_STORE_NAME);
      if (!db.objectStoreNames.contains(PREPOSITIONS_STORE_NAME)) db.createObjectStore(PREPOSITIONS_STORE_NAME);
      if (!db.objectStoreNames.contains(TIME_STORE_NAME)) db.createObjectStore(TIME_STORE_NAME);
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

// ---------- CSS STYLES ----------
const CSS = `
:root {
  --bg: #fcfaf7;
  --card: #ffffff;
  --card-inner: #f5f0e8;
  --line: #ede5d8;
  --line-2: #ded2bf;
  --ink: #292524;
  --ink-2: #44403c;
  --muted: #78716c;
  --faint: #a8a29e;
  --brand: #b45309;
  --danger: #dc2626;

  --der: #0369a1; --der-bg: #e0f2fe;
  --die: #be123c; --die-bg: #ffe4e6;
  --das: #15803d; --das-bg: #dcfce7;
  --dativ: #6d28d9; --dativ-bg: #ede9fe;
  --akku: #c2410c; --akku-bg: #ffedd5;
  --both: #0e7490; --both-bg: #cffafe;
  --wechsel: #b45309; --wechsel-bg: #fef3c7;

  --modal-bg: #ffffff;
  --input-bg: #fcfaf7;
}

[data-theme="dark"] {
  --bg: #1c1917;
  --card: #292524;
  --card-inner: #201d1b;
  --line: #3c3836;
  --line-2: #57534e;
  --ink: #fafaf9;
  --ink-2: #e7e5e4;
  --muted: #a8a29e;
  --faint: #78716c;
  --brand: #f59e0b;
  --danger: #ef4444;

  --der: #38bdf8; --der-bg: rgba(56, 189, 248, 0.2);
  --die: #fb7185; --die-bg: rgba(251, 113, 133, 0.2);
  --das: #4ade80; --das-bg: rgba(74, 222, 128, 0.2);
  --dativ: #c084fc; --dativ-bg: rgba(192, 132, 252, 0.2);
  --akku: #fb923c; --akku-bg: rgba(251, 146, 60, 0.2);
  --both: #22d3ee; --both-bg: rgba(34, 211, 238, 0.2);
  --wechsel: #facc15; --wechsel-bg: rgba(250, 204, 21, 0.2);

  --modal-bg: #292524;
  --input-bg: #1c1917;
}

html, body, #root { margin: 0 !important; padding: 0 !important; width: 100% !important; min-height: 100vh; background: var(--bg); color: var(--ink); }
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
button, input, select, textarea { font-family: inherit; }
button { cursor: pointer; }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

/* Top Header Bar */
.app-header {
  position: sticky;
  top: 0;
  z-index: 80;
  width: 100%;
  background: var(--bg);
  border-bottom: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
}
.kebab-btn {
  background: transparent;
  border: none;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
}
.hamburger-icon {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 22px;
  height: 18px;
}
.hamburger-icon span {
  display: block;
  height: 4px;
  width: 100%;
  background: #b85202;
  border-radius: 999px;
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.kebab-btn:hover {
  background: var(--card-inner);
  border-color: var(--brand);
  color: var(--brand);
}
.app-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--brand);
  text-align: center;
}
.header-spacer { width: 40px; }

/* Sidebar Drawer */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  z-index: 1000;
  display: flex;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s ease, visibility 0.25s ease;
}
.sidebar-overlay.open { opacity: 1; visibility: visible; }
.sidebar {
  width: 320px;
  max-width: 85vw;
  height: 100%;
  background: var(--card);
  border-right: 1px solid var(--line-2);
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transform: translateX(-100%);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 10px 0 25px rgba(0,0,0,0.15);
}
.sidebar-overlay.open .sidebar { transform: translateX(0); }
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}
.sidebar-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--ink);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}
.sidebar-close-btn {
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--muted);
  padding: 4px 8px;
  border-radius: 6px;
}
.sidebar-close-btn:hover { color: var(--danger); background: var(--card-inner); }
.sidebar-nav { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.sidebar-tab-btn {
  border: 1px solid transparent;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 14.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--card-inner);
  color: var(--ink-2);
  transition: all 0.18s ease;
  width: 100%;
  text-align: left;
}
.sidebar-tab-btn:hover { border-color: var(--brand); color: var(--brand); background: var(--card); }
.sidebar-tab-btn.active {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand);
  box-shadow: 0 4px 10px rgba(180, 83, 9, 0.3);
}

.page {
  background: var(--bg);
  min-height: calc(100vh - 65px);
  width: 100%;
  padding: 20px 32px 36px;
  display: flex;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--ink);
}
.container { width: 100%; max-width: 1400px; display: flex; flex-direction: column; gap: 20px; min-width: 0; }

.btn {
  border-radius: 8px;
  padding: 10px 16px;
  font-weight: 600;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  min-height: 40px;
}
.btn-primary { background: var(--brand); color: #fff; border: none; }
.btn-secondary { background: var(--card); color: var(--ink); border: 1px solid var(--line-2); }
.btn-danger { background: var(--danger); color: #fff; border: none; }
.btn[disabled] { opacity: .45; cursor: not-allowed; }
.fab { display: none; }

.sub-tabs-bar { display: flex; width: 100%; padding-bottom: 4px; }
.sub-tabs { display: flex; width: 100%; background: var(--line-2); padding: 5px; border-radius: 12px; gap: 6px; }
.sub-tab {
  flex: 1;
  border: none;
  padding: 10px 16px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: transparent;
  color: var(--muted);
  text-align: center;
  white-space: nowrap;
}
.sub-tab.active { background: var(--brand); color: #fff; box-shadow: 0 2px 6px rgba(180, 83, 9, .35); }

.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 18px 20px;
  min-height: 105px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.stat.dark { background: #1c1917; border-color: #3c3836; color: #fff; }
.stat-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.stat-label { font-size: 11px; font-weight: 700; color: var(--muted); letter-spacing: .6px; }
.stat.dark .stat-label { color: #a8a29e; }
.stat-pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.stat-pill.dark { background: #292524; color: #f59e0b; font-weight: 600; }
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

.section { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  background: var(--card);
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--line);
}
.search { position: relative; flex: 1 1 240px; max-width: 380px; }
.search span { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 13px; }
.search input {
  width: 100%;
  padding: 10px 14px 10px 38px;
  border-radius: 10px;
  border: 1px solid var(--line-2);
  background: var(--bg);
  color: var(--ink);
  font-size: 14px;
  min-height: 40px;
}

.filters-cluster { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.filters { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.filters-label { font-size: 12px; color: var(--muted); font-weight: 700; }
.chip {
  border: 1px solid;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  min-height: 34px;
}
.chip.all  { background: var(--card-inner); color: var(--ink-2); border-color: var(--line-2); }
.chip.der  { background: var(--der-bg); color: var(--der); border-color: var(--der); }
.chip.die  { background: var(--die-bg); color: var(--die); border-color: var(--die); }
.chip.das  { background: var(--das-bg); color: var(--das); border-color: var(--das); }
.chip.dativ { background: var(--dativ-bg); color: var(--dativ); border-color: var(--dativ); }
.chip.akku { background: var(--akku-bg); color: var(--akku); border-color: var(--akku); }
.chip.both { background: var(--both-bg); color: var(--both); border-color: var(--both); }
.chip.wechsel { background: var(--wechsel-bg); color: var(--wechsel); border-color: var(--wechsel); }

.chip.all.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.chip.der.on { background: var(--der); color: #fff; border-color: var(--der); }
.chip.die.on { background: var(--die); color: #fff; border-color: var(--die); }
.chip.das.on { background: var(--das); color: #fff; border-color: var(--das); }
.chip.dativ.on { background: var(--dativ); color: #fff; border-color: var(--dativ); }
.chip.akku.on { background: var(--akku); color: #fff; border-color: var(--akku); }
.chip.both.on { background: var(--both); color: #fff; border-color: var(--both); }
.chip.wechsel.on { background: var(--wechsel); color: #fff; border-color: var(--wechsel); }

.date-select {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--line-2);
  background: var(--bg);
  color: var(--ink);
  font-size: 12.5px;
  font-weight: 600;
  min-height: 36px;
}

/* Custom Animated Dropdown */
.dropdown-container { position: relative; display: inline-block; user-select: none; }
.dropdown-container.full-width { display: block; width: 100%; }
.dropdown-trigger {
  min-height: 38px;
  padding: 8px 14px;
  border-radius: 9px;
  border: 1px solid var(--line-2);
  background: var(--card);
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.dropdown-trigger:hover { border-color: var(--brand); }
.dropdown-arrow { font-size: 10px; color: var(--muted); transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.dropdown-container.open .dropdown-arrow { transform: rotate(180deg); }
.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 100%;
  width: max-content;
  background: var(--card);
  border: 1px solid var(--line-2);
  border-radius: 10px;
  padding: 5px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
  z-index: 100;
  overflow: hidden;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-8px) scale(0.97);
  transform-origin: top center;
  transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.22s;
  pointer-events: none;
}
.dropdown-container.open .dropdown-menu { opacity: 1; visibility: visible; transform: translateY(0) scale(1); pointer-events: auto; }
.dropdown-item {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 8px 12px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.dropdown-item:hover { background: var(--card-inner); color: var(--brand); }
.dropdown-item.active { background: var(--card-inner); color: var(--brand); font-weight: 700; }

.list { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 8px 16px 16px; overflow-x: auto; }
.list-head { padding: 12px 8px; font-size: 11px; font-weight: 700; color: var(--faint); letter-spacing: .5px; border-bottom: 1px solid var(--line); }

.nouns-head, .noun-row {
  display: grid;
  grid-template-columns: 48px 80px 180px 180px 1fr 140px 120px !important;
  gap: 16px;
  align-items: center;
}
.verbs-head, .verb-row {
  display: grid;
  grid-template-columns: 44px 90px 140px 170px 160px 1fr 130px 110px !important;
  gap: 14px;
  align-items: center;
}
.preps-head, .prep-row {
  display: grid;
  grid-template-columns: 48px 110px 140px 200px 1fr 130px 120px !important;
  gap: 16px;
  align-items: center;
}

.row { padding: 14px 8px; border-bottom: 1px solid var(--line); font-size: 13px; color: var(--ink); }
.row:last-child { border-bottom: none; }
.c-idx { text-align: center; color: var(--faint); font-weight: 500; }
.noun-wrap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pill { padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block; }
.gender { color: var(--faint); font-size: 12px; font-weight: 500; }
.c-plural { color: var(--muted); font-size: 13px; font-style: italic; }
.c-past { color: var(--brand); font-size: 12.5px; font-weight: 600; font-family: monospace; }
.c-mean { color: var(--ink-2); font-weight: 600; }
.c-eg { color: var(--muted); font-size: 12px; font-style: italic; }
.status { border: 1px solid; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.status.done { background: var(--das-bg); border-color: var(--das); color: var(--das); }
.status.todo { background: var(--card-inner); border-color: var(--line-2); color: var(--muted); }
.actions { display: flex; gap: 6px; justify-content: flex-end; }
.icon-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  background: var(--card-inner);
  border: 1px solid var(--line-2);
  border-radius: 8px;
  color: var(--ink);
}

.patterns-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.pattern-col {
  background: var(--card);
  border: 1px solid var(--line);
  border-top: 4px solid transparent;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.pattern-col.der { border-top-color: var(--der); }
.pattern-col.die { border-top-color: var(--die); }
.pattern-col.das { border-top-color: var(--das); }
.pattern-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.pattern-header h3 { margin: 0; font-size: 18px; }
.pattern-card { background: var(--card-inner); border: 1px solid var(--line-2); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.pattern-card-top { display: flex; justify-content: space-between; align-items: center; }
.pattern-badge { align-self: flex-start; font-weight: 700; font-size: 13px; font-family: monospace; padding: 3px 8px; border-radius: 6px; }
.pattern-delete-btn { background: none; border: none; font-size: 13px; opacity: .5; padding: 2px; color: var(--ink); cursor: pointer; }
.pattern-delete-btn:hover { opacity: 1; color: var(--danger); }
.pattern-rule { font-size: 12.5px; color: var(--ink-2); font-weight: 500; margin: 0; }
.pattern-eg { font-size: 12px; color: var(--muted); font-style: italic; margin: 0; }

.grammar-hub-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 24px; display: flex; flex-direction: column; gap: 18px; }
.grammar-topic-nav { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
.grammar-topic-btn { border: 1px solid var(--line-2); background: var(--card-inner); padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; color: var(--ink-2); white-space: nowrap; }
.grammar-topic-btn.active { background: var(--brand); color: #fff; border-color: var(--brand); }

.table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--line-2); border-radius: 10px; }
.grammar-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13.5px; background: var(--card); }
.grammar-table th { background: var(--card-inner); padding: 12px 16px; border-bottom: 2px solid var(--line-2); color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.grammar-table td { padding: 12px 16px; border-bottom: 1px solid var(--line); color: var(--ink); }
.grammar-highlight { font-weight: 700; color: var(--brand); }
.grammar-rule-box { background: var(--card-inner); border-left: 4px solid var(--brand); padding: 14px 18px; border-radius: 0 8px 8px 0; font-size: 13.5px; color: var(--ink-2); }

.panel { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 48px 24px; text-align: center; }
.flash-wrap { display: flex; flex-direction: column; align-items: center; gap: 24px; }
.flash {
  width: min(480px, 100%);
  min-height: 250px;
  background: var(--card-inner);
  border: 2px dashed var(--line-2);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  cursor: pointer;
  user-select: none;
}
.flash h2 { font-size: 42px; margin: 16px 0; overflow-wrap: anywhere; color: var(--ink); font-weight: 700; }
.flash-controls { display: flex; gap: 12px; align-items: center; }

.quiz { max-width: 480px; margin: 0 auto; text-align: center; }
.quiz-head { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; font-weight: 600; color: var(--muted); }
.quiz-card { background: var(--card-inner); padding: 32px 24px; border-radius: 14px; border: 1px solid var(--line-2); }
.quiz-card h1 { font-size: 30px; margin: 14px 0 8px; overflow-wrap: anywhere; color: var(--ink); font-weight: 700; }
.quiz-opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
.quiz-opt { color: #fff; border: none; padding: 14px; border-radius: 10px; font-size: 16px; font-weight: 700; min-height: 48px; background: var(--brand); }
.quiz-opt.der { background: var(--der); } .quiz-opt.die { background: var(--die); } .quiz-opt.das { background: var(--das); }
.quiz-opt.Dativ { background: var(--dativ); } .quiz-opt.Akkusativ { background: var(--akku); } .quiz-opt.Both { background: var(--both); } .quiz-opt.Wechsel { background: var(--wechsel); }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.65); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 16px; }
.modal { background: var(--modal-bg); border: 1px solid var(--line-2); border-radius: 14px; padding: 28px; width: 100%; max-width: 460px; box-shadow: 0 10px 25px rgba(0,0,0,.3); max-height: 100%; overflow-y: auto; color: var(--ink); }
.modal h3 { margin: 0 0 16px; font-size: 18px; color: var(--ink); }
.modal form { display: flex; flex-direction: column; gap: 16px; }
.modal-label { font-size: 12px; font-weight: 600; color: var(--muted); }
.modal-input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line-2); font-size: 15px; margin-top: 6px; background: var(--input-bg); color: var(--ink); min-height: 42px; }
.radios { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.radio { flex: 1 1 30%; text-align: center; padding: 10px 8px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; background: var(--card-inner); color: var(--ink); border: 1px solid var(--line-2); }
.radio.on { background: var(--brand); color: #fff; border-color: var(--brand); }
.radio input { display: none; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; }

.confirm-box { text-align: center; display: flex; flex-direction: column; gap: 14px; }
.confirm-icon { font-size: 38px; }
.confirm-box p { margin: 0; font-size: 14.5px; color: var(--muted); line-height: 1.4; }

@media (max-width: 1024px) {
  .page { padding: 20px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .patterns-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .page { padding: 12px 12px calc(96px + env(safe-area-inset-bottom)); }
  .list { background: transparent; border: none; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .list-head { display: none; }

  .noun-row,
  .verb-row,
  .prep-row {
    background: var(--card);
    border: 1px solid var(--line);
    border-left-width: 5px;
    border-radius: 14px;
    padding: 14px 16px;
    display: grid !important;
    grid-template-columns: 1fr auto !important;
    align-items: center;
    gap: 12px;
  }

  .c-idx { display: none !important; }
  .c-art, .c-case { grid-column: 1; display: flex; justify-content: flex-start; margin-bottom: 2px; text-align: left; }
  .c-noun, .c-verb, .c-prep { grid-column: 1; display: flex; justify-content: flex-start; align-items: center; gap: 8px; font-size: 17px; font-weight: 700; text-align: left; }
  .c-plural, .c-past { grid-column: 1; text-align: left !important; font-size: 13px; margin: 2px 0; }
  .c-past { color: var(--brand); font-family: monospace; font-weight: 600; }
  .c-mean { grid-column: 1; text-align: left !important; font-size: 14px; font-weight: 600; color: var(--ink-2); margin: 2px 0; }
  .c-eg { grid-column: 1; text-align: left !important; font-size: 12.5px; color: var(--muted); font-style: italic; margin: 2px 0; }
  .c-status { grid-column: 1; display: flex; justify-content: flex-start; margin-top: 6px; }
  .noun-wrap { justify-content: flex-start !important; }

  .actions {
    grid-column: 2;
    grid-row: 1 / span 8;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding-left: 12px;
    border-left: 1px solid var(--line);
    margin-left: auto;
  }

  .icon-btn { width: 38px; height: 38px; min-width: 38px; }
  .status { padding: 6px 12px; min-height: 34px; font-size: 12px; align-self: flex-start; }
  .grammar-table td, .grammar-table th { padding: 10px 8px; font-size: 12.5px; white-space: nowrap; }

  .fab {
    display: inline-flex;
    position: fixed;
    right: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    z-index: 50;
    padding: 0 20px;
    min-height: 52px;
    border-radius: 999px;
    box-shadow: 0 8px 20px rgba(180, 83, 9, 0.35);
    font-size: 14px;
  }
}
`;

const ARTICLE_CLASS = { der: "bg-der", die: "bg-die", das: "bg-das" };
const VERB_CASE_CLASS = { Dativ: "bg-dativ", Akkusativ: "bg-akku", "Both / Common": "bg-both" };
const PREP_CASE_CLASS = { Dativ: "bg-dativ", Akkusativ: "bg-akku", Wechsel: "bg-wechsel" };
const GENDER_MAP = { der: "Masculine", die: "Feminine", das: "Neuter" };

// ---------- CUSTOM DROPDOWN COMPONENT ----------
function CustomDropdown({ value, options, onChange, icon = null, fullWidth = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div
      className={`dropdown-container ${isOpen ? "open" : ""} ${fullWidth ? "full-width" : ""}`}
      ref={containerRef}
      style={{ marginTop: fullWidth ? 6 : 0 }}
    >
      <button
        type="button"
        className="dropdown-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {icon && <span>{icon}</span>}
          <span>{selectedOption?.label}</span>
        </span>
        <span className="dropdown-arrow">▼</span>
      </button>

      <div className="dropdown-menu" role="listbox">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={opt.value === value}
            className={`dropdown-item ${opt.value === value ? "active" : ""}`}
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
          >
            <span>{opt.label}</span>
            {opt.value === value && <span style={{ fontSize: 11 }}>✔</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- MAIN APP COMPONENT ----------
export default function App() {
  const [vocabList, setVocabList] = useState([]);
  const [verbsList, setVerbsList] = useState([]);
  const [patternsList, setPatternsList] = useState([]);
  const [prepsList, setPrepsList] = useState([]);
  const [timeList, setTimeList] = useState([]);
  const [isReady, setIsReady] = useState(false);

  const [theme] = useState(() => localStorage.getItem("vocab_vault_theme") || "light");

  // SIDEBAR STATE
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // PRIMARY TABS
  const [mainCategory, setMainCategory] = useState("Nouns");

  // Sub-views
  const [nounSubView, setNounSubView] = useState("list");
  const [patternSubView, setPatternSubView] = useState("list");
  const [verbSubView, setVerbSubView] = useState("list");
  const [prepSubView, setPrepSubView] = useState("list");
  const [grammarSubView, setGrammarSubView] = useState("list");
  const [timeSubView, setTimeSubView] = useState("list");

  // Grammar & Time views
  const [activeGrammarTopic, setActiveGrammarTopic] = useState("possessives");
  const [grammarCaseFilter, setGrammarCaseFilter] = useState("Nominativ");
  const [timeViewMode, setTimeViewMode] = useState("all");

  // Primary filters
  const [search, setSearch] = useState("");
  const [articleFilter, setArticleFilter] = useState("all");
  const [verbFilter, setVerbFilter] = useState("all");
  const [prepFilter, setPrepFilter] = useState("all");

  // Status Filters
  const [nounStatusFilter, setNounStatusFilter] = useState("all");
  const [verbStatusFilter, setVerbStatusFilter] = useState("all");
  const [prepStatusFilter, setPrepStatusFilter] = useState("all");

  // Created Date Filter State
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");

  // Modals
  const [nounModalOpen, setNounModalOpen] = useState(false);
  const [editingNounId, setEditingNounId] = useState(null);
  const [nounFormData, setNounFormData] = useState({ noun: "", plural: "", article: "der", meaning: "", status: "In Progress" });

  const [verbModalOpen, setVerbModalOpen] = useState(false);
  const [editingVerbId, setEditingVerbId] = useState(null);
  const [verbFormData, setVerbFormData] = useState({ verb: "", preterite: "", participle: "", caseType: "Dativ", meaning: "", example: "", status: "In Progress" });

  const [patternModalOpen, setPatternModalOpen] = useState(false);
  const [patternFormData, setPatternFormData] = useState({ article: "der", ending: "", rule: "", examples: "" });

  const [prepModalOpen, setPrepModalOpen] = useState(false);
  const [editingPrepId, setEditingPrepId] = useState(null);
  const [prepFormData, setPrepFormData] = useState({ prep: "", caseType: "Akkusativ", meaning: "", example: "", status: "In Progress" });

  // Time Modal
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [editingTimeId, setEditingTimeId] = useState(null);
  const [timeFormData, setTimeFormData] = useState({ digital: "", formal: "", informal: "", rule: "" });

  // Confirmation Pop-up State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const requestConfirmation = (title, message, onConfirm) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Practice States
  const [nounCardIndex, setNounCardIndex] = useState(0);
  const [nounCardFlipped, setNounCardFlipped] = useState(false);
  const [nounQuizIndex, setNounQuizIndex] = useState(0);
  const [nounQuizScore, setNounQuizScore] = useState(0);
  const [nounQuizFeedback, setNounQuizFeedback] = useState(null);

  const [verbCardIndex, setVerbCardIndex] = useState(0);
  const [verbCardFlipped, setVerbCardFlipped] = useState(false);
  const [verbQuizIndex, setVerbQuizIndex] = useState(0);
  const [verbQuizScore, setVerbQuizScore] = useState(0);
  const [verbQuizFeedback, setVerbQuizFeedback] = useState(null);

  const [patternCardIndex, setPatternCardIndex] = useState(0);
  const [patternCardFlipped, setPatternCardFlipped] = useState(false);
  const [patternQuizIndex, setPatternQuizIndex] = useState(0);
  const [patternQuizScore, setPatternQuizScore] = useState(0);
  const [patternQuizFeedback, setPatternQuizFeedback] = useState(null);

  const [prepCardIndex, setPrepCardIndex] = useState(0);
  const [prepCardFlipped, setPrepCardFlipped] = useState(false);
  const [prepQuizIndex, setPrepQuizIndex] = useState(0);
  const [prepQuizScore, setPrepQuizScore] = useState(0);
  const [prepQuizFeedback, setPrepQuizFeedback] = useState(null);

  const [grammarCardIndex, setGrammarCardIndex] = useState(0);
  const [grammarCardFlipped, setGrammarCardFlipped] = useState(false);
  const [grammarQuizIndex, setGrammarQuizIndex] = useState(0);
  const [grammarQuizScore, setGrammarQuizScore] = useState(0);
  const [grammarQuizFeedback, setGrammarQuizFeedback] = useState(null);

  const [timeCardIndex, setTimeCardIndex] = useState(0);
  const [timeCardFlipped, setTimeCardFlipped] = useState(false);
  const [timeQuizIndex, setTimeQuizIndex] = useState(0);
  const [timeQuizScore, setTimeQuizScore] = useState(0);
  const [timeQuizFeedback, setTimeQuizFeedback] = useState(null);

  useEffect(() => {
    async function initVault() {
      try {
        let storedVerbs = await loadFromVaultDB(VERBS_STORE_NAME, VERBS_BACKUP_KEY);
        const needsVerbMigration = !storedVerbs || storedVerbs.some((v) => v.preterite === undefined || !v.createdAt);

        if (needsVerbMigration) {
          const mergedVerbs = (storedVerbs && storedVerbs.length > 0)
            ? storedVerbs.map((existing) => {
                const seedMatch = SEED_VERBS.find((s) => s.verb === existing.verb || s.id === existing.id);
                return {
                  ...existing,
                  preterite: existing.preterite || (seedMatch ? seedMatch.preterite : ""),
                  participle: existing.participle || (seedMatch ? seedMatch.participle : ""),
                  auxiliary: existing.auxiliary || (seedMatch ? seedMatch.auxiliary : "hat"),
                  createdAt: existing.createdAt || (seedMatch ? seedMatch.createdAt : new Date().toISOString()),
                };
              })
            : SEED_VERBS;

          await writeToVaultDB(VERBS_STORE_NAME, VERBS_BACKUP_KEY, mergedVerbs);
          setVerbsList(mergedVerbs);
        } else {
          setVerbsList(storedVerbs);
        }

        let storedVocab = await loadFromVaultDB(STORE_NAME, BACKUP_KEY);
        if (!storedVocab || storedVocab.some((n) => !n.createdAt)) {
          const merged = (storedVocab && storedVocab.length) ? storedVocab.map((item) => {
            const match = SEED_DATA.find((s) => s.id === item.id);
            return { ...item, createdAt: item.createdAt || (match ? match.createdAt : new Date().toISOString()) };
          }) : SEED_DATA;
          await writeToVaultDB(STORE_NAME, BACKUP_KEY, merged);
          setVocabList(merged);
        } else {
          setVocabList(storedVocab);
        }

        let storedPatterns = await loadFromVaultDB(PATTERNS_STORE_NAME, PATTERNS_BACKUP_KEY);
        if (!storedPatterns || storedPatterns.some((p) => !p.createdAt)) {
          const merged = (storedPatterns && storedPatterns.length) ? storedPatterns.map((item) => {
            const match = SEED_PATTERNS.find((s) => s.id === item.id);
            return { ...item, createdAt: item.createdAt || (match ? match.createdAt : new Date().toISOString()) };
          }) : SEED_PATTERNS;
          await writeToVaultDB(PATTERNS_STORE_NAME, PATTERNS_BACKUP_KEY, merged);
          setPatternsList(merged);
        } else {
          setPatternsList(storedPatterns);
        }

        let storedPreps = await loadFromVaultDB(PREPOSITIONS_STORE_NAME, PREPOSITIONS_BACKUP_KEY);
        if (!storedPreps || storedPreps.some((p) => !p.createdAt)) {
          const merged = (storedPreps && storedPreps.length) ? storedPreps.map((item) => {
            const match = SEED_PREPOSITIONS.find((s) => s.id === item.id);
            return { ...item, createdAt: item.createdAt || (match ? match.createdAt : new Date().toISOString()) };
          }) : SEED_PREPOSITIONS;
          await writeToVaultDB(PREPOSITIONS_STORE_NAME, PREPOSITIONS_BACKUP_KEY, merged);
          setPrepsList(merged);
        } else {
          setPrepsList(storedPreps);
        }

        let storedTimes = await loadFromVaultDB(TIME_STORE_NAME, TIME_BACKUP_KEY);
        if (!storedTimes || storedTimes.length === 0) {
          await writeToVaultDB(TIME_STORE_NAME, TIME_BACKUP_KEY, SEED_TIME);
          setTimeList(SEED_TIME);
        } else {
          setTimeList(storedTimes);
        }
      } catch (err) {
        console.error("IndexedDB error:", err);
        setVerbsList(SEED_VERBS);
        setVocabList(SEED_DATA);
        setPatternsList(SEED_PATTERNS);
        setPrepsList(SEED_PREPOSITIONS);
        setTimeList(SEED_TIME);
      } finally {
        setIsReady(true);
      }
    }

    initVault();
  }, []);

  const commitNouns = async (newList) => {
    setVocabList(newList);
    await writeToVaultDB(STORE_NAME, BACKUP_KEY, newList);
  };

  const commitVerbs = async (newList) => {
    setVerbsList(newList);
    await writeToVaultDB(VERBS_STORE_NAME, VERBS_BACKUP_KEY, newList);
  };

  const commitPatterns = async (newList) => {
    setPatternsList(newList);
    await writeToVaultDB(PATTERNS_STORE_NAME, PATTERNS_BACKUP_KEY, newList);
  };

  const commitPreps = async (newList) => {
    setPrepsList(newList);
    await writeToVaultDB(PREPOSITIONS_STORE_NAME, PREPOSITIONS_BACKUP_KEY, newList);
  };

  const commitTimes = async (newList) => {
    setTimeList(newList);
    await writeToVaultDB(TIME_STORE_NAME, TIME_BACKUP_KEY, newList);
  };

  const handleSaveNounModal = (e) => {
    e.preventDefault();
    if (!nounFormData.noun.trim() || !nounFormData.meaning.trim()) return;
    const gender = GENDER_MAP[nounFormData.article];
    const updated = editingNounId
      ? vocabList.map((item) => (item.id === editingNounId ? { ...item, ...nounFormData, gender } : item))
      : [...vocabList, { id: Date.now(), ...nounFormData, gender, createdAt: new Date().toISOString() }];
    commitNouns(updated);
    setNounModalOpen(false);
  };

  const handleSaveVerbModal = (e) => {
    e.preventDefault();
    if (!verbFormData.verb.trim() || !verbFormData.meaning.trim()) return;
    const updated = editingVerbId
      ? verbsList.map((item) => (item.id === editingVerbId ? { ...item, ...verbFormData } : item))
      : [...verbsList, { id: Date.now(), ...verbFormData, createdAt: new Date().toISOString() }];
    commitVerbs(updated);
    setVerbModalOpen(false);
  };

  const handleSavePatternModal = (e) => {
    e.preventDefault();
    if (!patternFormData.ending.trim() || !patternFormData.rule.trim()) return;
    commitPatterns([...patternsList, { id: `p-${Date.now()}`, ...patternFormData, createdAt: new Date().toISOString() }]);
    setPatternModalOpen(false);
  };

  const handleSavePrepModal = (e) => {
    e.preventDefault();
    if (!prepFormData.prep.trim() || !prepFormData.meaning.trim()) return;
    const updated = editingPrepId
      ? prepsList.map((item) => (item.id === editingPrepId ? { ...item, ...prepFormData } : item))
      : [...prepsList, { id: Date.now(), ...prepFormData, createdAt: new Date().toISOString() }];
    commitPreps(updated);
    setPrepModalOpen(false);
  };

  const handleSaveTimeModal = (e) => {
    e.preventDefault();
    if (!timeFormData.digital.trim() || !timeFormData.formal.trim()) return;
    const updated = editingTimeId
      ? timeList.map((item) => ((item.id || item.digital) === editingTimeId ? { ...item, ...timeFormData } : item))
      : [...timeList, { id: `t-${Date.now()}`, ...timeFormData, createdAt: new Date().toISOString() }];
    commitTimes(updated);
    setTimeModalOpen(false);
  };

  const speakGerman = (phrase) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = "de-DE";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const getPossessiveForm = (stemObj, genderKey, caseKey) => {
    let base = stemObj.stem;
    const ending = POSSESSIVE_ENDINGS[caseKey][genderKey];
    if (base === "euer") {
      if (ending === "–") return "euer";
      return `eur${ending}`;
    }
    if (ending === "–") return base;
    return `${base}${ending}`;
  };

  const matchesDateFilter = (isoDate) => {
    if (!isoDate || dateFilter === "all") return true;
    const itemDate = new Date(isoDate);
    const now = new Date();

    if (dateFilter === "today") {
      return itemDate.toDateString() === now.toDateString();
    }
    if (dateFilter === "week") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return itemDate >= sevenDaysAgo;
    }
    if (dateFilter === "month") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return itemDate >= thirtyDaysAgo;
    }
    if (dateFilter === "custom" && customDate) {
      return isoDate.slice(0, 10) === customDate;
    }
    return true;
  };

  if (!isReady) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading Deutschly...</div>;
  }

  const filteredNouns = vocabList.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch = item.noun.toLowerCase().includes(q) || (item.plural && item.plural.toLowerCase().includes(q)) || item.meaning.toLowerCase().includes(q);
    const matchesArt = articleFilter === "all" || item.article === articleFilter;
    const matchesStatus = nounStatusFilter === "all" || item.status === nounStatusFilter;
    return matchesSearch && matchesArt && matchesStatus && matchesDateFilter(item.createdAt);
  });

  const filteredVerbs = verbsList.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      item.verb.toLowerCase().includes(q) ||
      (item.preterite && item.preterite.toLowerCase().includes(q)) ||
      (item.participle && item.participle.toLowerCase().includes(q)) ||
      item.meaning.toLowerCase().includes(q) ||
      item.example.toLowerCase().includes(q);
    const matchesCase = verbFilter === "all" || item.caseType === verbFilter;
    const matchesStatus = verbStatusFilter === "all" || item.status === verbStatusFilter;
    return matchesSearch && matchesCase && matchesStatus && matchesDateFilter(item.createdAt);
  });

  const filteredPreps = prepsList.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch = item.prep.toLowerCase().includes(q) || item.meaning.toLowerCase().includes(q) || item.example.toLowerCase().includes(q);
    const matchesCase = prepFilter === "all" || item.caseType === prepFilter;
    const matchesStatus = prepStatusFilter === "all" || item.status === prepStatusFilter;
    return matchesSearch && matchesCase && matchesStatus && matchesDateFilter(item.createdAt);
  });

  const currentSubView =
    mainCategory === "Nouns" ? nounSubView :
    mainCategory === "Patterns" ? patternSubView :
    mainCategory === "Verbs" ? verbSubView :
    mainCategory === "Prepositions" ? prepSubView :
    mainCategory === "Time" ? timeSubView : grammarSubView;

  const nounsMastered = vocabList.filter((i) => i.status === "Mastered").length;
  const countNoun = (art) => vocabList.filter((i) => i.article === art).length;
  const verbsMastered = verbsList.filter((i) => i.status === "Mastered").length;
  const countVerb = (c) => verbsList.filter((i) => i.caseType === c).length;
  const countPattern = (art) => patternsList.filter((p) => p.article === art).length;
  const prepsMastered = prepsList.filter((i) => i.status === "Mastered").length;
  const countPrep = (c) => prepsList.filter((i) => i.caseType === c).length;

  const nounCard = vocabList[nounCardIndex];
  const nounQuizWord = vocabList[nounQuizIndex];
  const verbCard = verbsList[verbCardIndex];
  const verbQuizWord = verbsList[verbQuizIndex];
  const patternCard = patternsList[patternCardIndex];
  const patternQuizWord = patternsList[patternQuizIndex];
  const prepCard = prepsList[prepCardIndex];
  const prepQuizWord = prepsList[prepQuizIndex];
  const grammarCard = GRAMMAR_FLASHCARDS[grammarCardIndex];
  const grammarQuizWord = GRAMMAR_QUIZ[grammarQuizIndex];
  const timeCard = TIME_FLASHCARDS[timeCardIndex];
  const timeQuizWord = TIME_QUIZ[timeQuizIndex];

  const CATEGORY_ITEMS = [
    { id: "Nouns", icon: "📑", count: vocabList.length },
    { id: "Patterns", icon: "📐", count: patternsList.length },
    { id: "Verbs", icon: "⚡", count: verbsList.length },
    { id: "Prepositions", icon: "🎯", count: prepsList.length },
    { id: "Time", icon: "⏰", count: timeList.length },
    { id: "Grammar", icon: "📚", count: GRAMMAR_TOPICS.length },
  ];

  return (
    <div className="page-shell" data-theme={theme}>
      <style>{CSS}</style>

      {/* TOP HEADER */}
      <header className="app-header">
        <button
          type="button"
          className="kebab-btn"
          aria-label="Open Navigation Menu"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="hamburger-icon">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
        <h2 className="app-title">deutschly</h2>
        <div className="header-spacer" />
      </header>

      {/* SIDEBAR DRAWER */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={(e) => e.target === e.currentTarget && setSidebarOpen(false)}
      >
        <aside className="sidebar" role="dialog" aria-modal="true" aria-label="Main Navigation">
          <div className="sidebar-header">
            <span className="sidebar-title">Categories</span>
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close Sidebar"
            >
              ✕
            </button>
          </div>
          <nav className="sidebar-nav">
            {CATEGORY_ITEMS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`sidebar-tab-btn ${mainCategory === tab.id ? "active" : ""}`}
                onClick={() => {
                  setMainCategory(tab.id);
                  setSearch("");
                  setSidebarOpen(false);
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{tab.icon}</span>
                  <span>{tab.id}</span>
                </span>
                <span style={{ fontSize: 12, opacity: 0.75 }}>({tab.count})</span>
              </button>
            ))}
          </nav>
        </aside>
      </div>

      <div className="page">
        <div className="container">
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
                  if (mainCategory === "Time") setTimeSubView("list");
                  if (mainCategory === "Grammar") setGrammarSubView("list");
                }}
              >
                📑 Overview 
              </button>
              <button
                className={`sub-tab ${currentSubView === "flashcards" ? "active" : ""}`}
                onClick={() => {
                  if (mainCategory === "Nouns") { setNounSubView("flashcards"); setNounCardFlipped(false); }
                  if (mainCategory === "Patterns") { setPatternSubView("flashcards"); setPatternCardFlipped(false); }
                  if (mainCategory === "Verbs") { setVerbSubView("flashcards"); setVerbCardFlipped(false); }
                  if (mainCategory === "Prepositions") { setPrepSubView("flashcards"); setPrepCardFlipped(false); }
                  if (mainCategory === "Time") { setTimeSubView("flashcards"); setTimeCardFlipped(false); }
                  if (mainCategory === "Grammar") { setGrammarSubView("flashcards"); setGrammarCardFlipped(false); }
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
                  if (mainCategory === "Time") setTimeSubView("quiz");
                  if (mainCategory === "Grammar") setGrammarSubView("quiz");
                }}
              >
                ✨ Quiz
              </button>
            </div>
          </div>

          {/* ==================== 1. NOUNS ==================== */}
          {mainCategory === "Nouns" && (
            <>
              {nounSubView === "list" && (
                <div className="section">
                  <div className="stats-grid">
                    <div className="stat dark"><div className="stat-head"><span className="stat-label">TOTAL NOUNS</span><span className="stat-pill dark">{nounsMastered} mastered</span></div><div className="stat-foot"><span className="stat-value">{vocabList.length}</span><span className="stat-note" style={{ color: "#a8a29e" }}>all genders</span></div></div>
                    <div className="stat"><div className="stat-head"><span className="stat-label">MASCULINE</span><span className="stat-pill bg-der">der</span></div><div className="stat-foot"><span className="stat-value c-der">{countNoun("der")}</span></div></div>
                    <div className="stat"><div className="stat-head"><span className="stat-label">FEMININE</span><span className="stat-pill bg-die">die</span></div><div className="stat-foot"><span className="stat-value c-die">{countNoun("die")}</span></div></div>
                    <div className="stat"><div className="stat-head"><span className="stat-label">NEUTER</span><span className="stat-pill bg-das">das</span></div><div className="stat-foot"><span className="stat-value c-das">{countNoun("das")}</span></div></div>
                  </div>

                  <div className="toolbar">
                    <div className="search">
                      <span>🔍</span>
                      <input type="search" placeholder="Search noun, plural, or meaning..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>

                    <div className="filters-cluster">
                      <div className="filters">
                        <span className="filters-label">Gender:</span>
                        <button onClick={() => setArticleFilter("all")} className={`chip all ${articleFilter === "all" ? "on" : ""}`}>All</button>
                        {["der", "die", "das"].map((a) => (
                          <button key={a} onClick={() => setArticleFilter(a)} className={`chip ${a} ${articleFilter === a ? "on" : ""}`}>{a}</button>
                        ))}
                      </div>

                      <div className="filters">
                        <span className="filters-label">Status:</span>
                        <button onClick={() => setNounStatusFilter("all")} className={`chip all ${nounStatusFilter === "all" ? "on" : ""}`}>All</button>
                        <button onClick={() => setNounStatusFilter("In Progress")} className={`chip all ${nounStatusFilter === "In Progress" ? "on" : ""}`}>In Progress</button>
                        <button onClick={() => setNounStatusFilter("Mastered")} className={`chip das ${nounStatusFilter === "Mastered" ? "on" : ""}`}>Mastered</button>
                      </div>

                      <div className="filters">
                        <span className="filters-label">Created:</span>
                        <CustomDropdown
                          icon="📅"
                          value={dateFilter}
                          options={DATE_OPTIONS}
                          onChange={(val) => setDateFilter(val)}
                        />
                        {dateFilter === "custom" && (
                          <input type="date" className="date-select" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                        )}
                      </div>

                      <button onClick={() => { setEditingNounId(null); setNounFormData({ noun: "", plural: "", article: "der", meaning: "", status: "In Progress" }); setNounModalOpen(true); }} className="btn btn-primary">
                        + Add Noun
                      </button>
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
                    {filteredNouns.map((item, index) => (
                      <div className={`row noun-row ${item.article}`} key={item.id}>
                        <div className="c-idx">{index + 1}</div>
                        <div className="c-art"><span className={`pill ${ARTICLE_CLASS[item.article]}`}>{item.article}</span></div>
                        <div className="c-noun"><div className="noun-wrap"><span className={`pill ${ARTICLE_CLASS[item.article]}`}>{item.noun}</span><span className="gender">({item.gender})</span></div></div>
                        <div className="c-plural">{item.plural || "—"}</div>
                        <div className="c-mean">{item.meaning}</div>
                        <div className="c-status">
                          <button onClick={() => commitNouns(vocabList.map((i) => i.id === item.id ? { ...i, status: i.status === "Mastered" ? "In Progress" : "Mastered" } : i))} className={`status ${item.status === "Mastered" ? "done" : "todo"}`}>
                            {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                          </button>
                        </div>
                        <div className="actions">
                          <button onClick={() => speakGerman(`${item.article} ${item.noun}. ${item.plural || ""}`)} className="icon-btn">🔊</button>
                          <button onClick={() => { setEditingNounId(item.id); setNounFormData({ noun: item.noun, plural: item.plural || "", article: item.article, meaning: item.meaning, status: item.status }); setNounModalOpen(true); }} className="icon-btn">✏️</button>
                          <button onClick={() => requestConfirmation("Delete Noun", `Are you sure you want to delete "${item.article} ${item.noun}"?`, () => commitNouns(vocabList.filter((i) => i.id !== item.id)))} className="icon-btn">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {nounSubView === "flashcards" && (
                <div className="panel">
                  {!nounCard ? <p>No nouns available.</p> : (
                    <div className="flash-wrap">
                      <div className="flash" onClick={() => setNounCardFlipped(!nounCardFlipped)}>
                        {!nounCardFlipped ? (
                          <>
                            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>GUESS ARTICLE, PLURAL &amp; MEANING</span>
                            <h2>{nounCard.noun}</h2>
                            <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                          </>
                        ) : (
                          <>
                            <span className={`pill ${ARTICLE_CLASS[nounCard.article]}`} style={{ fontSize: 22, padding: "6px 20px" }}>{nounCard.article} {nounCard.noun}</span>
                            {nounCard.plural && <p style={{ fontSize: 16, fontWeight: 700, color: "var(--muted)", margin: "10px 0 0" }}>Plural: {nounCard.plural}</p>}
                            <h3 style={{ fontSize: 24, margin: "10px 0 6px", color: "var(--ink-2)" }}>{nounCard.meaning}</h3>
                            <p style={{ color: "var(--muted)", margin: 0, fontSize: 14 }}>{nounCard.gender}</p>
                          </>
                        )}
                      </div>
                      <div className="flash-controls">
                        <button className="btn btn-secondary" disabled={nounCardIndex === 0} onClick={() => { setNounCardIndex(nounCardIndex - 1); setNounCardFlipped(false); }}>◀ Previous</button>
                        <button className="btn btn-secondary mid" onClick={() => speakGerman(`${nounCard.article} ${nounCard.noun}. ${nounCard.plural || ""}`)}>🔊 Pronounce</button>
                        <button className="btn btn-secondary" disabled={nounCardIndex >= vocabList.length - 1} onClick={() => { setNounCardIndex(nounCardIndex + 1); setNounCardFlipped(false); }}>Next ▶</button>
                      </div>
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>Card {nounCardIndex + 1} of {vocabList.length}</span>
                    </div>
                  )}
                </div>
              )}

              {nounSubView === "quiz" && (
                <div className="panel">
                  {!nounQuizWord ? <p>Add nouns to start quiz.</p> : (
                    <div className="quiz">
                      <div className="quiz-head"><span>Question {nounQuizIndex + 1} of {vocabList.length}</span><span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {nounQuizScore}</span></div>
                      <div className="quiz-card">
                        <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Choose the correct article:</span>
                        <h1>{nounQuizWord.noun}</h1>
                        <p style={{ color: "var(--muted)", margin: "4px 0", fontSize: 14 }}>Plural: <strong>{nounQuizWord.plural || "—"}</strong></p>
                        <p style={{ color: "var(--muted)", margin: 0, fontSize: 15 }}>Meaning: <strong style={{ color: "var(--ink-2)" }}>{nounQuizWord.meaning}</strong></p>
                      </div>
                      <div className="quiz-opts">
                        {["der", "die", "das"].map((opt) => (
                          <button key={opt} disabled={nounQuizFeedback !== null} className={`quiz-opt ${opt}`} onClick={() => {
                            const ok = opt === nounQuizWord.article;
                            if (ok) setNounQuizScore((s) => s + 1);
                            setNounQuizFeedback(ok ? "Correct! 🎉" : `Wrong! Correct article is "${nounQuizWord.article}".`);
                          }}>{opt}</button>
                        ))}
                      </div>
                      {nounQuizFeedback && (
                        <div style={{ marginTop: 24 }}>
                          <p style={{ fontSize: 15, fontWeight: 600 }}>{nounQuizFeedback}</p>
                          <button className="btn btn-primary" onClick={() => {
                            setNounQuizFeedback(null);
                            if (nounQuizIndex < vocabList.length - 1) setNounQuizIndex((i) => i + 1);
                            else { alert(`Quiz finished! Score: ${nounQuizScore}/${vocabList.length}`); setNounQuizIndex(0); setNounQuizScore(0); }
                          }}>{nounQuizIndex < vocabList.length - 1 ? "Next Word" : "Restart"}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ==================== 2. PATTERNS ==================== */}
          {mainCategory === "Patterns" && (
            <>
              {patternSubView === "list" && (
                <div className="section">
                  <div className="stats-grid">
                    <div className="stat dark">
                      <div className="stat-head"><span className="stat-label">TOTAL PATTERNS</span><span className="stat-pill dark">Active Rules</span></div>
                      <div className="stat-foot"><span className="stat-value">{patternsList.length}</span></div>
                    </div>
                    <div className="stat">
                      <div className="stat-head"><span className="stat-label">DER PATTERNS</span><span className="stat-pill bg-der">der</span></div>
                      <div className="stat-foot"><span className="stat-value c-der">{countPattern("der")}</span></div>
                    </div>
                    <div className="stat">
                      <div className="stat-head"><span className="stat-label">DIE PATTERNS</span><span className="stat-pill bg-die">die</span></div>
                      <div className="stat-foot"><span className="stat-value c-die">{countPattern("die")}</span></div>
                    </div>
                    <div className="stat">
                      <div className="stat-head"><span className="stat-label">DAS PATTERNS</span><span className="stat-pill bg-das">das</span></div>
                      <div className="stat-foot"><span className="stat-value c-das">{countPattern("das")}</span></div>
                    </div>
                  </div>

                  <div className="toolbar">
                    <div className="filters">
                      <span className="filters-label">Created:</span>
                      <CustomDropdown
                        icon="📅"
                        value={dateFilter}
                        options={DATE_OPTIONS}
                        onChange={(val) => setDateFilter(val)}
                      />
                      {dateFilter === "custom" && (
                        <input type="date" className="date-select" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                      )}
                    </div>
                    <button onClick={() => { setPatternFormData({ article: "der", ending: "", rule: "", examples: "" }); setPatternModalOpen(true); }} className="btn btn-primary" style={{ marginLeft: "auto" }}>
                      + Add Suffix Pattern
                    </button>
                  </div>

                  <div className="patterns-grid">
                    {["der", "die", "das"].map((art) => (
                      <div key={art} className={`pattern-col ${art}`}>
                        <div className="pattern-header">
                          <div><h3 className={`c-${art}`}>{GENDER_MAP[art]} Rules</h3><span style={{ fontSize: 12, color: "var(--muted)" }}>{patternsList.filter((p) => p.article === art && matchesDateFilter(p.createdAt)).length} patterns</span></div>
                          <span className={`stat-pill ${ARTICLE_CLASS[art]}`}>{art}</span>
                        </div>
                        {patternsList.filter((p) => p.article === art && matchesDateFilter(p.createdAt)).map((rule) => (
                          <div key={rule.id} className="pattern-card">
                            <div className="pattern-card-top">
                              <span className={`pattern-badge ${ARTICLE_CLASS[art]}`}>{rule.ending}</span>
                              <button onClick={() => requestConfirmation("Delete Suffix Pattern", `Delete rule for "${rule.ending}"?`, () => commitPatterns(patternsList.filter((p) => p.id !== rule.id)))} className="pattern-delete-btn">✕</button>
                            </div>
                            <p className="pattern-rule">{rule.rule}</p>
                            <p className="pattern-eg">e.g. {rule.examples}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {patternSubView === "flashcards" && (
                <div className="panel">
                  {!patternCard ? <p>No patterns available.</p> : (
                    <div className="flash-wrap">
                      <div className="flash" onClick={() => setPatternCardFlipped(!patternCardFlipped)}>
                        {!patternCardFlipped ? (
                          <>
                            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>WHICH ARTICLE BELONGS TO THIS PATTERN?</span>
                            <h2 style={{ fontFamily: "monospace" }}>{patternCard.ending}</h2>
                            <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to reveal article &amp; rules)</span>
                          </>
                        ) : (
                          <>
                            <span className={`pill ${ARTICLE_CLASS[patternCard.article]}`} style={{ fontSize: 22, padding: "6px 22px" }}>{patternCard.article} ({GENDER_MAP[patternCard.article]})</span>
                            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-2)", margin: "14px 0 6px" }}>{patternCard.rule}</p>
                            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, fontStyle: "italic" }}>e.g. {patternCard.examples}</p>
                          </>
                        )}
                      </div>
                      <div className="flash-controls">
                        <button className="btn btn-secondary" disabled={patternCardIndex === 0} onClick={() => { setPatternCardIndex(patternCardIndex - 1); setPatternCardFlipped(false); }}>◀ Previous</button>
                        <button className="btn btn-secondary mid" onClick={() => speakGerman(patternCard.examples)}>🔊 Hear Examples</button>
                        <button className="btn btn-secondary" disabled={patternCardIndex >= patternsList.length - 1} onClick={() => { setPatternCardIndex(patternCardIndex + 1); setPatternCardFlipped(false); }}>Next ▶</button>
                      </div>
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>Pattern {patternCardIndex + 1} of {patternsList.length}</span>
                    </div>
                  )}
                </div>
              )}

              {patternSubView === "quiz" && (
                <div className="panel">
                  {!patternQuizWord ? <p>Add patterns to start quiz.</p> : (
                    <div className="quiz">
                      <div className="quiz-head"><span>Question {patternQuizIndex + 1} of {patternsList.length}</span><span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {patternQuizScore}</span></div>
                      <div className="quiz-card">
                        <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Which article goes with this suffix?</span>
                        <h1 style={{ fontFamily: "monospace" }}>{patternQuizWord.ending}</h1>
                        <p style={{ color: "var(--muted)", margin: 0, fontSize: 14 }}>Rule: <strong style={{ color: "var(--ink-2)" }}>{patternQuizWord.rule}</strong></p>
                      </div>
                      <div className="quiz-opts">
                        {["der", "die", "das"].map((opt) => (
                          <button key={opt} disabled={patternQuizFeedback !== null} className={`quiz-opt ${opt}`} onClick={() => {
                            const ok = opt === patternQuizWord.article;
                            if (ok) setPatternQuizScore((s) => s + 1);
                            setPatternQuizFeedback(ok ? "Correct! 🎉" : `Wrong! Suffix "${patternQuizWord.ending}" takes "${patternQuizWord.article}".`);
                          }}>{opt}</button>
                        ))}
                      </div>
                      {patternQuizFeedback && (
                        <div style={{ marginTop: 24 }}>
                          <p style={{ fontSize: 15, fontWeight: 600 }}>{patternQuizFeedback}</p>
                          <button className="btn btn-primary" onClick={() => {
                            setPatternQuizFeedback(null);
                            if (patternQuizIndex < patternsList.length - 1) setPatternQuizIndex((i) => i + 1);
                            else { alert(`Pattern Quiz finished! Score: ${patternQuizScore}/${patternsList.length}`); setPatternQuizIndex(0); setPatternQuizScore(0); }
                          }}>{patternQuizIndex < patternsList.length - 1 ? "Next Pattern" : "Restart"}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ==================== 3. VERBS ==================== */}
          {mainCategory === "Verbs" && (
            <>
              {verbSubView === "list" && (
                <div className="section">
                  <div className="stats-grid">
                    <div className="stat dark">
                      <div className="stat-head"><span className="stat-label">TOTAL VERBS</span><span className="stat-pill dark">{verbsMastered} mastered</span></div>
                      <div className="stat-foot"><span className="stat-value">{verbsList.length}</span></div>
                    </div>
                    <div className="stat">
                      <div className="stat-head"><span className="stat-label">DATIV</span><span className="stat-pill bg-dativ">Dativ</span></div>
                      <div className="stat-foot"><span className="stat-value c-dativ">{countVerb("Dativ")}</span></div>
                    </div>
                    <div className="stat">
                      <div className="stat-head"><span className="stat-label">AKKUSATIV</span><span className="stat-pill bg-akku">Akkusativ</span></div>
                      <div className="stat-foot"><span className="stat-value c-akku">{countVerb("Akkusativ")}</span></div>
                    </div>
                    <div className="stat">
                      <div className="stat-head"><span className="stat-label">BOTH / COMMON</span><span className="stat-pill bg-both">Both</span></div>
                      <div className="stat-foot"><span className="stat-value c-both">{countVerb("Both / Common")}</span></div>
                    </div>
                  </div>

                  <div className="toolbar">
                    <div className="search"><span role="img" aria-label="search">🔍</span><input type="search" placeholder="Search verb, past forms, meaning..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

                    <div className="filters-cluster">
                      <div className="filters">
                        <span className="filters-label">Case:</span>
                        <button onClick={() => setVerbFilter("all")} className={`chip all ${verbFilter === "all" ? "on" : ""}`}>All</button>
                        <button onClick={() => setVerbFilter("Dativ")} className={`chip dativ ${verbFilter === "Dativ" ? "on" : ""}`}>Dativ</button>
                        <button onClick={() => setVerbFilter("Akkusativ")} className={`chip akku ${verbFilter === "Akkusativ" ? "on" : ""}`}>Akkusativ</button>
                        <button onClick={() => setVerbFilter("Both / Common")} className={`chip both ${verbFilter === "Both / Common" ? "on" : ""}`}>Both</button>
                      </div>

                      <div className="filters">
                        <span className="filters-label">Status:</span>
                        <button onClick={() => setVerbStatusFilter("all")} className={`chip all ${verbStatusFilter === "all" ? "on" : ""}`}>All</button>
                        <button onClick={() => setVerbStatusFilter("In Progress")} className={`chip all ${verbStatusFilter === "In Progress" ? "on" : ""}`}>In Progress</button>
                        <button onClick={() => setVerbStatusFilter("Mastered")} className={`chip das ${verbStatusFilter === "Mastered" ? "on" : ""}`}>Mastered</button>
                      </div>

                      <div className="filters">
                        <span className="filters-label">Created:</span>
                        <CustomDropdown
                          icon="📅"
                          value={dateFilter}
                          options={DATE_OPTIONS}
                          onChange={(val) => setDateFilter(val)}
                        />
                        {dateFilter === "custom" && (
                          <input type="date" className="date-select" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                        )}
                      </div>

                      <button onClick={() => { setEditingVerbId(null); setVerbFormData({ verb: "", preterite: "", participle: "", caseType: "Dativ", meaning: "", example: "", status: "In Progress" }); setVerbModalOpen(true); }} className="btn btn-primary">
                        + Add Verb
                      </button>
                    </div>
                  </div>

                  <div className="list">
                    <div className="list-head verbs-head">
                      <span style={{ textAlign: "center" }}>#</span>
                      <span>CASE</span>
                      <span>INFINITIVE</span>
                      <span>PAST (PRÄT / PART II)</span>
                      <span>MEANING</span>
                      <span>EXAMPLE SENTENCE</span>
                      <span>STATUS</span>
                      <span style={{ textAlign: "right" }}>ACTIONS</span>
                    </div>
                    {filteredVerbs.map((item, index) => (
                      <div className={`row verb-row ${item.caseType === "Both / Common" ? "Both" : item.caseType}`} key={item.id}>
                        <div className="c-idx">{index + 1}</div>
                        <div className="c-case"><span className={`pill ${VERB_CASE_CLASS[item.caseType] || "bg-both"}`}>{item.caseType}</span></div>
                        <div className="c-verb" style={{ fontWeight: 700 }}>{item.verb}</div>
                        <div className="c-past">{item.preterite || "—"} / {item.participle || "—"}</div>
                        <div className="c-mean">{item.meaning}</div>
                        <div className="c-eg">{item.example || "—"}</div>
                        <div className="c-status">
                          <button onClick={() => commitVerbs(verbsList.map((i) => i.id === item.id ? { ...i, status: i.status === "Mastered" ? "In Progress" : "Mastered" } : i))} className={`status ${item.status === "Mastered" ? "done" : "todo"}`}>
                            {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                          </button>
                        </div>
                        <div className="actions">
                          <button onClick={() => speakGerman(`${item.verb}. ${item.preterite || ""}. ${item.participle || ""}. ${item.example || ""}`)} className="icon-btn">🔊</button>
                          <button onClick={() => { setEditingVerbId(item.id); setVerbFormData({ verb: item.verb, preterite: item.preterite || "", participle: item.participle || "", caseType: item.caseType, meaning: item.meaning, example: item.example, status: item.status }); setVerbModalOpen(true); }} className="icon-btn">✏️</button>
                          <button onClick={() => requestConfirmation("Delete Verb", `Are you sure you want to delete the verb "${item.verb}"?`, () => commitVerbs(verbsList.filter((i) => i.id !== item.id)))} className="icon-btn">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {verbSubView === "flashcards" && (
                <div className="panel">
                  {!verbCard ? <p>No verbs available.</p> : (
                    <div className="flash-wrap">
                      <div className="flash" onClick={() => setVerbCardFlipped(!verbCardFlipped)}>
                        {!verbCardFlipped ? (
                          <>
                            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>RECALL CASE &amp; PAST TENSE FORMS</span>
                            <h2>{verbCard.verb}</h2>
                            <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                          </>
                        ) : (
                          <>
                            <span className={`pill ${VERB_CASE_CLASS[verbCard.caseType] || "bg-both"}`} style={{ fontSize: 20, padding: "6px 20px" }}>{verbCard.caseType}</span>
                            <p style={{ margin: "14px 0 4px", fontSize: 18, fontWeight: 700, color: "var(--brand)" }}>
                              Präteritum: {verbCard.preterite || "—"} | Partizip II: {verbCard.participle || "—"}
                            </p>
                            <h3 style={{ fontSize: 22, margin: "6px 0", color: "var(--ink-2)" }}>{verbCard.meaning}</h3>
                            {verbCard.example && <p style={{ color: "var(--muted)", margin: 0, fontSize: 14, fontStyle: "italic" }}>"{verbCard.example}"</p>}
                          </>
                        )}
                      </div>
                      <div className="flash-controls">
                        <button className="btn btn-secondary" disabled={verbCardIndex === 0} onClick={() => { setVerbCardIndex(verbCardIndex - 1); setVerbCardFlipped(false); }}>◀ Previous</button>
                        <button className="btn btn-secondary mid" onClick={() => speakGerman(`${verbCard.verb}. ${verbCard.preterite || ""}. ${verbCard.participle || ""}.`)}>🔊 Pronounce</button>
                        <button className="btn btn-secondary" disabled={verbCardIndex >= verbsList.length - 1} onClick={() => { setVerbCardIndex(verbCardIndex + 1); setVerbCardFlipped(false); }}>Next ▶</button>
                      </div>
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>Verb {verbCardIndex + 1} of {verbsList.length}</span>
                    </div>
                  )}
                </div>
              )}

              {verbSubView === "quiz" && (
                <div className="panel">
                  {!verbQuizWord ? <p>Add verbs to start quiz.</p> : (
                    <div className="quiz">
                      <div className="quiz-head"><span>Question {verbQuizIndex + 1} of {verbsList.length}</span><span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {verbQuizScore}</span></div>
                      <div className="quiz-card">
                        <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Which case is required by this verb?</span>
                        <h1>{verbQuizWord.verb}</h1>
                        <p style={{ color: "var(--muted)", margin: "4px 0", fontSize: 14 }}>Past: <strong>{verbQuizWord.preterite || "—"} / {verbQuizWord.participle || "—"}</strong></p>
                        <p style={{ color: "var(--muted)", margin: 0, fontSize: 15 }}>Meaning: <strong style={{ color: "var(--ink-2)" }}>{verbQuizWord.meaning}</strong></p>
                      </div>
                      <div className="quiz-opts">
                        {[{ l: "Dativ", v: "Dativ" }, { l: "Akkusativ", v: "Akkusativ" }, { l: "Both", v: "Both / Common" }].map((opt) => (
                          <button key={opt.v} disabled={verbQuizFeedback !== null} className={`quiz-opt ${opt.l}`} onClick={() => {
                            const ok = opt.v === verbQuizWord.caseType;
                            if (ok) setVerbQuizScore((s) => s + 1);
                            setVerbQuizFeedback(ok ? "Correct! 🎉" : `Wrong! "${verbQuizWord.verb}" governs "${verbQuizWord.caseType}".`);
                          }}>{opt.l}</button>
                        ))}
                      </div>
                      {verbQuizFeedback && (
                        <div style={{ marginTop: 24 }}>
                          <p style={{ fontSize: 15, fontWeight: 600 }}>{verbQuizFeedback}</p>
                          <button className="btn btn-primary" onClick={() => {
                            setVerbQuizFeedback(null);
                            if (verbQuizIndex < verbsList.length - 1) setVerbQuizIndex((i) => i + 1);
                            else { alert(`Verb Quiz finished! Score: ${verbQuizScore}/${verbsList.length}`); setVerbQuizIndex(0); setVerbQuizScore(0); }
                          }}>{verbQuizIndex < verbsList.length - 1 ? "Next Verb" : "Restart"}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ==================== 4. PREPOSITIONS ==================== */}
          {mainCategory === "Prepositions" && (
            <>
              {prepSubView === "list" && (
                <div className="section">
                  <div className="stats-grid">
                    <div className="stat dark">
                      <div className="stat-head"><span className="stat-label">TOTAL PREPOSITIONS</span><span className="stat-pill dark">{prepsMastered} mastered</span></div>
                      <div className="stat-foot"><span className="stat-value">{prepsList.length}</span></div>
                    </div>
                    <div className="stat">
                      <div className="stat-head"><span className="stat-label">AKKUSATIV</span><span className="stat-pill bg-akku">Akk</span></div>
                      <div className="stat-foot"><span className="stat-value c-akku">{countPrep("Akkusativ")}</span></div>
                    </div>
                    <div className="stat">
                      <div className="stat-head"><span className="stat-label">DATIV</span><span className="stat-pill bg-dativ">Dat</span></div>
                      <div className="stat-foot"><span className="stat-value c-dativ">{countPrep("Dativ")}</span></div>
                    </div>
                    <div className="stat">
                      <div className="stat-head"><span className="stat-label">WECHSEL</span><span className="stat-pill bg-wechsel">Dat / Akk</span></div>
                      <div className="stat-foot"><span className="stat-value c-wechsel">{countPrep("Wechsel")}</span></div>
                    </div>
                  </div>

                  <div className="toolbar">
                    <div className="search"><span role="img" aria-label="search">🔍</span><input type="search" placeholder="Search preposition, meaning, or sentence..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

                    <div className="filters-cluster">
                      <div className="filters">
                        <span className="filters-label">Case:</span>
                        <button onClick={() => setPrepFilter("all")} className={`chip all ${prepFilter === "all" ? "on" : ""}`}>All</button>
                        <button onClick={() => setPrepFilter("Akkusativ")} className={`chip akku ${prepFilter === "Akkusativ" ? "on" : ""}`}>Akkusativ</button>
                        <button onClick={() => setPrepFilter("Dativ")} className={`chip dativ ${prepFilter === "Dativ" ? "on" : ""}`}>Dativ</button>
                        <button onClick={() => setPrepFilter("Wechsel")} className={`chip wechsel ${prepFilter === "Wechsel" ? "on" : ""}`}>Wechsel</button>
                      </div>

                      <div className="filters">
                        <span className="filters-label">Status:</span>
                        <button onClick={() => setPrepStatusFilter("all")} className={`chip all ${prepStatusFilter === "all" ? "on" : ""}`}>All</button>
                        <button onClick={() => setPrepStatusFilter("In Progress")} className={`chip all ${prepStatusFilter === "In Progress" ? "on" : ""}`}>In Progress</button>
                        <button onClick={() => setPrepStatusFilter("Mastered")} className={`chip das ${prepStatusFilter === "Mastered" ? "on" : ""}`}>Mastered</button>
                      </div>

                      <div className="filters">
                        <span className="filters-label">Created:</span>
                        <CustomDropdown
                          icon="📅"
                          value={dateFilter}
                          options={DATE_OPTIONS}
                          onChange={(val) => setDateFilter(val)}
                        />
                        {dateFilter === "custom" && (
                          <input type="date" className="date-select" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                        )}
                      </div>

                      <button onClick={() => { setEditingPrepId(null); setPrepFormData({ prep: "", caseType: "Akkusativ", meaning: "", example: "", status: "In Progress" }); setPrepModalOpen(true); }} className="btn btn-primary">
                        + Add Preposition
                      </button>
                    </div>
                  </div>

                  <div className="list">
                    <div className="list-head preps-head"><span style={{ textAlign: "center" }}>#</span><span>CASE</span><span>PREPOSITION</span><span>MEANING</span><span>EXAMPLE SENTENCE</span><span>STATUS</span><span style={{ textAlign: "right" }}>ACTIONS</span></div>
                    {filteredPreps.map((item, index) => (
                      <div className={`row prep-row ${item.caseType}`} key={item.id}>
                        <div className="c-idx">{index + 1}</div>
                        <div className="c-case"><span className={`pill ${PREP_CASE_CLASS[item.caseType] || "bg-both"}`}>{item.caseType}</span></div>
                        <div className="c-prep" style={{ fontWeight: 700 }}>{item.prep}</div>
                        <div className="c-mean">{item.meaning}</div>
                        <div className="c-eg">{item.example || "—"}</div>
                        <div className="c-status">
                          <button onClick={() => commitPreps(prepsList.map((i) => i.id === item.id ? { ...i, status: i.status === "Mastered" ? "In Progress" : "Mastered" } : i))} className={`status ${item.status === "Mastered" ? "done" : "todo"}`}>
                            {item.status === "Mastered" ? "✔ Mastered" : "☐ In Progress"}
                          </button>
                        </div>
                        <div className="actions">
                          <button onClick={() => speakGerman(`${item.prep}. ${item.example || ""}`)} className="icon-btn">🔊</button>
                          <button onClick={() => { setEditingPrepId(item.id); setPrepFormData({ prep: item.prep, caseType: item.caseType, meaning: item.meaning, example: item.example, status: item.status }); setPrepModalOpen(true); }} className="icon-btn">✏️</button>
                          <button onClick={() => requestConfirmation("Delete Preposition", `Are you sure you want to delete "${item.prep}"?`, () => commitPreps(prepsList.filter((i) => i.id !== item.id)))} className="icon-btn">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {prepSubView === "flashcards" && (
                <div className="panel">
                  {!prepCard ? <p>No prepositions available.</p> : (
                    <div className="flash-wrap">
                      <div className="flash" onClick={() => setPrepCardFlipped(!prepCardFlipped)}>
                        {!prepCardFlipped ? (
                          <>
                            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>WHICH CASE DOES THIS PREPOSITION TAKE?</span>
                            <h2>{prepCard.prep}</h2>
                            <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                          </>
                        ) : (
                          <>
                            <span className={`pill ${PREP_CASE_CLASS[prepCard.caseType] || "bg-both"}`} style={{ fontSize: 22, padding: "6px 20px" }}>{prepCard.caseType === "Wechsel" ? "Wechselpräposition (Dat/Akk)" : `+ ${prepCard.caseType}`}</span>
                            <h3 style={{ fontSize: 22, margin: "14px 0 6px", color: "var(--ink-2)" }}>{prepCard.meaning}</h3>
                            {prepCard.example && <p style={{ color: "var(--muted)", margin: 0, fontSize: 14, fontStyle: "italic" }}>"{prepCard.example}"</p>}
                          </>
                        )}
                      </div>
                      <div className="flash-controls">
                        <button className="btn btn-secondary" disabled={prepCardIndex === 0} onClick={() => { setPrepCardIndex(prepCardIndex - 1); setPrepCardFlipped(false); }}>◀ Previous</button>
                        <button className="btn btn-secondary mid" onClick={() => speakGerman(`${prepCard.prep}. ${prepCard.example || ""}`)}>🔊 Pronounce</button>
                        <button className="btn btn-secondary" disabled={prepCardIndex >= prepsList.length - 1} onClick={() => { setPrepCardIndex(prepCardIndex + 1); setPrepCardFlipped(false); }}>Next ▶</button>
                      </div>
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>Preposition {prepCardIndex + 1} of {prepsList.length}</span>
                    </div>
                  )}
                </div>
              )}

              {prepSubView === "quiz" && (
                <div className="panel">
                  {!prepQuizWord ? <p>Add prepositions to start quiz.</p> : (
                    <div className="quiz">
                      <div className="quiz-head"><span>Question {prepQuizIndex + 1} of {prepsList.length}</span><span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {prepQuizScore}</span></div>
                      <div className="quiz-card">
                        <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Which case is required by this preposition?</span>
                        <h1>{prepQuizWord.prep}</h1>
                        <p style={{ color: "var(--muted)", margin: 0, fontSize: 15 }}>Meaning: <strong style={{ color: "var(--ink-2)" }}>{prepQuizWord.meaning}</strong></p>
                      </div>
                      <div className="quiz-opts">
                        {["Akkusativ", "Dativ", "Wechsel"].map((opt) => (
                          <button key={opt} disabled={prepQuizFeedback !== null} className={`quiz-opt ${opt}`} onClick={() => {
                            const ok = opt === prepQuizWord.caseType;
                            if (ok) setPrepQuizScore((s) => s + 1);
                            setPrepQuizFeedback(ok ? "Correct! 🎉" : `Wrong! "${prepQuizWord.prep}" takes "${prepQuizWord.caseType}".`);
                          }}>{opt}</button>
                        ))}
                      </div>
                      {prepQuizFeedback && (
                        <div style={{ marginTop: 24 }}>
                          <p style={{ fontSize: 15, fontWeight: 600 }}>{prepQuizFeedback}</p>
                          <button className="btn btn-primary" onClick={() => {
                            setPrepQuizFeedback(null);
                            if (prepQuizIndex < prepsList.length - 1) setPrepQuizIndex((i) => i + 1);
                            else { alert(`Preposition Quiz finished! Score: ${prepQuizScore}/${prepsList.length}`); setPrepQuizIndex(0); setPrepQuizScore(0); }
                          }}>{prepQuizIndex < prepsList.length - 1 ? "Next Preposition" : "Restart"}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ==================== 5. TIME (UHRZEIT) ==================== */}
          {mainCategory === "Time" && (
            <>
              {timeSubView === "list" && (
                <div className="grammar-hub-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Uhrzeit (Formal 24h vs. Informal 12h Format):</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div className="filters">
                        <button onClick={() => setTimeViewMode("all")} className={`chip all ${timeViewMode === "all" ? "on" : ""}`}>
                          ⚖️ Compare Both
                        </button>
                        <button onClick={() => setTimeViewMode("formal")} className={`chip der ${timeViewMode === "formal" ? "on" : ""}`}>
                          🏢 Formal (24h)
                        </button>
                        <button onClick={() => setTimeViewMode("informal")} className={`chip die ${timeViewMode === "informal" ? "on" : ""}`}>
                          ☕ Informal (12h)
                        </button>
                      </div>
                      
                      {/* ADD TIME BUTTON */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTimeId(null);
                          setTimeFormData({ digital: "", formal: "", informal: "", rule: "" });
                          setTimeModalOpen(true);
                        }}
                        className="btn btn-primary"
                      >
                        + Add Time
                      </button>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table className="grammar-table">
                      <thead>
                        <tr>
                          <th style={{ width: 90 }}>Digital</th>
                          {(timeViewMode === "all" || timeViewMode === "formal") && <th>Formal (Offiziell / 24h)</th>}
                          {(timeViewMode === "all" || timeViewMode === "informal") && <th>Informal (Umgangssprachlich / 12h)</th>}
                          <th>Rule / Structure</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeList.map((t) => (
                          <tr key={t.id || t.digital}>
                            <td style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 14 }}>{t.digital}</td>
                            {(timeViewMode === "all" || timeViewMode === "formal") && (
                              <td style={{ color: "var(--der)", fontWeight: 600 }}>{t.formal}</td>
                            )}
                            {(timeViewMode === "all" || timeViewMode === "informal") && (
                              <td style={{ color: "var(--die)", fontWeight: 600 }}>{t.informal || "—"}</td>
                            )}
                            <td style={{ fontSize: 13, color: "var(--muted)" }}>{t.rule}</td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                                <button
                                  type="button"
                                  onClick={() => speakGerman(timeViewMode === "formal" ? t.formal : t.informal || t.formal)}
                                  className="icon-btn"
                                  title="Pronounce"
                                >
                                  🔊
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTimeId(t.id || t.digital);
                                    setTimeFormData({
                                      digital: t.digital,
                                      formal: t.formal,
                                      informal: t.informal || "",
                                      rule: t.rule || "",
                                    });
                                    setTimeModalOpen(true);
                                  }}
                                  className="icon-btn"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    requestConfirmation("Delete Time Entry", `Are you sure you want to delete "${t.digital}"?`, () =>
                                      commitTimes(timeList.filter((item) => (item.id || item.digital) !== (t.id || t.digital)))
                                    )
                                  }
                                  className="icon-btn"
                                  title="Delete"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grammar-rule-box">
                    <strong>Essential Uhrzeit Rules:</strong>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 10 }}>
                      {TIME_RULES.map((r, i) => (
                        <div key={i} style={{ background: "var(--card)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line-2)" }}>
                          <span style={{ fontWeight: 700, color: "var(--brand)", fontSize: 13 }}>{r.term}</span>
                          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4 }}>{r.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {timeSubView === "flashcards" && (
                <div className="panel">
                  <div className="flash-wrap">
                    <div className="flash" onClick={() => setTimeCardFlipped(!timeCardFlipped)}>
                      {!timeCardFlipped ? (
                        <>
                          <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>HOW DO YOU SAY THIS TIME IN GERMAN?</span>
                          <h2 style={{ fontSize: 32 }}>{timeCard.prompt}</h2>
                          <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                        </>
                      ) : (
                        <>
                          <span className="pill bg-der" style={{ fontSize: 24, padding: "8px 24px" }}>{timeCard.answer}</span>
                          <h3 style={{ fontSize: 18, margin: "14px 0 6px", color: "var(--ink-2)" }}>{timeCard.note}</h3>
                        </>
                      )}
                    </div>
                    <div className="flash-controls">
                      <button className="btn btn-secondary" disabled={timeCardIndex === 0} onClick={() => { setTimeCardIndex(timeCardIndex - 1); setTimeCardFlipped(false); }}>◀ Previous</button>
                      <button className="btn btn-secondary mid" onClick={() => speakGerman(timeCard.answer)}>🔊 Pronounce</button>
                      <button className="btn btn-secondary" disabled={timeCardIndex >= TIME_FLASHCARDS.length - 1} onClick={() => { setTimeCardIndex(timeCardIndex + 1); setTimeCardFlipped(false); }}>Next ▶</button>
                    </div>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>Flashcard {timeCardIndex + 1} of {TIME_FLASHCARDS.length}</span>
                  </div>
                </div>
              )}

              {timeSubView === "quiz" && (
                <div className="panel">
                  <div className="quiz">
                    <div className="quiz-head"><span>Question {timeQuizIndex + 1} of {TIME_QUIZ.length}</span><span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {timeQuizScore}</span></div>
                    <div className="quiz-card">
                      <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Select the correct time:</span>
                      <h1 style={{ fontSize: 24 }}>{timeQuizWord.q}</h1>
                    </div>
                    <div className="quiz-opts" style={{ gridTemplateColumns: "1fr" }}>
                      {timeQuizWord.options.map((opt) => (
                        <button key={opt} disabled={timeQuizFeedback !== null} className="quiz-opt" onClick={() => {
                          const ok = opt === timeQuizWord.answer;
                          if (ok) setTimeQuizScore((s) => s + 1);
                          setTimeQuizFeedback(ok ? `Correct! 🎉 ${timeQuizWord.expl}` : `Wrong! Correct phrasing is "${timeQuizWord.answer}". (${timeQuizWord.expl})`);
                        }}>{opt}</button>
                      ))}
                    </div>
                    {timeQuizFeedback && (
                      <div style={{ marginTop: 24 }}>
                        <p style={{ fontSize: 15, fontWeight: 600 }}>{timeQuizFeedback}</p>
                        <button className="btn btn-primary" onClick={() => {
                          setTimeQuizFeedback(null);
                          if (timeQuizIndex < TIME_QUIZ.length - 1) setTimeQuizIndex((i) => i + 1);
                          else { alert(`Time Quiz finished! Final Score: ${timeQuizScore}/${TIME_QUIZ.length}`); setTimeQuizIndex(0); setTimeQuizScore(0); }
                        }}>{timeQuizIndex < TIME_QUIZ.length - 1 ? "Next Question" : "Restart"}</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================== 6. GRAMMAR HUB ==================== */}
          {mainCategory === "Grammar" && (
            <>
              {grammarSubView === "list" && (
                <div className="grammar-hub-card">
                  <div className="grammar-topic-nav">
                    {GRAMMAR_TOPICS.map((t) => (
                      <button key={t.id} onClick={() => setActiveGrammarTopic(t.id)} className={`grammar-topic-btn ${activeGrammarTopic === t.id ? "active" : ""}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {activeGrammarTopic === "possessives" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Possessive Articles Matrix:</span>
                        <div className="filters">
                          {["Nominativ", "Akkusativ", "Dativ", "Genitiv"].map((c) => (
                            <button key={c} onClick={() => setGrammarCaseFilter(c)} className={`chip ${grammarCaseFilter === c ? "all on" : "all"}`}>
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="table-wrap">
                        <table className="grammar-table">
                          <thead>
                            <tr>
                              <th>Owner (Besitzer)</th>
                              <th>Stem</th>
                              <th>Masculine ({grammarCaseFilter})</th>
                              <th>Feminine ({grammarCaseFilter})</th>
                              <th>Neuter ({grammarCaseFilter})</th>
                              <th>Plural ({grammarCaseFilter})</th>
                            </tr>
                          </thead>
                          <tbody>
                            {POSSESSIVE_STEMS.map((s) => (
                              <tr key={s.owner}>
                                <td style={{ fontWeight: 600 }}>{s.owner}</td>
                                <td className="grammar-highlight">{s.stem}-</td>
                                <td>{getPossessiveForm(s, "m", grammarCaseFilter)}</td>
                                <td>{getPossessiveForm(s, "f", grammarCaseFilter)}</td>
                                <td>{getPossessiveForm(s, "n", grammarCaseFilter)}</td>
                                <td>{getPossessiveForm(s, "pl", grammarCaseFilter)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="grammar-rule-box">
                        <strong>Core Rules to Remember:</strong><br />
                        • <strong>euer</strong> drops its middle 'e' when taking an ending: <em>euer $\rightarrow$ eure, eurem, euren, eurer</em>.<br />
                        • <strong>Dativ Plural:</strong> adds <strong>-en</strong> to the possessive, and the noun adds <strong>-n</strong> (<em>mit meinen Freunden</em>).<br />
                        • <strong>Genitiv M/N:</strong> possessive takes <strong>-es</strong>, noun adds <strong>-(e)s</strong> (<em>das Auto meines Bruders</em>).
                      </div>
                    </div>
                  )}

                  {activeGrammarTopic === "articles" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Definite (der) &amp; Indefinite (ein / kein) Declension:</span>
                      <div className="table-wrap">
                        <table className="grammar-table">
                          <thead>
                            <tr>
                              <th>Case</th>
                              <th>Definite (der/die/das)</th>
                              <th>Indefinite (ein/eine)</th>
                              <th>Negative (kein-)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.keys(ARTICLES_TABLE).map((c) => (
                              <tr key={c}>
                                <td style={{ fontWeight: 700 }}>{c}</td>
                                <td>{ARTICLES_TABLE[c].def_m} / {ARTICLES_TABLE[c].def_f} / {ARTICLES_TABLE[c].def_n} / {ARTICLES_TABLE[c].def_pl}</td>
                                <td>{ARTICLES_TABLE[c].indef_m} / {ARTICLES_TABLE[c].indef_f} / {ARTICLES_TABLE[c].indef_n} / —</td>
                                <td>{ARTICLES_TABLE[c].indef_m.replace("ein", "kein")} / {ARTICLES_TABLE[c].indef_f.replace("ein", "kein")} / {ARTICLES_TABLE[c].indef_n.replace("ein", "kein")} / {ARTICLES_TABLE[c].neg_pl}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeGrammarTopic === "demonstratives" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Demonstrative (dieser-) &amp; Interrogative (welcher-):</span>
                      <div className="table-wrap">
                        <table className="grammar-table">
                          <thead>
                            <tr>
                              <th>Case</th>
                              <th>dieser (this) [m / f / n / pl]</th>
                              <th>welcher (which) [m / f / n / pl]</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.keys(DEMONSTRATIVES_TABLE).map((c) => (
                              <tr key={c}>
                                <td style={{ fontWeight: 700 }}>{c}</td>
                                <td>{DEMONSTRATIVES_TABLE[c].m} / {DEMONSTRATIVES_TABLE[c].f} / {DEMONSTRATIVES_TABLE[c].n} / {DEMONSTRATIVES_TABLE[c].pl}</td>
                                <td>{DEMONSTRATIVES_TABLE[c].wm} / {DEMONSTRATIVES_TABLE[c].wf} / {DEMONSTRATIVES_TABLE[c].wn} / {DEMONSTRATIVES_TABLE[c].wpl}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeGrammarTopic === "personal" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Personal Pronouns (Personalpronomen):</span>
                      <div className="table-wrap">
                        <table className="grammar-table">
                          <thead>
                            <tr>
                              <th>Person</th>
                              <th>Nominativ</th>
                              <th>Akkusativ</th>
                              <th>Dativ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {PERSONAL_PRONOUNS_TABLE.map((row) => (
                              <tr key={row.p}>
                                <td style={{ fontWeight: 600 }}>{row.p}</td>
                                <td>{row.nom}</td>
                                <td className="grammar-highlight">{row.akk}</td>
                                <td style={{ fontWeight: 700, color: "var(--dativ)" }}>{row.dat}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeGrammarTopic === "adjectives" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Adjective Declension (Adjektivdeklination):</span>
                      <div className="table-wrap">
                        <table className="grammar-table">
                          <thead>
                            <tr>
                              <th>Declension Type</th>
                              <th>Nominativ</th>
                              <th>Akkusativ</th>
                              <th>Dativ / Genitiv</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ADJECTIVE_ENDINGS_RULES.map((r) => (
                              <tr key={r.type}>
                                <td style={{ fontWeight: 700 }}>{r.type}</td>
                                <td>{r.nom}</td>
                                <td>{r.akk}</td>
                                <td>{r.dat}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {grammarSubView === "flashcards" && (
                <div className="panel">
                  <div className="flash-wrap">
                    <div className="flash" onClick={() => setGrammarCardFlipped(!grammarCardFlipped)}>
                      {!grammarCardFlipped ? (
                        <>
                          <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>GRAMMAR PRACTICE PROMPT</span>
                          <h2 style={{ fontSize: 32 }}>{grammarCard.prompt}</h2>
                          <span style={{ fontSize: 12, color: "var(--faint)" }}>(Tap to flip)</span>
                        </>
                      ) : (
                        <>
                          <span className="pill bg-der" style={{ fontSize: 26, padding: "8px 24px" }}>{grammarCard.answer}</span>
                          <h3 style={{ fontSize: 20, margin: "14px 0 6px", color: "var(--ink-2)" }}>{grammarCard.note}</h3>
                        </>
                      )}
                    </div>
                    <div className="flash-controls">
                      <button className="btn btn-secondary" disabled={grammarCardIndex === 0} onClick={() => { setGrammarCardIndex(grammarCardIndex - 1); setGrammarCardFlipped(false); }}>◀ Previous</button>
                      <button className="btn btn-secondary mid" onClick={() => speakGerman(grammarCard.answer)}>🔊 Pronounce</button>
                      <button className="btn btn-secondary" disabled={grammarCardIndex >= GRAMMAR_FLASHCARDS.length - 1} onClick={() => { setGrammarCardIndex(grammarCardIndex + 1); setGrammarCardFlipped(false); }}>Next ▶</button>
                    </div>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>Flashcard {grammarCardIndex + 1} of {GRAMMAR_FLASHCARDS.length}</span>
                  </div>
                </div>
              )}

              {grammarSubView === "quiz" && (
                <div className="panel">
                  <div className="quiz">
                    <div className="quiz-head"><span>Question {grammarQuizIndex + 1} of {GRAMMAR_QUIZ.length}</span><span style={{ fontWeight: 700, color: "var(--brand)" }}>Score: {grammarQuizScore}</span></div>
                    <div className="quiz-card">
                      <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Fill in the correct form:</span>
                      <h1 style={{ fontSize: 26 }}>{grammarQuizWord.q}</h1>
                    </div>
                    <div className="quiz-opts">
                      {grammarQuizWord.options.map((opt) => (
                        <button key={opt} disabled={grammarQuizFeedback !== null} className="quiz-opt" onClick={() => {
                          const ok = opt === grammarQuizWord.answer;
                          if (ok) setGrammarQuizScore((s) => s + 1);
                          setTimeQuizFeedback(ok ? `Correct! 🎉 ${grammarQuizWord.expl}` : `Wrong! Correct form is "${grammarQuizWord.answer}". (${grammarQuizWord.expl})`);
                        }}>{opt}</button>
                      ))}
                    </div>
                    {grammarQuizFeedback && (
                      <div style={{ marginTop: 24 }}>
                        <p style={{ fontSize: 15, fontWeight: 600 }}>{grammarQuizFeedback}</p>
                        <button className="btn btn-primary" onClick={() => {
                          setGrammarQuizFeedback(null);
                          if (grammarQuizIndex < GRAMMAR_QUIZ.length - 1) setGrammarQuizIndex((i) => i + 1);
                          else { alert(`Grammar Quiz finished! Final Score: ${grammarQuizScore}/${GRAMMAR_QUIZ.length}`); setGrammarQuizIndex(0); setGrammarQuizScore(0); }
                        }}>{grammarQuizIndex < GRAMMAR_QUIZ.length - 1 ? "Next Question" : "Restart"}</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ==================== CONFIRMATION POP-UP MODAL ==================== */}
      {confirmModal.isOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setConfirmModal((prev) => ({ ...prev, isOpen: false }))}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="confirm-box">
              <span className="confirm-icon">⚠️</span>
              <h3 style={{ margin: 0 }}>{confirmModal.title}</h3>
              <p>{confirmModal.message}</p>
              <div className="modal-actions" style={{ justifyContent: "center" }}>
                <button type="button" onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="button" onClick={confirmModal.onConfirm} className="btn btn-danger">
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== NOUN MODAL ==================== */}
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
                      <input type="radio" name="article" value={art} checked={nounFormData.article === art} onChange={(e) => setNounFormData({ ...nounFormData, article: e.target.value })} />
                      {art}
                    </label>
                  ))}
                </div>
              </div>
              <div><label className="modal-label">German Noun (Singular)</label><input className="modal-input" type="text" required placeholder="e.g. Apfel" value={nounFormData.noun} onChange={(e) => setNounFormData({ ...nounFormData, noun: e.target.value })} /></div>
              <div><label className="modal-label">Plural Form (die ...)</label><input className="modal-input" type="text" placeholder="e.g. die Äpfel" value={nounFormData.plural} onChange={(e) => setNounFormData({ ...nounFormData, plural: e.target.value })} /></div>
              <div><label className="modal-label">English Meaning</label><input className="modal-input" type="text" required placeholder="e.g. Apple" value={nounFormData.meaning} onChange={(e) => setNounFormData({ ...nounFormData, meaning: e.target.value })} /></div>
              <div>
                <label className="modal-label">Status</label>
                <CustomDropdown
                  fullWidth
                  value={nounFormData.status}
                  options={STATUS_OPTIONS}
                  onChange={(val) => setNounFormData({ ...nounFormData, status: val })}
                />
              </div>
              <div className="modal-actions"><button type="button" onClick={() => setNounModalOpen(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Save Noun</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== VERB MODAL ==================== */}
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
                      <input type="radio" name="caseType" value={c} checked={verbFormData.caseType === c} onChange={(e) => setVerbFormData({ ...verbFormData, caseType: e.target.value })} />
                      {c === "Both / Common" ? "Both" : c}
                    </label>
                  ))}
                </div>
              </div>
              <div><label className="modal-label">Infinitive Verb</label><input className="modal-input" type="text" required placeholder="e.g. helfen" value={verbFormData.verb} onChange={(e) => setVerbFormData({ ...verbFormData, verb: e.target.value })} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label className="modal-label">Präteritum (Simple Past)</label><input className="modal-input" type="text" placeholder="e.g. half" value={verbFormData.preterite} onChange={(e) => setVerbFormData({ ...verbFormData, preterite: e.target.value })} /></div>
                <div><label className="modal-label">Partizip II (Past Participle)</label><input className="modal-input" type="text" placeholder="e.g. geholfen" value={verbFormData.participle} onChange={(e) => setVerbFormData({ ...verbFormData, participle: e.target.value })} /></div>
              </div>
              <div><label className="modal-label">English Meaning</label><input className="modal-input" type="text" required placeholder="e.g. to help (+ Dat)" value={verbFormData.meaning} onChange={(e) => setVerbFormData({ ...verbFormData, meaning: e.target.value })} /></div>
              <div><label className="modal-label">Example Sentence</label><input className="modal-input" type="text" placeholder="e.g. Ich helfe dir." value={verbFormData.example} onChange={(e) => setVerbFormData({ ...verbFormData, example: e.target.value })} /></div>
              <div>
                <label className="modal-label">Status</label>
                <CustomDropdown
                  fullWidth
                  value={verbFormData.status}
                  options={STATUS_OPTIONS}
                  onChange={(val) => setVerbFormData({ ...verbFormData, status: val })}
                />
              </div>
              <div className="modal-actions"><button type="button" onClick={() => setVerbModalOpen(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Save Verb</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== PATTERN MODAL ==================== */}
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
                      <input type="radio" name="patternArticle" value={art} checked={patternFormData.article === art} onChange={(e) => setPatternFormData({ ...patternFormData, article: e.target.value })} />
                      {art}
                    </label>
                  ))}
                </div>
              </div>
              <div><label className="modal-label">Ending / Pattern Suffix</label><input className="modal-input" type="text" required placeholder="e.g. -tion" value={patternFormData.ending} onChange={(e) => setPatternFormData({ ...patternFormData, ending: e.target.value })} /></div>
              <div><label className="modal-label">Rule / Explanation</label><input className="modal-input" type="text" required placeholder="e.g. Words of Latin origin" value={patternFormData.rule} onChange={(e) => setPatternFormData({ ...patternFormData, rule: e.target.value })} /></div>
              <div><label className="modal-label">Examples</label><input className="modal-input" type="text" placeholder="e.g. die Station, die Nation" value={patternFormData.examples} onChange={(e) => setPatternFormData({ ...patternFormData, examples: e.target.value })} /></div>
              <div className="modal-actions"><button type="button" onClick={() => setPatternModalOpen(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Save Pattern</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== PREPOSITION MODAL ==================== */}
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
                      <input type="radio" name="prepCaseType" value={c} checked={prepFormData.caseType === c} onChange={(e) => setPrepFormData({ ...prepFormData, caseType: e.target.value })} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
              <div><label className="modal-label">Preposition</label><input className="modal-input" type="text" required placeholder="e.g. ohne, mit" value={prepFormData.prep} onChange={(e) => setPrepFormData({ ...prepFormData, prep: e.target.value })} /></div>
              <div><label className="modal-label">English Meaning</label><input className="modal-input" type="text" required placeholder="e.g. without, with" value={prepFormData.meaning} onChange={(e) => setPrepFormData({ ...prepFormData, meaning: e.target.value })} /></div>
              <div><label className="modal-label">Example Sentence</label><input className="modal-input" type="text" placeholder="e.g. Er geht ohne mich." value={prepFormData.example} onChange={(e) => setPrepFormData({ ...prepFormData, example: e.target.value })} /></div>
              <div>
                <label className="modal-label">Status</label>
                <CustomDropdown
                  fullWidth
                  value={prepFormData.status}
                  options={STATUS_OPTIONS}
                  onChange={(val) => setPrepFormData({ ...prepFormData, status: val })}
                />
              </div>
              <div className="modal-actions"><button type="button" onClick={() => setPrepModalOpen(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Save Preposition</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== TIME MODAL ==================== */}
      {timeModalOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setTimeModalOpen(false)}>
          <div className="modal">
            <h3>{editingTimeId ? "Edit Time Expression" : "Add Time Expression"}</h3>
            <form onSubmit={handleSaveTimeModal}>
              <div>
                <label className="modal-label">Digital Time (e.g. 09:15 or 17:30)</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. 14:45"
                  value={timeFormData.digital}
                  onChange={(e) => setTimeFormData({ ...timeFormData, digital: e.target.value })}
                />
              </div>
              <div>
                <label className="modal-label">Formal / Official Phrasing (24h)</label>
                <input
                  className="modal-input"
                  type="text"
                  required
                  placeholder="e.g. Es ist vierzehn Uhr fünfundvierzig."
                  value={timeFormData.formal}
                  onChange={(e) => setTimeFormData({ ...timeFormData, formal: e.target.value })}
                />
              </div>
              <div>
                <label className="modal-label">Informal Phrasing (12h)</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. Es ist Viertel vor drei."
                  value={timeFormData.informal}
                  onChange={(e) => setTimeFormData({ ...timeFormData, informal: e.target.value })}
                />
              </div>
              <div>
                <label className="modal-label">Rule / Explanation</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="e.g. Quarter to next hour (Viertel vor)"
                  value={timeFormData.rule}
                  onChange={(e) => setTimeFormData({ ...timeFormData, rule: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setTimeModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}