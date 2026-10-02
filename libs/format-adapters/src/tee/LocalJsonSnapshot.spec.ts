import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalJsonSnapshot } from './LocalJsonSnapshot'

describe('LocalJsonSnapshot', () => {
  it('écrit puis relit un fichier amont', () => {
    const snapshot = new LocalJsonSnapshot(join(mkdtempSync(join(tmpdir(), 'upstream-')), 'nested'))
    expect(snapshot.has('programs')).toBe(false)

    snapshot.write('programs', [{ id: 'a' }])

    expect(snapshot.has('programs')).toBe(true)
    expect(snapshot.read('programs')).toEqual([{ id: 'a' }])
    expect(readFileSync(snapshot.path('programs'), 'utf8').endsWith('\n')).toBe(true)
  })

  it('pointe par défaut sur la copie versionnée du dépôt', () => {
    const snapshot = new LocalJsonSnapshot()
    expect(snapshot.directory).toMatch(/libs\/format-adapters\/static\/upstream$/)
    expect(existsSync(snapshot.path('programs'))).toBe(true)
  })
})
