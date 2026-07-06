import { fullProgram, minimalProgram } from '../__fixtures__/canonical-programs'
import { DescriptionTextBuilder } from './DescriptionTextBuilder'

describe('DescriptionTextBuilder', () => {
  describe('programme complet', () => {
    const text = DescriptionTextBuilder.build(fullProgram.data)

    it('reprend la description courte et plie montant/durée dans le texte', () => {
      expect(text).toContain('Un diagnostic financé pour les PME industrielles.')
      expect(text).toContain('montant du financement : Jusqu’à 70 % des dépenses')
      expect(text).toContain('durée de l’accompagnement : 8 jours de formation')
    })

    it('ajoute la phrase de variation (région ET taille)', () => {
      expect(text).toContain(
        "Le montant, le coût ou la durée de l'aide peuvent varier en fonction de la région et de la taille de l'entreprise",
      )
    })

    it('expose le contact email et les étapes avec liens', () => {
      expect(text).toContain('Contact public pour les questions sur le dispositif : contact@ademe.fr')
      expect(text).toContain('Étapes pour activer le dispositif :')
      expect(text).toContain('[Inscription](https://example.org/inscription)')
      expect(text).toContain('[mission transition écologique](https://mission-transition-ecologique.beta.gouv.fr')
    })

    it('ne contient jamais la description longue', () => {
      expect(text).not.toContain('Détail complet du dispositif')
    })
  })

  it('programme minimal : description seule, sans section parasite', () => {
    const text = DescriptionTextBuilder.build(minimalProgram.data)
    expect(text).toBe('Une **aide** pour réduire vos émissions.')
  })
})
