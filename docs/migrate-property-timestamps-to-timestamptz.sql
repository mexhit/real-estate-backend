-- Run this migration before deploying the entity change. Existing timestamp
-- values are interpreted as UTC wall-clock values and preserved as instants.
BEGIN;

ALTER TABLE property
  ALTER COLUMN "createdAt" TYPE timestamptz
    USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE timestamptz
    USING "updatedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "aiMetadataUpdatedAt" TYPE timestamptz
    USING "aiMetadataUpdatedAt" AT TIME ZONE 'UTC';

CREATE INDEX IF NOT EXISTS "IDX_property_provider_id_created_at"
  ON property ("providerId", "createdAt");

COMMIT;
