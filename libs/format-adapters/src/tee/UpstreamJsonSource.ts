/**
 * Reads the upstream TEE data (`programs.json`, `redirects.json`) over HTTP.
 *
 * The daily refresh runs in a Scalingo one-off container whose filesystem is
 * throwaway, so the files are consumed in memory rather than written to disk.
 * URLs are overridable to follow a move of the upstream repository without a
 * release.
 */
export class UpstreamJsonSource {
  private static readonly BASE =
    'https://raw.githubusercontent.com/betagouv/mission-transition-ecologique/main/libs/data/static'

  constructor(
    private readonly programsUrl: string = process.env['TEE_PROGRAMS_URL'] ??
      `${UpstreamJsonSource.BASE}/programs.json`,
    private readonly redirectsUrl: string = process.env['TEE_REDIRECTS_URL'] ??
      `${UpstreamJsonSource.BASE}/redirects.json`,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  programs<T>(): Promise<T> {
    return this.load<T>(this.programsUrl)
  }

  /** Redirects are optional upstream: a missing file skips the redirect step. */
  async redirects<T>(): Promise<T | null> {
    try {
      return await this.load<T>(this.redirectsUrl)
    } catch {
      return null
    }
  }

  private async load<T>(url: string): Promise<T> {
    const response = await this.fetchImpl(url)
    if (!response.ok) {
      throw new Error(`Téléchargement impossible (${response.status.toString()}) : ${url}`)
    }
    return (await response.json()) as T
  }

  describe(): string {
    return `${this.programsUrl} + ${this.redirectsUrl}`
  }
}
