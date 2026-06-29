import { afterEach, describe, it, expect } from 'vitest'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import type { CanonicalEvent, CanonicalEventSink } from '@tee-backoffice/canonical'
import { DrizzleCanonicalProgramRepository } from '../src/DrizzleCanonicalProgramRepository'
import { createCanonicalDb } from '../src/db'
import { canonicalPrograms } from '../src/schema'

const validInput = {
  id: 'a1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'diagnostic-energie-pme',
  source: 'INTERNE',
  date_mise_a_jour: '2026-03-19T17:00:00+01:00',
  titre: 'Diagnostic énergie PME',
  description: 'Un diagnostic financé pour les PME.',
  statut_edition: 'pret_prod',
  statut_dispositif: 'valide',
  types_aides: ['financement'],
  operateurs: { contact: { nom: 'ADEME' } },
}

const program = new CanonicalProgramValidator().parse(validInput)

// Unique temp-file suffix per drift test, avoiding cross-worker name clashes.
let driftCounter = 0

describe('DrizzleCanonicalProgramRepository', () => {
  it('saves then reads a program back by slug', async () => {
    const repo = await DrizzleCanonicalProgramRepository.create(':memory:')
    await repo.save(program)
    const found = await repo.findBySlug('diagnostic-energie-pme')
    expect(found?.toJSON()).toEqual(program.toJSON())
  })

  it('upserts on the same canonical id without error', async () => {
    const repo = await DrizzleCanonicalProgramRepository.create(':memory:')
    await repo.save(program)
    await repo.save(program)
    const found = await repo.findBySlug('diagnostic-energie-pme')
    expect(found?.id).toBe('a1b2c3d4e5f6g7h8i9j0klmn')
  })

  it('returns null for an unknown slug', async () => {
    const repo = await DrizzleCanonicalProgramRepository.create(':memory:')
    expect(await repo.findBySlug('inconnu')).toBeNull()
  })

  it('findAll returns every saved program', async () => {
    const repo = await DrizzleCanonicalProgramRepository.create(':memory:')
    expect(await repo.findAll()).toEqual([])
    await repo.save(program)
    const all = await repo.findAll()
    expect(all.map((p) => p.slug)).toEqual(['diagnostic-energie-pme'])
  })

  describe('format drift on read', () => {
    let dbPath: string | undefined

    afterEach(() => {
      if (dbPath) rmSync(dbPath, { force: true })
      dbPath = undefined
    })

    // Corrupts the stored `data` for the saved program through a second
    // connection to the same file, then returns repo + recorded events.
    async function withCorruptedRow(corruptData: string) {
      driftCounter += 1
      dbPath = join(tmpdir(), `canonical-drift-${process.pid.toString()}-${driftCounter.toString()}.db`)
      const url = `file:${dbPath}`
      const events: CanonicalEvent[] = []
      const sink: CanonicalEventSink = { emit: (event) => events.push(event) }

      const repo = await DrizzleCanonicalProgramRepository.create(url, sink)
      await repo.save(program)

      const db = await createCanonicalDb(url)
      await db
        .update(canonicalPrograms)
        .set({ data: corruptData })
        .where(eq(canonicalPrograms.slug, 'diagnostic-energie-pme'))

      return { repo, events }
    }

    it('drops a row that no longer validates and reports it as a read event', async () => {
      const { repo, events } = await withCorruptedRow(JSON.stringify({ slug: 'diagnostic-energie-pme' }))

      expect(await repo.findAll()).toEqual([])
      expect(await repo.findBySlug('diagnostic-energie-pme')).toBeNull()
      expect(events.filter((e) => e.type === 'program_dropped' && e.phase === 'read')).toHaveLength(2)
    })

    it('drops an unparseable row instead of throwing, and reports it', async () => {
      const { repo, events } = await withCorruptedRow('{not valid json')

      expect(await repo.findAll()).toEqual([])
      expect(await repo.findBySlug('diagnostic-energie-pme')).toBeNull()
      expect(events.filter((e) => e.type === 'program_dropped' && e.phase === 'read')).toHaveLength(2)
    })
  })
})
