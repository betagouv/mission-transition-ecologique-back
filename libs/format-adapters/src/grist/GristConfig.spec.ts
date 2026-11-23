import { GristConfig } from './GristConfig'

describe('GristConfig', () => {
  it('retourne null sans clé API : Grist désactivé', () => {
    expect(GristConfig.fromEnv({ GRIST_DOC_ID: 'doc', GRIST_TABLE_ID: 't' })).toBeNull()
    expect(GristConfig.fromEnv({})).toBeNull()
  })

  it('échoue si la clé API est là mais que le document ou la table manque', () => {
    expect(() => GristConfig.fromEnv({ GRIST_API_KEY: 'k', GRIST_TABLE_ID: 't' })).toThrow(/GRIST_DOC_ID/)
    expect(() => GristConfig.fromEnv({ GRIST_API_KEY: 'k', GRIST_DOC_ID: 'd' })).toThrow(/GRIST_TABLE_ID/)
  })

  it('construit l\'URL des records, instance par défaut', () => {
    const config = GristConfig.fromEnv({ GRIST_DOC_ID: 'doc', GRIST_TABLE_ID: 'Dispositifs', GRIST_API_KEY: 'k' })
    expect(config?.recordsUrl()).toBe('https://grist.numerique.gouv.fr/api/docs/doc/tables/Dispositifs/records')
    expect(config?.apiKey).toBe('k')
  })

  it('respecte une instance custom et supprime le slash final', () => {
    const config = GristConfig.fromEnv({
      GRIST_BASE_URL: 'https://grist.example.org/',
      GRIST_DOC_ID: 'd',
      GRIST_TABLE_ID: 't',
      GRIST_API_KEY: 'k',
    })
    expect(config?.recordsUrl()).toBe('https://grist.example.org/api/docs/d/tables/t/records')
  })
})
