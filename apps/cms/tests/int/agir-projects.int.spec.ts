// @vitest-environment node
import type { Payload } from 'payload'
import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, expect } from 'vitest'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import type { AgirProjetPivot, ListeProjet } from '@tee-backoffice/format-adapters'
import { agirProjectEndpoints } from '@/endpoints/agir/agirProjectEndpoints'
import { ProgramsSeed } from '@/scripts/seed/programs'
import { ProjectsSeed } from '@/scripts/seed/projects'

const fixturesDir = fileURLToPath(new URL('../fixtures', import.meta.url))

const BASE_URL = 'https://agir.test'
const PLAN = 'fixture-projet-plan-energie'
const AUDIT = 'fixture-projet-audit-energetique'
const FIXTURE_SLUGS = [
  PLAN,
  AUDIT,
  'fixture-projet-eco-conception',
  'fixture-projet-gestion-dechets',
  'fixture-projet-mobilite',
]
const DRAFT = 'agir-projet-brouillon'

let payload: Payload

// The handlers are called as Payload would, behind the router that sets the forwarded host.
const call = async (path: string, routeParams: Record<string, string> = {}): Promise<Response> => {
  const endpoint = agirProjectEndpoints.find((candidate) => candidate.path === path)
  if (!endpoint) throw new Error(`no endpoint for ${path}`)
  const req = await createLocalReq(
    { req: { headers: new Headers({ 'x-forwarded-host': 'agir.test', 'x-forwarded-proto': 'https' }), routeParams } },
    payload,
  )
  return endpoint.handler(req)
}
const index = async () => (await (await call('/agir/projects')).json()) as ListeProjet[]
const pivot = (slug: string) => call('/agir/projects/:slug/pivot', { slug })

describe('AGIR project endpoints', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await ProgramsSeed.fromFile(payload, resolve(fixturesDir, 'programs.json')).run()
    await ProjectsSeed.fromFile(payload, resolve(fixturesDir, 'projects.json')).run()

    await payload.create({
      collection: 'projects',
      data: {
        slug: DRAFT,
        title: 'Projet en brouillon',
        nameTag: 'brouillon',
        shortDescription: 'Pas encore publié',
        longDescription: {
          root: {
            type: 'root',
            children: [
              { type: 'paragraph', version: 1, children: [{ type: 'text', text: 'À venir', format: 0, version: 1 }] },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
        mainTheme: 'energy',
      },
    })
  }, 120_000)

  it('lists the published projects, each with its absolute pivot link', async () => {
    const projects = await index()
    const slugs = projects.map((project) => project.idProjet)

    for (const slug of FIXTURE_SLUGS) expect(slugs).toContain(slug)
    expect(projects.find((project) => project.idProjet === PLAN)).toMatchObject({
      titre: 'Plan d’action économies d’énergie',
      etatProjet: 'en_prod',
      urlPivot: `${BASE_URL}/api/agir/projects/${PLAN}/pivot`,
    })
  })

  it('leaves a draft out of the index and of the pivot', async () => {
    const slugs = (await index()).map((project) => project.idProjet)

    expect(slugs).not.toContain(DRAFT)
    expect((await pivot(DRAFT)).status).toBe(404)
  })

  it('serves the pivot of a project with the slugs of its programs and linked projects', async () => {
    const response = await pivot(PLAN)
    const body = (await response.json()) as AgirProjetPivot

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ id: PLAN, statut: 'en_prod', theme_principal: 'energie' })
    // `fixture-broken-step-link` stays a draft in the CMS: the programs API does
    // not serve it, so the project must not point at it.
    expect(body.dispositifs).toEqual(['baisse-les-watts', 'booster-eco-energie-tertiaire'])
    expect(body.projets_lies?.projets).toEqual([AUDIT])
    expect(body.faq?.questions).toHaveLength(2)
    expect(body.priorite).toMatchObject({ defaut: 40, mise_en_avant: 5 })
  })

  it('answers 404 for an unknown slug', async () => {
    const response = await pivot('projet-inconnu')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Projet introuvable' })
  })
})
