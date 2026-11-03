/**
 * Grist connection settings, read from the environment (never hard-coded).
 * `GRIST_BASE_URL` defaults to the interministerial Grist; `GRIST_DOC_ID`,
 * `GRIST_TABLE_ID` and `GRIST_API_KEY` are mandatory. `fromEnv` returns `null`
 * when any mandatory value is missing, so the CLI can fall back to a dry run
 * instead of crashing.
 */
export class GristConfig {
  private constructor(
    readonly apiUrl: string,
    readonly docId: string,
    readonly tableId: string,
    readonly apiKey: string,
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): GristConfig | null {
    const apiUrl = (env['GRIST_BASE_URL'] ?? 'https://grist.numerique.gouv.fr').replace(/\/+$/, '')
    const docId = env['GRIST_DOC_ID']
    const tableId = env['GRIST_TABLE_ID']
    const apiKey = env['GRIST_API_KEY']
    if (!docId || !tableId || !apiKey) return null
    return new GristConfig(apiUrl, docId, tableId, apiKey)
  }

  /**
   * Whether a missing Grist configuration should skip the step instead of failing:
   * `--if-configured` (CLI) or `GRIST_IF_CONFIGURED=1` (robust to nx arg forwarding).
   * Used by the daily pipeline, so an app without Grist doesn't fail every night.
   */
  static skipsWhenUnconfigured(argv: readonly string[] = process.argv, env: NodeJS.ProcessEnv = process.env): boolean {
    return argv.includes('--if-configured') || env['GRIST_IF_CONFIGURED'] === '1'
  }

  /** REST base for this document: `{baseUrl}/api/docs/{docId}`. */
  apiBase(): string {
    return `${this.apiUrl}/api/docs/${this.docId}`
  }

  recordsUrl(): string {
    return `${this.apiBase()}/tables/${this.tableId}/records`
  }
}
