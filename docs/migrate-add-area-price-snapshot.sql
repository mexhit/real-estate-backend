-- Adds the area_price_snapshot table (one history row per Area per weekly
-- pricing job run) and denormalizes the latest snapshot's values onto the
-- area table so GET /areas can serve them with no join.
BEGIN;

CREATE TABLE IF NOT EXISTS area_price_snapshot (
  id SERIAL PRIMARY KEY,
  "areaId" integer NOT NULL REFERENCES area (id),
  "ranAt" timestamptz NOT NULL,
  "avgPricePerSqm" numeric NULL,
  currency varchar NULL,
  "propertyCount" integer NOT NULL,
  "excludedCount" integer NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "IDX_area_price_snapshot_area_id"
  ON area_price_snapshot ("areaId");

ALTER TABLE area
  ADD COLUMN IF NOT EXISTS "avgPricePerSqm" numeric NULL,
  ADD COLUMN IF NOT EXISTS "avgPriceCurrency" varchar NULL,
  ADD COLUMN IF NOT EXISTS "snapshotPropertyCount" integer NULL,
  ADD COLUMN IF NOT EXISTS "snapshotAt" timestamptz NULL;

COMMIT;
