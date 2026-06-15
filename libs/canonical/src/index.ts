// Canonical (pivot) format — public API.
//
// The "pivot" (team vocabulary) is our Canonical Data Model: one internal,
// unpublished, normalized format that every source/target format maps through.

// Shared building blocks
export * from './shared/primitives'
export * from './shared/operateur.schema'

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
