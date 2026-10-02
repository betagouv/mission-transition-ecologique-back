export interface UpstreamRemovalGuardOptions {
  /** Share of the documents a single run may withdraw. */
  maxRemovalRatio?: number
  /** Withdrawals always tolerated, so a small collection can still lose a few documents. */
  removalAllowance?: number
}

/**
 * Caps what one sync run may withdraw (documents cancelled, canonical rows
 * removed): a truncated or reshaped upstream file must fail the job, not empty
 * the CMS. Same thresholds as `CanonicalSnapshotGuard` of the direct import.
 */
export class UpstreamRemovalGuard {
  private readonly maxRemovalRatio: number
  private readonly removalAllowance: number

  constructor(options: UpstreamRemovalGuardOptions = {}) {
    this.maxRemovalRatio = options.maxRemovalRatio ?? 0.1
    this.removalAllowance = options.removalAllowance ?? 5
  }

  /** Guard that refuses nothing, for a mass removal decided on purpose. */
  static unlimited(): UpstreamRemovalGuard {
    return new UpstreamRemovalGuard({ maxRemovalRatio: 1 })
  }

  limitFor(total: number): number {
    return Math.max(this.removalAllowance, Math.floor(total * this.maxRemovalRatio))
  }

  allows(removals: number, total: number): boolean {
    return removals <= this.limitFor(total)
  }
}
