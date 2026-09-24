/**
 * Single entry point for every environment variable read by the CMS: no
 * `process.env` access anywhere else, so the settings, their defaults and their
 * fallbacks are visible in one place.
 */
export class Config {
  /**
   * PostgreSQL connection string. Scalingo injects the addon DSN as
   * SCALINGO_POSTGRESQL_URL on prod and preprod, so those environments need no
   * database variable of their own; DATABASE_URI is the local/CI override.
   */
  static databaseUrl(): string {
    return Config.required(
      Config.first('DATABASE_URI', 'SCALINGO_POSTGRESQL_URL'),
      'DATABASE_URI (locally) or SCALINGO_POSTGRESQL_URL (Scalingo)',
    )
  }

  /** Connection pool size. Small addon plans cap connections, so stay bounded. */
  static databasePoolMax(): number {
    return Config.number('DATABASE_POOL_MAX', 5)
  }

  static payloadSecret(): string {
    return Config.required(Config.string('PAYLOAD_SECRET'), 'PAYLOAD_SECRET')
  }

  /**
   * Public base URL for the absolute AGIR links, when the forwarded headers of
   * the reverse proxy are not enough. Undefined falls back to the request.
   */
  static publicBaseUrl(): string | undefined {
    return Config.string('PUBLIC_BASE_URL')
  }

  static isProduction(): boolean {
    return process.env.NODE_ENV === 'production'
  }

  private static string(name: string): string | undefined {
    const value = process.env[name]?.trim()
    return value ? value : undefined
  }

  private static first(...names: string[]): string | undefined {
    for (const name of names) {
      const value = Config.string(name)
      if (value) return value
    }
    return undefined
  }

  private static number(name: string, fallback: number): number {
    const value = Number(Config.string(name))
    return Number.isFinite(value) && value > 0 ? value : fallback
  }

  private static required(value: string | undefined, expected: string): string {
    if (!value) throw new Error(`Missing environment variable: set ${expected}.`)
    return value
  }
}
