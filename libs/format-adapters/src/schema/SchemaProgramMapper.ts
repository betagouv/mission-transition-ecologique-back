import type { CanonicalProgram, CanonicalProgramData } from '@tee-backoffice/canonical'
import type { ExportLogger } from '../shared/ExportLogger'
import { ConsoleExportLogger } from '../shared/ConsoleExportLogger'
import { DescriptionTextBuilder } from './DescriptionTextBuilder'
import { EligibiliteTextBuilder } from './EligibiliteTextBuilder'
import { GeoCoverageMapper } from './GeoCoverageMapper'
import { PorteursMapper } from './PorteursMapper'
import { SchemaIdResolver } from './SchemaIdResolver'
import { SchemaVocabulary } from './SchemaVocabulary'
import { SecteurActiviteMapper } from './SecteurActiviteMapper'
import { TypesAidesSchemaMapper } from './TypesAidesSchemaMapper'
import type { SchemaRow } from './schema-row.types'

/**
 * Projects a canonical program to the Etalab `SchemaRow` (entreprise superset).
 * Every column is produced here; `SchemaFitChecker` decides afterwards which
 * schemas the row satisfies. Values are CSV-ready strings (arrays pipe-joined,
 * objects JSON-stringified); absent optional columns stay `undefined`.
 */
export class SchemaProgramMapper {
  private readonly porteursMapper: PorteursMapper

  constructor(logger: ExportLogger = new ConsoleExportLogger()) {
    this.porteursMapper = new PorteursMapper(logger)
  }

  toRow(program: CanonicalProgram): SchemaRow {
    const d = program.data

    const row: SchemaRow = {
      id: SchemaIdResolver.toUuid(d.slug),
      titre: d.titre,
      description: DescriptionTextBuilder.build(d),
      eligibilite: EligibiliteTextBuilder.build(d.eligibilite),
      types_aides: TypesAidesSchemaMapper.toColumn(d.types_aides),
      porteurs: JSON.stringify(this.porteursMapper.toPorteurs(d.operateurs)),
      cibles: SchemaVocabulary.CIBLE,
      eligibilite_geographique: GeoCoverageMapper.toCoverage(d.eligibilite),
      date_mise_a_jour: d.date_mise_a_jour,
      url_source: d.url_source ?? this.defaultUrlSource(d.slug),
      ciblage_secteur_activite: SecteurActiviteMapper.toCiblageSecteur(d.eligibilite),
    }

    this.assign(row, 'promesse', d.promesse)
    this.assign(row, 'date_ouverture', d.date_ouverture)
    this.assign(row, 'date_cloture', d.date_cloture)
    this.assign(row, 'eligibilite_geographique_exclusions', GeoCoverageMapper.toExclusions(d.eligibilite))
    this.assign(row, 'ciblage_naf', SecteurActiviteMapper.toCiblageNaf(d.eligibilite))
    this.assign(row, 'ciblage_naf_exclusions', SecteurActiviteMapper.toCiblageNafExclusions(d.eligibilite))
    this.assign(row, 'eligibilite_effectif_minimal', this.effectifBound(d, 'min'))
    this.assign(row, 'eligibilite_effectif_maximal', this.effectifBound(d, 'max'))
    this.assign(row, 'eligibilite_forme_juridique_exclusions', this.formeJuridiqueExclusions(d))

    return row
  }

  private assign<K extends keyof SchemaRow>(row: SchemaRow, key: K, value: SchemaRow[K] | undefined): void {
    if (value !== undefined) row[key] = value
  }

  private defaultUrlSource(slug: string): string {
    return `${SchemaVocabulary.TEE_BASE_URL}/aides-entreprise/${slug}${SchemaVocabulary.DATAGOUV_UTM}`
  }

  private effectifBound(d: CanonicalProgramData, bound: 'min' | 'max'): string | undefined {
    const value = d.eligibilite?.effectif?.structure?.[bound]
    return value === undefined ? undefined : String(value)
  }

  private formeJuridiqueExclusions(d: CanonicalProgramData): string | undefined {
    const interdit = d.eligibilite?.categorie_legale?.structure?.interdit ?? []
    if (interdit.length === 0) return undefined
    const labels = interdit.map((item) =>
      item === 'micro_entrepreneur' ? SchemaVocabulary.FORME_MICRO_ENTREPRENEUR : item,
    )
    return labels.join(SchemaVocabulary.PIPE)
  }
}
