import { UpstreamFallbackSettings } from './UpstreamFallbackSettings'

describe('UpstreamFallbackSettings', () => {
  it('désactive le repli par défaut', () => {
    expect(UpstreamFallbackSettings.fromEnv({}).allowsLocalFallback()).toBe(false)
  })

  it.each(['1', 'true', ' TRUE '])('active le repli pour TEE_UPSTREAM_LOCAL_FALLBACK=%j', (flag) => {
    expect(UpstreamFallbackSettings.fromEnv({ TEE_UPSTREAM_LOCAL_FALLBACK: flag }).allowsLocalFallback()).toBe(true)
  })

  it.each(['0', 'false', ''])('laisse le repli désactivé pour %j', (flag) => {
    expect(UpstreamFallbackSettings.fromEnv({ TEE_UPSTREAM_LOCAL_FALLBACK: flag }).allowsLocalFallback()).toBe(false)
  })

  it('refuse le repli demandé sur Scalingo', () => {
    const settings = UpstreamFallbackSettings.fromEnv({
      TEE_UPSTREAM_LOCAL_FALLBACK: '1',
      SCALINGO_POSTGRESQL_URL: 'postgres://addon',
    })
    expect(() => settings.allowsLocalFallback()).toThrow('interdit sur Scalingo')
  })

  it('reste sans repli sur Scalingo quand rien n’est demandé', () => {
    const settings = UpstreamFallbackSettings.fromEnv({ SCALINGO_POSTGRESQL_URL: 'postgres://addon' })
    expect(settings.allowsLocalFallback()).toBe(false)
  })
})
