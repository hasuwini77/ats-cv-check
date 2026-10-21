import {
  CV_CHECK_CATEGORIES,
  categoryLabel,
  checkCv,
  describeFinding,
  getSampleCvText,
  MAX_INPUT_CHARS,
  type CvCheckLocale,
  type CvCheckResult,
} from "../../src/index.js";

const UI: Record<
  CvCheckLocale,
  {
    lead: string;
    cv: string;
    jd: string;
    sample: string;
    check: string;
    score: string;
    categories: string;
    findings: string;
    matched: string;
    missing: string;
    words: string;
    pages: string;
    noJd: string;
    hosted: string;
  }
> = {
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
    hosted: "Hosted version (same engine, with file upload)",
  },
  sv: {
    lead: "Klistra in ett CV och få ett betyg av 100. Allt körs på den här sidan. Ingenting skickas någonstans.",
    cv: "Ditt CV (ren text)",
    jd: "Jobbannons (valfritt, aktiverar nyckelordsmatchning)",
    sample: "Använd ett exempel",
    check: "Granska CV",
    score: "Poäng",
    categories: "Kategorier",
    findings: "Resultat",
    matched: "Matchade nyckelord",
    missing: "Saknade nyckelord",
    words: "ord",
    pages: "sidor",
    noJd: "Nyckelordsmatchning är avstängd tills du klistrar in en jobbannons.",
    hosted: "Hostad version (samma motor, med filuppladdning)",
  },
  fr: {
    lead: "Collez un CV et obtenez une note sur 100. Tout s'exécute dans cette page. Rien n'est envoyé.",
    cv: "Votre CV (texte brut)",
    jd: "Offre d'emploi (facultatif, active la correspondance de mots-clés)",
    sample: "Utiliser un exemple",
    check: "Analyser le CV",
    score: "Score",
    categories: "Catégories",
    findings: "Résultats",
    matched: "Mots-clés trouvés",
    missing: "Mots-clés manquants",
    words: "mots",
    pages: "pages",
    noJd: "La correspondance de mots-clés est désactivée tant qu'aucune offre n'est collée.",
    hosted: "Version hébergée (même moteur, avec import de fichier)",
  },
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let locale: CvCheckLocale = "en";
let last: CvCheckResult | null = null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function applyStaticText(): void {
  const t = UI[locale];
  document.documentElement.lang = locale;
  $("lead").textContent = t.lead;
  $("cv-label").textContent = t.cv;
  $("jd-label").textContent = t.jd;
  $("sample").textContent = t.sample;
  $("check").textContent = t.check;
  $("hosted-link").textContent = t.hosted;
  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-locale]")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.locale === locale));
  }
}

function render(): void {
  const out = $("results");
  out.replaceChildren();
  if (!last) return;
  const t = UI[locale];
  const result = last;

  const head = el("div", "score-row");
  head.append(el("div", "score", String(result.score)), el("div", "score-label", `${t.score} / 100`));
  out.append(head);
  out.append(el("p", "muted", `${result.wordCount} ${t.words} · ${t.pages}: ~${result.estimatedPages}`));

  out.append(el("h2", "", t.categories));
  const bars = el("ul", "bars");
  for (const cat of CV_CHECK_CATEGORIES) {
    const entry = result.categories.find((c) => c.category === cat);
    if (!entry) continue;
    const off = entry.weight === 0;
    const li = el("li");
    li.append(el("span", "bar-name", categoryLabel(cat, locale)));
    const track = el("span", "track");
    const fill = el("span", "fill");
    fill.style.width = off ? "0%" : `${entry.score}%`;
    track.append(fill);
    li.append(track, el("span", "bar-value", off ? "–" : String(entry.score)));
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
      [t.missing, result.missingKeywords],
    ] as const) {
      out.append(el("h2", "", label));
      const chips = el("ul", "chips");
      for (const w of words) chips.append(el("li", "", w));
      out.append(chips);
    }
  }
}

function run(): void {
  const text = $<HTMLTextAreaElement>("cv").value.slice(0, MAX_INPUT_CHARS);
  const jdText = $<HTMLTextAreaElement>("jd").value.slice(0, MAX_INPUT_CHARS);
  last = checkCv({ text, locale, ...(jdText.trim() ? { jdText } : {}) });
  render();
}

for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-locale]")) {
  btn.addEventListener("click", () => {
    locale = btn.dataset.locale as CvCheckLocale;
    applyStaticText();
    if (last) run();
  });
}
$("sample").addEventListener("click", () => {
  $<HTMLTextAreaElement>("cv").value = getSampleCvText(locale);
  run();
});
$("check").addEventListener("click", run);

applyStaticText();
