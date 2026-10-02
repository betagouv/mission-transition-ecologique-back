/** Non-OK HTTP answer from the upstream repository, keeping the status so callers can tell "absent" from "down". */
export class UpstreamFetchError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`Téléchargement impossible (${status.toString()}) : ${url}`)
    this.name = 'UpstreamFetchError'
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}
