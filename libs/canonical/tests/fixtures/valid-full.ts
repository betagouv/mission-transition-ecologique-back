/**
 * Fully-populated valid canonical program — exercises every section, including
 * a `formation` type (which requires `duree`), variants, and open-key blocks.
 */
export const validFull: unknown = {
  // 1. Identity
  id: 'a1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'diagnostic-energie-pme',
  source: 'ADEME',
  date_mise_a_jour: '2026-03-19T17:00:00+01:00',

  // 2. Editorial content
  titre: 'Diagnostic énergie PME',
  promesse: 'Réduisez votre facture énergétique',
  description: 'Un diagnostic financé pour les PME industrielles.',
  description_longue: 'Détail complet du dispositif et des conditions.',
  illustration: {
    url: 'https://entreprises.ademe.fr/img/diagnostic-energie.jpg',
    alt: 'Audit énergétique en usine',
  },
  meta: {
    titre: 'Diagnostic énergie',
    description: 'Aide au diagnostic énergétique',
  },

  // 3. Structured facts
  statut_edition: 'pret_prod',
  statut_dispositif: 'valide',
  date_ouverture: '2026-01-01',
  date_cloture: '2026-12-31',
  types_aides: ['financement', 'formation'],
  montant: { type: 'montant du financement', valeur: 'Jusqu’à 70 % des dépenses' },
  duree: { type: 'durée de l’accompagnement', valeur: '8 jours de formation' },
  operateurs: {
    contact: {
      nom: 'Bpifrance',
      nom_normalise: 'BPIFRANCE',
      siren: '320252489',
    },
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

  // 4. Eligibility & targeting
  eligibilite: {
    effectif: {
      texte: ['Jusqu’à 250 salariés'],
      structure: { min: 0, max: 249 },
    },
    categorie_legale: {
      texte: ['Hors micro_entrepreneur'],
      structure: { interdit: ['micro_entrepreneur'] },
    },
    secteur_activite: {
      texte: ['Industrie'],
      structure: { inclusions: ['C'], exclusions: ['33.20'] },
    },
    secteur_geographique: {
      texte: ['France métropolitaine'],
      structure: { inclusions: ['PAYS-99100'], exclusions: ['REG-94'] },
    },
    anciennete: { texte: ['Plus de 2 ans d’existence'] },
    autres_criteres: { texte: ['Être à jour de ses cotisations sociales'] },
  },
  themes: ['energie', 'batiment'],

  // 5. Variants
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

  // 6. Other data
  autres_donnees: {
    ademe_id_dsp: 'DSP-000123',
    operateur_ref_interne: 'XYZ-42',
  },
};
