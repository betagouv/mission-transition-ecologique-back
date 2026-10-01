import type { CanonicalSnapshotPlan } from './CanonicalSnapshotPlan'
import { CanonicalSnapshotRejectedError } from './CanonicalSnapshotRejectedError'

export interface CanonicalSnapshotGuardOptions {
  /** Share of the stored rows a single snapshot may remove. */
  maxRemovalRatio?: number
  /** Removals always tolerated, so a small store can still lose a few rows. */
  removalAllowance?: number
  /** French singular name of the entity, used in the rejection messages. */
  entityLabel?: string
}

/**
 * Refuses a snapshot that would empty or gut the store: an empty, truncated or
 * reshaped upstream file must fail the job, not wipe what consumers read.
 * Only rows gone upstream are counted: a row kept under its stored id or
 * superseded by the snapshot row of the same slug is still the same entity.
 */
export class CanonicalSnapshotGuard {
  private readonly maxRemovalRatio: number
  private readonly removalAllowance: number
  private readonly entityLabel: string

  constructor(options: CanonicalSnapshotGuardOptions = {}) {
    this.maxRemovalRatio = options.maxRemovalRatio ?? 0.1
    this.removalAllowance = options.removalAllowance ?? 5
    this.entityLabel = options.entityLabel ?? 'dispositif'
  }

  check(plan: CanonicalSnapshotPlan<{ id: string; slug: string }>): void {
    if (plan.valid.length === 0) {
      throw new CanonicalSnapshotRejectedError(`aucun ${this.entityLabel} valide dans le snapshot`)
    }

    const limit = Math.max(this.removalAllowance, Math.floor(plan.existing.length * this.maxRemovalRatio))
    if (plan.removed.length > limit) {
      throw new CanonicalSnapshotRejectedError(
        `${plan.removed.length.toString()} suppression(s) sur ${plan.existing.length.toString()} ${this.entityLabel}(s) stocké(s), limite ${limit.toString()}`,
      )
    }
  }
}
