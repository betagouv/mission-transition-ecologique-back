import { CanonicalProgramValidator, type ValidationResult } from './CanonicalProgramValidator'
import type { CanonicalProgram } from './CanonicalProgram'
import type { CanonicalProgramKey, CanonicalProgramRepository } from './CanonicalProgramRepository'
import type { CanonicalProgramInput } from './canonical-program.types'
import { CanonicalSnapshotGuard } from './snapshot/CanonicalSnapshotGuard'
import { CanonicalSnapshotPlan } from './snapshot/CanonicalSnapshotPlan'
import { NullEventSink } from '../observability/NullEventSink'
import type { CanonicalEventSink } from '../observability/CanonicalEventSink'

type ValidationIssues = Extract<ValidationResult, { success: false }>['errors']

export type CanonicalSaveResult =
  | { status: 'saved'; slug: string }
  | { status: 'invalid'; slug: string; errors: ValidationIssues }

export interface CanonicalSnapshotReport {
  saved: number
  invalid: { slug: string; errors: ValidationIssues }[]
  removed: CanonicalProgramKey[]
  superseded: CanonicalProgramKey[]
  /** Stored rows left untouched because their upstream record is invalid. */
  kept: CanonicalProgramKey[]
}

/**
 * Domain service for canonical programs. Orchestrates the use cases over the
 * repository port, independent of any source (CMS, external feed) or storage
 * technology. The concrete repository is injected by the caller. Grows with the
 * needs (save, remove, applySnapshot and getAll today, get next).
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

  /**
   * Withdraws a program from the canonical, e.g. when it is deleted at the
   * source. The removal is emitted so consumers losing a program is traceable.
   */
  async remove(canonicalId: string, slug: string): Promise<void> {
    await this.repository.delete(canonicalId)
    this.events.emit({ type: 'program_removed', severity: 'info', slug, canonicalId })
  }

  /**
   * Aligns the store on a full upstream snapshot without ever emptying it:
   * everything is validated first, the guard may reject the whole snapshot, then
   * deletions and upserts land atomically. A program whose upstream record is
   * invalid keeps its stored row instead of disappearing.
   */
  async applySnapshot(
    inputs: CanonicalProgramInput[],
    guard: CanonicalSnapshotGuard = new CanonicalSnapshotGuard(),
  ): Promise<CanonicalSnapshotReport> {
    const valid: CanonicalProgram[] = []
    const invalid: CanonicalSnapshotReport['invalid'] = []
    for (const input of inputs) {
      const result = this.validator.validate(input)
      if (result.success) valid.push(result.program)
      else invalid.push({ slug: String(input.slug ?? ''), errors: result.errors })
    }

    const plan = new CanonicalSnapshotPlan(
      await this.repository.listKeys(),
      valid,
      new Set(invalid.map((entry) => entry.slug)),
    )
    guard.check(plan)
    await this.repository.applyChanges(plan.changes())

    for (const { slug, errors } of invalid) {
      this.events.emit({ type: 'program_dropped', severity: 'warning', phase: 'write', slug, errors })
    }
    for (const { canonicalId, slug } of [...plan.superseded, ...plan.removed]) {
      this.events.emit({ type: 'program_removed', severity: 'info', slug, canonicalId })
    }
    for (const program of valid) {
      this.events.emit({ type: 'program_saved', severity: 'info', slug: program.slug, canonicalId: program.id })
    }

    return {
      saved: valid.length,
      invalid,
      removed: plan.removed,
      superseded: plan.superseded,
      kept: plan.kept,
    }
  }

  async getAll(): Promise<CanonicalProgram[]> {
    return this.repository.findAll()
  }
}
