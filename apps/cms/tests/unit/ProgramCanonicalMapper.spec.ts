import { describe, it, expect, vi } from 'vitest'
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import { ProgramCanonicalMapper } from '@/services/canonical/ProgramCanonicalMapper'
import type { RichTextToMarkdown } from '@/services/canonical/rich-text/RichTextToMarkdown'
import type { Program } from '../../payload-types'
import {
  CUID,
  StubRichTextToMarkdown,
  TIMESTAMP,
  buildProgram,
  richText,
} from './support/canonicalProgramFixtures'

const mapper = new ProgramCanonicalMapper(new StubRichTextToMarkdown())
const validator = new CanonicalProgramValidator()

/** Maps then validates, failing the test with readable errors on invalid output. */
function mapAndValidate(program: Program) {
  const input = mapper.map(program)
  const result = validator.validate(input)
  if (!result.success) {
    throw new Error(`canonical validation failed: ${JSON.stringify(result.errors, null, 2)}`)
  }
  return result.program.toJSON()
}

describe('ProgramCanonicalMapper', () => {
  describe('minimal program', () => {
    it('produces a valid canonical program', () => {
      const data = mapAndValidate(buildProgram())
      expect(data.id).toBe(CUID)
      expect(data.slug).toBe('visite-energie')
      expect(data.source).toBe('INTERNE')
      expect(data.date_mise_a_jour).toBe(TIMESTAMP)
      expect(data.titre).toBe('Visite Énergie')
      expect(data.promesse).toBe('Réduisez votre facture énergétique')
      expect(data.description).toBe('Un accompagnement pour les PME industrielles.')
      expect(data.operateurs.contact.nom).toBe('ADEME')
    })

    it('maps publie → pret_prod / valide', () => {
      const data = mapAndValidate(buildProgram())
      expect(data.statut_edition).toBe('pret_prod')
      expect(data.statut_dispositif).toBe('valide')
    })

    it('maps the single aidType to a one-element types_aides', () => {
      const data = mapAndValidate(buildProgram({ aidType: 'avantage-fiscal' }))
      expect(data.types_aides).toEqual(['avantage_fiscal'])
    })
  })

  describe('content', () => {
    it('delegates description and additionalInfo conversion to the markdown port', () => {
      const markdown: RichTextToMarkdown = { convert: vi.fn().mockReturnValue('converted') }
      const data = new CanonicalProgramValidator()
        .parse(new ProgramCanonicalMapper(markdown).map(buildProgram({ additionalInfo: richText('extra') })))
        .toJSON()
      expect(markdown.convert).toHaveBeenCalledWith(buildProgram().description)
      expect(data.description).toBe('converted')
      expect(data.description_longue).toBe('converted')
    })

    it('omits meta unless both title and description are present', () => {
      const onlyTitle = mapAndValidate(buildProgram({ metaTitle: 'SEO' }))
      expect(onlyTitle.meta).toBeUndefined()

      const both = mapAndValidate(buildProgram({ metaTitle: 'SEO', metaDescription: 'desc' }))
      expect(both.meta).toEqual({ titre: 'SEO', description: 'desc' })
    })
  })

  describe('amounts and duration', () => {
    it('builds a self-described montant labelled by aid type', () => {
      const data = mapAndValidate(buildProgram({ aidType: 'pret', loanAmount: 'De 10 000 € à 75 000 €' }))
      expect(data.montant).toEqual({ type: 'Montant du prêt', valeur: 'De 10 000 € à 75 000 €' })
    })

    it('requires duree for a formation (validation gate fails without it)', () => {
      const input = mapper.map(buildProgram({ aidType: 'formation' }))
      expect(validator.validate(input).success).toBe(false)
    })

    it('maps formationDuration to duree', () => {
      const data = mapAndValidate(
        buildProgram({ aidType: 'formation', formationDuration: '3 heures' }),
      )
      expect(data.types_aides).toEqual(['formation'])
      expect(data.duree).toEqual({ type: 'Durée de la formation', valeur: '3 heures' })
    })
  })

  describe('contact question', () => {
    it('maps the selected url method with its value', () => {
      const data = mapAndValidate(
        buildProgram({
          contactMethod: 'url',
          contactPageUrl: 'https://example.org/contact',
        }),
      )
      expect(data.contact_question).toEqual({ type: 'url', valeur: 'https://example.org/contact' })
    })

    it('maps the advisor method without a value', () => {
      const data = mapAndValidate(buildProgram({ contactMethod: 'advisor' }))
      expect(data.contact_question).toEqual({ type: 'conseiller_entreprise' })
    })

    it('emits nothing when the selected method lacks its value', () => {
      const data = mapAndValidate(
        buildProgram({ contactMethod: 'email', contactEmail: '' }),
      )
      expect(data.contact_question).toBeUndefined()
    })
  })

  describe('activation steps', () => {
    it('drops empty steps and keeps only valid links', () => {
      const data = mapAndValidate(
        buildProgram({
          steps: [
            {
              description: richText('Complétez le formulaire'),
              links: [
                { url: 'https://example.org/form', linkLabel: 'Formulaire' },
                { url: 'https://example.org/incomplete', linkLabel: '' },
              ],
            },
            { description: richText('') },
          ],
        }),
      )
      expect(data.etapes_activation).toEqual([
        {
          description: 'Complétez le formulaire',
          liens: [{ texte: 'Formulaire', url: 'https://example.org/form' }],
        },
      ])
    })
  })

  describe('themes', () => {
    it('translates English Payload values to the French canonical taxonomy', () => {
      const data = mapAndValidate(buildProgram({ themes: ['energy', 'building', 'eco-design'] }))
      expect(data.themes).toEqual(['energie', 'batiment', 'ecoconception'])
    })
  })

  describe('eligibility', () => {
    it('omits the effectif when the size is "all" (no constraint)', () => {
      const data = mapAndValidate(buildProgram({ companySize: 'all' }))
      expect(data.eligibilite?.effectif).toBeUndefined()
    })

    it('maps a size bucket to its label and bounds', () => {
      const data = mapAndValidate(buildProgram({ companySize: '0-9' }))
      expect(data.eligibilite?.effectif).toEqual({
        texte: ['0 à 9 salariés'],
        structure: { min: 0, max: 9 },
      })
    })

    it('leaves the interval open-ended for the top bucket', () => {
      const data = mapAndValidate(buildProgram({ companySize: '5000+' }))
      expect(data.eligibilite?.effectif?.structure).toEqual({ min: 5000 })
    })

    it('maps a specific min/max headcount to an explicit interval', () => {
      const data = mapAndValidate(
        buildProgram({ companySize: 'specific', companySizeMin: 3, companySizeMax: 49 }),
      )
      expect(data.eligibilite?.effectif).toEqual({
        texte: ['De 3 à 49 salariés'],
        structure: { min: 3, max: 49 },
      })
    })

    it('omits the sector when it is "all"', () => {
      const data = mapAndValidate(buildProgram({ activitySector: 'all' }))
      expect(data.eligibilite?.secteur_activite).toBeUndefined()
    })

    it('maps NAF sections to inclusions and editorial labels', () => {
      const data = mapAndValidate(
        buildProgram({ activitySector: 'naf-sections', nafSections: ['A', 'I'] }),
      )
      expect(data.eligibilite?.secteur_activite?.structure?.inclusions).toEqual(['A', 'I'])
      expect(data.eligibilite?.secteur_activite?.texte).toEqual([
        'A : Agriculture, sylviculture et pêche',
        'I : Hébergement et restauration',
      ])
    })

    it('maps a specific sector to a description and an associated NAF code', () => {
      const data = mapAndValidate(
        buildProgram({
          activitySector: 'specific',
          activitySectorDescription: 'Tertiaire',
          nafCode: '62.01Z',
        }),
      )
      expect(data.eligibilite?.secteur_activite?.texte).toEqual(['Tertiaire'])
      expect(data.eligibilite?.secteur_activite?.structure?.inclusions).toEqual(['62.01Z'])
    })

    it('builds COG codes from geographic areas', () => {
      const data = mapAndValidate(
        buildProgram({
          geographicAreas: [
            { id: 1, name: 'Bretagne', coverageType: 'region', inseeCode: '53', updatedAt: TIMESTAMP, createdAt: TIMESTAMP },
            { id: 2, name: 'Paris', coverageType: 'commune', inseeCode: '75056', updatedAt: TIMESTAMP, createdAt: TIMESTAMP },
          ],
        }),
      )
      expect(data.eligibilite?.secteur_geographique?.structure?.inclusions).toEqual([
        'REG-53',
        'COM-75056',
      ])
      expect(data.eligibilite?.secteur_geographique?.texte).toEqual(['Bretagne', 'Paris'])
    })

    it('maps other criteria to editorial texte', () => {
      const data = mapAndValidate(
        buildProgram({ otherCriteria: [{ value: 'À jour de ses cotisations' }] }),
      )
      expect(data.eligibilite?.autres_criteres?.texte).toEqual(['À jour de ses cotisations'])
    })
  })

  describe('replacement', () => {
    it('carries the replacing program canonicalId into remplace_par', () => {
      const replacement = buildProgram({ id: 2, canonicalId: 'z9y8x7w6v5u4t3s2r1q0ponm' })
      const data = mapAndValidate(
        buildProgram({ workflowStatus: 'remplace', replacedBy: replacement }),
      )
      expect(data.statut_dispositif).toBe('remplace')
      expect(data.remplace_par).toBe('z9y8x7w6v5u4t3s2r1q0ponm')
    })
  })
})
