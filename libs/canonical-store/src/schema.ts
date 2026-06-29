import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Canonical store table. `data` holds the full canonical JSON as TEXT, which
 * keeps the schema portable to Postgres (text/jsonb) without touching the
 * repository. Only the dialect of this file changes when the DB migrates.
 */
export const canonicalPrograms = sqliteTable('canonical_programs', {
  canonicalId: text('canonical_id').primaryKey(),
  slug: text('slug').notNull().unique(),
  data: text('data').notNull(),
  updatedAt: text('updated_at').notNull(),
})
