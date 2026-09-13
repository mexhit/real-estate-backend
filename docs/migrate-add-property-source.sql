-- Adds a source string to properties (which website a listing was scraped from).
-- Existing rows are backfilled to 'duashpi', the only source scraped before this column existed.
BEGIN;

ALTER TABLE property
  ADD COLUMN IF NOT EXISTS "source" character varying;

UPDATE property
  SET "source" = 'duashpi'
  WHERE "source" IS NULL;

ALTER TABLE property
  ALTER COLUMN "source" SET DEFAULT 'duashpi';

ALTER TABLE property
  ALTER COLUMN "source" SET NOT NULL;

COMMIT;
