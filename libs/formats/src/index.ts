// @tee-backoffice/formats — adaptateurs de formats autour du pivot.
//
// Périmètre courant : export TEE (iso programs.json). Les exports AGIR et schéma
// interministériel (Grist) seront ajoutés sur leurs propres branches.

// Helpers partagés
export * from './shared/ExportPolicy'
export * from './shared/ExportValidation'
export * from './shared/ThemeMapper'
export * from './shared/NafSectionResolver'
export * from './shared/RegionNameResolver'
export * from './shared/TypeAideMapper'

// Export / import TEE (iso programs.json, sans publicodes)
export * from './tee/tee-program.types'
export * from './tee/tee-program.schema'
export * from './tee/TeeExporter'
export * from './tee/TeeImporter'
