// libSQL-backed canonical store — infrastructure adapter for the
// `CanonicalProgramRepository` port defined in `@tee-backoffice/canonical`.
// Depends on the canonical domain and a SQL driver, never on the CMS.
//
// Explicit named re-exports (not `export *`): `db.ts` pulls in the CommonJS
// `@libsql/client`, which turns a star re-export into a runtime star the Node
// ESM loader cannot statically resolve (e.g. under tsx in the seed).

export { canonicalPrograms } from './schema'
export { createCanonicalDb } from './db'
export type { CanonicalDb } from './db'
export { DrizzleCanonicalProgramRepository } from './DrizzleCanonicalProgramRepository'
export { createCanonicalProgramRepository } from './createCanonicalProgramRepository'
