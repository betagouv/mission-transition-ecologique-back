import { GristConfig } from './GristConfig'

describe('GristConfig', () => {
  it('retourne null si une valeur obligatoire manque', () => {
    expect(GristConfig.fromEnv({ GRIST_DOC_ID: 'doc' })).toBeNull()
    expect(GristConfig.fromEnv({})).toBeNull()
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
