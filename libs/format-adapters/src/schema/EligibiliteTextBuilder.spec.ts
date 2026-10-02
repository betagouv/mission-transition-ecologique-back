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

  it("signale l'ouverture aux administrations publiques", () => {
    const text = EligibiliteTextBuilder.build({
      categorie_legale: { structure: { autorise: ['administration_publique'] } },
    })
    expect(text).toBe('- Effectif éligible : Toutes tailles\n- Ouvert aux administrations publiques')
  })

  it("n'en dit rien pour un dispositif réservé aux entreprises", () => {
    expect(EligibiliteTextBuilder.build(fullProgram.data.eligibilite)).not.toContain('administrations publiques')
  })

  it('défaut « Toutes tailles » et résultat non vide sans éligibilité', () => {
    expect(EligibiliteTextBuilder.build(undefined)).toBe('- Effectif éligible : Toutes tailles')
  })
})
