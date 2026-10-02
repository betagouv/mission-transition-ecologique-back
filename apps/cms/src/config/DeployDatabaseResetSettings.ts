/**
 * Whether a deploy wipes the database and reseeds it (preprod only). Opt-in with
 * TEE_RESET_DATABASE_ON_DEPLOY=1 (or true): the flag cannot hold the app name,
 * since the preprod review apps get a new name for every pull request.
 */
export class DeployDatabaseResetSettings {
  private static readonly ENABLED_VALUES = ['1', 'true']

  private constructor(
    readonly flag: string | undefined,
    readonly app: string | undefined,
  ) {}

  static fromEnv(env: Record<string, string | undefined> = process.env): DeployDatabaseResetSettings {
    return new DeployDatabaseResetSettings(
      env['TEE_RESET_DATABASE_ON_DEPLOY']?.trim().toLowerCase() || undefined,
      env['APP']?.trim() || undefined,
    )
  }

  isEnabled(): boolean {
    return this.flag !== undefined && DeployDatabaseResetSettings.ENABLED_VALUES.includes(this.flag)
  }

  describe(): string {
    if (this.flag === undefined) return 'TEE_RESET_DATABASE_ON_DEPLOY absente, base conservée'
    if (!this.isEnabled()) return `TEE_RESET_DATABASE_ON_DEPLOY vaut « ${this.flag} » (attendu : 1 ou true), base conservée`
    return this.app ? `réinitialisation de la base de l'app « ${this.app} »` : 'réinitialisation de la base'
  }
}
