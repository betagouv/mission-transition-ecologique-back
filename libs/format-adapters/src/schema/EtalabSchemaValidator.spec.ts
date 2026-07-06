import { EtalabSchemaValidator } from './EtalabSchemaValidator'
import { SCHEMA_CORE, SCHEMA_ENTREPRISE } from './schema-row.types'
import type { SchemaRow } from './schema-row.types'

const validRow = (): SchemaRow => ({
  id: 'f2b1643e-9f6e-564f-a492-a647575a7617',
  titre: 'Diagnostic énergie PME',
  description: 'Un diagnostic financé.',
  eligibilite: '- Effectif éligible : Toutes tailles',
  types_aides: 'financement',
  porteurs: '[{"nom":"ADEME","roles":["instructeur"]}]',
  cibles: 'professionnels',
  eligibilite_geographique: 'PAYS-99100',
  date_mise_a_jour: '2026-06-15T10:00:00+02:00',
  ciblage_secteur_activite: "tous secteurs d'activité",
})

describe('EtalabSchemaValidator', () => {
  it('valide une ligne conforme', () => {
    expect(EtalabSchemaValidator.validate(validRow(), SCHEMA_ENTREPRISE)).toEqual([])
  })

  it('détecte un id non-UUID', () => {
    const errors = EtalabSchemaValidator.validate({ ...validRow(), id: 'not-a-uuid' }, SCHEMA_CORE)
    expect(errors.some((e) => e.startsWith('id'))).toBe(true)
  })

  it('détecte un code COG mal formé (motif eligibilite_geographique)', () => {
    const errors = EtalabSchemaValidator.validate({ ...validRow(), eligibilite_geographique: 'France' }, SCHEMA_CORE)
    expect(errors.some((e) => e.startsWith('eligibilite_geographique'))).toBe(true)
  })

  it('détecte une cible hors énumération', () => {
    const errors = EtalabSchemaValidator.validate({ ...validRow(), cibles: 'tout le monde' }, SCHEMA_CORE)
    expect(errors.some((e) => e.startsWith('cibles'))).toBe(true)
  })

  it('détecte une colonne requise vide', () => {
    const errors = EtalabSchemaValidator.validate({ ...validRow(), titre: '' }, SCHEMA_CORE)
    expect(errors).toContain('titre : requis mais vide')
  })
})
