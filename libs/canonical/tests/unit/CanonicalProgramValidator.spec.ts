import { describe, expect, it } from 'vitest'
import { CanonicalProgramValidator } from '../../src/canonical-program/CanonicalProgramValidator'
import { CanonicalProgram } from '../../src/canonical-program/CanonicalProgram'
import { validFull } from '../fixtures/valid-full'
import { validMinimal } from '../fixtures/valid-minimal'

describe('CanonicalProgramValidator', () => {
  const validator = new CanonicalProgramValidator()

  it('returns a CanonicalProgram on valid input', () => {
    const result = validator.validate(validMinimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.program).toBeInstanceOf(CanonicalProgram)
      expect(result.program.slug).toBe('aide-decarbonation-industrie')
      expect(result.program.isActive()).toBe(true)
      expect(result.program.operateurContact.nom).toBe('ADEME')
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

  it('parse() round-trips full data through toJSON without losing open keys', () => {
    const program = validator.parse(validFull)
    const json = program.toJSON()
    expect(json.autres_donnees?.['ademe_id_dsp']).toBe('DSP-000123')
    expect(json.themes).toEqual(['energie', 'batiment'])
  })
})
