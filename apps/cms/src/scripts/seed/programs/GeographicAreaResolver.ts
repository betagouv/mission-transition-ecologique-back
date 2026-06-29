import type { Payload } from 'payload'

export type GeographicCoverage = 'national' | 'regional' | 'departemental'

export interface ResolvedGeographic {
  geographicCoverage?: GeographicCoverage
  geographicAreas?: number[]
  geographicAreaFeedback?: string
}

/**
 * Sentinel value used in the source data to mean "whole national territory".
 */
const NATIONAL_SENTINEL = "France et territoires d'outre-mer"

/**
 * Maps the free-text `secteur géographique` of the source programs onto the
 * structured `geographicCoverage` + `geographicAreas` fields, reusing the
 * seeded `geographic-areas` collection.
 *
 *  - the national sentinel -> coverage `national`, no zones, no feedback
 *  - names matching known departments (but not regions) -> coverage
 *    `departemental` with the matching department ids
 *  - otherwise -> coverage `regional` with the matching region ids
 *
 * Any name that cannot be matched is reported back in `geographicAreaFeedback`
 * so an admin can later create the missing zone.
 */
export class GeographicAreaResolver {
  private constructor(
    private readonly regionIdByName: Map<string, number>,
    private readonly departementIdByName: Map<string, number>,
  ) {}

  static async fromPayload(payload: Payload): Promise<GeographicAreaResolver> {
    const result = await payload.find({
      collection: 'geographic-areas',
      limit: 0,
      depth: 0,
    })

    const regionIdByName = new Map<string, number>()
    const departementIdByName = new Map<string, number>()
    for (const area of result.docs) {
      const key = GeographicAreaResolver.normalizeName(area.name)
      if (area.coverageType === 'region') regionIdByName.set(key, area.id)
      else if (area.coverageType === 'departement')
        departementIdByName.set(key, area.id)
    }

    return new GeographicAreaResolver(regionIdByName, departementIdByName)
  }

  /**
   * Normalizes an area name so the source `secteur géographique` matches the
   * seeded zones despite typographic variants (letter case, hyphens vs spaces).
   * Example: "Saint-Pierre-Et-Miquelon" and "Wallis et Futuna" both match the
   * official labels "Saint-Pierre-et-Miquelon" and "Wallis-et-Futuna".
   */
  private static normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, ' ')
  }

  resolve(secteurGeographique: string[] | undefined): ResolvedGeographic {
    const names = (secteurGeographique ?? [])
      .flatMap((value) => value.split(',').map((name) => name.trim()))
      .filter(Boolean)

    if (names.length === 0) return {}

    if (names.some((name) => name === NATIONAL_SENTINEL)) {
      return { geographicCoverage: 'national', geographicAreas: [] }
    }

    const isDepartemental = names.some((name) => {
      const key = GeographicAreaResolver.normalizeName(name)
      return this.departementIdByName.has(key) && !this.regionIdByName.has(key)
    })
    const lookup = isDepartemental
      ? this.departementIdByName
      : this.regionIdByName

    const geographicAreas: number[] = []
    const unmatched: string[] = []
    for (const name of names) {
      const id = lookup.get(GeographicAreaResolver.normalizeName(name))
      if (id !== undefined) geographicAreas.push(id)
      else unmatched.push(name)
    }

    return {
      geographicCoverage: isDepartemental ? 'departemental' : 'regional',
      geographicAreas,
      geographicAreaFeedback:
        unmatched.length > 0 ? unmatched.join(', ') : undefined,
    }
  }
}
