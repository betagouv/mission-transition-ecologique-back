import { describe, it, expect } from 'vitest'
import type { Payload } from 'payload'
import { SlugCanonicalId } from '@tee-backoffice/format-adapters'
import { PayloadProjectRelations } from '@/services/canonical/to-payload/PayloadProjectRelations'

type Row = { id: number; slug: string; canonicalId?: string | null }

// Main rows as `payload.find` returns them, by collection.
const payloadWith = (rows: { programs: Row[]; projects: Row[] }): Payload =>
  ({
    find: ({ collection }: { collection: 'programs' | 'projects' }) => Promise.resolve({ docs: rows[collection] }),
  }) as unknown as Payload

const LEGACY_ID = 'ckz1legacyprogramid00000'

describe('PayloadProjectRelations', () => {
  it('resolves a document by its stored canonical id', async () => {
    const relations = await PayloadProjectRelations.fromPayload(
      payloadWith({
        programs: [{ id: 1, slug: 'diag-eco', canonicalId: SlugCanonicalId.from('diag-eco') }],
        projects: [{ id: 7, slug: 'plan-energie', canonicalId: SlugCanonicalId.forProject('plan-energie') }],
      }),
    )

    expect(relations.programIdByCanonicalId(SlugCanonicalId.from('diag-eco'))).toBe(1)
    expect(relations.projectIdByCanonicalId(SlugCanonicalId.forProject('plan-energie'))).toBe(7)
    expect(relations.programIdByCanonicalId(SlugCanonicalId.from('inconnu'))).toBeUndefined()
  })

  it('resolves a program whose main row keeps an id that is not derived from its slug', async () => {
    const relations = await PayloadProjectRelations.fromPayload(
      payloadWith({ programs: [{ id: 3, slug: 'baisse-les-watts', canonicalId: LEGACY_ID }], projects: [] }),
    )

    // The id the upstream reader gives to the reference, and the one a CMS project carries.
    expect(relations.programIdByCanonicalId(SlugCanonicalId.from('baisse-les-watts'))).toBe(3)
    expect(relations.programIdByCanonicalId(LEGACY_ID)).toBe(3)
  })

  it('resolves a project without a canonical id, or with a former one, by its slug', async () => {
    const relations = await PayloadProjectRelations.fromPayload(
      payloadWith({
        programs: [],
        projects: [
          { id: 8, slug: 'audit', canonicalId: null },
          { id: 9, slug: 'mobilite', canonicalId: LEGACY_ID },
        ],
      }),
    )

    expect(relations.projectIdByCanonicalId(SlugCanonicalId.forProject('audit'))).toBe(8)
    expect(relations.projectIdByCanonicalId(SlugCanonicalId.forProject('mobilite'))).toBe(9)
    // Programs and projects are namespaced: a project slug never answers as a program.
    expect(relations.programIdByCanonicalId(SlugCanonicalId.from('audit'))).toBeUndefined()
  })

  it('sees the projects created since it was loaded once refreshed', async () => {
    const rows = { programs: [] as Row[], projects: [] as Row[] }
    const relations = await PayloadProjectRelations.fromPayload(payloadWith(rows))
    const id = SlugCanonicalId.forProject('nouveau')
    expect(relations.projectIdByCanonicalId(id)).toBeUndefined()

    rows.projects.push({ id: 12, slug: 'nouveau', canonicalId: id })
    await relations.refreshProjects()

    expect(relations.projectIdByCanonicalId(id)).toBe(12)
  })
})
