import { describe, it, expect } from 'vitest'
import type { CanonicalProgramInput } from '@tee-backoffice/canonical'
import { CanonicalToPayloadMapper } from '@/services/canonical/to-payload/CanonicalToPayloadMapper'
import type { ProgramRelations } from '@/services/canonical/to-payload/ProgramRelations'
import type { MarkdownToRichText } from '@/services/canonical/rich-text/MarkdownToRichText'
import { richText } from './support/canonicalProgramFixtures'

class StubMarkdownToRichText implements MarkdownToRichText {
  convert(markdown: string) {
    return richText(markdown)
  }
}

class StubRelations implements ProgramRelations {
  operatorId(name: string) {
    return ({ ADEME: 1, Bpifrance: 2 } as Record<string, number>)[name]
  }
  areaIdByCogCode(code: string) {
    return ({ 'REG-53': 10, 'DEP-40': 20 } as Record<string, number>)[code]
  }
  resolveGeography(names: string[]) {
    return names.includes('Bretagne') ? { geographicCoverage: 'regional' as const, geographicAreas: [10] } : {}
  }
}

const mapper = new CanonicalToPayloadMapper(new StubMarkdownToRichText(), new StubRelations())

const base: CanonicalProgramInput = {
  id: 'a1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'diagnostic-energie',
  source: 'INTERNE',
  date_mise_a_jour: '2026-01-01T00:00:00+00:00',
  titre: 'Diagnostic énergie',
  description: 'Un diagnostic.',
  statut_edition: 'pret_prod',
  statut_dispositif: 'valide',
  types_aides: ['financement'],
  operateurs: { contact: { nom: 'ADEME' }, autres: [{ nom: 'Bpifrance' }] },
  url_source: 'https://example.org/diagnostic',
}

const map = (overrides: Partial<CanonicalProgramInput> = {}) => mapper.map({ ...base, ...overrides })

describe('CanonicalToPayloadMapper', () => {
  it('maps identity, operators and a publishable program', () => {
    const { data, warnings } = map()
    expect(data).toMatchObject({
      canonicalId: base.id,
      slug: 'diagnostic-energie',
      title: 'Diagnostic énergie',
      aidType: 'financement',
      operator: 1,
      otherOperators: [2],
      workflowStatus: 'publie',
      _status: 'published',
      temporarilyUnavailable: false,
    })
    expect(warnings).toEqual([])
  })

  it('keeps a program without a valid url in draft', () => {
    expect(map({ url_source: undefined }).data).toMatchObject({ workflowStatus: 'en-creation', _status: 'draft' })
  })

  it('fails loudly on an unknown contact operator', () => {
    expect(() => map({ operateurs: { contact: { nom: 'Inconnu' } } })).toThrow('opérateur introuvable')
  })

  it('translates the themes back to the Payload vocabulary', () => {
    expect(map({ themes: ['energie', 'ecoconception'] }).data.themes).toEqual(['energy', 'eco-design'])
  })

  it('flags a temporarily unavailable program', () => {
    expect(map({ statut_dispositif: 'temporairement_indisponible' }).data.temporarilyUnavailable).toBe(true)
  })

  it.each([
    ['advisor', { type: 'conseiller_entreprise' as const }, { contactMethod: 'advisor' }],
    ['email', { type: 'email' as const, valeur: 'a@b.fr' }, { contactMethod: 'email', contactEmail: 'a@b.fr' }],
    ['url', { type: 'url' as const, valeur: 'https://x.fr' }, { contactMethod: 'url', contactPageUrl: 'https://x.fr' }],
  ])('maps a %s contact', (_label, contact_question, expected) => {
    expect(map({ contact_question }).data).toMatchObject(expected)
  })

  describe('company size', () => {
    it('picks the bucket matching the bounds exactly', () => {
      const { data } = map({ eligibilite: { effectif: { structure: { min: 50, max: 249 } } } })
      expect(data).toMatchObject({ companySize: '50-249', companySizeMin: null, companySizeMax: null })
    })

    it('falls back to specific bounds otherwise', () => {
      const { data } = map({ eligibilite: { effectif: { structure: { max: 249 } } } })
      expect(data).toMatchObject({ companySize: 'specific', companySizeMin: null, companySizeMax: 249 })
    })

    it('ignores free text without bounds', () => {
      const { data } = map({ eligibilite: { effectif: { texte: ['Moins de 250 salariés'] } } })
      expect(data.companySize).toBe('all')
    })
  })

  describe('activity sector', () => {
    const ALL = 'ABCDEFGHIJKLMNOPQRSTU'.split('')

    it('reads every NAF section as all sectors', () => {
      expect(map({ eligibilite: { secteur_activite: { structure: { inclusions: ALL } } } }).data.activitySector).toBe('all')
    })

    it('keeps a partial list of NAF sections', () => {
      const { data } = map({ eligibilite: { secteur_activite: { structure: { inclusions: ['A', 'C'] } } } })
      expect(data).toMatchObject({ activitySector: 'naf-sections', nafSections: ['A', 'C'] })
    })
  })

  it('resolves territories from their names', () => {
    const { data } = map({ eligibilite: { secteur_geographique: { texte: ['Bretagne'] } } })
    expect(data).toMatchObject({ geographicCoverage: 'regional', geographicAreas: [10] })
  })

  it('joins seniority and other criteria', () => {
    const { data } = map({
      eligibilite: { anciennete: { texte: ['Pas de critère'] }, autres_criteres: { texte: ['Être à jour'] } },
    })
    expect(data.otherCriteria).toEqual([{ value: 'Pas de critère' }, { value: 'Être à jour' }])
  })

  describe('amounts', () => {
    it('stores the amount in the field of the aid type', () => {
      const { data } = map({ montant: { type: 'montant du financement', valeur: "Jusqu'à 10 000 €" } })
      expect(data.fundingAmount).toBe("Jusqu'à 10 000 €")
    })

    it('reports an amount the aid type has no field for', () => {
      const { data, warnings } = map({
        types_aides: ['etude'],
        montant: { type: 'montant du financement', valeur: '50 %' },
      })
      expect(data.studyRemainingCost).toBeUndefined()
      expect(warnings).toEqual(['montant « montant du financement » sans champ pour le type diagnostic-etude'])
    })
  })

  it('drops advisor step links with a warning, keeping the step', () => {
    const { data, warnings } = map({
      etapes_activation: [{ description: 'Contactez un conseiller', liens: [{ conseiller_entreprise: true }] }],
    })
    expect(data.steps).toHaveLength(1)
    expect(data.steps?.[0]?.links).toEqual([])
    expect(warnings).toHaveLength(1)
  })

  it('maps variants and reports a zone missing from the CMS', () => {
    const { data, warnings } = map({
      variantes: [
        {
          conditions: { effectif: { max: 49 }, regions: ['REG-53', 'OM-975'] },
          modifications: { montant: { type: 'Montant du dispositif', valeur: '80 %' } },
        },
      ],
    })
    expect(data.variants?.[0]?.conditions).toEqual([
      { conditionType: 'geographicArea', geographicAreaValue: [10] },
      { conditionType: 'companySize', companySizeValue: ['0-9', '10-19', '20-49'] },
    ])
    expect(data.variants?.[0]?.modifications).toEqual([{ field: 'montant', newValue: '80 %' }])
    expect(warnings).toEqual(['zone OM-975 absente des zones géographiques du CMS (condition de variante ignorée)'])
  })
})
