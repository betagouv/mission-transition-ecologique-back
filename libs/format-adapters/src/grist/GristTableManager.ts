import type { FetchLike } from './GristClient'
import type { GristConfig } from './GristConfig'
import { GRIST_COLUMNS } from './gristColumns'
import type { GristColumnSpec } from './gristColumns'

/** Outcome of {@link GristTableManager.prepareTable}, for the CLI recap. */
export interface PrepareTableResult {
  tableId: string
  created: boolean
  added: string[]
  removed: string[]
}

/**
 * Provisions the **structure** of the Grist dispositifs table (distinct from
 * writing rows, done by `GristClient`). Bootstrap a target document: create the
 * table if absent, then align its columns on {@link GRIST_COLUMNS} (add missing,
 * optionally prune Grist's default `A`/`B`/`C`). Idempotent — safe to re-run.
 *
 * Needed because neither the row upsert (`PUT …/records`) nor the data.gouv
 * widget creates columns: both assume the table already exists.
 */
export class GristTableManager {
  constructor(
    private readonly config: GristConfig,
    private readonly fetchFn: FetchLike = globalThis.fetch,
  ) {}

  async listTableIds(): Promise<string[]> {
    const body = await this.request<{ tables?: { id: string }[] }>('GET', '/tables', 'liste des tables')
    return (body.tables ?? []).map((table) => table.id)
  }

  async listColumnIds(tableId: string): Promise<string[]> {
    const body = await this.request<{ columns?: { id: string }[] }>(
      'GET',
      `/tables/${encodeURIComponent(tableId)}/columns`,
      'liste des colonnes',
    )
    return (body.columns ?? []).map((column) => column.id)
  }

  async prepareTable(options: { pruneExtraColumns?: boolean } = {}): Promise<PrepareTableResult> {
    const existing = await this.listTableIds()
    const present = existing.includes(this.config.tableId)
    const tableId = present ? this.config.tableId : await this.createTable()

    const desired = GRIST_COLUMNS.map((column) => column.colId)
    const current = await this.listColumnIds(tableId)
    const toAdd = GRIST_COLUMNS.filter((column) => !current.includes(column.colId))
    if (toAdd.length > 0) await this.addColumns(tableId, toAdd)

    let removed: string[] = []
    if (options.pruneExtraColumns) {
      const afterAdd = await this.listColumnIds(tableId)
      removed = afterAdd.filter((colId) => !desired.includes(colId))
      for (const colId of removed) await this.removeColumn(tableId, colId)
    }

    return { tableId, created: !present, added: toAdd.map((column) => column.colId), removed }
  }

  private async createTable(): Promise<string> {
    const body = await this.request<{ tables?: { id: string }[] }>('POST', '/tables', 'création de la table', {
      tables: [{ id: this.config.tableId, columns: GRIST_COLUMNS.map((column) => this.spec(column)) }],
    })
    return body.tables?.[0]?.id ?? this.config.tableId
  }

  private async addColumns(tableId: string, columns: readonly GristColumnSpec[]): Promise<void> {
    await this.request('POST', `/tables/${encodeURIComponent(tableId)}/columns`, 'ajout de colonnes', {
      columns: columns.map((column) => this.spec(column)),
    })
  }

  private async removeColumn(tableId: string, colId: string): Promise<void> {
    await this.request(
      'DELETE',
      `/tables/${encodeURIComponent(tableId)}/columns/${encodeURIComponent(colId)}`,
      `suppression de la colonne ${colId}`,
    )
  }

  private spec(column: GristColumnSpec): { id: string; fields: { label: string; type: string } } {
    return { id: column.colId, fields: { label: column.label, type: column.type } }
  }

  private async request<T>(method: string, path: string, action: string, body?: unknown): Promise<T> {
    const response = await this.fetchFn(`${this.config.apiBase()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Grist ${action} échoué (${response.status}) : ${await response.text()}`)
    const text = await response.text()
    return (text ? JSON.parse(text) : {}) as T
  }
}
