import { z } from 'zod'

/**
 * Dictionnaire **unique** des niveaux COG (Code Officiel Géographique) du projet.
 * Source de vérité partagée : tout le monde dans le projet préfixe ses codes
 * géographiques avec un de ces niveaux, jamais un code « nu ».
 *
 * Pourquoi un préfixe ? Le code seul n'est pas une clé : `53` = région Bretagne
 * **OU** département Mayenne. Le préfixe est le discriminateur de niveau — il
 * lève la collision et reflète la structure officielle INSEE / geo.api.gouv.fr,
 * où la clé est toujours le couple `(niveau, code)`, jamais le code seul.
 *
 * ⚠️ Pièges de nommage à connaître :
 * - `COM` = **Commune** (code à 5 caractères). Les collectivités d'outre-mer
 *   ont leur **propre** niveau `OM` — ne pas réutiliser `COM` pour elles.
 * - `EPCI` sert aussi pour les collectivités à statut particulier qui portent un
 *   SIREN (ex. Métropole de Lyon `EPCI-200046977`).
 */
export const COG_NIVEAUX = {
  PAYS: {
    label: 'Pays',
    description: 'Pays ou territoire étranger (nomenclature INSEE 99xxx).',
    exemple: 'PAYS-99100', // France
  },
  REG: {
    label: 'Région',
    description: 'Région — 2 chiffres, DROM inclus (01–06).',
    exemple: 'REG-53', // Bretagne
  },
  DEP: {
    label: 'Département',
    description: 'Département : métropole (01–95), Corse (2A/2B), DROM (971–976), CTCD (69M/69D).',
    exemple: 'DEP-2A', // Corse-du-Sud
  },
  ARR: {
    label: 'Arrondissement départemental',
    description:
      "Arrondissement (sous-préfecture) : code département + 1 chiffre. À ne pas confondre avec l'arrondissement municipal de Paris/Lyon/Marseille, qui relève de COM.",
    exemple: 'ARR-382', // département 38 (Isère), 2ᵉ arrondissement
  },
  CAN: {
    label: 'Canton',
    description: 'Canton : code département + 2 chiffres (découpage 2015).',
    exemple: 'CAN-7601', // département 76 (Seine-Maritime), canton 01
  },
  COM: {
    label: 'Commune',
    description: 'Commune — code à 5 caractères (ex. 75056, 2A004).',
    exemple: 'COM-75056', // Paris
  },
  OM: {
    label: "Collectivité d'outre-mer",
    description: "Collectivité / territoire d'outre-mer (975, 977, 978, 984, 986, 987, 988, 989).",
    exemple: 'OM-988', // Nouvelle-Calédonie
  },
  EPCI: {
    label: 'EPCI / intercommunalité',
    description: 'Intercommunalité (ou collectivité à statut particulier) identifiée par son SIREN.',
    exemple: 'EPCI-200046977', // Métropole de Lyon
  },
} as const

/** Niveau COG — clé du dictionnaire `COG_NIVEAUX`. */
export type CogNiveau = keyof typeof COG_NIVEAUX

/** Préfixes autorisés — dérivés du dictionnaire, jamais redéclarés ailleurs. */
export const COG_PREFIXES = Object.keys(COG_NIVEAUX) as CogNiveau[]

/**
 * Code COG = `NIVEAU-code`. Garde de forme **volontairement souple** : un
 * préfixe connu + un corps alphanumérique non vide. Elle accepte sans broncher
 * les cas irréguliers (Corse `DEP-2A`, Métropole de Lyon `DEP-69M`, SIREN
 * `EPCI-200046977`, codes outre-mer…) — c'est voulu.
 *
 * Ce qu'elle **ne fait pas** : valider l'existence réelle d'un code, ni le
 * format exact par niveau. Le COG est trop irrégulier (lettres, codes réutilisés,
 * nouveaux millésimes chaque année) pour qu'une regex fasse autorité.
 * L'existence se vérifie contre le référentiel INSEE / `GeographicAreas`
 * (hors périmètre du paquet canonical), keyé par le couple `(niveau, code)`.
 */
const cogCodePattern = new RegExp(`^(${COG_PREFIXES.join('|')})-[0-9A-Z]+$`)

export const cogCodeSchema = z
  .string()
  .regex(cogCodePattern, 'code COG invalide (ex: REG-53, DEP-2A, OM-988)')
  .brand<'CogCode'>()
export type CogCode = z.infer<typeof cogCodeSchema>
