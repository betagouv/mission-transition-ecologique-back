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

  describe('forProject', () => {
    it('produit un id stable qui satisfait cuid2Schema', () => {
      const id = SlugCanonicalId.forProject('plan-action-eco-energie')
      expect(cuid2Schema.safeParse(id).success).toBe(true)
      expect(SlugCanonicalId.forProject('plan-action-eco-energie')).toBe(id)
    })

    it("ne coïncide jamais avec l'id d'un dispositif de même slug", () => {
      expect(SlugCanonicalId.forProject('audit-energetique')).not.toBe(SlugCanonicalId.from('audit-energetique'))
    })

    // Pinned: the `canonical_projects` migration recomputes this value in SQL (sha256 of `project:<slug>`).
    it('garde la valeur que la migration recalcule en SQL', () => {
      expect(SlugCanonicalId.forProject('diag-360')).toBe('c92ad7285be0d6d9bf9743d8')
      expect(SlugCanonicalId.forProject('maintenance-préventive')).toBe('c7cb81efa2035a1cf0fb5f6a')
    })
  })
})
