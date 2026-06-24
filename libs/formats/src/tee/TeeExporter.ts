import type {
  CanonicalProgram,
  CanonicalProgramData,
  ContactQuestion,
  Eligibilite,
  EtapeActivation,
  Lien,
  Variante,
} from '@tee-backoffice/canonical'
import { ExportPolicy } from '../shared/ExportPolicy'
import { NafSectionResolver } from '../shared/NafSectionResolver'
import { RegionNameResolver } from '../shared/RegionNameResolver'
import { ThemeMapper } from '../shared/ThemeMapper'
import { TypeAideMapper } from '../shared/TypeAideMapper'
import type {
  TeeChampConditionnel,
  TeeConditionsEligibilite,
  TeeEligibilityData,
  TeeLien,
  TeeObjectif,
  TeeProgram,
} from './tee-program.types'

/**
 * Projette un programme du pivot vers la forme **iso `programs.json`** (sans
 * `publicodes`, sans `activable en autonomie`). Transformation pure : aucune
 * lecture externe. `montant`/`duree` retombent sur leur clé historique via le
 * libellé auto-décrit (`montant.type` / `duree.type`).
 */
export class TeeExporter {
  /** Programmes publiés uniquement (`statut_edition === 'pret_prod'`). */
  exportMany(programs: readonly CanonicalProgram[]): TeeProgram[] {
    return programs.filter((program) => ExportPolicy.isPublished(program)).map((program) => this.export(program))
  }

  export(program: CanonicalProgram): TeeProgram {
    const d = program.data

    const out: TeeProgram = {
      id: d.slug,
      type: 'tee',
      titre: d.titre,
      description: d.description,
      'opérateur de contact': d.operateurs.contact.nom,
      "nature de l'aide": TypeAideMapper.toNatureAideLabel(d.types_aides),
    }

    if (d.promesse !== undefined) out.promesse = d.promesse
    if (d.description_longue !== undefined) out['description longue'] = d.description_longue
    if (d.meta) {
      out.metaTitre = d.meta.titre
      out.metaDescription = d.meta.description
    }
    if (d.illustration) out.illustration = d.illustration.url
    if (d.operateurs.autres?.length) out['autres opérateurs'] = d.operateurs.autres.map((o) => o.nom)

    const contact = this.contactQuestion(d.contact_question)
    if (contact !== undefined) out['contact question'] = contact
    if (d.url_source !== undefined) out.url = d.url_source

    const debut = this.frenchDate(d.date_ouverture)
    if (debut) out['début de validité'] = debut
    const fin = this.frenchDate(d.date_cloture)
    if (fin) out['fin de validité'] = fin
    if (d.statut_dispositif === 'temporairement_indisponible') {
      out['aide temporairement indisponible'] = 'oui'
    }

    // Montant / durée : la clé EST le libellé auto-décrit porté par le pivot.
    if (d.montant) out[d.montant.type] = d.montant.valeur
    if (d.duree) out[d.duree.type] = d.duree.valeur

    const objectifs = this.objectifs(d.etapes_activation)
    if (objectifs) out.objectifs = objectifs

    const conditions = this.conditions(d.eligibilite)
    if (conditions) out["conditions d'éligibilité"] = conditions

    const eligibilityData = this.eligibilityData(d)
    if (eligibilityData) out.eligibilityData = eligibilityData

    const champs = this.champsConditionnels(d.variantes)
    if (champs) out['champs conditionnels'] = champs

    return out
  }

  /** `email` → `mailto:…` · `url` → URL brute · `ADEME`/`conseiller_entreprise` → `formulaire`. */
  private contactQuestion(cq: ContactQuestion | undefined): string | undefined {
    if (!cq) return undefined
    switch (cq.type) {
      case 'email':
        return `mailto:${cq.valeur}`
      case 'url':
        return cq.valeur
      case 'ADEME':
      case 'conseiller_entreprise':
        return 'formulaire'
    }
  }

  private objectifs(etapes: EtapeActivation[] | undefined): TeeObjectif[] | undefined {
    if (!etapes?.length) return undefined
    return etapes.map((etape) => {
      const objectif: TeeObjectif = { description: etape.description }
      if (etape.liens?.length) objectif.liens = etape.liens.map((lien) => this.lien(lien))
      return objectif
    })
  }

  private lien(lien: Lien): TeeLien {
    return 'conseiller_entreprise' in lien ? { formulaire: true } : { lien: lien.url, texte: lien.texte }
  }

  private conditions(elig: Eligibilite | undefined): TeeConditionsEligibilite | undefined {
    if (!elig) return undefined
    const conditions: TeeConditionsEligibilite = {}
    // « taille de l'entreprise » regroupe effectif + catégorie légale (ex. exclusion micro).
    const taille = [...(elig.effectif?.texte ?? []), ...(elig.categorie_legale?.texte ?? [])]
    if (taille.length) conditions["taille de l'entreprise"] = taille
    if (elig.secteur_geographique?.texte?.length) {
      conditions['secteur géographique'] = elig.secteur_geographique.texte
    }
    if (elig.secteur_activite?.texte?.length) conditions["secteur d'activité"] = elig.secteur_activite.texte
    if (elig.anciennete?.texte?.length) conditions["nombre d'années d'activité"] = elig.anciennete.texte
    if (elig.autres_criteres?.texte?.length) {
      conditions["autres critères d'éligibilité"] = elig.autres_criteres.texte
    }
    return Object.keys(conditions).length ? conditions : undefined
  }

  private eligibilityData(d: CanonicalProgramData): TeeEligibilityData | undefined {
    const elig = d.eligibilite
    const company: TeeEligibilityData['company'] = {}

    const naf = elig?.secteur_activite?.structure?.inclusions
    if (naf?.length) company.allowedNafSections = NafSectionResolver.sectionsOf(naf)
    const effectif = elig?.effectif?.structure
    if (effectif?.min !== undefined) company.minEmployees = String(effectif.min)
    if (effectif?.max !== undefined) company.maxEmployees = String(effectif.max)
    if (elig?.categorie_legale?.structure?.interdit?.includes('micro_entrepreneur')) {
      company.excludeMicroentrepreneur = true
    }
    const regions = elig?.secteur_geographique?.structure?.inclusions
    if (regions?.length) {
      const names = RegionNameResolver.namesOf(regions)
      if (names.length) company.allowedRegion = names
    }

    const validity: TeeEligibilityData['validity'] = {}
    const start = this.frenchDate(d.date_ouverture)
    if (start) validity.start = start
    const end = this.frenchDate(d.date_cloture)
    if (end) validity.end = end

    const priorityObjectives = d.themes ? ThemeMapper.toEnglishList(d.themes) : undefined

    if (!Object.keys(company).length && !Object.keys(validity).length && !priorityObjectives) {
      return undefined
    }
    // Omit `validity` when empty: programs.json drops it rather than emitting `{}`.
    const result: TeeEligibilityData = { company }
    if (Object.keys(validity).length) result.validity = validity
    if (priorityObjectives) result.priorityObjectives = priorityObjectives
    return result
  }

  /**
   * Reconstruit `champs conditionnels` depuis `variantes` — best-effort : les
   * conditions sont rendues en expressions simples (sans moteur publicodes).
   */
  private champsConditionnels(variantes: Variante[] | undefined): TeeChampConditionnel[] | undefined {
    if (!variantes?.length) return undefined
    return variantes.map((variante) => {
      const conditions: string[] = []
      const effectif = variante.conditions.effectif
      if (effectif?.min !== undefined) conditions.push(`effectif >= ${effectif.min}`)
      if (effectif?.max !== undefined) conditions.push(`effectif <= ${effectif.max}`)
      for (const region of variante.conditions.regions ?? []) conditions.push(`region = ${region}`)

      const champ: TeeChampConditionnel = { 'toutes ces conditions': conditions }
      const mods = variante.modifications
      if (mods.montant) champ['Montant du dispositif'] = mods.montant.valeur
      const tailleTexte = mods.eligibilite?.effectif?.texte
      if (tailleTexte?.length) champ['Eligibilité taille'] = tailleTexte.join(', ')
      const autres = mods.eligibilite?.autres_criteres?.texte
      if (autres?.length) champ["autres critères d'éligibilité"] = autres
      return champ
    })
  }

  /** ISO (`2026-01-01` ou date-heure) → `JJ/MM/AAAA`. */
  private frenchDate(iso: string | undefined): string | undefined {
    if (!iso) return undefined
    const [year, month, day] = iso.slice(0, 10).split('-')
    if (!year || !month || !day) return undefined
    return `${day}/${month}/${year}`
  }
}
