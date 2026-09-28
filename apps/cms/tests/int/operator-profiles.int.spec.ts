// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { teeOperatorsSchema, UpstreamAssetSource } from '@tee-backoffice/format-adapters'
import { UpstreamMediaImporter } from '@/scripts/seed/media/UpstreamMediaImporter'
import { OperatorGroupImporter } from '@/scripts/seed/programs/OperatorGroupImporter'
import { OperatorGroupLogoDefaults } from '@/scripts/seed/programs/OperatorGroupLogoDefaults'
import { OperatorProfileImporter, type OperatorProfileResult } from '@/scripts/seed/programs/OperatorProfileImporter'
import { OperatorLogoResolver } from '@/services/operators/OperatorLogoResolver'
import { Slugify } from '@/utils/Slugify'
import { FakeAssetFetch } from '../support/FakeAssetFetch'

const operators = teeOperatorsSchema.parse(
  JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/operators.json', import.meta.url)), 'utf-8')),
)
const CMS_OPERATORS = [
  'Fixture CCI ou CMA',
  'Fixture CCI Bretagne',
  'Fixture Opco',
  'Fixture sans groupe',
  'Fixture logo manuel',
  'Fixture logo retiré',
  'Fixture logo 404',
]
const CCI_LOGO = OperatorGroupLogoDefaults.pathFor('CCI') ?? ''
const CMA_LOGO = OperatorGroupLogoDefaults.pathFor('CMA') ?? ''
const CCI_OU_CMA_LOGO = '/images/logos/operateur/fixture-cci-ou-cma.webp'
const CCI_OU_CMA_LOGO_V2 = '/images/logos/operateur/fixture-cci-ou-cma-v2.webp'
const MANUAL_OPERATOR_UPSTREAM_LOGO = '/images/logos/operateur/fixture-logo-manuel.webp'
const REMOVED_LOGO = '/images/logos/operateur/fixture-logo-retire.webp'
const LOGO_THEN_404 = '/images/logos/operateur/fixture-logo-404.webp'
const KNOWN_PATHS = [CCI_LOGO, CMA_LOGO, CCI_OU_CMA_LOGO, CCI_OU_CMA_LOGO_V2, MANUAL_OPERATOR_UPSTREAM_LOGO, REMOVED_LOGO, LOGO_THEN_404]
const PIXEL = readFileSync(fileURLToPath(new URL('../fixtures/pixel.webp', import.meta.url)))

let payload: Payload

describe('OperatorGroupImporter and OperatorProfileImporter', () => {
  const assets = new FakeAssetFetch(KNOWN_PATHS)
  let media: UpstreamMediaImporter
  let manualCmaLogo: number
  let manualOperatorLogo: number
  let profiles: OperatorProfileResult

  const findOperator = async (name: string, depth = 1) => {
    const result = await payload.find({ collection: 'operators', where: { name: { equals: name } }, depth, limit: 1 })
    return result.docs[0]
  }
  const findGroup = async (name: string) => {
    const result = await payload.find({ collection: 'operator-groups', where: { name: { equals: name } }, depth: 1, limit: 1 })
    return result.docs[0]
  }
  const runImport = async (upstream = operators, importer = media) => {
    const groupIdByName = await new OperatorGroupImporter(payload, importer).import(upstream)
    return new OperatorProfileImporter(payload, importer).import(upstream, groupIdByName)
  }
  // A logo uploaded by hand in the admin: no `sourcePath`.
  const createManualLogo = async (alt: string, name: string) =>
    (
      await payload.create({
        collection: 'media',
        data: { alt, category: 'operator-logo' },
        file: { data: PIXEL, mimetype: 'image/webp', name, size: PIXEL.length },
      })
    ).id

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    media = new UpstreamMediaImporter(
      payload,
      new UpstreamAssetSource({ baseUrl: FakeAssetFetch.BASE_URL, fetchImpl: assets.fetch }),
    )

    manualCmaLogo = await createManualLogo('Logo CMA choisi à la main', 'fixture-manual-cma.webp')
    manualOperatorLogo = await createManualLogo('Logo opérateur choisi à la main', 'fixture-manual-operator.webp')
    for (const name of CMS_OPERATORS) {
      const logo = name === 'Fixture logo manuel' ? manualOperatorLogo : undefined
      await payload.create({ collection: 'operators', data: { name, slug: Slugify.slugify(name), logo } })
    }
    await payload.create({ collection: 'operator-groups', data: { name: 'CMA', slug: 'cma', logo: manualCmaLogo } })

    profiles = await runImport()
  })

  afterAll(async () => {
    await payload.delete({ collection: 'operators', where: { name: { in: CMS_OPERATORS } } })
    await payload.delete({ collection: 'operator-groups', where: { name: { in: ['CCI', 'CMA', 'Fixture OPCO'] } } })
    await payload.delete({
      collection: 'media',
      where: { or: [{ sourcePath: { in: KNOWN_PATHS } }, { id: { in: [manualCmaLogo, manualOperatorLogo] } }] },
    })
  })

  it('creates each upstream group once', async () => {
    const groups = await payload.find({ collection: 'operator-groups', limit: 0 })
    expect(groups.docs.map((group) => group.name).sort()).toEqual(['CCI', 'CMA', 'Fixture OPCO'])
  })

  it('attaches an operator to all its groups, in upstream order', async () => {
    const operator = await findOperator('Fixture CCI ou CMA')
    const names = (operator?.groups ?? []).map((group) => (typeof group === 'object' ? group.name : group))
    expect(names).toEqual(['CCI', 'CMA'])
  })

  it('imports the operator logo from its upstream path', async () => {
    const operator = await findOperator('Fixture CCI ou CMA')
    expect(operator?.logo).toMatchObject({
      sourcePath: CCI_OU_CMA_LOGO,
      alt: 'Logo de Fixture CCI ou CMA',
      category: 'operator-logo',
    })
  })

  it('keeps an operator logo uploaded by hand, without downloading the upstream one', async () => {
    expect((await findOperator('Fixture logo manuel'))?.logo).toMatchObject({ id: manualOperatorLogo })
    expect(assets.requested.some((url) => url.endsWith(MANUAL_OPERATOR_UPSTREAM_LOGO))).toBe(false)
  })

  it('gives a group its default logo, without overwriting one set by hand', async () => {
    expect((await findGroup('CCI'))?.logo).toMatchObject({ sourcePath: CCI_LOGO, category: 'operator-logo' })
    expect((await findGroup('CMA'))?.logo).toMatchObject({ id: manualCmaLogo })
    expect((await findGroup('Fixture OPCO'))?.logo).toBeFalsy()
  })

  it('leaves an operator without upstream logo logoless, without warning, and resolves its group logo', async () => {
    const operator = await findOperator('Fixture CCI Bretagne', 2)
    expect(operator?.logo).toBeFalsy()
    expect([...media.warnings.keys()].some((warning) => warning.includes('Bretagne'))).toBe(false)
    expect(operator && OperatorLogoResolver.resolve(operator)).toMatchObject({
      origin: 'groupe',
      logo: { sourcePath: CCI_LOGO },
    })
  })

  it('reports a missing logo file and an upstream operator unknown to the CMS', async () => {
    expect((await findOperator('Fixture Opco'))?.logo).toBeFalsy()
    expect([...media.warnings.keys()]).toEqual([expect.stringContaining('/images/logos/operateur/fixture-absent.webp')])
    expect([...profiles.warnings.keys()]).toEqual([expect.stringContaining('Fixture absent du CMS')])
    expect(await findOperator('Fixture absent du CMS')).toBeUndefined()
    expect((await findOperator('Fixture sans groupe'))?.groups).toEqual([])
  })

  it('is idempotent: a second run downloads and creates nothing', async () => {
    const mediaBefore = await payload.count({ collection: 'media' })
    const groupsBefore = await payload.count({ collection: 'operator-groups' })
    const requestsBefore = assets.requested.length

    await runImport()

    expect((await payload.count({ collection: 'media' })).totalDocs).toBe(mediaBefore.totalDocs)
    expect((await payload.count({ collection: 'operator-groups' })).totalDocs).toBe(groupsBefore.totalDocs)
    // Only the file already known as missing could be retried; it is not, within a run.
    expect(assets.requested).toHaveLength(requestsBefore)
    expect((await findGroup('CMA'))?.logo).toMatchObject({ id: manualCmaLogo })
  })

  it('follows upstream for imported logos: replaced, removed, kept on a failed download', async () => {
    const changed = operators.map((operator) => {
      switch (operator.operator) {
        case 'Fixture CCI ou CMA':
          return { ...operator, imagePath: CCI_OU_CMA_LOGO_V2 }
        case 'Fixture logo retiré':
          return { ...operator, imagePath: undefined }
        case 'Fixture logo 404':
          return { ...operator, imagePath: '/images/logos/operateur/fixture-logo-404-v2.webp' }
        default:
          return operator
      }
    })
    expect((await findOperator('Fixture logo retiré'))?.logo).toMatchObject({ sourcePath: REMOVED_LOGO })

    const importer = new UpstreamMediaImporter(
      payload,
      new UpstreamAssetSource({ baseUrl: FakeAssetFetch.BASE_URL, fetchImpl: assets.fetch }),
    )
    await runImport(changed, importer)

    expect((await findOperator('Fixture CCI ou CMA'))?.logo).toMatchObject({ sourcePath: CCI_OU_CMA_LOGO_V2 })
    expect((await findOperator('Fixture logo retiré'))?.logo).toBeFalsy()
    expect((await findOperator('Fixture logo 404'))?.logo).toMatchObject({ sourcePath: LOGO_THEN_404 })
    expect([...importer.warnings.keys()]).toEqual(
      expect.arrayContaining([expect.stringContaining('fixture-logo-404-v2.webp')]),
    )
    expect((await findOperator('Fixture logo manuel'))?.logo).toMatchObject({ id: manualOperatorLogo })
  })
})
