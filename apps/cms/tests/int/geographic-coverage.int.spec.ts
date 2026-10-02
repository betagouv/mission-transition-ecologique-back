// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload, ValidationError } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, expect } from 'vitest'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import type { Program } from '../../payload-types'
import { GeographicAreasSeed } from '@/scripts/seed/geographic-areas'
import { ProgramsSync } from '@/scripts/sync/programs/ProgramsSync'
import { ProgramCanonicalMapper } from '@/services/canonical/ProgramCanonicalMapper'
import { PayloadRichTextToMarkdown } from '@/services/canonical/rich-text/PayloadRichTextToMarkdown'
import { PayloadProgramRelations } from '@/services/canonical/to-payload/PayloadProgramRelations'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'

const programsFixture = resolve(fileURLToPath(new URL('../fixtures', import.meta.url)), 'programs.json')

let payload: Payload
let program: Program
let nouvelleAquitaine: number
let landes: number
let bouchesDuRhone: number

const setAreas = (geographicAreas: number[]) =>
  payload.update({
    collection: 'programs',
    id: program.id,
    data: { geographicCoverage: 'regional-departemental', geographicAreas },
    context: SystemWorkflowContext.create(),
  })

describe('regional and departmental coverage', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await new GeographicAreasSeed(payload).run()
    await ProgramsSync.fromFile(payload, programsFixture).run()
    const relations = await PayloadProgramRelations.fromPayload(payload, new Map())
    nouvelleAquitaine = relations.areaByCogCode('REG-75')!.id
    landes = relations.areaByCogCode('DEP-40')!.id
    bouchesDuRhone = relations.areaByCogCode('DEP-13')!.id
    program = (
      await payload.find({ collection: 'programs', where: { workflowStatus: { equals: 'publie' } }, limit: 1, depth: 0 })
    ).docs[0]!
  }, 120_000)

  it('titles an area with its level, telling an overseas department from its region', async () => {
    const areas = await payload.find({
      collection: 'geographic-areas',
      where: { name: { equals: 'Guadeloupe' } },
      depth: 0,
    })
    expect(areas.docs.map((area) => area.displayName).sort()).toEqual(['Guadeloupe (département)', 'Guadeloupe (région)'])
  })

  it('holds a region and a department of another region, both exported as codes', async () => {
    const saved = await setAreas([nouvelleAquitaine, bouchesDuRhone])
    expect(saved.geographicCoverage).toBe('regional-departemental')

    const populated = await payload.findByID({ collection: 'programs', id: program.id, depth: 1 })
    const mapper = new ProgramCanonicalMapper(await PayloadRichTextToMarkdown.create(payload.config))
    expect(mapper.map(populated).eligibilite?.secteur_geographique?.structure?.inclusions).toEqual(['REG-75', 'DEP-13'])
  })

  it('refuses a department already covered by a selected region', async () => {
    const error = await setAreas([nouvelleAquitaine, landes]).then(
      () => undefined,
      (err: unknown) => err,
    )
    expect(error).toBeInstanceOf(ValidationError)
    const [fieldError] = (error as ValidationError).data.errors
    expect(fieldError?.path).toBe('geographicAreas')
    expect(fieldError?.message).toContain('Landes est déjà couvert par Nouvelle-Aquitaine')
  })
})
