import type { ExportLogger } from './ExportLogger'

/** Default {@link ExportLogger}: one line per issue to stderr. */
export class ConsoleExportLogger implements ExportLogger {
  warn(message: string): void {
    process.stderr.write(`${message}\n`)
  }
}
