import { describe, expect, it } from 'vitest'
import { varianteSchema } from './variante.schema'

describe('varianteSchema', () => {
  it('accepts a variant with conditions and at least one modification', () => {
    const result = varianteSchema.safeParse({
      conditions: { effectif: { min: 0, max: 49 }, regions: ['REG-53'] },
      modifications: { montant: '5 400 € HT' },
      autres_champs: { titre_historique: 'Ancien intitulé' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a variant with no condition', () => {
    const result = varianteSchema.safeParse({
      conditions: {},
      modifications: { montant: '5 400 € HT' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a variant with empty modifications', () => {
    const result = varianteSchema.safeParse({
      conditions: { regions: ['REG-53'] },
      modifications: {},
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-region COG code in conditions.regions', () => {
    const result = varianteSchema.safeParse({
      conditions: { regions: ['DEP-53'] },
      modifications: { montant: '5 400 € HT' },
    })
    expect(result.success).toBe(false)
  })

  it('preserves unknown keys in autres_champs', () => {
    const result = varianteSchema.parse({
      conditions: { regions: ['REG-53'] },
      modifications: { duree: '5 jours' },
      autres_champs: { libre: 'valeur' },
    })
    expect(result.autres_champs?.['libre']).toBe('valeur')
  })
})
