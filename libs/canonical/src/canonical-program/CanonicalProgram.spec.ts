import { describe, expect, it } from 'vitest'
import { CanonicalProgramValidator } from './CanonicalProgramValidator'
import { validFull } from '../__fixtures__/valid-full'

describe('CanonicalProgram immutability', () => {
  const validator = new CanonicalProgramValidator()

  it('deeply freezes the wrapped data', () => {
    const program = validator.parse(validFull)
    expect(Object.isFrozen(program.data)).toBe(true)
    expect(Object.isFrozen(program.data.themes)).toBe(true)
    expect(Object.isFrozen(program.data.operateurs.contact)).toBe(true)
  })

  it('rejects mutation of nested data at runtime', () => {
    const program = validator.parse(validFull)
    expect(() => program.data.themes?.push('eau')).toThrow()
  })

  it('toMutable returns an unfrozen deep copy that does not affect the program', () => {
    const program = validator.parse(validFull)
    const copy = program.toMutable()

    expect(Object.isFrozen(copy)).toBe(false)
    copy.themes?.push('eau')

    expect(copy.themes).toContain('eau')
    expect(program.data.themes).not.toContain('eau')
  })
})
