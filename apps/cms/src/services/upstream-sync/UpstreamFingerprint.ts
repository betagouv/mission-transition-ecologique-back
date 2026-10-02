import { createHash } from 'node:crypto'

/**
 * Fingerprint of the data the upstream sync is about to write. Stored on the
 * document, it lets the next run skip a document upstream has not changed.
 * Computed from the Payload data (relations resolved), not from the upstream
 * record: a change in the mapping rewrites the documents on its own.
 */
export class UpstreamFingerprint {
  static of(value: unknown): string {
    return createHash('sha256').update(UpstreamFingerprint.serialize(value)).digest('hex')
  }

  /**
   * JSON with sorted keys and without `undefined`, so equal data always
   * serializes the same. The `id` of a rich text node is left out: the Markdown
   * converter draws a new random one (on links) at every conversion.
   */
  private static serialize(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
    if (Array.isArray(value)) return `[${value.map((item) => UpstreamFingerprint.serialize(item)).join(',')}]`
    const isRichTextNode = 'type' in value && 'version' in value
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key, item]) => item !== undefined && !(isRichTextNode && key === 'id'))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${UpstreamFingerprint.serialize(item)}`)
    return `{${entries.join(',')}}`
  }
}
