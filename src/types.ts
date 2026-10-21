// Types and constants for the CV checker.
// Finding ids double as the i18n key: locales/<lang>.json -> findings.<id>.{title,fix}

export type CvCheckLocale = "en" | "sv" | "fr";

export const CV_CHECK_CATEGORIES = [
  "structure",
  "contact",
  "dates",
  "length",
  "bullets",
  "ats",
  "keywords",
  "conventions",
] as const;

export type CvCheckCategory = (typeof CV_CHECK_CATEGORIES)[number];

export type CvCheckSeverity = "critical" | "warning" | "pass";

export const CV_CHECK_FINDING_IDS = [
  "not-enough-text",
  "missing-experience-section",
  "missing-education-section",
  "missing-skills-section",
  "sections-complete",
  "missing-email",
  "missing-phone",
  "missing-linkedin",
  "contact-complete",
  "inconsistent-date-formats",
  "missing-dates",
  "not-reverse-chronological",
  "dates-consistent",
  "too-short",
  "too-long",
  "length-good",
  "weak-bullet-verbs",
  "unquantified-bullets",
  "bullets-strong",
  "bullets-not-detected",
  "possible-table-layout",
  "special-characters",
  "ats-clean",
  "low-keyword-match",
  "moderate-keyword-match",
  "strong-keyword-match",
  "locale-photo-note",
  "locale-personal-details",
  "locale-length-note",
  "conventions-ok",
] as const;

export type CvCheckFindingId = (typeof CV_CHECK_FINDING_IDS)[number];

// Inputs shorter than this get the single "not-enough-text" critical finding
// and no further analysis.
export const MIN_SCOREABLE_WORDS = 40;

// Hard cap applied to CV and JD text before scoring.
export const MAX_INPUT_CHARS = 50_000;

export interface CvCheckInput {
  text: string;
  locale: CvCheckLocale;
  jdText?: string;
}

export interface CvCheckFinding {
  id: CvCheckFindingId;
  category: CvCheckCategory;
  severity: CvCheckSeverity;
  /** Interpolation values for the finding's i18n copy (counts, percentages). */
  params?: Record<string, string | number>;
}

export interface CvCheckCategoryScore {
  category: CvCheckCategory;
  /** 0-100 within the category. */
  score: number;
  /** Contribution to the total; "keywords" is 0 when no jdText was given. */
  weight: number;
}

export interface CvCheckResult {
  /** 0-100 weighted total. */
  score: number;
  categories: CvCheckCategoryScore[];
  /** Ordered critical → warning → pass. */
  findings: CvCheckFinding[];
  wordCount: number;
  estimatedPages: number;
  /** Empty when no jdText was given. */
  matchedKeywords: string[];
  missingKeywords: string[];
}

export type CvCheckScoreBucket =
  | "0-19"
  | "20-39"
  | "40-59"
  | "60-79"
  | "80-100";
