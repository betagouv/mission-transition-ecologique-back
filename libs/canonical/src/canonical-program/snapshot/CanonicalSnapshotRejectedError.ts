/** Raised when a snapshot looks too destructive to apply; the store is left untouched. */
export class CanonicalSnapshotRejectedError extends Error {
  constructor(reason: string) {
    super(`Snapshot amont refusé, store canonical inchangé : ${reason}`)
    this.name = 'CanonicalSnapshotRejectedError'
  }
}
