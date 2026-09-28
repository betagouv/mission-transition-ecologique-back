/**
 * Whether a deploy wipes the database and reseeds it (preprod only). The flag
 * must hold the name of the Scalingo app it runs on (`APP`, injected by
 * Scalingo): copying the preprod variables to the prod app never enables it.
 */
export class DeployDatabaseResetSettings {
  private constructor(
    readonly requestedFor: string | undefined,
    readonly app: string | undefined,
  ) {}

  static fromEnv(env: Record<string, string | undefined> = process.env): DeployDatabaseResetSettings {
    return new DeployDatabaseResetSettings(
      env['TEE_RESET_DATABASE_ON_DEPLOY']?.trim() || undefined,
      env['APP']?.trim() || undefined,
    )
  }

  isEnabled(): boolean {
    return this.requestedFor !== undefined && this.requestedFor === this.app
  }

  describe(): string {
    if (this.requestedFor === undefined) return 'TEE_RESET_DATABASE_ON_DEPLOY absente, base conservée'
    if (this.app === undefined) return 'variable APP absente, base conservée par sécurité'
    if (!this.isEnabled()) {
      return `TEE_RESET_DATABASE_ON_DEPLOY vise « ${this.requestedFor} », pas l'app « ${this.app} » : base conservée`
    }
    return `réinitialisation de la base de l'app « ${this.app} »`
  }
}
