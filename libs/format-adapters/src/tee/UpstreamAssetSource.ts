import { posix } from 'node:path'
import { UpstreamFetchError } from './UpstreamFetchError'
import type { UpstreamAsset } from './UpstreamAsset'

export interface UpstreamAssetSourceOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/**
 * Downloads a file from the upstream front's public folder (operator logos,
 * project images) by its upstream path, e.g. `/images/logos/operateur/ademe.webp`.
 * The base URL is overridable to follow a move of the upstream repository.
 */
export class UpstreamAssetSource {
  private static readonly BASE =
    'https://raw.githubusercontent.com/betagouv/mission-transition-ecologique/main/apps/nuxt/src/public'

  private static readonly MIMETYPES: Record<string, string> = {
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  }

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: UpstreamAssetSourceOptions = {}) {
    const baseUrl = options.baseUrl ?? (process.env['TEE_ASSETS_BASE_URL'] || UpstreamAssetSource.BASE)
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? 30_000
  }

  describe(): string {
    return this.baseUrl
  }

  url(path: string): string {
    UpstreamAssetSource.assertSafePath(path)
    return `${this.baseUrl}${path}`
  }

  async fetch(path: string): Promise<UpstreamAsset> {
    const url = this.url(path)
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) })
    if (!response.ok) throw new UpstreamFetchError(url, response.status)
    const data = Buffer.from(await response.arrayBuffer())
    const name = posix.basename(path)
    return {
      data,
      mimetype: UpstreamAssetSource.mimetype(response.headers.get('content-type'), name),
      name,
      size: data.byteLength,
    }
  }

  // raw.githubusercontent.com serves some files (SVG among them) as text/plain.
  private static mimetype(contentType: string | null, name: string): string {
    const declared = contentType?.split(';')[0]?.trim().toLowerCase()
    if (declared?.startsWith('image/')) return declared
    return UpstreamAssetSource.MIMETYPES[posix.extname(name).toLowerCase()] ?? 'application/octet-stream'
  }

  // Upstream paths come from upstream JSON: keep them inside the public folder.
  private static assertSafePath(path: string): void {
    const isRooted = path.startsWith('/') && !path.startsWith('//')
    const escapes = path.split('/').includes('..') || /\\|%2e/i.test(path)
    if (!isRooted || escapes || path.endsWith('/')) {
      throw new Error(`Chemin amont invalide : ${path}`)
    }
  }
}
