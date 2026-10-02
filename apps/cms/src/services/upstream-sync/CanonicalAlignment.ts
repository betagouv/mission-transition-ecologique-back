import type { CanonicalKey } from '@tee-backoffice/canonical'

export interface ExpectedCanonicalRow extends CanonicalKey {
  /** `required`: the CMS serves it, the store must hold it. `allowed`: the store may still hold it. */
  presence: 'required' | 'allowed'
}

/**
 * Gap between what the CMS expects in a canonical store and what the store
 * holds. The CMS being the only writer, a required row that is absent is a
 * failed sync, and a stored row the CMS no longer expects is a leftover.
 */
export class CanonicalAlignment {
  private constructor(
    /** Rows the CMS serves that the store does not hold. */
    readonly missing: CanonicalKey[],
    /** Stored rows the CMS does not expect. */
    readonly orphans: CanonicalKey[],
    readonly storedCount: number,
  ) {}

  static compare(expected: readonly ExpectedCanonicalRow[], stored: readonly CanonicalKey[]): CanonicalAlignment {
    const storedIds = new Set(stored.map((key) => key.canonicalId))
    const expectedIds = new Set(expected.map((row) => row.canonicalId))
    const missing = expected
      .filter((row) => row.presence === 'required' && !storedIds.has(row.canonicalId))
      .map(({ canonicalId, slug }) => ({ canonicalId, slug }))
    const orphans = stored.filter((key) => !expectedIds.has(key.canonicalId))
    return new CanonicalAlignment(missing, orphans, stored.length)
  }

  get isAligned(): boolean {
    return this.missing.length === 0 && this.orphans.length === 0
  }
}
