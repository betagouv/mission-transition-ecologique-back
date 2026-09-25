import type { CanonicalProgram } from '../CanonicalProgram'
import type { CanonicalProgramChanges, CanonicalProgramKey } from '../CanonicalProgramRepository'

/**
 * Diff between the stored rows and a full upstream snapshot. Pure: it only
 * decides, the service applies. Every stored row falls in exactly one bucket:
 * - updated: same canonical id upstream, upserted;
 * - superseded: same slug upstream under another canonical id (e.g. a row the CMS
 *   wrote with a random id), deleted so the upstream row can take the slug;
 * - kept: its upstream record is invalid, left untouched rather than lost;
 * - removed: gone from the upstream snapshot, deleted.
 */
export class CanonicalSnapshotPlan {
  readonly superseded: CanonicalProgramKey[] = []
  readonly kept: CanonicalProgramKey[] = []
  readonly removed: CanonicalProgramKey[] = []

  constructor(
    readonly existing: CanonicalProgramKey[],
    readonly valid: CanonicalProgram[],
    invalidSlugs: ReadonlySet<string>,
  ) {
    const validIds = new Set<string>(valid.map((program) => program.id))
    const validSlugs = new Set<string>(valid.map((program) => program.slug))

    for (const key of existing) {
      if (validIds.has(key.canonicalId)) continue
      if (validSlugs.has(key.slug)) this.superseded.push(key)
      else if (invalidSlugs.has(key.slug)) this.kept.push(key)
      else this.removed.push(key)
    }
  }

  changes(): CanonicalProgramChanges {
    return {
      delete: [...this.superseded, ...this.removed].map((key) => key.canonicalId),
      save: this.valid,
    }
  }
}
