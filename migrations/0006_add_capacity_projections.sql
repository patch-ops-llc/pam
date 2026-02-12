-- Capacity projections: projected hours per account per week
CREATE TABLE IF NOT EXISTS "capacity_projections" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" varchar NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "week_start" date NOT NULL,
  "projected_actual_hours" numeric(8, 2) NOT NULL DEFAULT 0,
  "projected_billable_hours" numeric(8, 2) NOT NULL DEFAULT 0,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "capacity_projections_account_week_unique" ON "capacity_projections" ("account_id", "week_start");
CREATE INDEX IF NOT EXISTS "capacity_projections_account_id_idx" ON "capacity_projections" ("account_id");
CREATE INDEX IF NOT EXISTS "capacity_projections_week_start_idx" ON "capacity_projections" ("week_start");
