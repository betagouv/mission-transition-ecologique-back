import { CanonicalProjectValidator, type CanonicalProject } from '@tee-backoffice/canonical'

/**
 * Validated pivot projects, ready to project in export tests. Mirrors the
 * `@tee-backoffice/canonical` golden fixtures (minimal/full) plus a redirect
 * tombstone. `fullProject` points at `fullProgram` and `minimalProgram` of
 * `canonical-programs.ts`, and at `minimalProject`.
 */
const validator = new CanonicalProjectValidator()
const build = (input: unknown): CanonicalProject => validator.parse(input)

const minimalInput = {
  id: 'p1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'isolation-thermique',
  source: 'INTERNE',
  date_mise_a_jour: '2026-06-15T10:00:00+02:00',
  statut_projet: 'valide',
  titre: 'Isoler mon bâtiment',
  nom_court: 'Isolation',
  description_courte: 'Réduire les pertes de chaleur de vos locaux.',
  description_longue: { contenu: 'Une **isolation** performante réduit la facture.' },
  theme_principal: 'batiment',
}

const fullInput = {
  id: 'q1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'plan-action-eco-energie',
  source: 'INTERNE',
  date_mise_a_jour: '2026-03-19T17:00:00+01:00',
  statut_projet: 'valide',

  titre: 'Mettre en place un plan d’action éco-énergie',
  nom_court: 'Plan éco-énergie',
  description_courte: 'Réduire durablement vos consommations d’énergie.',
  image: {
    url: 'https://cdn.example.org/media/plan-eco-energie.webp',
    chemin_source: '/images/projet/plan-eco-energie.webp',
  },
  description_longue: {
    titre: 'Pourquoi agir ?',
    contenu: 'Un plan d’action structure vos **économies d’énergie**.',
  },
  description_complementaire: {
    titre: 'Pour aller plus loin',
    contenu: 'Suivez vos consommations dans la durée.',
  },

  theme_principal: 'energie',
  themes: ['energie', 'ecoconception', 'biodiversite'],
  secteurs: ['C', 'I'],
  priorite: {
    defaut: 3,
    mise_en_avant: 1,
    par_secteur: [
      { code_naf: 'C', priorite: 1 },
      { code_naf: '55.3', priorite: 2 },
    ],
  },

  dispositifs: ['a1b2c3d4e5f6g7h8i9j0klmn', 'tz4a98xxat96iws9zmbrgj3a'],
  projets_lies: {
    titre: 'Projets complémentaires',
    description: 'Ces projets prolongent votre démarche.',
    projets: ['p1b2c3d4e5f6g7h8i9j0klmn'],
  },
  faq: {
    titre: 'Questions fréquentes',
    questions: [
      { question: 'Par où commencer ?', reponse: 'Par un **diagnostic** de vos consommations.' },
      { question: 'Combien de temps faut-il ?', reponse: 'Quelques semaines.' },
    ],
  },
  seo: {
    titre: 'Plan d’action éco-énergie',
    description: 'Mettre en place un plan d’action pour réduire sa consommation d’énergie.',
  },
}

/** Redirect tombstone: former non kebab-case slug, content cloned from the project it points at. */
const replacedInput = {
  ...minimalInput,
  id: 'r1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'isolation-thermique-renforcée',
  statut_projet: 'remplace',
  remplace_par: 'p1b2c3d4e5f6g7h8i9j0klmn',
}

export const minimalProject = build(minimalInput)
export const fullProject = build(fullInput)
export const replacedProject = build(replacedInput)
