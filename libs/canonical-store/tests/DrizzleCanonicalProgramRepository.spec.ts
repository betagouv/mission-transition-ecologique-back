import { describe, it, expect } from 'vitest'
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import { DrizzleCanonicalProgramRepository } from '../src/DrizzleCanonicalProgramRepository'

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
})
