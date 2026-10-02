import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" ADD COLUMN "temporarily_unavailable" boolean DEFAULT false;
  ALTER TABLE "_programs_v" ADD COLUMN "version_temporarily_unavailable" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" DROP COLUMN "temporarily_unavailable";
  ALTER TABLE "_programs_v" DROP COLUMN "version_temporarily_unavailable";`)
}
