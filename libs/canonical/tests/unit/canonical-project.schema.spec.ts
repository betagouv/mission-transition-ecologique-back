import { describe, expect, it } from 'vitest'
import { canonicalProjectSchema } from '../../src/canonical-project/canonical-project.schema'
import { projectValidMinimal } from '../fixtures/project-valid-minimal'
import { projectValidFull } from '../fixtures/project-valid-full'

const cloneMinimal = (): Record<string, unknown> => structuredClone(projectValidMinimal) as Record<string, unknown>

const OTHER_ID = 'r1b2c3d4e5f6g7h8i9j0klmn'

describe('canonicalProjectSchema', () => {
  it('parses the minimal valid fixture', () => {
    expect(canonicalProjectSchema.safeParse(projectValidMinimal).success).toBe(true)
  })

  it('parses the full valid fixture without losing a field', () => {
    const result = canonicalProjectSchema.safeParse(projectValidFull)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(projectValidFull)
  })

  it.each([
    'id',
    'slug',
    'source',
    'date_mise_a_jour',
    'statut_projet',
    'titre',
    'nom_court',
    'description_courte',
    'description_longue',
    'theme_principal',
  ])('rejects a missing required field (%s)', (field) => {
    const input = cloneMinimal()
    delete input[field]
    expect(canonicalProjectSchema.safeParse(input).success).toBe(false)
  })

  it('rejects an empty long description', () => {
    const input = cloneMinimal()
    input['description_longue'] = { contenu: '' }
    expect(canonicalProjectSchema.safeParse(input).success).toBe(false)
  })

  it('rejects an unknown theme', () => {
    const input = cloneMinimal()
    input['theme_principal'] = 'energy'
    expect(canonicalProjectSchema.safeParse(input).success).toBe(false)
  })

  describe('cross-field: remplace_par goes with statut_projet = remplace', () => {
    it('rejects remplace without remplace_par', () => {
      const input = cloneMinimal()
      input['statut_projet'] = 'remplace'
      const result = canonicalProjectSchema.safeParse(input)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(['remplace_par'])
    })

    it('accepts remplace with a valid remplace_par', () => {
      const input = cloneMinimal()
      input['statut_projet'] = 'remplace'
      input['remplace_par'] = OTHER_ID
      expect(canonicalProjectSchema.safeParse(input).success).toBe(true)
    })

    it('rejects remplace_par on a valide project', () => {
      const input = cloneMinimal()
      input['remplace_par'] = OTHER_ID
      const result = canonicalProjectSchema.safeParse(input)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(['remplace_par'])
    })
  })

  describe('cross-field: kebab-case slug, except for a remplace tombstone', () => {
    const tombstone = (slug: string) => ({ ...cloneMinimal(), slug, statut_projet: 'remplace', remplace_par: OTHER_ID })

    it('accepts the former slug maintenance-préventive on a remplace project', () => {
      expect(canonicalProjectSchema.safeParse(tombstone('maintenance-préventive')).success).toBe(true)
    })

    it('rejects the same former slug on a live project', () => {
      const result = canonicalProjectSchema.safeParse({ ...cloneMinimal(), slug: 'maintenance-préventive' })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(['slug'])
    })

    it.each(['avec espace', 'avec/slash', ''])('rejects %j even on a remplace project', (slug) => {
      expect(canonicalProjectSchema.safeParse(tombstone(slug)).success).toBe(false)
    })
  })

  describe('image.url', () => {
    const withImageUrl = (url: string): Record<string, unknown> => ({ ...cloneMinimal(), image: { url } })

    it.each(['https://cdn.example.org/media/image.webp', '/api/media/file/image.webp'])('accepts %s', (url) => {
      expect(canonicalProjectSchema.safeParse(withImageUrl(url)).success).toBe(true)
    })

    it.each(['images/projet/image.webp', './image.webp', '/api/media/file/mon image.webp', 'javascript:alert(1)', ''])(
      'rejects %j',
      (url) => {
        expect(canonicalProjectSchema.safeParse(withImageUrl(url)).success).toBe(false)
      },
    )
  })

  describe('priorite', () => {
    it('rejects an invalid code_naf', () => {
      const input = cloneMinimal()
      input['priorite'] = { par_secteur: [{ code_naf: 'ZZ', priorite: 1 }] }
      const result = canonicalProjectSchema.safeParse(input)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(['priorite', 'par_secteur', 0, 'code_naf'])
    })

    it.each([-1, 1.5])('rejects the priority %d', (value) => {
      const input = cloneMinimal()
      input['priorite'] = { defaut: value }
      expect(canonicalProjectSchema.safeParse(input).success).toBe(false)
    })

    it('accepts a zero priority', () => {
      const input = cloneMinimal()
      input['priorite'] = { defaut: 0, mise_en_avant: 0 }
      expect(canonicalProjectSchema.safeParse(input).success).toBe(true)
    })
  })

  it('rejects an invalid sector', () => {
    const input = cloneMinimal()
    input['secteurs'] = ['C', 'industrie']
    expect(canonicalProjectSchema.safeParse(input).success).toBe(false)
  })

  it('rejects a faq without any question', () => {
    const input = cloneMinimal()
    input['faq'] = { titre: 'Questions fréquentes', questions: [] }
    expect(canonicalProjectSchema.safeParse(input).success).toBe(false)
  })

  it('rejects a linked program or project that is not a cuid2', () => {
    expect(canonicalProjectSchema.safeParse({ ...cloneMinimal(), dispositifs: ['Mon-Dispositif'] }).success).toBe(false)
    expect(
      canonicalProjectSchema.safeParse({ ...cloneMinimal(), projets_lies: { projets: ['Mon-Projet'] } }).success,
    ).toBe(false)
  })
})
