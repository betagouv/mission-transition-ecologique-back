import { describe, it, expect } from 'vitest'
import { RelationshipValidator } from '@/utils/RelationshipValidator'

// The Payload validator passes many runtime arguments we don't exercise here.
const validate = (value: unknown, options: Record<string, unknown>) =>
  RelationshipValidator.required(value as never, options as never)

describe('RelationshipValidator.required', () => {
  it('rejects an empty required relationship with an inline message', () => {
    expect(validate(null, { required: true })).toBe('Ce champ est requis.')
    expect(validate(undefined, { required: true })).toBe('Ce champ est requis.')
  })

  it('accepts an empty value when the field is optional', () => {
    expect(validate(null, { required: false })).toBe(true)
    expect(validate(undefined, {})).toBe(true)
  })

  // A populated value is delegated to Payload's built-in relationship
  // validation (filterOptions / id checks), covered by Payload itself.
})
