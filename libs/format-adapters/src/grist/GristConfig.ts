/**
 * Grist connection settings, read from the environment (never hard-coded).
 * `GRIST_BASE_URL` defaults to the interministerial Grist. `GRIST_API_KEY`
 * enables Grist: without it `fromEnv` returns `null` and the scripts skip their
 * step; with it, `GRIST_DOC_ID` and `GRIST_TABLE_ID` are mandatory.
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
    if (!apiKey) return null
    if (!docId || !tableId) {
      throw new Error('GRIST_API_KEY est définie mais GRIST_DOC_ID ou GRIST_TABLE_ID manque.')
    }
    return new GristConfig(apiUrl, docId, tableId, apiKey)
  }

  /** REST base for this document: `{baseUrl}/api/docs/{docId}`. */
  apiBase(): string {
    return `${this.apiUrl}/api/docs/${this.docId}`
  }

  recordsUrl(): string {
    return `${this.apiBase()}/tables/${this.tableId}/records`
  }
}
