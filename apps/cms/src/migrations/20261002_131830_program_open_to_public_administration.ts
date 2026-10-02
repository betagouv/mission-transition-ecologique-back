import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" ADD COLUMN "open_to_public_administration" boolean DEFAULT false;
  ALTER TABLE "_programs_v" ADD COLUMN "version_open_to_public_administration" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" DROP COLUMN "open_to_public_administration";
  ALTER TABLE "_programs_v" DROP COLUMN "version_open_to_public_administration";`)
}
