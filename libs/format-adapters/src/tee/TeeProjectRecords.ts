import { teeProjectSchema } from './tee-project.schema'
import type { TeeProject } from './tee-project.schema'

/** An upstream record set aside because its shape is broken. */
export interface RejectedTeeProject {
  /** Position of the record in the upstream file. */
  index: number
  /** Present when the record still carries a readable slug. */
  slug?: string
  /** The broken fields, as `field : message` joined by ` ; `. */
  reason: string
}

export interface TeeProjectReadResult {
  projects: TeeProject[]
  rejected: RejectedTeeProject[]
}

/**
 * Shape check of a raw upstream `projects.json`, one record at a time: a broken
 * record is set aside and reported, the others still feed the import. Only a
 * file that is not a list fails as a whole.
 */
export class TeeProjectRecords {
  static parse(raw: unknown): TeeProjectReadResult {
    if (!Array.isArray(raw)) throw new Error('projects.json amont invalide : un tableau de projets est attendu')

    const projects: TeeProject[] = []
    const rejected: RejectedTeeProject[] = []
    raw.forEach((record: unknown, index) => {
      const result = teeProjectSchema.safeParse(record)
      if (result.success) {
        projects.push(result.data)
        return
      }
      const slug = TeeProjectRecords.readableSlug(record)
      const reason = result.error.issues
        .map((issue) => `${issue.path.join('.') || '(enregistrement)'} : ${issue.message}`)
        .join(' ; ')
      rejected.push(slug === undefined ? { index, reason } : { index, slug, reason })
    })
    return { projects, rejected }
  }

  /** One line naming the record by its slug, or by its position when the slug is unreadable. */
  static describe(rejected: RejectedTeeProject): string {
    const name = rejected.slug ?? `enregistrement n° ${(rejected.index + 1).toString()}`
    return `${name} : ${rejected.reason}`
  }

  private static readableSlug(record: unknown): string | undefined {
    if (typeof record !== 'object' || record === null) return undefined
    const slug = (record as Record<string, unknown>)['slug']
    return typeof slug === 'string' && slug.trim() !== '' ? slug : undefined
  }
}
