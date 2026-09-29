import { COG_FRANCE } from '@tee-backoffice/canonical'
import { DepartmentNameResolver } from './DepartmentNameResolver'
import { RegionNameResolver } from './RegionNameResolver'

/**
 * Translates between the territory names of upstream `programs.json` (regions,
 * overseas collectivities, departments, the national wording) and COG codes, so
 * the pivot carries codes and no consumer has to read the upstream names.
 *
 * A name shared by a region and a department (overseas departments) resolves to
 * the region, which is what upstream means by it.
 */
export class TerritoryNameResolver {
  /** Upstream wording for "the whole national territory". */
  static readonly NATIONAL_NAME = "France et territoires d'outre-mer"
  static readonly NATIONAL_CODE = COG_FRANCE

  static isNational(name: string): boolean {
    return name.trim() === TerritoryNameResolver.NATIONAL_NAME
  }

  /** COG codes for the given names; names matching no territory are left out. */
  static codesOf(names: readonly string[]): string[] {
    return names.flatMap((name) => TerritoryNameResolver.codeOf(name) ?? [])
  }

  /** Names matching no territory, to report what `codesOf` leaves out. */
  static unknownNames(names: readonly string[]): string[] {
    return names.filter((name) => TerritoryNameResolver.codeOf(name) === undefined)
  }

  /** Territory names for the given codes, in order; the national code has none. */
  static namesOf(codes: readonly string[]): string[] {
    return codes.flatMap((code) => [...RegionNameResolver.namesOf([code]), ...DepartmentNameResolver.namesOf([code])])
  }

  private static codeOf(name: string): string | undefined {
    const trimmed = name.trim()
    if (TerritoryNameResolver.isNational(trimmed)) return TerritoryNameResolver.NATIONAL_CODE
    return RegionNameResolver.codesOf([trimmed])[0] ?? DepartmentNameResolver.codeOf(trimmed)
  }
}
