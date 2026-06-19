import { z } from 'zod'
import {
  cuid2Schema,
  isoDateOrDateTimeSchema,
  isoDateSchema,
  nonEmptyStringSchema,
  urlSchema,
} from '../../shared/primitives'
import { operateursSchema } from '../../shared/operateur.schema'
import {
  statutDispositifSchema,
  statutEditionSchema,
  typeAideSchema,
  type StatutDispositif,
  type TypeAide,
} from '../enums'

/**
 * Section 3 — Faits structurés sur l'aide (cycle de vie, nature, acteurs).
 *
 * Les règles inter-champs vraiment locales (qui ne voient que des sous-clés du
 * même objet) sont exprimées ici même : `contact_question` est une union
 * discriminée. Les deux règles qui touchent des champs frères de premier niveau
 * (`duree`/`types_aides`, `remplace_par`/`statut_dispositif`) sont exportées comme refines
 * et appliquées par le schéma racine — la logique reste dans ce module.
 */

/**
 * Question de contact : la valeur dépend du type.
 * `email`/`url` → valeur requise et validée ; `ADEME`/`conseiller_entreprise` → pas de valeur.
 */
export const contactQuestionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ADEME') }).strict(),
  z.object({ type: z.literal('conseiller_entreprise') }).strict(),
  z.object({ type: z.literal('email'), valeur: z.string().email() }).strict(),
  z.object({ type: z.literal('url'), valeur: urlSchema }).strict(),
])
export type ContactQuestion = z.infer<typeof contactQuestionSchema>

/** Lien d'une étape : lien externe `{ texte, url }` ou renvoi vers Conseiller-Entreprise. */
export const lienSchema = z.union([
  z.object({ texte: nonEmptyStringSchema, url: urlSchema }),
  z.object({ conseiller_entreprise: z.literal(true) }),
])
export type Lien = z.infer<typeof lienSchema>

/**
 * Montant auto-décrit : `type` porte le libellé d'affichage qui dépend de la
 * nature de l'aide (« montant du financement », « coût de l'accompagnement »,
 * « montant du prêt », « montant de l'avantage fiscal »…) et `valeur` la chaîne
 * affichée. Le libellé voyage avec la donnée : pas de mapping type d'aide →
 * libellé à reconstruire côté front.
 */
export const montantSchema = z.object({
  type: nonEmptyStringSchema,
  valeur: nonEmptyStringSchema,
})
export type Montant = z.infer<typeof montantSchema>

/**
 * Durée auto-décrite : même principe que `montant`. `type` = libellé
 * (« durée de l'accompagnement », « durée du prêt »…), `valeur` = affichage.
 */
export const dureeSchema = z.object({
  type: nonEmptyStringSchema,
  valeur: nonEmptyStringSchema,
})
export type Duree = z.infer<typeof dureeSchema>

/** Étape d'activation (ancien `objectifs` / `étape1…6` Baserow). */
export const etapeActivationSchema = z.object({
  description: z.string().min(1),
  liens: z.array(lienSchema).optional(),
})
export type EtapeActivation = z.infer<typeof etapeActivationSchema>

export const aideSchema = z.object({
  // Cycle de vie
  /** Où en est la rédaction du contenu. */
  statut_edition: statutEditionSchema,
  /** Validité réelle du dispositif. */
  statut_dispositif: statutDispositifSchema,
  date_ouverture: isoDateSchema.optional(),
  date_cloture: isoDateOrDateTimeSchema.optional(),
  /** CUID du dispositif remplaçant — requis si `statut_dispositif === 'remplace'`. */
  remplace_par: cuid2Schema.optional(),

  // Nature de l'aide
  types_aides: z.array(typeAideSchema).min(1),
  /** Montant auto-décrit (`{ type, valeur }`), champ d'affichage. */
  montant: montantSchema.optional(),
  /** Durée auto-décrite (`{ type, valeur }`) — requise si `types_aides` contient `etude`/`formation`. */
  duree: dureeSchema.optional(),

  // Acteurs et contact
  operateurs: operateursSchema,
  contact_question: contactQuestionSchema.optional(),
  url_source: urlSchema.optional(),
  etapes_activation: z.array(etapeActivationSchema).min(1).max(6).optional(),
})

// --- Règles inter-champs de la section (appliquées par le schéma racine) ---

type NatureAideCrossFields = { types_aides?: TypeAide[]; duree?: Duree }
type CycleVieCrossFields = { statut_dispositif?: StatutDispositif; remplace_par?: string }

/**
 * `duree` est requise dès que l'aide est une étude ou une formation.
 *
 * Garde défensive sur `types_aides` : ce refine s'exécute au niveau racine, on
 * ne s'appuie donc pas sur la sémantique abort/dirty de zod pour garantir que
 * le champ est déjà un tableau valide.
 */
export const refineDuree = (data: NatureAideCrossFields, ctx: z.RefinementCtx): void => {
  const types = data.types_aides
  const needsDuree = Array.isArray(types) && types.some((t) => t === 'etude' || t === 'formation')
  if (needsDuree && !data.duree) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['duree'],
      message: 'duree requise si types_aides contient etude ou formation',
    })
  }
}

/** `remplace_par` est obligatoire quand le dispositif est remplacé. */
export const refineRemplacePar = (data: CycleVieCrossFields, ctx: z.RefinementCtx): void => {
  if (data.statut_dispositif === 'remplace' && !data.remplace_par) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['remplace_par'],
      message: 'remplace_par obligatoire si statut_dispositif = remplace',
    })
  }
}
