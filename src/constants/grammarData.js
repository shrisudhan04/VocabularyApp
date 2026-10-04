export const GRAMMAR_TOPICS = [
  { id: "possessives", label: "Possessivartikel (mein, dein)" },
  { id: "articles", label: "Articles (der / ein / kein)" },
  { id: "demonstratives", label: "Demonstratives (dieser, welcher)" },
  { id: "personal", label: "Personal Pronouns (mich, mir)" },
  { id: "adjectives", label: "Adjective Endings" },
];

export const POSSESSIVE_STEMS = [
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

export const POSSESSIVE_ENDINGS = {
  Nominativ: { m: "–", f: "-e", n: "–", pl: "-e" },
  Akkusativ: { m: "-en", f: "-e", n: "–", pl: "-e" },
  Dativ: { m: "-em", f: "-er", n: "-em", pl: "-en" },
  Genitiv: { m: "-es", f: "-er", n: "-es", pl: "-er" },
};

export const ARTICLES_TABLE = {
  Nominativ: { def_m: "der", def_f: "die", def_n: "das", def_pl: "die", indef_m: "ein", indef_f: "eine", indef_n: "ein", neg_pl: "keine" },
  Akkusativ: { def_m: "den", def_f: "die", def_n: "das", def_pl: "die", indef_m: "einen", indef_f: "eine", indef_n: "ein", neg_pl: "keine" },
  Dativ: { def_m: "dem", def_f: "der", def_n: "dem", def_pl: "den (+n)", indef_m: "einem", indef_f: "einer", indef_n: "einem", neg_pl: "keinen (+n)" },
  Genitiv: { def_m: "des (+s)", def_f: "der", def_n: "des (+s)", def_pl: "der", indef_m: "eines (+s)", indef_f: "einer", indef_n: "eines (+s)", neg_pl: "keiner" },
};

export const DEMONSTRATIVES_TABLE = {
  Nominativ: { m: "dieser", f: "diese", n: "dieses", pl: "diese", wm: "welcher", wf: "welche", wn: "welches", wpl: "welche" },
  Akkusativ: { m: "diesen", f: "diese", n: "dieses", pl: "diese", wm: "welchen", wf: "welche", wn: "welches", wpl: "welche" },
  Dativ: { m: "diesem", f: "dieser", n: "diesem", pl: "diesen (+n)", wm: "welchem", wf: "welcher", wn: "welchem", wpl: "welchen (+n)" },
  Genitiv: { m: "dieses", f: "dieser", n: "dieses", pl: "dieser", wm: "welches", wf: "welcher", wn: "welches", wpl: "welcher" },
};

export const PERSONAL_PRONOUNS_TABLE = [
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

export const ADJECTIVE_ENDINGS_RULES = [
  { type: "Weak (after der/die/das)", nom: "m: -e, f: -e, n: -e, pl: -en", akk: "m: -en, f: -e, n: -e, pl: -en", dat: "all: -en", gen: "all: -en" },
  { type: "Mixed (after ein/kein/mein)", nom: "m: -er, f: -e, n: -es, pl: -en", akk: "m: -en, f: -e, n: -es, pl: -en", dat: "all: -en", gen: "all: -en" },
  { type: "Strong (zero article)", nom: "m: -er, f: -e, n: -es, pl: -e", akk: "m: -en, f: -e, n: -es, pl: -e", dat: "m: -em, f: -er, n: -em, pl: -en", gen: "m: -en, f: -er, n: -en, pl: -er" },
];

export const TIME_RULES = [
  { term: "Formal (Offiziell)", desc: "Uses the 24-hour clock. Pattern: [Stunde] + Uhr + [Minute]. No 'vor', 'nach', or 'halb'." },
  { term: "Informal (Umgangssprachlich)", desc: "Uses the 12-hour clock. Expressed relative to the hour using 'vor' (before), 'nach' (after), and 'halb' (halfway to)." },
  { term: "halb [Stunde]", desc: "Crucial rule: 'halb neun' means 08:30 (halfway to nine), NOT 09:30." },
  { term: "Viertel vor / nach", desc: "'Viertel nach' = 15 minutes past; 'Viertel vor' = 15 minutes before the next hour." },
  { term: "Key Questions", desc: "Wie spät ist es? / Wie viel Uhr ist es? (What time is it?) | Um wie viel Uhr...? (At what time...?)" },
];

export const TIME_FLASHCARDS = [
  { id: "tf1", prompt: "Informal Time: 07:30", answer: "Es ist halb acht.", note: "'halb' looks forward to the next hour (8)." },
  { id: "tf2", prompt: "Formal Time: 15:45", answer: "Es ist fünfzehn Uhr fünfundvierzig.", note: "Pattern: [Hour 24h] + Uhr + [Minute]." },
  { id: "tf3", prompt: "Informal Time: 10:15", answer: "Es ist Viertel nach zehn.", note: "Quarter past takes 'nach'." },
  { id: "tf4", prompt: "Informal Time: 11:25", answer: "Es ist fünf vor halb zwölf.", note: "Measured relative to 11:30 (halb zwölf)." },
  { id: "tf5", prompt: "Informal Time: 09:40", answer: "Es ist zwanzig vor zehn.", note: "20 minutes before 10 o'clock." },
];

export const TIME_QUIZ = [
  { q: "Wie spät ist es um 14:30? (Informell)", answer: "halb drei", options: ["halb zwei", "halb drei", "zwei Uhr dreißig"], expl: "'halb' points to the upcoming hour (3), so 14:30 is 'halb drei'." },
  { q: "Wie sagt man 18:15 offiziell (Formal)?", answer: "achtzehn Uhr fünfzehn", options: ["Viertel nach sechs", "achtzehn Uhr fünfzehn", "sechs Uhr fünfzehn"], expl: "Formal uses 24h format: [Hour] Uhr [Minutes]." },
  { q: "Was bedeutet 'Es ist Viertel vor fünf'?", answer: "04:45 / 16:45", options: ["04:15 / 16:15", "05:15 / 17:15", "04:45 / 16:45"], expl: "'Viertel vor' means 15 minutes before the hour." },
  { q: "Wie heißt 08:25 umgangssprachlich?", answer: "fünf vor halb neun", options: ["fünfundzwanzig nach acht", "fünf nach halb acht", "fünf vor halb neun"], expl: "German relates 25 past to half-past: 5 before half 9." },
];

export const GRAMMAR_FLASHCARDS = [
  { id: "g1", prompt: "ich + Akkusativ + Maskulin Possessive", answer: "meinen", note: "z.B. Ich sehe meinen Bruder." },
  { id: "g2", prompt: "ihr (you pl.) + Dativ + Maskulin Possessive", answer: "eurem", note: "Achtung: euer drops 'e' -> eurem." },
  { id: "g3", prompt: "Personal Pronoun: du in Dativ", answer: "dir", note: "z.B. Wie geht es dir?" },
  { id: "g4", prompt: "Personal Pronoun: er in Akkusativ", answer: "ihn", note: "z.B. Ich kenne ihn gut." },
  { id: "g5", prompt: "Demonstrative: 'this' + Dativ Maskulin", answer: "diesem", note: "z.B. In diesem Zimmer." },
  { id: "g6", prompt: "Negative: kein + Akkusativ Maskulin", answer: "keinen", note: "z.B. Ich habe keinen Hunger." },
  { id: "g7", prompt: "Definite: Dativ Plural Article", answer: "den (+n)", note: "z.B. mit den Freunden." },
  { id: "g8", prompt: "Adjective: ein + groß- + Maskulin Nominativ", answer: "ein großer", note: "Mixed declension takes -er for masculine." },
];

export const GRAMMAR_QUIZ = [
  { q: "Ich helfe ___ Bruder. (mein)", answer: "meinem", options: ["mein", "meinen", "meinem"], expl: "helfen + Dativ (Maskulin: -em)" },
  { q: "Wir besuchen ___ Eltern. (unser)", answer: "unsere", options: ["unser", "unseren", "unsere"], expl: "besuchen + Akkusativ (Plural: -e)" },
  { q: "Er gibt ___ Schwester ein Buch. (sein)", answer: "seiner", options: ["seine", "seiner", "seinem"], expl: "geben + Dativ (Feminin: -er)" },
  { q: "Ich habe ___ Zeit heute. (kein)", answer: "keine", options: ["kein", "keine", "keinen"], expl: "Zeit ist Feminin (Akkusativ: -e)" },
  { q: "In ___ Restaurant essen wir? (welcher, Dativ Neutrum)", answer: "welchem", options: ["welcher", "welchen", "welchem"], expl: "in + Dativ Neutrum nimmt -em" },
  { q: "Kannst du ___ bitte helfen? (ich, Dativ)", answer: "mir", options: ["mich", "mir", "meinem"], expl: "helfen verlangt Dativ -> mir" },
  { q: "Das ist das Auto ___ Vaters. (dieser, Genitiv)", answer: "dieses", options: ["diesem", "dieser", "dieses"], expl: "Genitiv Maskulin: dieses Vaters" },
  { q: "Das ist ein ___ Tag. (schön, Nom Masc)", answer: "schöner", options: ["schöne", "schöner", "schönen"], expl: "ein + Adjektiv (Maskulin Nominativ: -er)" },
];