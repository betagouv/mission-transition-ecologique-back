import { describe, it, expect } from 'vitest'
import { CanonicalIdentityMap, CanonicalProgramService, CanonicalProjectService } from '@tee-backoffice/canonical'
import type { CanonicalEvent, CanonicalProgramInput, CanonicalProjectInput } from '@tee-backoffice/canonical'
import { DrizzleCanonicalProgramRepository } from '../src/DrizzleCanonicalProgramRepository'
import { DrizzleCanonicalProjectRepository } from '../src/DrizzleCanonicalProjectRepository'
import { InMemoryCanonicalDb } from '../src/testing/InMemoryCanonicalDb'

const DERIVED_PROGRAM_ID = 'a1b2c3d4e5f6g7h8i9j0klmn'
const CMS_PROGRAM_ID = 'b1b2c3d4e5f6g7h8i9j0klmn'
const DERIVED_PROJECT_ID = 'p1b2c3d4e5f6g7h8i9j0klmn'
const LINKING_PROJECT_ID = 'r1b2c3d4e5f6g7h8i9j0klmn'
const TOMBSTONE_PROJECT_ID = 's1b2c3d4e5f6g7h8i9j0klmn'
const CMS_PROJECT_ID = 't1b2c3d4e5f6g7h8i9j0klmn'

const programInput: CanonicalProgramInput = {
  id: DERIVED_PROGRAM_ID,
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

const projectInput: CanonicalProjectInput = {
  id: DERIVED_PROJECT_ID,
  slug: 'isolation-thermique',
  source: 'INTERNE',
  date_mise_a_jour: '2026-06-15T10:00:00+02:00',
  statut_projet: 'valide',
  titre: 'Isoler mon bâtiment',
  nom_court: 'Isolation',
  description_courte: 'Réduire les pertes de chaleur de vos locaux.',
  description_longue: { contenu: 'Une **isolation** performante réduit la facture.' },
  theme_principal: 'batiment',
}

const projectSnapshot: CanonicalProjectInput[] = [
  projectInput,
  {
    ...projectInput,
    id: LINKING_PROJECT_ID,
    slug: 'plan-action-eco-energie',
    dispositifs: [DERIVED_PROGRAM_ID],
    projets_lies: { projets: [DERIVED_PROJECT_ID] },
  },
  {
    ...projectInput,
    id: TOMBSTONE_PROJECT_ID,
    slug: 'isolation-des-murs',
    statut_projet: 'remplace',
    remplace_par: DERIVED_PROJECT_ID,
  },
]

async function newStore() {
  const db = await InMemoryCanonicalDb.create()
  const events: CanonicalEvent[] = []
  const sink = { emit: (event: CanonicalEvent) => events.push(event) }
  const programRepository = DrizzleCanonicalProgramRepository.fromDb(db, sink)
  const projectRepository = DrizzleCanonicalProjectRepository.fromDb(db, sink)
  const programs = new CanonicalProgramService(programRepository, sink)
  const projects = new CanonicalProjectService(projectRepository, sink)

  // What the daily import does: programs first, then projects pointed at the stored program ids.
  async function importUpstream() {
    await programs.applySnapshot([programInput])
    const stored = await programRepository.listKeys()
    const programIdentities = CanonicalIdentityMap.fromSnapshot(stored, [
      { id: DERIVED_PROGRAM_ID, slug: programInput.slug },
    ])
    return projects.applySnapshot(projectSnapshot, undefined, { programIdentities })
  }

  async function content() {
    const bySlug = <T extends { slug: string }>(a: T, b: T) => a.slug.localeCompare(b.slug)
    return {
      programs: (await programs.getAll()).map((program) => program.toJSON()).sort(bySlug),
      projects: (await projects.getAll()).map((project) => project.toJSON()).sort(bySlug),
    }
  }

  return { programs, projects, programRepository, projectRepository, events, importUpstream, content }
}

describe('identity of a stored entity across the CMS and the upstream import', () => {
  it('writes entities new to the store under the id they come with, twice the same', async () => {
    const store = await newStore()

    await store.importUpstream()
    const first = await store.content()
    await store.importUpstream()

    expect(await store.content()).toEqual(first)
    expect(first.programs.map((program) => program.id)).toEqual([DERIVED_PROGRAM_ID])
    expect(first.projects.map((project) => project.id).sort()).toEqual(
      [DERIVED_PROJECT_ID, LINKING_PROJECT_ID, TOMBSTONE_PROJECT_ID].sort(),
    )
    expect(store.events.filter((event) => event.type.endsWith('_removed'))).toEqual([])
  })

  it('keeps the id the CMS wrote, and points the references at it', async () => {
    const store = await newStore()
    await store.importUpstream()
    await store.programs.save({ ...programInput, id: CMS_PROGRAM_ID, titre: 'Titre du CMS' })
    await store.projects.save({ ...projectInput, id: CMS_PROJECT_ID, titre: 'Titre du CMS' })
    store.events.length = 0

    const report = await store.importUpstream()
    const afterImport = await store.content()

    expect(report.adopted).toEqual([{ canonicalId: CMS_PROJECT_ID, slug: 'isolation-thermique' }])
    expect(await store.programRepository.listKeys()).toEqual([
      { canonicalId: CMS_PROGRAM_ID, slug: 'diagnostic-energie-pme' },
    ])
    expect(afterImport.programs[0].titre).toBe('Diagnostic énergie PME')
    expect(afterImport.projects.map((project) => [project.slug, project.id])).toEqual([
      ['isolation-des-murs', TOMBSTONE_PROJECT_ID],
      ['isolation-thermique', CMS_PROJECT_ID],
      ['plan-action-eco-energie', LINKING_PROJECT_ID],
    ])
    expect(afterImport.projects[0].remplace_par).toBe(CMS_PROJECT_ID)
    expect(afterImport.projects[1].titre).toBe('Isoler mon bâtiment')
    expect(afterImport.projects[2].dispositifs).toEqual([CMS_PROGRAM_ID])
    expect(afterImport.projects[2].projets_lies?.projets).toEqual([CMS_PROJECT_ID])
    expect(store.events.filter((event) => event.type.endsWith('_removed'))).toEqual([])
    expect(store.events.filter((event) => event.type === 'project_saved')).toContainEqual({
      type: 'project_saved',
      severity: 'info',
      slug: 'isolation-thermique',
      canonicalId: CMS_PROJECT_ID,
    })

    await store.importUpstream()
    expect(await store.content()).toEqual(afterImport)
  })
})
