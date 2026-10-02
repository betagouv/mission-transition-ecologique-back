/** Outcome of cancelling the documents that left upstream. */
export interface GoneDocumentsReport {
  /** Slugs cancelled by this run. */
  cancelled: string[]
  errors: number
  /** Why nothing was cancelled, when the guard refused the batch. */
  refused?: string
}
