import type { CanonicalProgramInput } from '@tee-backoffice/canonical'
import type { ProgramRedirects } from './ProgramRedirects'
import { SlugCanonicalId } from './SlugCanonicalId'

/** A redirect that could not be applied (its replacement is absent from the store). */
export interface RedirectSkip {
  former: string
  current: string
  reason: string
}

export interface RedirectApplication {
  /** New `remplace` records synthesized for former slugs no longer in programs.json. */
  tombstones: CanonicalProgramInput[]
  /** Former slugs that still exist as real programs, marked `remplace` in place. */
  markedInPlace: string[]
  /** Redirects skipped because the replacement dispositif is absent. */
  skipped: RedirectSkip[]
}

/**
 * Turns program redirects into `remplace` canonical records. For each
 * `former → current` pair whose replacement is present in the store:
 *  - if the former slug still exists as a real program, it is marked `remplace`
 *    in place (pointing at the replacement);
 *  - otherwise a **tombstone** is synthesized by cloning the replacement's
 *    content under the former slug, so AGIR keeps serving the former slug with
 *    `statut: remplace` + the replacing slug (a followable redirect).
 *
 * The `remplace_par` pointer reuses the replacement's canonical id (a cuid2), so
 * `RemplaceParResolver` resolves it back to the replacing slug on export. A
 * redirect whose replacement is absent is skipped and reported (never guessed).
 * Former slugs that are not valid canonical slugs (e.g. apostrophes) still
 * produce a tombstone here; validation drops it downstream, loudly.
 */
export class RedirectTombstoneBuilder {
  build(redirects: ProgramRedirects, inputsBySlug: Map<string, CanonicalProgramInput>): RedirectApplication {
    const tombstones: CanonicalProgramInput[] = []
    const markedInPlace: string[] = []
    const skipped: RedirectSkip[] = []

    for (const [former, current] of redirects.entries()) {
      const target = inputsBySlug.get(current)
      if (!target) {
        skipped.push({ former, current, reason: 'dispositif de remplacement absent' })
        continue
      }
      // target.id is the replacement's canonical id (cuid2), set by the caller.
      const remplacePar = target.id

      const existing = inputsBySlug.get(former)
      if (existing) {
        existing.statut_dispositif = 'remplace'
        existing.remplace_par = remplacePar
        markedInPlace.push(former)
        continue
      }

      // Deep clone (JSON-safe input) so the tombstone is independent of the target.
      const tombstone = JSON.parse(JSON.stringify(target)) as CanonicalProgramInput
      tombstone.slug = former
      tombstone.id = SlugCanonicalId.from(former)
      tombstone.statut_dispositif = 'remplace'
      tombstone.remplace_par = remplacePar
      tombstones.push(tombstone)
    }

    return { tombstones, markedInPlace, skipped }
  }
}
