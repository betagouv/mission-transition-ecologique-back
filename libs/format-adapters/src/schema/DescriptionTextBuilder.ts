import type { CanonicalProgramData } from '@tee-backoffice/canonical'
import { SchemaVocabulary } from './SchemaVocabulary'

type Lien = NonNullable<NonNullable<CanonicalProgramData['etapes_activation']>[number]['liens']>[number]

/**
 * Builds the Etalab `description` column. The core schema has no structured
 * montant/durée/étapes fields, so those are folded into the prose (as the legacy
 * exporter did). `description_longue` stays out on purpose (it blows past the
 * 5000-char limit). Sections are separated by blank lines.
 */
export class DescriptionTextBuilder {
  static build(d: CanonicalProgramData): string {
    const sections: string[] = [d.description]

    if (d.montant) sections.push(`${d.montant.type} : ${d.montant.valeur}`)
    if (d.duree) sections.push(`${d.duree.type} : ${d.duree.valeur}`)

    const variation = DescriptionTextBuilder.variationText(d)
    if (variation) sections.push(variation)

    const contact = DescriptionTextBuilder.contactText(d)
    if (contact) sections.push(contact)

    const steps = DescriptionTextBuilder.stepsText(d)
    if (steps) sections.push(steps)

    if (d.url_source) sections.push(`Lien externe de présentation de l'aide : ${d.url_source}`)

    return sections.join('\n\n')
  }

  /** Mirrors the legacy "le montant peut varier en fonction de…" sentence. */
  private static variationText(d: CanonicalProgramData): string | undefined {
    const conditions = (d.variantes ?? []).map((v) => v.conditions)
    const hasRegion = conditions.some((c) => (c.regions?.length ?? 0) > 0)
    const hasSize = conditions.some((c) => c.effectif !== undefined)

    if (hasRegion && hasSize) {
      return "Le montant, le coût ou la durée de l'aide peuvent varier en fonction de la région et de la taille de l'entreprise"
    }
    if (hasRegion) {
      return "Le montant, le coût ou la durée de l'aide peuvent varier en fonction de la région de l'entreprise"
    }
    if (hasSize) {
      return "Le montant, le coût ou la durée de l'aide peuvent varier en fonction de la taille de l'entreprise"
    }
    return undefined
  }

  private static contactText(d: CanonicalProgramData): string | undefined {
    const contact = d.contact_question
    if (!contact) return undefined
    const prefix = 'Contact public pour les questions sur le dispositif :'
    switch (contact.type) {
      case 'email':
      case 'url':
        return `${prefix} ${contact.valeur}`
      case 'conseiller_entreprise':
        return `${prefix} ${DescriptionTextBuilder.teeFiche(d.slug)}`
    }
  }

  private static stepsText(d: CanonicalProgramData): string | undefined {
    const etapes = d.etapes_activation ?? []
    if (etapes.length === 0) return undefined

    const lines = ['Étapes pour activer le dispositif :']
    for (const etape of etapes) {
      lines.push(etape.description)
      const links = (etape.liens ?? []).map((lien) => DescriptionTextBuilder.linkText(lien, d.slug))
      if (links.length > 0) lines.push(`Liens liés à l'étape : ${links.join(' | ')}`)
    }
    return lines.join('\n')
  }

  private static linkText(lien: Lien, slug: string): string {
    if ('conseiller_entreprise' in lien) {
      return `[mission transition écologique](${DescriptionTextBuilder.teeFiche(slug)})`
    }
    return `[${lien.texte}](${lien.url})`
  }

  private static teeFiche(slug: string): string {
    return `${SchemaVocabulary.TEE_BASE_URL}/aides-entreprise/${slug}${SchemaVocabulary.DATAGOUV_UTM}`
  }
}
