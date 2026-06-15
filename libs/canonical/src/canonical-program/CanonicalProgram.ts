import type { CanonicalProgramData } from './canonical-program.types'
import type { Operateur } from '../shared/operateur.schema'

/**
 * Immutable value object wrapping a *validated* canonical program.
 *
 * Construction is guarded: instances are only created from data that already
 * passed `canonicalProgramSchema`. Always go through {@link CanonicalProgramValidator}
 * rather than calling {@link CanonicalProgram.fromValidated} directly.
 */
export class CanonicalProgram {
  private constructor(public readonly data: CanonicalProgramData) {}

  /**
   * Wrap already-validated data. Internal seam used by the validator —
   * `data` MUST have passed `canonicalProgramSchema` first.
   */
  static fromValidated(data: CanonicalProgramData): CanonicalProgram {
    return new CanonicalProgram(data)
  }

  get id(): CanonicalProgramData['id'] {
    return this.data.id
  }

  get slug(): CanonicalProgramData['slug'] {
    return this.data.slug
  }

  get statut(): CanonicalProgramData['statut'] {
    return this.data.statut
  }

  /** Opérateur à contacter (affiché en premier). */
  get operateurContact(): Operateur {
    return this.data.operateurs.contact
  }

  isReplaced(): boolean {
    return this.data.statut === 'remplace'
  }

  isActive(): boolean {
    return this.data.statut === 'actif'
  }

  /** Données brutes validées (sérialisation JSON sans perte). */
  toJSON(): CanonicalProgramData {
    return this.data
  }
}
