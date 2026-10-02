import { describe, it, expect } from 'vitest'
import { IntegerValidator } from '@/utils/IntegerValidator'

const validate = (value: unknown) =>
  IntegerValidator.nonNegative(value as never, {} as never)

const validateRequired = (value: unknown) =>
  IntegerValidator.nonNegative(value as never, { required: true } as never)

describe('IntegerValidator.nonNegative', () => {
  it('accepts empty values (optional field)', () => {
    expect(validate(null)).toBe(true)
    expect(validate(undefined)).toBe(true)
  })

  it('rejects empty values on a required field', () => {
    expect(validateRequired(null)).toBe('Ce champ est requis.')
    expect(validateRequired(undefined)).toBe('Ce champ est requis.')
  })

  it('accepts non-negative integers', () => {
    expect(validate(0)).toBe(true)
    expect(validate(250)).toBe(true)
    expect(validateRequired(0)).toBe(true)
    expect(validateRequired(3)).toBe(true)
  })

  it('rejects non-integer numbers', () => {
    expect(validate(3.5)).toBe('Saisissez un nombre entier.')
    expect(validateRequired(1.5)).toBe('Saisissez un nombre entier.')
  })

  it('rejects negative numbers', () => {
    expect(validate(-1)).toBe('Saisissez un nombre positif ou nul.')
    expect(validateRequired(-1)).toBe('Saisissez un nombre positif ou nul.')
  })
})
