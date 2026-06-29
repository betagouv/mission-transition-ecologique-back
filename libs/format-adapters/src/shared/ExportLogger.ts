/**
 * Sink for export-time diagnostics — round-trip discrepancies and re-import
 * failures surfaced by an exporter's self-check. Injected so callers choose
 * where reports go (stderr by default, a collector in tests, a metrics channel
 * later). This is how the package reports when an export is not content-perfect.
 */
export interface ExportLogger {
  warn(message: string): void
}
