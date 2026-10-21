# ats-cv-check

A CV checker that scores plain text out of 100 and tells you what to fix. It is deterministic: no AI, no network, no randomness. The same text always gets the same score, and everything runs locally.

It checks eight categories:

| Category | What it looks at |
| --- | --- |
| structure | Experience, Education and Skills sections |
| contact | Email, phone, LinkedIn |
| dates | Consistent formats, reverse-chronological order |
| length | Too short, too long, estimated pages |
| bullets | Bullet detection, weak verbs, numbers |
| ats | Table-like layouts, odd characters |
| conventions | Regional norms (photo, personal details, length) for EN, SV, FR |
| keywords | Overlap with a job description |

Seven of them are scored on their own. Keyword matching only switches on when you pass a job description (`jdText`). Without one, the score is the weighted average of the other seven.

Under 40 words you get a single "not enough text" finding and a score of 0.

Findings, fixes and category labels come in English, Swedish and French.

## Use it

Not on npm. Clone it, then:

```sh
npm ci
npm run build
```

```ts
import { checkCv, describeFinding, categoryLabel } from "./dist/index.js";

const result = checkCv({
  text: cvText,          // plain text, you extract it from PDF/DOCX yourself
  locale: "sv",          // "en" | "sv" | "fr"
  jdText: jobAd,         // optional: turns on keyword matching
});

result.score;            // 0-100
result.categories;       // [{ category, score, weight }]
result.matchedKeywords;  // [] without jdText
result.missingKeywords;

for (const finding of result.findings) {
  // critical first, then warning, then pass
  const { title, fix } = describeFinding(finding, "sv");
  console.log(finding.severity, title, "-", fix);
}
```

Input over 50,000 characters is cut off before scoring.

## Demo

`demo/index.html` is a static page with no dependencies. Open it from disk or serve the folder:

```sh
python3 -m http.server 4100 --directory demo
```

Paste a CV (or hit "Use a sample"), switch between EN, SV and FR. The only requests are `index.html` and `checker.js`. `demo/checker.js` is the built bundle and is committed so GitHub Pages can serve the folder as-is. `npm run build` regenerates it, and CI fails if it is out of date.

## Limits

- Plain text only. There is no PDF or DOCX parsing in this package.
- These are heuristics: headings, regexes and word lists. A real applicant tracking system may parse your file differently, and a score of 100 is not a promise of anything.
- Section, date and bullet detection is tuned for EN, SV and FR CVs.

## Hosted version

[nextcv.net/en/cv-check](https://nextcv.net/en/cv-check) runs the same engine and adds file upload. It sends one bucketed analytics event per check: score bucket, whether a job description was used, how the text came in, critical and warning counts, and the locale. Never the CV text. This package sends nothing.

## Tests

```sh
npm test
```

74 tests. The parity suite compares this package against the hosted engine on 14 inputs (the EN, SV and FR samples, job-description matches, a CV under 40 words, and a handful of broken ones). The expected outputs live in `tests/fixtures/parity.json`, along with the commit they were generated from. CI only reads that file. To regenerate it you need the hosted app's source: `npx tsx scripts/generate-fixtures.ts <path-to-app>`.

## License

MIT, see [LICENSE](LICENSE).
