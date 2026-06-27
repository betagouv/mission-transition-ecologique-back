import { describe, expect, it } from 'vitest'
import { canonicalProgramSchema } from '../../src/canonical-program/canonical-program.schema'
import { validMinimal } from '../fixtures/valid-minimal'
import { validFull } from '../fixtures/valid-full'

const cloneMinimal = (): Record<string, unknown> => structuredClone(validMinimal) as Record<string, unknown>

describe('canonicalProgramSchema', () => {
  it('parses the minimal valid fixture', () => {
    expect(canonicalProgramSchema.safeParse(validMinimal).success).toBe(true)
  })

  it('parses the full valid fixture', () => {
    expect(canonicalProgramSchema.safeParse(validFull).success).toBe(true)
  })

  it('rejects a missing required field (titre)', () => {
    const input = cloneMinimal()
    delete input['titre']
    expect(canonicalProgramSchema.safeParse(input).success).toBe(false)
  })

  it('rejects an unknown enum value (statut_dispositif)', () => {
    const input = cloneMinimal()
    input['statut_dispositif'] = 'pas_un_statut'
    expect(canonicalProgramSchema.safeParse(input).success).toBe(false)
  })

  it('requires types_aides to be non-empty', () => {
    const input = cloneMinimal()
    input['types_aides'] = []
    expect(canonicalProgramSchema.safeParse(input).success).toBe(false)
  })

  describe('cross-field: duree required for formation', () => {
    it('rejects formation without duree', () => {
      const input = cloneMinimal()
      input['types_aides'] = ['formation']
      expect(canonicalProgramSchema.safeParse(input).success).toBe(false)
    })

    it('accepts formation with duree', () => {
      const input = cloneMinimal()
      input['types_aides'] = ['formation']
      input['duree'] = { type: 'durée de l’accompagnement', valeur: '5 jours' }
      expect(canonicalProgramSchema.safeParse(input).success).toBe(true)
    })

    it('does not require duree for etude (financed studies have none)', () => {
      const input = cloneMinimal()
      input['types_aides'] = ['etude']
      expect(canonicalProgramSchema.safeParse(input).success).toBe(true)
    })

    it('does not require duree for financement only', () => {
      expect(canonicalProgramSchema.safeParse(validMinimal).success).toBe(true)
    })
  })

  describe('cross-field: remplace_par required when statut_dispositif = remplace', () => {
    it('rejects remplace without remplace_par', () => {
      const input = cloneMinimal()
      input['statut_dispositif'] = 'remplace'
      expect(canonicalProgramSchema.safeParse(input).success).toBe(false)
    })

    it('accepts remplace with a valid remplace_par', () => {
      const input = cloneMinimal()
      input['statut_dispositif'] = 'remplace'
      input['remplace_par'] = 'b1b2c3d4e5f6g7h8i9j0klmn'
      expect(canonicalProgramSchema.safeParse(input).success).toBe(true)
    })
  })

  describe('contact_question discriminated union', () => {
    it('rejects an invalid email', () => {
      const input = cloneMinimal()
      input['contact_question'] = { type: 'email', valeur: 'not-an-email' }
      expect(canonicalProgramSchema.safeParse(input).success).toBe(false)
    })

    it('accepts ADEME without a valeur', () => {
      const input = cloneMinimal()
      input['contact_question'] = { type: 'ADEME' }
      expect(canonicalProgramSchema.safeParse(input).success).toBe(true)
    })
  })

  describe('branded primitives', () => {
    it('rejects an invalid SIREN', () => {
      const input = cloneMinimal()
      input['operateurs'] = { contact: { nom: 'X', siren: '123' } }
      expect(canonicalProgramSchema.safeParse(input).success).toBe(false)
    })

    it('rejects an invalid slug', () => {
      const input = cloneMinimal()
      input['slug'] = 'Not A Slug'
      expect(canonicalProgramSchema.safeParse(input).success).toBe(false)
    })

    it('rejects an invalid COG code in eligibilite', () => {
      const input = cloneMinimal()
      input['eligibilite'] = { secteur_geographique: { structure: { inclusions: ['53'] } } }
      expect(canonicalProgramSchema.safeParse(input).success).toBe(false)
    })
  })

  describe('open-key blocks survive validation', () => {
    it('preserves unknown keys in autres_donnees and variante.autres_champs', () => {
      const parsed = canonicalProgramSchema.parse(validFull)
      expect(parsed.autres_donnees?.['operateur_ref_interne']).toBe('XYZ-42')
      expect(parsed.variantes?.[0]?.autres_champs?.['titre_historique']).toBe(
        'Ancien intitulé du dispositif',
      )
    })

    it('strips unknown keys at the top level', () => {
      const input = cloneMinimal()
      input['champ_inconnu'] = 'devrait disparaitre'
      const parsed = canonicalProgramSchema.parse(input)
      expect('champ_inconnu' in parsed).toBe(false)
    })
  })

  describe('safeParse never throws on malformed input', () => {
    it.each([{}, { types_aides: 'formation' }, { types_aides: ['bogus'] }, null, 42])(
      'returns success:false without throwing for %o',
      (input) => {
        expect(() => canonicalProgramSchema.safeParse(input)).not.toThrow()
        expect(canonicalProgramSchema.safeParse(input).success).toBe(false)
      },
    )
  })

  describe('dates & structures', () => {
    it('accepts a date-heure for date_cloture', () => {
      const input = cloneMinimal()
      input['date_cloture'] = '2026-03-19T17:00:00+01:00'
      expect(canonicalProgramSchema.safeParse(input).success).toBe(true)
    })

    it('rejects an interval with no bound', () => {
      const input = cloneMinimal()
      input['eligibilite'] = { effectif: { structure: {} } }
      expect(canonicalProgramSchema.safeParse(input).success).toBe(false)
    })

    it('rejects a contact_question ADEME carrying a valeur (strict)', () => {
      const input = cloneMinimal()
      input['contact_question'] = { type: 'ADEME', valeur: 'oops' }
      expect(canonicalProgramSchema.safeParse(input).success).toBe(false)
    })
  })
})
