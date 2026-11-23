import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "ademe_themes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"display_name" varchar,
  	"parent_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "programs_rels" ADD COLUMN "ademe_themes_id" integer;
  ALTER TABLE "_programs_v_rels" ADD COLUMN "ademe_themes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ademe_themes_id" integer;
  ALTER TABLE "ademe_themes" ADD CONSTRAINT "ademe_themes_parent_id_ademe_themes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ademe_themes"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "ademe_themes_code_idx" ON "ademe_themes" USING btree ("code");
  CREATE INDEX "ademe_themes_parent_idx" ON "ademe_themes" USING btree ("parent_id");
  CREATE INDEX "ademe_themes_updated_at_idx" ON "ademe_themes" USING btree ("updated_at");
  CREATE INDEX "ademe_themes_created_at_idx" ON "ademe_themes" USING btree ("created_at");
  ALTER TABLE "programs_rels" ADD CONSTRAINT "programs_rels_ademe_themes_fk" FOREIGN KEY ("ademe_themes_id") REFERENCES "public"."ademe_themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_rels" ADD CONSTRAINT "_programs_v_rels_ademe_themes_fk" FOREIGN KEY ("ademe_themes_id") REFERENCES "public"."ademe_themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ademe_themes_fk" FOREIGN KEY ("ademe_themes_id") REFERENCES "public"."ademe_themes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "programs_rels_ademe_themes_id_idx" ON "programs_rels" USING btree ("ademe_themes_id");
  CREATE INDEX "_programs_v_rels_ademe_themes_id_idx" ON "_programs_v_rels" USING btree ("ademe_themes_id");
  CREATE INDEX "payload_locked_documents_rels_ademe_themes_id_idx" ON "payload_locked_documents_rels" USING btree ("ademe_themes_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ademe_themes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "ademe_themes" CASCADE;
  ALTER TABLE "programs_rels" DROP CONSTRAINT "programs_rels_ademe_themes_fk";
  
  ALTER TABLE "_programs_v_rels" DROP CONSTRAINT "_programs_v_rels_ademe_themes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ademe_themes_fk";
  
  DROP INDEX "programs_rels_ademe_themes_id_idx";
  DROP INDEX "_programs_v_rels_ademe_themes_id_idx";
  DROP INDEX "payload_locked_documents_rels_ademe_themes_id_idx";
  ALTER TABLE "programs_rels" DROP COLUMN "ademe_themes_id";
  ALTER TABLE "_programs_v_rels" DROP COLUMN "ademe_themes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ademe_themes_id";`)
}
