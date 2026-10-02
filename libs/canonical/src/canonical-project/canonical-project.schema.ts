import { z } from 'zod'
import {
  cuid2Schema,
  isoDateTimeSchema,
  legacySlugSchema,
  markdownSchema,
  nafCodeSchema,
  nonEmptyStringSchema,
  refineKebabCaseSlug,
  urlSchema,
} from '../shared/primitives'
import { themeSchema } from '../shared/schema/theme'
import { sourceSchema } from '../canonical-program/enums'

/** Project status. `remplace` marks a redirect tombstone and requires `remplace_par`. */
export const statutProjetSchema = z.enum(['valide', 'remplace'])
export type StatutProjet = z.infer<typeof statutProjetSchema>

/**
 * Absolute with object storage, rooted (`/api/media/file/...`) on a local disk:
 * the exports turn a rooted path into an absolute URL.
 */
const imageUrlSchema = z.union([
  urlSchema,
  z.string().regex(/^\/\S*$/, 'chemin invalide (chemin enraciné sans espace attendu)'),
])

export const projetImageSchema = z.object({
  url: imageUrlSchema,
  /** Upstream path of an imported image, absent for a manual upload. */
  chemin_source: nonEmptyStringSchema.optional(),
})
export type ProjetImage = z.infer<typeof projetImageSchema>

/** Titled Markdown block (long and complementary descriptions). */
export const projetDescriptionSchema = z.object({
  titre: nonEmptyStringSchema.optional(),
  contenu: markdownSchema.min(1),
})
export type ProjetDescription = z.infer<typeof projetDescriptionSchema>

const prioriteValueSchema = z.number().int().nonnegative()

export const projetPrioriteSchema = z.object({
  defaut: prioriteValueSchema.optional(),
  mise_en_avant: prioriteValueSchema.optional(),
  par_secteur: z.array(z.object({ code_naf: nafCodeSchema, priorite: prioriteValueSchema })).optional(),
})
export type ProjetPriorite = z.infer<typeof projetPrioriteSchema>

export const projetsLiesSchema = z.object({
  titre: nonEmptyStringSchema.optional(),
  description: nonEmptyStringSchema.optional(),
  /** Canonical ids of the linked projects. */
  projets: z.array(cuid2Schema),
})
export type ProjetsLies = z.infer<typeof projetsLiesSchema>

export const projetFaqSchema = z.object({
  titre: nonEmptyStringSchema.optional(),
  questions: z
    .array(z.object({ question: nonEmptyStringSchema, reponse: markdownSchema.min(1) }))
    .min(1, 'au moins une question est requise'),
})
export type ProjetFaq = z.infer<typeof projetFaqSchema>

export const projetSeoSchema = z.object({
  titre: nonEmptyStringSchema.optional(),
  description: nonEmptyStringSchema.optional(),
})
export type ProjetSeo = z.infer<typeof projetSeoSchema>

const baseCanonicalProjectSchema = z.object({
  id: cuid2Schema,
  /** Kebab-case, enforced at the root: a `remplace` tombstone keeps its former slug verbatim. */
  slug: legacySlugSchema,
  source: sourceSchema,
  date_mise_a_jour: isoDateTimeSchema,
  statut_projet: statutProjetSchema,
  /** Canonical id of the current project, only on a `remplace` tombstone. */
  remplace_par: cuid2Schema.optional(),

  titre: nonEmptyStringSchema,
  nom_court: nonEmptyStringSchema,
  description_courte: nonEmptyStringSchema,
  image: projetImageSchema.optional(),
  description_longue: projetDescriptionSchema,
  description_complementaire: projetDescriptionSchema.optional(),

  theme_principal: themeSchema,
  themes: z.array(themeSchema).optional(),
  secteurs: z.array(nafCodeSchema).optional(),
  priorite: projetPrioriteSchema.optional(),

  /** Canonical ids of the linked programs. */
  dispositifs: z.array(cuid2Schema).optional(),
  projets_lies: projetsLiesSchema.optional(),
  faq: projetFaqSchema.optional(),
  seo: projetSeoSchema.optional(),
})

type RemplaceCrossFields = { statut_projet?: StatutProjet; remplace_par?: string }

/** `remplace_par` goes with the `remplace` status: required with it, refused without. */
export const refineProjetRemplacePar = (data: RemplaceCrossFields, ctx: z.RefinementCtx): void => {
  const isReplaced = data.statut_projet === 'remplace'
  if (isReplaced && !data.remplace_par) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['remplace_par'],
      message: 'remplace_par obligatoire si statut_projet = remplace',
    })
  }
  if (!isReplaced && data.remplace_par) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['remplace_par'],
      message: 'remplace_par interdit si statut_projet ≠ remplace',
    })
  }
}

/**
 * Root zod schema for the canonical (pivot) project: the single source of truth
 * from which the TypeScript type is inferred. Only published projects are
 * stored, hence no editorial status.
 */
export const canonicalProjectSchema = baseCanonicalProjectSchema
  .superRefine(refineProjetRemplacePar)
  .superRefine(refineKebabCaseSlug('slug', (data) => data['statut_projet'] === 'remplace'))
