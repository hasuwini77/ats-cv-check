// Copies the finding copy and category labels from the hosted app's message
// files into src/locales/<lang>.json. Run once per sync; the output is committed.
//   node scripts/extract-locales.mjs /path/to/app/messages
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/extract-locales.mjs <messages-dir>");
  process.exit(1);
}

for (const lang of ["en", "sv", "fr"]) {
  const src = JSON.parse(readFileSync(join(dir, `${lang}.json`), "utf8")).cvCheck;
  const out = { categories: src.results.categories, findings: src.findings };
  writeFileSync(
    new URL(`../src/locales/${lang}.json`, import.meta.url),
    JSON.stringify(out, null, 2) + "\n",
  );
  console.log(lang, Object.keys(out.findings).length, "findings");
}
