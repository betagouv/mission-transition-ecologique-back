import { AgirContactMapper } from './AgirContactMapper'

describe('AgirContactMapper', () => {
  it('met le canal ADEME en minuscule', () => {
    expect(AgirContactMapper.toAgir({ type: 'ADEME' })).toEqual({ type: 'ademe' })
  })

  it('laisse les autres canaux inchangés', () => {
    expect(AgirContactMapper.toAgir({ type: 'conseiller_entreprise' })).toEqual({
      type: 'conseiller_entreprise',
    })
    expect(AgirContactMapper.toAgir({ type: 'email', valeur: 'contact@ademe.fr' })).toEqual({
      type: 'email',
      valeur: 'contact@ademe.fr',
    })
    expect(AgirContactMapper.toAgir({ type: 'url', valeur: 'https://example.org/form' })).toEqual({
      type: 'url',
      valeur: 'https://example.org/form',
    })
  })
})
