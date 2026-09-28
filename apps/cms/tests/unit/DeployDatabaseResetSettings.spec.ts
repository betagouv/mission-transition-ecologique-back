import { describe, it, expect } from 'vitest'
import { DeployDatabaseResetSettings } from '@/config/DeployDatabaseResetSettings'

describe('DeployDatabaseResetSettings', () => {
  it('keeps the database by default', () => {
    expect(DeployDatabaseResetSettings.fromEnv({ APP: 'tee-preprod' }).isEnabled()).toBe(false)
  })

  it('resets when the flag names the current app', () => {
    const settings = DeployDatabaseResetSettings.fromEnv({
      TEE_RESET_DATABASE_ON_DEPLOY: ' tee-preprod ',
      APP: 'tee-preprod',
    })
    expect(settings.isEnabled()).toBe(true)
  })

  it('keeps the prod database when the preprod variables are copied over', () => {
    const settings = DeployDatabaseResetSettings.fromEnv({
      TEE_RESET_DATABASE_ON_DEPLOY: 'tee-preprod',
      APP: 'tee-prod',
    })
    expect(settings.isEnabled()).toBe(false)
    expect(settings.describe()).toContain('base conservée')
  })

  it('keeps the database when APP is missing', () => {
    const settings = DeployDatabaseResetSettings.fromEnv({ TEE_RESET_DATABASE_ON_DEPLOY: 'tee-preprod' })
    expect(settings.isEnabled()).toBe(false)
    expect(settings.describe()).toContain('APP absente')
  })

  it.each(['1', 'true'])('does not treat %j as an app name', (flag) => {
    expect(DeployDatabaseResetSettings.fromEnv({ TEE_RESET_DATABASE_ON_DEPLOY: flag, APP: 'tee-preprod' }).isEnabled()).toBe(false)
  })
})
