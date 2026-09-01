import { z } from 'zod'
import {
  cuid2Schema,
  isoDateOrDateTimeSchema,
  isoDateSchema,
  nonEmptyStringSchema,
  urlSchema,
} from '../../shared/primitives'
import { operateursSchema } from '../../shared/schema/operator'
import {
  statutDispositifSchema,
  statutEditionSchema,
  typeAideSchema,
  type StatutDispositif,
  type TypeAide,
} from '../enums'

/**
 * Section 3 — Structured facts about the aid (lifecycle, nature, actors).
 *
 * Cross-field rules local to this object live here (`contact_question` is a
 * discriminated union). The two rules spanning sibling top-level fields
 * (`duree`/`types_aides`, `remplace_par`/`statut_dispositif`) are exported as
 * refines and applied by the root schema — the logic stays in this module.
 */

/** Contact question: value depends on type. `email`/`url` require a value; `conseiller_entreprise` carries none. */
export const contactQuestionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('conseiller_entreprise') }).strict(),
  z.object({ type: z.literal('email'), valeur: z.string().email() }).strict(),
  z.object({ type: z.literal('url'), valeur: urlSchema }).strict(),
])
export type ContactQuestion = z.infer<typeof contactQuestionSchema>

/** Step link: external `{ texte, url }` or a Conseiller-Entreprise redirect. */
export const lienSchema = z.union([
  z.object({ texte: nonEmptyStringSchema, url: urlSchema }),
  z.object({ conseiller_entreprise: z.literal(true) }),
])
export type Lien = z.infer<typeof lienSchema>

/**
 * Self-described amount: `type` carries the display label (depends on the aid
 * nature), `valeur` the displayed string. The label travels with the data — no
 * aid-type → label mapping to rebuild on the front.
 */
export const montantSchema = z.object({
  type: nonEmptyStringSchema,
  valeur: nonEmptyStringSchema,
})
export type Montant = z.infer<typeof montantSchema>

/** Self-described duration: same principle as `montant`. */
export const dureeSchema = z.object({
  type: nonEmptyStringSchema,
  valeur: nonEmptyStringSchema,
})
export type Duree = z.infer<typeof dureeSchema>

/** Activation step (former `objectifs` / `étape1…6` in Baserow). */
export const etapeActivationSchema = z.object({
  description: z.string().min(1),
  liens: z.array(lienSchema).optional(),
})
export type EtapeActivation = z.infer<typeof etapeActivationSchema>

export const aideSchema = z.object({
  // Lifecycle
  /** Content authoring progress. */
  statut_edition: statutEditionSchema,
  /** Real validity of the program. */
  statut_dispositif: statutDispositifSchema,
  date_ouverture: isoDateSchema.optional(),
  date_cloture: isoDateOrDateTimeSchema.optional(),
  /** CUID of the replacing program — required when `statut_dispositif === 'remplace'`. */
  remplace_par: cuid2Schema.optional(),

  // Aid nature
  types_aides: z.array(typeAideSchema).min(1),
  /** Self-described amount (`{ type, valeur }`), display field. */
  montant: montantSchema.optional(),
  /** Self-described duration — required when `types_aides` contains `etude`/`formation`. */
  duree: dureeSchema.optional(),

  // Actors and contact
  operateurs: operateursSchema,
  contact_question: contactQuestionSchema.optional(),
  url_source: urlSchema.optional(),
  etapes_activation: z.array(etapeActivationSchema).min(1).max(6).optional(),
})

// --- Cross-field rules (applied by the root schema) ---

type NatureAideCrossFields = { types_aides?: TypeAide[]; duree?: Duree }
type CycleVieCrossFields = { statut_dispositif?: StatutDispositif; remplace_par?: string }

/**
 * `duree` is required for a `formation` (a training has a duration). `etude` is
 * intentionally exempt: many real aids are financed studies (`étude` + a funding
 * amount) carrying no duration. Defensive check on `types_aides` since this
 * refine runs at the root level.
 */
export const refineDuree = (data: NatureAideCrossFields, ctx: z.RefinementCtx): void => {
  const types = data.types_aides
  const needsDuree = Array.isArray(types) && types.some((t) => t === 'formation')
  if (needsDuree && !data.duree) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['duree'],
      message: 'duree requise si types_aides contient formation',
    })
  }
}

/** `remplace_par` is required when the program is replaced. */
export const refineRemplacePar = (data: CycleVieCrossFields, ctx: z.RefinementCtx): void => {
  if (data.statut_dispositif === 'remplace' && !data.remplace_par) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['remplace_par'],
      message: 'remplace_par obligatoire si statut_dispositif = remplace',
    })
  }
}
