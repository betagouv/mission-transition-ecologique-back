import type { z } from 'zod'
import { canonicalProjectSchema } from './canonical-project.schema'
import { CanonicalProject } from './CanonicalProject'

export type ProjectValidationResult =
  | { success: true; project: CanonicalProject }
  | { success: false; errors: z.ZodIssue[] }

/**
 * Entry point for canonical-project validation: the only blessed way to obtain
 * a {@link CanonicalProject}.
 */
export class CanonicalProjectValidator {
  /** Non-throwing validation. */
  validate(input: unknown): ProjectValidationResult {
    const parsed = canonicalProjectSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, errors: parsed.error.issues }
    }
    return { success: true, project: CanonicalProject.fromValidated(parsed.data) }
  }

  /** Throwing variant: raises `ZodError` on invalid input. */
  parse(input: unknown): CanonicalProject {
    return CanonicalProject.fromValidated(canonicalProjectSchema.parse(input))
  }
}
