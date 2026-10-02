import { CanonicalProjectValidator, type ProjectValidationResult } from './CanonicalProjectValidator'
import type { CanonicalProject } from './CanonicalProject'
import type { CanonicalProjectRepository } from './CanonicalProjectRepository'
import type { CanonicalProjectInput } from './canonical-project.types'
import type { CanonicalKey } from '../snapshot/CanonicalKey'
import { CanonicalIdentityMap } from '../snapshot/CanonicalIdentityMap'
import { CanonicalSnapshotGuard } from '../snapshot/CanonicalSnapshotGuard'
import { CanonicalSnapshotPlan } from '../snapshot/CanonicalSnapshotPlan'
import { NullEventSink } from '../observability/NullEventSink'
import type { CanonicalEventSink } from '../observability/CanonicalEventSink'

type ValidationIssues = Extract<ProjectValidationResult, { success: false }>['errors']

export type CanonicalProjectSaveResult =
  | { status: 'saved'; slug: string }
  | { status: 'invalid'; slug: string; errors: ValidationIssues }

export interface CanonicalProjectSnapshotReport {
  saved: number
  invalid: { slug: string; errors: ValidationIssues }[]
  removed: CanonicalKey[]
  /** Stored rows updated under their own id, though the snapshot entry of their slug came with another one. */
  adopted: CanonicalKey[]
  /** Stored rows replaced by the snapshot row of their slug: the stored id could not be kept. */
  superseded: CanonicalKey[]
  /** Stored rows left untouched because their upstream record is invalid. */
  kept: CanonicalKey[]
}

export interface CanonicalProjectSnapshotOptions {
  /**
   * Program ids replaced by the id their program is stored under: the projects of
   * a snapshot reference programs by the id the snapshot would give them.
   */
  programIdentities?: CanonicalIdentityMap
}

/**
 * Domain service for canonical projects. Orchestrates the use cases over the
 * repository port, independent of any source (CMS, upstream feed) or storage
 * technology. The concrete repository is injected by the caller.
 */
export class CanonicalProjectService {
  private readonly validator = new CanonicalProjectValidator()

  constructor(
    private readonly repository: CanonicalProjectRepository,
    private readonly events: CanonicalEventSink = new NullEventSink(),
  ) {}

  /**
   * Validates a canonical input and upserts it through the repository: only a
   * valid canonical project is stored. Both outcomes are emitted as events so
   * dropped inputs never go unnoticed.
   */
  async save(input: CanonicalProjectInput): Promise<CanonicalProjectSaveResult> {
    const result = this.validator.validate(input)
    if (!result.success) {
      const slug = String(input.slug ?? '')
      this.events.emit({ type: 'project_dropped', severity: 'warning', phase: 'write', slug, errors: result.errors })
      return { status: 'invalid', slug, errors: result.errors }
    }

    await this.repository.save(result.project)
    this.events.emit({
      type: 'project_saved',
      severity: 'info',
      slug: result.project.slug,
      canonicalId: result.project.id,
    })
    return { status: 'saved', slug: result.project.slug }
  }

  /**
   * Withdraws a project from the canonical, e.g. when it is unpublished or
   * deleted at the source. Only an actual removal is emitted: a draft that was
   * never published has no row to lose.
   */
  async remove(canonicalId: string, slug: string): Promise<void> {
    const removed = await this.repository.delete(canonicalId)
    if (removed) this.events.emit({ type: 'project_removed', severity: 'info', slug, canonicalId })
  }

  /**
   * Aligns the store on a full upstream snapshot without ever emptying it:
   * everything is validated first, the guard may reject the whole snapshot, then
   * deletions and upserts land atomically. A project whose upstream record is
   * invalid keeps its stored row instead of disappearing. A project whose slug
   * is already stored keeps its stored id, whatever id the snapshot gives it.
   */
  async applySnapshot(
    inputs: CanonicalProjectInput[],
    guard: CanonicalSnapshotGuard = new CanonicalSnapshotGuard({ entityLabel: 'projet' }),
    options: CanonicalProjectSnapshotOptions = {},
  ): Promise<CanonicalProjectSnapshotReport> {
    const existing = await this.repository.listKeys()
    const identities = CanonicalIdentityMap.fromSnapshot(existing, inputs)
    const programIdentities = options.programIdentities ?? CanonicalIdentityMap.empty()

    const valid: CanonicalProject[] = []
    const invalid: CanonicalProjectSnapshotReport['invalid'] = []
    for (const input of inputs) {
      const result = this.validator.validate(this.withStoredIdentities(input, identities, programIdentities))
      if (result.success) valid.push(result.project)
      else invalid.push({ slug: String(input.slug ?? ''), errors: result.errors })
    }

    const plan = new CanonicalSnapshotPlan(existing, valid, new Set(invalid.map((entry) => entry.slug)))
    guard.check(plan)
    await this.repository.applyChanges(plan.changes())

    for (const { slug, errors } of invalid) {
      this.events.emit({ type: 'project_dropped', severity: 'warning', phase: 'write', slug, errors })
    }
    for (const { canonicalId, slug } of [...plan.superseded, ...plan.removed]) {
      this.events.emit({ type: 'project_removed', severity: 'info', slug, canonicalId })
    }
    for (const project of valid) {
      this.events.emit({ type: 'project_saved', severity: 'info', slug: project.slug, canonicalId: project.id })
    }

    const savedIds = new Set<string>(valid.map((project) => project.id))
    return {
      saved: valid.length,
      invalid,
      removed: plan.removed,
      adopted: identities.adopted.filter((key) => savedIds.has(key.canonicalId)),
      superseded: plan.superseded,
      kept: plan.kept,
    }
  }

  async getAll(): Promise<CanonicalProject[]> {
    return this.repository.findAll()
  }

  /**
   * `id`, `remplace_par` and `projets_lies.projets` hold project ids,
   * `dispositifs` holds program ids.
   */
  private withStoredIdentities(
    input: CanonicalProjectInput,
    projects: CanonicalIdentityMap,
    programs: CanonicalIdentityMap,
  ): CanonicalProjectInput {
    if (projects.size === 0 && programs.size === 0) return input
    const aligned = { ...input, id: projects.resolve(input.id) }
    if (input.remplace_par !== undefined) aligned.remplace_par = projects.resolve(input.remplace_par)
    if (Array.isArray(input.dispositifs)) aligned.dispositifs = programs.resolveAll(input.dispositifs)
    if (Array.isArray(input.projets_lies?.projets)) {
      aligned.projets_lies = { ...input.projets_lies, projets: projects.resolveAll(input.projets_lies.projets) }
    }
    return aligned
  }
}
