CREATE TABLE IF NOT EXISTS "forecast_capacity_resources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"role" text,
	"default_billable_hours" numeric(8, 2) NOT NULL,
	"default_actual_hours" numeric(8, 2) NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "forecast_capacity_allocations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" varchar,
	"prospect_name" text,
	"resource_id" varchar,
	"engagement_type" text DEFAULT 'project' NOT NULL,
	"monthly_billable_hours" numeric(8, 2) NOT NULL,
	"efficiency_percent" numeric(5, 2) DEFAULT '100' NOT NULL,
	"description" text,
	"start_month" date NOT NULL,
	"end_month" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "forecast_capacity_resources" ADD CONSTRAINT "forecast_capacity_resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "forecast_capacity_allocations" ADD CONSTRAINT "forecast_capacity_allocations_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "forecast_capacity_allocations" ADD CONSTRAINT "forecast_capacity_allocations_resource_id_forecast_capacity_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."forecast_capacity_resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "forecast_capacity_allocations_agency_id_idx" ON "forecast_capacity_allocations" USING btree ("agency_id");
CREATE INDEX IF NOT EXISTS "forecast_capacity_allocations_resource_id_idx" ON "forecast_capacity_allocations" USING btree ("resource_id");
