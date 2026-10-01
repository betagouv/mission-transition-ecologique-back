import type { CanonicalProjectData } from './canonical-project.types'
import { deepFreeze } from '../shared/deepFreeze'

/**
 * Immutable value object wrapping a validated canonical project. Only built from
 * data that passed `canonicalProjectSchema`: always go through
 * {@link CanonicalProjectValidator}. The wrapped `data` is deeply frozen; use
 * {@link CanonicalProject.toMutable} for an editable copy.
 */
export class CanonicalProject {
  private constructor(public readonly data: CanonicalProjectData) {
    deepFreeze(data)
  }

  /** Wrap already-validated data. `data` MUST have passed the schema first. */
  static fromValidated(data: CanonicalProjectData): CanonicalProject {
    return new CanonicalProject(data)
  }

  get id(): CanonicalProjectData['id'] {
    return this.data.id
  }

  get slug(): CanonicalProjectData['slug'] {
    return this.data.slug
  }

  get statutProjet(): CanonicalProjectData['statut_projet'] {
    return this.data.statut_projet
  }

  get remplacePar(): CanonicalProjectData['remplace_par'] {
    return this.data.remplace_par
  }

  isReplaced(): boolean {
    return this.data.statut_projet === 'remplace'
  }

  /** Deep mutable copy for "edit then re-validate" flows; `data` stays frozen. */
  toMutable(): CanonicalProjectData {
    return structuredClone(this.data)
  }

  /** Frozen validated data (lossless JSON round-trip). */
  toJSON(): CanonicalProjectData {
    return this.data
  }
}
