/**
 * Smallest valid canonical project: required fields only.
 * Typed as `unknown` so tests feed it through the validator like real input.
 */
export const projectValidMinimal: unknown = {
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
