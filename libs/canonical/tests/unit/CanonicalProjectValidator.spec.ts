import { describe, expect, it } from 'vitest'
import { CanonicalProjectValidator } from '../../src/canonical-project/CanonicalProjectValidator'
import { CanonicalProject } from '../../src/canonical-project/CanonicalProject'
import { projectValidFull } from '../fixtures/project-valid-full'
import { projectValidMinimal } from '../fixtures/project-valid-minimal'

describe('CanonicalProjectValidator', () => {
  const validator = new CanonicalProjectValidator()

  it('returns a CanonicalProject on valid input', () => {
    const result = validator.validate(projectValidMinimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.project).toBeInstanceOf(CanonicalProject)
      expect(result.project.id).toBe('p1b2c3d4e5f6g7h8i9j0klmn')
      expect(result.project.slug).toBe('isolation-thermique')
      expect(result.project.statutProjet).toBe('valide')
    }
  })

  it('returns zod issues on invalid input', () => {
    const result = validator.validate({ slug: 'oops' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  it('parse() throws on invalid input', () => {
    expect(() => validator.parse({})).toThrow()
  })

  it('parse() round-trips full data through toJSON', () => {
    const json = validator.parse(projectValidFull).toJSON()
    expect(JSON.parse(JSON.stringify(json))).toEqual(projectValidFull)
  })
})
