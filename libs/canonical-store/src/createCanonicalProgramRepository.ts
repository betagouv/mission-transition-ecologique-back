import type { CanonicalProgramRepository, CanonicalEventSink } from '@tee-backoffice/canonical'
import { DrizzleCanonicalProgramRepository } from './DrizzleCanonicalProgramRepository'

// The store owns its own database location, so consumers (the CMS) never need
// to know where or how the canonical is persisted. It lives in the `canonical`
// schema, next to Payload's `public` one: sharing the instance keeps the
// hosting simple, while a CMS change can drop `public` and keep the canonical.
//
// CANONICAL_DATABASE_URI is the local/CI setting; on Scalingo the platform
// injects SCALINGO_POSTGRESQL_URL, so prod and preprod need no variable at all.
const DATABASE_VARIABLES = ['CANONICAL_DATABASE_URI', 'SCALINGO_POSTGRESQL_URL'] as const

function databaseUrl(): string {
  for (const name of DATABASE_VARIABLES) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  throw new Error(
    `Missing environment variable: set ${DATABASE_VARIABLES[0]} (locally) or ${DATABASE_VARIABLES[1]} (Scalingo).`,
  )
}

/**
 * Builds a ready-to-use canonical repository against the resolved database.
 * This is the entry point for application wiring; tests open an in-memory
 * PGlite store instead. The optional event sink (injected by the composition
 * root) surfaces rows dropped on read.
 */
export function createCanonicalProgramRepository(
  events?: CanonicalEventSink,
): Promise<CanonicalProgramRepository> {
  return DrizzleCanonicalProgramRepository.create(databaseUrl(), events)
}
