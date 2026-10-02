// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, expect } from 'vitest'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { createId } from '@paralleldrive/cuid2'
import { CanonicalProgramValidator, type CanonicalProgramRepository } from '@tee-backoffice/canonical'
import type { Program, User } from '../../payload-types'
import { ProgramsSync } from '@/scripts/sync/programs/ProgramsSync'
import { getCanonicalProgramRepository } from '@/services/canonical/canonicalRepository'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'

const fixturesDir = fileURLToPath(new URL('../fixtures', import.meta.url))
const programsFixture = resolve(fixturesDir, 'programs.json')

let payload: Payload
let canonical: CanonicalProgramRepository
let superAdmin: User
let published: Program[]

const system = SystemWorkflowContext.create

/**
 * Reproduces a program left in creation by the seed: the system rewrite is a
 * draft, so only its latest version carries the realigned (slug-derived) id,
 * while the main row and the canonical row disagree until someone publishes it.
 */
async function leaveInCreationWithRealignedDraft(program: Program): Promise<string> {
  await payload.update({ collection: 'programs', id: program.id, data: { workflowStatus: 'en-creation' }, context: system() })
  const realigned = createId()
  await payload.update({
    collection: 'programs',
    id: program.id,
    data: { canonicalId: realigned },
    draft: true,
    context: system(),
  })

  // The daily import already stored the program under the realigned id: saving
  // it evicts the row the former id held under the same slug.
  const source = (await canonical.findBySlug(program.slug!)) ?? (await canonical.findAll())[0]!
  await canonical.save(new CanonicalProgramValidator().parse({ ...source.toJSON(), id: realigned, slug: program.slug }))
  return realigned
}

async function mainRowId(program: Program): Promise<string | null | undefined> {
  return (await payload.findByID({ collection: 'programs', id: program.id, depth: 0 })).canonicalId
}

describe('publishing a program whose draft carries a realigned canonical id', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await ProgramsSync.fromFile(payload, programsFixture).run()
    canonical = await getCanonicalProgramRepository(payload.logger)
    superAdmin = await payload.create({
      collection: 'users',
      data: { email: 'publisher@tee.test', password: 'publisher@tee.test', role: 'super-admin' },
    })
    published = (
      await payload.find({ collection: 'programs', where: { workflowStatus: { equals: 'publie' } }, limit: 2, depth: 0 })
    ).docs
    expect(published).toHaveLength(2)
  }, 60_000)

  it('publishes on the realigned id when the editor does not send canonicalId', async () => {
    const program = published[0]!
    const realigned = await leaveInCreationWithRealignedDraft(program)

    expect(await mainRowId(program)).toBe(program.canonicalId)
    const draft = await payload.findByID({ collection: 'programs', id: program.id, depth: 0, draft: true })
    expect(draft.canonicalId).toBe(realigned)

    // (a) The editor publishes without sending canonicalId.
    await payload.update({
      collection: 'programs',
      id: program.id,
      data: { workflowStatus: 'publie' },
      user: superAdmin,
      overrideAccess: false,
    })

    const keys = (await canonical.listKeys()).filter((key) => key.slug === program.slug)
    expect(await mainRowId(program)).toBe(realigned)
    expect(keys).toEqual([{ canonicalId: realigned, slug: program.slug }])
  })

  it('publishes on the realigned id when the form sends the draft canonicalId', async () => {
    const program = published[1]!
    const realigned = await leaveInCreationWithRealignedDraft(program)

    // (b) The admin form submits every field, the hidden canonicalId included.
    await payload.update({
      collection: 'programs',
      id: program.id,
      data: { workflowStatus: 'publie', canonicalId: realigned },
      user: superAdmin,
      overrideAccess: false,
    })

    const keys = (await canonical.listKeys()).filter((key) => key.slug === program.slug)
    expect(await mainRowId(program)).toBe(realigned)
    expect(keys).toEqual([{ canonicalId: realigned, slug: program.slug }])
  })
})
