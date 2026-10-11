-- Adds the Furnished judgement to properties, decided by the Decision Provider (JEV).
-- isFurnished: true/false, or NULL when unknown. furnishedDecidedAt: NULL until JEV has answered,
-- so existing rows are picked up by the enrichment job and backfilled automatically.
BEGIN;

ALTER TABLE property
  ADD COLUMN IF NOT EXISTS "isFurnished" boolean;

ALTER TABLE property
  ADD COLUMN IF NOT EXISTS "furnishedDecidedAt" timestamptz;

CREATE INDEX IF NOT EXISTS "IDX_property_is_furnished"
  ON property ("isFurnished");

COMMIT;
