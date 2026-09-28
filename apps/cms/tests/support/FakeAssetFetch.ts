import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

/**
 * Stand-in for the upstream front's public folder: serves a tiny WebP image for
 * the paths it knows, 404 otherwise, and records every requested URL.
 */
export class FakeAssetFetch {
  static readonly BASE_URL = 'https://assets.test'
  private static readonly PIXEL = readFileSync(fileURLToPath(new URL('../fixtures/pixel.webp', import.meta.url)))

  readonly requested: string[] = []

  constructor(private readonly knownPaths: string[]) {}

  readonly fetch: typeof fetch = (input) => {
    const url = input instanceof Request ? input.url : input.toString()
    this.requested.push(url)
    const path = url.slice(FakeAssetFetch.BASE_URL.length)
    const response = this.knownPaths.includes(path)
      ? new Response(new Uint8Array(FakeAssetFetch.PIXEL), { status: 200, headers: { 'content-type': 'image/webp' } })
      : new Response('Not Found', { status: 404 })
    return Promise.resolve(response)
  }
}
