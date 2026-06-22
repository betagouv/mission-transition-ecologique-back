import type { CanonicalProgramData } from './canonical-program.types'
import type { Operateur } from '../shared/schema/operator'
import { deepFreeze } from '../shared/deepFreeze'

/**
 * Immutable value object wrapping a validated canonical program. Only built from
 * data that passed `canonicalProgramSchema` — always go through
 * {@link CanonicalProgramValidator}. The wrapped `data` is deeply frozen; use
 * {@link CanonicalProgram.toMutable} for an editable copy.
 */
export class CanonicalProgram {
  private constructor(public readonly data: CanonicalProgramData) {
    deepFreeze(data);
  }

  /** Wrap already-validated data. `data` MUST have passed the schema first. */
  static fromValidated(data: CanonicalProgramData): CanonicalProgram {
    return new CanonicalProgram(data);
  }

  get id(): CanonicalProgramData['id'] {
    return this.data.id;
  }

  get slug(): CanonicalProgramData['slug'] {
    return this.data.slug;
  }

  get statutEdition(): CanonicalProgramData['statut_edition'] {
    return this.data.statut_edition;
  }

  get statutDispositif(): CanonicalProgramData['statut_dispositif'] {
    return this.data.statut_dispositif;
  }

  get remplacePar(): CanonicalProgramData['remplace_par'] {
    return this.data.remplace_par;
  }

  get operateurContact(): Operateur {
    return this.data.operateurs.contact;
  }

  isReplaced(): boolean {
    return this.data.statut_dispositif === 'remplace';
  }

  isActive(): boolean {
    return this.data.statut_dispositif === 'valide';
  }

  /** Deep mutable copy for "edit then re-validate" flows; `data` stays frozen. */
  toMutable(): CanonicalProgramData {
    return structuredClone(this.data);
  }

  /** Frozen validated data (lossless JSON round-trip). */
  toJSON(): CanonicalProgramData {
    return this.data;
  }
}
