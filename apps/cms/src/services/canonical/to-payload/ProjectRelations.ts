/** Resolves the canonical ids a project references to the Payload relation ids it points at. */
export interface ProjectRelations {
  programIdByCanonicalId(canonicalId: string): number | undefined
  projectIdByCanonicalId(canonicalId: string): number | undefined
}
