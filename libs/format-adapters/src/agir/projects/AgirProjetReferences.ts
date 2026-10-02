import type { CanonicalProgram, CanonicalProject } from '@tee-backoffice/canonical'
import { AgirExportPolicy } from '../AgirExportPolicy'

type ProjectSlug = CanonicalProject['data']['slug']
type ProgramSlug = CanonicalProgram['data']['slug']

export interface AgirProjetReferencesSources {
  projects: readonly CanonicalProject[]
  programs: readonly CanonicalProgram[]
}

/**
 * Resolves the canonical ids a project points at (replacement, linked projects,
 * programs) to the slugs AGIR consumes. A reference that would be a dead link on
 * the AGIR API resolves to `undefined`, and the exporter drops it.
 */
export class AgirProjetReferences {
  private readonly projectsById: Map<string, CanonicalProject>
  private readonly programSlugById: Map<string, ProgramSlug>

  constructor(sources: AgirProjetReferencesSources) {
    this.projectsById = new Map(sources.projects.map((project) => [project.id, project]))
    this.programSlugById = new Map(
      sources.programs
        .filter((program) => AgirExportPolicy.isExportable(program))
        .map((program) => [program.data.id, program.data.slug]),
    )
  }

  /** Slug of the project, whatever its status (target of `remplace_par`). */
  projectSlug(id: string): ProjectSlug | undefined {
    return this.projectsById.get(id)?.slug
  }

  /** Slug of a `valide` project only: a redirect tombstone is not offered as a linked project. */
  linkedProjectSlug(id: string): ProjectSlug | undefined {
    const project = this.projectsById.get(id)
    return project && !project.isReplaced() ? project.slug : undefined
  }

  /** Slug of the program, only when the AGIR programs API serves it. */
  programSlug(id: string): ProgramSlug | undefined {
    return this.programSlugById.get(id)
  }
}
