import type { GristConfig } from './GristConfig'
import type { GristRecord } from './grist.types'

/** Minimal `fetch` shape, injectable so tests avoid real network calls. */
export type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

/**
 * Writes Grist records through the REST API, upserting on the `slug` business
 * key (`PUT …/records` with `require`), so re-running the export updates rows in
 * place rather than duplicating them.
 *
 * Records carry the full canonical under `technical`, so the whole feed in one
 * request blows past Grist's body-size limit (413). The upsert is therefore
 * split into byte-bounded batches, sent sequentially.
 */
export class GristClient {
  /** Conservative per-request body budget; Grist rejects oversized bodies (413). */
  private static readonly DEFAULT_MAX_REQUEST_BYTES = 500_000

  constructor(
    private readonly config: GristConfig,
    private readonly fetchFn: FetchLike = globalThis.fetch,
    private readonly maxRequestBytes: number = GristClient.DEFAULT_MAX_REQUEST_BYTES,
  ) {}

  async upsertMany(records: readonly GristRecord[]): Promise<void> {
    for (const batch of this.batches(records)) {
      await this.putBatch(batch)
    }
  }

  /** Greedily packs records into batches whose JSON body stays under the budget. */
  private *batches(records: readonly GristRecord[]): Generator<GristRecord[]> {
    let batch: GristRecord[] = []
    let size = 0
    for (const record of records) {
      const recordSize = JSON.stringify(record).length
      if (batch.length > 0 && size + recordSize > this.maxRequestBytes) {
        yield batch
        batch = []
        size = 0
      }
      batch.push(record)
      size += recordSize
    }
    if (batch.length > 0) yield batch
  }

  private async putBatch(batch: readonly GristRecord[]): Promise<void> {
    const body = JSON.stringify({
      records: batch.map((record) => ({ require: { slug: record.slug }, fields: record })),
    })

    const response = await this.fetchFn(this.config.recordsUrl(), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    })

    if (!response.ok) {
      throw new Error(`Grist upsert échoué (${response.status}) : ${await response.text()}`)
    }
  }
}
