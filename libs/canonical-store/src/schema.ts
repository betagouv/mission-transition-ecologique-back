import { pgSchema, text } from 'drizzle-orm/pg-core'

/**
 * Canonical store table, in its own `canonical` schema: Payload owns `public`
 * in the same database, so a CMS change can drop `public` and keep the
 * canonical data. `data` holds the full canonical JSON as text, which keeps the
 * repository free of any dialect-specific JSON handling.
 */
export const CANONICAL_SCHEMA = 'canonical'

export const canonicalSchema = pgSchema(CANONICAL_SCHEMA)

export const canonicalPrograms = canonicalSchema.table('canonical_programs', {
  canonicalId: text('canonical_id').primaryKey(),
  slug: text('slug').notNull().unique(),
  data: text('data').notNull(),
  updatedAt: text('updated_at').notNull(),
})
