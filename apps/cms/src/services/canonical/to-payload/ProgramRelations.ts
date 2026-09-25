import type { ResolvedGeographic } from './GeographicAreaResolver'

/** Resolves canonical names and codes to the Payload relation ids a program points at. */
export interface ProgramRelations {
  operatorId(name: string): number | undefined
  /** Geographic area id for a COG code (`REG-11`, `DEP-40`…). */
  areaIdByCogCode(code: string): number | undefined
  /** Coverage and zones from free-text territory names. */
  resolveGeography(names: string[]): ResolvedGeographic
}
