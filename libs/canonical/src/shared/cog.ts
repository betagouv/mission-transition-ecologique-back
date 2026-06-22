// Single dictionary of COG (Code Officiel Géographique) levels. Every geographic
// code is prefixed with one of these levels, never bare: a bare code is ambiguous
// (`53` = région Bretagne OR département Mayenne). The prefix is the level
// discriminator, matching INSEE / geo.api.gouv.fr where the key is the
// (level, code) pair.
//
// Naming traps:
// - `COM` = Commune (5-char code); overseas collectivities use their own `OM` level.
// - `EPCI` also covers special-status collectivities carrying a SIREN (e.g. Métropole de Lyon).
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

/** COG level — key of `COG_NIVEAUX`. */
export type CogNiveau = keyof typeof COG_NIVEAUX

/** Allowed prefixes, derived from the dictionary. */
export const COG_PREFIXES = Object.keys(COG_NIVEAUX) as CogNiveau[]
