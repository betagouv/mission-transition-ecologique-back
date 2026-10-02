import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_projects_workflow_status" AS ENUM('en-creation', 'publie', 'en-cours-modification', 'annule', 'remplace');
  CREATE TYPE "public"."enum__projects_v_version_workflow_status" AS ENUM('en-creation', 'publie', 'en-cours-modification', 'annule', 'remplace');
  CREATE TABLE "projects_workflow_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"from" varchar,
  	"to" varchar,
  	"changed_by_id" integer,
  	"changed_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_projects_v_version_workflow_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar,
  	"to" varchar,
  	"changed_by_id" integer,
  	"changed_at" timestamp(3) with time zone,
  	"_uuid" varchar
  );
  
  ALTER TABLE "programs" ADD COLUMN "upstream_fingerprint" varchar;
  ALTER TABLE "_programs_v" ADD COLUMN "version_upstream_fingerprint" varchar;
  ALTER TABLE "projects" ADD COLUMN "upstream_fingerprint" varchar;
  ALTER TABLE "projects" ADD COLUMN "workflow_status" "enum_projects_workflow_status" DEFAULT 'en-creation';
  ALTER TABLE "projects" ADD COLUMN "replaced_by_id" integer;
  ALTER TABLE "_projects_v" ADD COLUMN "version_upstream_fingerprint" varchar;
  ALTER TABLE "_projects_v" ADD COLUMN "version_workflow_status" "enum__projects_v_version_workflow_status" DEFAULT 'en-creation';
  ALTER TABLE "_projects_v" ADD COLUMN "version_replaced_by_id" integer;
  ALTER TABLE "projects_workflow_history" ADD CONSTRAINT "projects_workflow_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects_workflow_history" ADD CONSTRAINT "projects_workflow_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_version_workflow_history" ADD CONSTRAINT "_projects_v_version_workflow_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_projects_v_version_workflow_history" ADD CONSTRAINT "_projects_v_version_workflow_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_workflow_history_order_idx" ON "projects_workflow_history" USING btree ("_order");
  CREATE INDEX "projects_workflow_history_parent_id_idx" ON "projects_workflow_history" USING btree ("_parent_id");
  CREATE INDEX "projects_workflow_history_changed_by_idx" ON "projects_workflow_history" USING btree ("changed_by_id");
  CREATE INDEX "_projects_v_version_workflow_history_order_idx" ON "_projects_v_version_workflow_history" USING btree ("_order");
  CREATE INDEX "_projects_v_version_workflow_history_parent_id_idx" ON "_projects_v_version_workflow_history" USING btree ("_parent_id");
  CREATE INDEX "_projects_v_version_workflow_history_changed_by_idx" ON "_projects_v_version_workflow_history" USING btree ("changed_by_id");
  ALTER TABLE "projects" ADD CONSTRAINT "projects_replaced_by_id_projects_id_fk" FOREIGN KEY ("replaced_by_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_projects_v" ADD CONSTRAINT "_projects_v_version_replaced_by_id_projects_id_fk" FOREIGN KEY ("version_replaced_by_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "projects_replaced_by_idx" ON "projects" USING btree ("replaced_by_id");
  CREATE INDEX "_projects_v_version_version_replaced_by_idx" ON "_projects_v" USING btree ("version_replaced_by_id");`)

  // Hand-written: the generated statements leave every existing project on the
  // default status. A project already published follows the workflow as `publie`.
  await db.execute(sql`
   UPDATE "projects" SET "workflow_status" = 'publie' WHERE "_status" = 'published';
  UPDATE "_projects_v" SET "version_workflow_status" = 'publie' WHERE "version__status" = 'published';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects_workflow_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_projects_v_version_workflow_history" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "projects_workflow_history" CASCADE;
  DROP TABLE "_projects_v_version_workflow_history" CASCADE;
  ALTER TABLE "projects" DROP CONSTRAINT "projects_replaced_by_id_projects_id_fk";
  
  ALTER TABLE "_projects_v" DROP CONSTRAINT "_projects_v_version_replaced_by_id_projects_id_fk";
  
  DROP INDEX "projects_replaced_by_idx";
  DROP INDEX "_projects_v_version_version_replaced_by_idx";
  ALTER TABLE "programs" DROP COLUMN "upstream_fingerprint";
  ALTER TABLE "_programs_v" DROP COLUMN "version_upstream_fingerprint";
  ALTER TABLE "projects" DROP COLUMN "upstream_fingerprint";
  ALTER TABLE "projects" DROP COLUMN "workflow_status";
  ALTER TABLE "projects" DROP COLUMN "replaced_by_id";
  ALTER TABLE "_projects_v" DROP COLUMN "version_upstream_fingerprint";
  ALTER TABLE "_projects_v" DROP COLUMN "version_workflow_status";
  ALTER TABLE "_projects_v" DROP COLUMN "version_replaced_by_id";
  DROP TYPE "public"."enum_projects_workflow_status";
  DROP TYPE "public"."enum__projects_v_version_workflow_status";`)
}
