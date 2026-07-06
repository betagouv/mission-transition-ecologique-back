import type { CanonicalProgram } from '@tee-backoffice/canonical'
import {
  AdemePivotExporter,
  AgirDetailExporter,
  AgirExportPolicy,
  AgirListeExporter,
  RemplaceParResolver,
} from '@tee-backoffice/format-adapters'
import type { Endpoint, PayloadRequest } from 'payload'
import { getCanonicalProgramRepository } from '@/services/canonical/canonicalRepository'

/**
 * Public, read-only AGIR endpoints. They only TRANSPORT: read the canonical
 * store, filter exportable programs, hand off to the format-adapters exporters,
 * and serialize. All projection logic (and its tests) live in the library.
 *
 * Mounted under `/api` by Payload: `/api/agir/programs`,
 * `/api/agir/programs/:slug/detail`, `/api/agir/programs/:slug/pivot`.
 */

function notFound(): Response {
  return Response.json({ error: 'Dispositif introuvable' }, { status: 404 })
}

/**
 * Public base URL for the absolute AGIR links. Behind a reverse proxy (Scalingo
 * router) `req.origin` is the internal container address (localhost:36xxx), so:
 * explicit env override → forwarded headers set by the router → request origin.
 */
function resolveBaseUrl(req: PayloadRequest): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL
  const host = req.headers.get('x-forwarded-host')
  if (host) return `${req.headers.get('x-forwarded-proto') ?? 'https'}://${host}`
  return req.origin
}

/** Resolves an exportable program by slug, or null (unknown / non-exportable). */
async function findExportable(req: PayloadRequest, slug: string): Promise<CanonicalProgram | null> {
  if (!slug) return null
  const repository = await getCanonicalProgramRepository(req.payload.logger)
  const program = await repository.findBySlug(slug)
  return program && AgirExportPolicy.isExportable(program) ? program : null
}

const listeHandler = async (req: PayloadRequest): Promise<Response> => {
  const repository = await getCanonicalProgramRepository(req.payload.logger)
  const programs = await repository.findAll()
  // Index links are absolute; see resolveBaseUrl for the reverse-proxy caveat.
  return Response.json(new AgirListeExporter({ baseUrl: resolveBaseUrl(req) }).exportMany(programs))
}

const detailHandler = async (req: PayloadRequest): Promise<Response> => {
  const program = await findExportable(req, String(req.routeParams?.slug ?? ''))
  if (!program) return notFound()
  return Response.json(new AgirDetailExporter().export(program))
}

const pivotHandler = async (req: PayloadRequest): Promise<Response> => {
  const program = await findExportable(req, String(req.routeParams?.slug ?? ''))
  if (!program) return notFound()
  // Resolve remplace_par (a canonical cuid2) to the replacing program's slug.
  const repository = await getCanonicalProgramRepository(req.payload.logger)
  const resolver = new RemplaceParResolver(await repository.findAll())
  return Response.json(new AdemePivotExporter(resolver).export(program))
}

export const agirEndpoints: Endpoint[] = [
  { path: '/agir/programs', method: 'get', handler: listeHandler },
  { path: '/agir/programs/:slug/detail', method: 'get', handler: detailHandler },
  { path: '/agir/programs/:slug/pivot', method: 'get', handler: pivotHandler },
]
