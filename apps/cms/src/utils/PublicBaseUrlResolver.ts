import type { PayloadRequest } from 'payload'
import { Config } from '@/config/Config'

/**
 * Public base URL for the absolute links served by the API. Behind a reverse
 * proxy (Scalingo router) `req.origin` is the internal container address
 * (localhost:36xxx), so the request alone cannot tell the public URL.
 * Production requires PUBLIC_BASE_URL: the forwarded headers are client-forgeable
 * when the app is reached past the router. Elsewhere: explicit env override →
 * forwarded headers → request origin.
 */
export class PublicBaseUrlResolver {
  static resolve(req: PayloadRequest): string {
    const configured = Config.publicBaseUrl()
    if (configured) return configured
    if (Config.isProduction()) {
      throw new Error('Missing PUBLIC_BASE_URL: required in production to build absolute links.')
    }
    const host = req.headers.get('x-forwarded-host')
    if (host) return `${req.headers.get('x-forwarded-proto') ?? 'https'}://${host}`
    return req.origin
  }
}
