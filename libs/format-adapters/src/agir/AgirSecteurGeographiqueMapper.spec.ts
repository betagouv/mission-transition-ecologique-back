import type { Eligibilite } from '@tee-backoffice/canonical'
import { AgirSecteurGeographiqueMapper } from './AgirSecteurGeographiqueMapper'

const withArea = (structure: NonNullable<Eligibilite['secteur_geographique']>['structure']): Eligibilite => ({
  secteur_geographique: { texte: ['Toute la France'], structure },
})

describe('AgirSecteurGeographiqueMapper', () => {
  it('exprime un dispositif national par une liste inclusions vide', () => {
    const out = AgirSecteurGeographiqueMapper.toAgir(withArea({ inclusions: ['PAYS-99100'] }))
    expect(out.secteur_geographique).toEqual({ texte: ['Toute la France'], structure: { inclusions: [] } })
  })

  it('garde les exclusions d’un dispositif national', () => {
    const out = AgirSecteurGeographiqueMapper.toAgir(withArea({ inclusions: ['PAYS-99100'], exclusions: ['REG-94'] }))
    expect(out.secteur_geographique?.structure).toEqual({ inclusions: [], exclusions: ['REG-94'] })
  })

  it('ne touche pas un dispositif régional ou départemental', () => {
    const regional = withArea({ inclusions: ['REG-53', 'DEP-35'] })
    expect(AgirSecteurGeographiqueMapper.toAgir(regional)).toBe(regional)
  })

  it('ne vide pas une liste où la France est mêlée à d’autres codes', () => {
    const mixed = withArea({ inclusions: ['PAYS-99100', 'REG-53'] })
    expect(AgirSecteurGeographiqueMapper.toAgir(mixed).secteur_geographique?.structure?.inclusions).toEqual([
      'PAYS-99100',
      'REG-53',
    ])
  })

  it('laisse intacts une éligibilité sans secteur géographique et l’objet source', () => {
    const input = withArea({ inclusions: ['PAYS-99100'] })
    AgirSecteurGeographiqueMapper.toAgir(input)
    expect(input.secteur_geographique?.structure?.inclusions).toEqual(['PAYS-99100'])
    const noArea: Eligibilite = { anciennete: { texte: ['Plus de 2 ans'] } }
    expect(AgirSecteurGeographiqueMapper.toAgir(noArea)).toBe(noArea)
  })

  it('vide une liste d’inclusions nationale pour le détail, garde les autres', () => {
    expect(AgirSecteurGeographiqueMapper.toAgirInclusions(['PAYS-99100'])).toEqual([])
    expect(AgirSecteurGeographiqueMapper.toAgirInclusions(['REG-53'])).toEqual(['REG-53'])
    expect(AgirSecteurGeographiqueMapper.toAgirInclusions(['PAYS-99100', 'REG-53'])).toEqual(['PAYS-99100', 'REG-53'])
  })
})
