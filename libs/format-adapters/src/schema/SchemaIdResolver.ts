import { createHash } from 'node:crypto'

/**
 * Derives the Etalab `id` (RFC 4122 UUID v5) from the canonical slug. The schema
 * requires `format: uuid` and the canonical cuid2 is not one; a name-based v5
 * keeps the id deterministic and stable across exports (same slug → same UUID),
 * which the upstream `previousId` lookup needed in the legacy CSV exporter.
 *
 * Implemented on `node:crypto` (SHA-1) to keep the package dependency-free; the
 * output is byte-identical to the `uuid` package's `v5`.
 */
export class SchemaIdResolver {
  /** Fixed TEE namespace UUID for the dispositif-aide schema. */
  private static readonly NAMESPACE = '5f9b6d2e-3c4a-4b1d-8e7f-0a1b2c3d4e5f'

  static toUuid(slug: string): string {
    const namespaceBytes = Buffer.from(SchemaIdResolver.NAMESPACE.replace(/-/g, ''), 'hex')
    const hash = createHash('sha1').update(namespaceBytes).update(Buffer.from(slug, 'utf8')).digest()
    const bytes = hash.subarray(0, 16)
    bytes[6] = (bytes[6] & 0x0f) | 0x50 // version 5
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
    const hex = bytes.toString('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
}
