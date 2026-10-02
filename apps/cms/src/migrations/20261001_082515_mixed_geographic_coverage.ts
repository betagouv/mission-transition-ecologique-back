import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_programs_geographic_coverage" ADD VALUE 'regional-departemental';
  ALTER TYPE "public"."enum__programs_v_version_geographic_coverage" ADD VALUE 'regional-departemental';
  ALTER TABLE "geographic_areas" ADD COLUMN "display_name" varchar;`)
  // Hand-written backfill: same title as the `assignDisplayName` hook, for the existing rows.
  await db.execute(sql`
   UPDATE "geographic_areas" SET "display_name" = "name" || ' (' || CASE "coverage_type"::text
     WHEN 'region' THEN 'région'
     WHEN 'departement' THEN 'département'
     WHEN 'commune' THEN 'commune'
     WHEN 'epci' THEN 'EPCI'
     ELSE 'autre' END || ')';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" ALTER COLUMN "geographic_coverage" SET DATA TYPE text;
  DROP TYPE "public"."enum_programs_geographic_coverage";
  CREATE TYPE "public"."enum_programs_geographic_coverage" AS ENUM('national', 'regional', 'departemental');
  ALTER TABLE "programs" ALTER COLUMN "geographic_coverage" SET DATA TYPE "public"."enum_programs_geographic_coverage" USING "geographic_coverage"::"public"."enum_programs_geographic_coverage";
  ALTER TABLE "_programs_v" ALTER COLUMN "version_geographic_coverage" SET DATA TYPE text;
  DROP TYPE "public"."enum__programs_v_version_geographic_coverage";
  CREATE TYPE "public"."enum__programs_v_version_geographic_coverage" AS ENUM('national', 'regional', 'departemental');
  ALTER TABLE "_programs_v" ALTER COLUMN "version_geographic_coverage" SET DATA TYPE "public"."enum__programs_v_version_geographic_coverage" USING "version_geographic_coverage"::"public"."enum__programs_v_version_geographic_coverage";
  ALTER TABLE "geographic_areas" DROP COLUMN "display_name";`)
}
