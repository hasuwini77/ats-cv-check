// Plain-text sample CVs (EN/SV/FR) used by the demo and the tests. Each one
// scores 70+ with zero critical findings.

import type { CvCheckLocale } from "./types.js";

const SAMPLE_EN = `JOHN DOE
Senior Product Designer

Email: john.doe@example.com
Phone: +45 20 12 34 56
LinkedIn: linkedin.com/in/johndoe-demo
Location: Copenhagen, Denmark

SUMMARY
Senior product designer with 6 years shipping data-intensive dashboards for B2B SaaS products used by millions of operational users. Led a design-system working group and partnered with engineering on cross-functional features end-to-end, from early research through launch and post-launch measurement. Comfortable owning a problem from early discovery through shipped, measured impact, and known for pairing strong systems thinking with a bias toward action.

EXPERIENCE

Senior Product Designer — Kestrel Logistics
March 2023 – Present
- Redesigned the route-planning dashboard used by 2.4 million drivers and dispatchers across 14 countries, cutting time-to-first-route by 38%.
- Built and maintained the internal design system, leading a weekly working group with 4 designers and 6 engineers.
- Introduced component-level accessibility testing into the team workflow, shipping WCAG AA across 90% of the product surface.
- Partnered with a principal PM and staff engineer to ship 12 cross-functional features in 18 months.
- Established a quarterly design-critique format adopted by 3 other product teams, raising review throughput by 25%.

Product Designer — Ember Analytics
January 2020 – February 2023
- Designed dense tabular interfaces for financial analysts, reducing support tickets on the reporting surface by 52% in two quarters.
- Owned the charting-library design guidelines and partnered with engineering on a Canvas-based renderer for large datasets.
- Ran a research program with 40+ analysts to map daily workflows, shaping three quarters of the product roadmap.
- Trained 5 junior designers on the team's critique process and design-system contribution model.

Junior Designer — Skylight Studio
June 2018 – December 2019
- Designed marketing sites and early-stage SaaS dashboards for 6 seed-stage B2B clients.
- Built the studio's first reusable component library, adopted across 12 client projects.

EDUCATION

BA in Interaction Design — Malmö University
August 2014 – June 2018

SKILLS
Design systems, B2B SaaS, data visualisation, accessibility (WCAG AA), Figma, prototyping, cross-functional collaboration, user research, design critique, Canvas rendering, information architecture, motion design, workshop facilitation, stakeholder communication.

LANGUAGES
English (fluent), Danish (native), German (conversational).`;

const SAMPLE_SV = `JOHAN ANDERSSON
Senior Produktdesigner

E-post: johan.andersson@example.com
Telefon: +46 70 123 45 67
LinkedIn: linkedin.com/in/johan-demo
Ort: Stockholm, Sverige

SAMMANFATTNING
Senior produktdesigner med 6 års erfarenhet av dataintensiva dashboards för B2B SaaS-produkter som används av miljontals operativa användare. Ledde designsystem-arbetsgruppen på senaste företaget och samarbetade med ingenjörer kring tvärfunktionella funktioner, från tidig research till lansering och uppföljande mätning. Van att äga ett problem från tidig upptäckt till levererad, mätbar effekt, och känd för att kombinera starkt systemtänkande med handlingskraft.

ERFARENHET

Senior Produktdesigner — Kestrel Logistics
mars 2023 – nu
- Designade om rutplaneringsdashboarden som används av 2,4 miljoner chaufförer och dispatchers i 14 länder, minskade time-to-first-route med 38 procent.
- Byggde och underhöll det interna designsystemet, ledde en veckovis arbetsgrupp med 4 designers och 6 ingenjörer.
- Införde tillgänglighetstester på komponentnivå i teamets arbetsflöde, levererade WCAG AA över 90 procent av produktytan.
- Samarbetade med en principal PM och en senior ingenjör för att leverera 12 tvärfunktionella funktioner på 18 månader.
- Etablerade ett kvartalsvist designgranskningsformat som togs upp av 3 andra produktteam, ökade granskningstakten med 25 procent.

Produktdesigner — Ember Analytics
januari 2020 – februari 2023
- Designade täta tabellgränssnitt för finansanalytiker, minskade supportärenden på rapporteringsytan med 52 procent på två kvartal.
- Ägde designriktlinjerna för diagrambiblioteket och samarbetade med ingenjörer om en Canvas-baserad renderare för stora dataset.
- Drev ett forskningsprogram med 40+ analytiker för att kartlägga dagliga arbetsflöden, formade tre kvartal av produktens roadmap.
- Utbildade 5 juniora designers i teamets granskningsprocess och designsystemets bidragsmodell.
- Genomförde en tillgänglighetsrevision av rapporteringsytan och åtgärdade 32 kontrastfel innan release.

Juniordesigner — Skylight Studio
juni 2018 – december 2019
- Designade marknadssidor och tidiga SaaS-dashboards för 6 seed-stage B2B-kunder.
- Byggde studions första återanvändbara komponentbibliotek, använt i 12 kundprojekt.

UTBILDNING

Kandidatexamen i interaktionsdesign — Malmö universitet
augusti 2014 – juni 2018

KOMPETENS
Designsystem, B2B SaaS, datavisualisering, tillgänglighet (WCAG AA), Figma, prototyping, tvärfunktionellt samarbete, användarforskning, designgranskning, Canvas-rendering, informationsarkitektur, rörelsedesign, workshopfacilitering, intressentkommunikation.

SPRÅK
Svenska (modersmål), engelska (flytande), tyska (samtalsnivå).`;

const SAMPLE_FR = `JEAN MARTIN
Designer Produit Senior

E-mail : jean.martin@example.com
Téléphone : +33 6 12 34 56 78
LinkedIn : linkedin.com/in/jean-demo
Lieu : Paris, France

RÉSUMÉ
Designer produit senior avec 6 ans d'expérience à livrer des tableaux de bord intensifs en données pour des produits B2B SaaS. A animé le groupe de travail hebdomadaire sur le design system et collaboré avec l'ingénierie sur des fonctionnalités transverses, de la recherche jusqu'au lancement. À l'aise pour porter un problème depuis la découverte initiale jusqu'à un impact livré et mesuré.

EXPÉRIENCE

Designer Produit Senior — Kestrel Logistics
mars 2023 – aujourd'hui
- Refonte du tableau de bord de planification d'itinéraires utilisé par 2,4 millions de chauffeurs et dispatcheurs dans 14 pays, réduction du time-to-first-route de 38 pourcent.
- Construit et maintenu le design system interne, animé un groupe de travail hebdomadaire avec 4 designers et 6 ingénieurs.
- Déployé des tests d'accessibilité au niveau des composants dans le workflow de l'équipe, livré WCAG AA sur 90 pourcent de la surface produit.
- Collaboré avec un PM principal et un ingénieur staff pour livrer 12 fonctionnalités transverses en 18 mois.

Designer Produit — Ember Analytics
janvier 2020 – février 2023
- Conçu des interfaces tabulaires denses pour analystes financiers, réduit les tickets support sur la surface reporting de 52 pourcent en deux trimestres.
- Géré les guidelines design de la bibliothèque de graphiques et collaboré avec l'ingénierie sur un moteur de rendu Canvas pour gros datasets.
- Piloté un programme de recherche avec 40+ analystes pour cartographier les workflows quotidiens, façonné trois trimestres de roadmap produit.
- Formé 5 designers juniors au processus de critique de l'équipe et au modèle de contribution au design system.

Designer Junior — Skylight Studio
juin 2018 – décembre 2019
- Conçu des sites marketing et des dashboards SaaS early-stage pour 6 clients B2B en seed.
- Construit la première bibliothèque de composants réutilisable du studio, utilisée sur 12 projets clients.

FORMATION

Licence en Design d'Interaction — Université de Malmö
août 2014 – juin 2018

COMPÉTENCES
Design systems, B2B SaaS, visualisation de données, accessibilité (WCAG AA), Figma, prototypage, collaboration transverse, recherche utilisateur, critique de design, rendu Canvas, architecture de l'information, design de mouvement.`;

const SAMPLES: Record<CvCheckLocale, string> = {
  en: SAMPLE_EN,
  sv: SAMPLE_SV,
  fr: SAMPLE_FR,
};

export function getSampleCvText(locale: CvCheckLocale): string {
  return SAMPLES[locale] ?? SAMPLE_EN;
}
