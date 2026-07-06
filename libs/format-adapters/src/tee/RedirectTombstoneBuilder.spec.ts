import type { CanonicalProgramInput } from '@tee-backoffice/canonical'
import { ProgramRedirects } from './ProgramRedirects'
import { RedirectTombstoneBuilder } from './RedirectTombstoneBuilder'
import { SlugCanonicalId } from './SlugCanonicalId'

const makeInput = (slug: string, over: Partial<CanonicalProgramInput> = {}): CanonicalProgramInput => ({
  id: SlugCanonicalId.from(slug),
  slug,
  source: 'INTERNE',
  date_mise_a_jour: '2026-01-01T00:00:00+00:00',
  titre: `Titre ${slug}`,
  description: `Desc ${slug}`,
  statut_edition: 'pret_prod',
  statut_dispositif: 'valide',
  types_aides: ['financement'],
  operateurs: { contact: { nom: 'ADEME' } },
  ...over,
})

const redirects = (map: Record<string, string>) => new ProgramRedirects({ program_redirects: map })

describe('RedirectTombstoneBuilder', () => {
  const builder = new RedirectTombstoneBuilder()

  it('crée un tombstone clonant la cible sous l’ancien slug', () => {
    const target = makeInput('nouveau')
    const bySlug = new Map([['nouveau', target]])

    const { tombstones, markedInPlace, skipped } = builder.build(redirects({ ancien: 'nouveau' }), bySlug)

    expect(markedInPlace).toEqual([])
    expect(skipped).toEqual([])
    expect(tombstones).toHaveLength(1)
    const tombstone = tombstones[0]
    expect(tombstone.slug).toBe('ancien')
    expect(tombstone.id).toBe(SlugCanonicalId.from('ancien'))
    expect(tombstone.statut_dispositif).toBe('remplace')
    expect(tombstone.remplace_par).toBe(SlugCanonicalId.from('nouveau'))
    // Content is cloned from the replacement.
    expect(tombstone.titre).toBe('Titre nouveau')
    expect(tombstone.description).toBe('Desc nouveau')
  })

  it('marque en place quand l’ancien slug existe encore comme programme réel', () => {
    const target = makeInput('nouveau')
    const former = makeInput('ancien')
    const bySlug = new Map([
      ['nouveau', target],
      ['ancien', former],
    ])

    const { tombstones, markedInPlace } = builder.build(redirects({ ancien: 'nouveau' }), bySlug)

    expect(tombstones).toEqual([])
    expect(markedInPlace).toEqual(['ancien'])
    expect(former.statut_dispositif).toBe('remplace')
    expect(former.remplace_par).toBe(SlugCanonicalId.from('nouveau'))
  })

  it('ignore une redirection dont la cible est absente du store', () => {
    const { tombstones, markedInPlace, skipped } = builder.build(
      redirects({ ancien: 'cible-absente' }),
      new Map(),
    )

    expect(tombstones).toEqual([])
    expect(markedInPlace).toEqual([])
    expect(skipped).toEqual([
      { former: 'ancien', current: 'cible-absente', reason: 'dispositif de remplacement absent' },
    ])
  })

  it('produit un tombstone indépendant de la cible (deep clone)', () => {
    const target = makeInput('nouveau')
    const bySlug = new Map([['nouveau', target]])

    const { tombstones } = builder.build(redirects({ ancien: 'nouveau' }), bySlug)
    tombstones[0].titre = 'modifié'

    expect(target.titre).toBe('Titre nouveau')
  })
})
