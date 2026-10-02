import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Hand-written: without their column, the rows of the former relationship would stay behind, empty.
  await db.execute(sql`
   DELETE FROM "programs_rels" WHERE "path" = 'linkedProjects';
  DELETE FROM "_programs_v_rels" WHERE "path" = 'version.linkedProjects';
  `)
  await db.execute(sql`
   ALTER TABLE "programs_rels" DROP CONSTRAINT "programs_rels_projects_fk";
  
  ALTER TABLE "_programs_v_rels" DROP CONSTRAINT "_programs_v_rels_projects_fk";
  
  DROP INDEX "programs_rels_projects_id_idx";
  DROP INDEX "_programs_v_rels_projects_id_idx";
  ALTER TABLE "programs_rels" DROP COLUMN "projects_id";
  ALTER TABLE "_programs_v_rels" DROP COLUMN "projects_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs_rels" ADD COLUMN "projects_id" integer;
  ALTER TABLE "_programs_v_rels" ADD COLUMN "projects_id" integer;
  ALTER TABLE "programs_rels" ADD CONSTRAINT "programs_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_rels" ADD CONSTRAINT "_programs_v_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "programs_rels_projects_id_idx" ON "programs_rels" USING btree ("projects_id");
  CREATE INDEX "_programs_v_rels_projects_id_idx" ON "_programs_v_rels" USING btree ("projects_id");`)
}
