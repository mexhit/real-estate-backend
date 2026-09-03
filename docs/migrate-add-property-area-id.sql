-- Adds the nullable areaId FK linking a Property Listing to an Area.
-- Run after docs/migrate-add-area-table.sql. Existing rows are left NULL;
-- there is no backfill.
BEGIN;

ALTER TABLE property
  ADD COLUMN "areaId" integer NULL REFERENCES area (id);

CREATE INDEX IF NOT EXISTS "IDX_property_area_id"
  ON property ("areaId");

COMMIT;
