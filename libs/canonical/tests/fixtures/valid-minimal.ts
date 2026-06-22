/**
 * Smallest valid canonical program — required fields only.
 * Typed as `unknown` so tests feed it through the validator like real input.
 */
export const validMinimal: unknown = {
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
