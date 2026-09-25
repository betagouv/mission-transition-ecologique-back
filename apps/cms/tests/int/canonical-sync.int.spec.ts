// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, expect } from 'vitest'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import type { CanonicalProgramRepository } from '@tee-backoffice/canonical'
import { AgirExportPolicy, SchemaExportPolicy } from '@tee-backoffice/format-adapters'
import type { Program } from '../../payload-types'
import { ProgramsSeed } from '@/scripts/seed/programs'
import { getCanonicalProgramRepository } from '@/services/canonical/canonicalRepository'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'

const fixturesDir = fileURLToPath(new URL('../fixtures', import.meta.url))
const programsFixture = resolve(fixturesDir, 'programs.json')

let payload: Payload
let canonical: CanonicalProgramRepository
// Each test takes its own published program, so the tests stay independent.
let published: Program[]

const systemUpdate = (id: number, data: Partial<Program>, draft = false) =>
  payload.update({ collection: 'programs', id, data, draft, context: SystemWorkflowContext.create() })

describe('canonical sync hooks', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    await new ProgramsSeed(payload, programsFixture).run()
    canonical = await getCanonicalProgramRepository(payload.logger)

    const result = await payload.find({
      collection: 'programs',
      where: { workflowStatus: { equals: 'publie' } },
      limit: 6,
      depth: 0,
    })
    published = result.docs
    expect(published).toHaveLength(6)
  }, 60_000)

  it('mirrors a published program into the canonical', async () => {
    const stored = await canonical.findBySlug(published[0]!.slug!)
    expect(stored?.id).toBe(published[0]!.canonicalId)
    expect(stored?.statutEdition).toBe('pret_prod')
  })

  it('refuses a status change without a user nor the system context', async () => {
    await expect(
      payload.update({ collection: 'programs', id: published[1]!.id, data: { workflowStatus: 'archive' } }),
    ).rejects.toThrow('Utilisateur non authentifié')
  })

  it('pushes an archived program, then its return to publie', async () => {
    const program = published[1]!
    await systemUpdate(program.id, { workflowStatus: 'archive' })
    const archived = await canonical.findBySlug(program.slug!)
    expect(archived?.statutEdition).toBe('pret_prod')
    expect(archived?.statutDispositif).toBe('archive')
    // Still served by our AGIR API, left out of the Grist open data export.
    expect(AgirExportPolicy.isExportable(archived!)).toBe(true)
    expect(SchemaExportPolicy.isExportable(archived!)).toBe(false)

    await systemUpdate(program.id, { workflowStatus: 'publie' })
    const republished = await canonical.findBySlug(program.slug!)
    expect(republished?.statutEdition).toBe('pret_prod')
    expect(republished?.statutDispositif).toBe('valide')
  })

  it('pushes a replaced program pointing at its replacement', async () => {
    const program = published[5]!
    const replacement = published[0]!
    await systemUpdate(program.id, { workflowStatus: 'remplace', replacedBy: replacement.id })

    const stored = await canonical.findBySlug(program.slug!)
    expect(stored?.statutDispositif).toBe('remplace')
    expect(stored?.toJSON().remplace_par).toBe(replacement.canonicalId)
    expect(AgirExportPolicy.isExportable(stored!)).toBe(true)
  })

  it('keeps the published version live while a draft is being rewritten', async () => {
    const program = published[2]!
    await systemUpdate(program.id, { title: 'Titre en cours de réécriture', _status: 'draft' }, true)

    const stored = await canonical.findBySlug(program.slug!)
    expect(stored?.toJSON().titre).toBe(program.title)
  })

  it('withdraws a cancelled program', async () => {
    const program = published[3]!
    await systemUpdate(program.id, { workflowStatus: 'annule' })
    expect(await canonical.findBySlug(program.slug!)).toBeNull()
  })

  it('withdraws a hard-deleted program', async () => {
    const program = published[4]!
    await payload.delete({ collection: 'programs', id: program.id })
    expect(await canonical.findBySlug(program.slug!)).toBeNull()
  })
})
