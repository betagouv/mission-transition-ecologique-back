import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import type { CanonicalEvent, CanonicalEventSink, CanonicalProgram } from '@tee-backoffice/canonical'
import { DrizzleCanonicalProgramRepository } from '../src/DrizzleCanonicalProgramRepository'
import { InMemoryCanonicalDb } from '../src/testing/InMemoryCanonicalDb'
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

async function newRepository(events?: CanonicalEventSink) {
  const db = await InMemoryCanonicalDb.create()
  return { db, repo: DrizzleCanonicalProgramRepository.fromDb(db, events) }
}

describe('DrizzleCanonicalProgramRepository', () => {
  it('saves then reads a program back by slug', async () => {
    const { repo } = await newRepository()
    await repo.save(program)
    const found = await repo.findBySlug('diagnostic-energie-pme')
    expect(found?.toJSON()).toEqual(program.toJSON())
  })

  it('upserts on the same canonical id without error', async () => {
    const { repo } = await newRepository()
    await repo.save(program)
    await repo.save(program)
    const found = await repo.findBySlug('diagnostic-energie-pme')
    expect(found?.id).toBe('a1b2c3d4e5f6g7h8i9j0klmn')
  })

  it('returns null for an unknown slug', async () => {
    const { repo } = await newRepository()
    expect(await repo.findBySlug('inconnu')).toBeNull()
  })

  it('findAll returns every saved program', async () => {
    const { repo } = await newRepository()
    expect(await repo.findAll()).toEqual([])
    await repo.save(program)
    const all = await repo.findAll()
    expect(all.map((p) => p.slug)).toEqual(['diagnostic-energie-pme'])
  })

  it('delete removes only the program with that canonical id', async () => {
    const { repo } = await newRepository()
    const other = new CanonicalProgramValidator().parse({
      ...validInput,
      id: 'b1b2c3d4e5f6g7h8i9j0klmn',
      slug: 'autre-dispositif',
    })
    await repo.save(program)
    await repo.save(other)

    expect(await repo.delete('a1b2c3d4e5f6g7h8i9j0klmn')).toBe(true)

    expect((await repo.findAll()).map((p) => p.slug)).toEqual(['autre-dispositif'])
  })

  it('delete is a no-op for an unknown canonical id, and says so', async () => {
    const { repo } = await newRepository()
    await repo.save(program)
    expect(await repo.delete('zzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false)
    expect(await repo.findAll()).toHaveLength(1)
  })

  describe('slug held by another canonical id', () => {
    const removedEvent = {
      type: 'program_removed',
      severity: 'info',
      slug: 'diagnostic-energie-pme',
      canonicalId: 'a1b2c3d4e5f6g7h8i9j0klmn',
    }

    async function newRecordingRepository() {
      const events: CanonicalEvent[] = []
      const { repo } = await newRepository({ emit: (event) => events.push(event) })
      return { repo, events }
    }

    it('save replaces the row holding the slug and reports it as removed', async () => {
      const { repo, events } = await newRecordingRepository()
      await repo.save(program)

      await repo.save(new CanonicalProgramValidator().parse({ ...validInput, id: 'b1b2c3d4e5f6g7h8i9j0klmn' }))

      expect(await repo.listKeys()).toEqual([
        { canonicalId: 'b1b2c3d4e5f6g7h8i9j0klmn', slug: 'diagnostic-energie-pme' },
      ])
      expect(events).toEqual([removedEvent])
    })

    it('save reports nothing when no other row holds the slug', async () => {
      const { repo, events } = await newRecordingRepository()
      await repo.save(program)
      await repo.save(program)

      expect(events).toEqual([])
    })

    it('applyChanges replaces a row holding the slug even when it is not listed for deletion', async () => {
      const { repo, events } = await newRecordingRepository()
      await repo.save(program)
      const sameSlug = new CanonicalProgramValidator().parse({ ...validInput, id: 'b1b2c3d4e5f6g7h8i9j0klmn' })

      await repo.applyChanges({ delete: [], save: [sameSlug] })

      expect(await repo.listKeys()).toEqual([
        { canonicalId: 'b1b2c3d4e5f6g7h8i9j0klmn', slug: 'diagnostic-energie-pme' },
      ])
      expect(events).toEqual([removedEvent])
    })
  })

  it('listKeys lists every row, including one that no longer validates', async () => {
    const { db, repo } = await newRepository()
    await repo.save(program)
    await db.update(canonicalPrograms).set({ data: '{not valid json' })

    expect(await repo.listKeys()).toEqual([
      { canonicalId: 'a1b2c3d4e5f6g7h8i9j0klmn', slug: 'diagnostic-energie-pme' },
    ])
  })

  it('applyChanges deletes first, so a new id can take over an existing slug', async () => {
    const { repo } = await newRepository()
    await repo.save(program)
    const sameSlug = new CanonicalProgramValidator().parse({ ...validInput, id: 'b1b2c3d4e5f6g7h8i9j0klmn' })

    await repo.applyChanges({ delete: ['a1b2c3d4e5f6g7h8i9j0klmn'], save: [sameSlug] })

    expect((await repo.findAll()).map((p) => p.id)).toEqual(['b1b2c3d4e5f6g7h8i9j0klmn'])
  })

  it('applyChanges rolls everything back when one write fails', async () => {
    const { repo } = await newRepository()
    await repo.save(program)
    const takeover = new CanonicalProgramValidator().parse({ ...validInput, id: 'b1b2c3d4e5f6g7h8i9j0klmn' })
    const other = new CanonicalProgramValidator().parse({
      ...validInput,
      id: 'c1b2c3d4e5f6g7h8i9j0klmn',
      slug: 'autre-dispositif',
    })
    const broken = {
      toJSON: () => {
        throw new Error('unserializable')
      },
    } as unknown as CanonicalProgram

    await expect(repo.applyChanges({ delete: [], save: [other, takeover, broken] })).rejects.toThrow('unserializable')

    // The eviction of the stored row is rolled back too.
    expect(await repo.listKeys()).toEqual([
      { canonicalId: 'a1b2c3d4e5f6g7h8i9j0klmn', slug: 'diagnostic-energie-pme' },
    ])
  })

  describe('format drift on read', () => {
    // Corrupts the stored `data` of the saved program, then returns the
    // repository and the events it recorded.
    async function withCorruptedRow(corruptData: string) {
      const events: CanonicalEvent[] = []
      const { db, repo } = await newRepository({ emit: (event) => events.push(event) })
      await repo.save(program)

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
