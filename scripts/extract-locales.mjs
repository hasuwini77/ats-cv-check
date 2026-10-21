// Copies the finding copy and category labels from the hosted app's message
// files into src/locales/<lang>.json, then applies the package-only overrides below.
// Run once per sync; the output is committed.
//   node scripts/extract-locales.mjs /path/to/app/messages
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/extract-locales.mjs <messages-dir>");
  process.exit(1);
}

// Package-only wording. The hosted page talks about uploads; this package takes
// text you already extracted. Ids and placeholders stay the same.
const OVERRIDES = {
  en: {
    "not-enough-text": {
      fix: "Add more content — a full CV usually runs 300+ words; make sure the text you passed in was extracted completely.",
    },
  },
  sv: {
    "not-enough-text": {
      fix: "Lägg till mer innehåll — ett fullständigt CV är oftast 300+ ord; kontrollera att hela texten extraherades innan du skickade in den.",
    },
  },
  fr: {
    "not-enough-text": {
      fix: "Ajoutez plus de contenu — un CV complet fait généralement 300 mots ou plus ; vérifiez que le texte fourni a été extrait en entier.",
    },
  },
};

for (const lang of ["en", "sv", "fr"]) {
  const src = JSON.parse(readFileSync(join(dir, `${lang}.json`), "utf8")).cvCheck;
  const out = { categories: src.results.categories, findings: { ...src.findings } };
  for (const [id, patch] of Object.entries(OVERRIDES[lang])) {
    out.findings[id] = { ...out.findings[id], ...patch };
  }
  writeFileSync(
    new URL(`../src/locales/${lang}.json`, import.meta.url),
    JSON.stringify(out, null, 2) + "\n",
  );
  console.log(lang, Object.keys(out.findings).length, "findings");
}
