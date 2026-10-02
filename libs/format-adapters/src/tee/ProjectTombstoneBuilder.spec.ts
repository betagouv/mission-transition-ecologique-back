import { CanonicalProjectValidator } from '@tee-backoffice/canonical'
import type { CanonicalProjectInput } from '@tee-backoffice/canonical'
import { LocalJsonSnapshot } from './LocalJsonSnapshot'
import { ProjectRedirects } from './ProjectRedirects'
import { ProjectTombstoneBuilder } from './ProjectTombstoneBuilder'
import { SlugCanonicalId } from './SlugCanonicalId'
import { TeeProjectImporter } from './TeeProjectImporter'
import { teeProjectsSchema } from './tee-project.schema'

const makeInput = (slug: string, over: Partial<CanonicalProjectInput> = {}): CanonicalProjectInput => ({
  id: SlugCanonicalId.forProject(slug),
  slug,
  source: 'INTERNE',
  date_mise_a_jour: '2026-01-01T00:00:00+00:00',
  statut_projet: 'valide',
  titre: `Titre ${slug}`,
  nom_court: slug,
  description_courte: `Desc ${slug}`,
  description_longue: { contenu: `Contenu ${slug}` },
  theme_principal: 'energie',
  ...over,
})

const redirects = (map: Record<string, string>) => new ProjectRedirects({ project_redirects: map })

describe('ProjectTombstoneBuilder', () => {
  const builder = new ProjectTombstoneBuilder()
  const validator = new CanonicalProjectValidator()

  it('crée un tombstone clonant la cible sous l’ancien slug', () => {
    const target = makeInput('voiture-propre', { projets_lies: { projets: [SlugCanonicalId.forProject('plan-mobilite')] } })
    const bySlug = new Map([['voiture-propre', target]])

    const { tombstones, markedInPlace, skipped } = builder.build(redirects({ 'vehicule-propre': 'voiture-propre' }), bySlug)

    expect(markedInPlace).toEqual([])
    expect(skipped).toEqual([])
    expect(tombstones).toHaveLength(1)
    const tombstone = tombstones[0]
    expect(tombstone.slug).toBe('vehicule-propre')
    expect(tombstone.id).toBe(SlugCanonicalId.forProject('vehicule-propre'))
    expect(tombstone.statut_projet).toBe('remplace')
    expect(tombstone.remplace_par).toBe(SlugCanonicalId.forProject('voiture-propre'))
    expect(tombstone.titre).toBe('Titre voiture-propre')
    expect(tombstone.projets_lies).toEqual(target.projets_lies)
    expect(validator.validate(tombstone).success).toBe(true)
  })

  it('garde tel quel un ancien slug non kebab-case, accepté sur un projet remplacé', () => {
    const bySlug = new Map([['maintenance-preventive', makeInput('maintenance-preventive')]])

    const { tombstones } = builder.build(redirects({ 'maintenance-préventive': 'maintenance-preventive' }), bySlug)

    expect(tombstones[0].slug).toBe('maintenance-préventive')
    expect(tombstones[0].id).not.toBe(SlugCanonicalId.forProject('maintenance-preventive'))
    const result = validator.validate(tombstones[0])
    expect(result.success).toBe(true)
    // The same slug on a live project is refused: only a tombstone may carry it.
    expect(validator.validate(makeInput('maintenance-préventive')).success).toBe(false)
  })

  it('marque en place quand l’ancien slug existe encore comme projet réel', () => {
    const target = makeInput('nouveau')
    const former = makeInput('ancien')
    const bySlug = new Map([
      ['nouveau', target],
      ['ancien', former],
    ])

    const { tombstones, markedInPlace } = builder.build(redirects({ ancien: 'nouveau' }), bySlug)

    expect(tombstones).toEqual([])
    expect(markedInPlace).toEqual(['ancien'])
    expect(former.statut_projet).toBe('remplace')
    expect(former.remplace_par).toBe(SlugCanonicalId.forProject('nouveau'))
    expect(former.id).toBe(SlugCanonicalId.forProject('ancien'))
  })

  it('ignore une redirection dont la cible est absente', () => {
    const { tombstones, markedInPlace, skipped } = builder.build(redirects({ ancien: 'cible-absente' }), new Map())

    expect(tombstones).toEqual([])
    expect(markedInPlace).toEqual([])
    expect(skipped).toEqual([{ former: 'ancien', current: 'cible-absente', reason: 'projet de remplacement absent' }])
  })

  it('produit un tombstone indépendant de la cible (deep clone)', () => {
    const target = makeInput('nouveau')
    const { tombstones } = builder.build(redirects({ ancien: 'nouveau' }), new Map([['nouveau', target]]))

    tombstones[0].description_longue.contenu = 'modifié'

    expect(target.description_longue.contenu).toBe('Contenu nouveau')
  })

  describe('copie versionnée complète (static/upstream)', () => {
    const snapshot = new LocalJsonSnapshot()
    const inputs = new TeeProjectImporter().importMany(
      teeProjectsSchema.parse(snapshot.read<unknown>('projects')),
      '2026-10-01T06:00:00+00:00',
    )
    const bySlug = new Map(inputs.map((input) => [input.slug, input]))
    const application = builder.build(new ProjectRedirects(snapshot.read<unknown>('redirects')), bySlug)

    it('transforme les 6 redirections amont en 6 tombstones valides', () => {
      expect(application.skipped).toEqual([])
      expect(application.markedInPlace).toEqual([])
      expect(application.tombstones.map((tombstone) => tombstone.slug)).toEqual([
        'vehicule-propre',
        'seche-linge',
        'economisateurs-eau-sanitaires',
        'restauration-durable',
        'composteur',
        'maintenance-préventive',
      ])
      expect(application.tombstones.filter((tombstone) => !validator.validate(tombstone).success)).toEqual([])
    })

    it('ne réutilise aucun identifiant de projet réel', () => {
      const ids = new Set(inputs.map((input) => input.id))
      expect(application.tombstones.some((tombstone) => ids.has(tombstone.id))).toBe(false)
    })
  })
})
