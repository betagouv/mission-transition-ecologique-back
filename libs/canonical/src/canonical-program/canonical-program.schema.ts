import { z } from 'zod'
import { identiteSchema } from './fields/identite.schema'
import { contenuSchema } from './fields/contenu.schema'
import { aideSchema, refineDuree, refineRemplacePar } from './fields/aide.schema'
import { eligibiliteSchema } from './fields/eligibilite.schema'
import { themeSchema } from './enums'
import { varianteSchema } from './variants/variante.schema'
import { additionalDataSchema } from './additional-data/additional-data.schema'

/**
 * Root zod schema for the canonical (pivot) program format — the single source
 * of truth from which the TypeScript type is inferred.
 *
 * Sections 1–3 are flat top-level keys (merged from their section schemas);
 * sections 4–6 are nested objects. Cross-field rules that span sibling
 * top-level keys are applied here via `superRefine`, but their logic lives in
 * the relevant field module.
 */
const baseCanonicalProgramSchema = identiteSchema
  .merge(contenuSchema)
  .merge(aideSchema)
  .merge(
    z.object({
      eligibilite: eligibiliteSchema.optional(),
      themes: z.array(themeSchema).min(1).optional(),
      variantes: z.array(varianteSchema).optional(),
      autres_donnees: additionalDataSchema.optional(),
    }),
  )

export const canonicalProgramSchema = baseCanonicalProgramSchema
  .superRefine(refineDuree)
  .superRefine(refineRemplacePar)
