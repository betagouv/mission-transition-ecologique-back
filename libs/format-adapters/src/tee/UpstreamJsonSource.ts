import { ConsoleExportLogger } from '../shared/ConsoleExportLogger'
import type { ExportLogger } from '../shared/ExportLogger'
import { LocalJsonSnapshot } from './LocalJsonSnapshot'
import type { UpstreamFile } from './UpstreamFile'

export interface UpstreamJsonSourceOptions {
  urls?: Partial<Record<UpstreamFile, string>>
  /** Read when GitHub is unreachable. Leave unset in production: the job must fail instead. */
  fallback?: LocalJsonSnapshot
  logger?: ExportLogger
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/**
 * Reads the upstream TEE data (`programs.json`, `projects.json`,
 * `redirects.json`) over HTTP, the upstream repository being the source of
 * truth. Files are consumed in memory: the Scalingo one-off container running
 * the daily job has a throwaway filesystem. URLs are overridable to follow a
 * move of the upstream repository without a release.
 */
export class UpstreamJsonSource {
  private static readonly BASE =
    'https://raw.githubusercontent.com/betagouv/mission-transition-ecologique/main/libs/data/static'

  private static readonly URL_ENV: Record<UpstreamFile, string> = {
    programs: 'TEE_PROGRAMS_URL',
    projects: 'TEE_PROJECTS_URL',
    redirects: 'TEE_REDIRECTS_URL',
  }

  private readonly urls: Record<UpstreamFile, string>
  private readonly fallback: LocalJsonSnapshot | undefined
  private readonly logger: ExportLogger
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: UpstreamJsonSourceOptions = {}) {
    this.urls = {
      programs: options.urls?.programs ?? UpstreamJsonSource.defaultUrl('programs'),
      projects: options.urls?.projects ?? UpstreamJsonSource.defaultUrl('projects'),
      redirects: options.urls?.redirects ?? UpstreamJsonSource.defaultUrl('redirects'),
    }
    this.fallback = options.fallback
    this.logger = options.logger ?? new ConsoleExportLogger()
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? 30_000
  }

  /** Source for the current runtime: the local fallback is enabled everywhere but in production. */
  static forEnvironment(
    env: NodeJS.ProcessEnv = process.env,
    options: Omit<UpstreamJsonSourceOptions, 'fallback'> = {},
  ): UpstreamJsonSource {
    const fallback = env['NODE_ENV'] === 'production' ? undefined : new LocalJsonSnapshot()
    return new UpstreamJsonSource({ ...options, fallback })
  }

  private static defaultUrl(file: UpstreamFile): string {
    return process.env[UpstreamJsonSource.URL_ENV[file]] ?? `${UpstreamJsonSource.BASE}/${file}.json`
  }

  programs<T>(): Promise<T> {
    return this.load<T>('programs')
  }

  projects<T>(): Promise<T> {
    return this.load<T>('projects')
  }

  /** Redirects are optional upstream: a missing file skips the redirect step. */
  async redirects<T>(): Promise<T | null> {
    try {
      return await this.load<T>('redirects')
    } catch {
      return null
    }
  }

  describe(): string {
    const urls = `${this.urls.programs} + ${this.urls.projects} + ${this.urls.redirects}`
    return this.fallback ? `${urls} (copie locale en secours : ${this.fallback.directory})` : urls
  }

  private async load<T>(file: UpstreamFile): Promise<T> {
    try {
      return await this.fetchJson<T>(this.urls[file])
    } catch (error) {
      if (!this.fallback?.has(file)) throw error
      this.logger.warn(
        `Amont injoignable (${(error as Error).message}), copie locale utilisée : ${this.fallback.path(file)}`,
      )
      return this.fallback.read<T>(file)
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) })
    if (!response.ok) {
      throw new Error(`Téléchargement impossible (${response.status.toString()}) : ${url}`)
    }
    return (await response.json()) as T
  }
}
