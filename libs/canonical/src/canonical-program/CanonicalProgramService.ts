import { CanonicalProgramValidator, type ValidationResult } from './CanonicalProgramValidator'
import type { CanonicalProgramRepository } from './CanonicalProgramRepository'
import type { CanonicalProgramInput } from './canonical-program.types'

type ValidationIssues = Extract<ValidationResult, { success: false }>['errors']

export type CanonicalSaveResult =
  | { status: 'saved'; slug: string }
  | { status: 'invalid'; slug: string; errors: ValidationIssues }

/**
 * Domain service for canonical programs. Orchestrates the use cases over the
 * repository port, independent of any source (CMS, external feed) or storage
 * technology. The concrete repository is injected by the caller. Grows with the
 * needs (save today, get/getAll next).
 */
export class CanonicalProgramService {
  private readonly validator = new CanonicalProgramValidator()

  constructor(private readonly repository: CanonicalProgramRepository) {}

  /**
   * Validates a canonical input and upserts it through the repository. The
   * business rule lives here: only a valid canonical program is stored.
   */
  async save(input: CanonicalProgramInput): Promise<CanonicalSaveResult> {
    const result = this.validator.validate(input)
    if (!result.success) {
      return { status: 'invalid', slug: String(input.slug ?? ''), errors: result.errors }
    }

    await this.repository.save(result.program)
    return { status: 'saved', slug: result.program.slug }
  }
}
