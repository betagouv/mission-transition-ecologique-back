import type { Theme } from '@tee-backoffice/canonical'
import { AgirThemeMapper } from './AgirThemeMapper'

describe('AgirThemeMapper', () => {
  it('passe les thèmes wire à l’identique', () => {
    expect(AgirThemeMapper.toAgir(['batiment', 'mobilite', 'dechets', 'eau', 'energie', 'rh'])).toEqual([
      'batiment',
      'mobilite',
      'dechets',
      'eau',
      'energie',
      'rh',
    ])
  })

  it('replie la famille environnement sur environnement', () => {
    expect(AgirThemeMapper.toAgir(['environnemental'])).toEqual(['environnement'])
    expect(AgirThemeMapper.toAgir(['ecoconception'])).toEqual(['environnement'])
    expect(AgirThemeMapper.toAgir(['biodiversite'])).toEqual(['environnement'])
  })

  it('déduplique après repli (environnemental + ecoconception → un seul environnement)', () => {
    const themes: Theme[] = ['energie', 'environnemental', 'ecoconception', 'biodiversite']
    expect(AgirThemeMapper.toAgir(themes)).toEqual(['energie', 'environnement'])
  })
})
