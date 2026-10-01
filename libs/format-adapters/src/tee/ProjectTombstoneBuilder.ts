import type { CanonicalProjectInput } from '@tee-backoffice/canonical'
import type { ProjectRedirects } from './ProjectRedirects'
import type { RedirectSkip } from './RedirectTombstoneBuilder'
import { SlugCanonicalId } from './SlugCanonicalId'

export interface ProjectRedirectApplication {
  /** New `remplace` records synthesized for former slugs no longer in projects.json. */
  tombstones: CanonicalProjectInput[]
  /** Former slugs that still exist as real projects, marked `remplace` in place. */
  markedInPlace: string[]
  /** Redirects skipped because the replacement project is absent. */
  skipped: RedirectSkip[]
}

/**
 * Turns project redirects into `remplace` canonical records, the same way
 * `RedirectTombstoneBuilder` does for programs. For each `former → current`
 * pair whose replacement is present:
 *  - if the former slug still exists as a real project, it is marked `remplace`
 *    in place (pointing at the replacement);
 *  - otherwise a tombstone is synthesized by cloning the replacement's content
 *    under the former slug.
 *
 * `remplace_par` carries the replacement's canonical id. A redirect whose
 * replacement is absent is skipped and reported (never guessed). A former slug
 * that is not kebab-case (`maintenance-préventive`) is kept verbatim: the
 * canonical accepts it on a `remplace` project only.
 */
export class ProjectTombstoneBuilder {
  build(redirects: ProjectRedirects, inputsBySlug: Map<string, CanonicalProjectInput>): ProjectRedirectApplication {
    const tombstones: CanonicalProjectInput[] = []
    const markedInPlace: string[] = []
    const skipped: RedirectSkip[] = []

    for (const [former, current] of redirects.entries()) {
      const target = inputsBySlug.get(current)
      if (!target) {
        skipped.push({ former, current, reason: 'projet de remplacement absent' })
        continue
      }

      const existing = inputsBySlug.get(former)
      if (existing) {
        existing.statut_projet = 'remplace'
        existing.remplace_par = target.id
        markedInPlace.push(former)
        continue
      }

      // Deep clone (JSON-safe input) so the tombstone is independent of the target.
      const tombstone = JSON.parse(JSON.stringify(target)) as CanonicalProjectInput
      tombstone.slug = former
      tombstone.id = SlugCanonicalId.forProject(former)
      tombstone.statut_projet = 'remplace'
      tombstone.remplace_par = target.id
      tombstones.push(tombstone)
    }

    return { tombstones, markedInPlace, skipped }
  }
}
