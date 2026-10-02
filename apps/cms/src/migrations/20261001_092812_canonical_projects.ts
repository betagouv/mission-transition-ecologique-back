import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_projects_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__projects_v_version_themes" AS ENUM('energy', 'waste', 'mobility', 'environmental', 'building', 'water', 'eco-design', 'rh', 'biodiversite');
  CREATE TYPE "public"."enum__projects_v_version_sectors" AS ENUM('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U');
  CREATE TYPE "public"."enum__projects_v_version_main_theme" AS ENUM('energy', 'waste', 'mobility', 'environmental', 'building', 'water', 'eco-design', 'rh', 'biodiversite');
  CREATE TYPE "public"."enum__projects_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "projects_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb
  );
  
  CREATE TABLE "projects_sector_priorities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"naf_code" varchar,
  	"priority" numeric
  );
  
  CREATE TABLE "_projects_v_version_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_projects_v_version_themes" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__projects_v_version_themes",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_projects_v_version_sectors" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__projects_v_version_sectors",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_projects_v_version_sector_priorities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"naf_code" varchar,
  	"priority" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_projects_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_canonical_id" varchar,
  	"version_slug" varchar,
  	"version_title" varchar,
  	"version_name_tag" varchar,
  	"version_short_description" varchar,
  	"version_image_id" integer,
  	"version_title_long_description" varchar,
  	"version_long_description" jsonb,
  	"version_title_more_description" varchar,
  	"version_more_description" jsonb,
  	"version_title_faq" varchar,
  	"version_main_theme" "enum__projects_v_version_main_theme",
  	"version_highlight_priority" numeric,
  	"version_default_priority" numeric,
  	"version_title_linked_projects" varchar,
  	"version_description_linked_projects" varchar,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__projects_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_projects_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"programs_id" integer,
  	"projects_id" integer
  );
  
  ALTER TABLE "projects" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "projects" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "projects" ALTER COLUMN "name_tag" DROP NOT NULL;
  ALTER TABLE "projects" ALTER COLUMN "short_description" DROP NOT NULL;
  ALTER TABLE "projects" ALTER COLUMN "long_description" DROP NOT NULL;
  ALTER TABLE "projects" ALTER COLUMN "main_theme" DROP NOT NULL;
  ALTER TABLE "projects" ADD COLUMN "canonical_id" varchar;
  ALTER TABLE "projects" ADD COLUMN "title_faq" varchar;
  ALTER TABLE "projects" ADD COLUMN "default_priority" numeric;
  ALTER TABLE "projects" ADD COLUMN "_status" "enum_projects_status" DEFAULT 'draft';
  ALTER TABLE "projects_faqs" ADD CONSTRAINT "projects_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_sector_priorities" ADD CONSTRAINT "projects_sector_priorities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_version_faqs" ADD CONSTRAINT "_projects_v_version_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_version_themes" ADD CONSTRAINT "_projects_v_version_themes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_version_sectors" ADD CONSTRAINT "_projects_v_version_sectors_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_version_sector_priorities" ADD CONSTRAINT "_projects_v_version_sector_priorities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v" ADD CONSTRAINT "_projects_v_parent_id_projects_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_projects_v" ADD CONSTRAINT "_projects_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_projects_v_rels" ADD CONSTRAINT "_projects_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_rels" ADD CONSTRAINT "_projects_v_rels_programs_fk" FOREIGN KEY ("programs_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_rels" ADD CONSTRAINT "_projects_v_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_faqs_order_idx" ON "projects_faqs" USING btree ("_order");
  CREATE INDEX "projects_faqs_parent_id_idx" ON "projects_faqs" USING btree ("_parent_id");
  CREATE INDEX "projects_sector_priorities_order_idx" ON "projects_sector_priorities" USING btree ("_order");
  CREATE INDEX "projects_sector_priorities_parent_id_idx" ON "projects_sector_priorities" USING btree ("_parent_id");
  CREATE INDEX "_projects_v_version_faqs_order_idx" ON "_projects_v_version_faqs" USING btree ("_order");
  CREATE INDEX "_projects_v_version_faqs_parent_id_idx" ON "_projects_v_version_faqs" USING btree ("_parent_id");
  CREATE INDEX "_projects_v_version_themes_order_idx" ON "_projects_v_version_themes" USING btree ("order");
  CREATE INDEX "_projects_v_version_themes_parent_idx" ON "_projects_v_version_themes" USING btree ("parent_id");
  CREATE INDEX "_projects_v_version_sectors_order_idx" ON "_projects_v_version_sectors" USING btree ("order");
  CREATE INDEX "_projects_v_version_sectors_parent_idx" ON "_projects_v_version_sectors" USING btree ("parent_id");
  CREATE INDEX "_projects_v_version_sector_priorities_order_idx" ON "_projects_v_version_sector_priorities" USING btree ("_order");
  CREATE INDEX "_projects_v_version_sector_priorities_parent_id_idx" ON "_projects_v_version_sector_priorities" USING btree ("_parent_id");
  CREATE INDEX "_projects_v_parent_idx" ON "_projects_v" USING btree ("parent_id");
  CREATE INDEX "_projects_v_version_version_canonical_id_idx" ON "_projects_v" USING btree ("version_canonical_id");
  CREATE INDEX "_projects_v_version_version_slug_idx" ON "_projects_v" USING btree ("version_slug");
  CREATE INDEX "_projects_v_version_version_image_idx" ON "_projects_v" USING btree ("version_image_id");
  CREATE INDEX "_projects_v_version_version_updated_at_idx" ON "_projects_v" USING btree ("version_updated_at");
  CREATE INDEX "_projects_v_version_version_created_at_idx" ON "_projects_v" USING btree ("version_created_at");
  CREATE INDEX "_projects_v_version_version__status_idx" ON "_projects_v" USING btree ("version__status");
  CREATE INDEX "_projects_v_created_at_idx" ON "_projects_v" USING btree ("created_at");
  CREATE INDEX "_projects_v_updated_at_idx" ON "_projects_v" USING btree ("updated_at");
  CREATE INDEX "_projects_v_latest_idx" ON "_projects_v" USING btree ("latest");
  CREATE INDEX "_projects_v_rels_order_idx" ON "_projects_v_rels" USING btree ("order");
  CREATE INDEX "_projects_v_rels_parent_idx" ON "_projects_v_rels" USING btree ("parent_id");
  CREATE INDEX "_projects_v_rels_path_idx" ON "_projects_v_rels" USING btree ("path");
  CREATE INDEX "_projects_v_rels_programs_id_idx" ON "_projects_v_rels" USING btree ("programs_id");
  CREATE INDEX "_projects_v_rels_projects_id_idx" ON "_projects_v_rels" USING btree ("projects_id");
  CREATE UNIQUE INDEX "projects_canonical_id_idx" ON "projects" USING btree ("canonical_id");
  CREATE INDEX "projects__status_idx" ON "projects" USING btree ("_status");`)
  // Hand-written backfill: the existing projects stay online, with the same
  // canonical id as `SlugCanonicalId.forProject` ('c' + 23 hex chars of sha256('project:<slug>')).
  await db.execute(sql`
   UPDATE "projects" SET "_status" = 'published';
  UPDATE "projects" SET "canonical_id" = 'c' || substr(encode(sha256(convert_to('project:' || "slug", 'UTF8')), 'hex'), 1, 23) WHERE "canonical_id" IS NULL;`)
  // Hand-written backfill: the admin list reads the latest version of each
  // document, so a project without any version row would no longer be listed.
  await db.execute(sql`
   INSERT INTO "_projects_v" (
     "parent_id", "version_canonical_id", "version_slug", "version_title", "version_name_tag",
     "version_short_description", "version_image_id", "version_title_long_description",
     "version_long_description", "version_title_more_description", "version_more_description",
     "version_main_theme", "version_highlight_priority", "version_title_linked_projects",
     "version_description_linked_projects", "version_meta_title", "version_meta_description",
     "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest"
   )
   SELECT
     "id", "canonical_id", "slug", "title", "name_tag",
     "short_description", "image_id", "title_long_description",
     "long_description", "title_more_description", "more_description",
     "main_theme"::text::"enum__projects_v_version_main_theme", "highlight_priority", "title_linked_projects",
     "description_linked_projects", "meta_title", "meta_description",
     "updated_at", "created_at", 'published', "updated_at", "updated_at", true
   FROM "projects";
  INSERT INTO "_projects_v_version_themes" ("order", "parent_id", "value")
   SELECT t."order", v."id", t."value"::text::"enum__projects_v_version_themes"
   FROM "projects_themes" t JOIN "_projects_v" v ON v."parent_id" = t."parent_id";
  INSERT INTO "_projects_v_version_sectors" ("order", "parent_id", "value")
   SELECT s."order", v."id", s."value"::text::"enum__projects_v_version_sectors"
   FROM "projects_sectors" s JOIN "_projects_v" v ON v."parent_id" = s."parent_id";
  INSERT INTO "_projects_v_rels" ("order", "parent_id", "path", "programs_id", "projects_id")
   SELECT r."order", v."id", 'version.' || r."path", r."programs_id", r."projects_id"
   FROM "projects_rels" r JOIN "_projects_v" v ON v."parent_id" = r."parent_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects_faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects_sector_priorities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_projects_v_version_faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_projects_v_version_themes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_projects_v_version_sectors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_projects_v_version_sector_priorities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_projects_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_projects_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "projects_faqs" CASCADE;
  DROP TABLE "projects_sector_priorities" CASCADE;
  DROP TABLE "_projects_v_version_faqs" CASCADE;
  DROP TABLE "_projects_v_version_themes" CASCADE;
  DROP TABLE "_projects_v_version_sectors" CASCADE;
  DROP TABLE "_projects_v_version_sector_priorities" CASCADE;
  DROP TABLE "_projects_v" CASCADE;
  DROP TABLE "_projects_v_rels" CASCADE;
  DROP INDEX "projects_canonical_id_idx";
  DROP INDEX "projects__status_idx";
  ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "projects" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "projects" ALTER COLUMN "name_tag" SET NOT NULL;
  ALTER TABLE "projects" ALTER COLUMN "short_description" SET NOT NULL;
  ALTER TABLE "projects" ALTER COLUMN "long_description" SET NOT NULL;
  ALTER TABLE "projects" ALTER COLUMN "main_theme" SET NOT NULL;
  ALTER TABLE "projects" DROP COLUMN "canonical_id";
  ALTER TABLE "projects" DROP COLUMN "title_faq";
  ALTER TABLE "projects" DROP COLUMN "default_priority";
  ALTER TABLE "projects" DROP COLUMN "_status";
  DROP TYPE "public"."enum_projects_status";
  DROP TYPE "public"."enum__projects_v_version_themes";
  DROP TYPE "public"."enum__projects_v_version_sectors";
  DROP TYPE "public"."enum__projects_v_version_main_theme";
  DROP TYPE "public"."enum__projects_v_version_status";`)
}
