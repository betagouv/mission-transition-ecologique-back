import type {
  CanonicalProgram,
  CanonicalProgramData,
  Eligibilite,
  EtapeActivation,
  Illustration,
} from '@tee-backoffice/canonical'
import { AgirEtatMapper } from './AgirEtatMapper'
import { AgirSourceMapper } from './AgirSourceMapper'
import { AgirTypeDispositifMapper } from './AgirTypeDispositifMapper'
import { AgirVocabulary } from './AgirVocabulary'
import { agirDetailSchema } from './agir-detail.schema'
import type { DetailDispositif } from './agir-detail.types'

/**
 * Projects a canonical program to the AGIR detail view (proposition 1, R2DA).
 * Strategy: map what the canonical has, omit the rest (no `null`/`{}` parasites).
 * The output is re-parsed by `agirDetailSchema` (`.strict()`) as a guard. The
 * caller must have filtered exportable programs.
 */
export class AgirDetailExporter {
  export(program: CanonicalProgram): DetailDispositif {
    const d = program.data

    const out: DetailDispositif = {
      idDispositif: d.slug,
      idFonctionnel: d.slug,
      titre: d.titre,
      source: AgirSourceMapper.toAgir(d.source),
      dateDispositif: this.dateDispositif(d),
      etatDispositif: AgirEtatMapper.toEtat(d.statut_dispositif),
      typeDispositif: AgirTypeDispositifMapper.fromTypes(d.types_aides),
    }
    if (d.date_mise_a_jour) out.dateDerniereModification = d.date_mise_a_jour

    const elligibilite = this.elligibilite(d.eligibilite)
    if (elligibilite) out.elligibilite = elligibilite
    const documentation = this.documentation(d.illustration)
    if (documentation) out.documentation = documentation
    const description = this.description(d)
    if (description) out.description = description
    const etapeDepot = this.etapeDepot(d.etapes_activation)
    if (etapeDepot) out.etapeDepot = etapeDepot

    return agirDetailSchema.parse(out)
  }

  private dateDispositif(d: CanonicalProgramData): DetailDispositif['dateDispositif'] {
    const date: DetailDispositif['dateDispositif'] = {}
    if (d.date_ouverture) date.dateDebut = d.date_ouverture
    if (d.date_cloture) date.dateFin = d.date_cloture
    return date
  }

  private elligibilite(elig: Eligibilite | undefined): DetailDispositif['elligibilite'] {
    if (!elig) return undefined
    const out: NonNullable<DetailDispositif['elligibilite']> = {}

    const texte = this.texteElligibilite(elig)
    if (texte) out.texteElligibilite = texte

    const naf = elig.secteur_activite?.structure?.inclusions
    if (naf?.length) out.secteurActivite = { listeSecteurActivite: naf.map(String) }

    const cog = elig.secteur_geographique?.structure?.inclusions
    if (cog?.length) {
      out.secteurGeographique = {
        typeSecteur: this.typeSecteur(cog.map(String)),
        listeRegion: cog.map(String),
      }
    }

    return Object.keys(out).length ? out : undefined
  }

  /** All criterion `texte` bullets, concatenated into a single bulleted string. */
  private texteElligibilite(elig: Eligibilite): string | undefined {
    const bullets = [
      ...(elig.effectif?.texte ?? []),
      ...(elig.categorie_legale?.texte ?? []),
      ...(elig.secteur_activite?.texte ?? []),
      ...(elig.secteur_geographique?.texte ?? []),
      ...(elig.anciennete?.texte ?? []),
      ...(elig.autres_criteres?.texte ?? []),
    ]
    if (!bullets.length) return undefined
    return bullets.map((bullet) => `- ${bullet}`).join('\n')
  }

  /** `typeSecteur` deduced from the COG level prefix; placeholder if mixed/unknown. */
  private typeSecteur(codes: readonly string[]): string {
    const levels = new Set(codes.map((code) => code.split('-')[0]))
    if (levels.size !== 1) return AgirVocabulary.TYPE_SECTEUR_INCONNU
    const [level] = [...levels]
    return AgirVocabulary.TYPE_SECTEUR[level] ?? AgirVocabulary.TYPE_SECTEUR_INCONNU
  }

  private documentation(illustration: Illustration | undefined): DetailDispositif['documentation'] {
    if (!illustration) return undefined
    const vignette: NonNullable<NonNullable<DetailDispositif['documentation']>['vignette']> = {
      urlImage: illustration.url,
    }
    if (illustration.alt) vignette.alt = illustration.alt
    return { vignette }
  }

  private description(d: CanonicalProgramData): DetailDispositif['description'] {
    const out: NonNullable<DetailDispositif['description']> = {
      organisme: d.operateurs.contact.nom,
      descriptionCourte: d.description,
    }
    if (d.description_longue !== undefined) out.descriptionLongue = d.description_longue
    if (d.operateurs.autres?.length) out.partenaires = d.operateurs.autres.map((o) => o.nom)
    if (d.montant) out.montantAide = d.montant.valeur
    if (d.themes?.length) out.thematique = [...d.themes]
    // GAP: R2DA only has mailContact, so only the email channel survives. The url /
    // ADEME / conseiller_entreprise channels are dropped — propose a contact field
    // to AGIR (see docs/context/agir-export-format.md §Lacunes).
    if (d.contact_question?.type === 'email') out.mailContact = d.contact_question.valeur
    return out
  }

  private etapeDepot(etapes: EtapeActivation[] | undefined): DetailDispositif['etapeDepot'] {
    if (!etapes?.length) return undefined
    return etapes.map((etape, index) => {
      const out: NonNullable<DetailDispositif['etapeDepot']>[number] = {
        ordreEtape: index + 1,
        libelleEtape: etape.description,
      }
      const lien = etape.liens?.find((l) => 'url' in l)
      if (lien && 'url' in lien) out.lienEtape = lien.url
      return out
    })
  }
}
