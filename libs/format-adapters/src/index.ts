// @tee-backoffice/format-adapters — adaptateurs entre le pivot
// (`@tee-backoffice/canonical`) et les formats externes, dans les deux sens.
//
// API publique organisée par format. Périmètre courant : TEE (iso
// programs.json), import + export. AGIR et schéma interministériel (Grist)
// arriveront sur leurs propres branches. Les helpers de `shared/` sont internes.

export * from './tee/tee-program.types'
export * from './tee/tee-program.schema'
export * from './tee/TeeExporter'
export * from './tee/TeeImporter'
