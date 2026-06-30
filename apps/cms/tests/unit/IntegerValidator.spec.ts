import { describe, it, expect } from 'vitest'
import { IntegerValidator } from '@/utils/IntegerValidator'

const validate = (value: unknown) =>
  IntegerValidator.nonNegative(value as never, {} as never)

describe('IntegerValidator.nonNegative', () => {
  it('accepts empty values (optional field)', () => {
    expect(validate(null)).toBe(true)
    expect(validate(undefined)).toBe(true)
  })

  it('accepts non-negative integers', () => {
    expect(validate(0)).toBe(true)
    expect(validate(250)).toBe(true)
  })

  it('rejects non-integer numbers', () => {
    expect(validate(3.5)).toBe('Saisissez un nombre entier.')
  })

  it('rejects negative numbers', () => {
    expect(validate(-1)).toBe('Saisissez un nombre positif ou nul.')
  })
})
