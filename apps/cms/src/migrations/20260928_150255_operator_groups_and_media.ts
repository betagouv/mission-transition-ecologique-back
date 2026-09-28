import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Hand-edited: media rows uploaded before this migration get a category before
  // the NOT NULL constraint, which a plain ADD COLUMN ... NOT NULL would reject.
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_category" AS ENUM('operator-logo', 'project-image');
  CREATE TABLE "operators_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"operator_groups_id" integer
  );
  
  CREATE TABLE "operator_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"logo_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "media" ADD COLUMN "category" "enum_media_category";
  UPDATE "media" SET "category" = 'project-image' WHERE "category" IS NULL;
  ALTER TABLE "media" ALTER COLUMN "category" SET NOT NULL;
  ALTER TABLE "media" ADD COLUMN "source_path" varchar;
  ALTER TABLE "media" ADD COLUMN "prefix" varchar DEFAULT '';
  ALTER TABLE "media" ADD COLUMN "_objectkey" varchar;
  ALTER TABLE "operators" ADD COLUMN "logo_id" integer;
  ALTER TABLE "projects" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "operator_groups_id" integer;
  ALTER TABLE "operators_rels" ADD CONSTRAINT "operators_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "operators_rels" ADD CONSTRAINT "operators_rels_operator_groups_fk" FOREIGN KEY ("operator_groups_id") REFERENCES "public"."operator_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "operator_groups" ADD CONSTRAINT "operator_groups_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "operators_rels_order_idx" ON "operators_rels" USING btree ("order");
  CREATE INDEX "operators_rels_parent_idx" ON "operators_rels" USING btree ("parent_id");
  CREATE INDEX "operators_rels_path_idx" ON "operators_rels" USING btree ("path");
  CREATE INDEX "operators_rels_operator_groups_id_idx" ON "operators_rels" USING btree ("operator_groups_id");
  CREATE UNIQUE INDEX "operator_groups_name_idx" ON "operator_groups" USING btree ("name");
  CREATE UNIQUE INDEX "operator_groups_slug_idx" ON "operator_groups" USING btree ("slug");
  CREATE INDEX "operator_groups_logo_idx" ON "operator_groups" USING btree ("logo_id");
  CREATE INDEX "operator_groups_updated_at_idx" ON "operator_groups" USING btree ("updated_at");
  CREATE INDEX "operator_groups_created_at_idx" ON "operator_groups" USING btree ("created_at");
  ALTER TABLE "operators" ADD CONSTRAINT "operators_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects" ADD CONSTRAINT "projects_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_operator_groups_fk" FOREIGN KEY ("operator_groups_id") REFERENCES "public"."operator_groups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "media_source_path_idx" ON "media" USING btree ("source_path");
  CREATE INDEX "operators_logo_idx" ON "operators" USING btree ("logo_id");
  CREATE INDEX "projects_image_idx" ON "projects" USING btree ("image_id");
  CREATE INDEX "payload_locked_documents_rels_operator_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("operator_groups_id");
  ALTER TABLE "projects" DROP COLUMN "image";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "operators_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "operator_groups" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "operators_rels" CASCADE;
  DROP TABLE "operator_groups" CASCADE;
  ALTER TABLE "operators" DROP CONSTRAINT "operators_logo_id_media_id_fk";
  
  ALTER TABLE "projects" DROP CONSTRAINT "projects_image_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_operator_groups_fk";
  
  DROP INDEX "media_source_path_idx";
  DROP INDEX "operators_logo_idx";
  DROP INDEX "projects_image_idx";
  DROP INDEX "payload_locked_documents_rels_operator_groups_id_idx";
  ALTER TABLE "projects" ADD COLUMN "image" varchar;
  ALTER TABLE "media" DROP COLUMN "category";
  ALTER TABLE "media" DROP COLUMN "source_path";
  ALTER TABLE "media" DROP COLUMN "prefix";
  ALTER TABLE "media" DROP COLUMN "_objectkey";
  ALTER TABLE "operators" DROP COLUMN "logo_id";
  ALTER TABLE "projects" DROP COLUMN "image_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "operator_groups_id";
  DROP TYPE "public"."enum_media_category";`)
}
