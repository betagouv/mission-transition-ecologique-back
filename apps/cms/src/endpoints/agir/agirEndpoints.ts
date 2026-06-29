import type { CanonicalProgram } from '@tee-backoffice/canonical'
import {
  AdemePivotExporter,
  AgirDetailExporter,
  AgirExportPolicy,
  AgirListeExporter,
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

/** Public base URL the index links are built from. Configured per environment. */
function baseUrl(): string {
  return process.env.AGIR_PUBLIC_BASE_URL ?? process.env.PAYLOAD_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
}

function notFound(): Response {
  return Response.json({ error: 'Dispositif introuvable' }, { status: 404 })
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
  return Response.json(new AgirListeExporter({ baseUrl: baseUrl() }).exportMany(programs))
}

const detailHandler = async (req: PayloadRequest): Promise<Response> => {
  const program = await findExportable(req, String(req.routeParams?.slug ?? ''))
  if (!program) return notFound()
  return Response.json(new AgirDetailExporter().export(program))
}

const pivotHandler = async (req: PayloadRequest): Promise<Response> => {
  const program = await findExportable(req, String(req.routeParams?.slug ?? ''))
  if (!program) return notFound()
  return Response.json(new AdemePivotExporter().export(program))
}

export const agirEndpoints: Endpoint[] = [
  { path: '/agir/programs', method: 'get', handler: listeHandler },
  { path: '/agir/programs/:slug/detail', method: 'get', handler: detailHandler },
  { path: '/agir/programs/:slug/pivot', method: 'get', handler: pivotHandler },
]
