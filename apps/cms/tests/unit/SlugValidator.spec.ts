import { describe, it, expect } from 'vitest'
import { slugSchema } from '@tee-backoffice/canonical'
import { SlugValidator } from '@/utils/SlugValidator'

const INVALID =
  'Identifiant invalide : minuscules sans accent, chiffres et tirets uniquement (ex : plan-action-energie).'

const validate = (value: string | null | undefined) => SlugValidator.validate(value, {} as never)

const validateRequired = (value: string | null | undefined) =>
  SlugValidator.validate(value, { required: true } as never)

describe('SlugValidator', () => {
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

  it.each(['plan-action-energie', 'audit', 'diag-360', '2030-objectif'])('accepts the kebab-case slug %s', (slug) => {
    expect(validateRequired(slug)).toBe(true)
  })

  it.each([
    'Plan-Action',
    'plan_action',
    'maintenance-préventive',
    'plan action',
    ' plan-action',
    'plan-action ',
    '-plan',
    'plan-',
    'plan--action',
    'plan-action - Copy',
  ])('rejects "%s"', (slug) => {
    expect(validateRequired(slug)).toBe(INVALID)
  })

  it('agrees with the canonical slug schema', () => {
    const samples = ['plan-action', 'Plan-Action', 'plan_action', 'plan-', 'a', '9', 'é', 'plan action']
    for (const sample of samples) {
      expect(validateRequired(sample) === true).toBe(slugSchema.safeParse(sample).success)
    }
  })
})
