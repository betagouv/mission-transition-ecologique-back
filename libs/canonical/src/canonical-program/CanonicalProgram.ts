import type { CanonicalProgramData } from './canonical-program.types'
import type { Operateur } from '../shared/operateur.schema'
import { deepFreeze } from '../shared/deepFreeze'

/**
 * Immutable value object wrapping a *validated* canonical program.
 *
 * Construction is guarded: instances are only created from data that already
 * passed `canonicalProgramSchema`. Always go through {@link CanonicalProgramValidator}
 * rather than calling {@link CanonicalProgram.fromValidated} directly.
 *
 * The wrapped `data` is deeply frozen: every mutation point lives upstream of
 * validation (assemble a `CanonicalProgramInput`, then validate) or in a
 * projection that derives a *new* shape — never on this object. Need a mutable
 * working copy? Use {@link CanonicalProgram.toMutable}.
 */
export class CanonicalProgram {
  private constructor(public readonly data: CanonicalProgramData) {
    deepFreeze(data);
  }

  /**
   * Wrap already-validated data. Internal seam used by the validator —
   * `data` MUST have passed `canonicalProgramSchema` first.
   */
  static fromValidated(data: CanonicalProgramData): CanonicalProgram {
    return new CanonicalProgram(data);
  }

  get id(): CanonicalProgramData['id'] {
    return this.data.id;
  }

  get slug(): CanonicalProgramData['slug'] {
    return this.data.slug;
  }

  get statut(): CanonicalProgramData['statut'] {
    return this.data.statut;
  }

  get remplacePar(): CanonicalProgramData['remplace_par'] {
    return this.data.remplace_par;
  }

  get operateurContact(): Operateur {
    return this.data.operateurs.contact;
  }

  isReplaced(): boolean {
    return this.data.statut === 'remplace';
  }

  isActive(): boolean {
    return this.data.statut === 'actif';
  }

  /**
   * Deep, **mutable** copy of the validated data — the seam for "edit then
   * re-validate" flows. Mutate the returned object freely, then feed it back
   * through {@link CanonicalProgramValidator}. The wrapped `data` stays frozen.
   */
  toMutable(): CanonicalProgramData {
    return structuredClone(this.data);
  }

  /**
   * Données brutes validées, **gelées** (lecture seule ; round-trip JSON sans
   * perte). Pour une copie modifiable, voir {@link CanonicalProgram.toMutable}.
   */
  toJSON(): CanonicalProgramData {
    return this.data;
  }
}
