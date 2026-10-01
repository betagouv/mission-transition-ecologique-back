import {
  AgirProjetListeExporter,
  AgirProjetPivotExporter,
  AgirProjetReferences,
} from '@tee-backoffice/format-adapters'
import type { Endpoint, PayloadRequest } from 'payload'
import { getCanonicalProjectRepository } from '@/services/canonical/canonicalProjectRepository'
import { getCanonicalProgramRepository } from '@/services/canonical/canonicalRepository'
import { AgirBaseUrlResolver } from './AgirBaseUrlResolver'

/**
 * Public, read-only AGIR endpoints for projects. Like the program endpoints they
 * only TRANSPORT: read the canonical store, hand off to the format-adapters
 * exporters, and serialize. Every stored project is published, so there is no
 * export policy to apply.
 *
 * Mounted under `/api` by Payload: `/api/agir/projects`,
 * `/api/agir/projects/:slug/pivot`.
 */

function notFound(): Response {
  return Response.json({ error: 'Projet introuvable' }, { status: 404 })
}

const listeHandler = async (req: PayloadRequest): Promise<Response> => {
  const repository = await getCanonicalProjectRepository(req.payload.logger)
  const projects = await repository.findAll()
  return Response.json(new AgirProjetListeExporter({ baseUrl: AgirBaseUrlResolver.resolve(req) }).exportMany(projects))
}

const pivotHandler = async (req: PayloadRequest): Promise<Response> => {
  const slug = String(req.routeParams?.slug ?? '')
  if (!slug) return notFound()
  const projectRepository = await getCanonicalProjectRepository(req.payload.logger)
  const project = await projectRepository.findBySlug(slug)
  if (!project) return notFound()

  // References are canonical ids: both stores are needed to resolve them to slugs.
  const programRepository = await getCanonicalProgramRepository(req.payload.logger)
  const [projects, programs] = await Promise.all([projectRepository.findAll(), programRepository.findAll()])
  const references = new AgirProjetReferences({ projects, programs })
  const exporter = new AgirProjetPivotExporter(references, { baseUrl: AgirBaseUrlResolver.resolve(req) })
  return Response.json(exporter.export(project))
}

export const agirProjectEndpoints: Endpoint[] = [
  { path: '/agir/projects', method: 'get', handler: listeHandler },
  { path: '/agir/projects/:slug/pivot', method: 'get', handler: pivotHandler },
]
