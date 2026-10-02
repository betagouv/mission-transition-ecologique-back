import { describe, it, expect } from 'vitest'
import { CanonicalProjectService } from '../../src/canonical-project/CanonicalProjectService'
import type { CanonicalProject } from '../../src/canonical-project/CanonicalProject'
import type { CanonicalProjectInput } from '../../src/canonical-project/canonical-project.types'
import type { CanonicalProjectRepository } from '../../src/canonical-project/CanonicalProjectRepository'
import type { CanonicalChanges, CanonicalKey } from '../../src/snapshot/CanonicalKey'
import { CanonicalIdentityMap } from '../../src/snapshot/CanonicalIdentityMap'
import { CanonicalSnapshotGuard } from '../../src/snapshot/CanonicalSnapshotGuard'
import { CanonicalSnapshotRejectedError } from '../../src/snapshot/CanonicalSnapshotRejectedError'
import type { CanonicalEvent } from '../../src/observability/CanonicalEvent'
import type { CanonicalEventSink } from '../../src/observability/CanonicalEventSink'

class InMemoryRepository implements CanonicalProjectRepository {
  readonly saved = new Map<string, CanonicalProject>()
  async save(project: CanonicalProject): Promise<void> {
    this.saved.set(project.slug, project)
  }
  async findBySlug(slug: string): Promise<CanonicalProject | null> {
    return this.saved.get(slug) ?? null
  }
  async findAll(): Promise<CanonicalProject[]> {
    return [...this.saved.values()]
  }
  async delete(canonicalId: string): Promise<boolean> {
    let removed = false
    for (const [slug, project] of this.saved) {
      if (project.id === canonicalId) removed = this.saved.delete(slug)
    }
    return removed
  }
  async listKeys(): Promise<CanonicalKey[]> {
    return [...this.saved.values()].map((project) => ({ canonicalId: project.id, slug: project.slug }))
  }
  async applyChanges(changes: CanonicalChanges<CanonicalProject>): Promise<void> {
    for (const id of changes.delete) await this.delete(id)
    for (const project of changes.save) await this.save(project)
  }
}

class RecordingSink implements CanonicalEventSink {
  readonly events: CanonicalEvent[] = []
  emit(event: CanonicalEvent): void {
    this.events.push(event)
  }
}

const validInput: CanonicalProjectInput = {
  id: 'p1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'isolation-thermique',
  source: 'INTERNE',
  date_mise_a_jour: '2026-03-19T17:00:00+01:00',
  statut_projet: 'valide',
  titre: 'Isoler mon bâtiment',
  nom_court: 'Isolation',
  description_courte: 'Réduire les pertes de chaleur.',
  description_longue: { contenu: 'Une isolation performante réduit la facture.' },
  theme_principal: 'batiment',
}

describe('CanonicalProjectService', () => {
  it('validates then persists a valid input through the repository', async () => {
    const repository = new InMemoryRepository()
    const result = await new CanonicalProjectService(repository).save(validInput)

    expect(result).toEqual({ status: 'saved', slug: 'isolation-thermique' })
    expect(repository.saved.get('isolation-thermique')?.id).toBe('p1b2c3d4e5f6g7h8i9j0klmn')
  })

  it('reports invalid and persists nothing when validation fails', async () => {
    const repository = new InMemoryRepository()
    const result = await new CanonicalProjectService(repository).save({ ...validInput, id: 'not-a-cuid' })

    expect(result.status).toBe('invalid')
    expect(repository.saved.size).toBe(0)
  })

  it('getAll returns every stored project', async () => {
    const service = new CanonicalProjectService(new InMemoryRepository())
    await service.save(validInput)
    await service.save({ ...validInput, id: 'q1b2c3d4e5f6g7h8i9j0klmn', slug: 'autre-projet' })

    const slugs = (await service.getAll()).map((project) => project.slug).sort()
    expect(slugs).toEqual(['autre-projet', 'isolation-thermique'])
  })

  it('emits a saved event when an input is persisted', async () => {
    const events = new RecordingSink()
    await new CanonicalProjectService(new InMemoryRepository(), events).save(validInput)

    expect(events.events).toEqual([
      { type: 'project_saved', severity: 'info', slug: 'isolation-thermique', canonicalId: 'p1b2c3d4e5f6g7h8i9j0klmn' },
    ])
  })

  it('emits a write drop event when validation fails', async () => {
    const events = new RecordingSink()
    await new CanonicalProjectService(new InMemoryRepository(), events).save({ ...validInput, id: 'not-a-cuid' })

    expect(events.events).toHaveLength(1)
    const [event] = events.events
    expect(event.type).toBe('project_dropped')
    expect(event).toMatchObject({ severity: 'warning', phase: 'write', slug: 'isolation-thermique' })
  })

  it('removes a project through the repository and emits a removed event', async () => {
    const repository = new InMemoryRepository()
    const events = new RecordingSink()
    const service = new CanonicalProjectService(repository, events)
    await service.save(validInput)

    await service.remove('p1b2c3d4e5f6g7h8i9j0klmn', 'isolation-thermique')

    expect(repository.saved.size).toBe(0)
    expect(events.events.at(-1)).toEqual({
      type: 'project_removed',
      severity: 'info',
      slug: 'isolation-thermique',
      canonicalId: 'p1b2c3d4e5f6g7h8i9j0klmn',
    })
  })

  it('emits nothing when the project to remove was never stored', async () => {
    const events = new RecordingSink()
    const service = new CanonicalProjectService(new InMemoryRepository(), events)

    await service.remove('p1b2c3d4e5f6g7h8i9j0klmn', 'isolation-thermique')

    expect(events.events).toEqual([])
  })

  describe('applySnapshot', () => {
    const ids = ['c1b2c3d4e5f6g7h8i9j0klmn', 'd1b2c3d4e5f6g7h8i9j0klmn', 'e1b2c3d4e5f6g7h8i9j0klmn']
    const inputFor = (index: number): CanonicalProjectInput => ({ ...validInput, id: ids[index], slug: `projet-${index.toString()}` })

    async function storeWith(count: number) {
      const repository = new InMemoryRepository()
      const service = new CanonicalProjectService(repository)
      for (let index = 0; index < count; index++) await service.save(inputFor(index))
      return { repository, service }
    }

    it('upserts the snapshot and removes the projects gone upstream', async () => {
      const { repository, service } = await storeWith(3)

      const report = await service.applySnapshot([inputFor(0), inputFor(1)])

      expect(report.saved).toBe(2)
      expect(report.removed.map((key) => key.slug)).toEqual(['projet-2'])
      expect([...repository.saved.keys()].sort()).toEqual(['projet-0', 'projet-1'])
    })

    it('keeps the stored row of a project whose upstream record is invalid', async () => {
      const { repository, service } = await storeWith(2)

      const report = await service.applySnapshot([inputFor(0), { ...inputFor(1), titre: '' }])

      expect(report.invalid.map((entry) => entry.slug)).toEqual(['projet-1'])
      expect(report.kept.map((key) => key.slug)).toEqual(['projet-1'])
      expect(report.removed).toEqual([])
      expect(repository.saved.has('projet-1')).toBe(true)
    })

    describe('identity of a slug already stored', () => {
      const cmsId = 'x1b2c3d4e5f6g7h8i9j0klmn'
      const derivedProgramId = 'g1b2c3d4e5f6g7h8i9j0klmn'
      const storedProgramId = 'h1b2c3d4e5f6g7h8i9j0klmn'
      const otherProgramId = 'i1b2c3d4e5f6g7h8i9j0klmn'

      it('creates a project unknown to the store under the id it comes with', async () => {
        const { repository, service } = await storeWith(1)

        const report = await service.applySnapshot([inputFor(0), inputFor(1)])

        expect(report.adopted).toEqual([])
        expect(repository.saved.get('projet-1')?.id).toBe(ids[1])
      })

      it('changes nothing for a project stored under the id it comes with', async () => {
        const { repository, service } = await storeWith(2)

        const report = await service.applySnapshot([inputFor(0), inputFor(1)])

        expect(report).toMatchObject({ saved: 2, adopted: [], superseded: [], removed: [], kept: [] })
        expect(await repository.listKeys()).toEqual([
          { canonicalId: ids[0], slug: 'projet-0' },
          { canonicalId: ids[1], slug: 'projet-1' },
        ])
      })

      it('updates the row stored under another id instead of replacing it', async () => {
        const repository = new InMemoryRepository()
        const events = new RecordingSink()
        const service = new CanonicalProjectService(repository, events)
        await service.save({ ...inputFor(0), id: cmsId, titre: 'Titre du CMS' })
        events.events.length = 0

        const report = await service.applySnapshot([{ ...inputFor(0), titre: 'Titre amont' }])

        expect(report).toMatchObject({ saved: 1, superseded: [], removed: [] })
        expect(report.adopted).toEqual([{ canonicalId: cmsId, slug: 'projet-0' }])
        expect(await repository.listKeys()).toEqual([{ canonicalId: cmsId, slug: 'projet-0' }])
        expect(repository.saved.get('projet-0')?.data.titre).toBe('Titre amont')
        expect(events.events).toEqual([{ type: 'project_saved', severity: 'info', slug: 'projet-0', canonicalId: cmsId }])
      })

      it('does not count a row kept under its stored id as a removal', async () => {
        const repository = new InMemoryRepository()
        const service = new CanonicalProjectService(repository)
        await service.save({ ...inputFor(0), id: cmsId })
        const guard = new CanonicalSnapshotGuard({ entityLabel: 'projet', maxRemovalRatio: 0, removalAllowance: 0 })

        await expect(service.applySnapshot([inputFor(0)], guard)).resolves.toMatchObject({ saved: 1 })
      })

      it('points the linked projects and the tombstones at the stored id', async () => {
        const repository = new InMemoryRepository()
        const service = new CanonicalProjectService(repository)
        await service.save({ ...inputFor(0), id: cmsId })
        const linking: CanonicalProjectInput = { ...inputFor(1), projets_lies: { titre: 'À voir', projets: [ids[0], ids[2]] } }
        const tombstone: CanonicalProjectInput = {
          ...inputFor(2),
          slug: 'Ancien-projet',
          statut_projet: 'remplace',
          remplace_par: ids[0],
        }

        await service.applySnapshot([inputFor(0), linking, tombstone])

        expect(repository.saved.get('projet-1')?.data.projets_lies).toEqual({ titre: 'À voir', projets: [cmsId, ids[2]] })
        expect(repository.saved.get('Ancien-projet')?.data.remplace_par).toBe(cmsId)
      })

      it('points the programs of a project at the id they are stored under', async () => {
        const { repository, service } = await storeWith(0)
        const programIdentities = CanonicalIdentityMap.fromSnapshot(
          [{ canonicalId: storedProgramId, slug: 'dispositif-du-cms' }],
          [{ id: derivedProgramId, slug: 'dispositif-du-cms' }],
        )

        await service.applySnapshot([{ ...inputFor(0), dispositifs: [derivedProgramId, otherProgramId] }], undefined, {
          programIdentities,
        })

        expect(repository.saved.get('projet-0')?.data.dispositifs).toEqual([storedProgramId, otherProgramId])
      })

      it('leaves the caller inputs untouched', async () => {
        const repository = new InMemoryRepository()
        const service = new CanonicalProjectService(repository)
        await service.save({ ...inputFor(0), id: cmsId })
        const input: CanonicalProjectInput = { ...inputFor(0), projets_lies: { projets: [ids[0]] } }

        await service.applySnapshot([input])

        expect(input.id).toBe(ids[0])
        expect(input.projets_lies?.projets).toEqual([ids[0]])
      })

      it('keeps the stored id of a tombstone whose own slug is already stored', async () => {
        const repository = new InMemoryRepository()
        const service = new CanonicalProjectService(repository)
        await service.save(inputFor(0))
        await service.save({ ...inputFor(1), id: cmsId, statut_projet: 'remplace', remplace_par: ids[0] })

        const report = await service.applySnapshot([
          inputFor(0),
          { ...inputFor(1), statut_projet: 'remplace', remplace_par: ids[0] },
        ])

        expect(report.adopted).toEqual([{ canonicalId: cmsId, slug: 'projet-1' }])
        expect(repository.saved.get('projet-1')?.data).toMatchObject({ id: cmsId, remplace_par: ids[0] })
      })

      it('keeps the stored row of an invalid entry and still points the others at it', async () => {
        const repository = new InMemoryRepository()
        const service = new CanonicalProjectService(repository)
        await service.save({ ...inputFor(0), id: cmsId, titre: 'Titre du CMS' })

        const report = await service.applySnapshot([
          { slug: 'projet-0', id: ids[0] } as CanonicalProjectInput,
          { ...inputFor(1), projets_lies: { projets: [ids[0]] } },
        ])

        expect(report.kept).toEqual([{ canonicalId: cmsId, slug: 'projet-0' }])
        expect(report.adopted).toEqual([])
        expect(repository.saved.get('projet-0')?.data).toMatchObject({ id: cmsId, titre: 'Titre du CMS' })
        expect(repository.saved.get('projet-1')?.data.projets_lies?.projets).toEqual([cmsId])
      })

      it('keeps the stored row of an entry reduced to its slug', async () => {
        const { repository, service } = await storeWith(2)

        const report = await service.applySnapshot([inputFor(0), { slug: 'projet-1' } as CanonicalProjectInput])

        expect(report.kept).toEqual([{ canonicalId: ids[1], slug: 'projet-1' }])
        expect(repository.saved.has('projet-1')).toBe(true)
      })

      it('gives the same store whatever the order of the CMS writes and the snapshots', async () => {
        const repository = new InMemoryRepository()
        const service = new CanonicalProjectService(repository)
        const snapshot = [inputFor(0), { ...inputFor(1), projets_lies: { projets: [ids[0]] } }]
        const sorted = async () => (await service.getAll()).map((project) => project.toJSON()).sort((a, b) => a.slug.localeCompare(b.slug))

        await service.applySnapshot(snapshot)
        const first = await sorted()
        await service.applySnapshot(snapshot)
        expect(await sorted()).toEqual(first)
        expect(first[1].projets_lies?.projets).toEqual([ids[0]])

        await service.save({ ...inputFor(0), id: cmsId })
        await service.applySnapshot(snapshot)
        const afterCmsWrite = await sorted()
        await service.applySnapshot(snapshot)

        expect(afterCmsWrite.map((project) => project.id)).toEqual([cmsId, ids[1]])
        expect(afterCmsWrite[1].projets_lies?.projets).toEqual([cmsId])
        expect(await sorted()).toEqual(afterCmsWrite)
      })
    })

    it('rejects a snapshot without any valid project, naming the entity, and leaves the store untouched', async () => {
      const { repository, service } = await storeWith(2)

      const rejection = service.applySnapshot([{ ...inputFor(0), titre: '' }])

      await expect(rejection).rejects.toBeInstanceOf(CanonicalSnapshotRejectedError)
      await expect(rejection).rejects.toThrow('aucun projet valide dans le snapshot')
      expect(repository.saved.size).toBe(2)
    })

    it('rejects a snapshot removing more than the default guard allows, counting projects', async () => {
      const repository = new InMemoryRepository()
      const service = new CanonicalProjectService(repository)
      for (let index = 0; index < 7; index++) {
        await service.save({ ...validInput, id: `f${index.toString()}b2c3d4e5f6g7h8i9j0klmn`, slug: `projet-${index.toString()}` })
      }

      const rejection = service.applySnapshot([{ ...validInput, id: 'f0b2c3d4e5f6g7h8i9j0klmn', slug: 'projet-0' }])

      await expect(rejection).rejects.toThrow('6 suppression(s) sur 7 projet(s) stocké(s), limite 5')
      expect(repository.saved.size).toBe(7)
    })

    it('rejects a snapshot removing more than a custom guard allows', async () => {
      const { repository, service } = await storeWith(3)
      const guard = new CanonicalSnapshotGuard({ maxRemovalRatio: 0, removalAllowance: 1 })

      await expect(service.applySnapshot([inputFor(0)], guard)).rejects.toBeInstanceOf(CanonicalSnapshotRejectedError)
      expect(repository.saved.size).toBe(3)
    })

    it('emits events only once the snapshot is applied', async () => {
      const repository = new InMemoryRepository()
      const events = new RecordingSink()
      const service = new CanonicalProjectService(repository, events)
      await service.save(inputFor(0))
      await service.save(inputFor(1))
      events.events.length = 0

      await service.applySnapshot([inputFor(0), { ...inputFor(2), titre: '' }])

      expect(events.events.map((event) => `${event.type}:${'slug' in event ? event.slug : ''}`)).toEqual([
        'project_dropped:projet-2',
        'project_removed:projet-1',
        'project_saved:projet-0',
      ])
    })
  })
})
