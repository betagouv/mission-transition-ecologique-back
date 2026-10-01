/** Fully-populated valid canonical project: exercises every optional block. */
export const projectValidFull: unknown = {
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
  themes: ['energie', 'batiment'],
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
