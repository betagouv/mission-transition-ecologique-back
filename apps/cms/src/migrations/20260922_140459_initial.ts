import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('super-admin', 'admin', 'creator');
  CREATE TYPE "public"."enum_programs_themes" AS ENUM('energy', 'waste', 'mobility', 'environmental', 'building', 'water', 'eco-design', 'rh', 'biodiversite');
  CREATE TYPE "public"."enum_programs_naf_sections" AS ENUM('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U');
  CREATE TYPE "public"."enum_programs_variants_conditions_condition_type" AS ENUM('companySize', 'geographicArea');
  CREATE TYPE "public"."enum_programs_variants_modifications_field" AS ENUM('montant', 'duree', 'urlSource', 'contactOperateur', 'autresOperateurs', 'eligibiliteEffectif', 'autresCriteres');
  CREATE TYPE "public"."enum_programs_aid_type" AS ENUM('financement', 'pret', 'avantage-fiscal', 'formation', 'diagnostic-etude');
  CREATE TYPE "public"."enum_programs_contact_method" AS ENUM('advisor', 'email', 'url');
  CREATE TYPE "public"."enum_programs_company_size" AS ENUM('all', '0-9', '10-19', '20-49', '50-249', '250-499', '500-4999', '5000+', 'specific');
  CREATE TYPE "public"."enum_programs_geographic_coverage" AS ENUM('national', 'regional', 'departemental');
  CREATE TYPE "public"."enum_programs_activity_sector" AS ENUM('all', 'naf-sections', 'specific');
  CREATE TYPE "public"."enum_programs_workflow_status" AS ENUM('en-creation', 'en-relecture', 'en-cours-publication', 'publie', 'en-cours-modification', 'importe', 'annule', 'archive', 'remplace');
  CREATE TYPE "public"."enum_programs_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__programs_v_version_themes" AS ENUM('energy', 'waste', 'mobility', 'environmental', 'building', 'water', 'eco-design', 'rh', 'biodiversite');
  CREATE TYPE "public"."enum__programs_v_version_naf_sections" AS ENUM('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U');
  CREATE TYPE "public"."enum__programs_v_version_variants_conditions_condition_type" AS ENUM('companySize', 'geographicArea');
  CREATE TYPE "public"."enum__programs_v_version_variants_modifications_field" AS ENUM('montant', 'duree', 'urlSource', 'contactOperateur', 'autresOperateurs', 'eligibiliteEffectif', 'autresCriteres');
  CREATE TYPE "public"."enum__programs_v_version_aid_type" AS ENUM('financement', 'pret', 'avantage-fiscal', 'formation', 'diagnostic-etude');
  CREATE TYPE "public"."enum__programs_v_version_contact_method" AS ENUM('advisor', 'email', 'url');
  CREATE TYPE "public"."enum__programs_v_version_company_size" AS ENUM('all', '0-9', '10-19', '20-49', '50-249', '250-499', '500-4999', '5000+', 'specific');
  CREATE TYPE "public"."enum__programs_v_version_geographic_coverage" AS ENUM('national', 'regional', 'departemental');
  CREATE TYPE "public"."enum__programs_v_version_activity_sector" AS ENUM('all', 'naf-sections', 'specific');
  CREATE TYPE "public"."enum__programs_v_version_workflow_status" AS ENUM('en-creation', 'en-relecture', 'en-cours-publication', 'publie', 'en-cours-modification', 'importe', 'annule', 'archive', 'remplace');
  CREATE TYPE "public"."enum__programs_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_projects_themes" AS ENUM('energy', 'waste', 'mobility', 'environmental', 'building', 'water', 'eco-design', 'rh', 'biodiversite');
  CREATE TYPE "public"."enum_projects_sectors" AS ENUM('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U');
  CREATE TYPE "public"."enum_projects_main_theme" AS ENUM('energy', 'waste', 'mobility', 'environmental', 'building', 'water', 'eco-design', 'rh', 'biodiversite');
  CREATE TYPE "public"."enum_geographic_areas_coverage_type" AS ENUM('region', 'departement', 'commune', 'epci', 'autre');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" "enum_users_role" DEFAULT 'creator' NOT NULL,
  	"operator_id" integer,
  	"region" varchar,
  	"team" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "operators" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"contact_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "programs_steps_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_label" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "programs_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" jsonb
  );
  
  CREATE TABLE "programs_themes" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_programs_themes",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "programs_naf_sections" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_programs_naf_sections",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "programs_other_criteria" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "programs_variants_conditions" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"condition_type" "enum_programs_variants_conditions_condition_type",
  	"company_size_value" jsonb
  );
  
  CREATE TABLE "programs_variants_modifications" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"field" "enum_programs_variants_modifications_field",
  	"new_value" varchar,
  	"contact_operator_id" integer
  );
  
  CREATE TABLE "programs_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "programs_workflow_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"from" varchar,
  	"to" varchar,
  	"changed_by_id" integer,
  	"changed_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "programs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"operator_id" integer,
  	"url" varchar,
  	"aid_type" "enum_programs_aid_type",
  	"funding_amount" varchar,
  	"loan_amount" varchar,
  	"tax_benefit_amount" varchar,
  	"formation_remaining_cost" varchar,
  	"formation_duration" varchar,
  	"study_remaining_cost" varchar,
  	"study_duration" varchar,
  	"promise" varchar,
  	"description" jsonb,
  	"validity_start" timestamp(3) with time zone,
  	"validity_end" timestamp(3) with time zone,
  	"contact_method" "enum_programs_contact_method",
  	"contact_email" varchar,
  	"contact_page_url" varchar,
  	"company_size" "enum_programs_company_size" DEFAULT 'all',
  	"company_size_min" numeric,
  	"company_size_max" numeric,
  	"geographic_coverage" "enum_programs_geographic_coverage",
  	"geographic_area_feedback" varchar,
  	"activity_sector" "enum_programs_activity_sector" DEFAULT 'all',
  	"activity_sector_description" varchar,
  	"naf_code" varchar,
  	"additional_info" jsonb,
  	"canonical_id" varchar,
  	"slug" varchar,
  	"workflow_status" "enum_programs_workflow_status" DEFAULT 'en-creation',
  	"replaced_by_id" integer,
  	"last_modified_by_id" integer,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_programs_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "programs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"operators_id" integer,
  	"projects_id" integer,
  	"geographic_areas_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "_programs_v_version_steps_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_label" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programs_v_version_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"description" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programs_v_version_themes" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__programs_v_version_themes",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_programs_v_version_naf_sections" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__programs_v_version_naf_sections",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_programs_v_version_other_criteria" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programs_v_version_variants_conditions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"condition_type" "enum__programs_v_version_variants_conditions_condition_type",
  	"company_size_value" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programs_v_version_variants_modifications" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"field" "enum__programs_v_version_variants_modifications_field",
  	"new_value" varchar,
  	"contact_operator_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programs_v_version_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programs_v_version_workflow_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar,
  	"to" varchar,
  	"changed_by_id" integer,
  	"changed_at" timestamp(3) with time zone,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programs_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_operator_id" integer,
  	"version_url" varchar,
  	"version_aid_type" "enum__programs_v_version_aid_type",
  	"version_funding_amount" varchar,
  	"version_loan_amount" varchar,
  	"version_tax_benefit_amount" varchar,
  	"version_formation_remaining_cost" varchar,
  	"version_formation_duration" varchar,
  	"version_study_remaining_cost" varchar,
  	"version_study_duration" varchar,
  	"version_promise" varchar,
  	"version_description" jsonb,
  	"version_validity_start" timestamp(3) with time zone,
  	"version_validity_end" timestamp(3) with time zone,
  	"version_contact_method" "enum__programs_v_version_contact_method",
  	"version_contact_email" varchar,
  	"version_contact_page_url" varchar,
  	"version_company_size" "enum__programs_v_version_company_size" DEFAULT 'all',
  	"version_company_size_min" numeric,
  	"version_company_size_max" numeric,
  	"version_geographic_coverage" "enum__programs_v_version_geographic_coverage",
  	"version_geographic_area_feedback" varchar,
  	"version_activity_sector" "enum__programs_v_version_activity_sector" DEFAULT 'all',
  	"version_activity_sector_description" varchar,
  	"version_naf_code" varchar,
  	"version_additional_info" jsonb,
  	"version_canonical_id" varchar,
  	"version_slug" varchar,
  	"version_workflow_status" "enum__programs_v_version_workflow_status" DEFAULT 'en-creation',
  	"version_replaced_by_id" integer,
  	"version_last_modified_by_id" integer,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__programs_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_programs_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"operators_id" integer,
  	"projects_id" integer,
  	"geographic_areas_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "projects_themes" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_projects_themes",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "projects_sectors" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_projects_sectors",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "projects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"name_tag" varchar NOT NULL,
  	"short_description" varchar NOT NULL,
  	"image" varchar,
  	"title_long_description" varchar,
  	"long_description" jsonb NOT NULL,
  	"title_more_description" varchar,
  	"more_description" jsonb,
  	"main_theme" "enum_projects_main_theme" NOT NULL,
  	"highlight_priority" numeric,
  	"title_linked_projects" varchar,
  	"description_linked_projects" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "projects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"programs_id" integer,
  	"projects_id" integer
  );
  
  CREATE TABLE "geographic_areas" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"coverage_type" "enum_geographic_areas_coverage_type" NOT NULL,
  	"insee_code" varchar,
  	"is_overseas" boolean DEFAULT false,
  	"parent_area_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "review_comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"program_id" integer NOT NULL,
  	"text" varchar NOT NULL,
  	"author_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"operators_id" integer,
  	"programs_id" integer,
  	"projects_id" integer,
  	"geographic_areas_id" integer,
  	"review_comments_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs_steps_links" ADD CONSTRAINT "programs_steps_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_steps" ADD CONSTRAINT "programs_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_themes" ADD CONSTRAINT "programs_themes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_naf_sections" ADD CONSTRAINT "programs_naf_sections_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_other_criteria" ADD CONSTRAINT "programs_other_criteria_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_variants_conditions" ADD CONSTRAINT "programs_variants_conditions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs_variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_variants_modifications" ADD CONSTRAINT "programs_variants_modifications_contact_operator_id_operators_id_fk" FOREIGN KEY ("contact_operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs_variants_modifications" ADD CONSTRAINT "programs_variants_modifications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs_variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_variants" ADD CONSTRAINT "programs_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_workflow_history" ADD CONSTRAINT "programs_workflow_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs_workflow_history" ADD CONSTRAINT "programs_workflow_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs" ADD CONSTRAINT "programs_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs" ADD CONSTRAINT "programs_replaced_by_id_programs_id_fk" FOREIGN KEY ("replaced_by_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs" ADD CONSTRAINT "programs_last_modified_by_id_users_id_fk" FOREIGN KEY ("last_modified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs_rels" ADD CONSTRAINT "programs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_rels" ADD CONSTRAINT "programs_rels_operators_fk" FOREIGN KEY ("operators_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_rels" ADD CONSTRAINT "programs_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_rels" ADD CONSTRAINT "programs_rels_geographic_areas_fk" FOREIGN KEY ("geographic_areas_id") REFERENCES "public"."geographic_areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_rels" ADD CONSTRAINT "programs_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_version_steps_links" ADD CONSTRAINT "_programs_v_version_steps_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programs_v_version_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_version_steps" ADD CONSTRAINT "_programs_v_version_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_version_themes" ADD CONSTRAINT "_programs_v_version_themes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_version_naf_sections" ADD CONSTRAINT "_programs_v_version_naf_sections_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_version_other_criteria" ADD CONSTRAINT "_programs_v_version_other_criteria_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_version_variants_conditions" ADD CONSTRAINT "_programs_v_version_variants_conditions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programs_v_version_variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_version_variants_modifications" ADD CONSTRAINT "_programs_v_version_variants_modifications_contact_operator_id_operators_id_fk" FOREIGN KEY ("contact_operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programs_v_version_variants_modifications" ADD CONSTRAINT "_programs_v_version_variants_modifications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programs_v_version_variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_version_variants" ADD CONSTRAINT "_programs_v_version_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_version_workflow_history" ADD CONSTRAINT "_programs_v_version_workflow_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programs_v_version_workflow_history" ADD CONSTRAINT "_programs_v_version_workflow_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v" ADD CONSTRAINT "_programs_v_parent_id_programs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programs_v" ADD CONSTRAINT "_programs_v_version_operator_id_operators_id_fk" FOREIGN KEY ("version_operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programs_v" ADD CONSTRAINT "_programs_v_version_replaced_by_id_programs_id_fk" FOREIGN KEY ("version_replaced_by_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programs_v" ADD CONSTRAINT "_programs_v_version_last_modified_by_id_users_id_fk" FOREIGN KEY ("version_last_modified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programs_v_rels" ADD CONSTRAINT "_programs_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_rels" ADD CONSTRAINT "_programs_v_rels_operators_fk" FOREIGN KEY ("operators_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_rels" ADD CONSTRAINT "_programs_v_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_rels" ADD CONSTRAINT "_programs_v_rels_geographic_areas_fk" FOREIGN KEY ("geographic_areas_id") REFERENCES "public"."geographic_areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programs_v_rels" ADD CONSTRAINT "_programs_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_themes" ADD CONSTRAINT "projects_themes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_sectors" ADD CONSTRAINT "projects_sectors_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_programs_fk" FOREIGN KEY ("programs_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "geographic_areas" ADD CONSTRAINT "geographic_areas_parent_area_id_geographic_areas_id_fk" FOREIGN KEY ("parent_area_id") REFERENCES "public"."geographic_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_operators_fk" FOREIGN KEY ("operators_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_programs_fk" FOREIGN KEY ("programs_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_geographic_areas_fk" FOREIGN KEY ("geographic_areas_id") REFERENCES "public"."geographic_areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_review_comments_fk" FOREIGN KEY ("review_comments_id") REFERENCES "public"."review_comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_operator_idx" ON "users" USING btree ("operator_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "operators_name_idx" ON "operators" USING btree ("name");
  CREATE UNIQUE INDEX "operators_slug_idx" ON "operators" USING btree ("slug");
  CREATE INDEX "operators_updated_at_idx" ON "operators" USING btree ("updated_at");
  CREATE INDEX "operators_created_at_idx" ON "operators" USING btree ("created_at");
  CREATE INDEX "programs_steps_links_order_idx" ON "programs_steps_links" USING btree ("_order");
  CREATE INDEX "programs_steps_links_parent_id_idx" ON "programs_steps_links" USING btree ("_parent_id");
  CREATE INDEX "programs_steps_order_idx" ON "programs_steps" USING btree ("_order");
  CREATE INDEX "programs_steps_parent_id_idx" ON "programs_steps" USING btree ("_parent_id");
  CREATE INDEX "programs_themes_order_idx" ON "programs_themes" USING btree ("order");
  CREATE INDEX "programs_themes_parent_idx" ON "programs_themes" USING btree ("parent_id");
  CREATE INDEX "programs_naf_sections_order_idx" ON "programs_naf_sections" USING btree ("order");
  CREATE INDEX "programs_naf_sections_parent_idx" ON "programs_naf_sections" USING btree ("parent_id");
  CREATE INDEX "programs_other_criteria_order_idx" ON "programs_other_criteria" USING btree ("_order");
  CREATE INDEX "programs_other_criteria_parent_id_idx" ON "programs_other_criteria" USING btree ("_parent_id");
  CREATE INDEX "programs_variants_conditions_order_idx" ON "programs_variants_conditions" USING btree ("_order");
  CREATE INDEX "programs_variants_conditions_parent_id_idx" ON "programs_variants_conditions" USING btree ("_parent_id");
  CREATE INDEX "programs_variants_modifications_order_idx" ON "programs_variants_modifications" USING btree ("_order");
  CREATE INDEX "programs_variants_modifications_parent_id_idx" ON "programs_variants_modifications" USING btree ("_parent_id");
  CREATE INDEX "programs_variants_modifications_contact_operator_idx" ON "programs_variants_modifications" USING btree ("contact_operator_id");
  CREATE INDEX "programs_variants_order_idx" ON "programs_variants" USING btree ("_order");
  CREATE INDEX "programs_variants_parent_id_idx" ON "programs_variants" USING btree ("_parent_id");
  CREATE INDEX "programs_workflow_history_order_idx" ON "programs_workflow_history" USING btree ("_order");
  CREATE INDEX "programs_workflow_history_parent_id_idx" ON "programs_workflow_history" USING btree ("_parent_id");
  CREATE INDEX "programs_workflow_history_changed_by_idx" ON "programs_workflow_history" USING btree ("changed_by_id");
  CREATE INDEX "programs_operator_idx" ON "programs" USING btree ("operator_id");
  CREATE UNIQUE INDEX "programs_canonical_id_idx" ON "programs" USING btree ("canonical_id");
  CREATE UNIQUE INDEX "programs_slug_idx" ON "programs" USING btree ("slug");
  CREATE INDEX "programs_replaced_by_idx" ON "programs" USING btree ("replaced_by_id");
  CREATE INDEX "programs_last_modified_by_idx" ON "programs" USING btree ("last_modified_by_id");
  CREATE INDEX "programs_updated_at_idx" ON "programs" USING btree ("updated_at");
  CREATE INDEX "programs_created_at_idx" ON "programs" USING btree ("created_at");
  CREATE INDEX "programs__status_idx" ON "programs" USING btree ("_status");
  CREATE INDEX "programs_rels_order_idx" ON "programs_rels" USING btree ("order");
  CREATE INDEX "programs_rels_parent_idx" ON "programs_rels" USING btree ("parent_id");
  CREATE INDEX "programs_rels_path_idx" ON "programs_rels" USING btree ("path");
  CREATE INDEX "programs_rels_operators_id_idx" ON "programs_rels" USING btree ("operators_id");
  CREATE INDEX "programs_rels_projects_id_idx" ON "programs_rels" USING btree ("projects_id");
  CREATE INDEX "programs_rels_geographic_areas_id_idx" ON "programs_rels" USING btree ("geographic_areas_id");
  CREATE INDEX "programs_rels_users_id_idx" ON "programs_rels" USING btree ("users_id");
  CREATE INDEX "_programs_v_version_steps_links_order_idx" ON "_programs_v_version_steps_links" USING btree ("_order");
  CREATE INDEX "_programs_v_version_steps_links_parent_id_idx" ON "_programs_v_version_steps_links" USING btree ("_parent_id");
  CREATE INDEX "_programs_v_version_steps_order_idx" ON "_programs_v_version_steps" USING btree ("_order");
  CREATE INDEX "_programs_v_version_steps_parent_id_idx" ON "_programs_v_version_steps" USING btree ("_parent_id");
  CREATE INDEX "_programs_v_version_themes_order_idx" ON "_programs_v_version_themes" USING btree ("order");
  CREATE INDEX "_programs_v_version_themes_parent_idx" ON "_programs_v_version_themes" USING btree ("parent_id");
  CREATE INDEX "_programs_v_version_naf_sections_order_idx" ON "_programs_v_version_naf_sections" USING btree ("order");
  CREATE INDEX "_programs_v_version_naf_sections_parent_idx" ON "_programs_v_version_naf_sections" USING btree ("parent_id");
  CREATE INDEX "_programs_v_version_other_criteria_order_idx" ON "_programs_v_version_other_criteria" USING btree ("_order");
  CREATE INDEX "_programs_v_version_other_criteria_parent_id_idx" ON "_programs_v_version_other_criteria" USING btree ("_parent_id");
  CREATE INDEX "_programs_v_version_variants_conditions_order_idx" ON "_programs_v_version_variants_conditions" USING btree ("_order");
  CREATE INDEX "_programs_v_version_variants_conditions_parent_id_idx" ON "_programs_v_version_variants_conditions" USING btree ("_parent_id");
  CREATE INDEX "_programs_v_version_variants_modifications_order_idx" ON "_programs_v_version_variants_modifications" USING btree ("_order");
  CREATE INDEX "_programs_v_version_variants_modifications_parent_id_idx" ON "_programs_v_version_variants_modifications" USING btree ("_parent_id");
  CREATE INDEX "_programs_v_version_variants_modifications_contact_opera_idx" ON "_programs_v_version_variants_modifications" USING btree ("contact_operator_id");
  CREATE INDEX "_programs_v_version_variants_order_idx" ON "_programs_v_version_variants" USING btree ("_order");
  CREATE INDEX "_programs_v_version_variants_parent_id_idx" ON "_programs_v_version_variants" USING btree ("_parent_id");
  CREATE INDEX "_programs_v_version_workflow_history_order_idx" ON "_programs_v_version_workflow_history" USING btree ("_order");
  CREATE INDEX "_programs_v_version_workflow_history_parent_id_idx" ON "_programs_v_version_workflow_history" USING btree ("_parent_id");
  CREATE INDEX "_programs_v_version_workflow_history_changed_by_idx" ON "_programs_v_version_workflow_history" USING btree ("changed_by_id");
  CREATE INDEX "_programs_v_parent_idx" ON "_programs_v" USING btree ("parent_id");
  CREATE INDEX "_programs_v_version_version_operator_idx" ON "_programs_v" USING btree ("version_operator_id");
  CREATE INDEX "_programs_v_version_version_canonical_id_idx" ON "_programs_v" USING btree ("version_canonical_id");
  CREATE INDEX "_programs_v_version_version_slug_idx" ON "_programs_v" USING btree ("version_slug");
  CREATE INDEX "_programs_v_version_version_replaced_by_idx" ON "_programs_v" USING btree ("version_replaced_by_id");
  CREATE INDEX "_programs_v_version_version_last_modified_by_idx" ON "_programs_v" USING btree ("version_last_modified_by_id");
  CREATE INDEX "_programs_v_version_version_updated_at_idx" ON "_programs_v" USING btree ("version_updated_at");
  CREATE INDEX "_programs_v_version_version_created_at_idx" ON "_programs_v" USING btree ("version_created_at");
  CREATE INDEX "_programs_v_version_version__status_idx" ON "_programs_v" USING btree ("version__status");
  CREATE INDEX "_programs_v_created_at_idx" ON "_programs_v" USING btree ("created_at");
  CREATE INDEX "_programs_v_updated_at_idx" ON "_programs_v" USING btree ("updated_at");
  CREATE INDEX "_programs_v_latest_idx" ON "_programs_v" USING btree ("latest");
  CREATE INDEX "_programs_v_rels_order_idx" ON "_programs_v_rels" USING btree ("order");
  CREATE INDEX "_programs_v_rels_parent_idx" ON "_programs_v_rels" USING btree ("parent_id");
  CREATE INDEX "_programs_v_rels_path_idx" ON "_programs_v_rels" USING btree ("path");
  CREATE INDEX "_programs_v_rels_operators_id_idx" ON "_programs_v_rels" USING btree ("operators_id");
  CREATE INDEX "_programs_v_rels_projects_id_idx" ON "_programs_v_rels" USING btree ("projects_id");
  CREATE INDEX "_programs_v_rels_geographic_areas_id_idx" ON "_programs_v_rels" USING btree ("geographic_areas_id");
  CREATE INDEX "_programs_v_rels_users_id_idx" ON "_programs_v_rels" USING btree ("users_id");
  CREATE INDEX "projects_themes_order_idx" ON "projects_themes" USING btree ("order");
  CREATE INDEX "projects_themes_parent_idx" ON "projects_themes" USING btree ("parent_id");
  CREATE INDEX "projects_sectors_order_idx" ON "projects_sectors" USING btree ("order");
  CREATE INDEX "projects_sectors_parent_idx" ON "projects_sectors" USING btree ("parent_id");
  CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");
  CREATE INDEX "projects_updated_at_idx" ON "projects" USING btree ("updated_at");
  CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");
  CREATE INDEX "projects_rels_order_idx" ON "projects_rels" USING btree ("order");
  CREATE INDEX "projects_rels_parent_idx" ON "projects_rels" USING btree ("parent_id");
  CREATE INDEX "projects_rels_path_idx" ON "projects_rels" USING btree ("path");
  CREATE INDEX "projects_rels_programs_id_idx" ON "projects_rels" USING btree ("programs_id");
  CREATE INDEX "projects_rels_projects_id_idx" ON "projects_rels" USING btree ("projects_id");
  CREATE INDEX "geographic_areas_parent_area_idx" ON "geographic_areas" USING btree ("parent_area_id");
  CREATE INDEX "geographic_areas_updated_at_idx" ON "geographic_areas" USING btree ("updated_at");
  CREATE INDEX "geographic_areas_created_at_idx" ON "geographic_areas" USING btree ("created_at");
  CREATE INDEX "review_comments_program_idx" ON "review_comments" USING btree ("program_id");
  CREATE INDEX "review_comments_author_idx" ON "review_comments" USING btree ("author_id");
  CREATE INDEX "review_comments_updated_at_idx" ON "review_comments" USING btree ("updated_at");
  CREATE INDEX "review_comments_created_at_idx" ON "review_comments" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_operators_id_idx" ON "payload_locked_documents_rels" USING btree ("operators_id");
  CREATE INDEX "payload_locked_documents_rels_programs_id_idx" ON "payload_locked_documents_rels" USING btree ("programs_id");
  CREATE INDEX "payload_locked_documents_rels_projects_id_idx" ON "payload_locked_documents_rels" USING btree ("projects_id");
  CREATE INDEX "payload_locked_documents_rels_geographic_areas_id_idx" ON "payload_locked_documents_rels" USING btree ("geographic_areas_id");
  CREATE INDEX "payload_locked_documents_rels_review_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("review_comments_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "operators" CASCADE;
  DROP TABLE "programs_steps_links" CASCADE;
  DROP TABLE "programs_steps" CASCADE;
  DROP TABLE "programs_themes" CASCADE;
  DROP TABLE "programs_naf_sections" CASCADE;
  DROP TABLE "programs_other_criteria" CASCADE;
  DROP TABLE "programs_variants_conditions" CASCADE;
  DROP TABLE "programs_variants_modifications" CASCADE;
  DROP TABLE "programs_variants" CASCADE;
  DROP TABLE "programs_workflow_history" CASCADE;
  DROP TABLE "programs" CASCADE;
  DROP TABLE "programs_rels" CASCADE;
  DROP TABLE "_programs_v_version_steps_links" CASCADE;
  DROP TABLE "_programs_v_version_steps" CASCADE;
  DROP TABLE "_programs_v_version_themes" CASCADE;
  DROP TABLE "_programs_v_version_naf_sections" CASCADE;
  DROP TABLE "_programs_v_version_other_criteria" CASCADE;
  DROP TABLE "_programs_v_version_variants_conditions" CASCADE;
  DROP TABLE "_programs_v_version_variants_modifications" CASCADE;
  DROP TABLE "_programs_v_version_variants" CASCADE;
  DROP TABLE "_programs_v_version_workflow_history" CASCADE;
  DROP TABLE "_programs_v" CASCADE;
  DROP TABLE "_programs_v_rels" CASCADE;
  DROP TABLE "projects_themes" CASCADE;
  DROP TABLE "projects_sectors" CASCADE;
  DROP TABLE "projects" CASCADE;
  DROP TABLE "projects_rels" CASCADE;
  DROP TABLE "geographic_areas" CASCADE;
  DROP TABLE "review_comments" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_programs_themes";
  DROP TYPE "public"."enum_programs_naf_sections";
  DROP TYPE "public"."enum_programs_variants_conditions_condition_type";
  DROP TYPE "public"."enum_programs_variants_modifications_field";
  DROP TYPE "public"."enum_programs_aid_type";
  DROP TYPE "public"."enum_programs_contact_method";
  DROP TYPE "public"."enum_programs_company_size";
  DROP TYPE "public"."enum_programs_geographic_coverage";
  DROP TYPE "public"."enum_programs_activity_sector";
  DROP TYPE "public"."enum_programs_workflow_status";
  DROP TYPE "public"."enum_programs_status";
  DROP TYPE "public"."enum__programs_v_version_themes";
  DROP TYPE "public"."enum__programs_v_version_naf_sections";
  DROP TYPE "public"."enum__programs_v_version_variants_conditions_condition_type";
  DROP TYPE "public"."enum__programs_v_version_variants_modifications_field";
  DROP TYPE "public"."enum__programs_v_version_aid_type";
  DROP TYPE "public"."enum__programs_v_version_contact_method";
  DROP TYPE "public"."enum__programs_v_version_company_size";
  DROP TYPE "public"."enum__programs_v_version_geographic_coverage";
  DROP TYPE "public"."enum__programs_v_version_activity_sector";
  DROP TYPE "public"."enum__programs_v_version_workflow_status";
  DROP TYPE "public"."enum__programs_v_version_status";
  DROP TYPE "public"."enum_projects_themes";
  DROP TYPE "public"."enum_projects_sectors";
  DROP TYPE "public"."enum_projects_main_theme";
  DROP TYPE "public"."enum_geographic_areas_coverage_type";`)
}
