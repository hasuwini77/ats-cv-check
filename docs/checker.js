"use strict";
(() => {
  // src/types.ts
  var CV_CHECK_CATEGORIES = [
    "structure",
    "contact",
    "dates",
    "length",
    "bullets",
    "ats",
    "keywords",
    "conventions"
  ];
  var MIN_SCOREABLE_WORDS = 40;
  var MAX_INPUT_CHARS = 5e4;

  // src/check.ts
  var CATEGORY_WEIGHTS = {
    structure: 20,
    contact: 15,
    dates: 15,
    length: 10,
    bullets: 15,
    ats: 10,
    conventions: 10
  };
  var KEYWORDS_WEIGHT = 15;
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function countWords(text) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return 0;
    return trimmed.split(/\s+/).length;
  }
  var WORDS_PER_PAGE = 450;
  var MAX_ESTIMATED_PAGES = 10;
  function computeEstimatedPages(wordCount) {
    if (wordCount === 0) return 0;
    return Math.min(Math.ceil(wordCount / WORDS_PER_PAGE), MAX_ESTIMATED_PAGES);
  }
  function extractYear(token) {
    const match = token.match(/(?:19|20)\d{2}/);
    return match ? parseInt(match[0], 10) : 0;
  }
  function buildAlternation(words) {
    return [...new Set(words)].sort((a, b) => b.length - a.length).join("|");
  }
  var WORD_START = "(?<![\\p{L}\\p{N}_])";
  var WORD_END = "(?![\\p{L}\\p{N}_])";
  var SEVERITY_RANK = {
    critical: 0,
    warning: 1,
    pass: 2
  };
  function sortFindings(findings) {
    return [...findings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  }
  var EXPERIENCE_HEADING_RE = new RegExp(
    `${WORD_START}(work\\s+experience|professional\\s+experience|employment\\s+history|work\\s+history|experience|arbetslivserfarenhet|yrkeserfarenhet|erfarenhet|exp\xE9rience\\s+professionnelle|parcours\\s+professionnel|exp\xE9rience)${WORD_END}`,
    "iu"
  );
  var EDUCATION_HEADING_RE = new RegExp(
    `${WORD_START}(education|academic\\s+background|utbildning|akademisk\\s+bakgrund|formation|\xE9tudes|dipl\xF4mes?)${WORD_END}`,
    "iu"
  );
  var SKILLS_HEADING_RE = new RegExp(
    `${WORD_START}(technical\\s+skills|core\\s+competencies|skills|competencies|kompetenser|kompetens|f\xE4rdigheter|comp\xE9tences)${WORD_END}`,
    "iu"
  );
  var STRUCTURE_SECTION_COUNT = 3;
  function analyzeStructure(text) {
    const hasExperience = EXPERIENCE_HEADING_RE.test(text);
    const hasEducation = EDUCATION_HEADING_RE.test(text);
    const hasSkills = SKILLS_HEADING_RE.test(text);
    const findings = [];
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
    const score = Math.round(foundCount / STRUCTURE_SECTION_COUNT * 100);
    return { score, findings, hasExperience };
  }
  var EMAIL_RE = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/;
  var PHONE_CANDIDATE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,6}\d{2,4}/g;
  var PHONE_MIN_DIGITS = 7;
  var LINKEDIN_URL_RE = /linkedin\.com\/(?:in|pub)\/[a-zA-Z0-9\-_%]+/i;
  var LINKEDIN_HANDLE_RE = /\blinkedin\b\s*[:\-]?\s*\S+/i;
  var CONTACT_EMAIL_WEIGHT = 50;
  var CONTACT_PHONE_WEIGHT = 30;
  var CONTACT_LINKEDIN_WEIGHT = 20;
  function hasPhoneNumber(text) {
    const matches = text.match(PHONE_CANDIDATE_RE) || [];
    return matches.some((m) => (m.match(/\d/g) || []).length >= PHONE_MIN_DIGITS);
  }
  function analyzeContact(text) {
    const hasEmail = EMAIL_RE.test(text);
    const hasPhone = hasPhoneNumber(text);
    const hasLinkedin = LINKEDIN_URL_RE.test(text) || LINKEDIN_HANDLE_RE.test(text);
    const findings = [];
    if (!hasEmail) findings.push({ id: "missing-email", category: "contact", severity: "critical" });
    if (!hasPhone) findings.push({ id: "missing-phone", category: "contact", severity: "critical" });
    if (!hasLinkedin) findings.push({ id: "missing-linkedin", category: "contact", severity: "warning" });
    if (findings.length === 0) {
      findings.push({ id: "contact-complete", category: "contact", severity: "pass" });
    }
    const score = (hasEmail ? CONTACT_EMAIL_WEIGHT : 0) + (hasPhone ? CONTACT_PHONE_WEIGHT : 0) + (hasLinkedin ? CONTACT_LINKEDIN_WEIGHT : 0);
    return { score, findings };
  }
  var MONTH_NAMES_RAW = [
    // EN
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
    "jan",
    "feb",
    "mar",
    "apr",
    "jun",
    "jul",
    "aug",
    "sep",
    "sept",
    "oct",
    "nov",
    "dec",
    // SV
    "januari",
    "februari",
    "mars",
    "maj",
    "juni",
    "juli",
    "augusti",
    "oktober",
    // FR
    "janvier",
    "f\xE9vrier",
    "fevrier",
    "avril",
    "mai",
    "juin",
    "juillet",
    "ao\xFBt",
    "aout",
    "septembre",
    "octobre",
    "novembre",
    "d\xE9cembre",
    "decembre"
  ];
  var MONTH_FRAGMENT = buildAlternation(MONTH_NAMES_RAW);
  var PRESENT_FRAGMENT = "present|now|currently|current|ongoing|nu|p[a\xE5]g[a\xE5]ende|aujourd'hui|pr[\xE9e]sent(?:e)?|actuel(?:le)?|[a\xE0]\\s*ce\\s*jour";
  var DATE_SEPARATOR_FRAGMENT = `(?:[-\u2013\u2014]|${WORD_START}(?:to|till|\xE0)${WORD_END})`;
  var ISO_MONTH_TOKEN = "(?:19|20)\\d{2}-(?:0[1-9]|1[0-2])";
  var MONTH_NAME_TOKEN = `(?:${MONTH_FRAGMENT})\\.?\\s+(?:19|20)\\d{2}`;
  var YEAR_TOKEN = "(?:19|20)\\d{2}";
  var ANY_DATE_TOKEN_RE = new RegExp(`\\b(?:${ISO_MONTH_TOKEN}|${MONTH_NAME_TOKEN}|${YEAR_TOKEN})\\b`, "i");
  var ISO_RANGE_RE = new RegExp(
    `(${ISO_MONTH_TOKEN})\\s*${DATE_SEPARATOR_FRAGMENT}\\s*(${ISO_MONTH_TOKEN}|${PRESENT_FRAGMENT})`,
    "giu"
  );
  var MONTH_RANGE_RE = new RegExp(
    `(${MONTH_NAME_TOKEN})\\s*${DATE_SEPARATOR_FRAGMENT}\\s*(${MONTH_NAME_TOKEN}|${PRESENT_FRAGMENT})`,
    "giu"
  );
  var YEAR_RANGE_RE = new RegExp(
    `(?<!(?:${MONTH_FRAGMENT})\\.?\\s)\\b(${YEAR_TOKEN})\\s*${DATE_SEPARATOR_FRAGMENT}\\s*(${YEAR_TOKEN}|${PRESENT_FRAGMENT})\\b`,
    "giu"
  );
  var DATES_BASE_SCORE = 100;
  var DATES_INCONSISTENT_PENALTY = 40;
  var DATES_MISSING_PENALTY = 50;
  var DATES_ORDER_PENALTY = 30;
  function collectRanges(text) {
    const results = [];
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
  var HEADING_LINE_MAX_CHARS = 60;
  function findHeadingLineIndex(lines, re, fromLine = 0) {
    for (let i = fromLine; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.length === 0 || trimmed.length > HEADING_LINE_MAX_CHARS) continue;
      if (re.test(trimmed)) return i;
    }
    return -1;
  }
  function extractExperienceSectionText(text) {
    const lines = text.split(/\r?\n/);
    const startIdx = findHeadingLineIndex(lines, EXPERIENCE_HEADING_RE);
    if (startIdx === -1) return text;
    const eduIdx = findHeadingLineIndex(lines, EDUCATION_HEADING_RE, startIdx + 1);
    const skillsIdx = findHeadingLineIndex(lines, SKILLS_HEADING_RE, startIdx + 1);
    const boundaries = [eduIdx, skillsIdx].filter((i) => i !== -1);
    const endIdx = boundaries.length > 0 ? Math.min(...boundaries) : lines.length;
    return lines.slice(startIdx, endIdx).join("\n");
  }
  function analyzeDates(text, hasExperienceSection) {
    const experienceText = extractExperienceSectionText(text);
    const ranges = collectRanges(experienceText);
    const styleSet = new Set(ranges.map((r) => r.type));
    const hasAnyDateToken = ANY_DATE_TOKEN_RE.test(experienceText);
    const findings = [];
    let score = DATES_BASE_SCORE;
    if (styleSet.size >= 2) {
      findings.push({
        id: "inconsistent-date-formats",
        category: "dates",
        severity: "warning",
        params: { styleCount: styleSet.size }
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
  var TOO_SHORT_WORD_THRESHOLD = 180;
  var TOO_LONG_WORD_THRESHOLD = 1100;
  var APPROX_WORDS_PER_CV_PAGE = 550;
  var LENGTH_SHORT_SCORE_CAP = 59;
  var LENGTH_LONG_SCORE = 65;
  function analyzeLength(wordCount) {
    if (wordCount < TOO_SHORT_WORD_THRESHOLD) {
      const score = clamp(Math.round(wordCount / TOO_SHORT_WORD_THRESHOLD * LENGTH_SHORT_SCORE_CAP), 0, LENGTH_SHORT_SCORE_CAP);
      return {
        score,
        findings: [{ id: "too-short", category: "length", severity: "warning", params: { wordCount } }]
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
            params: { wordCount, pages: Math.round(wordCount / APPROX_WORDS_PER_CV_PAGE) }
          }
        ]
      };
    }
    return {
      score: 100,
      findings: [{ id: "length-good", category: "length", severity: "pass", params: { wordCount } }]
    };
  }
  var BULLET_LINE_RE = /^[ \t]*(?:[-•*]|\d+[.)])[ \t]+(.+)$/;
  var DATE_RANGE_LINE_RE = new RegExp(
    `(?:${ISO_MONTH_TOKEN}|${MONTH_NAME_TOKEN}|${YEAR_TOKEN})\\s*${DATE_SEPARATOR_FRAGMENT}\\s*(?:${ISO_MONTH_TOKEN}|${MONTH_NAME_TOKEN}|${YEAR_TOKEN}|${PRESENT_FRAGMENT})`,
    "iu"
  );
  function isDateRangeLine(line) {
    const match = line.match(DATE_RANGE_LINE_RE);
    if (!match || match.index === void 0) return false;
    const remainder = (line.slice(0, match.index) + line.slice(match.index + match[0].length)).trim();
    return remainder.length <= 20;
  }
  var GENERIC_HEADING_LINE_RE = /^[A-ZÀ-Ö][A-ZÀ-Ö\s&/'-]{1,40}$/;
  function isHeadingLine(line) {
    if (line.length > HEADING_LINE_MAX_CHARS) return false;
    return EXPERIENCE_HEADING_RE.test(line) || EDUCATION_HEADING_RE.test(line) || SKILLS_HEADING_RE.test(line) || GENERIC_HEADING_LINE_RE.test(line);
  }
  var TITLE_COMPANY_LINE_RE = /^[^.!?]*\s[-–—]\s[^.!?]*$/;
  var MIN_IMPLICIT_BULLET_WORDS = 3;
  function looksLikeSentenceFragment(line) {
    if (EMAIL_RE.test(line) || LINKEDIN_URL_RE.test(line) || LINKEDIN_HANDLE_RE.test(line)) return false;
    if (isHeadingLine(line) || TITLE_COMPANY_LINE_RE.test(line)) return false;
    const wordCount = line.split(/\s+/).filter(Boolean).length;
    return wordCount >= MIN_IMPLICIT_BULLET_WORDS;
  }
  function detectBulletTexts(text) {
    const lines = text.split(/\r?\n/);
    const explicit = [];
    for (const line of lines) {
      const m = BULLET_LINE_RE.exec(line);
      if (m) explicit.push(m[1].trim());
    }
    if (explicit.length > 0) return explicit;
    const implicit = [];
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
  var ACTION_VERBS_EN = [
    "built",
    "led",
    "managed",
    "developed",
    "designed",
    "implemented",
    "created",
    "improved",
    "increased",
    "reduced",
    "launched",
    "delivered",
    "drove",
    "achieved",
    "optimized",
    "established",
    "coordinated",
    "analyzed",
    "executed",
    "spearheaded",
    "streamlined",
    "negotiated",
    "mentored",
    "architected",
    "automated",
    "migrated",
    "scaled",
    "shipped",
    "owned",
    "redesigned",
    "introduced",
    "ran",
    "wrote",
    "authored",
    "partnered",
    "collaborated",
    "presented",
    "trained",
    "hired",
    "onboarded",
    "resolved",
    "debugged",
    "deployed",
    "maintained",
    "grew",
    "cut",
    "saved",
    "generated",
    "planned",
    "directed"
  ];
  var ACTION_VERBS_SV = [
    "designade",
    "byggde",
    "ledde",
    "utvecklade",
    "implementerade",
    "skapade",
    "f\xF6rb\xE4ttrade",
    "\xF6kade",
    "minskade",
    "lanserade",
    "levererade",
    "drev",
    "uppn\xE5dde",
    "optimerade",
    "etablerade",
    "samordnade",
    "analyserade",
    "genomf\xF6rde",
    "ansvarade",
    "hanterade",
    "inf\xF6rde",
    "\xE4gde",
    "samarbetade",
    "utbildade",
    "l\xF6ste",
    "distribuerade",
    "underh\xF6ll",
    "skrev",
    "rekryterade",
    "omdesignade"
  ];
  var ACTION_VERBS_FR = [
    "con\xE7u",
    "construit",
    "dirig\xE9",
    "d\xE9velopp\xE9",
    "mis",
    "cr\xE9\xE9",
    "am\xE9lior\xE9",
    "augment\xE9",
    "r\xE9duit",
    "lanc\xE9",
    "livr\xE9",
    "pilot\xE9",
    "atteint",
    "optimis\xE9",
    "\xE9tabli",
    "coordonn\xE9",
    "analys\xE9",
    "ex\xE9cut\xE9",
    "g\xE9r\xE9",
    "anim\xE9",
    "collabor\xE9",
    "form\xE9",
    "r\xE9solu",
    "d\xE9ploy\xE9",
    "maintenu",
    "\xE9crit",
    "recrut\xE9",
    "n\xE9goci\xE9",
    "refondu",
    "automatis\xE9"
  ];
  var ACTION_VERB_ALTERNATION = buildAlternation([...ACTION_VERBS_EN, ...ACTION_VERBS_SV, ...ACTION_VERBS_FR]);
  var ACTION_VERB_START_RE = new RegExp(`^(?:${ACTION_VERB_ALTERNATION})${WORD_END}`, "iu");
  var WEAK_VERB_RATIO_THRESHOLD = 0.4;
  var QUANTIFIED_MIN_RATIO = 0.25;
  var BULLETS_WARNING_PENALTY = 35;
  function analyzeBullets(text) {
    const bulletTexts = detectBulletTexts(text);
    const total = bulletTexts.length;
    if (total === 0) {
      return {
        score: clamp(100 - BULLETS_WARNING_PENALTY, 0, 100),
        findings: [{ id: "bullets-not-detected", category: "bullets", severity: "warning" }]
      };
    }
    const verbCount = bulletTexts.filter((b) => ACTION_VERB_START_RE.test(b)).length;
    const quantifiedCount = bulletTexts.filter((b) => /\d/.test(b)).length;
    const verbRatio = verbCount / total;
    const quantifiedRatio = quantifiedCount / total;
    const findings = [];
    let score = 100;
    if (verbRatio < WEAK_VERB_RATIO_THRESHOLD) {
      findings.push({
        id: "weak-bullet-verbs",
        category: "bullets",
        severity: "warning",
        params: { percent: Math.round(verbRatio * 100) }
      });
      score -= BULLETS_WARNING_PENALTY;
    }
    if (quantifiedRatio < QUANTIFIED_MIN_RATIO) {
      findings.push({
        id: "unquantified-bullets",
        category: "bullets",
        severity: "warning",
        params: { percent: Math.round(quantifiedRatio * 100) }
      });
      score -= BULLETS_WARNING_PENALTY;
    }
    if (findings.length === 0) {
      findings.push({ id: "bullets-strong", category: "bullets", severity: "pass" });
    }
    return { score: clamp(score, 0, 100), findings };
  }
  var TABLE_LAYOUT_LINE_RE = /( {3,}|\t)/;
  var TABLE_LAYOUT_LINE_THRESHOLD = 3;
  var SPECIAL_CHAR_RATIO_THRESHOLD = 0.03;
  var ALLOWED_CHAR_RE = /[a-zA-Z0-9À-ÖØ-öø-ÿ\s.,;:!?()'"\-–—/@+%&*]/g;
  var ATS_WARNING_PENALTY = 50;
  function analyzeAts(text) {
    const lines = text.split(/\r?\n/);
    const tableLikeLines = lines.filter((l) => TABLE_LAYOUT_LINE_RE.test(l)).length;
    const allowedCount = (text.match(ALLOWED_CHAR_RE) || []).length;
    const specialRatio = text.length > 0 ? (text.length - allowedCount) / text.length : 0;
    const findings = [];
    let score = 100;
    if (tableLikeLines >= TABLE_LAYOUT_LINE_THRESHOLD) {
      findings.push({
        id: "possible-table-layout",
        category: "ats",
        severity: "warning",
        params: { lineCount: tableLikeLines }
      });
      score -= ATS_WARNING_PENALTY;
    }
    if (specialRatio > SPECIAL_CHAR_RATIO_THRESHOLD) {
      findings.push({
        id: "special-characters",
        category: "ats",
        severity: "warning",
        params: { percentage: Math.round(specialRatio * 100) }
      });
      score -= ATS_WARNING_PENALTY;
    }
    if (findings.length === 0) {
      findings.push({ id: "ats-clean", category: "ats", severity: "pass" });
    }
    return { score: clamp(score, 0, 100), findings };
  }
  var STOPWORDS_EN = /* @__PURE__ */ new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "are",
    "was",
    "were",
    "have",
    "has",
    "will",
    "your",
    "you",
    "our",
    "we",
    "of",
    "to",
    "in",
    "on",
    "at",
    "is",
    "as",
    "by",
    "an",
    "a",
    "or",
    "be",
    "it",
    "its",
    "their",
    "they",
    "not",
    "but",
    "can",
    "all",
    "any",
    "who",
    "what",
    "when",
    "where",
    "how",
    "into",
    "than",
    "then",
    "also",
    "more",
    "most",
    "such",
    "these",
    "those",
    "been",
    "being"
  ]);
  var STOPWORDS_SV = /* @__PURE__ */ new Set([
    "och",
    "f\xF6r",
    "med",
    "det",
    "den",
    "att",
    "som",
    "\xE4r",
    "var",
    "har",
    "ska",
    "din",
    "v\xE5r",
    "vi",
    "av",
    "till",
    "i",
    "p\xE5",
    "en",
    "ett",
    "de",
    "du",
    "jag",
    "han",
    "hon",
    "men",
    "eller",
    "inte",
    "kan",
    "alla",
    "vem",
    "vad",
    "n\xE4r",
    "hur",
    "ocks\xE5",
    "mer",
    "mest",
    "dessa"
  ]);
  var STOPWORDS_FR = /* @__PURE__ */ new Set([
    "et",
    "pour",
    "avec",
    "que",
    "qui",
    "est",
    "sont",
    "\xE9tait",
    "avoir",
    "votre",
    "notre",
    "nous",
    "de",
    "\xE0",
    "en",
    "dans",
    "sur",
    "un",
    "une",
    "le",
    "la",
    "les",
    "des",
    "du",
    "au",
    "aux",
    "ce",
    "cette",
    "mais",
    "ou",
    "pas",
    "peut",
    "tous",
    "toutes",
    "quoi",
    "quand",
    "o\xF9",
    "comment",
    "aussi",
    "plus",
    "ces"
  ]);
  var STOPWORDS_BY_LOCALE = {
    en: STOPWORDS_EN,
    sv: STOPWORDS_SV,
    fr: STOPWORDS_FR
  };
  var TOKEN_RE = /[a-zà-öø-ÿ0-9+#.]+/gi;
  var CAPITALIZED_WORD_RE = /(?<![\p{L}\p{N}_])\p{Lu}[\p{Ll}\p{N}+#.]{2,}(?![\p{L}\p{N}_])/gu;
  var MIN_TOKEN_LENGTH = 3;
  var KEYWORD_MATCH_DENOMINATOR_CAP = 30;
  var LOW_KEYWORD_THRESHOLD = 0.3;
  var MODERATE_KEYWORD_THRESHOLD = 0.6;
  var KEYWORD_TOP_N = 10;
  function trimEdgeDots(token) {
    return token.replace(/^\.+|\.+$/g, "");
  }
  function tokenize(text) {
    return (text.match(TOKEN_RE) || []).map((t) => trimEdgeDots(t.toLowerCase())).filter((t) => t.length >= MIN_TOKEN_LENGTH);
  }
  function extractKeywordSet(text, locale2) {
    const stop = STOPWORDS_BY_LOCALE[locale2];
    const tokens = tokenize(text).filter((t) => !stop.has(t));
    const caps = (text.match(CAPITALIZED_WORD_RE) || []).map((w) => trimEdgeDots(w.toLowerCase())).filter((t) => t.length >= MIN_TOKEN_LENGTH && !stop.has(t));
    return /* @__PURE__ */ new Set([...tokens, ...caps]);
  }
  function analyzeKeywords(cvText, jdText, locale2, hasJd) {
    if (!hasJd) {
      return { score: 0, weight: 0, findings: [], matched: [], missing: [] };
    }
    const jdSet = extractKeywordSet(jdText, locale2);
    if (jdSet.size === 0) {
      return { score: 0, weight: 0, findings: [], matched: [], missing: [] };
    }
    const cvSet = extractKeywordSet(cvText, locale2);
    const jdKeywords = [...jdSet].sort();
    const matched = jdKeywords.filter((k) => cvSet.has(k));
    const missing = jdKeywords.filter((k) => !cvSet.has(k));
    const denominator = Math.min(jdSet.size, KEYWORD_MATCH_DENOMINATOR_CAP);
    const overlap = denominator > 0 ? Math.min(matched.length / denominator, 1) : 0;
    const score = Math.round(overlap * 100);
    let id;
    let severity = "warning";
    if (overlap < LOW_KEYWORD_THRESHOLD) {
      id = "low-keyword-match";
    } else if (overlap <= MODERATE_KEYWORD_THRESHOLD) {
      id = "moderate-keyword-match";
    } else {
      id = "strong-keyword-match";
      severity = "pass";
    }
    const findings = [
      { id, category: "keywords", severity, params: { matched: matched.length, total: jdSet.size } }
    ];
    return {
      score,
      weight: KEYWORDS_WEIGHT,
      findings,
      matched: matched.slice(0, KEYWORD_TOP_N),
      missing: missing.slice(0, KEYWORD_TOP_N)
    };
  }
  var PERSONNUMMER_RE = /\b\d{6}(?:\d{2})?[-+]\d{4}\b/;
  var FR_PERSONAL_DETAILS_RE = new RegExp(
    `${WORD_START}(n\xE9(?:e)?\\s+le|date de naissance|nationalit\xE9|situation familiale|mari\xE9(?:e)?|c\xE9libataire|\xE9tat civil)${WORD_END}`,
    "iu"
  );
  var CONVENTIONS_WARNING_PENALTY = 30;
  function analyzeConventions(text, locale2) {
    const findings = [];
    let score = 100;
    if (locale2 === "sv") {
      findings.push({ id: "locale-photo-note", category: "conventions", severity: "pass" });
      if (PERSONNUMMER_RE.test(text)) {
        findings.push({ id: "locale-personal-details", category: "conventions", severity: "warning" });
        score -= CONVENTIONS_WARNING_PENALTY;
      }
    } else if (locale2 === "fr") {
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
  function checkCv(input) {
    const locale2 = input.locale;
    const text = (input.text ?? "").slice(0, MAX_INPUT_CHARS);
    const jdTextRaw = (input.jdText ?? "").slice(0, MAX_INPUT_CHARS);
    const hasJd = jdTextRaw.trim().length > 0;
    const wordCount = countWords(text);
    const estimatedPages = computeEstimatedPages(wordCount);
    if (wordCount < MIN_SCOREABLE_WORDS) {
      const categories2 = CV_CHECK_CATEGORIES.map((category) => ({
        category,
        score: 0,
        weight: category === "keywords" ? hasJd ? KEYWORDS_WEIGHT : 0 : CATEGORY_WEIGHTS[category]
      }));
      return {
        score: 0,
        categories: categories2,
        findings: [
          {
            id: "not-enough-text",
            category: "length",
            severity: "critical",
            params: { wordCount, minWords: MIN_SCOREABLE_WORDS }
          }
        ],
        wordCount,
        estimatedPages,
        matchedKeywords: [],
        missingKeywords: []
      };
    }
    const structure = analyzeStructure(text);
    const contact = analyzeContact(text);
    const dates = analyzeDates(text, structure.hasExperience);
    const length = analyzeLength(wordCount);
    const bullets = analyzeBullets(text);
    const ats = analyzeAts(text);
    const keywords = analyzeKeywords(text, jdTextRaw, locale2, hasJd);
    const conventions = analyzeConventions(text, locale2);
    const categories = [
      { category: "structure", score: structure.score, weight: CATEGORY_WEIGHTS.structure },
      { category: "contact", score: contact.score, weight: CATEGORY_WEIGHTS.contact },
      { category: "dates", score: dates.score, weight: CATEGORY_WEIGHTS.dates },
      { category: "length", score: length.score, weight: CATEGORY_WEIGHTS.length },
      { category: "bullets", score: bullets.score, weight: CATEGORY_WEIGHTS.bullets },
      { category: "ats", score: ats.score, weight: CATEGORY_WEIGHTS.ats },
      { category: "keywords", score: keywords.score, weight: keywords.weight },
      { category: "conventions", score: conventions.score, weight: CATEGORY_WEIGHTS.conventions }
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
      ...conventions.findings
    ]);
    return {
      score,
      categories,
      findings,
      wordCount,
      estimatedPages,
      matchedKeywords: keywords.matched,
      missingKeywords: keywords.missing
    };
  }

  // src/samples.ts
  var SAMPLE_EN = `JOHN DOE
Senior Product Designer

Email: john.doe@example.com
Phone: +45 00 00 00 00
LinkedIn: linkedin.com/in/example-demo-0001
Location: Copenhagen, Denmark

SUMMARY
Senior product designer with 6 years shipping data-intensive dashboards for B2B SaaS products used by millions of operational users. Led a design-system working group and partnered with engineering on cross-functional features end-to-end, from early research through launch and post-launch measurement. Comfortable owning a problem from early discovery through shipped, measured impact, and known for pairing strong systems thinking with a bias toward action.

EXPERIENCE

Senior Product Designer \u2014 Kestrel Logistics
March 2023 \u2013 Present
- Redesigned the route-planning dashboard used by 2.4 million drivers and dispatchers across 14 countries, cutting time-to-first-route by 38%.
- Built and maintained the internal design system, leading a weekly working group with 4 designers and 6 engineers.
- Introduced component-level accessibility testing into the team workflow, shipping WCAG AA across 90% of the product surface.
- Partnered with a principal PM and staff engineer to ship 12 cross-functional features in 18 months.
- Established a quarterly design-critique format adopted by 3 other product teams, raising review throughput by 25%.

Product Designer \u2014 Ember Analytics
January 2020 \u2013 February 2023
- Designed dense tabular interfaces for financial analysts, reducing support tickets on the reporting surface by 52% in two quarters.
- Owned the charting-library design guidelines and partnered with engineering on a Canvas-based renderer for large datasets.
- Ran a research program with 40+ analysts to map daily workflows, shaping three quarters of the product roadmap.
- Trained 5 junior designers on the team's critique process and design-system contribution model.

Junior Designer \u2014 Skylight Studio
June 2018 \u2013 December 2019
- Designed marketing sites and early-stage SaaS dashboards for 6 seed-stage B2B clients.
- Built the studio's first reusable component library, adopted across 12 client projects.

EDUCATION

BA in Interaction Design \u2014 Malm\xF6 University
August 2014 \u2013 June 2018

SKILLS
Design systems, B2B SaaS, data visualisation, accessibility (WCAG AA), Figma, prototyping, cross-functional collaboration, user research, design critique, Canvas rendering, information architecture, motion design, workshop facilitation, stakeholder communication.

LANGUAGES
English (fluent), Danish (native), German (conversational).`;
  var SAMPLE_SV = `JOHAN ANDERSSON
Senior Produktdesigner

E-post: johan.andersson@example.com
Telefon: +46 70 174 06 12
LinkedIn: linkedin.com/in/example-demo-0002
Ort: Stockholm, Sverige

SAMMANFATTNING
Senior produktdesigner med 6 \xE5rs erfarenhet av dataintensiva dashboards f\xF6r B2B SaaS-produkter som anv\xE4nds av miljontals operativa anv\xE4ndare. Ledde designsystem-arbetsgruppen p\xE5 senaste f\xF6retaget och samarbetade med ingenj\xF6rer kring tv\xE4rfunktionella funktioner, fr\xE5n tidig research till lansering och uppf\xF6ljande m\xE4tning. Van att \xE4ga ett problem fr\xE5n tidig uppt\xE4ckt till levererad, m\xE4tbar effekt, och k\xE4nd f\xF6r att kombinera starkt systemt\xE4nkande med handlingskraft.

ERFARENHET

Senior Produktdesigner \u2014 Kestrel Logistics
mars 2023 \u2013 nu
- Designade om rutplaneringsdashboarden som anv\xE4nds av 2,4 miljoner chauff\xF6rer och dispatchers i 14 l\xE4nder, minskade time-to-first-route med 38 procent.
- Byggde och underh\xF6ll det interna designsystemet, ledde en veckovis arbetsgrupp med 4 designers och 6 ingenj\xF6rer.
- Inf\xF6rde tillg\xE4nglighetstester p\xE5 komponentniv\xE5 i teamets arbetsfl\xF6de, levererade WCAG AA \xF6ver 90 procent av produktytan.
- Samarbetade med en principal PM och en senior ingenj\xF6r f\xF6r att leverera 12 tv\xE4rfunktionella funktioner p\xE5 18 m\xE5nader.
- Etablerade ett kvartalsvist designgranskningsformat som togs upp av 3 andra produktteam, \xF6kade granskningstakten med 25 procent.

Produktdesigner \u2014 Ember Analytics
januari 2020 \u2013 februari 2023
- Designade t\xE4ta tabellgr\xE4nssnitt f\xF6r finansanalytiker, minskade support\xE4renden p\xE5 rapporteringsytan med 52 procent p\xE5 tv\xE5 kvartal.
- \xC4gde designriktlinjerna f\xF6r diagrambiblioteket och samarbetade med ingenj\xF6rer om en Canvas-baserad renderare f\xF6r stora dataset.
- Drev ett forskningsprogram med 40+ analytiker f\xF6r att kartl\xE4gga dagliga arbetsfl\xF6den, formade tre kvartal av produktens roadmap.
- Utbildade 5 juniora designers i teamets granskningsprocess och designsystemets bidragsmodell.
- Genomf\xF6rde en tillg\xE4nglighetsrevision av rapporteringsytan och \xE5tg\xE4rdade 32 kontrastfel innan release.

Juniordesigner \u2014 Skylight Studio
juni 2018 \u2013 december 2019
- Designade marknadssidor och tidiga SaaS-dashboards f\xF6r 6 seed-stage B2B-kunder.
- Byggde studions f\xF6rsta \xE5teranv\xE4ndbara komponentbibliotek, anv\xE4nt i 12 kundprojekt.

UTBILDNING

Kandidatexamen i interaktionsdesign \u2014 Malm\xF6 universitet
augusti 2014 \u2013 juni 2018

KOMPETENS
Designsystem, B2B SaaS, datavisualisering, tillg\xE4nglighet (WCAG AA), Figma, prototyping, tv\xE4rfunktionellt samarbete, anv\xE4ndarforskning, designgranskning, Canvas-rendering, informationsarkitektur, r\xF6relsedesign, workshopfacilitering, intressentkommunikation.

SPR\xC5K
Svenska (modersm\xE5l), engelska (flytande), tyska (samtalsniv\xE5).`;
  var SAMPLE_FR = `JEAN MARTIN
Designer Produit Senior

E-mail : jean.martin@example.com
T\xE9l\xE9phone : +33 6 39 98 12 34
LinkedIn : linkedin.com/in/example-demo-0003
Lieu : Paris, France

R\xC9SUM\xC9
Designer produit senior avec 6 ans d'exp\xE9rience \xE0 livrer des tableaux de bord intensifs en donn\xE9es pour des produits B2B SaaS. A anim\xE9 le groupe de travail hebdomadaire sur le design system et collabor\xE9 avec l'ing\xE9nierie sur des fonctionnalit\xE9s transverses, de la recherche jusqu'au lancement. \xC0 l'aise pour porter un probl\xE8me depuis la d\xE9couverte initiale jusqu'\xE0 un impact livr\xE9 et mesur\xE9.

EXP\xC9RIENCE

Designer Produit Senior \u2014 Kestrel Logistics
mars 2023 \u2013 aujourd'hui
- Refonte du tableau de bord de planification d'itin\xE9raires utilis\xE9 par 2,4 millions de chauffeurs et dispatcheurs dans 14 pays, r\xE9duction du time-to-first-route de 38 pourcent.
- Construit et maintenu le design system interne, anim\xE9 un groupe de travail hebdomadaire avec 4 designers et 6 ing\xE9nieurs.
- D\xE9ploy\xE9 des tests d'accessibilit\xE9 au niveau des composants dans le workflow de l'\xE9quipe, livr\xE9 WCAG AA sur 90 pourcent de la surface produit.
- Collabor\xE9 avec un PM principal et un ing\xE9nieur staff pour livrer 12 fonctionnalit\xE9s transverses en 18 mois.

Designer Produit \u2014 Ember Analytics
janvier 2020 \u2013 f\xE9vrier 2023
- Con\xE7u des interfaces tabulaires denses pour analystes financiers, r\xE9duit les tickets support sur la surface reporting de 52 pourcent en deux trimestres.
- G\xE9r\xE9 les guidelines design de la biblioth\xE8que de graphiques et collabor\xE9 avec l'ing\xE9nierie sur un moteur de rendu Canvas pour gros datasets.
- Pilot\xE9 un programme de recherche avec 40+ analystes pour cartographier les workflows quotidiens, fa\xE7onn\xE9 trois trimestres de roadmap produit.
- Form\xE9 5 designers juniors au processus de critique de l'\xE9quipe et au mod\xE8le de contribution au design system.

Designer Junior \u2014 Skylight Studio
juin 2018 \u2013 d\xE9cembre 2019
- Con\xE7u des sites marketing et des dashboards SaaS early-stage pour 6 clients B2B en seed.
- Construit la premi\xE8re biblioth\xE8que de composants r\xE9utilisable du studio, utilis\xE9e sur 12 projets clients.

FORMATION

Licence en Design d'Interaction \u2014 Universit\xE9 de Malm\xF6
ao\xFBt 2014 \u2013 juin 2018

COMP\xC9TENCES
Design systems, B2B SaaS, visualisation de donn\xE9es, accessibilit\xE9 (WCAG AA), Figma, prototypage, collaboration transverse, recherche utilisateur, critique de design, rendu Canvas, architecture de l'information, design de mouvement.`;
  var SAMPLES = {
    en: SAMPLE_EN,
    sv: SAMPLE_SV,
    fr: SAMPLE_FR
  };
  function getSampleCvText(locale2) {
    return SAMPLES[locale2] ?? SAMPLE_EN;
  }

  // src/locales/en.json
  var en_default = {
    categories: {
      structure: "Structure",
      contact: "Contact info",
      dates: "Dates",
      length: "Length",
      bullets: "Bullet points",
      ats: "ATS compatibility",
      keywords: "Keyword match",
      conventions: "Regional conventions"
    },
    findings: {
      "not-enough-text": {
        title: "Not enough text to analyse",
        fix: "Add more content \u2014 a full CV usually runs 300+ words; make sure the text you passed in was extracted completely."
      },
      "missing-experience-section": {
        title: "No experience section found",
        fix: "Add a clearly labelled Experience (or Work History) section listing your roles."
      },
      "missing-education-section": {
        title: "No education section found",
        fix: "Add a clearly labelled Education section, even if it's brief."
      },
      "missing-skills-section": {
        title: "No skills section found",
        fix: "Add a Skills section listing your key technical and professional skills."
      },
      "sections-complete": {
        title: "All core sections present",
        fix: "Keep Experience, Education, and Skills clearly labelled and easy to find."
      },
      "missing-email": {
        title: "No email address found",
        fix: "Add a professional email address near the top of your CV."
      },
      "missing-phone": {
        title: "No phone number found",
        fix: "Add a phone number so recruiters can reach you directly."
      },
      "missing-linkedin": {
        title: "No LinkedIn URL found",
        fix: "Add a link to your LinkedIn profile in your contact details."
      },
      "contact-complete": {
        title: "Contact details complete",
        fix: "Keep your email, phone, and LinkedIn URL up to date and visible."
      },
      "inconsistent-date-formats": {
        title: "Date formats are inconsistent",
        fix: 'Use one consistent date format throughout, e.g. "Jan 2023 \u2013 Mar 2024".'
      },
      "missing-dates": {
        title: "Some roles are missing dates",
        fix: 'Add start and end dates (or "Present") to every role and qualification.'
      },
      "not-reverse-chronological": {
        title: "Roles aren't in reverse-chronological order",
        fix: "List your most recent role first, working backwards through your history."
      },
      "dates-consistent": {
        title: "Dates are consistent and ordered",
        fix: "Keep new roles at the top and formats consistent as you update your CV."
      },
      "too-short": {
        title: "Your CV looks too short",
        fix: "Add more detail to your experience and skills \u2014 aim for at least one full page."
      },
      "too-long": {
        title: "Your CV runs to about {pages} pages",
        fix: "Trim to 1\u20132 pages by cutting older or less relevant roles and tightening bullets."
      },
      "length-good": {
        title: "Length is well-calibrated",
        fix: "Keep it around 1\u20132 pages as you add new experience."
      },
      "weak-bullet-verbs": {
        title: "{percent}% of your bullets start with weak verbs",
        fix: 'Swap passive phrases like "responsible for" for strong action verbs like "led", "built", or "cut".'
      },
      "unquantified-bullets": {
        title: "{percent}% of your bullets have no numbers",
        fix: "Add metrics \u2014 %, $, time saved, team size \u2014 to show the scale of your impact."
      },
      "bullets-strong": {
        title: "Bullets are strong and quantified",
        fix: "Keep leading with action verbs and backing claims with numbers."
      },
      "bullets-not-detected": {
        title: "No bullet points detected",
        fix: "List your achievements as short bullet points (one line each) instead of paragraphs \u2014 it's easier for recruiters and ATS software to scan."
      },
      "possible-table-layout": {
        title: "Possible table or column layout detected",
        fix: "Avoid tables, text boxes, and multi-column layouts \u2014 many ATS parsers read them out of order or skip them."
      },
      "special-characters": {
        title: "Unusual characters found",
        fix: "Remove icons, emojis, and special symbols that ATS parsers can't read reliably."
      },
      "ats-clean": {
        title: "No ATS parsing red flags",
        fix: "Keep your layout simple \u2014 single column, standard fonts, no embedded graphics."
      },
      "low-keyword-match": {
        title: "Low keyword match \u2014 {matched} of {total} terms found",
        fix: "Work more of the job posting's key terms and skills naturally into your experience and skills sections."
      },
      "moderate-keyword-match": {
        title: "Moderate keyword match \u2014 {matched} of {total} terms found",
        fix: "You're partway there \u2014 mirror a few more of the job posting's exact terms to close the gap."
      },
      "strong-keyword-match": {
        title: "Strong keyword match \u2014 {matched} of {total} terms found",
        fix: "Great alignment \u2014 keep this level of overlap for other roles you apply to."
      },
      "locale-photo-note": {
        title: "Photo not expected",
        fix: "In most English-speaking job markets, CV photos aren't expected \u2014 leave it out unless specifically requested."
      },
      "locale-personal-details": {
        title: "Skip unnecessary personal details",
        fix: "Leave out marital status, date of birth, and national ID numbers \u2014 they're not expected and can invite bias."
      },
      "locale-length-note": {
        title: "Keep it concise",
        fix: "1\u20132 pages is the norm in most English-speaking markets \u2014 trim older or less relevant experience."
      },
      "conventions-ok": {
        title: "Follows regional conventions",
        fix: "Keep matching what's expected in your target market as you apply elsewhere."
      }
    }
  };

  // src/locales/sv.json
  var sv_default = {
    categories: {
      structure: "Struktur",
      contact: "Kontaktuppgifter",
      dates: "Datum",
      length: "L\xE4ngd",
      bullets: "Punktlistor",
      ats: "ATS-kompatibilitet",
      keywords: "Nyckelordsmatchning",
      conventions: "Lokal CV-praxis"
    },
    findings: {
      "not-enough-text": {
        title: "F\xF6r lite text f\xF6r att analysera",
        fix: "L\xE4gg till mer inneh\xE5ll \u2014 ett fullst\xE4ndigt CV \xE4r oftast 300+ ord; kontrollera att hela texten extraherades innan du skickade in den."
      },
      "missing-experience-section": {
        title: "Ingen erfarenhetssektion hittades",
        fix: "L\xE4gg till en tydligt m\xE4rkt sektion f\xF6r arbetslivserfarenhet med dina roller."
      },
      "missing-education-section": {
        title: "Ingen utbildningssektion hittades",
        fix: "L\xE4gg till en tydligt m\xE4rkt utbildningssektion, \xE4ven om den \xE4r kort."
      },
      "missing-skills-section": {
        title: "Ingen kompetenssektion hittades",
        fix: "L\xE4gg till en kompetenssektion med dina viktigaste tekniska och professionella f\xE4rdigheter."
      },
      "sections-complete": {
        title: "Alla huvudsektioner finns med",
        fix: "H\xE5ll erfarenhet, utbildning och kompetens tydligt m\xE4rkta och l\xE4tta att hitta."
      },
      "missing-email": {
        title: "Ingen e-postadress hittades",
        fix: "L\xE4gg till en professionell e-postadress h\xF6gst upp i CV:t."
      },
      "missing-phone": {
        title: "Inget telefonnummer hittades",
        fix: "L\xE4gg till ett telefonnummer s\xE5 att rekryterare kan n\xE5 dig direkt."
      },
      "missing-linkedin": {
        title: "Ingen LinkedIn-l\xE4nk hittades",
        fix: "L\xE4gg till en l\xE4nk till din LinkedIn-profil i kontaktuppgifterna."
      },
      "contact-complete": {
        title: "Kontaktuppgifterna \xE4r kompletta",
        fix: "H\xE5ll e-post, telefonnummer och LinkedIn-l\xE4nk uppdaterade och synliga."
      },
      "inconsistent-date-formats": {
        title: "Datumformaten \xE4r inkonsekventa",
        fix: 'Anv\xE4nd ett enhetligt datumformat genomg\xE5ende, t.ex. "jan 2023 \u2013 mar 2024".'
      },
      "missing-dates": {
        title: "Vissa roller saknar datum",
        fix: 'L\xE4gg till start- och slutdatum (eller "Nuvarande") f\xF6r varje roll och utbildning.'
      },
      "not-reverse-chronological": {
        title: "Rollerna listas inte i omv\xE4nd kronologisk ordning",
        fix: "Lista din senaste roll f\xF6rst och arbeta bak\xE5t genom din historik."
      },
      "dates-consistent": {
        title: "Datumen \xE4r konsekventa och r\xE4tt ordnade",
        fix: "H\xE5ll de senaste rollerna h\xF6gst upp och formatet enhetligt n\xE4r du uppdaterar CV:t."
      },
      "too-short": {
        title: "Ditt CV verkar f\xF6r kort",
        fix: "L\xE4gg till mer detaljer om erfarenhet och kompetens \u2014 sikta p\xE5 minst en hel sida."
      },
      "too-long": {
        title: "Ditt CV \xE4r ungef\xE4r {pages} sidor l\xE5ngt",
        fix: "Korta ner till 1\u20132 sidor genom att ta bort \xE4ldre eller mindre relevanta roller och sk\xE4rpa punkterna."
      },
      "length-good": {
        title: "L\xE4ngden \xE4r v\xE4l avv\xE4gd",
        fix: "H\xE5ll dig runt 1\u20132 sidor n\xE4r du l\xE4gger till ny erfarenhet."
      },
      "weak-bullet-verbs": {
        title: "{percent}% av dina punkter b\xF6rjar med svaga verb",
        fix: 'Byt passiva fraser som "ansvarig f\xF6r" mot starka verb som "ledde", "byggde" eller "minskade".'
      },
      "unquantified-bullets": {
        title: "{percent}% av dina punkter saknar siffror",
        fix: "L\xE4gg till m\xE4tbara resultat \u2014 %, kr, tid sparad, teamstorlek \u2014 f\xF6r att visa omfattningen av din insats."
      },
      "bullets-strong": {
        title: "Punkterna \xE4r starka och m\xE4tbara",
        fix: "Forts\xE4tt inleda med handlingsverb och backa upp p\xE5st\xE5enden med siffror."
      },
      "bullets-not-detected": {
        title: "Inga punktlistor hittades",
        fix: "Lista dina prestationer som korta punkter (en rad var) ist\xE4llet f\xF6r l\xF6pande text \u2014 det g\xF6r det l\xE4ttare f\xF6r rekryterare och ATS-system att skumma igenom."
      },
      "possible-table-layout": {
        title: "M\xF6jlig tabell- eller kolumnlayout uppt\xE4ckt",
        fix: "Undvik tabeller, textrutor och flerkolumnslayouter \u2014 m\xE5nga ATS-system l\xE4ser dem i fel ordning eller hoppar \xF6ver dem."
      },
      "special-characters": {
        title: "Ovanliga tecken hittades",
        fix: "Ta bort ikoner, emojis och specialsymboler som ATS-system inte l\xE4ser tillf\xF6rlitligt."
      },
      "ats-clean": {
        title: "Inga varningsflaggor f\xF6r ATS-tolkning",
        fix: "H\xE5ll layouten enkel \u2014 en kolumn, vanliga typsnitt, ingen inb\xE4ddad grafik."
      },
      "low-keyword-match": {
        title: "L\xE5g nyckelordsmatchning \u2014 {matched} av {total} termer hittades",
        fix: "V\xE4v in fler av jobbannonsens exakta nyckeltermer och f\xE4rdigheter i din erfarenhet och kompetens."
      },
      "moderate-keyword-match": {
        title: "M\xE5ttlig nyckelordsmatchning \u2014 {matched} av {total} termer hittades",
        fix: "Du \xE4r p\xE5 god v\xE4g \u2014 spegla n\xE5gra fler av jobbannonsens exakta termer f\xF6r att t\xE4ppa till luckorna."
      },
      "strong-keyword-match": {
        title: "Stark nyckelordsmatchning \u2014 {matched} av {total} termer hittades",
        fix: "Bra matchning \u2014 h\xE5ll samma niv\xE5 av \xF6verlapp f\xF6r andra roller du s\xF6ker."
      },
      "locale-photo-note": {
        title: "Foto \xE4r valfritt",
        fix: "I Sverige \xE4r foto p\xE5 CV:t valfritt \u2014 l\xE4gg bara till ett om det k\xE4nns naturligt, det p\xE5verkar s\xE4llan bed\xF6mningen."
      },
      "locale-personal-details": {
        title: "Undvik personnummer och on\xF6diga personuppgifter",
        fix: "Skriv aldrig ut personnummer, civilst\xE5nd eller f\xF6delsedatum i CV:t \u2014 det \xE4r varken f\xF6rv\xE4ntat eller s\xE4kert."
      },
      "locale-length-note": {
        title: "H\xE5ll det kort",
        fix: "Sikta p\xE5 1\u20132 sidor \u2014 det \xE4r standarden p\xE5 den svenska arbetsmarknaden."
      },
      "conventions-ok": {
        title: "F\xF6ljer svensk CV-praxis",
        fix: "Forts\xE4tt f\xF6lja lokal praxis om du ocks\xE5 s\xF6ker jobb utomlands."
      }
    }
  };

  // src/locales/fr.json
  var fr_default = {
    categories: {
      structure: "Structure",
      contact: "Coordonn\xE9es",
      dates: "Dates",
      length: "Longueur",
      bullets: "Puces",
      ats: "Compatibilit\xE9 ATS",
      keywords: "Correspondance des mots-cl\xE9s",
      conventions: "Usages locaux"
    },
    findings: {
      "not-enough-text": {
        title: "Pas assez de texte pour l'analyse",
        fix: "Ajoutez plus de contenu \u2014 un CV complet fait g\xE9n\xE9ralement 300 mots ou plus ; v\xE9rifiez que le texte fourni a \xE9t\xE9 extrait en entier."
      },
      "missing-experience-section": {
        title: "Aucune section Exp\xE9rience trouv\xE9e",
        fix: "Ajoutez une section Exp\xE9rience (ou Parcours professionnel) clairement identifi\xE9e listant vos postes."
      },
      "missing-education-section": {
        title: "Aucune section Formation trouv\xE9e",
        fix: "Ajoutez une section Formation clairement identifi\xE9e, m\xEAme br\xE8ve."
      },
      "missing-skills-section": {
        title: "Aucune section Comp\xE9tences trouv\xE9e",
        fix: "Ajoutez une section Comp\xE9tences listant vos principales comp\xE9tences techniques et professionnelles."
      },
      "sections-complete": {
        title: "Toutes les sections principales sont pr\xE9sentes",
        fix: "Gardez les sections Exp\xE9rience, Formation et Comp\xE9tences clairement identifi\xE9es et faciles \xE0 rep\xE9rer."
      },
      "missing-email": {
        title: "Aucune adresse e-mail trouv\xE9e",
        fix: "Ajoutez une adresse e-mail professionnelle en haut de votre CV."
      },
      "missing-phone": {
        title: "Aucun num\xE9ro de t\xE9l\xE9phone trouv\xE9",
        fix: "Ajoutez un num\xE9ro de t\xE9l\xE9phone pour que les recruteurs puissent vous joindre directement."
      },
      "missing-linkedin": {
        title: "Aucun lien LinkedIn trouv\xE9",
        fix: "Ajoutez un lien vers votre profil LinkedIn dans vos coordonn\xE9es."
      },
      "contact-complete": {
        title: "Coordonn\xE9es compl\xE8tes",
        fix: "Gardez votre e-mail, t\xE9l\xE9phone et lien LinkedIn \xE0 jour et visibles."
      },
      "inconsistent-date-formats": {
        title: "Les formats de date sont incoh\xE9rents",
        fix: 'Utilisez un format de date unique dans tout le CV, par exemple "janv. 2023 \u2013 mars 2024".'
      },
      "missing-dates": {
        title: "Certains postes n'ont pas de dates",
        fix: 'Ajoutez une date de d\xE9but et de fin (ou "En cours") \xE0 chaque poste et formation.'
      },
      "not-reverse-chronological": {
        title: "Les postes ne sont pas class\xE9s du plus r\xE9cent au plus ancien",
        fix: "Listez votre poste le plus r\xE9cent en premier, puis remontez dans le temps."
      },
      "dates-consistent": {
        title: "Les dates sont coh\xE9rentes et bien ordonn\xE9es",
        fix: "Gardez les postes les plus r\xE9cents en haut et un format coh\xE9rent \xE0 chaque mise \xE0 jour."
      },
      "too-short": {
        title: "Votre CV semble trop court",
        fix: "D\xE9taillez davantage votre exp\xE9rience et vos comp\xE9tences \u2014 visez au moins une page compl\xE8te."
      },
      "too-long": {
        title: "Votre CV fait environ {pages} pages",
        fix: "R\xE9duisez \xE0 1\u20132 pages en retirant les postes anciens ou moins pertinents et en resserrant vos puces."
      },
      "length-good": {
        title: "La longueur est bien calibr\xE9e",
        fix: "Restez autour de 1\u20132 pages \xE0 mesure que vous ajoutez de nouvelles exp\xE9riences."
      },
      "weak-bullet-verbs": {
        title: "{percent}% de vos puces commencent par des verbes faibles",
        fix: `Remplacez les tournures passives comme "charg\xE9 de" par des verbes d'action forts comme "dirig\xE9", "con\xE7u" ou "r\xE9duit".`
      },
      "unquantified-bullets": {
        title: "{percent}% de vos puces n'ont aucun chiffre",
        fix: "Ajoutez des indicateurs chiffr\xE9s \u2014 %, \u20AC, temps gagn\xE9, taille d'\xE9quipe \u2014 pour montrer l'ampleur de votre impact."
      },
      "bullets-strong": {
        title: "Puces solides et chiffr\xE9es",
        fix: "Continuez \xE0 commencer par des verbes d'action et \xE0 appuyer vos r\xE9sultats avec des chiffres."
      },
      "bullets-not-detected": {
        title: "Aucune puce d\xE9tect\xE9e",
        fix: "Listez vos r\xE9alisations sous forme de puces courtes (une ligne chacune) plut\xF4t qu'en paragraphes \u2014 c'est plus facile \xE0 parcourir pour les recruteurs et les logiciels ATS."
      },
      "possible-table-layout": {
        title: "Mise en page en tableau ou colonnes d\xE9tect\xE9e",
        fix: "\xC9vitez les tableaux, zones de texte et mises en page multi-colonnes \u2014 de nombreux ATS les lisent dans le d\xE9sordre ou les ignorent."
      },
      "special-characters": {
        title: "Caract\xE8res inhabituels d\xE9tect\xE9s",
        fix: "Retirez ic\xF4nes, \xE9mojis et symboles sp\xE9ciaux que les ATS ne lisent pas de mani\xE8re fiable."
      },
      "ats-clean": {
        title: "Aucun signal d'alerte pour l'analyse ATS",
        fix: "Gardez une mise en page simple \u2014 une seule colonne, polices standards, pas de graphiques int\xE9gr\xE9s."
      },
      "low-keyword-match": {
        title: "Correspondance de mots-cl\xE9s faible \u2014 {matched} sur {total} termes trouv\xE9s",
        fix: "Int\xE9grez naturellement davantage des termes cl\xE9s et comp\xE9tences de l'offre dans votre exp\xE9rience et vos comp\xE9tences."
      },
      "moderate-keyword-match": {
        title: "Correspondance de mots-cl\xE9s moyenne \u2014 {matched} sur {total} termes trouv\xE9s",
        fix: "Vous \xEAtes sur la bonne voie \u2014 reprenez quelques termes exacts suppl\xE9mentaires de l'offre pour combler l'\xE9cart."
      },
      "strong-keyword-match": {
        title: "Forte correspondance de mots-cl\xE9s \u2014 {matched} sur {total} termes trouv\xE9s",
        fix: "Excellent alignement \u2014 gardez ce niveau de correspondance pour vos autres candidatures."
      },
      "locale-photo-note": {
        title: "Photo facultative",
        fix: "En France, la photo sur le CV est facultative \u2014 ajoutez-la seulement si vous \xEAtes \xE0 l'aise, elle n'est plus syst\xE9matiquement attendue."
      },
      "locale-personal-details": {
        title: "Limitez les informations personnelles",
        fix: "\xC9vitez d'indiquer l'\xE9tat civil, la date de naissance compl\xE8te ou un num\xE9ro de s\xE9curit\xE9 sociale \u2014 ce n'est plus une attente standard."
      },
      "locale-length-note": {
        title: "Restez concis",
        fix: "Visez 1 \xE0 2 pages \u2014 c'est la norme sur le march\xE9 du travail fran\xE7ais."
      },
      "conventions-ok": {
        title: "Respecte les usages du CV en France",
        fix: "Continuez \xE0 adapter ces usages si vous postulez aussi \xE0 l'\xE9tranger."
      }
    }
  };

  // src/i18n.ts
  var messages = {
    en: en_default,
    sv: sv_default,
    fr: fr_default
  };
  function fill(template, params) {
    if (!params) return template;
    return template.replace(
      /\{(\w+)\}/g,
      (whole, key) => key in params ? String(params[key]) : whole
    );
  }
  function describeFinding(finding, locale2) {
    const entry = messages[locale2].findings[finding.id];
    return { title: fill(entry.title, finding.params), fix: fill(entry.fix, finding.params) };
  }
  function categoryLabel(category, locale2) {
    return messages[locale2].categories[category];
  }

  // demo-src/main.ts
  var UI = {
    en: {
      lead: "Paste a CV and get a score out of 100. Everything runs in this page. Nothing is sent anywhere.",
      cv: "Your CV (plain text)",
      jd: "Job description (optional, turns on keyword matching)",
      sample: "Use a sample",
      check: "Check CV",
      score: "Score",
      categories: "Categories",
      findings: "Findings",
      matched: "Matched keywords",
      missing: "Missing keywords",
      words: "words",
      pages: "pages",
      noJd: "Keyword matching is off until you paste a job description.",
      hosted: "Hosted version (same engine, with file upload)"
    },
    sv: {
      lead: "Klistra in ett CV och f\xE5 ett betyg av 100. Allt k\xF6rs p\xE5 den h\xE4r sidan. Ingenting skickas n\xE5gonstans.",
      cv: "Ditt CV (ren text)",
      jd: "Jobbannons (valfritt, aktiverar nyckelordsmatchning)",
      sample: "Anv\xE4nd ett exempel",
      check: "Granska CV",
      score: "Po\xE4ng",
      categories: "Kategorier",
      findings: "Resultat",
      matched: "Matchade nyckelord",
      missing: "Saknade nyckelord",
      words: "ord",
      pages: "sidor",
      noJd: "Nyckelordsmatchning \xE4r avst\xE4ngd tills du klistrar in en jobbannons.",
      hosted: "Hostad version (samma motor, med filuppladdning)"
    },
    fr: {
      lead: "Collez un CV et obtenez une note sur 100. Tout s'ex\xE9cute dans cette page. Rien n'est envoy\xE9.",
      cv: "Votre CV (texte brut)",
      jd: "Offre d'emploi (facultatif, active la correspondance de mots-cl\xE9s)",
      sample: "Utiliser un exemple",
      check: "Analyser le CV",
      score: "Score",
      categories: "Cat\xE9gories",
      findings: "R\xE9sultats",
      matched: "Mots-cl\xE9s trouv\xE9s",
      missing: "Mots-cl\xE9s manquants",
      words: "mots",
      pages: "pages",
      noJd: "La correspondance de mots-cl\xE9s est d\xE9sactiv\xE9e tant qu'aucune offre n'est coll\xE9e.",
      hosted: "Version h\xE9berg\xE9e (m\xEAme moteur, avec import de fichier)"
    }
  };
  var $ = (id) => document.getElementById(id);
  var locale = "en";
  var last = null;
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function applyStaticText() {
    const t = UI[locale];
    document.documentElement.lang = locale;
    $("lead").textContent = t.lead;
    $("cv-label").textContent = t.cv;
    $("jd-label").textContent = t.jd;
    $("sample").textContent = t.sample;
    $("check").textContent = t.check;
    $("hosted-link").textContent = t.hosted;
    $("hosted-link").href = `https://nextcv.net/${locale}/cv-check`;
    for (const btn of document.querySelectorAll("[data-locale]")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.locale === locale));
    }
  }
  function render() {
    const out = $("results");
    out.replaceChildren();
    if (!last) return;
    const t = UI[locale];
    const result = last;
    const head = el("div", "score-row");
    head.append(el("div", "score", String(result.score)), el("div", "score-label", `${t.score} / 100`));
    out.append(head);
    out.append(el("p", "muted", `${result.wordCount} ${t.words} \xB7 ${t.pages}: ~${result.estimatedPages}`));
    out.append(el("h2", "", t.categories));
    const bars = el("ul", "bars");
    for (const cat of CV_CHECK_CATEGORIES) {
      const entry = result.categories.find((c) => c.category === cat);
      if (!entry) continue;
      const off = entry.weight === 0;
      const li = el("li");
      li.append(el("span", "bar-name", categoryLabel(cat, locale)));
      const track = el("span", "track");
      const fill2 = el("span", "fill");
      fill2.style.width = off ? "0%" : `${entry.score}%`;
      track.append(fill2);
      li.append(track, el("span", "bar-value", off ? "\u2013" : String(entry.score)));
      bars.append(li);
    }
    out.append(bars);
    if (result.categories.some((c) => c.category === "keywords" && c.weight === 0)) {
      out.append(el("p", "muted", t.noJd));
    }
    out.append(el("h2", "", t.findings));
    const list = el("ul", "findings");
    for (const f of result.findings) {
      const { title, fix } = describeFinding(f, locale);
      const li = el("li", `finding ${f.severity}`);
      li.append(el("span", "dot"), el("span", "finding-title", title), el("span", "finding-fix", fix));
      list.append(li);
    }
    out.append(list);
    if (result.matchedKeywords.length > 0 || result.missingKeywords.length > 0) {
      for (const [label, words] of [
        [t.matched, result.matchedKeywords],
        [t.missing, result.missingKeywords]
      ]) {
        out.append(el("h2", "", label));
        const chips = el("ul", "chips");
        for (const w of words) chips.append(el("li", "", w));
        out.append(chips);
      }
    }
  }
  function run() {
    const text = $("cv").value.slice(0, MAX_INPUT_CHARS);
    const jdText = $("jd").value.slice(0, MAX_INPUT_CHARS);
    last = checkCv({ text, locale, ...jdText.trim() ? { jdText } : {} });
    render();
  }
  for (const btn of document.querySelectorAll("[data-locale]")) {
    btn.addEventListener("click", () => {
      locale = btn.dataset.locale;
      applyStaticText();
      if (last) run();
    });
  }
  $("sample").addEventListener("click", () => {
    $("cv").value = getSampleCvText(locale);
    run();
  });
  $("check").addEventListener("click", run);
  applyStaticText();
})();
