import { describe, it, expect } from 'vitest'
import { RequiredTextValidator } from '@/utils/RequiredTextValidator'

const REQUIRED = 'Ce champ est requis.'

// Payload's built-in validation, which a filled value is delegated to, reads the config and `t`.
const options = (overrides: Record<string, unknown> = {}) =>
  ({ req: { payload: { config: {} }, t: (key: string) => key }, ...overrides }) as never

const validators = [
  ['text', RequiredTextValidator.text],
  ['textarea', RequiredTextValidator.textarea],
] as const

describe.each(validators)('RequiredTextValidator.%s', (_name, validate) => {
  it.each([null, undefined, ''])('rejects the empty value %j on a required field', (value) => {
    expect(validate(value, options({ required: true }))).toBe(REQUIRED)
  })

  it.each([' ', '   ', '\t', '\n', ' \n\t ', ' '])('rejects the blank value %j on a required field', (value) => {
    expect(validate(value, options({ required: true }))).toBe(REQUIRED)
  })

  it('accepts a filled value, surrounding whitespace included', () => {
    expect(validate('Titre', options({ required: true }))).toBe(true)
    expect(validate('  Titre  ', options({ required: true }))).toBe(true)
  })

  it('accepts empty and blank values on an optional field', () => {
    expect(validate(null, options())).toBe(true)
    expect(validate(undefined, options({ required: false }))).toBe(true)
    expect(validate('', options())).toBe(true)
    expect(validate('   ', options())).toBe(true)
  })

  it('keeps the built-in length checks', () => {
    expect(validate('Titre trop long', options({ required: true, maxLength: 5 }))).toBe('validation:shorterThanMax')
    expect(validate('Titre', options({ required: true, maxLength: 5 }))).toBe(true)
  })
})
