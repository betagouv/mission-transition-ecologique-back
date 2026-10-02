// Postgres-backed canonical store : infrastructure adapter for the
// `CanonicalProgramRepository` and `CanonicalProjectRepository` ports defined
// in `@tee-backoffice/canonical`.
// Depends on the canonical domain and a SQL driver, never on the CMS.
//
// Explicit named re-exports (not `export *`): `db.ts` pulls in the CommonJS
// `pg` driver, which turns a star re-export into a runtime star the Node ESM
// loader cannot statically resolve (e.g. under tsx in the seed).

export { canonicalPrograms, canonicalProjects, canonicalSchema, CANONICAL_SCHEMA } from './schema'
export { createCanonicalDb, ensureCanonicalSchema } from './db'
export type { CanonicalDb } from './db'
export { resolveCanonicalDatabaseUrl } from './canonicalDatabaseUrl'
export { DrizzleCanonicalProgramRepository } from './DrizzleCanonicalProgramRepository'
export { DrizzleCanonicalProjectRepository } from './DrizzleCanonicalProjectRepository'
export { createCanonicalProgramRepository } from './createCanonicalProgramRepository'
export { createCanonicalProjectRepository } from './createCanonicalProjectRepository'
