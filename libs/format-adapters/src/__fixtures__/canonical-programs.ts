import { CanonicalProgramValidator, type CanonicalProgram } from '@tee-backoffice/canonical'

/**
 * Validated pivot programs, ready to project in export tests. Mirrors the
 * `@tee-backoffice/canonical` golden fixtures (minimal/full) plus an
 * unpublished variant to exercise the inclusion filters.
 */
const validator = new CanonicalProgramValidator()
const build = (input: unknown): CanonicalProgram => validator.parse(input)

const minimalInput = {
  id: 'tz4a98xxat96iws9zmbrgj3a',
  slug: 'aide-decarbonation-industrie',
  source: 'INTERNE',
  date_mise_a_jour: '2026-06-15T10:00:00+02:00',
  titre: 'Aide à la décarbonation',
  description: 'Une **aide** pour réduire vos émissions.',
  statut_edition: 'pret_prod',
  statut_dispositif: 'valide',
  types_aides: ['financement'],
  operateurs: { contact: { nom: 'ADEME' } },
}

const fullInput = {
  id: 'a1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'diagnostic-energie-pme',
  source: 'ADEME',
  date_mise_a_jour: '2026-03-19T17:00:00+01:00',
  titre: 'Diagnostic énergie PME',
  promesse: 'Réduisez votre facture énergétique',
  description: 'Un diagnostic financé pour les PME industrielles.',
  description_longue: 'Détail complet du dispositif et des conditions.',
  illustration: {
    url: 'https://entreprises.ademe.fr/img/diagnostic-energie.jpg',
    alt: 'Audit énergétique en usine',
  },
  meta: { titre: 'Diagnostic énergie', description: 'Aide au diagnostic énergétique' },
  statut_edition: 'pret_prod',
  statut_dispositif: 'valide',
  date_ouverture: '2026-01-01',
  date_cloture: '2026-12-31',
  types_aides: ['financement', 'formation'],
  montant: { type: 'montant du financement', valeur: 'Jusqu’à 70 % des dépenses' },
  duree: { type: 'durée de l’accompagnement', valeur: '8 jours de formation' },
  operateurs: {
    contact: { nom: 'Bpifrance', nom_normalise: 'BPIFRANCE', siren: '320252489' },
    autres: [{ nom: 'Région Bretagne' }],
  },
  contact_question: { type: 'email', valeur: 'contact@ademe.fr' },
  url_source: 'https://entreprises.ademe.fr/diagnostic',
  etapes_activation: [
    {
      description: 'Complétez le formulaire de candidature.',
      liens: [
        { texte: 'Inscription', url: 'https://example.org/inscription' },
        { conseiller_entreprise: true },
      ],
    },
  ],
  eligibilite: {
    effectif: { texte: ['Jusqu’à 250 salariés'], structure: { min: 0, max: 249 } },
    categorie_legale: { texte: ['Hors micro_entrepreneur'], structure: { interdit: ['micro_entrepreneur'] } },
    secteur_activite: { texte: ['Industrie'], structure: { inclusions: ['C'], exclusions: ['33.20'] } },
    secteur_geographique: { texte: ['France métropolitaine'], structure: { inclusions: ['PAYS-99100'], exclusions: ['REG-94'] } },
    anciennete: { texte: ['Plus de 2 ans d’existence'] },
    autres_criteres: { texte: ['Être à jour de ses cotisations sociales'] },
  },
  themes: ['energie', 'batiment'],
  variantes: [
    {
      conditions: { effectif: { min: 0, max: 49 }, regions: ['REG-53'] },
      modifications: {
        montant: { type: 'montant du financement', valeur: '5 400 € HT après subvention de 70 %' },
        eligibilite: { autres_criteres: { texte: ['CA < 10 M€'] } },
      },
      autres_champs: { titre_historique: 'Ancien intitulé du dispositif' },
    },
  ],
  autres_donnees: { ademe_id_dsp: 'DSP-000123', operateur_ref_interne: 'XYZ-42' },
}

/** Unpublished draft (edit status before `pret_prod`) — excluded from public exports. */
const draftInput = { ...minimalInput, slug: 'aide-en-creation', statut_edition: 'en_creation' }

/** Published but temporarily unavailable — exported to AGIR with a distinct etat/statut. */
const indisponibleInput = {
  ...minimalInput,
  slug: 'aide-temporairement-indisponible',
  statut_dispositif: 'temporairement_indisponible',
}

/** Published but archived — still transmitted to AGIR (etat en_prod, carried by date_cloture). */
const archivedInput = {
  ...minimalInput,
  slug: 'aide-archivee',
  statut_dispositif: 'archive',
  date_cloture: '2026-05-31',
}

/** The replacing program a `remplace` fixture points at (its cuid2 = remplace_par target). */
const remplacantInput = {
  ...minimalInput,
  id: 'b1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'aide-remplacante',
}

/** Published but replaced — transmitted to AGIR with statut 'remplace' + remplace_par (cuid2). */
const remplaceInput = {
  ...minimalInput,
  id: 'c1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'aide-remplacee',
  statut_dispositif: 'remplace',
  remplace_par: 'b1b2c3d4e5f6g7h8i9j0klmn',
}

export const minimalProgram = build(minimalInput)
export const fullProgram = build(fullInput)
export const draftProgram = build(draftInput)
export const indisponibleProgram = build(indisponibleInput)
export const archivedProgram = build(archivedInput)
export const remplacantProgram = build(remplacantInput)
export const remplaceProgram = build(remplaceInput)
