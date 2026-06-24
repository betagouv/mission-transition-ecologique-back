import type { Payload } from 'payload'
import { readFileSync } from 'fs'
import { editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { SourceProgram } from './types'
import { OperatorImporter } from './OperatorImporter'
import { ProgramMapper } from './ProgramMapper'
import { ProgramImporter } from './ProgramImporter'

export class ProgramsSeed {
  constructor(
    private readonly payload: Payload,
    private readonly programsPath: string,
  ) {}

  async run(): Promise<void> {
    process.stdout.write('Reading programs.json...\n')
    const programs = JSON.parse(readFileSync(this.programsPath, 'utf-8')) as SourceProgram[]
    process.stdout.write(`Found ${programs.length.toString()} programs in source file.\n`)

    const operatorIdByName = await new OperatorImporter(this.payload).import(programs)
    const geographicAreaIdByName = await this.fetchRegionIdByName()

    const editorConfig = await editorConfigFactory.default({ config: this.payload.config })
    const mapper = new ProgramMapper(editorConfig)

    process.stdout.write(`Operators ready. Importing ${programs.length.toString()} programs...\n`)
    const { created, updated, errors } = await new ProgramImporter(this.payload, mapper)
      .import(programs, operatorIdByName, geographicAreaIdByName)

    process.stdout.write(`Seed complete — ${created.toString()} created, ${updated.toString()} updated, ${errors.toString()} errors.\n`)
  }

  /**
   * region-level areas only: `allowedRegion` holds region names. Departments
   * share names (Guadeloupe, Mayotte…) and would break the round-trip.
   */
  private async fetchRegionIdByName(): Promise<Map<string, number>> {
    const result = await this.payload.find({
      collection: 'geographic-areas',
      where: { coverageType: { equals: 'region' } },
      limit: 0,
      depth: 0,
    })
    return new Map(result.docs.map((doc) => [doc.name, doc.id]))
  }
}
