import { describe, it, expect } from 'vitest'
import { DeployDatabaseResetSettings } from '@/config/DeployDatabaseResetSettings'

describe('DeployDatabaseResetSettings', () => {
  it('keeps the database by default', () => {
    const settings = DeployDatabaseResetSettings.fromEnv({ APP: 'tee-back-preprod' })
    expect(settings.isEnabled()).toBe(false)
    expect(settings.describe()).toContain('base conservée')
  })

  it.each(['1', 'true', ' TRUE '])('resets when the flag is %j', (flag) => {
    const settings = DeployDatabaseResetSettings.fromEnv({ TEE_RESET_DATABASE_ON_DEPLOY: flag, APP: 'tee-back-preprod-pr61' })
    expect(settings.isEnabled()).toBe(true)
    expect(settings.describe()).toContain('tee-back-preprod-pr61')
  })

  it('resets without APP', () => {
    expect(DeployDatabaseResetSettings.fromEnv({ TEE_RESET_DATABASE_ON_DEPLOY: '1' }).isEnabled()).toBe(true)
  })

  it.each(['0', 'false', 'tee-back-preprod'])('keeps the database when the flag is %j', (flag) => {
    const settings = DeployDatabaseResetSettings.fromEnv({ TEE_RESET_DATABASE_ON_DEPLOY: flag })
    expect(settings.isEnabled()).toBe(false)
    expect(settings.describe()).toContain('attendu : 1 ou true')
  })
})
