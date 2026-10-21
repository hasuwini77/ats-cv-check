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
| conventions | Swedish: flags a personnummer. French: flags personal details (birth date, nationality, marital status). English: a length note. SV and FR also get an informational photo note; photos can't be detected in text |
| keywords | Overlap with a job description |

Seven of them are scored on their own. Keyword matching only switches on when you pass a job description (`jdText`). Without one, the score is the weighted average of the other seven.

Keyword score is matched terms divided by the job description's term count, with the divisor capped at 30 so a long job description is not punished for its length. The finding reports the real total ("12 of 40 terms found"). `matchedKeywords` and `missingKeywords` are alphabetical and capped at 10 each.

Under 40 words you get a single "not enough text" finding and a score of 0.

Findings, fixes and category labels come in English, Swedish and French.

## Use it

Not on npm. Install straight from GitHub (builds on install):

```sh
npm i github:hasuwini77/ats-cv-check
```

Or clone it and run `npm ci && npm run build`.

```ts
import { checkCv, describeFinding, categoryLabel } from "ats-cv-check";

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

`docs/index.html` is a static page with no dependencies. Open it from disk or serve the folder:

```sh
python3 -m http.server 4100 --directory docs
```

Paste a CV (or hit "Use a sample"), switch between EN, SV and FR. The only requests are `index.html`, `style.css` and `checker.js`, and a Content-Security-Policy keeps it that way. `docs/checker.js` is the built bundle (source in `demo-src/`). It is committed so GitHub Pages can serve `docs/` as-is. `npm run build` regenerates it, and CI fails if it is out of date.

## Limits

- Plain text only. There is no PDF or DOCX parsing in this package.
- These are heuristics: headings, regexes and word lists. A real applicant tracking system may parse your file differently, and a score of 100 is not a promise of anything.
- Section, date and bullet detection is tuned for EN, SV and FR CVs.

## Hosted version

[nextcv.net/en/cv-check](https://nextcv.net/en/cv-check) runs the same engine and adds PDF and DOCX upload.

- Pasted text is scored in your browser and is not sent to the server.
- An uploaded file goes to the server only so it can extract the text. The server does that in memory, returns the text, and does not store the file or the text. It uses your IP address for rate limiting.
- The page sends three analytics events, with only these fields:
  - `cv_check_started`: how the text came in (paste, upload or sample)
  - `cv_check_scored`: score bucket (0-19, 20-39, ...), whether a job description was used, how the text came in, number of critical findings, number of warnings, language
  - `cv_check_cta_clicked`: score bucket, which button (top or bottom)
- Never the CV text, the job description or the file name. Standard pageviews are sent too. Until you accept the cookie banner, the analytics library keeps its state in memory only: no cookie, no localStorage.

This package sends nothing.

## Tests

```sh
npm test
```

The parity suite compares this package against the hosted engine on a fixed set of inputs: the EN, SV and FR samples, job-description matches (including one far over the keyword cap), a CV under 40 words, accented headings and date ranges, and a few broken CVs. The expected outputs live in `tests/fixtures/parity.json`, along with the commit they were generated from. CI only reads that file. To regenerate it you need the hosted app's source: `npx tsx scripts/generate-fixtures.ts <path-to-app>`.

## License

MIT, see [LICENSE](LICENSE).
