import type { CogCode } from '@tee-backoffice/canonical'

/**
 * Translates between the French territory names expected by
 * `eligibilityData.company.allowedRegion` (programs.json) and the pivot's
 * geographic COG inclusion codes.
 *
 * Covers regions (mainland + DROM, level `REG-`) and overseas collectivities
 * (level `OM-`). Other COG levels (department, commune…) are not translated
 * for this field.
 */
export class RegionNameResolver {
  private static readonly CODE_TO_NAME: Record<string, string> = {
    'REG-01': 'Guadeloupe',
    'REG-02': 'Martinique',
    'REG-03': 'Guyane',
    'REG-04': 'La Réunion',
    'REG-06': 'Mayotte',
    'REG-11': 'Île-de-France',
    'REG-24': 'Centre-Val de Loire',
    'REG-27': 'Bourgogne-Franche-Comté',
    'REG-28': 'Normandie',
    'REG-32': 'Hauts-de-France',
    'REG-44': 'Grand Est',
    'REG-52': 'Pays de la Loire',
    'REG-53': 'Bretagne',
    'REG-75': 'Nouvelle-Aquitaine',
    'REG-76': 'Occitanie',
    'REG-84': 'Auvergne-Rhône-Alpes',
    'REG-93': "Provence-Alpes-Côte d'Azur",
    'REG-94': 'Corse',
    // Overseas collectivities (INSEE codes), iso programs.json spelling.
    'OM-975': 'Saint-Pierre-Et-Miquelon',
    'OM-977': 'Saint-Barthélemy',
    'OM-978': 'Saint-Martin',
    'OM-984': 'Terres australes et antarctiques françaises',
    'OM-986': 'Wallis et Futuna',
    'OM-987': 'Polynésie française',
    'OM-988': 'Nouvelle-Calédonie',
  }

  // ⚠️ ONE-SHOT IMPORT (Baserow → Payload): the inverse table + codesOf below
  // exist only for the historical import. Delete with the import path after
  // migration — see README cleanup checklist.
  /** Inverse table (name → COG code), derived from {@link CODE_TO_NAME}. */
  private static readonly NAME_TO_CODE: Record<string, string> = Object.fromEntries(
    Object.entries(RegionNameResolver.CODE_TO_NAME).map(([code, name]) => [name, code]),
  )

  /** Territory names for the given COG codes (unsupported levels ignored). */
  static namesOf(codes: readonly CogCode[]): string[] {
    const names: string[] = []
    for (const code of codes) {
      const name = RegionNameResolver.CODE_TO_NAME[code]
      if (name) {
        names.push(name)
      }
    }
    return names
  }

  /** COG codes for the given territory names (unknown names ignored). */
  static codesOf(names: readonly string[]): string[] {
    const codes: string[] = []
    for (const name of names) {
      const code = RegionNameResolver.NAME_TO_CODE[name]
      if (code) {
        codes.push(code)
      }
    }
    return codes
  }
}
