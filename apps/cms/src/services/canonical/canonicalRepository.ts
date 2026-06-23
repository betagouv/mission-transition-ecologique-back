import { createCanonicalProgramRepository } from '@tee-backoffice/canonical-store'
import type { CanonicalProgramRepository } from '@tee-backoffice/canonical'

let repositoryPromise: Promise<CanonicalProgramRepository> | undefined

/**
 * Memoized canonical store, opened once and shared for the app lifetime. The
 * store owns its own database location (independent of Payload), so the CMS only
 * asks for a ready-to-use repository without knowing where the canonical lives.
 */
export function getCanonicalProgramRepository(): Promise<CanonicalProgramRepository> {
  return (repositoryPromise ??= createCanonicalProgramRepository())
}
