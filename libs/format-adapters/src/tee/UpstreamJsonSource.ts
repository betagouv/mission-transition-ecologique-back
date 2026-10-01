import { ConsoleExportLogger } from '../shared/ConsoleExportLogger'
import type { ExportLogger } from '../shared/ExportLogger'
import { LocalJsonSnapshot } from './LocalJsonSnapshot'
import { teeOperatorsSchema } from './tee-operator.schema'
import type { TeeOperator } from './tee-operator.schema'
import type { TeeProject } from './tee-project.schema'
import { TeeProjectRecords } from './TeeProjectRecords'
import type { RejectedTeeProject } from './TeeProjectRecords'
import { UpstreamFetchError } from './UpstreamFetchError'
import type { UpstreamFallbackSettings } from './UpstreamFallbackSettings'
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
 * `redirects.json`, `operators.json`) over HTTP, the upstream repository being the source of
 * truth. Files are consumed in memory: the Scalingo one-off container running
 * the daily job has a throwaway filesystem. URLs are overridable to follow a
 * move of the upstream repository without a release.
 */
export class UpstreamJsonSource {
  private static readonly BASE =
    'https://raw.githubusercontent.com/betagouv/mission-transition-ecologique/main/libs/data/static'

  // Operators are only published by the front, not under `libs/data/static`.
  private static readonly OPERATORS_URL =
    'https://raw.githubusercontent.com/betagouv/mission-transition-ecologique/main/apps/nuxt/src/public/json/operator/operators.json'

  private static readonly URL_ENV: Record<UpstreamFile, string> = {
    programs: 'TEE_PROGRAMS_URL',
    projects: 'TEE_PROJECTS_URL',
    redirects: 'TEE_REDIRECTS_URL',
    operators: 'TEE_OPERATORS_URL',
  }

  private readonly urls: Record<UpstreamFile, string>
  private readonly fallback: LocalJsonSnapshot | undefined
  private readonly logger: ExportLogger
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private rejected: RejectedTeeProject[] = []

  constructor(options: UpstreamJsonSourceOptions = {}) {
    this.urls = {
      programs: options.urls?.programs ?? UpstreamJsonSource.defaultUrl('programs'),
      projects: options.urls?.projects ?? UpstreamJsonSource.defaultUrl('projects'),
      redirects: options.urls?.redirects ?? UpstreamJsonSource.defaultUrl('redirects'),
      operators: options.urls?.operators ?? UpstreamJsonSource.defaultUrl('operators'),
    }
    this.fallback = options.fallback
    this.logger = options.logger ?? new ConsoleExportLogger()
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? 30_000
  }

  /** Source whose local fallback is enabled only when the settings explicitly allow it. */
  static fromSettings(
    settings: UpstreamFallbackSettings,
    options: Omit<UpstreamJsonSourceOptions, 'fallback'> = {},
  ): UpstreamJsonSource {
    const fallback = settings.allowsLocalFallback() ? new LocalJsonSnapshot() : undefined
    return new UpstreamJsonSource({ ...options, fallback })
  }

  private static defaultUrl(file: UpstreamFile): string {
    const fromEnv = process.env[UpstreamJsonSource.URL_ENV[file]]
    if (fromEnv) return fromEnv
    return file === 'operators' ? UpstreamJsonSource.OPERATORS_URL : `${UpstreamJsonSource.BASE}/${file}.json`
  }

  programs<T>(): Promise<T> {
    return this.load<T>('programs')
  }

  /**
   * Upstream projects whose shape is valid. A broken record is set aside, logged
   * and listed in {@link rejectedProjects}; only a file that is not a list throws.
   */
  async projects(): Promise<TeeProject[]> {
    const { projects, rejected } = TeeProjectRecords.parse(await this.load<unknown>('projects'))
    this.rejected = rejected
    for (const record of rejected) {
      this.logger.warn(`projects.json : enregistrement écarté (${TeeProjectRecords.describe(record)})`)
    }
    return projects
  }

  /** Records set aside by the last {@link projects} read. */
  get rejectedProjects(): readonly RejectedTeeProject[] {
    return this.rejected
  }

  /** The file as upstream publishes it, unvalidated: for the versioned snapshot, never for an import. */
  raw(file: UpstreamFile): Promise<unknown> {
    return this.load<unknown>(file)
  }

  /** Validated upstream operators: a broken shape throws instead of feeding the import. */
  async operators(): Promise<TeeOperator[]> {
    return teeOperatorsSchema.parse(await this.load<unknown>('operators'))
  }

  /**
   * Redirects are optional upstream: only a 404 means "no file" and skips the
   * redirect step. Any other failure (5xx, timeout, broken JSON) propagates, so
   * an outage never silently drops the redirect tombstones.
   */
  async redirects<T>(): Promise<T | null> {
    try {
      return await this.load<T>('redirects')
    } catch (error) {
      if (error instanceof UpstreamFetchError && error.isNotFound) return null
      throw error
    }
  }

  describe(): string {
    const urls = [this.urls.programs, this.urls.projects, this.urls.redirects, this.urls.operators].join(' + ')
    return this.fallback ? `${urls} (copie locale en secours : ${this.fallback.directory})` : urls
  }

  private async load<T>(file: UpstreamFile): Promise<T> {
    try {
      return await this.fetchJson<T>(this.urls[file])
    } catch (error) {
      if (!UpstreamJsonSource.isOutage(error) || !this.fallback?.has(file)) throw error
      this.logger.warn(
        `Amont injoignable (${(error as Error).message}), copie locale utilisée : ${this.fallback.path(file)}`,
      )
      return this.fallback.read<T>(file)
    }
  }

  /**
   * Only an outage (network, timeout, 5xx) may be papered over by the local
   * copy: a 404 or a broken JSON is a real upstream change and must surface.
   */
  private static isOutage(error: unknown): boolean {
    if (error instanceof UpstreamFetchError) return error.status >= 500
    return !(error instanceof SyntaxError)
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) })
    if (!response.ok) throw new UpstreamFetchError(url, response.status)
    return (await response.json()) as T
  }
}
