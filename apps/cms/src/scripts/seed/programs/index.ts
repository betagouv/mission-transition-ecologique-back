import type { Payload } from 'payload'
import { readFileSync } from 'fs'
import { SlugCanonicalId, TeeImporter, type TeeRecord } from '@tee-backoffice/format-adapters'
import { PayloadMarkdownToRichText } from '@/services/canonical/rich-text/PayloadMarkdownToRichText'
import { CanonicalToPayloadMapper } from '@/services/canonical/to-payload/CanonicalToPayloadMapper'
import { PayloadProgramRelations } from '@/services/canonical/to-payload/PayloadProgramRelations'
import { OperatorImporter } from './OperatorImporter'
import { ProgramImporter, type ImportResult } from './ProgramImporter'

/**
 * Loads upstream `programs.json` records into the CMS. The raw format is read by
 * `TeeImporter` only (the reader the canonical pipeline uses too), then
 * `CanonicalToPayloadMapper` turns each canonical program into Payload data.
 */
export class ProgramsSeed {
  constructor(
    private readonly payload: Payload,
    private readonly records: TeeRecord[],
  ) {}

  static fromFile(payload: Payload, path: string): ProgramsSeed {
    return new ProgramsSeed(payload, JSON.parse(readFileSync(path, 'utf-8')) as TeeRecord[])
  }

  async run(): Promise<ImportResult> {
    process.stdout.write(`Found ${this.records.length.toString()} programs in source.\n`)

    const importer = new TeeImporter()
    const programs = this.records.map((record) => {
      const input = importer.import(record)
      // Same id as the canonical import, so both writers address the same row.
      input.id = SlugCanonicalId.from(input.slug)
      return input
    })

    const operatorIdByName = await new OperatorImporter(this.payload).import(programs)
    const mapper = new CanonicalToPayloadMapper(
      await PayloadMarkdownToRichText.create(this.payload.config),
      await PayloadProgramRelations.fromPayload(this.payload, operatorIdByName),
    )

    process.stdout.write(`Operators ready. Importing ${programs.length.toString()} programs...\n`)
    const result = await new ProgramImporter(this.payload, mapper).import(programs)

    process.stdout.write(
      `Seed complete: ${result.created.toString()} created, ${result.updated.toString()} updated, ${result.errors.toString()} errors.\n`,
    )
    for (const [warning, count] of result.warnings) {
      process.stdout.write(`  ⚠ ${count.toString()} × ${warning}\n`)
    }
    return result
  }
}
