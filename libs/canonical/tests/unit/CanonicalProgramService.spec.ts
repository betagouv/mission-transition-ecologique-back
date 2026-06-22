import { describe, it, expect } from 'vitest'
import { CanonicalProgramService } from '../../src/canonical-program/CanonicalProgramService'
import type { CanonicalProgram } from '../../src/canonical-program/CanonicalProgram'
import type { CanonicalProgramInput } from '../../src/canonical-program/canonical-program.types'
import type { CanonicalProgramRepository } from '../../src/canonical-program/CanonicalProgramRepository'

class InMemoryRepository implements CanonicalProgramRepository {
  readonly saved = new Map<string, CanonicalProgram>()
  async save(program: CanonicalProgram): Promise<void> {
    this.saved.set(program.slug, program)
  }
  async findBySlug(slug: string): Promise<CanonicalProgram | null> {
    return this.saved.get(slug) ?? null
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
})
