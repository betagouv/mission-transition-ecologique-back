/** A geographic area of the CMS, as a program relation points at it. */
export interface ProgramArea {
  id: number
  name: string
}

/** Resolves canonical names and codes to the Payload relation ids a program points at. */
export interface ProgramRelations {
  operatorId(name: string): number | undefined
  /** Geographic area for a COG code (`REG-11`, `DEP-40`…). */
  areaByCogCode(code: string): ProgramArea | undefined
}
