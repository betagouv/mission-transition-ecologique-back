// Dispositifs de programs.json qui ne font PAS un aller-retour TEE bit-for-bit,
// pour une raison documentée. Exclus du test d'aller-retour.
//
// ⚠️ ÉPHÉMÈRE : disparaît avec docs/sources/programs.json (supprimer ce dossier).

/**
 * `champs conditionnels` non réimportés : `TeeImporter` ne reconstruit pas les
 * `variantes` du pivot (forme source ↔ exporter récupérable mais non gérée ici).
 */
export const CHAMPS_GAPS: readonly string[] = [
  'diag-ecoconception',
  'etude-geothermie-de-surface-et-d-aerothermie',
  'imprim-vert',
  'performa-environnement',
  'visite-energie',
  'credit-impot-innovation',
  'diag-biodiversite',
]

/** Tous les `id` exclus de l'aller-retour bit-for-bit. */
export const KNOWN_GAPS: ReadonlySet<string> = new Set(CHAMPS_GAPS)
