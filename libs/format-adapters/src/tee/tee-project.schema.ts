import { z } from 'zod'
import { emptyAsAbsent } from './emptyAsAbsent'

const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(emptyAsAbsent, schema.optional())

const teeProjectFaqSchema = z.object({ question: z.string(), answer: z.string() }).passthrough()

/**
 * One entry of upstream `projects.json`, generated from the Baserow projects
 * table. A shape guard only: content rules (non-empty title, known theme, NAF
 * code) belong to the canonical validator. An empty or `null` optional cell is
 * read as absent. Unknown keys are kept.
 *
 * Upstream files are checked record by record through `TeeProjectRecords`, so
 * one broken record is set aside on its own instead of failing the whole file.
 */
export const teeProjectSchema = z
  .object({
    id: z.number().int(),
    slug: z.string().min(1),
    title: z.string(),
    nameTag: z.string(),
    shortDescription: z.string(),
    /** Path under the upstream front's public folder. */
    image: optional(z.string()),
    titleLongDescription: optional(z.string()),
    longDescription: z.string(),
    titleMoreDescription: optional(z.string()),
    moreDescription: optional(z.string()),
    themes: z.array(z.string()),
    mainTheme: z.string(),
    /** Program slugs. */
    programs: optional(z.array(z.string())),
    titleLinkedProjects: optional(z.string()),
    descriptionLinkedProjects: optional(z.string()),
    /** Upstream numeric ids of the linked projects. */
    linkedProjects: optional(z.array(z.number().int())),
    /** `default` plus one entry per NAF section or code. */
    priority: optional(z.record(z.number())),
    /** Numeric string, `null` when the project is not highlighted. */
    highlightPriority: z.string().nullable().optional(),
    sectors: optional(z.array(z.string())),
    titleFaq: optional(z.string()),
    faqs: optional(z.array(teeProjectFaqSchema)),
    metaTitle: optional(z.string()),
    metaDescription: optional(z.string()),
  })
  .passthrough()

/** Strict list: one broken record fails it all. For trusted fixtures; upstream reads use `TeeProjectRecords`. */
export const teeProjectsSchema = z.array(teeProjectSchema)

export type TeeProject = z.infer<typeof teeProjectSchema>
