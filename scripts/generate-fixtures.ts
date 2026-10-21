// Generates tests/fixtures/parity.json from the hosted app's engine.
//
//   npx tsx scripts/generate-fixtures.ts /path/to/app-repo
//
// It imports the app's lib/cv-check.ts straight from disk, runs every case
// below, and writes the exact outputs plus the app commit SHA. CI never runs
// this: it only reads the committed JSON (tests/parity.test.ts).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (!process.argv[2]) {
  console.error("usage: npx tsx scripts/generate-fixtures.ts /path/to/app-repo");
  process.exit(1);
}
const appDir = resolve(process.argv[2]);

const engine = await import(pathToFileURL(join(appDir, "lib/cv-check.ts")).href);
const samples = await import(pathToFileURL(join(appDir, "lib/cv-check-samples.ts")).href);
const checkCv = engine.checkCv as (input: unknown) => Record<string, any>;
const getSampleCvText = samples.getSampleCvText as (l: string) => string;

const git = (...args: string[]) =>
  execFileSync("git", ["-C", appDir, ...args], { encoding: "utf8" }).trim();
const sha = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain", "--", "lib/cv-check.ts", "lib/cv-check-types.ts", "lib/cv-check-samples.ts");
if (dirty) throw new Error("engine files have uncommitted changes in the source repo:\n" + dirty);

const JD_EN = `We are looking for a Senior Product Designer to own our design system and
dashboard work. You will partner with engineering and product managers, run
user research, ship accessible interfaces (WCAG), prototype in Figma and
measure impact. Experience with B2B SaaS, data visualisation, React component
libraries and design critique is a strong plus.`;

const JD_SV = `Vi söker en senior produktdesigner som ansvarar för vårt designsystem och
våra dashboards. Du samarbetar med utvecklare och produktchefer, driver
användarforskning, levererar tillgängliga gränssnitt, prototypar i Figma och
mäter effekt. Erfarenhet av B2B SaaS, datavisualisering och komponentbibliotek.`;

const JD_FR_LOW = `Nous recherchons un chef de cuisine expérimenté pour notre restaurant.
Vous gérez les achats, la brigade, les normes d'hygiène HACCP, les menus
saisonniers et la formation des commis en cuisine chaude et pâtisserie.`;

const SHORT = "Jane Roe. Designer. I like design and building things for people who need them.";

const WEAK_EN = `Sam Lee
Worked at a shop 2019
Helped customers and was responsible for the till.
Then I did some work at a cafe from 05/2021 to 2022-03.
Responsible for coffee and cleaning, helped with the team and worked on many tasks every day for the owner
who was happy. I am a hard worker and a team player with good communication skills and a positive attitude
to anything that comes my way in any working environment. Reliable, punctual, quick learner, flexible.
Later I was in charge of ordering stock and making sure the shelves looked good for customers who came in.
Was involved in lots of things around the place and assisted with various duties as needed by management.
Hobbies: football, music, cooking, travelling and spending time with friends and family on weekends.`;

const MESSY = getSampleCvText("en").replace(
  "SKILLS",
  [
    "SKILLS",
    "Figma\t\tExpert\t\t6 yrs",
    "Canvas\t\tAdvanced\t\t3 yrs",
    "Research\t\tAdvanced\t\t5 yrs",
    "★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■",
"★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■",
"★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■",
"★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■",
"★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■ ★ ◆ ✓ ➤ ● ■",
  ].join("\n"),
);

const WEAK_BULLETS = getSampleCvText("en")
  .split("\n")
  .map((l) =>
    l.startsWith("- ") ? "- Responsible for helping with the team and assisting on various things in the area" : l,
  )
  .join("\n");

const MIXED_DATES = getSampleCvText("en")
  .replace("March 2023 – Present", "03/2016 – 2018")
  .replace("January 2020 – February 2023", "Jan 2017 to Feb 2019")
  .replace("June 2018 – December 2019", "2021-01 – 2023-06");

const LONG = [1, 2, 3, 4].map(() => getSampleCvText("en")).join("\n\n");

// Accent handling (JS \\b is ASCII-only, so these used to misfire).
const FR_STUDIES_HEADING = getSampleCvText("fr").replace("FORMATION", "ÉTUDES");
const FR_A_RANGES = getSampleCvText("fr")
  .replace("mars 2023 – aujourd'hui", "2022 à 2024")
  .replace("janvier 2020 – février 2023", "2019 à 2022")
  .replace("juin 2018 – décembre 2019", "2017 à 2019");
const FR_A_RANGES_ASCENDING = getSampleCvText("fr")
  .replace("mars 2023 – aujourd'hui", "2016 à 2018")
  .replace("janvier 2020 – février 2023", "2019 à 2021")
  .replace("juin 2018 – décembre 2019", "2022 à 2024");
const FR_PERSONAL = `${getSampleCvText("fr")}\nNationalité : française\nMarié, deux enfants\nÉtat civil : divorcé`;
const SV_ACCENT_HEADINGS = getSampleCvText("sv").replace("KOMPETENS", "FÄRDIGHETER");
const JD_SV_ACCENTS = "Örebro Ångström Åre Östersund Société designsystem tillgänglighet";
const ACCENT_VERBS = ["Déployé", "Géré", "Piloté", "Optimisé", "Réduit", "Formé", "Livré"];
let verbIndex = 0;
const FR_ACCENT_VERBS = getSampleCvText("fr")
  .split("\n")
  .map((l) => (l.startsWith("- ") ? `- ${ACCENT_VERBS[verbIndex++ % ACCENT_VERBS.length]} ${l.slice(2).split(" ").slice(1).join(" ")}` : l))
  .join("\n");

// A job description with far more distinct terms than the 30-term cap.
const LONG_JD_TERMS = Array.from({ length: 150 }, (_, i) => `zq${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}x`);
const LONG_JD = LONG_JD_TERMS.join(" ");
const LONG_JD_CV = `${getSampleCvText("en")}\n${LONG_JD_TERMS.slice(0, 90).join(" ")}`;

// 40 JD terms, 12 of them in the CV: score divides by min(40, 30), finding says "of 40".
const JD_40 = LONG_JD_TERMS.slice(0, 40).join(" ");
const JD_40_CV = `${getSampleCvText("en")}\n${LONG_JD_TERMS.slice(0, 12).join(" ")}`;

const cases: { name: string; locale: "en" | "sv" | "fr"; text: string; jdText?: string }[] = [
  { name: "sample-en", locale: "en", text: getSampleCvText("en") },
  { name: "sample-sv", locale: "sv", text: getSampleCvText("sv") },
  { name: "sample-fr", locale: "fr", text: getSampleCvText("fr") },
  { name: "sample-en-with-jd", locale: "en", text: getSampleCvText("en"), jdText: JD_EN },
  { name: "sample-sv-with-jd", locale: "sv", text: getSampleCvText("sv"), jdText: JD_SV },
  { name: "sample-fr-low-jd-match", locale: "fr", text: getSampleCvText("fr"), jdText: JD_FR_LOW },
  { name: "fr-etudes-heading", locale: "fr", text: FR_STUDIES_HEADING },
  { name: "fr-a-date-ranges", locale: "fr", text: FR_A_RANGES },
  { name: "fr-a-date-ranges-ascending", locale: "fr", text: FR_A_RANGES_ASCENDING },
  { name: "fr-personal-details", locale: "fr", text: FR_PERSONAL },
  { name: "fr-accent-final-verbs", locale: "fr", text: FR_ACCENT_VERBS },
  { name: "sv-accent-headings-jd", locale: "sv", text: SV_ACCENT_HEADINGS, jdText: JD_SV_ACCENTS },
  { name: "long-jd-over-cap", locale: "en", text: LONG_JD_CV, jdText: LONG_JD },
  { name: "jd-40-terms-12-matched", locale: "en", text: JD_40_CV, jdText: JD_40 },
  { name: "under-40-words", locale: "en", text: SHORT },
  { name: "weak-en", locale: "en", text: WEAK_EN },
  { name: "weak-en-as-sv", locale: "sv", text: WEAK_EN },
  { name: "messy-ats-en", locale: "en", text: MESSY },
  { name: "weak-bullets-en", locale: "en", text: WEAK_BULLETS },
  { name: "mixed-dates-en", locale: "en", text: MIXED_DATES },
  { name: "too-long-en", locale: "en", text: LONG },
  { name: "empty", locale: "fr", text: "" },
];

const out = {
  generatedFrom: { sha, files: ["lib/cv-check.ts", "lib/cv-check-types.ts", "lib/cv-check-samples.ts"] },
  cases: cases.map((c) => {
    const r = checkCv({ text: c.text, locale: c.locale, ...(c.jdText ? { jdText: c.jdText } : {}) });
    return {
      name: c.name,
      input: { text: c.text, locale: c.locale, ...(c.jdText ? { jdText: c.jdText } : {}) },
      expected: {
        score: r.score,
        categories: r.categories,
        findings: r.findings,
        matchedKeywords: r.matchedKeywords,
        missingKeywords: r.missingKeywords,
        wordCount: r.wordCount,
        estimatedPages: r.estimatedPages,
      },
    };
  }),
};

writeFileSync(
  new URL("../tests/fixtures/parity.json", import.meta.url),
  JSON.stringify(out, null, 2) + "\n",
);
console.log(`wrote ${out.cases.length} cases from ${sha}`);
for (const c of out.cases) console.log(c.name.padEnd(20), c.expected.score, c.expected.findings.map((f: any) => f.id).join(","));
