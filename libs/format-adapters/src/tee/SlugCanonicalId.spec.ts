import { cuid2Schema } from '@tee-backoffice/canonical'
import { SlugCanonicalId } from './SlugCanonicalId'

describe('SlugCanonicalId', () => {
  it('produit un id qui satisfait cuid2Schema', () => {
    expect(cuid2Schema.safeParse(SlugCanonicalId.from('pret-action-climat')).success).toBe(true)
  })

  it('est déterministe : même slug → même id', () => {
    expect(SlugCanonicalId.from('diagnostic-energie-pme')).toBe(SlugCanonicalId.from('diagnostic-energie-pme'))
  })

  it('distingue deux slugs', () => {
    expect(SlugCanonicalId.from('a')).not.toBe(SlugCanonicalId.from('b'))
  })
})
