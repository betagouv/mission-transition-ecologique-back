import { describe, it, expect } from 'vitest'
import { CanonicalProgramService } from '@tee-backoffice/canonical'
import { DrizzleCanonicalProgramRepository } from '@tee-backoffice/canonical-store'
import { InMemoryCanonicalDb } from '@tee-backoffice/canonical-store/testing'
import { ProgramCanonicalMapper } from '@/services/canonical/ProgramCanonicalMapper'
import { CUID, StubRichTextToMarkdown, buildProgram } from './support/canonicalProgramFixtures'

// Integration of the CMS path: Payload program → mapper (adapter) → domain
// CanonicalProgramService → Postgres store (PGlite in memory here). The domain validate/persist rule is
// unit tested in libs/canonical; here we exercise the full wiring.
async function build() {
  const repository = DrizzleCanonicalProgramRepository.fromDb(await InMemoryCanonicalDb.create())
  const service = new CanonicalProgramService(repository)
  const mapper = new ProgramCanonicalMapper(new StubRichTextToMarkdown())
  return { service, mapper, repository }
}

describe('CanonicalProgramService (CMS adapter → domain → store)', () => {
  it('maps a Payload program, validates and persists it', async () => {
    const { service, mapper, repository } = await build()
    const result = await service.save(mapper.map(buildProgram()))
    expect(result.status).toBe('saved')
    expect((await repository.findBySlug('visite-energie'))?.id).toBe(CUID)
  })

  it('reports invalid without saving when the mapped canonical is invalid', async () => {
    const { service, mapper, repository } = await build()
    // A formation requires a duree the program does not provide → invalid canonical.
    const result = await service.save(mapper.map(buildProgram({ aidType: 'formation' })))
    expect(result.status).toBe('invalid')
    expect(await repository.findBySlug('visite-energie')).toBeNull()
  })
})
