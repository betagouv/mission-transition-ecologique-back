import { z } from 'zod'
import { cuid2Schema, isoDateTimeSchema, slugSchema } from '../../shared/primitives'
import { sourceSchema } from '../enums'

/** Section 1 — Identity. Flat top-level fields. */
export const identiteSchema = z.object({
  /** Internal CUID2 (generated upstream, only validated here). */
  id: cuid2Schema,
  /** Unique human-readable id (URLs). Former `id` in `programs.json`. */
  slug: slugSchema,
  source: sourceSchema,
  /** Last real content change (not the export date). */
  date_mise_a_jour: isoDateTimeSchema,
})
