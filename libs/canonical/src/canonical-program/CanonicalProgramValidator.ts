import type { z } from 'zod'
import { canonicalProgramSchema } from './canonical-program.schema'
import { CanonicalProgram } from './CanonicalProgram'

export type ValidationResult =
  | { success: true; program: CanonicalProgram }
  | { success: false; errors: z.ZodIssue[] }

/**
 * Entry point for canonical-program validation.
 *
 * Give it unknown data, get back either a built {@link CanonicalProgram} or the
 * list of zod issues. This is the only blessed way to obtain a CanonicalProgram.
 */
export class CanonicalProgramValidator {
  /** Non-throwing validation. */
  validate(input: unknown): ValidationResult {
    const parsed = canonicalProgramSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, errors: parsed.error.issues }
    }
    return { success: true, program: CanonicalProgram.fromValidated(parsed.data) }
  }

  /** Throwing variant — raises `ZodError` on invalid input. */
  parse(input: unknown): CanonicalProgram {
    return CanonicalProgram.fromValidated(canonicalProgramSchema.parse(input))
  }
}
