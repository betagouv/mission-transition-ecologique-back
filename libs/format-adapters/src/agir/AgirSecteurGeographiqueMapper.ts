import { COG_FRANCE, type Eligibilite } from '@tee-backoffice/canonical'

/**
 * Translates the canonical geographic area to the AGIR wire. AGIR reads an empty
 * `inclusions` list as "France entière", so a national program (canonical
 * `inclusions: ['PAYS-99100']`) ships `inclusions: []`. Only that exact list is
 * emptied: regional, departmental or mixed lists, `exclusions` and `texte` are
 * kept as is. `structure` always keeps the `{ inclusions }` object shape. The
 * R2DA detail applies the same rule to `listeRegion` through {@link toAgirInclusions}.
 */
export class AgirSecteurGeographiqueMapper {
  static toAgir(eligibilite: Eligibilite): Eligibilite {
    const secteur = eligibilite.secteur_geographique
    const structure = secteur?.structure
    if (!secteur || !structure || !AgirSecteurGeographiqueMapper.isNational(structure.inclusions)) return eligibilite

    return { ...eligibilite, secteur_geographique: { ...secteur, structure: { ...structure, inclusions: [] } } }
  }

  /** COG inclusions as AGIR reads them: empty for the national list, unchanged otherwise. */
  static toAgirInclusions(inclusions: readonly string[]): string[] {
    return AgirSecteurGeographiqueMapper.isNational(inclusions) ? [] : [...inclusions]
  }

  private static isNational(inclusions: readonly string[]): boolean {
    return inclusions.length === 1 && inclusions[0] === COG_FRANCE
  }
}
