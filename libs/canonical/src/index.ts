// Canonical (pivot) format — public API.
//
// The "pivot" (team vocabulary) is our Canonical Data Model: one internal,
// unpublished, normalized format that every source/target format maps through.

// Shared building blocks
export * from './shared/primitives'
export * from './shared/cog'
export * from './shared/schema/cog'
export * from './shared/schema/operator'

// Enums (closed vocabularies)
export * from './canonical-program/enums'

// Field & nested schemas
export * from './canonical-program/fields/identite.schema'
export * from './canonical-program/fields/contenu.schema'
export * from './canonical-program/fields/aide.schema'
export * from './canonical-program/fields/eligibilite.schema'
export * from './canonical-program/variants/variante.schema'
export * from './canonical-program/additional-data/additional-data.schema'

// Root schema, type, value object, validator
export * from './canonical-program/canonical-program.schema'
export * from './canonical-program/canonical-program.types'
export * from './canonical-program/CanonicalProgram'
export * from './canonical-program/CanonicalProgramValidator'
export * from './canonical-program/CanonicalProgramRepository'
export * from './canonical-program/CanonicalProgramService'

// Snapshot alignment, shared by programs and projects
export * from './snapshot/CanonicalKey'
export * from './snapshot/CanonicalIdentityMap'
export * from './snapshot/CanonicalSnapshotPlan'
export * from './snapshot/CanonicalSnapshotGuard'
export * from './snapshot/CanonicalSnapshotRejectedError'

// Canonical project: root schema, type, value object, validator, port, service
export * from './canonical-project/canonical-project.schema'
export * from './canonical-project/canonical-project.types'
export * from './canonical-project/CanonicalProject'
export * from './canonical-project/CanonicalProjectValidator'
export * from './canonical-project/CanonicalProjectRepository'
export * from './canonical-project/CanonicalProjectService'

// Observability (port + channels + routing)
export * from './observability/CanonicalEvent'
export * from './observability/CanonicalEventSink'
export * from './observability/NullEventSink'
export * from './observability/CompositeEventSink'
export * from './observability/RoutingCanonicalEventSink'
