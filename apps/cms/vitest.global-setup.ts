import { rmSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

export function setup() {
  const dbPath = resolve(fileURLToPath(new URL('.', import.meta.url)), 'test.db')
  rmSync(dbPath, { force: true })
}
