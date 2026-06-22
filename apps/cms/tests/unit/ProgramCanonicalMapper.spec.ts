import { describe, it, expect, vi } from 'vitest'
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import { ProgramCanonicalMapper } from '@/services/canonical/ProgramCanonicalMapper'
import type { RichTextToMarkdown, RichTextValue } from '@/services/canonical/rich-text/RichTextToMarkdown'
import type { Program } from '../../payload-types'

/**
 * Test double for the rich text → Markdown port. The real Markdown fidelity is
 * Payload's `convertLexicalToMarkdown` (in PayloadRichTextToMarkdown) and is not
 * the mapper's concern; here we just flatten text nodes deterministically so the
 * mapper's wiring and field placement can be asserted.
 */
class StubRichTextToMarkdown implements RichTextToMarkdown {
  convert(value: RichTextValue | null | undefined): string {
    const children = value?.root?.children
    if (!Array.isArray(children)) return ''
    return children.map((block) => StubRichTextToMarkdown.text(block)).join('\n\n').trim()
  }

  private static text(node: unknown): string {
    if (typeof node !== 'object' || node === null) return ''
    const record = node as { text?: unknown; children?: unknown }
    if (typeof record.text === 'string') return record.text
    if (Array.isArray(record.children)) {
      return record.children.map((child) => StubRichTextToMarkdown.text(child)).join('')
    }
    return ''
  }
}

const CUID = 'a1b2c3d4e5f6g7h8i9j0klmn'
const TIMESTAMP = '2026-03-19T17:00:00.000Z'

/** Minimal Lexical rich text wrapping a single paragraph. */
function richText(text: string): Program['description'] {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', text, format: 0, version: 1 }],
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

/** A minimal, valid Payload program with all required fields populated. */
function buildProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: 1,
    canonicalId: CUID,
    title: 'Visite Énergie',
    operator: { id: 1, name: 'ADEME', updatedAt: TIMESTAMP, createdAt: TIMESTAMP },
    url: 'https://example.org/visite',
    aidType: 'financement',
    promise: 'Réduisez votre facture énergétique',
    description: richText('Un accompagnement pour les PME industrielles.'),
    slug: 'visite-energie',
    workflowStatus: 'publie',
    updatedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    ...overrides,
  } as Program
}

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
    it('keeps the first selected method that carries its value', () => {
      const data = mapAndValidate(
        buildProgram({
          contactMethods: ['url', 'email'],
          contactPageUrl: 'https://example.org/contact',
          contactEmail: 'contact@ademe.fr',
        }),
      )
      expect(data.contact_question).toEqual({ type: 'url', valeur: 'https://example.org/contact' })
    })

    it('falls through when the first method lacks its value', () => {
      const data = mapAndValidate(
        buildProgram({ contactMethods: ['email', 'advisor'], contactEmail: '' }),
      )
      expect(data.contact_question).toEqual({ type: 'conseiller_entreprise' })
    })
  })

  describe('activation steps', () => {
    it('drops empty steps and keeps only valid links', () => {
      const data = mapAndValidate(
        buildProgram({
          steps: [
            {
              description: 'Complétez le formulaire',
              links: [
                { url: 'https://example.org/form', linkLabel: 'Formulaire' },
                { url: 'https://example.org/incomplete', linkLabel: '' },
              ],
            },
            { description: '' },
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
    it('omits the effectif structure when every size bucket is selected', () => {
      const data = mapAndValidate(
        buildProgram({
          companySizes: ['0-9', '10-19', '20-49', '50-249', '250-499', '500-4999', '5000+'],
        }),
      )
      expect(data.eligibilite?.effectif?.structure).toBeUndefined()
    })

    it('derives a bounded interval from a subset of buckets', () => {
      const data = mapAndValidate(buildProgram({ companySizes: ['0-9', '10-19'] }))
      expect(data.eligibilite?.effectif?.structure).toEqual({ min: 0, max: 19 })
    })

    it('leaves the interval open-ended when the top bucket is selected', () => {
      const data = mapAndValidate(buildProgram({ companySizes: ['500-4999', '5000+'] }))
      expect(data.eligibilite?.effectif?.structure).toEqual({ min: 500 })
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
