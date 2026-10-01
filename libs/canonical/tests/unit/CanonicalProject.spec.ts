import { describe, expect, it } from 'vitest'
import { CanonicalProjectValidator } from '../../src/canonical-project/CanonicalProjectValidator'
import { projectValidFull } from '../fixtures/project-valid-full'
import { projectValidMinimal } from '../fixtures/project-valid-minimal'

describe('CanonicalProject', () => {
  const validator = new CanonicalProjectValidator()

  it('deeply freezes the wrapped data', () => {
    const project = validator.parse(projectValidFull)
    expect(Object.isFrozen(project.data)).toBe(true)
    expect(Object.isFrozen(project.data.themes)).toBe(true)
    expect(Object.isFrozen(project.data.priorite?.par_secteur?.[0])).toBe(true)
    expect(Object.isFrozen(project.data.faq?.questions[0])).toBe(true)
  })

  it('rejects mutation of nested data at runtime', () => {
    const project = validator.parse(projectValidFull)
    expect(() => project.data.themes?.push('eau')).toThrow()
  })

  it('toMutable returns an unfrozen deep copy that does not affect the project', () => {
    const project = validator.parse(projectValidFull)
    const copy = project.toMutable()

    expect(Object.isFrozen(copy)).toBe(false)
    copy.themes?.push('eau')

    expect(copy.themes).toContain('eau')
    expect(project.data.themes).not.toContain('eau')
  })

  it('exposes the replacement of a remplace project', () => {
    const live = validator.parse(projectValidMinimal)
    const tombstone = validator.parse({
      ...(projectValidMinimal as Record<string, unknown>),
      statut_projet: 'remplace',
      remplace_par: 'r1b2c3d4e5f6g7h8i9j0klmn',
    })

    expect(live.isReplaced()).toBe(false)
    expect(live.remplacePar).toBeUndefined()
    expect(tombstone.isReplaced()).toBe(true)
    expect(tombstone.statutProjet).toBe('remplace')
    expect(tombstone.remplacePar).toBe('r1b2c3d4e5f6g7h8i9j0klmn')
  })
})
