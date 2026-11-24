// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import type { TeeAdemeTheme, TeeRecord } from '@tee-backoffice/format-adapters'
import { GeographicAreasSeed } from '@/scripts/seed/geographic-areas'
import { AdemeThemesSync } from '@/scripts/sync/ademe-themes/AdemeThemesSync'
import { ProgramsSync } from '@/scripts/sync/programs/ProgramsSync'
import { getCanonicalProgramRepository } from '@/services/canonical/canonicalRepository'

const fixturesDir = fileURLToPath(new URL('../fixtures', import.meta.url))
const sourcePrograms = JSON.parse(readFileSync(resolve(fixturesDir, 'programs.json'), 'utf-8')) as TeeRecord[]

const SLUG = 'ademe-themes-prog'

const referential: TeeAdemeTheme[] = [
  // A sub-theme listed before its root: the sync must still link it.
  { code: '19_03', parentCode: '19', label: 'Eau' },
  { code: '19', parentCode: null, label: 'Société et politiques publiques' },
  { code: '08', parentCode: null, label: 'Energies' },
]

let payload: Payload

const themeByCode = async (code: string) => {
  const result = await payload.find({ collection: 'ademe-themes', where: { code: { equals: code } }, depth: 0 })
  const doc = result.docs[0]
  if (!doc) throw new Error(`ADEME theme ${code} not found`)
  return doc
}

const importProgram = (ademeThemes?: string[]) => {
  const source = sourcePrograms.find((entry) => entry['id'] === 'baisse-les-watts')
  if (!source) throw new Error('no program fixture baisse-les-watts')
  const record: TeeRecord = { ...source, id: SLUG }
  if (ademeThemes) record['ademeThemes'] = ademeThemes
  else delete record['ademeThemes']
  return new ProgramsSync(payload, [record]).run()
}

describe('ADEME themes', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await new GeographicAreasSeed(payload).run()
    await payload.delete({ collection: 'programs', where: { slug: { equals: SLUG } } })
    await payload.delete({ collection: 'ademe-themes', where: { code: { in: ['19_03', '19', '08', '99'] } } })
  }, 120_000)

  afterAll(async () => {
    await payload.delete({ collection: 'programs', where: { slug: { equals: SLUG } } })
  })

  describe('AdemeThemesSync', () => {
    it('creates the referential, sub-themes linked to their root', async () => {
      const result = await new AdemeThemesSync(payload, referential).run()

      expect(result).toMatchObject({ created: 3, updated: 0, errors: 0 })
      const root = await themeByCode('19')
      expect(await themeByCode('19_03')).toMatchObject({ label: 'Eau', parent: root.id, displayName: '19_03 · Eau' })
      expect((await themeByCode('08')).parent).toBeNull()
    })

    it('leaves an unchanged referential untouched, updates a renamed theme', async () => {
      expect(await new AdemeThemesSync(payload, referential).run()).toMatchObject({ created: 0, updated: 0, unchanged: 3 })

      const renamed = referential.map((theme) => (theme.code === '08' ? { ...theme, label: 'Énergies' } : theme))
      expect(await new AdemeThemesSync(payload, renamed).run()).toMatchObject({ updated: 1, unchanged: 2 })
      expect((await themeByCode('08')).label).toBe('Énergies')
    })

    it('keeps and reports a theme upstream dropped', async () => {
      await payload.create({ collection: 'ademe-themes', data: { code: '99', label: 'Ancienne thématique' } })

      const result = await new AdemeThemesSync(payload, referential).run()

      expect(result.stale).toContain('99')
      expect(await themeByCode('99')).toBeDefined()
    })

    it('reports a sub-theme whose root is missing', async () => {
      const result = await new AdemeThemesSync(payload, [{ code: '42_01', parentCode: '42', label: 'Orphelin' }]).run()
      expect(result.errors).toBe(1)
    })
  })

  describe('program import', () => {
    it('links the program to the referential and stores the codes in the canonical', async () => {
      const result = await importProgram(['19', '19_03'])

      expect(result.errors).toBe(0)
      const program = (await payload.find({ collection: 'programs', where: { slug: { equals: SLUG } }, depth: 0 }))
        .docs[0]
      expect(program?.ademeThemes).toEqual([(await themeByCode('19')).id, (await themeByCode('19_03')).id])

      const stored = await (await getCanonicalProgramRepository(payload.logger)).findBySlug(SLUG)
      expect(stored?.toJSON().thematiques_ademe).toEqual(['19', '19_03'])
      // The TEE themes stay alongside.
      expect(stored?.toJSON().themes).toBeDefined()
    })

    it('reports a code missing from the referential, the program still imported', async () => {
      const result = await importProgram(['19_03', '77_77'])

      expect(result.errors).toBe(0)
      expect([...result.warnings.keys()].some((warning) => warning.includes('77_77'))).toBe(true)
      const stored = await (await getCanonicalProgramRepository(payload.logger)).findBySlug(SLUG)
      expect(stored?.toJSON().thematiques_ademe).toEqual(['19_03'])
    })

    it('clears the themes of a program upstream no longer themes', async () => {
      await importProgram()

      const stored = await (await getCanonicalProgramRepository(payload.logger)).findBySlug(SLUG)
      expect(stored?.toJSON().thematiques_ademe).toBeUndefined()
    })
  })
})
