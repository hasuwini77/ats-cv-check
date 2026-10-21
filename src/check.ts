// Pure, deterministic CV scoring engine. No IO, no Date.now, no Math.random:
// the same input always yields the same output. Only imports ./types.js.

import {
  CV_CHECK_CATEGORIES,
  MAX_INPUT_CHARS,
  MIN_SCOREABLE_WORDS,
  type CvCheckCategory,
  type CvCheckCategoryScore,
  type CvCheckFinding,
  type CvCheckFindingId,
  type CvCheckInput,
  type CvCheckLocale,
  type CvCheckResult,
  type CvCheckScoreBucket,
  type CvCheckSeverity,
} from "./types.js";

/* ────────────────────────────────────────────────────────────────────── */
/*  Weights                                                                */
/* ────────────────────────────────────────────────────────────────────── */

const CATEGORY_WEIGHTS: Record<Exclude<CvCheckCategory, "keywords">, number> = {
  structure: 20,
  contact: 15,
  dates: 15,
  length: 10,
  bullets: 15,
  ats: 10,
  conventions: 10,
};
const KEYWORDS_WEIGHT = 15;

/* ────────────────────────────────────────────────────────────────────── */
/*  Small pure helpers                                                     */
/* ────────────────────────────────────────────────────────────────────── */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

const WORDS_PER_PAGE = 450;
const MAX_ESTIMATED_PAGES = 10;

function computeEstimatedPages(wordCount: number): number {
  if (wordCount === 0) return 0;
  return Math.min(Math.ceil(wordCount / WORDS_PER_PAGE), MAX_ESTIMATED_PAGES);
}

function extractYear(token: string): number {
  const match = token.match(/(?:19|20)\d{2}/);
  return match ? parseInt(match[0], 10) : 0;
}

function buildAlternation(words: string[]): string {
  return [...new Set(words)].sort((a, b) => b.length - a.length).join("|");
}

// JS `\b` only knows ASCII word characters, so it misfires next to accented
// letters ("Études", "Nationalité"). These Unicode-aware boundaries replace it
// wherever a pattern starts or ends with a letter that may carry an accent.
// Use them in regexes compiled with the `u` flag.
const WORD_START = "(?<![\\p{L}\\p{N}_])";
const WORD_END = "(?![\\p{L}\\p{N}_])";

const SEVERITY_RANK: Record<CvCheckSeverity, number> = {
  critical: 0,
  warning: 1,
  pass: 2,
};

function sortFindings(findings: CvCheckFinding[]): CvCheckFinding[] {
  return [...findings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Structure (weight 20)                                                  */
/* ────────────────────────────────────────────────────────────────────── */

const EXPERIENCE_HEADING_RE = new RegExp(
  `${WORD_START}(work\\s+experience|professional\\s+experience|employment\\s+history|work\\s+history|experience|arbetslivserfarenhet|yrkeserfarenhet|erfarenhet|expérience\\s+professionnelle|parcours\\s+professionnel|expérience)${WORD_END}`,
  "iu",
);
const EDUCATION_HEADING_RE = new RegExp(
  `${WORD_START}(education|academic\\s+background|utbildning|akademisk\\s+bakgrund|formation|études|diplômes?)${WORD_END}`,
  "iu",
);
const SKILLS_HEADING_RE = new RegExp(
  `${WORD_START}(technical\\s+skills|core\\s+competencies|skills|competencies|kompetenser|kompetens|färdigheter|compétences)${WORD_END}`,
  "iu",
);
const STRUCTURE_SECTION_COUNT = 3;

interface StructureAnalysis {
  score: number;
  findings: CvCheckFinding[];
  hasExperience: boolean;
}

function analyzeStructure(text: string): StructureAnalysis {
  const hasExperience = EXPERIENCE_HEADING_RE.test(text);
  const hasEducation = EDUCATION_HEADING_RE.test(text);
  const hasSkills = SKILLS_HEADING_RE.test(text);

  const findings: CvCheckFinding[] = [];
  if (!hasExperience) {
    findings.push({ id: "missing-experience-section", category: "structure", severity: "critical" });
  }
  if (!hasEducation) {
    findings.push({ id: "missing-education-section", category: "structure", severity: "critical" });
  }
  if (!hasSkills) {
    findings.push({ id: "missing-skills-section", category: "structure", severity: "critical" });
  }
  if (findings.length === 0) {
    findings.push({ id: "sections-complete", category: "structure", severity: "pass" });
  }

  const foundCount = [hasExperience, hasEducation, hasSkills].filter(Boolean).length;
  const score = Math.round((foundCount / STRUCTURE_SECTION_COUNT) * 100);

  return { score, findings, hasExperience };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Contact (weight 15)                                                    */
/* ────────────────────────────────────────────────────────────────────── */

const EMAIL_RE = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/;
const PHONE_CANDIDATE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,6}\d{2,4}/g;
const PHONE_MIN_DIGITS = 7;
const LINKEDIN_URL_RE = /linkedin\.com\/(?:in|pub)\/[a-zA-Z0-9\-_%]+/i;
const LINKEDIN_HANDLE_RE = /\blinkedin\b\s*[:\-]?\s*\S+/i;

const CONTACT_EMAIL_WEIGHT = 50;
const CONTACT_PHONE_WEIGHT = 30;
const CONTACT_LINKEDIN_WEIGHT = 20;

function hasPhoneNumber(text: string): boolean {
  const matches = text.match(PHONE_CANDIDATE_RE) || [];
  return matches.some((m) => (m.match(/\d/g) || []).length >= PHONE_MIN_DIGITS);
}

interface ContactAnalysis {
  score: number;
  findings: CvCheckFinding[];
}

function analyzeContact(text: string): ContactAnalysis {
  const hasEmail = EMAIL_RE.test(text);
  const hasPhone = hasPhoneNumber(text);
  const hasLinkedin = LINKEDIN_URL_RE.test(text) || LINKEDIN_HANDLE_RE.test(text);

  const findings: CvCheckFinding[] = [];
  if (!hasEmail) findings.push({ id: "missing-email", category: "contact", severity: "critical" });
  if (!hasPhone) findings.push({ id: "missing-phone", category: "contact", severity: "critical" });
  if (!hasLinkedin) findings.push({ id: "missing-linkedin", category: "contact", severity: "warning" });
  if (findings.length === 0) {
    findings.push({ id: "contact-complete", category: "contact", severity: "pass" });
  }

  const score =
    (hasEmail ? CONTACT_EMAIL_WEIGHT : 0) +
    (hasPhone ? CONTACT_PHONE_WEIGHT : 0) +
    (hasLinkedin ? CONTACT_LINKEDIN_WEIGHT : 0);

  return { score, findings };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Dates (weight 15)                                                       */
/* ────────────────────────────────────────────────────────────────────── */

const MONTH_NAMES_RAW = [
  // EN
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
  // SV
  "januari", "februari", "mars", "maj", "juni", "juli", "augusti", "oktober",
  // FR
  "janvier", "février", "fevrier", "avril", "mai", "juin", "juillet", "août", "aout",
  "septembre", "octobre", "novembre", "décembre", "decembre",
];
const MONTH_FRAGMENT = buildAlternation(MONTH_NAMES_RAW);

const PRESENT_FRAGMENT =
  "present|now|currently|current|ongoing|nu|p[aå]g[aå]ende|aujourd'hui|pr[ée]sent(?:e)?|actuel(?:le)?|[aà]\\s*ce\\s*jour";
const DATE_SEPARATOR_FRAGMENT = `(?:[-–—]|${WORD_START}(?:to|till|à)${WORD_END})`;

const ISO_MONTH_TOKEN = "(?:19|20)\\d{2}-(?:0[1-9]|1[0-2])";
const MONTH_NAME_TOKEN = `(?:${MONTH_FRAGMENT})\\.?\\s+(?:19|20)\\d{2}`;
const YEAR_TOKEN = "(?:19|20)\\d{2}";

const ANY_DATE_TOKEN_RE = new RegExp(`\\b(?:${ISO_MONTH_TOKEN}|${MONTH_NAME_TOKEN}|${YEAR_TOKEN})\\b`, "i");

const ISO_RANGE_RE = new RegExp(
  `(${ISO_MONTH_TOKEN})\\s*${DATE_SEPARATOR_FRAGMENT}\\s*(${ISO_MONTH_TOKEN}|${PRESENT_FRAGMENT})`,
  "giu",
);
const MONTH_RANGE_RE = new RegExp(
  `(${MONTH_NAME_TOKEN})\\s*${DATE_SEPARATOR_FRAGMENT}\\s*(${MONTH_NAME_TOKEN}|${PRESENT_FRAGMENT})`,
  "giu",
);
// Negative lookbehind excludes years that are actually the tail of a
// "Month YYYY" token (e.g. the "2023" in "March 2023 – Present") so that
// single range doesn't get double-counted as both a "month" and a "year"
// style and falsely trip inconsistent-date-formats.
const YEAR_RANGE_RE = new RegExp(
  `(?<!(?:${MONTH_FRAGMENT})\\.?\\s)\\b(${YEAR_TOKEN})\\s*${DATE_SEPARATOR_FRAGMENT}\\s*(${YEAR_TOKEN}|${PRESENT_FRAGMENT})\\b`,
  "giu",
);

const DATES_BASE_SCORE = 100;
const DATES_INCONSISTENT_PENALTY = 40;
const DATES_MISSING_PENALTY = 50;
const DATES_ORDER_PENALTY = 30;

type DateRangeType = "iso" | "month" | "year";

interface DateRange {
  index: number;
  type: DateRangeType;
  startYear: number;
}

function collectRanges(text: string): DateRange[] {
  const results: DateRange[] = [];
  for (const m of text.matchAll(ISO_RANGE_RE)) {
    results.push({ index: m.index ?? 0, type: "iso", startYear: extractYear(m[1]) });
  }
  for (const m of text.matchAll(MONTH_RANGE_RE)) {
    results.push({ index: m.index ?? 0, type: "month", startYear: extractYear(m[1]) });
  }
  for (const m of text.matchAll(YEAR_RANGE_RE)) {
    results.push({ index: m.index ?? 0, type: "year", startYear: extractYear(m[1]) });
  }
  results.sort((a, b) => a.index - b.index);
  return results;
}

interface DatesAnalysis {
  score: number;
  findings: CvCheckFinding[];
}

// Locates the line index of a section heading, scanning only lines short
// enough to plausibly BE a heading (not a sentence that happens to contain
// a heading word, e.g. "6 years of experience" inside a summary paragraph).
const HEADING_LINE_MAX_CHARS = 60;

function findHeadingLineIndex(lines: string[], re: RegExp, fromLine = 0): number {
  for (let i = fromLine; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0 || trimmed.length > HEADING_LINE_MAX_CHARS) continue;
    if (re.test(trimmed)) return i;
  }
  return -1;
}

// Scopes date-format/order checks to the work-experience section only.
// Education entries conventionally use bare years ("2014 - 2018") while
// experience entries use full month-year ("March 2023 – Present") — that's
// not an inconsistency, it's standard resume convention, so mixing the two
// across sections must never trip "inconsistent-date-formats". Falls back
// to the whole text when no clean heading line is found.
function extractExperienceSectionText(text: string): string {
  const lines = text.split(/\r?\n/);
  const startIdx = findHeadingLineIndex(lines, EXPERIENCE_HEADING_RE);
  if (startIdx === -1) return text;

  const eduIdx = findHeadingLineIndex(lines, EDUCATION_HEADING_RE, startIdx + 1);
  const skillsIdx = findHeadingLineIndex(lines, SKILLS_HEADING_RE, startIdx + 1);
  const boundaries = [eduIdx, skillsIdx].filter((i) => i !== -1);
  const endIdx = boundaries.length > 0 ? Math.min(...boundaries) : lines.length;

  return lines.slice(startIdx, endIdx).join("\n");
}

function analyzeDates(text: string, hasExperienceSection: boolean): DatesAnalysis {
  const experienceText = extractExperienceSectionText(text);
  const ranges = collectRanges(experienceText);
  const styleSet = new Set(ranges.map((r) => r.type));
  const hasAnyDateToken = ANY_DATE_TOKEN_RE.test(experienceText);

  const findings: CvCheckFinding[] = [];
  let score = DATES_BASE_SCORE;

  if (styleSet.size >= 2) {
    findings.push({
      id: "inconsistent-date-formats",
      category: "dates",
      severity: "warning",
      params: { styleCount: styleSet.size },
    });
    score -= DATES_INCONSISTENT_PENALTY;
  }

  if (!hasAnyDateToken && hasExperienceSection) {
    findings.push({ id: "missing-dates", category: "dates", severity: "warning" });
    score -= DATES_MISSING_PENALTY;
  }

  if (ranges.length >= 2) {
    const years = ranges.map((r) => r.startYear);
    const nonDecreasing = years.every((y, i) => i === 0 || y >= years[i - 1]);
    const hasIncrease = years[years.length - 1] > years[0];
    if (nonDecreasing && hasIncrease) {
      findings.push({ id: "not-reverse-chronological", category: "dates", severity: "warning" });
      score -= DATES_ORDER_PENALTY;
    }
  }

  if (findings.length === 0) {
    findings.push({ id: "dates-consistent", category: "dates", severity: "pass" });
  }

  return { score: clamp(score, 0, 100), findings };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Length (weight 10)                                                     */
/* ────────────────────────────────────────────────────────────────────── */

// A genuinely complete one-page CV (concise bullets, typical PM/eng resume
// density) commonly lands in the 150-250 word range — 250 was flagging
// real, complete one-pagers as "too short". 180 still catches near-empty
// drafts without penalizing normal concise formatting.
const TOO_SHORT_WORD_THRESHOLD = 180;
const TOO_LONG_WORD_THRESHOLD = 1100;
// Rough words-per-page for a typical CV layout; only used for user-facing copy
const APPROX_WORDS_PER_CV_PAGE = 550;
const LENGTH_SHORT_SCORE_CAP = 59;
const LENGTH_LONG_SCORE = 65;

interface LengthAnalysis {
  score: number;
  findings: CvCheckFinding[];
}

function analyzeLength(wordCount: number): LengthAnalysis {
  if (wordCount < TOO_SHORT_WORD_THRESHOLD) {
    const score = clamp(Math.round((wordCount / TOO_SHORT_WORD_THRESHOLD) * LENGTH_SHORT_SCORE_CAP), 0, LENGTH_SHORT_SCORE_CAP);
    return {
      score,
      findings: [{ id: "too-short", category: "length", severity: "warning", params: { wordCount } }],
    };
  }
  if (wordCount > TOO_LONG_WORD_THRESHOLD) {
    return {
      score: LENGTH_LONG_SCORE,
      findings: [
        {
          id: "too-long",
          category: "length",
          severity: "warning",
          params: { wordCount, pages: Math.round(wordCount / APPROX_WORDS_PER_CV_PAGE) },
        },
      ],
    };
  }
  return {
    score: 100,
    findings: [{ id: "length-good", category: "length", severity: "pass", params: { wordCount } }],
  };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Bullets (weight 15)                                                     */
/* ────────────────────────────────────────────────────────────────────── */

const BULLET_LINE_RE = /^[ \t]*(?:[-•*]|\d+[.)])[ \t]+(.+)$/;

// PDF text extraction frequently drops the bullet glyph itself (•, -, *)
// while preserving line breaks, leaving each former bullet as its own bare
// line. BULLET_LINE_RE alone then sees zero bullets on the upload path for
// a CV that scores perfectly via paste (where the glyph survives). This
// generic (non-global) date-range matcher lets us recognize a "date range"
// line — the anchor a bullet run reliably follows in a job/education entry
// — without depending on any bullet marker at all.
const DATE_RANGE_LINE_RE = new RegExp(
  `(?:${ISO_MONTH_TOKEN}|${MONTH_NAME_TOKEN}|${YEAR_TOKEN})\\s*${DATE_SEPARATOR_FRAGMENT}\\s*(?:${ISO_MONTH_TOKEN}|${MONTH_NAME_TOKEN}|${YEAR_TOKEN}|${PRESENT_FRAGMENT})`,
  "iu",
);

function isDateRangeLine(line: string): boolean {
  const match = line.match(DATE_RANGE_LINE_RE);
  if (!match || match.index === undefined) return false;
  const remainder = (line.slice(0, match.index) + line.slice(match.index + match[0].length)).trim();
  // "Mostly" a date range line — tolerate a trailing location or separator
  // glyph, but not a real sentence sharing the line with a date.
  return remainder.length <= 20;
}

// A short, mostly-uppercase line is almost always a section heading rather
// than bullet content (bare "experience"/"skills" word matches inside a
// prose sentence are excluded by the length cap below).
const GENERIC_HEADING_LINE_RE = /^[A-ZÀ-Ö][A-ZÀ-Ö\s&/'-]{1,40}$/;

function isHeadingLine(line: string): boolean {
  if (line.length > HEADING_LINE_MAX_CHARS) return false;
  return (
    EXPERIENCE_HEADING_RE.test(line) ||
    EDUCATION_HEADING_RE.test(line) ||
    SKILLS_HEADING_RE.test(line) ||
    GENERIC_HEADING_LINE_RE.test(line)
  );
}

// "Senior Product Designer — Kestrel Logistics" style job/education header:
// a dash-separated line with no sentence-ending punctuation. These sit
// between date-range lines (of the PRECEDING and following entries) and
// must never be swept up as bullet content.
const TITLE_COMPANY_LINE_RE = /^[^.!?]*\s[-–—]\s[^.!?]*$/;
const MIN_IMPLICIT_BULLET_WORDS = 3;

function looksLikeSentenceFragment(line: string): boolean {
  if (EMAIL_RE.test(line) || LINKEDIN_URL_RE.test(line) || LINKEDIN_HANDLE_RE.test(line)) return false;
  if (isHeadingLine(line) || TITLE_COMPANY_LINE_RE.test(line)) return false;
  const wordCount = line.split(/\s+/).filter(Boolean).length;
  return wordCount >= MIN_IMPLICIT_BULLET_WORDS;
}

// Detects bullet/list content structurally instead of relying on a marker
// glyph surviving extraction. Falls back to an "implicit bullet" heuristic
// — sentence-fragment lines that directly follow a date-range line, ending
// at a blank line, the next date range, or a heading — only when no
// explicit marker is found anywhere, so a CV that never had bullets at all
// (see the zero-denominator guard in analyzeBullets) is left alone.
function detectBulletTexts(text: string): string[] {
  const lines = text.split(/\r?\n/);

  const explicit: string[] = [];
  for (const line of lines) {
    const m = BULLET_LINE_RE.exec(line);
    if (m) explicit.push(m[1].trim());
  }
  if (explicit.length > 0) return explicit;

  const implicit: string[] = [];
  let inListRun = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      inListRun = false;
      continue;
    }
    if (isDateRangeLine(trimmed)) {
      inListRun = true;
      continue;
    }
    if (isHeadingLine(trimmed) || TITLE_COMPANY_LINE_RE.test(trimmed)) {
      inListRun = false;
      continue;
    }
    if (inListRun && looksLikeSentenceFragment(trimmed)) {
      implicit.push(trimmed);
    } else {
      inListRun = false;
    }
  }
  return implicit;
}

const ACTION_VERBS_EN = [
  "built", "led", "managed", "developed", "designed", "implemented", "created", "improved",
  "increased", "reduced", "launched", "delivered", "drove", "achieved", "optimized",
  "established", "coordinated", "analyzed", "executed", "spearheaded", "streamlined",
  "negotiated", "mentored", "architected", "automated", "migrated", "scaled", "shipped",
  "owned", "redesigned", "introduced", "ran", "wrote", "authored", "partnered",
  "collaborated", "presented", "trained", "hired", "onboarded", "resolved", "debugged",
  "deployed", "maintained", "grew", "cut", "saved", "generated", "planned", "directed",
];
const ACTION_VERBS_SV = [
  "designade", "byggde", "ledde", "utvecklade", "implementerade", "skapade", "förbättrade",
  "ökade", "minskade", "lanserade", "levererade", "drev", "uppnådde", "optimerade",
  "etablerade", "samordnade", "analyserade", "genomförde", "ansvarade", "hanterade",
  "införde", "ägde", "samarbetade", "utbildade", "löste", "distribuerade", "underhöll",
  "skrev", "rekryterade", "omdesignade",
];
const ACTION_VERBS_FR = [
  "conçu", "construit", "dirigé", "développé", "mis", "créé", "amélioré", "augmenté",
  "réduit", "lancé", "livré", "piloté", "atteint", "optimisé", "établi", "coordonné",
  "analysé", "exécuté", "géré", "animé", "collaboré", "formé", "résolu", "déployé",
  "maintenu", "écrit", "recruté", "négocié", "refondu", "automatisé",
];
const ACTION_VERB_ALTERNATION = buildAlternation([...ACTION_VERBS_EN, ...ACTION_VERBS_SV, ...ACTION_VERBS_FR]);
const ACTION_VERB_START_RE = new RegExp(`^(?:${ACTION_VERB_ALTERNATION})${WORD_END}`, "iu");

const WEAK_VERB_RATIO_THRESHOLD = 0.4;
const QUANTIFIED_MIN_RATIO = 0.25;
const BULLETS_WARNING_PENALTY = 35;

interface BulletsAnalysis {
  score: number;
  findings: CvCheckFinding[];
}

function analyzeBullets(text: string): BulletsAnalysis {
  const bulletTexts = detectBulletTexts(text);
  const total = bulletTexts.length;

  if (total === 0) {
    // Zero-denominator guard: with no bullets to measure, verbRatio and
    // quantifiedRatio are both undefined, not "0%". Reporting "0% of your
    // bullets are weak" / "0% lack numbers" would present the ABSENCE of
    // data as if it were a measured (good) result — exactly backwards.
    // Suppress both percentage findings and surface one neutral warning.
    return {
      score: clamp(100 - BULLETS_WARNING_PENALTY, 0, 100),
      findings: [{ id: "bullets-not-detected", category: "bullets", severity: "warning" }],
    };
  }

  const verbCount = bulletTexts.filter((b) => ACTION_VERB_START_RE.test(b)).length;
  const quantifiedCount = bulletTexts.filter((b) => /\d/.test(b)).length;
  const verbRatio = verbCount / total;
  const quantifiedRatio = quantifiedCount / total;

  const findings: CvCheckFinding[] = [];
  let score = 100;

  if (verbRatio < WEAK_VERB_RATIO_THRESHOLD) {
    findings.push({
      id: "weak-bullet-verbs",
      category: "bullets",
      severity: "warning",
      params: { percent: Math.round(verbRatio * 100) },
    });
    score -= BULLETS_WARNING_PENALTY;
  }
  if (quantifiedRatio < QUANTIFIED_MIN_RATIO) {
    findings.push({
      id: "unquantified-bullets",
      category: "bullets",
      severity: "warning",
      params: { percent: Math.round(quantifiedRatio * 100) },
    });
    score -= BULLETS_WARNING_PENALTY;
  }
  if (findings.length === 0) {
    findings.push({ id: "bullets-strong", category: "bullets", severity: "pass" });
  }

  return { score: clamp(score, 0, 100), findings };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  ATS (weight 10, warnings only)                                          */
/* ────────────────────────────────────────────────────────────────────── */

const TABLE_LAYOUT_LINE_RE = /( {3,}|\t)/;
const TABLE_LAYOUT_LINE_THRESHOLD = 3;
const SPECIAL_CHAR_RATIO_THRESHOLD = 0.03;
// Letters (incl. Latin-1 accented ranges — åäö, éèê, ç, ñ, ü…), digits, whitespace
// and everyday punctuation are all "normal"; everything else counts as special.
const ALLOWED_CHAR_RE = /[a-zA-Z0-9À-ÖØ-öø-ÿ\s.,;:!?()'"\-–—/@+%&*]/g;
const ATS_WARNING_PENALTY = 50;

interface AtsAnalysis {
  score: number;
  findings: CvCheckFinding[];
}

function analyzeAts(text: string): AtsAnalysis {
  const lines = text.split(/\r?\n/);
  const tableLikeLines = lines.filter((l) => TABLE_LAYOUT_LINE_RE.test(l)).length;
  const allowedCount = (text.match(ALLOWED_CHAR_RE) || []).length;
  const specialRatio = text.length > 0 ? (text.length - allowedCount) / text.length : 0;

  const findings: CvCheckFinding[] = [];
  let score = 100;

  if (tableLikeLines >= TABLE_LAYOUT_LINE_THRESHOLD) {
    findings.push({
      id: "possible-table-layout",
      category: "ats",
      severity: "warning",
      params: { lineCount: tableLikeLines },
    });
    score -= ATS_WARNING_PENALTY;
  }
  if (specialRatio > SPECIAL_CHAR_RATIO_THRESHOLD) {
    findings.push({
      id: "special-characters",
      category: "ats",
      severity: "warning",
      params: { percentage: Math.round(specialRatio * 100) },
    });
    score -= ATS_WARNING_PENALTY;
  }
  if (findings.length === 0) {
    findings.push({ id: "ats-clean", category: "ats", severity: "pass" });
  }

  return { score: clamp(score, 0, 100), findings };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Keywords (weight 15 with JD, else 0)                                    */
/* ────────────────────────────────────────────────────────────────────── */

const STOPWORDS_EN = new Set([
  "the", "and", "for", "with", "that", "this", "from", "are", "was", "were", "have", "has",
  "will", "your", "you", "our", "we", "of", "to", "in", "on", "at", "is", "as", "by", "an",
  "a", "or", "be", "it", "its", "their", "they", "not", "but", "can", "all", "any", "who",
  "what", "when", "where", "how", "into", "than", "then", "also", "more", "most", "such",
  "these", "those", "been", "being",
]);
const STOPWORDS_SV = new Set([
  "och", "för", "med", "det", "den", "att", "som", "är", "var", "har", "ska", "din", "vår",
  "vi", "av", "till", "i", "på", "en", "ett", "de", "du", "jag", "han", "hon", "men",
  "eller", "inte", "kan", "alla", "vem", "vad", "när", "hur", "också", "mer", "mest",
  "dessa",
]);
const STOPWORDS_FR = new Set([
  "et", "pour", "avec", "que", "qui", "est", "sont", "était", "avoir", "votre", "notre",
  "nous", "de", "à", "en", "dans", "sur", "un", "une", "le", "la", "les", "des", "du", "au",
  "aux", "ce", "cette", "mais", "ou", "pas", "peut", "tous", "toutes", "quoi", "quand",
  "où", "comment", "aussi", "plus", "ces",
]);
const STOPWORDS_BY_LOCALE: Record<CvCheckLocale, Set<string>> = {
  en: STOPWORDS_EN,
  sv: STOPWORDS_SV,
  fr: STOPWORDS_FR,
};

const TOKEN_RE = /[a-zà-öø-ÿ0-9+#.]+/gi;
const CAPITALIZED_WORD_RE = /(?<![\p{L}\p{N}_])\p{Lu}[\p{Ll}\p{N}+#.]{2,}(?![\p{L}\p{N}_])/gu;
const MIN_TOKEN_LENGTH = 3;
const KEYWORD_MATCH_DENOMINATOR_CAP = 30;
const LOW_KEYWORD_THRESHOLD = 0.3;
const MODERATE_KEYWORD_THRESHOLD = 0.6;
const KEYWORD_TOP_N = 10;

// Strip a stray leading/trailing "." picked up when a token sits at a
// sentence boundary (TOKEN_RE keeps "." mid-token so "Node.js" stays whole).
function trimEdgeDots(token: string): string {
  return token.replace(/^\.+|\.+$/g, "");
}

function tokenize(text: string): string[] {
  return (text.match(TOKEN_RE) || [])
    .map((t) => trimEdgeDots(t.toLowerCase()))
    .filter((t) => t.length >= MIN_TOKEN_LENGTH);
}

function extractKeywordSet(text: string, locale: CvCheckLocale): Set<string> {
  const stop = STOPWORDS_BY_LOCALE[locale];
  const tokens = tokenize(text).filter((t) => !stop.has(t));
  const caps = (text.match(CAPITALIZED_WORD_RE) || [])
    .map((w) => trimEdgeDots(w.toLowerCase()))
    .filter((t) => t.length >= MIN_TOKEN_LENGTH && !stop.has(t));
  return new Set([...tokens, ...caps]);
}

interface KeywordsAnalysis {
  score: number;
  weight: number;
  findings: CvCheckFinding[];
  matched: string[];
  missing: string[];
}

function analyzeKeywords(cvText: string, jdText: string, locale: CvCheckLocale, hasJd: boolean): KeywordsAnalysis {
  if (!hasJd) {
    return { score: 0, weight: 0, findings: [], matched: [], missing: [] };
  }

  const jdSet = extractKeywordSet(jdText, locale);
  if (jdSet.size === 0) {
    return { score: 0, weight: 0, findings: [], matched: [], missing: [] };
  }

  const cvSet = extractKeywordSet(cvText, locale);
  // Matched, missing and the denominator all come from the same capped,
  // alphabetical slice of the JD terms, so matched can never exceed total.
  const jdKeywords = [...jdSet].sort().slice(0, KEYWORD_MATCH_DENOMINATOR_CAP);
  const matched = jdKeywords.filter((k) => cvSet.has(k));
  const missing = jdKeywords.filter((k) => !cvSet.has(k));

  const denominator = jdKeywords.length;
  const overlap = denominator > 0 ? matched.length / denominator : 0;
  const score = Math.round(overlap * 100);

  let id: CvCheckFindingId;
  let severity: CvCheckSeverity = "warning";
  if (overlap < LOW_KEYWORD_THRESHOLD) {
    id = "low-keyword-match";
  } else if (overlap <= MODERATE_KEYWORD_THRESHOLD) {
    id = "moderate-keyword-match";
  } else {
    id = "strong-keyword-match";
    severity = "pass";
  }

  const findings: CvCheckFinding[] = [
    { id, category: "keywords", severity, params: { matched: matched.length, total: denominator } },
  ];

  return {
    score,
    weight: KEYWORDS_WEIGHT,
    findings,
    matched: matched.slice(0, KEYWORD_TOP_N),
    missing: missing.slice(0, KEYWORD_TOP_N),
  };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Conventions (weight 10)                                                 */
/* ────────────────────────────────────────────────────────────────────── */

const PERSONNUMMER_RE = /\b\d{6}(?:\d{2})?[-+]\d{4}\b/;
const FR_PERSONAL_DETAILS_RE = new RegExp(
  `${WORD_START}(né(?:e)?\\s+le|date de naissance|nationalité|situation familiale|marié(?:e)?|célibataire|état civil)${WORD_END}`,
  "iu",
);
const CONVENTIONS_WARNING_PENALTY = 30;

interface ConventionsAnalysis {
  score: number;
  findings: CvCheckFinding[];
}

function analyzeConventions(text: string, locale: CvCheckLocale): ConventionsAnalysis {
  const findings: CvCheckFinding[] = [];
  let score = 100;

  if (locale === "sv") {
    findings.push({ id: "locale-photo-note", category: "conventions", severity: "pass" });
    if (PERSONNUMMER_RE.test(text)) {
      findings.push({ id: "locale-personal-details", category: "conventions", severity: "warning" });
      score -= CONVENTIONS_WARNING_PENALTY;
    }
  } else if (locale === "fr") {
    findings.push({ id: "locale-photo-note", category: "conventions", severity: "pass" });
    if (FR_PERSONAL_DETAILS_RE.test(text)) {
      findings.push({ id: "locale-personal-details", category: "conventions", severity: "warning" });
      score -= CONVENTIONS_WARNING_PENALTY;
    }
  } else {
    findings.push({ id: "locale-length-note", category: "conventions", severity: "pass" });
  }

  if (findings.length === 0) {
    findings.push({ id: "conventions-ok", category: "conventions", severity: "pass" });
  }

  return { score: clamp(score, 0, 100), findings };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Public API                                                              */
/* ────────────────────────────────────────────────────────────────────── */

export function checkCv(input: CvCheckInput): CvCheckResult {
  const locale = input.locale;
  const text = (input.text ?? "").slice(0, MAX_INPUT_CHARS);
  const jdTextRaw = (input.jdText ?? "").slice(0, MAX_INPUT_CHARS);
  const hasJd = jdTextRaw.trim().length > 0;

  const wordCount = countWords(text);
  const estimatedPages = computeEstimatedPages(wordCount);

  if (wordCount < MIN_SCOREABLE_WORDS) {
    const categories: CvCheckCategoryScore[] = CV_CHECK_CATEGORIES.map((category) => ({
      category,
      score: 0,
      weight: category === "keywords" ? (hasJd ? KEYWORDS_WEIGHT : 0) : CATEGORY_WEIGHTS[category],
    }));
    return {
      score: 0,
      categories,
      findings: [
        {
          id: "not-enough-text",
          category: "length",
          severity: "critical",
          params: { wordCount, minWords: MIN_SCOREABLE_WORDS },
        },
      ],
      wordCount,
      estimatedPages,
      matchedKeywords: [],
      missingKeywords: [],
    };
  }

  const structure = analyzeStructure(text);
  const contact = analyzeContact(text);
  const dates = analyzeDates(text, structure.hasExperience);
  const length = analyzeLength(wordCount);
  const bullets = analyzeBullets(text);
  const ats = analyzeAts(text);
  const keywords = analyzeKeywords(text, jdTextRaw, locale, hasJd);
  const conventions = analyzeConventions(text, locale);

  const categories: CvCheckCategoryScore[] = [
    { category: "structure", score: structure.score, weight: CATEGORY_WEIGHTS.structure },
    { category: "contact", score: contact.score, weight: CATEGORY_WEIGHTS.contact },
    { category: "dates", score: dates.score, weight: CATEGORY_WEIGHTS.dates },
    { category: "length", score: length.score, weight: CATEGORY_WEIGHTS.length },
    { category: "bullets", score: bullets.score, weight: CATEGORY_WEIGHTS.bullets },
    { category: "ats", score: ats.score, weight: CATEGORY_WEIGHTS.ats },
    { category: "keywords", score: keywords.score, weight: keywords.weight },
    { category: "conventions", score: conventions.score, weight: CATEGORY_WEIGHTS.conventions },
  ];

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = categories.reduce((sum, c) => sum + c.score * c.weight, 0);
  const score = totalWeight > 0 ? clamp(Math.round(weightedSum / totalWeight), 0, 100) : 0;

  const findings = sortFindings([
    ...structure.findings,
    ...contact.findings,
    ...dates.findings,
    ...length.findings,
    ...bullets.findings,
    ...ats.findings,
    ...keywords.findings,
    ...conventions.findings,
  ]);

  return {
    score,
    categories,
    findings,
    wordCount,
    estimatedPages,
    matchedKeywords: keywords.matched,
    missingKeywords: keywords.missing,
  };
}

export function scoreBucketOf(score: number): CvCheckScoreBucket {
  if (score < 20) return "0-19";
  if (score < 40) return "20-39";
  if (score < 60) return "40-59";
  if (score < 80) return "60-79";
  return "80-100";
}
