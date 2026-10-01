import type { PayloadRequest } from 'payload'
import { Config } from '@/config/Config'

/**
 * Public base URL for the absolute AGIR links. Behind a reverse proxy (Scalingo
 * router) `req.origin` is the internal container address (localhost:36xxx), so:
 * explicit env override → forwarded headers set by the router → request origin.
 */
export class AgirBaseUrlResolver {
  static resolve(req: PayloadRequest): string {
    const configured = Config.publicBaseUrl()
    if (configured) return configured
    const host = req.headers.get('x-forwarded-host')
    if (host) return `${req.headers.get('x-forwarded-proto') ?? 'https'}://${host}`
    return req.origin
  }
}
