// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, expect } from 'vitest'
import type { CanonicalProgramInput } from '@tee-backoffice/canonical'
import { COG_FRANCE } from '@tee-backoffice/canonical'
import {
  LocalJsonSnapshot,
  SlugCanonicalId,
  TeeImporter,
  TerritoryNameResolver,
  type TeeRecord,
} from '@tee-backoffice/format-adapters'
import { GeographicAreasSeed } from '@/scripts/seed/geographic-areas'
import { ProgramsSeed } from '@/scripts/seed/programs'
import { ProgramCanonicalMapper } from '@/services/canonical/ProgramCanonicalMapper'
import { PayloadRichTextToMarkdown } from '@/services/canonical/rich-text/PayloadRichTextToMarkdown'
import { PayloadProgramRelations } from '@/services/canonical/to-payload/PayloadProgramRelations'

const ALL_NAF_SECTIONS = 21

let payload: Payload
let expected: CanonicalProgramInput[]
let actual: Map<string, CanonicalProgramInput>
let relations: PayloadProgramRelations

// Compares the words only: Lexical re-spells some Markdown (hard breaks, a
// multi-line blockquote gets a single `>` marker) without changing the content.
// Upstream and the CMS spell a few territories differently (`Wallis et Futuna`).
const normalizeName = (name: string) => name.trim().toLowerCase().replace(/[\s-]+/g, ' ')
const normalizeText = (text: string | undefined) => (text ?? '').replace(/[\\>\s]/g, '')
const trim = (text: string | undefined) => text?.trim()

/**
 * The fields the CMS must carry unchanged from upstream to the canonical. Known,
 * documented losses (see the seed warnings) are left out: headcount free text,
 * micro-entreprise restriction, advisor step links, amounts without a field.
 * Territories are compared by name: a program mixing departments and regions
 * keeps the regions in Payload, a department of a listed region being dropped
 * (already covered) and the others going to the feedback text. Upstream names
 * come from the codes, the CMS ones from its free text.
 */
function withoutCoveredDepartments(codes: readonly string[]): string[] {
  const regionIds = new Set(
    codes.filter((code) => !code.startsWith('DEP-')).flatMap((code) => relations.areaByCogCode(code)?.id ?? []),
  )
  return codes.filter((code) => {
    const parentId = code.startsWith('DEP-') ? relations.areaByCogCode(code)?.parentId : undefined
    return parentId === undefined || !regionIds.has(parentId)
  })
}

function project(input: CanonicalProgramInput | undefined, side: 'upstream' | 'cms') {
  const e = input?.eligibilite
  const inclusions = e?.secteur_activite?.structure?.inclusions ?? []
  const codes = e?.secteur_geographique?.structure?.inclusions ?? []
  const names =
    side === 'upstream'
      ? TerritoryNameResolver.namesOf(withoutCoveredDepartments(codes))
      : (e?.secteur_geographique?.texte ?? []).flatMap((texte) => texte.split(','))
  const territories = names.map(normalizeName).filter(Boolean)
  return {
    titre: trim(input?.titre),
    promesse: trim(input?.promesse),
    description: normalizeText(input?.description),
    description_longue: normalizeText(input?.description_longue),
    meta: input?.meta,
    url_source: trim(input?.url_source),
    date_ouverture: input?.date_ouverture,
    date_cloture: input?.date_cloture,
    types_aides: input?.types_aides,
    themes: [...(input?.themes ?? [])].sort(),
    operateurs: {
      contact: input?.operateurs.contact.nom,
      autres: (input?.operateurs.autres ?? []).map((o) => o.nom).sort(),
    },
    contact_question: input?.contact_question,
    effectif: e?.effectif?.structure ?? null,
    secteur_activite: inclusions.length === ALL_NAF_SECTIONS ? [] : [...inclusions].sort(),
    national: codes.includes(COG_FRANCE),
    territoires: territories.sort(),
    autres_criteres: [...(e?.anciennete?.texte ?? []), ...(e?.autres_criteres?.texte ?? [])],
    etapes: (input?.etapes_activation ?? []).map((etape) => ({
      description: normalizeText(etape.description),
      urls: (etape.liens ?? []).flatMap((lien) => ('url' in lien ? [lien.url] : [])),
    })),
    variantes: (input?.variantes ?? []).map((v) => [...(v.conditions.regions ?? [])].sort()),
  }
}

describe('upstream → CMS → canonical round-trip', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await new GeographicAreasSeed(payload).run()

    const records = new LocalJsonSnapshot().read<TeeRecord[]>('programs')
    const importer = new TeeImporter()
    expected = records.map((record) => {
      const input = importer.import(record)
      input.id = SlugCanonicalId.from(input.slug)
      return input
    })

    const result = await new ProgramsSeed(payload, records).run()
    expect(result.errors).toBe(0)
    relations = await PayloadProgramRelations.fromPayload(payload, new Map())

    const markdown = await PayloadRichTextToMarkdown.create(payload.config)
    const mapper = new ProgramCanonicalMapper(markdown)
    // Other test files seed fixture-only programs in the same database.
    const programs = await payload.find({
      collection: 'programs',
      where: { slug: { in: expected.map((input) => input.slug) } },
      limit: 0,
      depth: 1,
      draft: true,
    })
    actual = new Map(programs.docs.map((program) => [program.slug, mapper.map(program)]))
  }, 600_000)

  it('imports every upstream program', () => {
    expect(actual.size).toBe(expected.length)
  })

  it('keeps the canonical id derived from the slug', () => {
    for (const input of expected) expect(actual.get(input.slug)?.id).toBe(input.id)
  })

  it('keeps a temporarily unavailable program flagged as such', () => {
    const unavailable = expected.filter((input) => input.statut_dispositif === 'temporairement_indisponible')
    expect(unavailable.length).toBeGreaterThan(0)
    for (const input of unavailable) {
      expect(actual.get(input.slug)?.statut_dispositif).toBe('temporairement_indisponible')
    }
  })

  it('carries every mapped field unchanged', () => {
    const diffs: string[] = []
    for (const input of expected) {
      const want = project(input, 'upstream')
      const got = project(actual.get(input.slug), 'cms')
      for (const key of Object.keys(want) as (keyof typeof want)[]) {
        if (JSON.stringify(want[key]) !== JSON.stringify(got[key])) {
          diffs.push(`${input.slug}.${key}\n  attendu : ${JSON.stringify(want[key])}\n  obtenu  : ${JSON.stringify(got[key])}`)
        }
      }
    }
    expect(diffs.slice(0, 15).join('\n'), `${diffs.length.toString()} écart(s)`).toBe('')
  })
})
