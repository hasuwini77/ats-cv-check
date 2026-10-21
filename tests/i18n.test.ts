import { describe, expect, it } from "vitest";
import { categoryLabel, describeFinding, messages } from "../src/i18n.js";
import { checkCv } from "../src/check.js";
import { getSampleCvText } from "../src/samples.js";
import { CV_CHECK_CATEGORIES, CV_CHECK_FINDING_IDS, type CvCheckLocale } from "../src/types.js";

const LOCALES: CvCheckLocale[] = ["en", "sv", "fr"];

describe("locale files", () => {
  it.each(LOCALES)("%s has a title and fix for every finding id", (locale) => {
    for (const id of CV_CHECK_FINDING_IDS) {
      const entry = messages[locale].findings[id];
      expect(entry?.title, `${locale}:${id}.title`).toBeTruthy();
      expect(entry?.fix, `${locale}:${id}.fix`).toBeTruthy();
    }
    expect(Object.keys(messages[locale].findings).sort()).toEqual([...CV_CHECK_FINDING_IDS].sort());
  });

  it.each(LOCALES)("%s has a label for every category", (locale) => {
    for (const c of CV_CHECK_CATEGORIES) expect(categoryLabel(c, locale)).toBeTruthy();
  });

  it("uses the same placeholders in every locale", () => {
    const names = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const id of CV_CHECK_FINDING_IDS) {
      const en = messages.en.findings[id];
      for (const locale of ["sv", "fr"] as const) {
        const other = messages[locale].findings[id];
        expect(names(other.title + other.fix), `${locale}:${id}`).toEqual(names(en.title + en.fix));
      }
    }
  });
});

describe("package wording", () => {
  it.each(LOCALES)("%s not-enough-text fix does not talk about uploads", (locale) => {
    const { fix } = messages[locale].findings["not-enough-text"];
    expect(fix).not.toMatch(/upload|uppladd|ladda upp|import/i);
  });
});

describe("describeFinding", () => {
  it("fills placeholders from params", () => {
    const text = describeFinding(
      { id: "low-keyword-match", category: "keywords", severity: "warning", params: { matched: 3, total: 12 } },
      "fr",
    );
    expect(text.title).toBe("Correspondance de mots-clés faible — 3 sur 12 termes trouvés");
  });

  it("leaves no raw placeholders for any finding the engine produces", () => {
    const jd = "React TypeScript design systems accessibility Figma research prototyping";
    for (const locale of LOCALES) {
      const results = [
        checkCv({ text: getSampleCvText(locale), locale, jdText: jd }),
        checkCv({ text: "word ".repeat(1500), locale }),
        checkCv({ text: "- helped with things\n".repeat(60), locale }),
      ];
      for (const r of results) {
        for (const f of r.findings) {
          const { title, fix } = describeFinding(f, locale);
          expect(title + fix, `${locale}:${f.id}`).not.toMatch(/\{\w+\}/);
        }
      }
    }
  });
});
