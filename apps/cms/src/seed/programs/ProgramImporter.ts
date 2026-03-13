import type { Payload } from 'payload'
import type { SourceProgram } from './types'
import type { ProgramMapper } from './ProgramMapper'
import { ProgressBar } from '@/utils/ProgressBar'

export interface ImportResult {
  created: number
  updated: number
  errors: number
}

export class ProgramImporter {
  constructor(
    private readonly payload: Payload,
    private readonly mapper: ProgramMapper,
  ) {}

  async import(programs: SourceProgram[], operatorIdByName: Map<string, number>): Promise<ImportResult> {
    const existingIdBySlug = await this.fetchExisting(programs.map((p) => p.id))

    const progress = new ProgressBar(programs.length)
    let created = 0
    let updated = 0
    let errors = 0

    await Promise.all(programs.map(async (program) => {
      try {
        const data = this.mapper.map(program, operatorIdByName)
        if (!data) {
          process.stderr.write(`Operator not found for program "${program.id}" — skipping.\n`)
          errors++
          return
        }

        const existingId = existingIdBySlug.get(program.id)
        if (existingId !== undefined) {
          await this.payload.update({ collection: 'programs', id: existingId, data })
          updated++
        } else {
          await this.payload.create({ collection: 'programs', data })
          created++
        }
      } catch (err) {
        process.stderr.write(`Error importing program "${program.id}": ${String(err)}\n`)
        errors++
      } finally {
        progress.tick()
      }
    }))

    progress.done()
    return { created, updated, errors }
  }

  private async fetchExisting(slugs: string[]): Promise<Map<string, number>> {
    const result = await this.payload.find({
      collection: 'programs',
      where: { slug: { in: slugs } },
      limit: slugs.length,
      depth: 0,
    })
    return new Map(result.docs.map((doc) => [doc.slug, doc.id]))
  }
}
