import type { CanonicalProgram } from '@tee-backoffice/canonical'
import { AgirSourceMapper } from './AgirSourceMapper'
import { AgirStatutMapper } from './AgirStatutMapper'
import { ademePivotSchema } from './ademe-pivot.schema'
import type { AdemePivot } from './ademe-pivot.types'

/**
 * Projects a canonical program to the ADEME pivot (proposition 2): the canonical
 * wire with the ADEME deltas (id = slug, single `statut`, lowercased `source`,
 * `ademe_id_dsp` surfaced from `autres_donnees`). Built field by field as an
 * explicit whitelist, then re-parsed by `ademePivotSchema` (`.strict()`) so no
 * internal field can leak. The caller must have filtered exportable programs.
 */
export class AdemePivotExporter {
  export(program: CanonicalProgram): AdemePivot {
    const d = program.data

    const out: AdemePivot = {
      id: d.slug,
      source: AgirSourceMapper.toAgir(d.source),
      date_mise_a_jour: d.date_mise_a_jour,
      titre: d.titre,
      description: d.description,
      statut: AgirStatutMapper.toStatut(d.statut_dispositif),
      types_aides: d.types_aides,
      operateurs: d.operateurs,
    }

    if (d.autres_donnees?.ademe_id_dsp !== undefined) out.ademe_id_dsp = d.autres_donnees.ademe_id_dsp
    if (d.promesse !== undefined) out.promesse = d.promesse
    if (d.description_longue !== undefined) out.description_longue = d.description_longue
    if (d.illustration !== undefined) out.illustration = d.illustration
    if (d.meta !== undefined) out.meta = d.meta
    if (d.date_ouverture !== undefined) out.date_ouverture = d.date_ouverture
    if (d.date_cloture !== undefined) out.date_cloture = d.date_cloture
    if (d.montant !== undefined) out.montant = d.montant
    if (d.duree !== undefined) out.duree = d.duree
    if (d.contact_question !== undefined) out.contact_question = d.contact_question
    if (d.url_source !== undefined) out.url_source = d.url_source
    if (d.etapes_activation !== undefined) out.etapes_activation = d.etapes_activation
    if (d.eligibilite !== undefined) out.eligibilite = d.eligibilite
    if (d.themes !== undefined) out.themes = d.themes
    if (d.variantes !== undefined) out.variantes = d.variantes

    return ademePivotSchema.parse(out)
  }
}
