/**
 * Whether the versioned local copy (`static/upstream/`) may stand in for GitHub.
 * Off unless `TEE_UPSTREAM_LOCAL_FALLBACK` is set, and refused on Scalingo
 * (detected by its PostgreSQL addon DSN) even when set: a deployed job must
 * fail on an upstream outage, never publish a stale copy.
 */
export class UpstreamFallbackSettings {
  private constructor(
    readonly requested: boolean,
    readonly deployed: boolean,
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): UpstreamFallbackSettings {
    const flag = env['TEE_UPSTREAM_LOCAL_FALLBACK']?.trim().toLowerCase()
    return new UpstreamFallbackSettings(
      flag === '1' || flag === 'true',
      Boolean(env['SCALINGO_POSTGRESQL_URL']?.trim()),
    )
  }

  allowsLocalFallback(): boolean {
    if (this.requested && this.deployed) {
      throw new Error(
        'TEE_UPSTREAM_LOCAL_FALLBACK est interdit sur Scalingo : retirer la variable, le job doit échouer si GitHub est injoignable.',
      )
    }
    return this.requested
  }
}
