import type { CanonicalProgramData } from '@tee-backoffice/canonical'
import { SecteurActiviteMapper } from './SecteurActiviteMapper'

type Eligibilite = CanonicalProgramData['eligibilite']

const eligibilite = (value: unknown): Eligibilite => value as Eligibilite
const withNaf = (inclusions: string[], exclusions?: string[]): Eligibilite =>
  eligibilite({ secteur_activite: { structure: { inclusions, exclusions } } })

describe('SecteurActiviteMapper', () => {
  describe('ciblage_secteur_activite', () => {
    it('défaut « tous secteurs d\'activité » sans restriction', () => {
      expect(SecteurActiviteMapper.toCiblageSecteur(undefined)).toBe("tous secteurs d'activité")
      expect(SecteurActiviteMapper.toCiblageSecteur(withNaf([]))).toBe("tous secteurs d'activité")
    })

    it('dérive un libellé de secteur depuis la section NAF', () => {
      expect(SecteurActiviteMapper.toCiblageSecteur(withNaf(['C']))).toBe('industrie')
    })

    it('surface IAA pour les divisions agroalimentaires (10/11)', () => {
      expect(SecteurActiviteMapper.toCiblageSecteur(withNaf(['10.11Z']))).toContain('IAA')
    })
  })

  describe('ciblage_naf', () => {
    it('joint les inclusions et exclusions NAF, undefined si vide', () => {
      expect(SecteurActiviteMapper.toCiblageNaf(withNaf(['C', '33.20']))).toBe('C|33.20')
      expect(SecteurActiviteMapper.toCiblageNafExclusions(withNaf(['C'], ['33.20']))).toBe('33.20')
      expect(SecteurActiviteMapper.toCiblageNaf(undefined)).toBeUndefined()
      expect(SecteurActiviteMapper.toCiblageNafExclusions(withNaf(['C']))).toBeUndefined()
    })
  })
})
