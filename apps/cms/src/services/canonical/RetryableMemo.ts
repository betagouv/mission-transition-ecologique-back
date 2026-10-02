/**
 * Memoizes an async bootstrap for the app lifetime, except a failed one: a
 * rejected promise is forgotten, so the next call retries instead of serving
 * the same failure until the process restarts.
 */
export class RetryableMemo<T> {
  private promise: Promise<T> | undefined

  get(create: () => Promise<T>): Promise<T> {
    this.promise ??= create().catch((error: unknown) => {
      this.promise = undefined
      throw error
    })
    return this.promise
  }
}
