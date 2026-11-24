import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" ADD COLUMN "loan_duration" varchar;
  ALTER TABLE "_programs_v" ADD COLUMN "version_loan_duration" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" DROP COLUMN "loan_duration";
  ALTER TABLE "_programs_v" DROP COLUMN "version_loan_duration";`)
}
