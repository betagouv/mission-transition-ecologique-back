import { CanonicalProgramValidator, type ValidationResult } from './CanonicalProgramValidator'
import type { CanonicalProgram } from './CanonicalProgram'
import type { CanonicalProgramRepository } from './CanonicalProgramRepository'
import type { CanonicalProgramInput } from './canonical-program.types'
import { NullEventSink } from '../observability/NullEventSink'
import type { CanonicalEventSink } from '../observability/CanonicalEventSink'

type ValidationIssues = Extract<ValidationResult, { success: false }>['errors']

export type CanonicalSaveResult =
  | { status: 'saved'; slug: string }
  | { status: 'invalid'; slug: string; errors: ValidationIssues }

/**
 * Domain service for canonical programs. Orchestrates the use cases over the
 * repository port, independent of any source (CMS, external feed) or storage
 * technology. The concrete repository is injected by the caller. Grows with the
 * needs (save and getAll today, get next).
 */
export class CanonicalProgramService {
  private readonly validator = new CanonicalProgramValidator()

  constructor(
    private readonly repository: CanonicalProgramRepository,
    private readonly events: CanonicalEventSink = new NullEventSink(),
  ) {}

  /**
   * Validates a canonical input and upserts it through the repository. The
   * business rule lives here: only a valid canonical program is stored. Both
   * outcomes are emitted as events so dropped inputs never go unnoticed.
   */
  async save(input: CanonicalProgramInput): Promise<CanonicalSaveResult> {
    const result = this.validator.validate(input)
    if (!result.success) {
      const slug = String(input.slug ?? '')
      this.events.emit({ type: 'program_dropped', severity: 'warning', phase: 'write', slug, errors: result.errors })
      return { status: 'invalid', slug, errors: result.errors }
    }

    await this.repository.save(result.program)
    this.events.emit({
      type: 'program_saved',
      severity: 'info',
      slug: result.program.slug,
      canonicalId: result.program.id,
    })
    return { status: 'saved', slug: result.program.slug }
  }

  async getAll(): Promise<CanonicalProgram[]> {
    return this.repository.findAll()
  }
}
