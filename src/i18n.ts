import en from "./locales/en.json" with { type: "json" };
import sv from "./locales/sv.json" with { type: "json" };
import fr from "./locales/fr.json" with { type: "json" };
import type {
  CvCheckCategory,
  CvCheckFinding,
  CvCheckFindingId,
  CvCheckLocale,
} from "./types.js";

interface LocaleMessages {
  categories: Record<CvCheckCategory, string>;
  findings: Record<CvCheckFindingId, { title: string; fix: string }>;
}

export const messages: Record<CvCheckLocale, LocaleMessages> = {
  en: en as LocaleMessages,
  sv: sv as LocaleMessages,
  fr: fr as LocaleMessages,
};

/** Replaces {name} placeholders with the matching param. Unknown ones stay as-is. */
function fill(template: string, params: CvCheckFinding["params"]): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole,
  );
}

/** Translated title and fix for a finding, with its params filled in. */
export function describeFinding(
  finding: CvCheckFinding,
  locale: CvCheckLocale,
): { title: string; fix: string } {
  const entry = messages[locale].findings[finding.id];
  return { title: fill(entry.title, finding.params), fix: fill(entry.fix, finding.params) };
}

/** Translated category label, e.g. "dates" -> "Datum" in Swedish. */
export function categoryLabel(category: CvCheckCategory, locale: CvCheckLocale): string {
  return messages[locale].categories[category];
}
