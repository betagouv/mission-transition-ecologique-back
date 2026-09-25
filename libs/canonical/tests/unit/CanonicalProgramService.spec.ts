import { describe, it, expect } from 'vitest'
import { CanonicalProgramService } from '../../src/canonical-program/CanonicalProgramService'
import type { CanonicalProgram } from '../../src/canonical-program/CanonicalProgram'
import type { CanonicalProgramInput } from '../../src/canonical-program/canonical-program.types'
import type {
  CanonicalProgramChanges,
  CanonicalProgramKey,
  CanonicalProgramRepository,
} from '../../src/canonical-program/CanonicalProgramRepository'
import { CanonicalSnapshotGuard } from '../../src/canonical-program/snapshot/CanonicalSnapshotGuard'
import { CanonicalSnapshotRejectedError } from '../../src/canonical-program/snapshot/CanonicalSnapshotRejectedError'
import type { CanonicalEvent } from '../../src/observability/CanonicalEvent'
import type { CanonicalEventSink } from '../../src/observability/CanonicalEventSink'

class InMemoryRepository implements CanonicalProgramRepository {
  readonly saved = new Map<string, CanonicalProgram>()
  async save(program: CanonicalProgram): Promise<void> {
    this.saved.set(program.slug, program)
  }
  async findBySlug(slug: string): Promise<CanonicalProgram | null> {
    return this.saved.get(slug) ?? null
  }
  async findAll(): Promise<CanonicalProgram[]> {
    return [...this.saved.values()]
  }
  async delete(canonicalId: string): Promise<void> {
    for (const [slug, program] of this.saved) {
      if (program.id === canonicalId) this.saved.delete(slug)
    }
  }
  async listKeys(): Promise<CanonicalProgramKey[]> {
    return [...this.saved.values()].map((program) => ({ canonicalId: program.id, slug: program.slug }))
  }
  async applyChanges(changes: CanonicalProgramChanges): Promise<void> {
    for (const id of changes.delete) await this.delete(id)
    for (const program of changes.save) await this.save(program)
  }
}

class RecordingSink implements CanonicalEventSink {
  readonly events: CanonicalEvent[] = []
  emit(event: CanonicalEvent): void {
    this.events.push(event)
  }
}

const validInput: CanonicalProgramInput = {
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

describe('CanonicalProgramService', () => {
  it('validates then persists a valid input through the repository', async () => {
    const repository = new InMemoryRepository()
    const result = await new CanonicalProgramService(repository).save(validInput)

    expect(result).toEqual({ status: 'saved', slug: 'diagnostic-energie-pme' })
    expect(repository.saved.get('diagnostic-energie-pme')?.id).toBe('a1b2c3d4e5f6g7h8i9j0klmn')
  })

  it('reports invalid and persists nothing when validation fails', async () => {
    const repository = new InMemoryRepository()
    const result = await new CanonicalProgramService(repository).save({ ...validInput, id: 'not-a-cuid' })

    expect(result.status).toBe('invalid')
    expect(repository.saved.size).toBe(0)
  })

  it('getAll returns every stored program', async () => {
    const service = new CanonicalProgramService(new InMemoryRepository())
    await service.save(validInput)
    await service.save({ ...validInput, id: 'b1b2c3d4e5f6g7h8i9j0klmn', slug: 'autre-dispositif' })

    const slugs = (await service.getAll()).map((program) => program.slug).sort()
    expect(slugs).toEqual(['autre-dispositif', 'diagnostic-energie-pme'])
  })

  it('emits a saved event when an input is persisted', async () => {
    const events = new RecordingSink()
    await new CanonicalProgramService(new InMemoryRepository(), events).save(validInput)

    expect(events.events).toEqual([
      { type: 'program_saved', severity: 'info', slug: 'diagnostic-energie-pme', canonicalId: 'a1b2c3d4e5f6g7h8i9j0klmn' },
    ])
  })

  it('emits a write drop event when validation fails', async () => {
    const events = new RecordingSink()
    await new CanonicalProgramService(new InMemoryRepository(), events).save({ ...validInput, id: 'not-a-cuid' })

    expect(events.events).toHaveLength(1)
    const [event] = events.events
    expect(event.type).toBe('program_dropped')
    expect(event).toMatchObject({ severity: 'warning', phase: 'write', slug: 'diagnostic-energie-pme' })
  })

  it('removes a program through the repository and emits a removed event', async () => {
    const repository = new InMemoryRepository()
    const events = new RecordingSink()
    const service = new CanonicalProgramService(repository, events)
    await service.save(validInput)

    await service.remove('a1b2c3d4e5f6g7h8i9j0klmn', 'diagnostic-energie-pme')

    expect(repository.saved.size).toBe(0)
    expect(events.events.at(-1)).toEqual({
      type: 'program_removed',
      severity: 'info',
      slug: 'diagnostic-energie-pme',
      canonicalId: 'a1b2c3d4e5f6g7h8i9j0klmn',
    })
  })

  describe('applySnapshot', () => {
    const ids = ['c1b2c3d4e5f6g7h8i9j0klmn', 'd1b2c3d4e5f6g7h8i9j0klmn', 'e1b2c3d4e5f6g7h8i9j0klmn']
    const inputFor = (index: number): CanonicalProgramInput => ({ ...validInput, id: ids[index], slug: `dispositif-${index.toString()}` })

    async function storeWith(count: number) {
      const repository = new InMemoryRepository()
      const service = new CanonicalProgramService(repository)
      for (let index = 0; index < count; index++) await service.save(inputFor(index))
      return { repository, service }
    }

    it('upserts the snapshot and removes the programs gone upstream', async () => {
      const { repository, service } = await storeWith(3)

      const report = await service.applySnapshot([inputFor(0), inputFor(1)])

      expect(report.saved).toBe(2)
      expect(report.removed.map((key) => key.slug)).toEqual(['dispositif-2'])
      expect([...repository.saved.keys()].sort()).toEqual(['dispositif-0', 'dispositif-1'])
    })

    it('keeps the stored row of a program whose upstream record is invalid', async () => {
      const { repository, service } = await storeWith(2)

      const report = await service.applySnapshot([inputFor(0), { ...inputFor(1), titre: '' }])

      expect(report.invalid.map((entry) => entry.slug)).toEqual(['dispositif-1'])
      expect(report.kept.map((key) => key.slug)).toEqual(['dispositif-1'])
      expect(report.removed).toEqual([])
      expect(repository.saved.has('dispositif-1')).toBe(true)
    })

    it('replaces a row stored under another id for the same slug', async () => {
      const repository = new InMemoryRepository()
      const service = new CanonicalProgramService(repository)
      await service.save({ ...inputFor(0), id: ids[2] })

      const report = await service.applySnapshot([inputFor(0)])

      expect(report.superseded).toEqual([{ canonicalId: ids[2], slug: 'dispositif-0' }])
      expect(report.removed).toEqual([])
      expect(repository.saved.get('dispositif-0')?.id).toBe(ids[0])
    })

    it('rejects a snapshot without any valid program and leaves the store untouched', async () => {
      const { repository, service } = await storeWith(2)

      await expect(service.applySnapshot([{ ...inputFor(0), titre: '' }])).rejects.toBeInstanceOf(
        CanonicalSnapshotRejectedError,
      )
      expect(repository.saved.size).toBe(2)
    })

    it('rejects a snapshot removing more than the guard allows', async () => {
      const { repository, service } = await storeWith(3)
      const guard = new CanonicalSnapshotGuard({ maxRemovalRatio: 0, removalAllowance: 1 })

      await expect(service.applySnapshot([inputFor(0)], guard)).rejects.toBeInstanceOf(CanonicalSnapshotRejectedError)
      expect(repository.saved.size).toBe(3)
    })

    it('emits events only once the snapshot is applied', async () => {
      const repository = new InMemoryRepository()
      const events = new RecordingSink()
      const service = new CanonicalProgramService(repository, events)
      await service.save(inputFor(0))
      await service.save(inputFor(1))
      events.events.length = 0

      await service.applySnapshot([inputFor(0), { ...inputFor(2), titre: '' }])

      expect(events.events.map((event) => `${event.type}:${'slug' in event ? event.slug : ''}`)).toEqual([
        'program_dropped:dispositif-2',
        'program_removed:dispositif-1',
        'program_saved:dispositif-0',
      ])
    })
  })
})
