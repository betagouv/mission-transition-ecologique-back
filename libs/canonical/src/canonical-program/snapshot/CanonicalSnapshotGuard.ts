import type { CanonicalSnapshotPlan } from './CanonicalSnapshotPlan'
import { CanonicalSnapshotRejectedError } from './CanonicalSnapshotRejectedError'

export interface CanonicalSnapshotGuardOptions {
  /** Share of the stored rows a single snapshot may remove. */
  maxRemovalRatio?: number
  /** Removals always tolerated, so a small store can still lose a few programs. */
  removalAllowance?: number
}

/**
 * Refuses a snapshot that would empty or gut the store: an empty, truncated or
 * reshaped upstream file must fail the job, not wipe what consumers read.
 * Superseded rows are not counted: the same program is rewritten under its new id.
 */
export class CanonicalSnapshotGuard {
  private readonly maxRemovalRatio: number
  private readonly removalAllowance: number

  constructor(options: CanonicalSnapshotGuardOptions = {}) {
    this.maxRemovalRatio = options.maxRemovalRatio ?? 0.1
    this.removalAllowance = options.removalAllowance ?? 5
  }

  check(plan: CanonicalSnapshotPlan): void {
    if (plan.valid.length === 0) {
      throw new CanonicalSnapshotRejectedError('aucun dispositif valide dans le snapshot')
    }

    const limit = Math.max(this.removalAllowance, Math.floor(plan.existing.length * this.maxRemovalRatio))
    if (plan.removed.length > limit) {
      throw new CanonicalSnapshotRejectedError(
        `${plan.removed.length.toString()} suppression(s) sur ${plan.existing.length.toString()} dispositif(s) stocké(s), limite ${limit.toString()}`,
      )
    }
  }
}
