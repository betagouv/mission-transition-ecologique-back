import { fullProgram } from '../__fixtures__/canonical-programs'
import { EligibiliteTextBuilder } from './EligibiliteTextBuilder'

describe('EligibiliteTextBuilder', () => {
  describe('programme complet', () => {
    const text = EligibiliteTextBuilder.build(fullProgram.data.eligibilite)

    it('une puce par critère, repliant la structure dans le texte', () => {
      expect(text).toContain('- Éligibilité sectorielle : Industrie')
      expect(text).toContain('- Codes NAF concernés : C')
      expect(text).toContain('- Effectif éligible : 0 - 249')
      expect(text).toContain("- Ancienneté de l'entreprise : Plus de 2 ans d’existence")
      expect(text).toContain('- Autres conditions : Être à jour de ses cotisations sociales')
    })

    it('signale l\'exclusion micro-entrepreneur', () => {
      expect(text).toContain('- Non éligible aux micro-entrepreneurs')
    })

    it('n\'ajoute pas d\'aires géographiques pour une couverture nationale', () => {
      expect(text).not.toContain('Aires géographiques éligibles')
    })
  })

  it('défaut « Toutes tailles » et résultat non vide sans éligibilité', () => {
    expect(EligibiliteTextBuilder.build(undefined)).toBe('- Effectif éligible : Toutes tailles')
  })
})
