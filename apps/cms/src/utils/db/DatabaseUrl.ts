/**
 * Resolves the PostgreSQL connection string.
 *
 * Scalingo injects the addon DSN as SCALINGO_POSTGRESQL_URL on every app, so
 * production and preproduction need no database variable of their own;
 * DATABASE_URI stays the local/CI override and wins when set.
 */
export class DatabaseUrl {
  private static readonly PLATFORM_VARIABLE = 'SCALINGO_POSTGRESQL_URL'

  static resolve(): string {
    const url = process.env.DATABASE_URI || process.env[DatabaseUrl.PLATFORM_VARIABLE]
    if (!url) {
      throw new Error(
        `No database URL: set DATABASE_URI (locally) or ${DatabaseUrl.PLATFORM_VARIABLE} (Scalingo).`,
      )
    }
    return url
  }
}
