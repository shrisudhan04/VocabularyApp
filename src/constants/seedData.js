export const SEED_DATA = [
  { id: 1, article: "der", noun: "Mann", plural: "die Männer", gender: "Masculine", meaning: "Male / Man", status: "Mastered", createdAt: "2026-09-01T10:00:00.000Z" },
  { id: 2, article: "die", noun: "Frau", plural: "die Frauen", gender: "Feminine", meaning: "Woman / Wife", status: "In Progress", createdAt: "2026-09-05T11:00:00.000Z" },
  { id: 3, article: "das", noun: "Kind", plural: "die Kinder", gender: "Neuter", meaning: "Child", status: "In Progress", createdAt: "2026-09-10T14:30:00.000Z" },
  { id: 4, article: "der", noun: "Tisch", plural: "die Tische", gender: "Masculine", meaning: "Table", status: "Mastered", createdAt: "2026-09-15T09:20:00.000Z" },
  { id: 5, article: "die", noun: "Sonne", plural: "die Sonnen", gender: "Feminine", meaning: "Sun", status: "Mastered", createdAt: "2026-09-20T16:00:00.000Z" },
  { id: 6, article: "das", noun: "Buch", plural: "die Bücher", gender: "Neuter", meaning: "Book", status: "In Progress", createdAt: "2026-09-25T18:45:00.000Z" },
];

export const SEED_VERBS = [
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

export const SEED_PATTERNS = [
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

export const SEED_PREPOSITIONS = [
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

export const SEED_TIME = [
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

export const DATE_OPTIONS = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "week", label: "Past 7 Days" },
  { value: "month", label: "Past 30 Days" },
  { value: "custom", label: "Specific Date..." },
];

export const STATUS_OPTIONS = [
  { value: "In Progress", label: "In Progress" },
  { value: "Mastered", label: "Mastered" },
];

export const ARTICLE_CLASS = { der: "bg-der", die: "bg-die", das: "bg-das" };
export const VERB_CASE_CLASS = { Dativ: "bg-dativ", Akkusativ: "bg-akku", "Both / Common": "bg-both" };
export const PREP_CASE_CLASS = { Dativ: "bg-dativ", Akkusativ: "bg-akku", Wechsel: "bg-wechsel" };
export const GENDER_MAP = { der: "Masculine", die: "Feminine", das: "Neuter" };