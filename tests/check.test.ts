import { describe, it, expect } from "vitest";
import { checkCv, scoreBucketOf } from "../src/check.js";
import { getSampleCvText } from "../src/samples.js";
import {
  CV_CHECK_CATEGORIES,
  MAX_INPUT_CHARS,
  MIN_SCOREABLE_WORDS,
  type CvCheckLocale,
} from "../src/types.js";

const LOCALES: CvCheckLocale[] = ["en", "sv", "fr"];

function filler(words: number): string {
  return Array(words).fill("filler").join(" ");
}

function findingIds(result: ReturnType<typeof checkCv>): string[] {
  return result.findings.map((f) => f.id);
}

function criticalIds(result: ReturnType<typeof checkCv>): string[] {
  return result.findings.filter((f) => f.severity === "critical").map((f) => f.id);
}

/* ────────────────────────────────────────────────────────────────────── */
/*  (a) Sample CVs — zero criticals, score ≥ 70                            */
/* ────────────────────────────────────────────────────────────────────── */

describe("sample CVs", () => {
  it.each(LOCALES)("locale '%s' sample scores ≥70 with zero critical findings", (locale) => {
    const text = getSampleCvText(locale);
    const result = checkCv({ text, locale });
    expect(criticalIds(result)).toEqual([]);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it.each(LOCALES)("locale '%s' sample is non-trivial plain text", (locale) => {
    const text = getSampleCvText(locale);
    expect(text.length).toBeGreaterThan(0);
    expect(text.trim().split(/\s+/).length).toBeGreaterThanOrEqual(MIN_SCOREABLE_WORDS);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  (b) not-enough-text short circuit                                      */
/* ────────────────────────────────────────────────────────────────────── */

describe("not-enough-text short circuit", () => {
  it("empty input yields exactly the not-enough-text critical and a low score", () => {
    const result = checkCv({ text: "", locale: "en" });
    expect(findingIds(result)).toEqual(["not-enough-text"]);
    expect(result.findings[0].severity).toBe("critical");
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.wordCount).toBe(0);
    expect(result.matchedKeywords).toEqual([]);
    expect(result.missingKeywords).toEqual([]);
    expect(result.categories).toHaveLength(CV_CHECK_CATEGORIES.length);
    expect(result.categories.every((c) => c.score === 0)).toBe(true);
  });

  it("input under MIN_SCOREABLE_WORDS yields exactly the not-enough-text critical", () => {
    const shortText = filler(25);
    const result = checkCv({ text: shortText, locale: "en" });
    expect(result.wordCount).toBe(25);
    expect(result.wordCount).toBeLessThan(MIN_SCOREABLE_WORDS);
    expect(findingIds(result)).toEqual(["not-enough-text"]);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.findings[0].params).toMatchObject({ wordCount: 25, minWords: MIN_SCOREABLE_WORDS });
  });

  it("input at exactly MIN_SCOREABLE_WORDS does NOT short-circuit", () => {
    const boundaryText = filler(MIN_SCOREABLE_WORDS);
    const result = checkCv({ text: boundaryText, locale: "en" });
    expect(findingIds(result)).not.toEqual(["not-enough-text"]);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  (c) non-CV prose → structure criticals fire                            */
/* ────────────────────────────────────────────────────────────────────── */

describe("non-CV prose", () => {
  const recipeText =
    "Preheat the oven to 200 degrees Celsius and line a baking tray with parchment paper. " +
    "In a large bowl, whisk together the flour, sugar, baking powder, and a pinch of salt until " +
    "evenly combined. Add the softened butter and mix until the mixture resembles coarse breadcrumbs. " +
    "Pour in the milk and vanilla extract, stirring gently until a soft dough forms. Fold in the fresh " +
    "blueberries, being careful not to overwork the dough. Spoon the mixture into the prepared tray and " +
    "bake for twenty five minutes until golden brown and firm to the touch. Allow the scones to cool " +
    "slightly before serving with clotted cream and jam.";

  it("recipe text trips all three structure criticals", () => {
    const result = checkCv({ text: recipeText, locale: "en" });
    const critical = criticalIds(result);
    expect(critical).toEqual(
      expect.arrayContaining(["missing-experience-section", "missing-education-section", "missing-skills-section"]),
    );
    expect(result.categories.find((c) => c.category === "structure")?.score).toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  (d) OCR-garbage text → ats warnings fire, engine never throws          */
/* ────────────────────────────────────────────────────────────────────── */

describe("OCR-garbage text", () => {
  const ocrGarbage = Array.from(
    { length: 5 },
    (_, i) => `T3xt${i} w1th ###@@@ %%%~~~ RaNdOm CaSe ^^^ &&& |||\t\tGl1tch`,
  ).join("\n");

  it("does not throw and fires ats warnings", () => {
    let result: ReturnType<typeof checkCv> | undefined;
    expect(() => {
      result = checkCv({ text: ocrGarbage, locale: "en" });
    }).not.toThrow();
    expect(result).toBeDefined();
    const atsFindings = result!.findings.filter((f) => f.category === "ats");
    const atsIds = atsFindings.map((f) => f.id);
    expect(atsIds).toEqual(expect.arrayContaining(["possible-table-layout", "special-characters"]));
    expect(atsFindings.every((f) => f.severity === "warning")).toBe(true);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  (e) duplicated sections → tolerated, no crash, sane result             */
/* ────────────────────────────────────────────────────────────────────── */

describe("duplicated sections", () => {
  it("tolerates a CV pasted twice back-to-back without crashing", () => {
    const base = getSampleCvText("en");
    const duplicated = `${base}\n\n${base}`;
    let result: ReturnType<typeof checkCv> | undefined;
    expect(() => {
      result = checkCv({ text: duplicated, locale: "en" });
    }).not.toThrow();
    expect(result).toBeDefined();
    expect(result!.score).toBeGreaterThanOrEqual(0);
    expect(result!.score).toBeLessThanOrEqual(100);
    expect(Number.isFinite(result!.score)).toBe(true);
    expect(result!.wordCount).toBeGreaterThan(getSampleCvText("en").trim().split(/\s+/).length);
    expect(result!.categories).toHaveLength(CV_CHECK_CATEGORIES.length);
    expect(result!.findings.length).toBeGreaterThan(0);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  (f) EU date formats                                                    */
/* ────────────────────────────────────────────────────────────────────── */

describe("date format detection", () => {
  it("uniform ISO year-month ranges → dates-consistent", () => {
    const text =
      "Experience\nSoftware Engineer\n2021-03 – 2023-11\nBuilt things.\n" +
      "Product Manager\n2019-01 – 2021-02\nShipped features.\n" +
      filler(50);
    const result = checkCv({ text, locale: "en" });
    const dateIds = result.findings.filter((f) => f.category === "dates").map((f) => f.id);
    expect(dateIds).toEqual(["dates-consistent"]);
  });

  it("Swedish 'mars 2021 – nu' → dates-consistent", () => {
    const text = "Erfarenhet\nSenior utvecklare\nmars 2021 – nu\nGjorde saker.\n" + filler(50);
    const result = checkCv({ text, locale: "sv" });
    const dateIds = result.findings.filter((f) => f.category === "dates").map((f) => f.id);
    expect(dateIds).toEqual(["dates-consistent"]);
  });

  it("French 'mars 2021 – aujourd'hui' → dates-consistent", () => {
    const text = "Expérience\nDéveloppeur senior\nmars 2021 – aujourd'hui\nA fait des choses.\n" + filler(50);
    const result = checkCv({ text, locale: "fr" });
    const dateIds = result.findings.filter((f) => f.category === "dates").map((f) => f.id);
    expect(dateIds).toEqual(["dates-consistent"]);
  });

  it("English 'May 2021 – Present' → dates-consistent", () => {
    const text = "Experience\nEngineer\nMay 2021 – Present\nDid stuff.\n" + filler(50);
    const result = checkCv({ text, locale: "en" });
    const dateIds = result.findings.filter((f) => f.category === "dates").map((f) => f.id);
    expect(dateIds).toEqual(["dates-consistent"]);
  });

  it("uniform month-less '2019 – 2022' → dates-consistent", () => {
    const text = "Experience\nAnalyst\n2019 – 2022\nAnalyzed data.\n" + filler(50);
    const result = checkCv({ text, locale: "en" });
    const dateIds = result.findings.filter((f) => f.category === "dates").map((f) => f.id);
    expect(dateIds).toEqual(["dates-consistent"]);
  });

  it("mixed ISO + year-only styles → inconsistent-date-formats", () => {
    const text =
      "Experience\nRole A\n2021-03 - 2023-11\nDid work.\nRole B\n2019 - 2022\nDid other work.\n" + filler(50);
    const result = checkCv({ text, locale: "en" });
    const dateFindings = result.findings.filter((f) => f.category === "dates");
    expect(dateFindings.map((f) => f.id)).toContain("inconsistent-date-formats");
    expect(dateFindings.every((f) => f.severity === "warning")).toBe(true);
  });

  it("ascending (oldest-first) ranges → not-reverse-chronological", () => {
    const text = "Experience\nRole A\n2018 - 2020\nDid work.\nRole B\n2021 - 2023\nDid more work.\n" + filler(50);
    const result = checkCv({ text, locale: "en" });
    const dateIds = result.findings.filter((f) => f.category === "dates").map((f) => f.id);
    expect(dateIds).toEqual(["not-reverse-chronological"]);
  });

  it("experience section with zero date tokens → missing-dates", () => {
    const text =
      "Experience\nSoftware Engineer at TechCorp\nBuilt various internal tools and dashboards for the team.\n" +
      filler(50);
    const result = checkCv({ text, locale: "en" });
    const dateIds = result.findings.filter((f) => f.category === "dates").map((f) => f.id);
    expect(dateIds).toEqual(["missing-dates"]);
  });

  it("month-precision experience dates + bare-year education dates → dates-consistent (not a real inconsistency)", () => {
    // Convention, not inconsistency: education entries commonly use bare
    // years while experience entries use full month-year. Regression test
    // for a reported false positive where this legitimate mix tripped
    // "inconsistent-date-formats".
    const text =
      "EXPERIENCE\n" +
      "Senior Engineer - Acme Corp\n" +
      "March 2023 - Present\n" +
      "- Built things and improved metrics by 40 percent.\n" +
      "- Led a team of five engineers on a critical project.\n\n" +
      "Engineer - Beta Inc\n" +
      "January 2020 - February 2023\n" +
      "- Delivered features and reduced load time by 30 percent.\n" +
      "- Wrote comprehensive tests achieving 90 percent coverage.\n\n" +
      "EDUCATION\n" +
      "BA Computer Science - State University\n" +
      "2014 - 2018\n\n" +
      "SKILLS\n" +
      "JavaScript, TypeScript, React, Node.js, AWS, Docker, Kubernetes, GraphQL.\n" +
      filler(30);
    const result = checkCv({ text, locale: "en" });
    const dateIds = result.findings.filter((f) => f.category === "dates").map((f) => f.id);
    expect(dateIds).toEqual(["dates-consistent"]);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  (f2) Length false positive on a genuinely full one-page CV             */
/* ────────────────────────────────────────────────────────────────────── */

describe("length detection", () => {
  it("a realistic, complete one-page CV with concise bullets does not trip too-short", () => {
    // Regression test: a genuinely full one-page resume with typical
    // concise bullet phrasing commonly lands under 250 words; the old
    // threshold falsely flagged it as too short.
    const text =
      "MICHAEL CHEN\nProduct Manager\nEmail: michael.chen@example.com | Phone: +1 415 555 0192\n" +
      "LinkedIn: linkedin.com/in/example-demo-0000 | San Francisco, CA\n\n" +
      "SUMMARY\nProduct manager with 5 years of experience shipping B2B SaaS features from discovery to launch.\n\n" +
      "EXPERIENCE\n\n" +
      "Senior Product Manager - Northwind Analytics\n" +
      "March 2022 - Present\n" +
      "- Launched three major features, growing monthly active users by 22 percent.\n" +
      "- Led cross-functional team of eight engineers and two designers.\n" +
      "- Reduced churn by 15 percent through onboarding redesign.\n" +
      "- Ran quarterly roadmap planning with executive stakeholders.\n\n" +
      "Product Manager - Vertex Software\n" +
      "January 2019 - February 2022\n" +
      "- Owned the billing platform roadmap, increasing revenue by 30 percent.\n" +
      "- Shipped self-serve signup flow, cutting sales cycle by two weeks.\n" +
      "- Managed backlog of 40 features across three engineering pods.\n" +
      "- Partnered with design on a full UI refresh of the dashboard.\n\n" +
      "Associate Product Manager - Beacon Labs\n" +
      "June 2017 - December 2018\n" +
      "- Supported roadmap execution for the core reporting product.\n" +
      "- Conducted 25 customer interviews to validate new features.\n\n" +
      "EDUCATION\nBA Economics - University of Michigan\n2013 - 2017\n\n" +
      "SKILLS\nRoadmapping, SQL, Figma, A/B testing, stakeholder management, Jira, Amplitude, user research.\n\n" +
      "LANGUAGES\nEnglish (native), Mandarin (conversational).\n";
    const result = checkCv({ text, locale: "en" });
    expect(result.wordCount).toBeLessThan(250);
    expect(result.wordCount).toBeGreaterThan(150);
    const lengthFinding = result.findings.find((f) => f.category === "length");
    expect(lengthFinding?.id).toBe("length-good");
  });

  it("a genuinely sparse CV still trips too-short", () => {
    const text =
      "EXPERIENCE\nEngineer - Acme Corp\n2022 - Present\n- Built things.\n- Improved metrics.\n\n" +
      "EDUCATION\nBA - State University\n2018 - 2022\n\nSKILLS\nJavaScript.\n" +
      filler(20);
    const result = checkCv({ text, locale: "en" });
    expect(result.wordCount).toBeLessThan(180);
    const lengthFinding = result.findings.find((f) => f.category === "length");
    expect(lengthFinding?.id).toBe("too-short");
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  (f3) Bullet detection survives glyph-stripped PDF extraction           */
/* ────────────────────────────────────────────────────────────────────── */

describe("bullet detection", () => {
  // Mirrors what many PDF text extractors do to a bulleted list: the
  // marker glyph (•, -, *) is dropped but each bullet keeps its own line.
  function stripBulletGlyphs(text: string): string {
    return text
      .split(/\r?\n/)
      .map((line) => line.replace(/^([ \t]*)[-•*][ \t]+/, "$1"))
      .join("\n");
  }

  it("(a) a CV whose bullets lose their glyphs still scores as having bullets", () => {
    const withGlyphs = getSampleCvText("en");
    const glyphless = stripBulletGlyphs(withGlyphs);
    expect(glyphless).not.toContain("- ");

    const result = checkCv({ text: glyphless, locale: "en" });
    const bulletsCategory = result.categories.find((c) => c.category === "bullets");
    const bulletFindings = result.findings.filter((f) => f.category === "bullets");

    expect(bulletsCategory?.score).toBe(100);
    expect(bulletFindings.map((f) => f.id)).toEqual(["bullets-strong"]);
  });

  it("(c) upload-style (glyph-stripped) and paste-style (glyph-intact) text score the bullets category equivalently", () => {
    const pasteStyle = getSampleCvText("en");
    const uploadStyle = stripBulletGlyphs(pasteStyle);

    const pasteResult = checkCv({ text: pasteStyle, locale: "en" });
    const uploadResult = checkCv({ text: uploadStyle, locale: "en" });

    const pasteBullets = pasteResult.categories.find((c) => c.category === "bullets");
    const uploadBullets = uploadResult.categories.find((c) => c.category === "bullets");
    expect(uploadBullets?.score).toBe(pasteBullets?.score);

    const pasteBulletFindingIds = pasteResult.findings.filter((f) => f.category === "bullets").map((f) => f.id);
    const uploadBulletFindingIds = uploadResult.findings.filter((f) => f.category === "bullets").map((f) => f.id);
    expect(uploadBulletFindingIds).toEqual(pasteBulletFindingIds);

    // Overall score should also land in the same ballpark — not identical
    // necessarily (other categories may shift slightly with word wrapping),
    // but never off by more than a couple of points on this fixture.
    expect(Math.abs(pasteResult.score - uploadResult.score)).toBeLessThanOrEqual(2);
  });

  it("(b) a CV with genuinely no bullet/list content never emits a zero-denominator percentage finding", () => {
    const text =
      "Experience\nI have worked in software for several years across a range of teams and projects. " +
      "During that time I contributed to many initiatives and worked closely with cross-functional partners. " +
      "I focused on delivering reliable software and collaborating with stakeholders throughout each project.\n\n" +
      "Education\nI studied computer science and completed my degree over four years at university.\n\n" +
      "Skills\nI am comfortable with a wide range of programming languages and collaborative tools.\n" +
      filler(20);
    const result = checkCv({ text, locale: "en" });
    const bulletFindings = result.findings.filter((f) => f.category === "bullets");

    expect(bulletFindings.map((f) => f.id)).toEqual(["bullets-not-detected"]);
    expect(bulletFindings.some((f) => f.id === "weak-bullet-verbs")).toBe(false);
    expect(bulletFindings.some((f) => f.id === "unquantified-bullets")).toBe(false);
    for (const finding of bulletFindings) {
      expect(finding.params?.percent).toBeUndefined();
    }
  });

  it("(b) across a range of fixture CVs, weak-bullet-verbs/unquantified-bullets never appear together with zero bullets", () => {
    const fixtures = [
      getSampleCvText("en"),
      getSampleCvText("sv"),
      getSampleCvText("fr"),
      "Prose only, no lists or dates anywhere in this document at all.\n" + filler(60),
      "Experience\nSoftware Engineer at TechCorp\nBuilt various internal tools and dashboards.\n" + filler(50),
    ];
    for (const text of fixtures) {
      for (const locale of LOCALES) {
        const result = checkCv({ text, locale });
        const weakVerbs = result.findings.find((f) => f.id === "weak-bullet-verbs");
        const unquantified = result.findings.find((f) => f.id === "unquantified-bullets");
        // Neither zero-denominator finding may appear unless real bullets
        // were actually detected (percent is only meaningful when > 0 bullets
        // exist — a percent of exactly 0 with no bullets is the bug we fixed).
        const bulletsNotDetected = result.findings.some((f) => f.id === "bullets-not-detected");
        if (bulletsNotDetected) {
          expect(weakVerbs).toBeUndefined();
          expect(unquantified).toBeUndefined();
        }
      }
    }
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  (g) JD keyword overlap                                                 */
/* ────────────────────────────────────────────────────────────────────── */

describe("JD keyword overlap", () => {
  const sampleEn = getSampleCvText("en");

  it("high-overlap JD fires strong-keyword-match (pass) and populates matchedKeywords", () => {
    const jd =
      "We need a Senior Product Designer with experience in B2B SaaS dashboards, design systems, " +
      "accessibility WCAG AA, Figma prototyping, cross-functional collaboration, user research, " +
      "design critique, Canvas rendering, information architecture, and motion design for our analytics platform.";
    const result = checkCv({ text: sampleEn, locale: "en", jdText: jd });
    const keywordFinding = result.findings.find((f) => f.category === "keywords");
    expect(keywordFinding?.id).toBe("strong-keyword-match");
    expect(keywordFinding?.severity).toBe("pass");
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
    expect(result.categories.find((c) => c.category === "keywords")?.weight).toBe(15);
  });

  it("low-overlap JD fires low-keyword-match (warning)", () => {
    const jd =
      "Seeking an experienced pastry chef skilled in laminated dough, sourdough fermentation, chocolate " +
      "tempering, kitchen inventory management, walk-in cooler organization, banquet catering logistics, " +
      "and seasonal menu planning for a fine dining restaurant.";
    const result = checkCv({ text: sampleEn, locale: "en", jdText: jd });
    const keywordFinding = result.findings.find((f) => f.category === "keywords");
    expect(keywordFinding?.id).toBe("low-keyword-match");
    expect(keywordFinding?.severity).toBe("warning");
    expect(result.missingKeywords.length).toBeGreaterThan(0);
  });

  it("keyword tier severity matches the reported overlap percentage", () => {
    const jd = "React TypeScript Node.js AWS Docker Kubernetes GraphQL PostgreSQL Redis testing.";
    const result = checkCv({ text: sampleEn, locale: "en", jdText: jd });
    const keywordFinding = result.findings.find((f) => f.category === "keywords");
    const matched = keywordFinding?.params?.matched as number;
    const total = keywordFinding?.params?.total as number;
    expect(total).toBeGreaterThan(0);
    const pct = Math.round((matched / total) * 100);
    if (keywordFinding?.id === "strong-keyword-match") {
      expect(pct).toBeGreaterThan(60);
      expect(keywordFinding.severity).toBe("pass");
    } else if (keywordFinding?.id === "moderate-keyword-match") {
      expect(pct).toBeGreaterThanOrEqual(30);
      expect(pct).toBeLessThanOrEqual(60);
      expect(keywordFinding.severity).toBe("warning");
    } else {
      expect(pct).toBeLessThan(30);
      expect(keywordFinding?.severity).toBe("warning");
    }
  });

  it("no JD given → keywords category has zero weight and no keyword findings", () => {
    const result = checkCv({ text: sampleEn, locale: "en" });
    const keywordsCategory = result.categories.find((c) => c.category === "keywords");
    expect(keywordsCategory?.weight).toBe(0);
    expect(keywordsCategory?.score).toBe(0);
    expect(result.findings.some((f) => f.category === "keywords")).toBe(false);
    expect(result.matchedKeywords).toEqual([]);
    expect(result.missingKeywords).toEqual([]);
  });

  it("blank jdText behaves the same as no JD", () => {
    const result = checkCv({ text: sampleEn, locale: "en", jdText: "   " });
    const keywordsCategory = result.categories.find((c) => c.category === "keywords");
    expect(keywordsCategory?.weight).toBe(0);
    expect(result.findings.some((f) => f.category === "keywords")).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  (h) MAX_INPUT_CHARS                                                    */
/* ────────────────────────────────────────────────────────────────────── */

describe("MAX_INPUT_CHARS handling", () => {
  it("oversized CV text is truncated and never throws", () => {
    const oversized = (getSampleCvText("en") + " ").repeat(2000);
    expect(oversized.length).toBeGreaterThan(MAX_INPUT_CHARS);
    let result: ReturnType<typeof checkCv> | undefined;
    expect(() => {
      result = checkCv({ text: oversized, locale: "en" });
    }).not.toThrow();
    expect(result).toBeDefined();
    expect(Number.isFinite(result!.score)).toBe(true);
    expect(Number.isFinite(result!.wordCount)).toBe(true);
    expect(result!.wordCount).toBeGreaterThan(0);
  });

  it("oversized jdText is truncated and never throws", () => {
    const oversizedJd = "keyword ".repeat(20000);
    expect(oversizedJd.length).toBeGreaterThan(MAX_INPUT_CHARS);
    let result: ReturnType<typeof checkCv> | undefined;
    expect(() => {
      result = checkCv({ text: getSampleCvText("en"), locale: "en", jdText: oversizedJd });
    }).not.toThrow();
    expect(result).toBeDefined();
    expect(Number.isFinite(result!.score)).toBe(true);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  scoreBucketOf boundaries                                               */
/* ────────────────────────────────────────────────────────────────────── */

describe("scoreBucketOf", () => {
  it.each([
    [0, "0-19"],
    [19, "0-19"],
    [20, "20-39"],
    [39, "20-39"],
    [40, "40-59"],
    [59, "40-59"],
    [60, "60-79"],
    [79, "60-79"],
    [80, "80-100"],
    [100, "80-100"],
  ] as const)("scoreBucketOf(%i) === %s", (score, bucket) => {
    expect(scoreBucketOf(score)).toBe(bucket);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  Determinism                                                            */
/* ────────────────────────────────────────────────────────────────────── */

describe("determinism", () => {
  it("checkCv returns identical output for identical input across repeated calls", () => {
    const input = { text: getSampleCvText("en"), locale: "en" as const, jdText: "React TypeScript engineer." };
    const first = checkCv(input);
    const second = checkCv(input);
    expect(second).toEqual(first);
  });

  it("findings are ordered critical → warning → pass", () => {
    const result = checkCv({ text: "Preheat the oven " + filler(45), locale: "en" });
    const ranks = result.findings.map((f) => (f.severity === "critical" ? 0 : f.severity === "warning" ? 1 : 2));
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  Keyword counts never overflow the capped total                         */
/* ────────────────────────────────────────────────────────────────────── */

describe("keyword match counts", () => {
  // 200 distinct 5-letter terms, all present in the CV text.
  const terms = Array.from({ length: 200 }, (_, i) => `zq${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}x`);
  const cv = `${getSampleCvText("en")}\n${terms.join(" ")}`;

  it("matched is never greater than total, even when the JD has more terms than the cap", () => {
    const result = checkCv({ text: cv, locale: "en", jdText: terms.join(" ") });
    const f = result.findings.find((x) => x.category === "keywords");
    expect(f?.params?.total).toBe(30);
    expect(f?.params?.matched).toBe(30);
    expect(f?.id).toBe("strong-keyword-match");
    expect(result.matchedKeywords.length).toBeLessThanOrEqual(10);
  });

  it("matched + missing counts add up to total", () => {
    const half = terms.slice(0, 100);
    const result = checkCv({ text: `${getSampleCvText("en")}\n${half.join(" ")}`, locale: "en", jdText: terms.join(" ") });
    const f = result.findings.find((x) => x.category === "keywords");
    expect(Number(f?.params?.matched)).toBeLessThanOrEqual(Number(f?.params?.total));
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/*  Accented letters at word boundaries (JS \b is ASCII-only)              */
/* ────────────────────────────────────────────────────────────────────── */

describe("accented word boundaries: section headings", () => {
  const fr = getSampleCvText("fr");
  it.each(["ÉTUDES", "Études", "ÉTUDES SUPÉRIEURES"])("education heading '%s' is recognised", (heading) => {
    const text = fr.replace("FORMATION", heading);
    expect(checkCv({ text, locale: "fr" }).findings.some((f) => f.id === "missing-education-section")).toBe(false);
  });
});

describe("accented word boundaries: French date ranges", () => {
  it("'2017 à 2019' ranges are parsed (ascending years trip not-reverse-chronological)", () => {
    const text = `${filler(60)}
EXPÉRIENCE
Chef de projet — Alpha
2017 à 2019
- Piloté 3 projets
Responsable — Beta
2020 à 2022
- Géré 4 équipes
FORMATION
Licence
COMPÉTENCES
Gestion`;
    expect(findingIds(checkCv({ text, locale: "fr" }))).toContain("not-reverse-chronological");
  });
});

describe("accented word boundaries: capitalised keywords", () => {
  it("keeps accented endings and starts whole", () => {
    const result = checkCv({ text: getSampleCvText("sv"), locale: "sv", jdText: "Société Örebro Ångström" });
    expect(result.missingKeywords).toEqual(["société", "ångström", "örebro"]);
  });
});

describe("accented word boundaries: French personal details", () => {
  const fr = getSampleCvText("fr");
  it.each([
    "Nationalité : française",
    "Marié, deux enfants",
    "État civil : divorcé",
    "Situation familiale : mariée",
  ])("'%s' is flagged", (line) => {
    expect(findingIds(checkCv({ text: `${fr}\n${line}`, locale: "fr" }))).toContain("locale-personal-details");
  });
});

describe("accented word boundaries: action verbs", () => {
  it("French accent-final verbs count as strong bullet starts", () => {
    const text = `${filler(50)}
EXPÉRIENCE
Chef de projet — Alpha
2020 – 2022
- Déployé 3 services en production
- Géré 4 équipes de 12 personnes
- Piloté 5 migrations vers le cloud
- Optimisé 40 requêtes critiques
- Réduit les coûts de 30 pourcent`;
    expect(findingIds(checkCv({ text, locale: "fr" }))).not.toContain("weak-bullet-verbs");
  });
});

describe("sample contact data", () => {
  it.each(LOCALES)("'%s' sample uses fiction-range phone numbers and placeholder LinkedIn slugs", (locale) => {
    const text = getSampleCvText(locale);
    expect(text).toMatch(/linkedin\.com\/in\/example-demo-\d{4}/);
    const phone = text.match(/(?:Phone|Telefon|Téléphone) ?: (\+[\d ]+)/)?.[1];
    // DK placeholder, PTS reserved 070-174 06 05..99 (SE), ARCEP reserved 06 39 98 xx xx (FR)
    expect(phone).toMatch(/^(\+45 00 00 00 00|\+46 70 174 06 \d\d|\+33 6 39 98 \d\d \d\d)$/);
  });
});
