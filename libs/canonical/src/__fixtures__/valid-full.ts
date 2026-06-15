/**
 * Fully-populated valid canonical program — exercises every section, including
 * a `formation` type (which requires `duree`), variants, and open-key blocks.
 */
export const validFull: unknown = {
  // 1. Identité
  id: 'a1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'diagnostic-energie-pme',
  source: 'ADEME',
  date_mise_a_jour: '2026-03-19T17:00:00+01:00',

  // 2. Contenu éditorial
  titre: 'Diagnostic énergie PME',
  promesse: 'Réduisez votre facture énergétique',
  description: 'Un diagnostic financé pour les PME industrielles.',
  description_longue: 'Détail complet du dispositif et des conditions.',
  meta: { titre: 'Diagnostic énergie', description: 'Aide au diagnostic énergétique' },

  // 3. Faits structurés
  statut: 'actif',
  date_ouverture: '2026-01-01',
  date_cloture: '2026-12-31',
  types_aides: ['financement', 'formation'],
  montant: 'Jusqu’à 70 % des dépenses',
  duree: '8 jours de formation',
  activable_en_autonomie: false,
  operateurs: {
    contact: { nom: 'Bpifrance', nom_normalise: 'BPIFRANCE', siren: '320252489' },
    autres: [{ nom: 'Région Bretagne' }],
  },
  contact_question: { type: 'email', valeur: 'contact@ademe.fr' },
  url_source: 'https://entreprises.ademe.fr/diagnostic',
  etapes_activation: [
    {
      description: 'Complétez le formulaire de candidature.',
      liens: [{ texte: 'Inscription', url: 'https://example.org/inscription' }, { formulaire: true }],
    },
  ],

  // 4. Éligibilité & ciblage
  eligibilite: {
    effectif: { texte: ['Jusqu’à 250 salariés'], structure: { intervalles: [{ min: 0, max: 249 }] } },
    categorie_legale: { texte: ['Hors micro-entrepreneurs'], structure: { microentrepreneur_exclu: true } },
    secteur_activite: { texte: ['Industrie'], structure: { inclusions: ['C'], exclusions: ['33.20'] } },
    secteur_geographique: {
      texte: ['France métropolitaine'],
      structure: { inclusions: ['PAYS-99100'], exclusions: ['REG-94'] },
    },
    anciennete: { texte: ['Plus de 2 ans d’existence'] },
    autres_criteres: { texte: ['Être à jour de ses cotisations sociales'] },
  },
  themes: ['energie', 'batiment'],

  // 5. Variantes
  variantes: [
    {
      conditions: { effectif: { min: 0, max: 49 }, regions: ['REG-53'] },
      modifications: {
        montant: '5 400 € HT après subvention de 70 %',
        eligibilite: { autres_criteres: { texte: ['CA < 10 M€'] } },
      },
      autres_champs: { titre_historique: 'Ancien intitulé du dispositif' },
    },
  ],

  // 6. Autres données
  autres_donnees: { ademe_id_dsp: 'DSP-000123', operateur_ref_interne: 'XYZ-42' },
}
