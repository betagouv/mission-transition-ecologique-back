import { Pool } from 'pg'

/**
 * Drops Payload's `public` schema and the canonical store's `canonical` schema,
 * then recreates an empty `public`: the next Payload start in production
 * rebuilds everything from the migrations.
 */
export class DatabaseSchemaReset {
  constructor(private readonly connectionString: string) {}

  async run(): Promise<void> {
    const pool = new Pool({ connectionString: this.connectionString, max: 1 })
    try {
      await pool.query('DROP SCHEMA IF EXISTS public CASCADE')
      await pool.query('DROP SCHEMA IF EXISTS canonical CASCADE')
      await pool.query('CREATE SCHEMA public')
    } finally {
      await pool.end()
    }
  }
}
