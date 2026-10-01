import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { CanonicalProgramValidator, CanonicalProjectValidator } from '@tee-backoffice/canonical'
import type { CanonicalEvent, CanonicalEventSink, CanonicalProject } from '@tee-backoffice/canonical'
import { DrizzleCanonicalProgramRepository } from '../src/DrizzleCanonicalProgramRepository'
import { DrizzleCanonicalProjectRepository } from '../src/DrizzleCanonicalProjectRepository'
import { InMemoryCanonicalDb } from '../src/testing/InMemoryCanonicalDb'
import { canonicalProjects } from '../src/schema'

const PROJECT_ID = 'p1b2c3d4e5f6g7h8i9j0klmn'
const OTHER_ID = 'r1b2c3d4e5f6g7h8i9j0klmn'
const THIRD_ID = 's1b2c3d4e5f6g7h8i9j0klmn'
const SLUG = 'isolation-thermique'

const validInput = {
  id: PROJECT_ID,
  slug: SLUG,
  source: 'INTERNE',
  date_mise_a_jour: '2026-06-15T10:00:00+02:00',
  statut_projet: 'valide',
  titre: 'Isoler mon bâtiment',
  nom_court: 'Isolation',
  description_courte: 'Réduire les pertes de chaleur de vos locaux.',
  description_longue: { contenu: 'Une **isolation** performante réduit la facture.' },
  theme_principal: 'batiment',
}

const fullInput = {
  ...validInput,
  id: OTHER_ID,
  slug: 'plan-action-eco-energie',
  image: {
    url: 'https://cdn.example.org/media/plan-eco-energie.webp',
    chemin_source: '/images/projet/plan-eco-energie.webp',
  },
  description_longue: { titre: 'Pourquoi agir ?', contenu: 'Un plan structure vos **économies**.' },
  description_complementaire: { titre: 'Pour aller plus loin', contenu: 'Suivez vos consommations.' },
  themes: ['energie', 'batiment'],
  secteurs: ['C', 'I'],
  priorite: { defaut: 3, mise_en_avant: 1, par_secteur: [{ code_naf: '55.3', priorite: 2 }] },
  dispositifs: ['a1b2c3d4e5f6g7h8i9j0klmn'],
  projets_lies: { titre: 'Projets complémentaires', projets: [PROJECT_ID] },
  faq: {
    titre: 'Questions fréquentes',
    questions: [{ question: 'Par où commencer ?', reponse: 'Par un diagnostic.' }],
  },
  seo: { titre: 'Plan éco-énergie', description: 'Réduire sa consommation d’énergie.' },
}

const validator = new CanonicalProjectValidator()

const project = validator.parse(validInput)

async function newRepository(events?: CanonicalEventSink) {
  const db = await InMemoryCanonicalDb.create()
  return { db, repo: DrizzleCanonicalProjectRepository.fromDb(db, events) }
}

describe('DrizzleCanonicalProjectRepository', () => {
  it('saves then reads a project back by slug', async () => {
    const { repo } = await newRepository()
    await repo.save(project)
    const found = await repo.findBySlug(SLUG)
    expect(found?.toJSON()).toEqual(project.toJSON())
  })

  it('round-trips a fully-populated project without loss', async () => {
    const { repo } = await newRepository()
    const full = validator.parse(fullInput)
    await repo.save(full)
    const found = await repo.findBySlug(full.slug)
    expect(found?.toJSON()).toEqual(full.toJSON())
  })

  it('upserts on the same canonical id, replacing the stored content', async () => {
    const { repo } = await newRepository()
    await repo.save(project)
    await repo.save(validator.parse({ ...validInput, titre: 'Nouveau titre' }))

    const all = await repo.findAll()
    expect(all).toHaveLength(1)
    expect(all[0]?.id).toBe(PROJECT_ID)
    expect(all[0]?.toJSON().titre).toBe('Nouveau titre')
  })

  it('returns null for an unknown slug', async () => {
    const { repo } = await newRepository()
    expect(await repo.findBySlug('inconnu')).toBeNull()
  })

  it('findAll returns every saved project', async () => {
    const { repo } = await newRepository()
    expect(await repo.findAll()).toEqual([])
    await repo.save(project)
    const all = await repo.findAll()
    expect(all.map((p) => p.slug)).toEqual([SLUG])
  })

  it('delete removes only the project with that canonical id', async () => {
    const { repo } = await newRepository()
    const other = validator.parse({ ...validInput, id: OTHER_ID, slug: 'autre-projet' })
    await repo.save(project)
    await repo.save(other)

    expect(await repo.delete(PROJECT_ID)).toBe(true)

    expect((await repo.findAll()).map((p) => p.slug)).toEqual(['autre-projet'])
  })

  it('delete is a no-op for an unknown canonical id, and says so', async () => {
    const { repo } = await newRepository()
    await repo.save(project)
    expect(await repo.delete('zzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false)
    expect(await repo.findAll()).toHaveLength(1)
  })

  describe('slug held by another canonical id', () => {
    async function newRecordingRepository() {
      const events: CanonicalEvent[] = []
      const { repo } = await newRepository({ emit: (event) => events.push(event) })
      return { repo, events }
    }

    it('save replaces the row holding the slug and reports it as removed', async () => {
      const { repo, events } = await newRecordingRepository()
      await repo.save(project)

      await repo.save(validator.parse({ ...validInput, id: OTHER_ID, titre: 'Repris par un autre identifiant' }))

      expect(await repo.listKeys()).toEqual([{ canonicalId: OTHER_ID, slug: SLUG }])
      expect((await repo.findBySlug(SLUG))?.toJSON().titre).toBe('Repris par un autre identifiant')
      expect(events).toEqual([{ type: 'project_removed', severity: 'info', slug: SLUG, canonicalId: PROJECT_ID }])
    })

    it('save reports nothing when no other row holds the slug', async () => {
      const { repo, events } = await newRecordingRepository()
      await repo.save(project)
      await repo.save(project)

      expect(events).toEqual([])
    })

    it('save moves a project onto the slug of another one, which is replaced', async () => {
      const { repo } = await newRecordingRepository()
      await repo.save(project)
      await repo.save(validator.parse({ ...validInput, id: OTHER_ID, slug: 'autre-projet' }))

      await repo.save(validator.parse({ ...validInput, id: OTHER_ID }))

      expect(await repo.listKeys()).toEqual([{ canonicalId: OTHER_ID, slug: SLUG }])
    })

    it('applyChanges replaces a row holding the slug even when it is not listed for deletion', async () => {
      const { repo, events } = await newRecordingRepository()
      await repo.save(project)

      await repo.applyChanges({ delete: [], save: [validator.parse({ ...validInput, id: OTHER_ID })] })

      expect(await repo.listKeys()).toEqual([{ canonicalId: OTHER_ID, slug: SLUG }])
      expect(events).toEqual([{ type: 'project_removed', severity: 'info', slug: SLUG, canonicalId: PROJECT_ID }])
    })

    it('applyChanges swaps the slugs of two projects without losing or reporting either', async () => {
      const { repo, events } = await newRecordingRepository()
      await repo.save(project)
      await repo.save(validator.parse({ ...validInput, id: OTHER_ID, slug: 'autre-projet' }))

      await repo.applyChanges({
        delete: [],
        save: [
          validator.parse({ ...validInput, slug: 'autre-projet' }),
          validator.parse({ ...validInput, id: OTHER_ID }),
        ],
      })

      const keys = await repo.listKeys()
      expect(keys).toHaveLength(2)
      expect(keys).toEqual(
        expect.arrayContaining([
          { canonicalId: PROJECT_ID, slug: 'autre-projet' },
          { canonicalId: OTHER_ID, slug: SLUG },
        ]),
      )
      expect(events).toEqual([])
    })
  })

  it('listKeys lists every row, including one that no longer validates', async () => {
    const { db, repo } = await newRepository()
    await repo.save(project)
    await db.update(canonicalProjects).set({ data: '{not valid json' })

    expect(await repo.listKeys()).toEqual([{ canonicalId: PROJECT_ID, slug: SLUG }])
  })

  it('applyChanges deletes first, so a new id can take over an existing slug', async () => {
    const { repo } = await newRepository()
    await repo.save(project)
    const sameSlug = validator.parse({ ...validInput, id: OTHER_ID })

    await repo.applyChanges({ delete: [PROJECT_ID], save: [sameSlug] })

    expect((await repo.findAll()).map((p) => p.id)).toEqual([OTHER_ID])
  })

  it('applyChanges rolls everything back when one write fails', async () => {
    const events: CanonicalEvent[] = []
    const { repo } = await newRepository({ emit: (event) => events.push(event) })
    await repo.save(project)
    const takeover = validator.parse({ ...validInput, id: OTHER_ID })
    const other = validator.parse({ ...validInput, id: THIRD_ID, slug: 'autre-projet' })
    const broken = {
      toJSON: () => {
        throw new Error('unserializable')
      },
    } as unknown as CanonicalProject

    await expect(repo.applyChanges({ delete: [], save: [other, takeover, broken] })).rejects.toThrow('unserializable')

    // The eviction of the stored row is rolled back too, and nothing is reported.
    expect(await repo.listKeys()).toEqual([{ canonicalId: PROJECT_ID, slug: SLUG }])
    expect(events).toEqual([])
  })

  describe('next to the program table', () => {
    const program = new CanonicalProgramValidator().parse({
      id: PROJECT_ID,
      slug: SLUG,
      source: 'INTERNE',
      date_mise_a_jour: '2026-03-19T17:00:00+01:00',
      titre: 'Dispositif homonyme',
      description: 'Un dispositif qui porte le slug et l’identifiant du projet.',
      statut_edition: 'pret_prod',
      statut_dispositif: 'valide',
      types_aides: ['financement'],
      operateurs: { contact: { nom: 'ADEME' } },
    })

    async function newRepositories() {
      const db = await InMemoryCanonicalDb.create()
      return {
        programs: DrizzleCanonicalProgramRepository.fromDb(db),
        projects: DrizzleCanonicalProjectRepository.fromDb(db),
      }
    }

    it('a program and a project sharing a slug and an id coexist', async () => {
      const { programs, projects } = await newRepositories()
      await programs.save(program)
      await projects.save(project)

      expect((await programs.findBySlug(SLUG))?.toJSON()).toEqual(program.toJSON())
      expect((await projects.findBySlug(SLUG))?.toJSON()).toEqual(project.toJSON())
      expect(await programs.listKeys()).toEqual([{ canonicalId: PROJECT_ID, slug: SLUG }])
      expect(await projects.listKeys()).toEqual([{ canonicalId: PROJECT_ID, slug: SLUG }])
    })

    it('deleting on one side leaves the other untouched', async () => {
      const { programs, projects } = await newRepositories()
      await programs.save(program)
      await projects.save(project)

      await projects.delete(PROJECT_ID)
      expect(await projects.findAll()).toEqual([])
      expect(await programs.findAll()).toHaveLength(1)

      await projects.save(project)
      await programs.applyChanges({ delete: [PROJECT_ID], save: [] })
      expect(await programs.findAll()).toEqual([])
      expect(await projects.findAll()).toHaveLength(1)
    })
  })

  describe('format drift on read', () => {
    // Corrupts the stored `data` of the saved project, then returns the
    // repository and the events it recorded.
    async function withCorruptedRow(corruptData: string) {
      const events: CanonicalEvent[] = []
      const { db, repo } = await newRepository({ emit: (event) => events.push(event) })
      await repo.save(project)

      await db.update(canonicalProjects).set({ data: corruptData }).where(eq(canonicalProjects.slug, SLUG))

      return { repo, events }
    }

    it('drops a row that no longer validates and reports it as a read event', async () => {
      const { repo, events } = await withCorruptedRow(JSON.stringify({ slug: SLUG }))

      expect(await repo.findAll()).toEqual([])
      expect(await repo.findBySlug(SLUG)).toBeNull()

      const dropped = events.filter((e) => e.type === 'project_dropped')
      expect(dropped).toHaveLength(2)
      expect(dropped[0]).toMatchObject({ phase: 'read', slug: SLUG, canonicalId: PROJECT_ID })
      expect(dropped[0]?.errors.length).toBeGreaterThan(0)
    })

    it('drops an unparseable row instead of throwing, and reports it', async () => {
      const { repo, events } = await withCorruptedRow('{not valid json')

      expect(await repo.findAll()).toEqual([])
      expect(await repo.findBySlug(SLUG)).toBeNull()
      expect(events.filter((e) => e.type === 'project_dropped' && e.phase === 'read')).toHaveLength(2)
    })

    it('keeps serving the valid rows next to a dropped one', async () => {
      const events: CanonicalEvent[] = []
      const { db, repo } = await newRepository({ emit: (event) => events.push(event) })
      await repo.save(project)
      await repo.save(validator.parse({ ...validInput, id: OTHER_ID, slug: 'autre-projet' }))
      await db.update(canonicalProjects).set({ data: '{}' }).where(eq(canonicalProjects.slug, SLUG))

      expect((await repo.findAll()).map((p) => p.slug)).toEqual(['autre-projet'])
      expect(events.map((e) => e.type)).toEqual(['project_dropped'])
    })
  })
})
