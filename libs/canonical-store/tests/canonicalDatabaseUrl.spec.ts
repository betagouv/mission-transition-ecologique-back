import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveCanonicalDatabaseUrl } from '../src/canonicalDatabaseUrl'

describe('resolveCanonicalDatabaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers CANONICAL_DATABASE_URI', () => {
    vi.stubEnv('CANONICAL_DATABASE_URI', ' postgres://local/tee ')
    vi.stubEnv('SCALINGO_POSTGRESQL_URL', 'postgres://scalingo/tee')
    expect(resolveCanonicalDatabaseUrl()).toBe('postgres://local/tee')
  })

  it('falls back to SCALINGO_POSTGRESQL_URL when the first one is empty', () => {
    vi.stubEnv('CANONICAL_DATABASE_URI', '  ')
    vi.stubEnv('SCALINGO_POSTGRESQL_URL', 'postgres://scalingo/tee')
    expect(resolveCanonicalDatabaseUrl()).toBe('postgres://scalingo/tee')
  })

  it('throws an explicit error when no variable is set', () => {
    vi.stubEnv('CANONICAL_DATABASE_URI', '')
    vi.stubEnv('SCALINGO_POSTGRESQL_URL', '')
    expect(() => resolveCanonicalDatabaseUrl()).toThrow(/CANONICAL_DATABASE_URI.*SCALINGO_POSTGRESQL_URL/)
  })
})
