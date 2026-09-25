import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { UpstreamFile } from './UpstreamFile'

/**
 * Versioned copy of the upstream files, refreshed by `data:snapshot`. It is the
 * development fallback when GitHub is unreachable; production never reads it.
 */
export class LocalJsonSnapshot {
  constructor(readonly directory: string = LocalJsonSnapshot.defaultDirectory()) {}

  static defaultDirectory(): string {
    return resolve(dirname(fileURLToPath(import.meta.url)), '../../static/upstream')
  }

  path(file: UpstreamFile): string {
    return resolve(this.directory, `${file}.json`)
  }

  has(file: UpstreamFile): boolean {
    return existsSync(this.path(file))
  }

  read<T>(file: UpstreamFile): T {
    return JSON.parse(readFileSync(this.path(file), 'utf8')) as T
  }

  write(file: UpstreamFile, data: unknown): void {
    mkdirSync(this.directory, { recursive: true })
    writeFileSync(this.path(file), `${JSON.stringify(data, null, 2)}\n`)
  }
}
