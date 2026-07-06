import { SchemaIdResolver } from './SchemaIdResolver'

const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('SchemaIdResolver', () => {
  it('produit un UUID v5 valide (version 5, variante RFC 4122)', () => {
    expect(SchemaIdResolver.toUuid('diagnostic-energie-pme')).toMatch(UUID_V5)
  })

  it('est déterministe : même slug → même UUID', () => {
    expect(SchemaIdResolver.toUuid('aide-decarbonation-industrie')).toBe(
      SchemaIdResolver.toUuid('aide-decarbonation-industrie'),
    )
  })

  it('distingue deux slugs différents', () => {
    expect(SchemaIdResolver.toUuid('a')).not.toBe(SchemaIdResolver.toUuid('b'))
  })

  it('correspond à la valeur v5 de référence (uuid package)', () => {
    expect(SchemaIdResolver.toUuid('diagnostic-energie-pme')).toBe('f2b1643e-9f6e-564f-a492-a647575a7617')
  })
})
