-- Add status column to proposals table
ALTER TABLE "proposals" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;

-- Add lastEditedAt column to proposals table
ALTER TABLE "proposals" ADD COLUMN "last_edited_at" timestamp DEFAULT now() NOT NULL;

-- Migrate existing data: isPublished=true -> status='published', isPublished=false -> status='draft'
UPDATE "proposals" SET "status" = 'published' WHERE "is_published" = true;
UPDATE "proposals" SET "status" = 'draft' WHERE "is_published" = false;

-- Make htmlContent nullable for drafts
ALTER TABLE "proposals" ALTER COLUMN "html_content" DROP NOT NULL;

-- Add index on status column
CREATE INDEX IF NOT EXISTS "proposals_status_idx" ON "proposals" ("status");

-- Drop isPublished column (data already migrated)
ALTER TABLE "proposals" DROP COLUMN "is_published";
