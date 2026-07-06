import type { CanonicalProgramData } from '@tee-backoffice/canonical'
import type { ExportLogger } from '../shared/ExportLogger'
import { ConsoleExportLogger } from '../shared/ConsoleExportLogger'
import { SchemaVocabulary } from './SchemaVocabulary'
import type { Porteur } from './schema-row.types'

type Operateurs = CanonicalProgramData['operateurs']
type Operateur = Operateurs['contact']

/**
 * Builds the Etalab `porteurs` list from the canonical operators. Roles are
 * assigned by position (the canonical carries none): the contact instructs and
 * diffuses, the others only diffuse. The legacy "CCI ou CMA" operator is split
 * into the two national heads. Missing SIREN / normalized name are warned (they
 * surface in the Phase 0 audit) but never block the export.
 */
export class PorteursMapper {
  constructor(private readonly logger: ExportLogger = new ConsoleExportLogger()) {}

  toPorteurs(operateurs: Operateurs): Porteur[] {
    const porteurs = new Map<string, Porteur>()

    this.add(porteurs, operateurs.contact, [...SchemaVocabulary.ROLE_CONTACT])
    for (const autre of operateurs.autres ?? []) {
      this.add(porteurs, autre, [...SchemaVocabulary.ROLE_AUTRE])
    }

    return [...porteurs.values()]
  }

  private add(porteurs: Map<string, Porteur>, operateur: Operateur, roles: Porteur['roles']): void {
    if (this.isCciCma(operateur)) {
      this.put(porteurs, { ...SchemaVocabulary.CCI_FRANCE, roles })
      this.put(porteurs, { ...SchemaVocabulary.CMA_FRANCE, roles })
      return
    }
    this.warnOnMissing(operateur)
    this.put(porteurs, { nom: operateur.nom_normalise ?? operateur.nom, siren: operateur.siren, roles })
  }

  /** Dedupe on SIREN when known, else on the name; first occurrence wins. */
  private put(porteurs: Map<string, Porteur>, porteur: Porteur): void {
    const key = porteur.siren ?? porteur.nom
    if (!porteurs.has(key)) porteurs.set(key, porteur)
  }

  private isCciCma(operateur: Operateur): boolean {
    const marker = SchemaVocabulary.CCI_CMA_MARKER
    return [operateur.nom, operateur.nom_normalise].some((name) => name?.toLowerCase().includes(marker))
  }

  private warnOnMissing(operateur: Operateur): void {
    if (!operateur.siren) this.logger.warn(`Porteur sans SIREN : ${operateur.nom}`)
    if (!operateur.nom_normalise) this.logger.warn(`Porteur sans nom normalisé : ${operateur.nom}`)
  }
}
