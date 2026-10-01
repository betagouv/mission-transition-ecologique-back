import { describe, it, expect } from 'vitest'
import { nafCodeSchema } from '@tee-backoffice/canonical'
import { NafCodeValidator } from '@/utils/NafCodeValidator'

const INVALID = 'Code NAF invalide. Exemples attendus : C, 55, 55.3, 01.11Z.'

const validate = (value: string | null | undefined) =>
  NafCodeValidator.validate(value, {} as never)

const validateRequired = (value: string | null | undefined) =>
  NafCodeValidator.validate(value, { required: true } as never)

describe('NafCodeValidator', () => {
  it('accepts empty values on an optional field', () => {
    expect(validate(null)).toBe(true)
    expect(validate(undefined)).toBe(true)
    expect(validate('')).toBe(true)
  })

  it('rejects empty values on a required field', () => {
    expect(validateRequired(null)).toBe('Ce champ est requis.')
    expect(validateRequired(undefined)).toBe('Ce champ est requis.')
    expect(validateRequired('')).toBe('Ce champ est requis.')
  })

  // Payload stores the value as typed: a padded code would reach the pivot untrimmed.
  it.each(['C ', ' C', ' 55.3', '55.3 ', '01.11Z\n', '   '])('rejects the padded value "%s"', (code) => {
    expect(validate(code)).toBe(INVALID)
    expect(validateRequired(code)).toBe(INVALID)
  })

  it.each(['A', 'C', 'U', '55', '55.3', '86.1', '01.11', '01.11Z'])(
    'accepts the section or code %s',
    (code) => {
      expect(validateRequired(code)).toBe(true)
    },
  )

  it.each(['V', 'c', 'AB', '5', '555', '55.', '55.123', '55.3z', '55,3', 'default'])(
    'rejects %s',
    (code) => {
      expect(validateRequired(code)).toBe(INVALID)
    },
  )

  it('agrees with the canonical NAF code schema', () => {
    const samples = ['A', 'U', 'V', '55', '55.3', '01.11Z', '5', '55.', 'c', '55.123', 'C ', ' 55.3', '   ']
    for (const sample of samples) {
      expect(validateRequired(sample) === true).toBe(nafCodeSchema.safeParse(sample).success)
    }
  })
})
