import type { CanonicalChanges, CanonicalKey } from './CanonicalKey'

/**
 * Diff between the stored rows and a full upstream snapshot. Pure: it only
 * decides, the service applies. Shared by every canonical entity (programs,
 * projects). The entities come in under their final id: one whose slug was
 * already stored carries the stored id (see `CanonicalIdentityMap`). Every
 * stored row falls in exactly one bucket:
 * - updated: same canonical id in the snapshot, upserted;
 * - superseded: same slug in the snapshot under another canonical id, deleted so
 *   the snapshot row can take the slug. A safety net only: the identity map
 *   leaves this to the rare case where the stored id could not be kept;
 * - kept: its upstream record is invalid, left untouched rather than lost;
 * - removed: gone from the upstream snapshot, deleted.
 */
export class CanonicalSnapshotPlan<T extends { id: string; slug: string }> {
  readonly superseded: CanonicalKey[] = []
  readonly kept: CanonicalKey[] = []
  readonly removed: CanonicalKey[] = []

  constructor(
    readonly existing: CanonicalKey[],
    readonly valid: T[],
    invalidSlugs: ReadonlySet<string>,
  ) {
    const validIds = new Set<string>(valid.map((entity) => entity.id))
    const validSlugs = new Set<string>(valid.map((entity) => entity.slug))

    for (const key of existing) {
      if (validIds.has(key.canonicalId)) continue
      if (validSlugs.has(key.slug)) this.superseded.push(key)
      else if (invalidSlugs.has(key.slug)) this.kept.push(key)
      else this.removed.push(key)
    }
  }

  changes(): CanonicalChanges<T> {
    return {
      delete: [...this.superseded, ...this.removed].map((key) => key.canonicalId),
      save: this.valid,
    }
  }
}
