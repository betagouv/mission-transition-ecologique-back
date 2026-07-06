import { createHash } from 'node:crypto'

/**
 * Derives a stable canonical `id` (cuid2-shaped) from the slug, for the
 * Payload-free import path. The Payload pipeline assigns a random cuid2 per
 * program; an upstream-driven regeneration has no such id, so we derive a
 * deterministic one from the slug — same slug → same id across daily runs, which
 * keeps the store upsert stable (and the committed `canonical.db` diff minimal).
 *
 * Shape: `c` + 23 lowercase hex chars (24 total). The leading letter and
 * lowercase-alphanumeric body satisfy `cuid2Schema`; `node:crypto` keeps the
 * package dependency-free.
 */
export class SlugCanonicalId {
  static from(slug: string): string {
    return `c${createHash('sha256').update(slug).digest('hex').slice(0, 23)}`
  }
}
