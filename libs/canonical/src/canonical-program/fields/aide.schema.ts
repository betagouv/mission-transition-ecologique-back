import { z } from 'zod'
import {
  cuid2Schema,
  isoDateOrDateTimeSchema,
  isoDateSchema,
  nonEmptyStringSchema,
  urlSchema,
} from '../../shared/primitives'
import { operateursSchema } from '../../shared/operateur.schema'
import { statutSchema, typeAideSchema, type Statut, type TypeAide } from '../enums'

/**
 * Section 3 — Faits structurés sur l'aide (cycle de vie, nature, acteurs).
 *
 * Les règles inter-champs vraiment locales (qui ne voient que des sous-clés du
 * même objet) sont exprimées ici même : `contact_question` est une union
 * discriminée. Les deux règles qui touchent des champs frères de premier niveau
 * (`duree`/`types_aides`, `remplace_par`/`statut`) sont exportées comme refines
 * et appliquées par le schéma racine — la logique reste dans ce module.
 */

/**
 * Question de contact : la valeur dépend du type.
 * `email`/`url` → valeur requise et validée ; `ADEME`/`CE` → pas de valeur.
 */
export const contactQuestionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ADEME') }).strict(),
  z.object({ type: z.literal('CE') }).strict(),
  z.object({ type: z.literal('email'), valeur: z.string().email() }).strict(),
  z.object({ type: z.literal('url'), valeur: urlSchema }).strict(),
])
export type ContactQuestion = z.infer<typeof contactQuestionSchema>

/** Lien d'une étape : lien externe `{ texte, url }` ou renvoi vers le formulaire. */
export const lienSchema = z.union([
  z.object({ texte: nonEmptyStringSchema, url: urlSchema }),
  z.object({ formulaire: z.literal(true) }),
])
export type Lien = z.infer<typeof lienSchema>

/** Étape d'activation (ancien `objectifs` / `étape1…6` Baserow). */
export const etapeActivationSchema = z.object({
  description: z.string().min(1),
  liens: z.array(lienSchema).optional(),
})
export type EtapeActivation = z.infer<typeof etapeActivationSchema>

export const aideSchema = z.object({
  // Cycle de vie
  statut: statutSchema,
  date_ouverture: isoDateSchema.optional(),
  date_cloture: isoDateOrDateTimeSchema.optional(),
  /** CUID du dispositif remplaçant — requis si `statut === 'remplace'`. */
  remplace_par: cuid2Schema.optional(),

  // Nature de l'aide
  types_aides: z.array(typeAideSchema).min(1),
  /** Montant ou coût restant à charge, champ d'affichage. */
  montant: nonEmptyStringSchema.optional(),
  /** Durée d'affichage — requise si `types_aides` contient `etude`/`formation`. */
  duree: nonEmptyStringSchema.optional(),
  activable_en_autonomie: z.boolean().default(false),

  // Acteurs et contact
  operateurs: operateursSchema,
  contact_question: contactQuestionSchema.optional(),
  url_source: urlSchema.optional(),
  etapes_activation: z.array(etapeActivationSchema).min(1).max(6).optional(),
})

// --- Règles inter-champs de la section (appliquées par le schéma racine) ---

type NatureAideCrossFields = { types_aides?: TypeAide[]; duree?: string }
type CycleVieCrossFields = { statut?: Statut; remplace_par?: string }

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
  if (data.statut === 'remplace' && !data.remplace_par) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['remplace_par'],
      message: 'remplace_par obligatoire si statut = remplace',
    })
  }
}
