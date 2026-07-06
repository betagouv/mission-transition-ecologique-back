import { SchemaFitChecker } from './SchemaFitChecker'
import { SCHEMA_CORE, SCHEMA_ENTREPRISE } from './schema-row.types'
import type { SchemaRow } from './schema-row.types'

const completeRow = (): SchemaRow => ({
  id: 'f2b1643e-9f6e-564f-a492-a647575a7617',
  titre: 'Diagnostic énergie PME',
  description: 'Un diagnostic financé.',
  eligibilite: '- Effectif éligible : Toutes tailles',
  types_aides: 'financement',
  porteurs: '[{"nom":"ADEME","roles":["instructeur","diffuseur"]}]',
  cibles: 'professionnels',
  eligibilite_geographique: 'PAYS-99100',
  date_mise_a_jour: '2026-06-15T10:00:00+02:00',
  ciblage_secteur_activite: "tous secteurs d'activité",
})

describe('SchemaFitChecker', () => {
  it('satisfait core ET entreprise quand toutes les colonnes requises sont remplies', () => {
    expect(SchemaFitChecker.fittedSchemas(completeRow())).toEqual([SCHEMA_CORE, SCHEMA_ENTREPRISE])
  })

  it('satisfait core seul si ciblage_secteur_activite manque (requis entreprise)', () => {
    const row = { ...completeRow(), ciblage_secteur_activite: undefined }
    expect(SchemaFitChecker.fittedSchemas(row)).toEqual([SCHEMA_CORE])
    expect(SchemaFitChecker.missingFields(row, SCHEMA_ENTREPRISE)).toEqual(['ciblage_secteur_activite'])
  })

  it('ne satisfait aucun schéma si une colonne core requise manque', () => {
    const row = { ...completeRow(), eligibilite_geographique: '   ' }
    expect(SchemaFitChecker.fittedSchemas(row)).toEqual([])
    expect(SchemaFitChecker.missingFields(row, SCHEMA_CORE)).toContain('eligibilite_geographique')
  })
})
